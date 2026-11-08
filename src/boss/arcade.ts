import { readFileSync } from "node:fs";
import type { BossStufe } from "../scoring/boss.js";

const MOTIVE: Readonly<Record<string, string>> = {
  "Der innere Schweinehund": "schweinehund",
  "Der Dönerteller XXL": "doenerteller",
  "Das Sofa der Verdammnis": "sofa",
  "König Bierbauch": "bierbauch",
  "Die Chipstüte des Grauens": "chips",
  "Der Lieferdienst-Lord": "lieferdienst",
  "Graf Gemütlich": "gemuetlich",
};

export function hatArcadeBild(name: string): boolean {
  return Object.hasOwn(MOTIVE, name);
}

const cache = new Map<string, string>();
function bild(datei: string): string {
  let uri = cache.get(datei);
  if (!uri) {
    uri = `data:image/png;base64,${readFileSync(new URL(`./medien/${datei}.png`, import.meta.url)).toString("base64")}`;
    cache.set(datei, uri);
  }
  return uri;
}

/** Eingebettete PNGs funktionieren ohne weitere HTTP-Abfragen auch in resvg-Steckbriefen.
 * Die fünf Doppelbilder werden im SVG auf die jeweilige Hälfte begrenzt. */
export function arcadeZeichnung(name: string, stufe: BossStufe, id: string): string | null {
  if (!hatArcadeBild(name)) return null;
  const motiv = MOTIVE[name]!;
  const einzeln = motiv === "sofa" || motiv === "chips";
  const uri = bild(einzeln ? `${motiv}${stufe}` : motiv);
  // Trennlinie liegt im transparenten Zwischenraum, nicht in der Bildmitte:
  // Die Muskelarme der zweiten Form reichen über die Mitte hinaus.
  const x = !einzeln && stufe === 2 ? 448 : 0;
  const breite = einzeln ? 512 : stufe === 1 ? 448 : 576;
  const klein = einzeln && stufe === 1 ? ' transform="translate(26 48) scale(.78)"' : "";
  return `<g class="bz-figure"><g${klein}><svg x="0" y="0" width="240" height="240" viewBox="${x} 0 ${breite} 512" overflow="hidden"><defs><clipPath id="${id}bild"><rect x="${x}" y="0" width="${breite}" height="512"/></clipPath></defs><image clip-path="url(#${id}bild)" href="${uri}" width="${einzeln ? 512 : 1024}" height="512" preserveAspectRatio="none"/></svg></g></g>`;
}

export const ARCADE_BEWEGUNG = `
.boss-illustriert .bz-figure { transform-origin:120px 226px; animation:boss-atmen 3.4s ease-in-out infinite; }
.boss-illustriert.aufgepumpt .bz-figure { animation-name:boss-posieren; }
@keyframes boss-atmen { 0%,100% { transform:scale(1); } 50% { transform:translateY(-2px) scale(1.012,.99); } }
@keyframes boss-posieren { 0%,100% { transform:scale(1); } 35%,55% { transform:translateY(-3px) scale(1.035,.98); } 75% { transform:scale(.99,1.01); } }
@media (prefers-reduced-motion:reduce) { .boss-illustriert .bz-figure { animation:none; } }
`;
