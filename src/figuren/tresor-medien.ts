import { readFileSync } from "node:fs";

export const TRESOR_BILDER = {"raum": "tresor-raum-2bea623b6bc0.png", "tresor": "tresor-tresor-5bb315a3809a.png", "innen": "tresor-innen-1a13d91451cd.png"} as const;
const cache = new Map<string, Buffer>();

/** Eigene, feste Liste: keine frei wählbaren Dateipfade am Medien-Endpunkt. */
export function tresorMedium(datei: string): Buffer | null {
  if (!(Object.values(TRESOR_BILDER) as readonly string[]).includes(datei)) return null;
  let bild = cache.get(datei);
  if (!bild) {
    bild = readFileSync(new URL(`./medien/${datei}`, import.meta.url));
    cache.set(datei, bild);
  }
  return bild;
}
