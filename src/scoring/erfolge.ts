import { type IsoDatum, plusTage } from "./datum.js";
import { FLEISS, type Faktor, type Wochenwertung } from "./fleiss.js";

/** Einmalige Erfolge über alle Seasons, alle automatisch aus Trainings und Wertung geprüft. */
export const ERFOLGE = {
  erste_einheit: { titel: "Erster Schweißtropfen", beschreibung: "die erste Einheit eingetragen" },
  minuten_1000: { titel: "Tausendsassa", beschreibung: "1.000 Minuten Sport" },
  minuten_6000: { titel: "Hundert-Stunden-Hengst", beschreibung: "100 Stunden Sport" },
  einheit_120: { titel: "Ausdauerbestie", beschreibung: "eine Einheit von mindestens 2 Stunden" },
  sportarten_5: { titel: "Gemischtwarenladen", beschreibung: "5 verschiedene Sportarten" },
  tage_7: { titel: "Durchgezogen", beschreibung: "7 Tage am Stück trainiert" },
  tage_14: { titel: "Besessen", beschreibung: "14 Tage am Stück trainiert" },
  wochenziel: { titel: "Pflicht erfüllt", beschreibung: "zum ersten Mal das Wochenziel geschafft" },
  deckel: { titel: "Übererfüllt", beschreibung: "150 % des Wochenziels in einer Woche" },
  serie_5: { titel: "Eiserne Disziplin", beschreibung: "5 Wochen in Folge das Wochenziel" },
  serie_10: { titel: "Unkaputtbar", beschreibung: "10 Wochen in Folge das Wochenziel" },
  bossbezwinger: { titel: "Drachentöter", beschreibung: "beim Sieg gegen einen Boss mitgeprügelt" },
  podest: { titel: "Treppchen", beschreibung: "eine Season auf Platz 1 bis 3 beendet" },
  champion: { titel: "Champion", beschreibung: "eine Season gewonnen" },
} as const satisfies Record<string, { titel: string; beschreibung: string }>;

export type ErfolgArt = keyof typeof ERFOLGE;

export const ERFOLG_ARTEN = Object.keys(ERFOLGE) as ErfolgArt[];

export function erfolgText(art: ErfolgArt): string {
  return `🏆 ${ERFOLGE[art].titel} (${ERFOLGE[art].beschreibung})`;
}

export interface ErfolgTraining {
  datum: IsoDatum;
  minuten: number;
  faktor: Faktor;
  sportart: string;
}

/** Längste Folge aufeinanderfolgender Tage mit mindestens einem Training. */
export function laengsteTagesserie(daten: readonly IsoDatum[]): number {
  const tage = new Set(daten);
  let beste = 0;
  for (const tag of tage) {
    if (tage.has(plusTage(tag, -1))) continue; // nur ab dem ersten Tag einer Folge zählen
    let laenge = 1;
    while (tage.has(plusTage(tag, laenge))) laenge++;
    beste = Math.max(beste, laenge);
  }
  return beste;
}

/** Erfolge, die sich aus allen Trainings eines Nutzers ergeben. */
export function trainingsErfolge(trainings: readonly ErfolgTraining[]): ErfolgArt[] {
  if (trainings.length === 0) return [];
  const erfolge: ErfolgArt[] = ["erste_einheit"];
  const minuten = trainings.reduce((s, t) => s + t.minuten, 0);
  if (minuten >= 1_000) erfolge.push("minuten_1000");
  if (minuten >= 6_000) erfolge.push("minuten_6000");
  if (trainings.some((t) => t.minuten >= 120)) erfolge.push("einheit_120");
  if (new Set(trainings.map((t) => t.sportart.toLowerCase())).size >= 5) erfolge.push("sportarten_5");
  const serie = laengsteTagesserie(trainings.map((t) => t.datum));
  if (serie >= 7) erfolge.push("tage_7");
  if (serie >= 14) erfolge.push("tage_14");
  return erfolge;
}

/** Erfolge aus den Wochen einer Season. */
export function wochenErfolge(wochen: readonly Wochenwertung[], wochenziel: number): ErfolgArt[] {
  const erfolge: ErfolgArt[] = [];
  if (wochen.some((w) => w.zielErreicht)) erfolge.push("wochenziel");
  if (wochenziel > 0 && wochen.some((w) => w.last >= wochenziel * FLEISS.maxZielAnteil)) erfolge.push("deckel");
  const serie = Math.max(0, ...wochen.map((w) => w.serie));
  if (serie >= 5) erfolge.push("serie_5");
  if (serie >= 10) erfolge.push("serie_10");
  return erfolge;
}

/** Erfolge aus dem Endstand einer Season. */
export function finaleErfolge(platz: number): ErfolgArt[] {
  if (platz === 1) return ["champion", "podest"];
  return platz <= 3 ? ["podest"] : [];
}
