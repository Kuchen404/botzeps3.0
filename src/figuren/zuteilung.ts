import type { Db } from "../db/index.js";
import { bosseDerSeason, type SeasonZeile } from "../db/season-repo.js";
import { plusTage } from "../scoring/datum.js";
import { FIGUREN } from "./figuren.js";

export const ANZAHL_FIGUREN = FIGUREN.length;

/**
 * Figuren werden nicht verteilt, sondern ausgesucht: Ab dem ersten Spiel, das Figuren
 * braucht (die erste Boss-Woche), darf sich jeder nach seinem ersten Training dort eine
 * der noch freien Figuren nehmen. Wer zuerst trainiert, hat die volle Auswahl.
 */

/** Ab wann in einer Gruppe gewählt werden darf: Beginn der frühesten Boss-Woche. */
function freigabeDerGruppe(db: Db, gruppeId: number): string | null {
  const seasons = db.prepare("SELECT id, start, wochen FROM season WHERE gruppe = ?").all(gruppeId) as Pick<
    SeasonZeile,
    "id" | "start" | "wochen"
  >[];
  let frueheste: string | null = null;
  for (const s of seasons) {
    for (const b of bosseDerSeason(db, s)) {
      const ab = plusTage(s.start, b.woche * 7);
      if (frueheste === null || ab < frueheste) frueheste = ab;
    }
  }
  return frueheste;
}

function gruppenIds(db: Db, nutzerId: number): number[] {
  return (db.prepare("SELECT gruppe FROM gruppe_mitglied WHERE nutzer = ?").all(nutzerId) as { gruppe: number }[]).map((z) => z.gruppe);
}

/** Frühester Tag, ab dem ein Training zur Figurwahl berechtigt, oder null, solange es kein Figurenspiel gab. */
export function figurFreigabe(db: Db, nutzerId: number): string | null {
  let frueheste: string | null = null;
  for (const g of gruppenIds(db, nutzerId)) {
    const ab = freigabeDerGruppe(db, g);
    if (ab !== null && (frueheste === null || ab < frueheste)) frueheste = ab;
  }
  return frueheste;
}

export function figurVon(db: Db, nutzerId: number): number | null {
  const z = db.prepare("SELECT figur FROM nutzer WHERE id = ?").get(nutzerId) as { figur: number | null } | undefined;
  return z?.figur ?? null;
}

/**
 * Noch keine Figur und mindestens ein Training ab der Freigabe.
 * `ohneTraining` blendet ein Training aus, um zu erkennen, ob genau dieses die Wahl freigeschaltet hat.
 */
export function darfFigurWaehlen(db: Db, nutzerId: number, ohneTraining?: number): boolean {
  if (figurVon(db, nutzerId) !== null) return false;
  const ab = figurFreigabe(db, nutzerId);
  if (ab === null) return false;
  return (
    db
      .prepare("SELECT 1 FROM training WHERE nutzer = ? AND geloescht_am IS NULL AND datum >= ? AND id != ? LIMIT 1")
      .get(nutzerId, ab, ohneTraining ?? -1) !== undefined
  );
}

/** Gewählte Figuren der Mitglieder einer Gruppe (Nutzer-id → Figur). Wer noch keine hat, fehlt. */
export function figurenDerGruppe(db: Db, gruppeId: number): Map<number, number> {
  const zeilen = db
    .prepare("SELECT n.id, n.figur FROM gruppe_mitglied m JOIN nutzer n ON n.id = m.nutzer WHERE m.gruppe = ? AND n.figur IS NOT NULL")
    .all(gruppeId) as { id: number; figur: number }[];
  return new Map(zeilen.map((z) => [z.id, z.figur]));
}

/** Figuren, die andere Mitglieder in einer der Gruppen des Nutzers schon genommen haben, mit Namen. */
export function vergebeneFiguren(db: Db, nutzerId: number): Map<number, string> {
  const vergeben = new Map<number, string>();
  for (const g of gruppenIds(db, nutzerId)) {
    const zeilen = db
      .prepare(
        `SELECT n.name, n.figur FROM gruppe_mitglied m JOIN nutzer n ON n.id = m.nutzer
         WHERE m.gruppe = ? AND n.id != ? AND n.figur IS NOT NULL ORDER BY n.id`,
      )
      .all(g, nutzerId) as { name: string; figur: number }[];
    for (const z of zeilen) if (!vergeben.has(z.figur)) vergeben.set(z.figur, z.name);
  }
  return vergeben;
}

export type Wahlergebnis = "ok" | "schon_gewaehlt" | "noch_nicht" | "vergeben";

/** Figur nehmen. Wer zuerst kommt, mahlt zuerst; gewählt ist gewählt. */
export function waehleFigur(db: Db, nutzerId: number, nr: number): Wahlergebnis {
  return db.transaction((): Wahlergebnis => {
    if (figurVon(db, nutzerId) !== null) return "schon_gewaehlt";
    if (!darfFigurWaehlen(db, nutzerId)) return "noch_nicht";
    if (vergebeneFiguren(db, nutzerId).has(nr)) return "vergeben";
    db.prepare("UPDATE nutzer SET figur = ? WHERE id = ?").run(nr, nutzerId);
    return "ok";
  })();
}
