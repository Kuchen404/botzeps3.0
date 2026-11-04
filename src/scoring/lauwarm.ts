import type { Training } from "./fleiss.js";

/**
 * Faktor-Minimalisten: Wer in einer Woche fast nur Kuschelsport mit dem kleinsten Faktor
 * einträgt (Spazieren ohne Tempo, Yoga, Dehnen, Pilates, lockeres Radeln/Tanzen, Alltag),
 * kriegt ab und zu einen Spruch. Das ist nur Frotzelei, Punkte ändern sich dadurch nicht.
 */
export const LAUWARM = {
  /** Bis zu diesem Faktor gilt ein Training als Kuschelsport (×0,5 und ×1). */
  maxFaktor: 1,
  /** So viele Kuschel-Einträge braucht es in einer Woche mindestens … */
  minEintraege: 3,
  /** … und sie müssen mindestens diesen Anteil aller Einträge der Woche ausmachen. */
  minAnteil: 2 / 3,
  /** Beim Trainingspost nur bei jedem soundsovielten Kuschel-Eintrag der Woche (3., 6., …). */
  jederWievielte: 3,
} as const;

export function istLauwarm(t: Pick<Training, "faktor">): boolean {
  return t.faktor <= LAUWARM.maxFaktor;
}

export interface LauwarmBilanz {
  eintraege: number;
  lauwarm: number;
  /** Minuten der Kuschel-Einträge */
  minuten: number;
}

export function lauwarmBilanz(trainings: readonly Pick<Training, "faktor" | "minuten">[]): LauwarmBilanz {
  const lau = trainings.filter(istLauwarm);
  return { eintraege: trainings.length, lauwarm: lau.length, minuten: lau.reduce((s, t) => s + t.minuten, 0) };
}

/** Überwiegend Kuschelsport: mindestens 3 Einträge mit kleinstem Faktor und mindestens ⅔ aller Einträge. */
export function istFaktorMinimalist(b: LauwarmBilanz): boolean {
  return b.lauwarm >= LAUWARM.minEintraege && b.lauwarm >= b.eintraege * LAUWARM.minAnteil;
}

/**
 * Spruch beim Trainingspost? Nur wenn das neue Training selbst Kuschelsport ist, die Woche
 * (dieses Training eingerechnet) überwiegend daraus besteht und es der 3., 6., 9. … Kuschel-Eintrag
 * der Woche ist. So kommt der Spruch gelegentlich und nicht bei jedem Spaziergang.
 */
export function lauwarmBeimPost(neu: Pick<Training, "faktor">, woche: LauwarmBilanz): boolean {
  return istLauwarm(neu) && istFaktorMinimalist(woche) && woche.lauwarm % LAUWARM.jederWievielte === 0;
}

/**
 * Kuschelsportler der Woche für den Wochenbericht: unter allen Faktor-Minimalisten
 * der mit dem höchsten Anteil, bei Gleichstand der mit den meisten Kuschel-Minuten.
 */
export function kuschelsportler<T extends { id: string; bilanz: LauwarmBilanz }>(kandidaten: readonly T[]): T | undefined {
  return kandidaten
    .filter((k) => istFaktorMinimalist(k.bilanz))
    .sort((a, b) => b.bilanz.lauwarm / b.bilanz.eintraege - a.bilanz.lauwarm / a.bilanz.eintraege || b.bilanz.minuten - a.bilanz.minuten)[0];
}
