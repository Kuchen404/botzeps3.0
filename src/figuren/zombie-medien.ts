import { ZOMBIE_ANGRIFFE } from "./zombie-angriffe.js";
import { readFileSync } from "node:fs";

export const ZOMBIE_BILDER = {
  "gym": "zombie-gym-gym-c059e4cdca06.png",
  "gast": "zombie-gym-gast-f4ad7a619c5b.png"
} as const;
const cache = new Map<string, Buffer>();

/** Feste, versionierte Bilder für Gym und neutrale Platzhalterfigur. */
export function zombieMedium(datei: string): Buffer | null {
  if (!(Object.values(ZOMBIE_BILDER) as readonly string[]).includes(datei) && !Object.values(ZOMBIE_ANGRIFFE).includes(datei)) return null;
  let bild = cache.get(datei);
  if (!bild) { bild = readFileSync(new URL(`./medien/${datei}`, import.meta.url)); cache.set(datei, bild); }
  return bild;
}
