import { readFileSync } from "node:fs";

export const DUELL_BILDER = {
  "ring": "duell-ring-c7de0abc201a.png",
  "bot": "duell-bot-8e61bce5809e.png"
} as const;
const cache = new Map<string, Buffer>();

/** Nur feste, versionierte Ring- und Roboterbilder am öffentlichen Medien-Endpunkt. */
export function duellMedium(datei: string): Buffer | null {
  if (!(Object.values(DUELL_BILDER) as readonly string[]).includes(datei)) return null;
  let bild = cache.get(datei);
  if (!bild) { bild = readFileSync(new URL(`./medien/${datei}`, import.meta.url)); cache.set(datei, bild); }
  return bild;
}
