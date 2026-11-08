import { readFileSync } from "node:fs";
import { ATLAS_DATEIEN } from "./atlanten.js";
import type { Pose } from "./figuren.js";

// Unter /api/, weil der Reverse-Proxy auf dem Server nur /app selbst und /api/ an die App weiterreicht
export const FIGUREN_MEDIEN_PFAD = "/api/figurbild/";
const POSEN: readonly Pose[] = ["bereit", "schlag", "jubel", "ko", "ziehen", "klettern"];
const cache = new Map<string, Buffer>();

/** Ausschließlich bekannte, mit Inhalts-Hash versionierte Dateien ausliefern. */
export function figurMedium(datei: string): Buffer | null {
  if (!ATLAS_DATEIEN.includes(datei)) return null;
  let bild = cache.get(datei);
  if (!bild) {
    bild = readFileSync(new URL(`./medien/${datei}`, import.meta.url));
    cache.set(datei, bild);
  }
  return bild;
}

/** Alle sechs Posen teilen ein Bild: ein Download, keine Ladepause beim Schlag. */
export function arcadeSpieler(nr: number, pose: Pose, id: string): string | null {
  const datei = ATLAS_DATEIEN[nr];
  if (!datei) return null;
  const feld = POSEN.indexOf(pose);
  const x = (feld % 3) * 200, y = Math.floor(feld / 3) * 300;
  return `<svg x="-58" y="-12" width="116" height="172" viewBox="${x} ${y} 200 300" overflow="hidden"><defs><clipPath id="${id}k"><rect x="${x}" y="${y}" width="200" height="300"/></clipPath></defs><image clip-path="url(#${id}k)" href="${FIGUREN_MEDIEN_PFAD}${datei}" width="600" height="600"/></svg>`;
}
