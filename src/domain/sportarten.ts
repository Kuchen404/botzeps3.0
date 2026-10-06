import type { Faktor } from "../scoring/fleiss.js";

export interface Sportart {
  name: string;
  faktor: Faktor;
  /** Messbares Kriterium, falls die Stufe vom Tempo abhängt (Konzept 3.2). */
  kriterium?: string;
}

export const STUFEN: Record<Faktor, string> = { 1: "leicht", 2: "mittel", 3: "intensiv" };

/**
 * Startliste jeder Gruppe, Stufen nach dem Compendium of Physical Activities
 * (leicht 2,5–4 MET, mittel 4,5–7 MET, intensiv ab 7,5 MET).
 */
export const STANDARD_SPORTARTEN: readonly Sportart[] = [
  { name: "Spazierengehen", faktor: 1 },
  { name: "Yoga", faktor: 1 },
  { name: "Dehnen", faktor: 1 },
  { name: "Pilates", faktor: 1 },
  { name: "Krafttraining", faktor: 2 },
  { name: "Radfahren", faktor: 2, kriterium: "unter 16 km/h leicht, über 20 km/h intensiv" },
  { name: "Wandern", faktor: 2 },
  { name: "Schwimmen", faktor: 2, kriterium: "locker mittel, zügig intensiv" },
  { name: "Tischtennis", faktor: 2 },
  { name: "Tanzen", faktor: 2 },
  { name: "Joggen", faktor: 3 },
  { name: "Fußball", faktor: 3 },
  { name: "Squash", faktor: 3 },
  { name: "Spinning", faktor: 3 },
  { name: "HIIT", faktor: 3 },
  { name: "Klettern", faktor: 3 },
];

export function sucheSportart(liste: readonly Sportart[], eingabe: string): Sportart | undefined {
  const gesucht = eingabe.trim().toLocaleLowerCase("de");
  return liste.find((s) => s.name.toLocaleLowerCase("de") === gesucht);
}

export function sportartenText(liste: readonly Sportart[]): string {
  const zeilen: string[] = [];
  for (const faktor of [3, 2, 1] as const) {
    const passende = liste.filter((s) => s.faktor === faktor);
    if (passende.length === 0) continue;
    zeilen.push(`${STUFEN[faktor]} (×${faktor}):`);
    for (const s of passende) zeilen.push(`• ${s.name}${s.kriterium ? ` (${s.kriterium})` : ""}`);
    zeilen.push("");
  }
  return zeilen.join("\n").trim();
}
