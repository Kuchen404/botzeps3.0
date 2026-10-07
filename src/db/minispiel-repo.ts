import type { Db } from "./index.js";
import type { SeasonZeile } from "./season-repo.js";
import { type IsoDatum, plusTage } from "../scoring/datum.js";
import { type MinispielArt, type MinispielDaten, type SpielWoche, type Spieler, waehleArt } from "../minispiel/spiele.js";

export interface MinispielZeile {
  art: MinispielArt;
  /** null, solange das Spiel nur im Teaser vorkam und noch nicht angekündigt ist */
  daten: MinispielDaten | null;
  pin: number | null;
}

export function minispielZeile(db: Db, seasonId: number, woche: number): MinispielZeile | null {
  const z = db.prepare("SELECT art, daten, pin_nachricht AS pin FROM minispiel WHERE season = ? AND woche = ?").get(seasonId, woche) as
    | { art: MinispielArt; daten: string | null; pin: number | null }
    | undefined;
  return z ? { art: z.art, daten: z.daten ? (JSON.parse(z.daten) as MinispielDaten) : null, pin: z.pin } : null;
}

/** Legt das Spiel der Woche fest, falls noch nicht geschehen (beim Teaser oder spätestens bei der Ankündigung). */
export function legeMinispielFest(db: Db, s: Pick<SeasonZeile, "id">, woche: number, zufall: () => number = Math.random): MinispielArt {
  const da = minispielZeile(db, s.id, woche);
  if (da) return da.art;
  const bisher = (db.prepare("SELECT art FROM minispiel WHERE season = ? AND woche < ? ORDER BY woche").all(s.id, woche) as { art: MinispielArt }[]).map(
    (z) => z.art,
  );
  const spieler = (db.prepare("SELECT COUNT(*) AS n FROM teilnahme WHERE season = ?").get(s.id) as { n: number }).n;
  const art = waehleArt(bisher, spieler, zufall);
  db.prepare("INSERT OR IGNORE INTO minispiel (season, woche, art) VALUES (?, ?, ?)").run(s.id, woche, art);
  return minispielZeile(db, s.id, woche)!.art;
}

export function setzeMinispielDaten(db: Db, seasonId: number, woche: number, daten: MinispielDaten): void {
  db.prepare("UPDATE minispiel SET daten = ? WHERE season = ? AND woche = ?").run(JSON.stringify(daten), seasonId, woche);
}

export function setzeMinispielPin(db: Db, seasonId: number, woche: number, nachricht: number | null): void {
  db.prepare("UPDATE minispiel SET pin_nachricht = ? WHERE season = ? AND woche = ?").run(nachricht, seasonId, woche);
}

export function spielWoche(s: Pick<SeasonZeile, "start" | "wochenziel_last">, woche: number): SpielWoche {
  return { start: plusTage(s.start, woche * 7), ziel: s.wochenziel_last };
}

/** Alle Teilnehmer mit ihren Trainings der Season bis einschließlich `bis`. */
export function spielerDerSeason(db: Db, s: Pick<SeasonZeile, "id" | "start">, bis: IsoDatum): Spieler[] {
  const teilnehmer = db
    .prepare("SELECT n.id, n.name, t.beitritt FROM teilnahme t JOIN nutzer n ON n.id = t.nutzer WHERE t.season = ? ORDER BY n.name")
    .all(s.id) as { id: number; name: string; beitritt: string }[];
  const trainings = db.prepare(
    `SELECT id, datum, minuten, faktor, erstellt_am AS erstellt FROM training
     WHERE nutzer = ? AND geloescht_am IS NULL AND datum BETWEEN ? AND ? ORDER BY datum, erstellt_am`,
  );
  return teilnehmer.map((t) => ({
    id: String(t.id),
    name: t.name,
    trainings: trainings.all(t.id, t.beitritt > s.start ? t.beitritt : s.start, bis) as Spieler["trainings"][number][],
  }));
}
