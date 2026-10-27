import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migriere, oeffneDb } from "./index.js";
import { MIGRATIONEN } from "./migrationen.js";
import { speichereGruppe, speichereNutzer, sportartenDerGruppe, trageMitgliedEin } from "./repo.js";
import { STANDARD_SPORTARTEN } from "../domain/sportarten.js";

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
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(m.version, m.name);
    }
    const n = speichereNutzer(db, 1, "Test");
    db.prepare("INSERT INTO messung (nutzer, zeitpunkt, datum, gewicht_kg, fett_pct, muskel_pct, markiert) VALUES (?, ?, ?, ?, ?, ?, 1)").run(
      n.id, "2026-10-26T07:00:00Z", "2026-10-26", 88.5, 20.7, 51.2,
    );
    expect(migriere(db)).toEqual([11]);
    expect(db.prepare("SELECT nutzer, datum, muskel_pct AS m, markiert FROM messung").all()).toEqual([{ nutzer: n.id, datum: "2026-10-26", m: 51.2, markiert: 1 }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messung'").all()).toEqual([{ name: "messung_nutzer_datum" }]);
  });
});
