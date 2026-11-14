import { readFileSync } from 'node:fs';
import { SCHWEINEHUND_ATLANTEN } from './schweinehund-atlanten.js';

export interface BossSequenz {
  atlas: string;
  art?: string;
  groesse: number;
  zelle: number;
  bilder: { x: number; y: number; dauer: number; ankerX?: number }[];
}
const cache = new Map<string, Buffer>();
// Fußmittelpunkte der unveränderten Zeichnungen: stabiler Stand beim Posenwechsel.
const anker: Readonly<Record<string, readonly number[]>> = {
  auftritt: [136.2,124.2,139,128], ruhe: [128.3,119.6,128.5,119.5],
  treffer: [132.5,110,120.9,125], zustand: [144.1,121.4,137.7,116.8], niederlage: [142.6,133.1,135.8,124],
};
const ablaeufe: Readonly<Record<string, readonly [number, number][]>> = {
  auftritt: [[0, 400], [1, 440], [2, 480], [3, 480]],
  niederlage: [[0, 320], [1, 380], [2, 380], [3, 500]],
  zustandSelbstsicher: [[0, 600]], zustandKnurren: [[1, 700]], zustandNervoes: [[2, 140], [3, 140], [2, 140], [3, 140], [2, 140]],
  trefferKlein: [[0, 190]], trefferGross: [[1, 130], [2, 200], [3, 230]], trefferFinal: [[1, 130], [2, 200]],
  ruheLinks: [[0, 650]], ruheRechts: [[1, 650]], schnueffeln: [[2, 400], [0, 180], [2, 300]], einnicken: [[3, 1000]],
};
function atlasArt(name: string): string { return name === 'auftritt' || name === 'niederlage' ? name : name.startsWith('treffer') ? 'treffer' : name.startsWith('zustand') ? 'zustand' : 'ruhe'; }
export function schweinehundSequenzen(): Record<string, BossSequenz> {
  return Object.fromEntries(Object.entries(ablaeufe).filter(([name]) => SCHWEINEHUND_ATLANTEN[atlasArt(name)]).map(([name, bilder]) => [name, {
    atlas: '/api/bossbild/' + SCHWEINEHUND_ATLANTEN[atlasArt(name)], art: atlasArt(name), groesse: 512, zelle: 256,
    bilder: bilder.map(([i, dauer]) => ({ x: i % 2 * 256, y: Math.floor(i / 2) * 256, dauer, ankerX: anker[atlasArt(name)]![i] })),
  }]));
}
export function schweinehundMedium(datei: string): Buffer | null {
  if (!Object.values(SCHWEINEHUND_ATLANTEN).includes(datei)) return null;
  let bild = cache.get(datei);
  if (!bild) { bild = readFileSync(new URL('./medien/' + datei, import.meta.url)); cache.set(datei, bild); }
  return bild;
}
