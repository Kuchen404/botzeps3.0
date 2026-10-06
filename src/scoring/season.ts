import { type IsoDatum, plusTage, tageZwischen, imZeitraum } from "./datum.js";
import { type Training, type Wochenwertung, FLEISS, gesamtLast, werteWochen } from "./fleiss.js";
import { type BossEinstellung, bossKampf } from "./boss.js";
import {
  type Fortschrittswertung,
  type Koerpermassen,
  type Messung,
  FORTSCHRITT,
  aktuellerWert,
  fortschritt,
  startwert,
} from "./fortschritt.js";

export interface SeasonEinstellungen {
  start: IsoDatum;
  wochen: number;
  /** Gewichtung in Prozent, zusammen 100. Standard 50/50. */
  gewichtFleiss: number;
  gewichtFortschritt: number;
  wochenzielLast: number;
  /** Angekündigte Bosse der Season. */
  bosse?: readonly BossEinstellung[];
}

export const STANDARD_SEASON: Omit<SeasonEinstellungen, "start"> = {
  wochen: 10,
  gewichtFleiss: 50,
  gewichtFortschritt: 50,
  wochenzielLast: FLEISS.wochenzielLast,
};

export interface Teilnehmer {
  id: string;
  name: string;
  /** Tag des Beitritts; vor oder am Season-Start heißt regulärer Start. */
  beitritt: IsoDatum;
  trainings: readonly Training[];
  messungen: readonly Messung[];
}

export interface TeilnehmerStand {
  id: string;
  name: string;
  wochen: Wochenwertung[];
  /** Summe der Fleißpunkte inkl. Serienbonus, ungewichtet. */
  fleiss: number;
  start: Koerpermassen | null;
  aktuell: Koerpermassen | null;
  fortschritt: Fortschrittswertung | null;
  /** Bonus für Siege gegen Bosse, ungewichtet in `gesamt` enthalten. */
  bossBonus: number;
  /** Gewichtete Gesamtpunkte. */
  gesamt: number;
  /** Gewichtete Fleißpunkte (Tiebreaker). */
  fleissGewichtet: number;
  platz: number;
}

/** Letzter Tag der Season (inklusive). */
export function seasonEnde(s: Pick<SeasonEinstellungen, "start" | "wochen">): IsoDatum {
  return plusTage(s.start, s.wochen * 7 - 1);
}

/** 0-basierte Woche eines Datums in der Season, oder null außerhalb. */
export function wocheVon(s: Pick<SeasonEinstellungen, "start" | "wochen">, datum: IsoDatum): number | null {
  const tage = tageZwischen(s.start, datum);
  if (tage < 0) return null;
  const woche = Math.floor(tage / 7);
  return woche < s.wochen ? woche : null;
}

/**
 * Kalibrierfenster eines Teilnehmers: die 7 Tage vor Season-Start,
 * bei spätem Einstieg die ersten 7 Tage ab Beitritt.
 */
export function kalibrierFenster(
  s: Pick<SeasonEinstellungen, "start">,
  beitritt: IsoDatum,
): { von: IsoDatum; bis: IsoDatum } {
  if (beitritt <= s.start) {
    return { von: plusTage(s.start, -FORTSCHRITT.fensterTage), bis: plusTage(s.start, -1) };
  }
  return { von: beitritt, bis: plusTage(beitritt, FORTSCHRITT.fensterTage - 1) };
}

/** Faktor, mit dem eine Säule in die Gesamtwertung eingeht (50 % → 1). */
function gewichtsFaktor(prozent: number): number {
  return prozent / 50;
}

/**
 * Berechnet den Stand eines Teilnehmers am `stichtag` (inklusive).
 * Liegt der Stichtag nach Season-Ende, gilt das Season-Ende.
 * Wochen vor dem Beitritt zählen beim Fleiß mit 0.
 */
export function teilnehmerStand(
  s: SeasonEinstellungen,
  t: Teilnehmer,
  stichtag: IsoDatum,
): Omit<TeilnehmerStand, "platz"> {
  const ende = seasonEnde(s);
  const bis = stichtag < ende ? stichtag : ende;
  const laufendeWochen = bis < s.start ? 0 : (wocheVon(s, bis) ?? s.wochen - 1) + 1;

  const lasten: number[] = Array.from({ length: laufendeWochen }, () => 0);
  const proWoche: Training[][] = lasten.map(() => []);
  for (const tr of t.trainings) {
    if (!imZeitraum(tr.datum, s.start, bis) || tr.datum < t.beitritt) continue;
    const woche = wocheVon(s, tr.datum);
    if (woche !== null) proWoche[woche]?.push(tr);
  }
  proWoche.forEach((liste, i) => (lasten[i] = gesamtLast(liste)));
  const wochen = werteWochen(lasten, s.wochenzielLast);
  const fleiss = wochen.reduce((summe, w) => summe + w.punkte, 0);

  const fenster = kalibrierFenster(s, t.beitritt);
  const start = startwert(t.messungen, fenster.von, fenster.bis);
  // Aktuelle Werte erst nach der Kalibrierung, sonst wäre der Fortschritt trivial 0.
  const aktuell = start && bis > fenster.bis ? aktuellerWert(t.messungen, bis, plusTage(fenster.bis, 1)) : null;
  const fw = start && aktuell ? fortschritt(start, aktuell) : null;

  const fleissGewichtet = fleiss * gewichtsFaktor(s.gewichtFleiss);
  const gesamt = fleissGewichtet + (fw?.punkte ?? 0) * gewichtsFaktor(s.gewichtFortschritt);

  return { id: t.id, name: t.name, wochen, fleiss, start, aktuell, fortschritt: fw, bossBonus: 0, gesamt, fleissGewichtet };
}

/**
 * Rangliste: höchste Gesamtpunkte zuerst, bei Gleichstand gewinnt mehr Fleiß.
 * Wer in beidem gleich ist, teilt sich den Platz.
 */
export function rangliste<T extends { gesamt: number; fleissGewichtet: number }>(
  staende: readonly T[],
): (T & { platz: number })[] {
  const sortiert = [...staende].sort((a, b) => b.gesamt - a.gesamt || b.fleissGewichtet - a.fleissGewichtet);
  const ergebnis: (T & { platz: number })[] = [];
  sortiert.forEach((stand, i) => {
    const vorher = ergebnis[i - 1];
    const gleich = vorher && vorher.gesamt === stand.gesamt && vorher.fleissGewichtet === stand.fleissGewichtet;
    ergebnis.push({ ...stand, platz: gleich ? vorher.platz : i + 1 });
  });
  return ergebnis;
}

/** Stand aller Teilnehmer; für jeden besiegten Boss bekommen alle Beteiligten den Bonus. */
export function seasonStand(s: SeasonEinstellungen, teilnehmer: readonly Teilnehmer[], stichtag: IsoDatum): TeilnehmerStand[] {
  let staende = teilnehmer.map((t) => teilnehmerStand(s, t, stichtag));
  for (const boss of s.bosse ?? []) {
    const kampf = bossKampf(boss, staende);
    if (!kampf.besiegt) continue;
    const beteiligt = new Set(kampf.beteiligte);
    staende = staende.map((st) =>
      beteiligt.has(st.id) ? { ...st, bossBonus: st.bossBonus + kampf.bonus, gesamt: st.gesamt + kampf.bonus } : st,
    );
  }
  return rangliste(staende);
}

/** „Fleiß der Woche“: alle mit der höchsten Last in dieser Woche (mindestens > 0). */
export function fleissDerWoche(staende: readonly TeilnehmerStand[], woche: number): TeilnehmerStand[] {
  const last = (st: TeilnehmerStand) => st.wochen[woche]?.last ?? 0;
  const max = Math.max(0, ...staende.map(last));
  if (max === 0) return [];
  return staende.filter((st) => last(st) === max);
}

export interface TeamStand {
  id: string;
  name: string;
  /** Durchschnitt der Mitglieder mit Startwert. */
  durchschnitt: number;
  /** +3 für jede Woche, in der alle Mitglieder ihr Ziel erreicht haben. */
  bonus: number;
  /** 0-basierte Wochen, in denen es den Bonus gab. */
  bonusWochen: number[];
  gesamt: number;
  platz: number;
}

export const TEAM_BONUS_PRO_WOCHE = 3;

export function teamStand(
  teams: readonly { id: string; name: string; mitglieder: readonly string[] }[],
  staende: readonly TeilnehmerStand[],
): TeamStand[] {
  const nachId = new Map(staende.map((st) => [st.id, st]));
  const ergebnis = teams.map((team) => {
    const mitglieder = team.mitglieder.map((id) => nachId.get(id)).filter((st) => st !== undefined);
    const mitStart = mitglieder.filter((st) => st.start !== null);
    const durchschnitt = mitStart.length ? mitStart.reduce((s, st) => s + st.gesamt, 0) / mitStart.length : 0;
    const anzahlWochen = Math.max(0, ...mitglieder.map((st) => st.wochen.length));
    const bonusWochen: number[] = [];
    for (let w = 0; w < anzahlWochen; w++) {
      if (mitglieder.length > 0 && mitglieder.every((st) => st.wochen[w]?.zielErreicht)) bonusWochen.push(w);
    }
    const bonus = bonusWochen.length * TEAM_BONUS_PRO_WOCHE;
    return { id: team.id, name: team.name, durchschnitt, bonus, bonusWochen, gesamt: durchschnitt + bonus };
  });
  const sortiert = [...ergebnis].sort((a, b) => b.gesamt - a.gesamt);
  const mitPlatz: TeamStand[] = [];
  sortiert.forEach((team, i) => {
    const vorher = mitPlatz[i - 1];
    mitPlatz.push({ ...team, platz: vorher && vorher.gesamt === team.gesamt ? vorher.platz : i + 1 });
  });
  return mitPlatz;
}
