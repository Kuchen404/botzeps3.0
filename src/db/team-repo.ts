import type { Db } from "./index.js";
import type { SeasonZeile } from "./season-repo.js";
import { teamnamen, verteile } from "../domain/teams.js";

export interface TeamZeile {
  id: number;
  name: string;
  /** Nutzer-IDs als String, wie in der Wertung. */
  mitglieder: string[];
}

export function teamsDerSeason(db: Db, seasonId: number): TeamZeile[] {
  const teams = db.prepare("SELECT id, name FROM team WHERE season = ? ORDER BY id").all(seasonId) as { id: number; name: string }[];
  const mitglieder = db.prepare("SELECT nutzer FROM teilnahme WHERE season = ? AND team = ? ORDER BY nutzer");
  return teams.map((t) => ({
    ...t,
    mitglieder: (mitglieder.all(seasonId, t.id) as { nutzer: number }[]).map((m) => String(m.nutzer)),
  }));
}

function setzeAktiv(db: Db, seasonId: number): void {
  db.prepare("UPDATE season SET teams_aktiv = EXISTS (SELECT 1 FROM team WHERE season = ?) WHERE id = ?").run(seasonId, seasonId);
}

/** Tritt einem Team bei; gibt es den Namen noch nicht, wird es angelegt. */
export function tritt(db: Db, seasonId: number, nutzerId: number, name: string): { team: TeamZeile; neu: boolean } {
  return db.transaction(() => {
    const vorhanden = db.prepare("SELECT id FROM team WHERE season = ? AND name = ? COLLATE NOCASE").get(seasonId, name) as
      | { id: number }
      | undefined;
    const id =
      vorhanden?.id ?? (db.prepare("INSERT INTO team (season, name) VALUES (?, ?) RETURNING id").get(seasonId, name) as { id: number }).id;
    db.prepare("UPDATE teilnahme SET team = ? WHERE season = ? AND nutzer = ?").run(id, seasonId, nutzerId);
    raeumeAuf(db, seasonId);
    setzeAktiv(db, seasonId);
    return { team: teamsDerSeason(db, seasonId).find((t) => t.id === id)!, neu: !vorhanden };
  })();
}

/** Leere Teams verschwinden. */
function raeumeAuf(db: Db, seasonId: number): void {
  db.prepare("DELETE FROM team WHERE season = ? AND id NOT IN (SELECT team FROM teilnahme WHERE season = ? AND team IS NOT NULL)").run(
    seasonId,
    seasonId,
  );
}

export function loeseTeamsAuf(db: Db, seasonId: number): void {
  db.transaction(() => {
    db.prepare("UPDATE teilnahme SET team = NULL WHERE season = ?").run(seasonId);
    db.prepare("DELETE FROM team WHERE season = ?").run(seasonId);
    setzeAktiv(db, seasonId);
  })();
}

/** Gesamtpunkte im letzten Wochenstand der vorigen Season der Gruppe, als Stärke fürs Auslosen. */
function staerken(db: Db, s: SeasonZeile): Map<number, number> {
  const vorige = db
    .prepare("SELECT id FROM season WHERE gruppe = ? AND start < ? ORDER BY start DESC LIMIT 1")
    .get(s.gruppe, s.start) as { id: number } | undefined;
  if (!vorige) return new Map();
  const zeilen = db
    .prepare(
      `SELECT nutzer, gesamt FROM wochenstand w WHERE season = ?
       AND woche = (SELECT MAX(woche) FROM wochenstand WHERE season = w.season)`,
    )
    .all(vorige.id) as { nutzer: number; gesamt: number }[];
  return new Map(zeilen.map((z) => [z.nutzer, z.gesamt]));
}

/** Lost alle Teilnehmer neu auf `anzahl` Teams aus (ausbalanciert nach der letzten Season). */
export function loseTeamsAus(db: Db, s: SeasonZeile, anzahl: number, zufall: () => number = Math.random): TeamZeile[] {
  return db.transaction(() => {
    const st = staerken(db, s);
    const teilnehmer = (db.prepare("SELECT nutzer FROM teilnahme WHERE season = ?").all(s.id) as { nutzer: number }[]).map((t) => ({
      nutzer: t.nutzer,
      staerke: st.get(t.nutzer) ?? null,
    }));
    db.prepare("UPDATE teilnahme SET team = NULL WHERE season = ?").run(s.id);
    db.prepare("DELETE FROM team WHERE season = ?").run(s.id);
    const namen = teamnamen(anzahl, zufall);
    const neu = db.prepare("INSERT INTO team (season, name) VALUES (?, ?) RETURNING id");
    const setze = db.prepare("UPDATE teilnahme SET team = ? WHERE season = ? AND nutzer = ?");
    verteile(teilnehmer, anzahl, zufall).forEach((mitglieder, i) => {
      const { id } = neu.get(s.id, namen[i]) as { id: number };
      for (const m of mitglieder) setze.run(id, s.id, m.nutzer);
    });
    setzeAktiv(db, s.id);
    return teamsDerSeason(db, s.id);
  })();
}

/** Nachzügler ohne Team kommen ins kleinste Team (bei Gleichstand ins älteste). */
export function teileKleinstemTeamZu(db: Db, seasonId: number, nutzerId: number): void {
  const kleinstes = db
    .prepare(
      `SELECT t.id FROM team t LEFT JOIN teilnahme tn ON tn.team = t.id
       WHERE t.season = ? GROUP BY t.id ORDER BY COUNT(tn.nutzer), t.id LIMIT 1`,
    )
    .get(seasonId) as { id: number } | undefined;
  if (kleinstes) {
    db.prepare("UPDATE teilnahme SET team = ? WHERE season = ? AND nutzer = ? AND team IS NULL").run(kleinstes.id, seasonId, nutzerId);
  }
}
