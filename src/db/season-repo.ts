import type { Db } from "./index.js";
import type { Faktor } from "../scoring/fleiss.js";
import type { Messung } from "../scoring/fortschritt.js";
import { type SeasonEinstellungen, type Teilnehmer, kalibrierFenster, seasonEnde } from "../scoring/season.js";

export interface SeasonZeile {
  id: number;
  gruppe: number;
  name: string;
  start: string;
  wochen: number;
  gewicht_fleiss: number;
  gewicht_fortschritt: number;
  wochenziel_last: number;
  erstellt_von: number | null;
}

const SPALTEN = "id, gruppe, name, start, wochen, gewicht_fleiss, gewicht_fortschritt, wochenziel_last, erstellt_von";

export function einstellungen(s: SeasonZeile): SeasonEinstellungen {
  return {
    start: s.start,
    wochen: s.wochen,
    gewichtFleiss: s.gewicht_fleiss,
    gewichtFortschritt: s.gewicht_fortschritt,
    wochenzielLast: s.wochenziel_last,
  };
}

/** Die Season der Gruppe, die noch nicht vorbei ist (läuft oder steht bevor). */
export function aktuelleSeason(db: Db, gruppeId: number, heute: string): SeasonZeile | undefined {
  const alle = db
    .prepare(`SELECT ${SPALTEN} FROM season WHERE gruppe = ? ORDER BY start DESC`)
    .all(gruppeId) as SeasonZeile[];
  return alle.find((s) => seasonEnde(s) >= heute);
}

/** Die zuletzt gestartete Season der Gruppe, auch wenn sie schon vorbei ist. */
export function letzteSeason(db: Db, gruppeId: number, heute: string): SeasonZeile | undefined {
  return db
    .prepare(`SELECT ${SPALTEN} FROM season WHERE gruppe = ? AND start <= ? ORDER BY start DESC LIMIT 1`)
    .get(gruppeId, heute) as SeasonZeile | undefined;
}

export function seasonNachId(db: Db, id: number): SeasonZeile | undefined {
  return db.prepare(`SELECT ${SPALTEN} FROM season WHERE id = ?`).get(id) as SeasonZeile | undefined;
}

/** Legt eine Season an und nimmt alle Mitglieder der Gruppe auf. */
export function legeSeasonAn(
  db: Db,
  s: { gruppe: number; name: string; start: string; erstelltVon: number; heute: string },
): SeasonZeile {
  return db.transaction(() => {
    const { id } = db
      .prepare("INSERT INTO season (gruppe, name, start, erstellt_von) VALUES (?, ?, ?, ?) RETURNING id")
      .get(s.gruppe, s.name, s.start, s.erstelltVon) as { id: number };
    db.prepare(
      `INSERT INTO teilnahme (season, nutzer, beitritt)
       SELECT ?, nutzer, ? FROM gruppe_mitglied WHERE gruppe = ?`,
    ).run(id, s.heute, s.gruppe);
    return seasonNachId(db, id)!;
  })();
}

export type SeasonAenderung = Partial<Pick<SeasonZeile, "start" | "wochen" | "gewicht_fleiss" | "name">>;

export function aendereSeason(db: Db, id: number, a: SeasonAenderung): SeasonZeile {
  const s = seasonNachId(db, id)!;
  const neu = { ...s, ...a };
  db.prepare(
    "UPDATE season SET name = ?, start = ?, wochen = ?, gewicht_fleiss = ?, gewicht_fortschritt = ? WHERE id = ?",
  ).run(neu.name, neu.start, neu.wochen, neu.gewicht_fleiss, 100 - neu.gewicht_fleiss, id);
  return seasonNachId(db, id)!;
}

/** Nimmt einen Nutzer an der Season teil (idempotent). Gibt true zurück, wenn er neu dabei ist. */
export function nimmTeil(db: Db, seasonId: number, nutzerId: number, beitritt: string): boolean {
  return (
    db.prepare("INSERT OR IGNORE INTO teilnahme (season, nutzer, beitritt) VALUES (?, ?, ?)").run(seasonId, nutzerId, beitritt)
      .changes > 0
  );
}

/** Alle Teilnehmer mit Trainings und Messungen, wie sie die Wertung braucht. */
export function ladeTeilnehmer(db: Db, s: SeasonZeile): (Teilnehmer & { nutzerId: number; telegramId: number })[] {
  const ende = seasonEnde(s);
  const teilnehmer = db
    .prepare(
      `SELECT n.id, n.telegram_id, n.name, t.beitritt FROM teilnahme t
       JOIN nutzer n ON n.id = t.nutzer WHERE t.season = ? ORDER BY n.name`,
    )
    .all(s.id) as { id: number; telegram_id: number; name: string; beitritt: string }[];
  const trainings = db.prepare(
    `SELECT datum, minuten, faktor FROM training
     WHERE nutzer = ? AND geloescht_am IS NULL AND datum BETWEEN ? AND ?`,
  );
  const messungen = db.prepare(
    `SELECT datum, gewicht_kg AS gewichtKg, fett_pct AS fettPct, muskel_pct AS muskelPct FROM messung
     WHERE nutzer = ? AND geloescht_am IS NULL AND datum BETWEEN ? AND ? ORDER BY datum`,
  );
  return teilnehmer.map((t) => ({
    id: String(t.id),
    nutzerId: t.id,
    telegramId: t.telegram_id,
    name: t.name,
    beitritt: t.beitritt,
    trainings: trainings.all(t.id, s.start, ende) as { datum: string; minuten: number; faktor: Faktor }[],
    messungen: messungen.all(t.id, kalibrierFenster(s, t.beitritt).von, ende) as Messung[],
  }));
}

/** Nimmt ein (neues) Gruppenmitglied an der laufenden oder bevorstehenden Season teil. */
export function nimmAnAktuellerSeasonTeil(db: Db, gruppeId: number, nutzerId: number, heute: string): void {
  const s = aktuelleSeason(db, gruppeId, heute);
  if (s) nimmTeil(db, s.id, nutzerId, heute);
}
