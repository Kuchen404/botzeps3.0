import type Database from "better-sqlite3";
import { STANDARD_SPORTARTEN } from "../domain/sportarten.js";
import { compendiumVorschlag } from "../domain/neue-sportart.js";
import { lokalesDatum, plusTage } from "../scoring/datum.js";

/** Bisher eine Sportart, jetzt zwei: der alte Eintrag wird zur lockeren Variante. */
export const GETEILT = ["Radfahren", "Tanzen", "Schwimmen"] as const;

/** Alte Stufen für Sportarten, die weder in der Startliste noch im Compendium stehen. */
const ALTE_STUFE: Record<number, number> = { 1: 1, 2: 2.5, 3: 4.5 };

/** Wochenziel, Boss-Lebenspunkte und Tresor wachsen mit, damit alles gleich schwer bleibt. */
export const ZIEL_FAKTOR = 1.5;

const auf50 = (x: number) => Math.max(50, Math.round(x / 50) * 50);

/**
 * Rechnet alle Gruppen auf Faktoren nach MET − 3 um (Teil von Migration 12):
 * Sportarten neu bewerten und teilen, laufende Seasons rückwirkend neu rechnen und
 * dort eine Ankündigung in der Gruppe planen. Abgeschlossene Seasons bleiben, wie sie waren.
 */
export function faktorenNachMet(db: Database.Database, jetzt: Date, zeitzone = "Europe/Berlin"): void {
  const gruppen = (db.prepare("SELECT id FROM gruppe").all() as { id: number }[]).map((g) => g.id);
  const finde = db.prepare("SELECT id, name, faktor FROM sportart WHERE gruppe = ? AND name = ? COLLATE NOCASE");
  const neu = db.prepare("INSERT OR IGNORE INTO sportart (gruppe, name, faktor, kriterium, nach_schritten) VALUES (?, ?, ?, ?, ?)");
  const setze = db.prepare("UPDATE sportart SET name = ?, faktor = ?, kriterium = ?, nach_schritten = ? WHERE id = ?");
  const geteilteIds = new Set<number>();

  for (const gruppe of gruppen) {
    for (const grund of GETEILT) {
      const alt = finde.get(gruppe, grund) as { id: number } | undefined;
      if (alt && !finde.get(gruppe, `${grund} locker`)) {
        db.prepare("UPDATE sportart SET name = ? WHERE id = ?").run(`${grund} locker`, alt.id);
        geteilteIds.add(alt.id);
      }
    }
    for (const s of STANDARD_SPORTARTEN) {
      const da = finde.get(gruppe, s.name) as { id: number } | undefined;
      const werte = [s.name, s.faktor, s.kriterium ?? null, s.nachSchritten ? 1 : 0] as const;
      if (da) setze.run(...werte, da.id);
      else neu.run(gruppe, ...werte);
    }
    // Per Abstimmung dazugekommene: Wert aus dem Compendium, sonst die alte Stufe übersetzt
    const standard = new Set(STANDARD_SPORTARTEN.map((s) => s.name.toLocaleLowerCase("de")));
    const eigene = db.prepare("SELECT id, name, faktor FROM sportart WHERE gruppe = ?").all(gruppe) as { id: number; name: string; faktor: number }[];
    for (const s of eigene) {
      if (standard.has(s.name.toLocaleLowerCase("de"))) continue;
      const faktor = compendiumVorschlag(s.name)?.faktor ?? ALTE_STUFE[s.faktor] ?? s.faktor;
      db.prepare("UPDATE sportart SET faktor = ? WHERE id = ?").run(faktor, s.id);
    }
  }

  // Offene Abstimmungen: alte Stufen in Faktoren übersetzen
  for (const spalte of ["vorschlag", "ergebnis"] as const) {
    db.prepare(`UPDATE abstimmung SET ${spalte} = CASE ${spalte} WHEN 1 THEN 1 WHEN 2 THEN 2.5 WHEN 3 THEN 4.5 ELSE ${spalte} END WHERE beendet_am IS NULL`).run();
  }
  db.prepare(
    `UPDATE stimme SET faktor = CASE faktor WHEN 1 THEN 1 WHEN 2 THEN 2.5 WHEN 3 THEN 4.5 ELSE faktor END
     WHERE abstimmung IN (SELECT id FROM abstimmung WHERE beendet_am IS NULL)`,
  ).run();

  // Laufende und geplante Seasons: rückwirkend neu rechnen
  const heute = lokalesDatum(jetzt, zeitzone);
  const seasons = db.prepare("SELECT id, gruppe, start, wochen, wochenziel_last FROM season").all() as {
    id: number;
    gruppe: number;
    start: string;
    wochen: number;
    wochenziel_last: number;
  }[];
  for (const s of seasons) {
    const ende = plusTage(s.start, s.wochen * 7 - 1);
    if (ende < heute) continue;
    db.prepare("UPDATE season SET wochenziel_last = ? WHERE id = ?").run(Math.round(s.wochenziel_last * ZIEL_FAKTOR), s.id);
    db.prepare(
      `UPDATE training SET
         faktor = (SELECT faktor FROM sportart WHERE id = training.sportart),
         variante_offen = CASE WHEN sportart IN (${[...geteilteIds].join(",") || "NULL"}) THEN 1 ELSE 0 END
       WHERE sportart IN (SELECT id FROM sportart WHERE gruppe = ?) AND datum BETWEEN ? AND ?`,
    ).run(s.gruppe, s.start, ende);
    for (const b of db.prepare("SELECT stufe, lebenspunkte FROM boss WHERE season = ?").all(s.id) as { stufe: number; lebenspunkte: number }[]) {
      db.prepare("UPDATE boss SET lebenspunkte = ? WHERE season = ? AND stufe = ?").run(auf50(b.lebenspunkte * ZIEL_FAKTOR), s.id, b.stufe);
    }
    for (const m of db.prepare("SELECT woche, daten FROM minispiel WHERE season = ? AND daten IS NOT NULL").all(s.id) as { woche: number; daten: string }[]) {
      const daten = JSON.parse(m.daten) as { art: string; ziel?: number };
      if (daten.art !== "tresor" || typeof daten.ziel !== "number") continue;
      daten.ziel = auf50(daten.ziel * ZIEL_FAKTOR);
      db.prepare("UPDATE minispiel SET daten = ? WHERE season = ? AND woche = ?").run(JSON.stringify(daten), s.id, m.woche);
    }
    db.prepare("INSERT OR IGNORE INTO termin (art, season, nutzer, faellig_am) VALUES ('faktoren_neu', ?, NULL, ?)").run(s.id, jetzt.toISOString());
  }
}
