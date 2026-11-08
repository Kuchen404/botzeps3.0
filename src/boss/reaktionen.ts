import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BossStufe } from "../scoring/boss.js";

export const BOSS_REAKTIONS_PFAD = "/api/bossbild/";
const MOTIVE: Readonly<Record<string, string>> = {
  "Das Sofa der Verdammnis": "sofa",
  "Die Chipstüte des Grauens": "chips",
  "Der innere Schweinehund": "schweinehund",
  "Der Dönerteller XXL": "doenerteller",
  "König Bierbauch": "bierbauch",
  "Der Lieferdienst-Lord": "lieferdienst",
  "Graf Gemütlich": "gemuetlich",
};
const SCHNITTE: Readonly<Record<string, number>> = { sofa: 611, chips: 618, schweinehund: 616 };
const cache = new Map<string, { datei: string; bild: Buffer; groesse: number }>();
function atlas(motiv: string) {
  let a = cache.get(motiv);
  if (!a) {
    const bild = readFileSync(new URL(`./medien/${motiv}-reaktionen.png`, import.meta.url));
    const groesse = bild.readUInt32BE(16);
    if (groesse !== bild.readUInt32BE(20) || groesse % 2 !== 0) throw new Error("Boss-Reaktionsatlas muss quadratisch und gerade sein");
    a = { datei: `${motiv}-reaktionen-${createHash("sha256").update(bild).digest("hex").slice(0, 12)}.png`, bild, groesse };
    cache.set(motiv, a);
  }
  return a;
}

/** Nur bekannte, mit Inhalts-Hash versionierte Atlanten, keine freien Dateipfade. */
export function bossReaktionsMedium(datei: string): Buffer | null {
  const motiv = Object.values(MOTIVE).find((m) => datei.startsWith(`${m}-reaktionen-`));
  if (!motiv) return null;
  const a = atlas(motiv);
  return a.datei === datei ? a.bild : null;
}

/** Gleicher äußere Bildausschnitt und gleiche Stufe-1-Skalierung wie bossSvg(). */
export function bossReaktionen(name: string, stufe: BossStufe) {
  const motiv = Object.hasOwn(MOTIVE, name) ? MOTIVE[name] : undefined;
  if (!motiv) return null;
  const a = atlas(motiv);
  // Die Muskelarme ragen über die rechnerische Mitte: Schnitt im transparenten Spalt.
  const schnitt = SCHNITTE[motiv] ?? a.groesse / 2;
  function pose(art: "treffer" | "ko") {
    const feld = a.groesse / 2;
    const x = art === "treffer" ? 0 : schnitt, y = stufe === 1 ? 0 : feld;
    const breite = art === "treffer" ? schnitt : a.groesse - schnitt;
    const id = `reaktion${motiv}${stufe}${art}`;
    const klein = stufe === 1 && (motiv === "sofa" || motiv === "chips") ? ' transform="translate(26 48) scale(.78)"' : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" class="boss-illustriert boss-reaktionspose" viewBox="-30 -20 300 280" width="240" height="240"><g${klein}><svg x="0" y="0" width="240" height="240" viewBox="${x} ${y} ${breite} ${feld}" overflow="hidden"><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${breite}" height="${feld}"/></clipPath></defs><image clip-path="url(#${id})" href="${BOSS_REAKTIONS_PFAD}${a.datei}" width="${a.groesse}" height="${a.groesse}"/></svg></g></svg>`;
  }
  return { motiv, atlas: BOSS_REAKTIONS_PFAD + a.datei, treffer: pose("treffer"), ko: pose("ko") };
}
