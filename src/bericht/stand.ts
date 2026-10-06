import type { Db } from "../db/index.js";
import { type SeasonZeile, bosseDerSeason, einstellungen, ladeTeilnehmer } from "../db/season-repo.js";
import { teamsDerSeason } from "../db/team-repo.js";
import { type TeamStand, type TeilnehmerStand, kalibrierFenster, seasonStand, teamStand } from "../scoring/season.js";

export type Stand = TeilnehmerStand & { telegramId: number; beitritt: string; kalibrierMessungen: number };

export function berechneStand(db: Db, s: SeasonZeile, tag: string): Stand[] {
  const teilnehmer = ladeTeilnehmer(db, s);
  const staende = seasonStand(einstellungen(s, bosseDerSeason(db, s)), teilnehmer, tag);
  return staende.map((st) => {
    const t = teilnehmer.find((x) => x.id === st.id)!;
    const fenster = kalibrierFenster(s, t.beitritt);
    const kalibrierMessungen = t.messungen.filter((m) => m.datum >= fenster.von && m.datum <= fenster.bis).length;
    return { ...st, telegramId: t.telegramId, beitritt: t.beitritt, kalibrierMessungen };
  });
}

/** Teamwertung der Season, leer ohne Teams. */
export function berechneTeams(db: Db, s: SeasonZeile, staende: readonly TeilnehmerStand[]): TeamStand[] {
  const teams = teamsDerSeason(db, s.id);
  return teams.length ? teamStand(teams.map((t) => ({ id: String(t.id), name: t.name, mitglieder: t.mitglieder })), staende) : [];
}
