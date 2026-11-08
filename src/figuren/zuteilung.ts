import type { Db } from "../db/index.js";
import { aktuelleSeason, bosseDerSeason, type SeasonZeile } from "../db/season-repo.js";
import { plusTage } from "../scoring/datum.js";
import { seasonEnde } from "../scoring/season.js";
import { FIGUREN } from "./figuren.js";

export const ANZAHL_FIGUREN = FIGUREN.length;

/**
 * Figuren werden nicht verteilt, sondern pro Season ausgesucht: Ab dem ersten Spiel, das
 * Figuren braucht (die erste Boss-Woche), darf sich jeder nach seinem ersten Training dort
 * eine der noch freien Figuren nehmen, einmal für die ganze Season. Wer zuerst trainiert,
 * hat die volle Auswahl, wer zuletzt kommt, nimmt den Rest.
 */

type Season = Pick<SeasonZeile, "id" | "start" | "wochen">;

/** Beginn der ersten Boss-Woche der Season, oder null, solange kein Boss angekündigt ist. */
export function figurFreigabe(db: Db, s: Season): string | null {
  const wochen = bosseDerSeason(db, s).map((b) => b.woche);
  return wochen.length ? plusTage(s.start, Math.min(...wochen) * 7) : null;
}

export function figurIn(db: Db, seasonId: number, nutzerId: number): number | null {
  const z = db.prepare("SELECT figur FROM teilnahme WHERE season = ? AND nutzer = ?").get(seasonId, nutzerId) as
    | { figur: number | null }
    | undefined;
  return z?.figur ?? null;
}

/**
 * Dabei, noch keine Figur und mindestens ein Training zwischen Freigabe und Season-Ende.
 * `ohneTraining` blendet ein Training aus, um zu erkennen, ob genau dieses die Wahl freigeschaltet hat.
 */
export function darfFigurWaehlen(db: Db, s: Season, nutzerId: number, ohneTraining?: number): boolean {
  const t = db.prepare("SELECT figur FROM teilnahme WHERE season = ? AND nutzer = ?").get(s.id, nutzerId) as
    | { figur: number | null }
    | undefined;
  if (!t || t.figur !== null) return false;
  const ab = figurFreigabe(db, s);
  if (ab === null) return false;
  return (
    db
      .prepare("SELECT 1 FROM training WHERE nutzer = ? AND geloescht_am IS NULL AND datum >= ? AND datum <= ? AND id != ? LIMIT 1")
      .get(nutzerId, ab, seasonEnde(s), ohneTraining ?? -1) !== undefined
  );
}

/** Gewählte Figuren der Season (Nutzer-id → Figur). Wer noch keine hat, fehlt. */
export function figurenDerSeason(db: Db, seasonId: number): Map<number, number> {
  const zeilen = db.prepare("SELECT nutzer, figur FROM teilnahme WHERE season = ? AND figur IS NOT NULL").all(seasonId) as {
    nutzer: number;
    figur: number;
  }[];
  return new Map(zeilen.map((z) => [z.nutzer, z.figur]));
}

/** Schon genommene Figuren der Season mit dem Namen der Person. */
export function vergebeneFiguren(db: Db, seasonId: number): Map<number, string> {
  const zeilen = db
    .prepare("SELECT t.figur, n.name FROM teilnahme t JOIN nutzer n ON n.id = t.nutzer WHERE t.season = ? AND t.figur IS NOT NULL")
    .all(seasonId) as { figur: number; name: string }[];
  return new Map(zeilen.map((z) => [z.figur, z.name]));
}

export type Wahlergebnis = "ok" | "schon_gewaehlt" | "noch_nicht" | "vergeben";

/** Figur nehmen. Wer zuerst kommt, mahlt zuerst; gewählt ist gewählt (bis zur nächsten Season). */
export function waehleFigur(db: Db, s: Season, nutzerId: number, nr: number): Wahlergebnis {
  return db.transaction((): Wahlergebnis => {
    if (figurIn(db, s.id, nutzerId) !== null) return "schon_gewaehlt";
    if (!darfFigurWaehlen(db, s, nutzerId)) return "noch_nicht";
    if (vergebeneFiguren(db, s.id).has(nr)) return "vergeben";
    db.prepare("UPDATE teilnahme SET figur = ? WHERE season = ? AND nutzer = ?").run(nr, s.id, nutzerId);
    return "ok";
  })();
}

/** Laufende Seasons, in denen genau dieses Training die Figurwahl freigeschaltet hat. */
export function figurFreigeschaltet(db: Db, nutzerId: number, trainingId: number, heute: string): boolean {
  const gruppen = db.prepare("SELECT gruppe FROM gruppe_mitglied WHERE nutzer = ?").all(nutzerId) as { gruppe: number }[];
  return gruppen.some(({ gruppe }) => {
    const s = aktuelleSeason(db, gruppe, heute);
    return !!s && darfFigurWaehlen(db, s, nutzerId) && !darfFigurWaehlen(db, s, nutzerId, trainingId);
  });
}
