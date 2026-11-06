import { type IsoDatum, imZeitraum, plusTage } from "./datum.js";

/** Grenzen der Fortschritts-Säule (Konzept 3.3). */
export const FORTSCHRITT = {
  punkteProProzentFett: 10,
  punkteProProzentMuskel: 30,
  untergrenze: -50,
  minMessungenKalibrierung: 3,
  minMessungenAktuell: 2,
  fensterTage: 7,
  /**
   * Kalibrierwochen, die vor diesem Tag endeten, zählen wie früher Messungen statt Messtage,
   * damit niemand in einer laufenden Season nachträglich seinen Startwert verliert.
   */
  messtageAb: "2026-11-07",
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
  /** Anzahl der Messtage (mehrere Messungen an einem Tag zählen als einer) */
  anzahlMessungen: number;
}

export function massen(m: Messung): { fettKg: number; muskelKg: number } {
  return {
    fettKg: (m.gewichtKg * m.fettPct) / 100,
    muskelKg: (m.gewichtKg * m.muskelPct) / 100,
  };
}

/** Anzahl verschiedener Messtage. */
export function messtage(messungen: readonly Pick<Messung, "datum">[]): number {
  return new Set(messungen.map((m) => m.datum)).size;
}

/**
 * Mittelwert der Fett- und Muskelmasse über mehrere Messungen, jeder Tag gleich gewichtet:
 * Mehrere Messungen an einem Tag werden erst zum Tageswert gemittelt.
 */
export function mittelwert(messungen: readonly Messung[]): Koerpermassen | null {
  if (messungen.length === 0) return null;
  const proTag = new Map<IsoDatum, { fett: number; muskel: number; n: number }>();
  for (const m of messungen) {
    const { fettKg, muskelKg } = massen(m);
    const tag = proTag.get(m.datum) ?? { fett: 0, muskel: 0, n: 0 };
    tag.fett += fettKg;
    tag.muskel += muskelKg;
    tag.n++;
    proTag.set(m.datum, tag);
  }
  let fett = 0;
  let muskel = 0;
  for (const tag of proTag.values()) {
    fett += tag.fett / tag.n;
    muskel += tag.muskel / tag.n;
  }
  return {
    fettKg: fett / proTag.size,
    muskelKg: muskel / proTag.size,
    anzahlMessungen: proTag.size,
  };
}

/**
 * Startwert: Mittelwert aller Messungen im Kalibrierfenster [von, bis].
 * Mit weniger als 3 Messtagen gibt es noch keinen Startwert (3 × am selben Tag reicht nicht).
 */
export function startwert(messungen: readonly Messung[], von: IsoDatum, bis: IsoDatum): Koerpermassen | null {
  const imFenster = messungen.filter((m) => imZeitraum(m.datum, von, bis));
  const anzahl = bis < FORTSCHRITT.messtageAb ? imFenster.length : messtage(imFenster);
  if (anzahl < FORTSCHRITT.minMessungenKalibrierung) return null;
  return mittelwert(imFenster);
}

/**
 * Aktueller Wert: Mittelwert der Messungen der 7 Tage bis einschließlich `stichtag`,
 * aber nicht vor `fruehestens` (dem Tag nach der Kalibrierung).
 * Liegen dort weniger als 2 Messtage, zählen die letzten 2 Messtage ab `frühestens`,
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
  if (messtage(imFenster) >= FORTSCHRITT.minMessungenAktuell) return mittelwert(imFenster);

  const bisher = messungen.filter((m) => imZeitraum(m.datum, fruehestens, stichtag));
  const tage = [...new Set(bisher.map((m) => m.datum))].sort();
  if (tage.length < FORTSCHRITT.minMessungenAktuell) return null;
  const letzte = new Set(tage.slice(-FORTSCHRITT.minMessungenAktuell));
  return mittelwert(bisher.filter((m) => letzte.has(m.datum)));
}

export interface Fortschrittswertung {
  /** Relativer Fettabbau in Prozent (positiv = weniger Fett). */
  fettAbbauPct: number;
  /** Relativer Muskelaufbau in Prozent (positiv = mehr Muskel). */
  muskelAufbauPct: number;
  punkte: number;
  /** Ohne Waage: Punkte sind der Median der Gruppe, die Prozente bleiben 0. */
  ausGruppe?: boolean;
  /** Im Finale ohne Messung in der letzten Woche: keine positiven Punkte. */
  ohneAbschlussmessung?: boolean;
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
