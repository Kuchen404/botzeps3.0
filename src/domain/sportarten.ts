import type { Faktor } from "../scoring/fleiss.js";

export interface Sportart {
  name: string;
  faktor: Faktor;
  /** Messbares Kriterium, z. B. das Tempo, ab dem die sportliche Variante gilt. */
  kriterium?: string;
  /** Faktor kann aus Schritten pro Minute berechnet werden (nur Gehen). */
  nachSchritten?: boolean;
}

/** Sportart mit Quelle: MET-Wert und Code aus dem 2024 Adult Compendium (pacompendium.com). */
export interface KatalogSportart {
  name: string;
  met: number;
  code: string;
  /** Alltag statt Training: zählt mindestens ×0,5 statt ×1. */
  alltag?: boolean;
  kriterium?: string;
  nachSchritten?: boolean;
}

/** Höchster Faktor: mehr als Spinning gibt es nicht, damit keine Sportart alles andere schlägt. */
export const MAX_FAKTOR = 6;
/** Untergrenze für richtiges Training (Yoga, Dehnen …) und für Alltag (Spazieren, Garten …). */
export const MIN_FAKTOR = { training: 1, alltag: 0.5 } as const;

/**
 * Faktor = MET − 3 (nur die Anstrengung über dem Alltag), auf 0,5 gerundet,
 * mindestens 1 für Training bzw. 0,5 für Alltag, höchstens 6.
 */
export function faktorAusMet(met: number, alltag = false): Faktor {
  const gerundet = Math.round((met - 3) * 2) / 2;
  return Math.min(MAX_FAKTOR, Math.max(alltag ? MIN_FAKTOR.alltag : MIN_FAKTOR.training, gerundet));
}

/** Startliste jeder Gruppe. Radfahren, Tanzen und Schwimmen gibt es locker und sportlich. */
export const STANDARD_KATALOG: readonly KatalogSportart[] = [
  { name: "Spazierengehen", met: 3.5, code: "17160", alltag: true, nachSchritten: true },
  { name: "Yoga", met: 2.3, code: "02175" },
  { name: "Dehnen", met: 2.3, code: "02101" },
  { name: "Pilates", met: 2.8, code: "02105" },
  { name: "Tischtennis", met: 4.0, code: "15660" },
  { name: "Tanzen locker", met: 3.8, code: "03070" },
  { name: "Radfahren locker", met: 4.0, code: "01010", kriterium: "unter 16 km/h" },
  { name: "Wandern", met: 5.3, code: "17082" },
  { name: "Krafttraining", met: 6.0, code: "02050" },
  { name: "Schwimmen locker", met: 5.8, code: "18240" },
  { name: "Fußball", met: 7.0, code: "15610" },
  { name: "HIIT", met: 7.0, code: "02210" },
  { name: "Joggen", met: 7.5, code: "12020" },
  { name: "Squash", met: 7.3, code: "15652" },
  { name: "Tanzen sportlich", met: 7.3, code: "03029", kriterium: "Zumba, Aerobic, Disco" },
  { name: "Klettern", met: 8.0, code: "15533" },
  { name: "Radfahren sportlich", met: 8.0, code: "01030", kriterium: "ab 20 km/h" },
  { name: "Schwimmen sportlich", met: 8.0, code: "18290", kriterium: "zügige Bahnen" },
  { name: "Spinning", met: 9.0, code: "01270" },
];

export const STANDARD_SPORTARTEN: readonly Sportart[] = STANDARD_KATALOG.map((k) => ({
  name: k.name,
  faktor: faktorAusMet(k.met, k.alltag),
  ...(k.kriterium ? { kriterium: k.kriterium } : {}),
  ...(k.nachSchritten ? { nachSchritten: true } : {}),
}));

/** Was man im Alltag so tippt, und welche Sportart der Startliste gemeint ist. */
export const ALIASE: Readonly<Record<string, string>> = {
  spazieren: "Spazierengehen",
  spaziergang: "Spazierengehen",
  "spazieren gehen": "Spazierengehen",
  gehen: "Spazierengehen",
  laufen: "Joggen",
  jogging: "Joggen",
  rennen: "Joggen",
  kraft: "Krafttraining",
  gym: "Krafttraining",
  fitnessstudio: "Krafttraining",
  pumpen: "Krafttraining",
  gewichte: "Krafttraining",
  stretching: "Dehnen",
  "indoor cycling": "Spinning",
  wanderung: "Wandern",
  "ping pong": "Tischtennis",
};

/** Die Sportarten, die zu einem Grundnamen gehören, z. B. „Radfahren“ → locker und sportlich. */
export function varianten<T extends { name: string }>(liste: readonly T[], eingabe: string): T[] {
  const grund = eingabe.trim().toLocaleLowerCase("de");
  if (!grund) return [];
  return liste.filter((s) => {
    const name = s.name.toLocaleLowerCase("de");
    return name === `${grund} locker` || name === `${grund} sportlich`;
  });
}

/** Die andere Variante (locker ↔ sportlich), oder null, wenn es keine gibt. */
export function schwesterName(name: string): string | null {
  const m = /^(.+) (locker|sportlich)$/i.exec(name.trim());
  if (!m) return null;
  return `${m[1]} ${m[2]!.toLowerCase() === "locker" ? "sportlich" : "locker"}`;
}

export function sucheSportart<T extends { name: string }>(liste: readonly T[], eingabe: string): T | undefined {
  const gesucht = eingabe.trim().toLocaleLowerCase("de");
  const exakt = liste.find((s) => s.name.toLocaleLowerCase("de") === gesucht);
  if (exakt) return exakt;
  const alias = ALIASE[gesucht];
  return alias ? liste.find((s) => s.name.toLocaleLowerCase("de") === alias.toLocaleLowerCase("de")) : undefined;
}

/** Faktor für Texte: „×4,5“. */
export function faktorText(f: Faktor): string {
  return `×${String(f).replace(".", ",")}`;
}

/** /sportarten: nach Faktor sortiert, die anstrengendsten oben. */
export function sportartenText(liste: readonly Sportart[]): string {
  const faktoren = [...new Set(liste.map((s) => s.faktor))].sort((a, b) => b - a);
  const zeilen: string[] = [];
  for (const f of faktoren) {
    const namen = liste
      .filter((s) => s.faktor === f)
      .map((s) => `${s.name}${s.kriterium ? ` (${s.kriterium})` : ""}`)
      .sort((a, b) => a.localeCompare(b, "de"));
    zeilen.push(`${faktorText(f)}: ${namen.join(", ")}`);
  }
  if (liste.some((s) => s.nachSchritten)) {
    zeilen.push("", "🚶 Spazieren mit Schritten zählt nach Tempo: 110 pro Minute ×1, 120 ×2, 130 ×3. Beispiel: /sport 60 Spazierengehen 7200");
  }
  return zeilen.join("\n");
}
