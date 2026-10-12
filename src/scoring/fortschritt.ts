import { type IsoDatum, imZeitraum, plusTage } from "./datum.js";

/** Grenzen der Fortschritts-Säule (Konzept 3.3). */
export const FORTSCHRITT = {
  punkteProProzentFett: 10,
  punkteProProzentMuskel: 30,
  untergrenze: -50,
  minMessungenKalibrierung: 3,
  minMessungenAktuell: 2,
  fensterTage: 7,
} as const;

export interface Messung {
  datum: IsoDatum;
  gewichtKg: number;
  fettPct: number;
  muskelPct: number;
}

export interface Koerpermassen {
  fettKg: number;
  muskelKg: number;
  anzahlMessungen: number;
}

export function massen(m: Messung): { fettKg: number; muskelKg: number } {
  return {
    fettKg: (m.gewichtKg * m.fettPct) / 100,
    muskelKg: (m.gewichtKg * m.muskelPct) / 100,
  };
}

/** Mittelwert der Fett- und Muskelmasse über mehrere Messungen. */
export function mittelwert(messungen: readonly Messung[]): Koerpermassen | null {
  if (messungen.length === 0) return null;
  let fett = 0;
  let muskel = 0;
  for (const m of messungen) {
    const { fettKg, muskelKg } = massen(m);
    fett += fettKg;
    muskel += muskelKg;
  }
  return {
    fettKg: fett / messungen.length,
    muskelKg: muskel / messungen.length,
    anzahlMessungen: messungen.length,
  };
}

/**
 * Startwert: Mittelwert aller Messungen im Kalibrierfenster [von, bis].
 * Mit weniger als 3 Messungen gibt es noch keinen Startwert.
 */
export function startwert(messungen: readonly Messung[], von: IsoDatum, bis: IsoDatum): Koerpermassen | null {
  const imFenster = messungen.filter((m) => imZeitraum(m.datum, von, bis));
  if (imFenster.length < FORTSCHRITT.minMessungenKalibrierung) return null;
  return mittelwert(imFenster);
}

/**
 * Aktueller Wert: Mittelwert der Messungen der 7 Tage bis einschließlich `stichtag`,
 * aber nicht vor `fruehestens` (dem Tag nach der Kalibrierung).
 * Liegen dort weniger als 2 Messungen, zählen die letzten 2 Messungen ab `frühestens`,
 * damit Nicht-Messen eine schlechte Phase nicht versteckt.
 */
export function aktuellerWert(
  messungen: readonly Messung[],
  stichtag: IsoDatum,
  fruehestens: IsoDatum,
): Koerpermassen | null {
  // Nie in die Kalibrierung zurückgreifen, sonst verwässert sie den aktuellen Wert
  const siebenTage = plusTage(stichtag, -(FORTSCHRITT.fensterTage - 1));
  const fensterStart = siebenTage > fruehestens ? siebenTage : fruehestens;
  const imFenster = messungen.filter((m) => imZeitraum(m.datum, fensterStart, stichtag));
  if (imFenster.length >= FORTSCHRITT.minMessungenAktuell) return mittelwert(imFenster);

  const bisher = messungen
    .filter((m) => imZeitraum(m.datum, fruehestens, stichtag))
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  if (bisher.length < FORTSCHRITT.minMessungenAktuell) return null;
  return mittelwert(bisher.slice(-FORTSCHRITT.minMessungenAktuell));
}

export interface Fortschrittswertung {
  /** Relativer Fettabbau in Prozent (positiv = weniger Fett). */
  fettAbbauPct: number;
  /** Relativer Muskelaufbau in Prozent (positiv = mehr Muskel). */
  muskelAufbauPct: number;
  punkte: number;
  /** Ohne Waage: Punkte sind der Median der Gruppe, die Prozente bleiben 0. */
  ausGruppe?: boolean;
}

/**
 * Fortschritt für jemanden ohne Körperfettwaage: der Median der Fortschrittspunkte aller,
 * die selbst messen. So bringt es weder Vor- noch Nachteil, ohne Waage mitzumachen.
 * Null, solange noch niemand Fortschrittspunkte hat.
 */
export function fortschrittAusGruppe(punkte: readonly number[]): Fortschrittswertung | null {
  if (punkte.length === 0) return null;
  const sortiert = [...punkte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  const median = sortiert.length % 2 ? sortiert[mitte]! : (sortiert[mitte - 1]! + sortiert[mitte]!) / 2;
  return { fettAbbauPct: 0, muskelAufbauPct: 0, punkte: median, ausGruppe: true };
}

/** Fortschrittspunkte = 10 × Fettabbau % + 30 × Muskelaufbau %, mindestens −50. */
export function fortschritt(start: Koerpermassen, aktuell: Koerpermassen): Fortschrittswertung {
  const fettAbbauPct = start.fettKg > 0 ? ((start.fettKg - aktuell.fettKg) / start.fettKg) * 100 : 0;
  const muskelAufbauPct = start.muskelKg > 0 ? ((aktuell.muskelKg - start.muskelKg) / start.muskelKg) * 100 : 0;
  const roh =
    FORTSCHRITT.punkteProProzentFett * fettAbbauPct + FORTSCHRITT.punkteProProzentMuskel * muskelAufbauPct;
  return { fettAbbauPct, muskelAufbauPct, punkte: Math.max(FORTSCHRITT.untergrenze, roh) };
}
