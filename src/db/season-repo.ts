import type { Db } from "./index.js";
import { teileKleinstemTeamZu } from "./team-repo.js";
import type { Faktor } from "../scoring/fleiss.js";
import type { Messung } from "../scoring/fortschritt.js";
import { type SeasonEinstellungen, type Teilnehmer, kalibrierFenster, seasonEnde } from "../scoring/season.js";
import { type BossEinstellung, type BossStufe, bossWoche } from "../scoring/boss.js";

export interface SeasonZeile {
  id: number;
  gruppe: number;
  name: string;
  start: string;
  wochen: number;
  /** "HH:MM", Ortszeit der Gruppe */
  berichtszeit: string;
  gewicht_fleiss: number;
  gewicht_fortschritt: number;
  wochenziel_last: number;
  erstellt_von: number | null;
}

const SPALTEN =
  "id, gruppe, name, start, wochen, berichtszeit, gewicht_fleiss, gewicht_fortschritt, wochenziel_last, erstellt_von";

export type Boss = BossEinstellung & { name: string; schwaecheName?: string | null };

/** Bereits angekündigte Bosse der Season. */
export function bosseDerSeason(db: Db, s: Pick<SeasonZeile, "id" | "wochen">): Boss[] {
  const zeilen = db
    .prepare(
      `SELECT b.stufe, b.name, b.lebenspunkte, b.schwaeche, sp.name AS schwaecheName FROM boss b
       LEFT JOIN sportart sp ON sp.id = b.schwaeche WHERE b.season = ? ORDER BY b.stufe`,
    )
    .all(s.id) as {
    stufe: BossStufe;
    name: string;
    lebenspunkte: number;
    schwaeche: number | null;
    schwaecheName: string | null;
  }[];
  return zeilen.flatMap((z) => {
    const woche = bossWoche(z.stufe, s.wochen);
    return woche === null ? [] : [{ ...z, woche }];
  });
}

/** Kündigt einen Boss an (nur beim ersten Mal). Gibt false zurück, wenn er schon da war. */
export function kuendigeBossAn(
  db: Db,
  seasonId: number,
  stufe: BossStufe,
  name: string,
  lebenspunkte: number,
  schwaeche: number | null = null,
): boolean {
  return (
    db
      .prepare("INSERT OR IGNORE INTO boss (season, stufe, name, lebenspunkte, schwaeche) VALUES (?, ?, ?, ?, ?)")
      .run(seasonId, stufe, name, lebenspunkte, schwaeche).changes > 0
  );
}

/** Merkt sich die angepinnte Ankündigung eines Bosses (null: wieder gelöst). */
export function setzeBossPin(db: Db, seasonId: number, stufe: BossStufe, nachricht: number | null): void {
  db.prepare("UPDATE boss SET pin_nachricht = ? WHERE season = ? AND stufe = ?").run(nachricht, seasonId, stufe);
}

export function bossPin(db: Db, seasonId: number, stufe: BossStufe): number | null {
  const z = db.prepare("SELECT pin_nachricht AS n FROM boss WHERE season = ? AND stufe = ?").get(seasonId, stufe) as { n: number | null } | undefined;
  return z?.n ?? null;
}

export function einstellungen(s: SeasonZeile, bosse: readonly BossEinstellung[] = []): SeasonEinstellungen {
  return {
    start: s.start,
    wochen: s.wochen,
    gewichtFleiss: s.gewicht_fleiss,
    gewichtFortschritt: s.gewicht_fortschritt,
    wochenzielLast: s.wochenziel_last,
    bosse,
  };
}

/** Die Season der Gruppe, die noch nicht vorbei ist (läuft oder steht bevor). */
export function aktuelleSeason(db: Db, gruppeId: number, heute: string): SeasonZeile | undefined {
  const alle = db
    .prepare(`SELECT ${SPALTEN} FROM season WHERE gruppe = ? ORDER BY start DESC`)
    .all(gruppeId) as SeasonZeile[];
  return alle.find((s) => seasonEnde(s) >= heute);
}

/** Ob das Finale der Season schon verschickt wurde (danach ist sie durch, auch wenn der letzte Tag noch läuft). */
export function finaleGelaufen(db: Db, seasonId: number): boolean {
  return db.prepare("SELECT 1 FROM termin WHERE season = ? AND art = 'finale' AND erledigt_am IS NOT NULL").get(seasonId) !== undefined;
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
  const neu =
    db.prepare("INSERT OR IGNORE INTO teilnahme (season, nutzer, beitritt) VALUES (?, ?, ?)").run(seasonId, nutzerId, beitritt)
      .changes > 0;
  if (neu) teileKleinstemTeamZu(db, seasonId, nutzerId);
  return neu;
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
    `SELECT datum, minuten, faktor, sportart AS sportartId FROM training
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
    trainings: trainings.all(t.id, s.start, ende) as { datum: string; minuten: number; faktor: Faktor; sportartId: number }[],
    messungen: messungen.all(t.id, kalibrierFenster(s, t.beitritt).von, ende) as Messung[],
  }));
}

/** Nimmt ein (neues) Gruppenmitglied an der laufenden oder bevorstehenden Season teil. */
export function nimmAnAktuellerSeasonTeil(db: Db, gruppeId: number, nutzerId: number, heute: string): void {
  const s = aktuelleSeason(db, gruppeId, heute);
  if (s) nimmTeil(db, s.id, nutzerId, heute);
}
