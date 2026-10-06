import type { Wochenwertung } from "./fleiss.js";

/**
 * Boss-Wochen: Zweimal pro Season greift ein Boss an, in der 2. Woche und als
 * aufgepumpte Version in der vorletzten. Jeder Lastpunkt der Gruppe in dieser Woche
 * ist Schaden. Fällt er bis Wochenende, bekommt jeder, der mitgeprügelt hat, einen Bonus.
 */
export const BOSS_STUFEN = {
  1: { woche: (_wochen: number) => 1, lebenspunkteFaktor: 1.1, bonus: 5 },
  2: { woche: (wochen: number) => wochen - 2, lebenspunkteFaktor: 1.5, bonus: 10 },
} as const;

export type BossStufe = keyof typeof BOSS_STUFEN;
export const STUFEN: readonly BossStufe[] = [1, 2];

/** Uhrzeit der Ankündigung am ersten Tag der Boss-Woche. */
export const BOSS_ANKUENDIGUNG = "09:00";
/** Bosse gibt es erst ab dieser Season-Länge, sonst fallen Anfang und Ende zusammen. */
export const BOSS_MIN_WOCHEN = 4;

export const BOSS_NAMEN = [
  "Der innere Schweinehund",
  "Der Dönerteller XXL",
  "Das Sofa der Verdammnis",
  "König Bierbauch",
  "Die Chipstüte des Grauens",
  "Der Lieferdienst-Lord",
  "Graf Gemütlich",
] as const;

const EMOJI: Record<(typeof BOSS_NAMEN)[number], string> = {
  "Der innere Schweinehund": "🐷",
  "Der Dönerteller XXL": "🥙",
  "Das Sofa der Verdammnis": "🛋️",
  "König Bierbauch": "🍺",
  "Die Chipstüte des Grauens": "🍟",
  "Der Lieferdienst-Lord": "🛵",
  "Graf Gemütlich": "🦥",
};

/** Bild des Bosses für die Mini App; unbekannte Namen werden zum Drachen. */
export function bossEmoji(name: string): string {
  return EMOJI[name as keyof typeof EMOJI] ?? "🐉";
}

/** 0-basierte Boss-Woche einer Stufe, oder null, wenn die Season zu kurz ist. */
export function bossWoche(stufe: BossStufe, wochen: number): number | null {
  return wochen >= BOSS_MIN_WOCHEN ? BOSS_STUFEN[stufe].woche(wochen) : null;
}

/** Stufe 1 heißt wie der Boss, Stufe 2 ist seine aufgepumpte Version. */
export function bossAnzeigename(name: string, stufe: BossStufe): string {
  return stufe === 2 ? `${name} (aufgepumpt)` : name;
}

export function bossLebenspunkte(stufe: BossStufe, teilnehmer: number, wochenziel: number): number {
  const roh = teilnehmer * wochenziel * BOSS_STUFEN[stufe].lebenspunkteFaktor;
  return Math.max(50, Math.round(roh / 50) * 50);
}

export interface BossEinstellung {
  stufe: BossStufe;
  /** 0-basierte Woche der Season. */
  woche: number;
  lebenspunkte: number;
}

export interface BossKampf extends BossEinstellung {
  bonus: number;
  schaden: number;
  besiegt: boolean;
  /** ids aller, die in der Boss-Woche Last hatten */
  beteiligte: string[];
  /** ids aller, die nichts beigetragen haben */
  drueckeberger: string[];
}

export function bossKampf(boss: BossEinstellung, staende: readonly { id: string; wochen: readonly Wochenwertung[] }[]): BossKampf {
  const last = (st: (typeof staende)[number]) => st.wochen[boss.woche]?.last ?? 0;
  const schaden = staende.reduce((s, st) => s + last(st), 0);
  return {
    ...boss,
    bonus: BOSS_STUFEN[boss.stufe].bonus,
    schaden,
    besiegt: schaden >= boss.lebenspunkte,
    beteiligte: staende.filter((st) => last(st) > 0).map((st) => st.id),
    drueckeberger: staende.filter((st) => last(st) === 0).map((st) => st.id),
  };
}

/** Lebensbalken, z. B. "▓▓▓▓░░░░░░" für 40 % übrig. */
export function lebensbalken(k: Pick<BossKampf, "lebenspunkte" | "schaden">, breite = 10): string {
  const uebrig = Math.max(0, k.lebenspunkte - k.schaden) / k.lebenspunkte;
  const voll = Math.ceil(uebrig * breite);
  return "▓".repeat(voll) + "░".repeat(breite - voll);
}
