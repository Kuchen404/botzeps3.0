/**
 * Ränge über alle Seasons: Die lebenslange Trainingslast steigt nur,
 * damit auch Abgeschlagene etwas zu erreichen haben.
 */
export interface Rang {
  name: string;
  emoji: string;
  /** Lebenslange Lastpunkte, ab denen der Rang gilt. */
  ab: number;
}

/** Bei 450 Lastpunkten pro Woche: Lauch nach gut 3 Wochen, Hantelschubser nach einer Season, Botzeps nach Jahren. */
export const RAENGE: readonly Rang[] = [
  { name: "Couchkartoffel", emoji: "🛋", ab: 0 },
  { name: "Lauch", emoji: "🥬", ab: 1_500 },
  { name: "Hantelschubser", emoji: "🏋️", ab: 4_500 },
  { name: "Pumper", emoji: "💪", ab: 11_000 },
  { name: "Kampfsau", emoji: "🐗", ab: 22_500 },
  { name: "Maschine", emoji: "🤖", ab: 45_000 },
  { name: "Botzeps", emoji: "🦍", ab: 90_000 },
];

/** Index des Rangs in `RAENGE` für eine lebenslange Last. */
export function rangIndex(last: number): number {
  let i = 0;
  while (i + 1 < RAENGE.length && last >= RAENGE[i + 1]!.ab) i++;
  return i;
}

export function rangFuer(last: number): Rang {
  return RAENGE[rangIndex(last)]!;
}

/** Nächster Rang und wie viele Lastpunkte noch fehlen, oder null auf dem höchsten Rang. */
export function naechsterRang(last: number): { rang: Rang; fehlen: number } | null {
  const naechster = RAENGE[rangIndex(last) + 1];
  return naechster ? { rang: naechster, fehlen: naechster.ab - last } : null;
}

export function rangText(r: Rang): string {
  return `${r.emoji} ${r.name}`;
}
