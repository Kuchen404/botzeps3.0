import { type IsoDatum } from "./datum.js";

/** Grenzen und Ziele der Fleiß-Säule (Konzept 3.2). */
export const FLEISS = {
  /** Lastpunkte pro Woche, die als Ziel gelten (≈ 150 min Krafttraining ×3 oder 100 min Joggen ×4,5). */
  wochenzielLast: 450,
  /** Punkte für genau erreichtes Wochenziel. */
  punkteProZiel: 10,
  /** Deckel: mehr als 150 % des Ziels zählt nicht. */
  maxZielAnteil: 1.5,
  /**
   * Pro Tag zählen höchstens so viele Minuten, egal in wie viele Einträge aufgeteilt.
   * Sind es mehr, zählen die Minuten mit dem höchsten Faktor zuerst.
   */
  maxMinutenProTag: 240,
  /** Ab dieser Serienlänge (Wochen in Folge mit Ziel) gibt es Bonus. */
  serieBonusAb: 3,
  /** Höchster Serienbonus pro Woche. */
  maxSerieBonus: 3,
} as const;

/**
 * Faktor einer Sportart: MET-Wert laut Compendium minus 3, also nur die Anstrengung
 * über dem Alltag, in Schritten von 0,5 (siehe domain/sportarten.ts).
 */
export type Faktor = number;

export interface Training {
  datum: IsoDatum;
  minuten: number;
  /** Faktor zum Zeitpunkt des Eintrags (Sportart oder, beim Spazieren, aus den Schritten). */
  faktor: Faktor;
  /** id der Sportart, für die Schwäche eines Bosses */
  sportartId?: number;
}

/** Last einer einzelnen Einheit für sich: Minuten (höchstens ein Tagesdeckel) × Faktor, auf ganze Punkte gerundet. */
export function einheitsLast(training: Pick<Training, "minuten" | "faktor">): number {
  const minuten = Math.max(0, Math.min(training.minuten, FLEISS.maxMinutenProTag));
  return Math.round(minuten * training.faktor);
}

/** Grenzen für Schritte beim Spazieren: Faktor aus dem Tempo (Schritte pro Minute). */
export const SCHRITTE = {
  /** Unter diesem Tempo bleibt es beim Grundfaktor (≈ 3 MET laut CADENCE-Adults). */
  abProMinute: 100,
  /** Je 10 Schritte pro Minute mehr ≈ 1 MET mehr, also +1 Faktor. */
  proFaktor: 10,
  minFaktor: 0.5,
  /** 130 Schritte pro Minute ≈ 6 MET, mehr ist Joggen. */
  maxFaktor: 3,
  /** Plausible Eingaben pro Minute. Über 140 ist kein Gehen mehr, sondern Joggen oder Schritte vom ganzen Tag. */
  minProMinute: 30,
  maxProMinute: 140,
} as const;

/**
 * Faktor eines Spaziergangs aus Minuten und Schritten: (Schritte pro Minute − 100) / 10,
 * auf 0,5 gerundet, zwischen 0,5 und 3. 90/min → 0,5, 110/min → 1, 120/min → 2, 130/min → 3.
 */
export function schrittFaktor(minuten: number, schritte: number): number {
  const proMinute = schritte / minuten;
  const roh = (proMinute - SCHRITTE.abProMinute) / SCHRITTE.proFaktor;
  const gerundet = Math.round(roh * 2) / 2;
  return Math.min(SCHRITTE.maxFaktor, Math.max(SCHRITTE.minFaktor, gerundet));
}

/** Passen die Schritte zur Dauer? null wenn ja, sonst der Fehlertext. */
export function pruefeSchritte(minuten: number, schritte: number): string | null {
  if (!Number.isInteger(schritte) || schritte <= 0) return "Schritte bitte als ganze Zahl.";
  const proMinute = schritte / minuten;
  const was = `${schritte.toLocaleString("de-DE")} Schritte in ${minuten} min wären ${Math.round(proMinute)} pro Minute`;
  if (proMinute > SCHRITTE.maxProMinute) {
    return `${was}, das ist kein Spazieren mehr (höchstens ${SCHRITTE.maxProMinute}). Nur die Schritte vom Spaziergang selbst zählen, nicht die vom ganzen Tag.`;
  }
  if (proMinute < SCHRITTE.minProMinute) return `${was}, das passt nicht (mindestens ${SCHRITTE.minProMinute}).`;
  return null;
}

/**
 * Summe der Last aller Trainings. Pro Tag zählen höchstens 240 Minuten, die mit dem
 * höchsten Faktor zuerst. So bringt Aufteilen nichts: 240 min am Stück zählen genauso
 * wie 2 × 120 oder 4 × 60, und Häppchen über den Deckel hinaus zählen nicht.
 */
export function gesamtLast(trainings: readonly Pick<Training, "datum" | "minuten" | "faktor">[]): number {
  const proTag = new Map<IsoDatum, Pick<Training, "minuten" | "faktor">[]>();
  for (const t of trainings) {
    const liste = proTag.get(t.datum) ?? [];
    liste.push(t);
    proTag.set(t.datum, liste);
  }
  let summe = 0;
  for (const liste of proTag.values()) {
    const sortiert = [...liste].sort((a, b) => b.faktor - a.faktor);
    let frei = FLEISS.maxMinutenProTag;
    let tagesLast = 0;
    for (const t of sortiert) {
      if (frei <= 0) break;
      const minuten = Math.max(0, Math.min(t.minuten, frei));
      tagesLast += minuten * t.faktor;
      frei -= minuten;
    }
    summe += Math.round(tagesLast);
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
