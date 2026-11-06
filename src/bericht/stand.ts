import type { Db } from "../db/index.js";
import { type SeasonZeile, bosseDerSeason, einstellungen, ladeTeilnehmer } from "../db/season-repo.js";
import { teamsDerSeason } from "../db/team-repo.js";
import { messtage } from "../scoring/fortschritt.js";
import { type TeamStand, type TeilnehmerStand, kalibrierFenster, seasonEnde, seasonStand, teamStand } from "../scoring/season.js";

export type Stand = TeilnehmerStand & { telegramId: number; beitritt: string; kalibrierMessungen: number };

export function berechneStand(db: Db, s: SeasonZeile, tag: string): Stand[] {
  const teilnehmer = ladeTeilnehmer(db, s);
  const staende = seasonStand(einstellungen(s, bosseDerSeason(db, s)), teilnehmer, tag).map((st) => {
    const t = teilnehmer.find((x) => x.id === st.id)!;
    const fenster = kalibrierFenster(s, t.beitritt);
    const kalibrierMessungen = messtage(t.messungen.filter((m) => m.datum >= fenster.von && m.datum <= fenster.bis));
    return { ...st, telegramId: t.telegramId, beitritt: t.beitritt, kalibrierMessungen };
  });
  return tag >= seasonEnde(s) ? mitEndstand(db, s, staende) : staende;
}

/**
 * Nach dem Finale gilt sein Endstand: Punkte und Plätze kommen aus dem gespeicherten
 * Stand des Finales, auch wenn danach noch etwas für die letzten Tage nachgetragen wird.
 * So zeigen Rangliste, Mini App und Ruhmeshalle denselben Sieger wie das Finale.
 */
function mitEndstand(db: Db, s: SeasonZeile, staende: Stand[]): Stand[] {
  const zeilen = db
    .prepare("SELECT nutzer, fleisspunkte, fortschrittspunkte, gesamt, platz FROM wochenstand WHERE season = ? AND woche = ?")
    .all(s.id, s.wochen - 1) as { nutzer: number; fleisspunkte: number; fortschrittspunkte: number | null; gesamt: number; platz: number }[];
  if (zeilen.length === 0) return staende;
  const fest = new Map(zeilen.map((z) => [String(z.nutzer), z]));
  const hinten = Math.max(...zeilen.map((z) => z.platz)) + 1;
  return staende
    .map((st) => {
      const z = fest.get(st.id);
      // Wer erst nach dem Finale dazukam, steht hinten
      if (!z) return { ...st, platz: hinten };
      const fortschritt =
        z.fortschrittspunkte === null
          ? null
          : st.fortschritt?.punkte === z.fortschrittspunkte
            ? st.fortschritt
            : { fettAbbauPct: 0, muskelAufbauPct: 0, ...st.fortschritt, punkte: z.fortschrittspunkte };
      return { ...st, fleiss: z.fleisspunkte, fortschritt, gesamt: z.gesamt, platz: z.platz };
    })
    .sort((a, b) => a.platz - b.platz);
}

/** Teamwertung der Season, leer ohne Teams. */
export function berechneTeams(db: Db, s: SeasonZeile, staende: readonly TeilnehmerStand[]): TeamStand[] {
  const teams = teamsDerSeason(db, s.id);
  return teams.length ? teamStand(teams.map((t) => ({ id: String(t.id), name: t.name, mitglieder: t.mitglieder })), staende) : [];
}
