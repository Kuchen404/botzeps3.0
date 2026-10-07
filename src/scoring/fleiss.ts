import { type IsoDatum } from "./datum.js";

/** Grenzen und Ziele der Fleiß-Säule (Konzept 3.2). */
export const FLEISS = {
  /** Lastpunkte pro Woche, die als Ziel gelten (≈ 150 min moderat). */
  wochenzielLast: 300,
  /** Punkte für genau erreichtes Wochenziel. */
  punkteProZiel: 10,
  /** Deckel: mehr als 150 % des Ziels zählt nicht. */
  maxZielAnteil: 1.5,
  /** Pro Einheit zählen höchstens so viele Minuten. */
  maxMinutenProEinheit: 120,
  /** Pro Tag zählen höchstens so viele Einheiten. */
  maxEinheitenProTag: 2,
  /** Ab dieser Serienlänge (Wochen in Folge mit Ziel) gibt es Bonus. */
  serieBonusAb: 3,
  /** Höchster Serienbonus pro Woche. */
  maxSerieBonus: 3,
} as const;

export type Faktor = 1 | 2 | 3;

export interface Training {
  datum: IsoDatum;
  minuten: number;
  /** Faktor der Sportart zum Zeitpunkt des Eintrags (1 leicht, 2 mittel, 3 intensiv). */
  faktor: Faktor;
  /** id der Sportart, für die Schwäche eines Bosses */
  sportartId?: number;
}

/** Last einer einzelnen Einheit: Minuten (gedeckelt) × Faktor. */
export function einheitsLast(training: Pick<Training, "minuten" | "faktor">): number {
  const minuten = Math.max(0, Math.min(training.minuten, FLEISS.maxMinutenProEinheit));
  return minuten * training.faktor;
}

/**
 * Summe der Last aller Trainings. Pro Tag zählen nur die zwei Einheiten
 * mit der höchsten Last, damit Eintragen in Häppchen nichts bringt.
 */
export function gesamtLast(trainings: readonly Training[]): number {
  const proTag = new Map<IsoDatum, number[]>();
  for (const t of trainings) {
    const liste = proTag.get(t.datum) ?? [];
    liste.push(einheitsLast(t));
    proTag.set(t.datum, liste);
  }
  let summe = 0;
  for (const lasten of proTag.values()) {
    lasten.sort((a, b) => b - a);
    for (const last of lasten.slice(0, FLEISS.maxEinheitenProTag)) {
      summe += last;
    }
  }
  return summe;
}

/** Fleißpunkte einer Woche ohne Serienbonus: 10 × min(Last / Ziel, 1,5). */
export function wochenpunkte(last: number, wochenziel: number = FLEISS.wochenzielLast): number {
  if (wochenziel <= 0) return 0;
  const anteil = Math.min(last / wochenziel, FLEISS.maxZielAnteil);
  return FLEISS.punkteProZiel * Math.max(0, anteil);
}

/**
 * Bonus für eine Serie erreichter Wochenziele: ab der 3. Woche in Folge
 * +1, in der 4. +2, ab der 5. +3 pro Woche.
 */
export function serienBonus(serie: number): number {
  if (serie < FLEISS.serieBonusAb) return 0;
  return Math.min(serie - FLEISS.serieBonusAb + 1, FLEISS.maxSerieBonus);
}

export interface Wochenwertung {
  /** 0-basierte Woche der Season. */
  woche: number;
  last: number;
  zielErreicht: boolean;
  /** Wochen in Folge mit erreichtem Ziel, inklusive dieser. */
  serie: number;
  basispunkte: number;
  bonus: number;
  punkte: number;
}

/** Wertet eine Folge von Wochenlasten (Woche 0, 1, 2, …) aus. */
export function werteWochen(
  wochenLasten: readonly number[],
  wochenziel: number = FLEISS.wochenzielLast,
): Wochenwertung[] {
  let serie = 0;
  return wochenLasten.map((last, woche) => {
    const zielErreicht = wochenziel > 0 && last >= wochenziel;
    serie = zielErreicht ? serie + 1 : 0;
    const basispunkte = wochenpunkte(last, wochenziel);
    const bonus = zielErreicht ? serienBonus(serie) : 0;
    return { woche, last, zielErreicht, serie, basispunkte, bonus, punkte: basispunkte + bonus };
  });
}
