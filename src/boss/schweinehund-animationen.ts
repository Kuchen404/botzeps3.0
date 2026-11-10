import { readFileSync } from 'node:fs';
import { SCHWEINEHUND_ATLANTEN } from './schweinehund-atlanten.js';

export interface BossSequenz {
  atlas: string;
  groesse: number;
  zelle: number;
  bilder: { x: number; y: number; dauer: number }[];
}
const cache = new Map<string, Buffer>();
const ablaeufe: Readonly<Record<string, readonly [number, number][]>> = {
  auftritt: [[0, 400], [1, 440], [2, 480], [3, 480]],
};
export function schweinehundSequenzen(): Record<string, BossSequenz> {
  return Object.fromEntries(Object.entries(ablaeufe).filter(([name]) => SCHWEINEHUND_ATLANTEN[name]).map(([name, bilder]) => [name, {
    atlas: '/api/bossbild/' + SCHWEINEHUND_ATLANTEN[name], groesse: 512, zelle: 256,
    bilder: bilder.map(([i, dauer]) => ({ x: i % 2 * 256, y: Math.floor(i / 2) * 256, dauer })),
  }]));
}
export function schweinehundMedium(datei: string): Buffer | null {
  if (!Object.values(SCHWEINEHUND_ATLANTEN).includes(datei)) return null;
  let bild = cache.get(datei);
  if (!bild) { bild = readFileSync(new URL('./medien/' + datei, import.meta.url)); cache.set(datei, bild); }
  return bild;
}
