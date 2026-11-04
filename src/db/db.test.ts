import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migriere, oeffneDb } from "./index.js";
import { MIGRATIONEN } from "./migrationen.js";
import { speichereGruppe, speichereNutzer, sportartenDerGruppe, trageMitgliedEin } from "./repo.js";
import { STANDARD_SPORTARTEN } from "../domain/sportarten.js";
import { lokalesDatum, plusTage } from "../scoring/datum.js";

describe("Datenbank", () => {
  it("migriert genau einmal", () => {
    const db = oeffneDb(":memory:");
    expect(migriere(db)).toEqual([]);
    const versionen = db.prepare("SELECT version FROM schema_version").all();
    expect(versionen).toHaveLength(MIGRATIONEN.length);
  });

  it("registriert Nutzer und Gruppen idempotent", () => {
    const db = oeffneDb(":memory:");
    const a = speichereNutzer(db, 42, "Kevin");
    const b = speichereNutzer(db, 42, "Kevin K.");
    expect(b.id).toBe(a.id);
    expect(b.name).toBe("Kevin K.");

    const g1 = speichereGruppe(db, -100, "Pumper");
    const g2 = speichereGruppe(db, -100, "Pumper 2026");
    expect(g2).toBe(g1);
    expect(sportartenDerGruppe(db, g1)).toHaveLength(STANDARD_SPORTARTEN.length);

    expect(trageMitgliedEin(db, g1, a.id)).toBe(true);
    expect(trageMitgliedEin(db, g1, a.id)).toBe(false);
  });

  it("lehnt unplausible Messwerte ab", () => {
    const db = oeffneDb(":memory:");
    const n = speichereNutzer(db, 1, "Test");
    const neu = db.prepare(
      "INSERT INTO messung (nutzer, zeitpunkt, datum, gewicht_kg, fett_pct, muskel_pct) VALUES (?, ?, ?, ?, ?, ?)",
    );
    expect(() => neu.run(n.id, "2026-10-06T07:00:00Z", "2026-10-06", 80, 2, 40)).toThrow(/CHECK/);
    expect(() => neu.run(n.id, "2026-10-06T07:00:00Z", "2026-10-06", 80, 20, 40)).not.toThrow();
    expect(() => neu.run(n.id, "2026-10-06T07:00:00Z", "2026-10-06", 80, 20, 75.4)).not.toThrow();
    expect(() => neu.run(n.id, "2026-10-06T07:00:00Z", "2026-10-06", 80, 20, 91)).toThrow(/CHECK/);
  });

  it("Migration auf Muskel bis 90 % behält vorhandene Messungen", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, ausgefuehrt_am TEXT)");
    for (const m of MIGRATIONEN.filter((m) => m.version < 11)) {
      db.exec(m.sql!);
      db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(m.version, m.name);
    }
    const n = speichereNutzer(db, 1, "Test");
    db.prepare("INSERT INTO messung (nutzer, zeitpunkt, datum, gewicht_kg, fett_pct, muskel_pct, markiert) VALUES (?, ?, ?, ?, ?, ?, 1)").run(
      n.id, "2026-10-26T07:00:00Z", "2026-10-26", 88.5, 20.7, 51.2,
    );
    expect(migriere(db)).toEqual([11, 12]);
    expect(db.prepare("SELECT nutzer, datum, muskel_pct AS m, markiert FROM messung").all()).toEqual([{ nutzer: n.id, datum: "2026-10-26", m: 51.2, markiert: 1 }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messung'").all()).toEqual([{ name: "messung_nutzer_datum" }]);
  });

  it("Migration 12: Faktoren nach MET − 3, Varianten, laufende Season rückwirkend, alte bleibt", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, ausgefuehrt_am TEXT)");
    for (const m of MIGRATIONEN.filter((m) => m.version < 12)) {
      db.exec(m.sql!);
      db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(m.version, m.name);
    }
    const heute = lokalesDatum(new Date(), "Europe/Berlin");
    const kevin = speichereNutzer(db, 1, "Kevin");
    db.prepare("INSERT INTO gruppe (id, telegram_chat_id, name) VALUES (1, -100, 'Pumper')").run();
    const alt: [string, number][] = [
      ["Spazierengehen", 1], ["Yoga", 1], ["Krafttraining", 2], ["Radfahren", 2], ["Schwimmen", 2], ["Tanzen", 2],
      ["Joggen", 3], ["Spinning", 3], ["Bouldern", 3], ["Quidditch", 2],
    ];
    const sportart = new Map<string, number>();
    for (const [name, faktor] of alt) {
      const { id } = db.prepare("INSERT INTO sportart (gruppe, name, faktor) VALUES (1, ?, ?) RETURNING id").get(name, faktor) as { id: number };
      sportart.set(name, id);
    }
    // Alte Season vorbei, neue läuft seit vorgestern
    db.prepare("INSERT INTO season (id, gruppe, name, start, wochen) VALUES (1, 1, 'Sommer', ?, 4), (2, 1, 'Herbst', ?, 10)").run(
      plusTage(heute, -120),
      plusTage(heute, -2),
    );
    db.prepare("INSERT INTO boss (season, stufe, name, lebenspunkte, schwaeche) VALUES (2, 1, 'König Bierbauch', 650, ?)").run(sportart.get("Joggen"));
    db.prepare("INSERT INTO minispiel (season, woche, art, daten) VALUES (2, 1, 'tresor', ?)").run(JSON.stringify({ art: "tresor", spieler: [], code: [1, 2, 3, 4], ziel: 500 }));
    const training = db.prepare("INSERT INTO training (nutzer, datum, minuten, sportart, faktor) VALUES (?, ?, ?, ?, ?) RETURNING id");
    const altesJoggen = (training.get(kevin.id, plusTage(heute, -110), 30, sportart.get("Joggen"), 3) as { id: number }).id;
    const rad = (training.get(kevin.id, plusTage(heute, -2), 60, sportart.get("Radfahren"), 2) as { id: number }).id;
    const spazieren = (training.get(kevin.id, plusTage(heute, -1), 60, sportart.get("Spazierengehen"), 1) as { id: number }).id;
    // Offene Abstimmung mit alter Stufe
    db.prepare("INSERT INTO abstimmung (id, gruppe, name, vorschlag, antragsteller, erstellt_am) VALUES (1, 1, 'Handball', 3, ?, ?)").run(kevin.id, new Date().toISOString());
    db.prepare("INSERT INTO stimme (abstimmung, nutzer, faktor) VALUES (1, ?, 2)").run(kevin.id);

    expect(migriere(db)).toEqual([12]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("foreign_key_check")).toEqual([]);

    const faktoren = Object.fromEntries(
      (db.prepare("SELECT name, faktor FROM sportart WHERE gruppe = 1").all() as { name: string; faktor: number }[]).map((z) => [z.name, z.faktor]),
    );
    expect(faktoren).toMatchObject({
      Spazierengehen: 0.5,
      Yoga: 1,
      Krafttraining: 3,
      "Radfahren locker": 1,
      "Radfahren sportlich": 5,
      "Schwimmen locker": 3,
      "Schwimmen sportlich": 5,
      "Tanzen locker": 1,
      "Tanzen sportlich": 4.5,
      Joggen: 4.5,
      Spinning: 6,
      Bouldern: 6, // aus dem Compendium
      Quidditch: 2.5, // alte Stufe „mittel“ übersetzt
      Wandern: 2.5, // fehlende Standard-Sportarten ergänzt
    });
    expect(faktoren).not.toHaveProperty("Radfahren");
    expect(db.prepare("SELECT nach_schritten FROM sportart WHERE name = 'Spazierengehen'").get()).toEqual({ nach_schritten: 1 });

    const t = (id: number) => db.prepare("SELECT t.faktor, s.name, t.variante_offen AS offen FROM training t JOIN sportart s ON s.id = t.sportart WHERE t.id = ?").get(id);
    expect(t(altesJoggen)).toEqual({ faktor: 3, name: "Joggen", offen: 0 }); // abgeschlossene Season bleibt
    expect(t(rad)).toEqual({ faktor: 1, name: "Radfahren locker", offen: 1 }); // darf auf sportlich umgestellt werden
    expect(t(spazieren)).toEqual({ faktor: 0.5, name: "Spazierengehen", offen: 0 });

    expect(db.prepare("SELECT id, wochenziel_last AS ziel FROM season ORDER BY id").all()).toEqual([{ id: 1, ziel: 300 }, { id: 2, ziel: 450 }]);
    expect(db.prepare("SELECT lebenspunkte, schwaeche FROM boss").get()).toEqual({ lebenspunkte: 1000, schwaeche: sportart.get("Joggen") });
    expect(JSON.parse((db.prepare("SELECT daten FROM minispiel").get() as { daten: string }).daten).ziel).toBe(750);
    expect(db.prepare("SELECT vorschlag FROM abstimmung").get()).toEqual({ vorschlag: 4.5 });
    expect(db.prepare("SELECT faktor FROM stimme").get()).toEqual({ faktor: 2.5 });
    expect(db.prepare("SELECT art, season FROM termin").all()).toEqual([{ art: "faktoren_neu", season: 2 }]);
    // Kommafaktoren gehen jetzt rein, Unsinn nicht
    expect(() => db.prepare("UPDATE training SET faktor = 4.5 WHERE id = ?").run(rad)).not.toThrow();
    expect(() => db.prepare("UPDATE training SET faktor = 0 WHERE id = ?").run(rad)).toThrow(/CHECK/);
  });
});
