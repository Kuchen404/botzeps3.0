/**
 * Liniendiagramm als SVG, ohne Abhängigkeiten. Beliebig viele Reihen: Farben wiederholen sich
 * nach zehn, dann mit anderer Strichart, die Legende bricht in Zeilen um.
 */

export interface Reihe {
  name: string;
  /** Ein Wert je x-Beschriftung; null = Lücke. */
  werte: readonly (number | null)[];
}

export interface Liniendiagramm {
  titel: string;
  x: readonly string[];
  reihen: readonly Reihe[];
}

export const FARBEN = [
  "#1f77b4",
  "#d62728",
  "#2ca02c",
  "#ff7f0e",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#17becf",
  "#bcbd22",
  "#7f7f7f",
] as const;
const STRICHE = ["", "10 5", "3 4"] as const;

const BREITE = 1000;
const RAND = { links: 70, rechts: 30, oben: 70, unten: 50 } as const;
const PLOT_HOEHE = 420;
const LEGENDE = { spalten: 3, zeile: 30 } as const;
const SCHRIFT = "DejaVu Sans, Arial, sans-serif";

export function stil(i: number): { farbe: string; strich: string } {
  return { farbe: FARBEN[i % FARBEN.length]!, strich: STRICHE[Math.floor(i / FARBEN.length) % STRICHE.length]! };
}

function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function kuerze(text: string, max: number): string {
  const zeichen = [...text];
  return zeichen.length > max ? `${zeichen.slice(0, max - 1).join("")}…` : text;
}

function zahl(wert: number): string {
  return wert.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

/** Runde Achsenschritte (1, 2, 5 × 10^k) für etwa fünf Abschnitte. */
export function achse(min: number, max: number): { von: number; bis: number; schritt: number } {
  const unten = Math.min(0, min);
  const oben = Math.max(max, unten + 1);
  const roh = (oben - unten) / 5;
  const basis = 10 ** Math.floor(Math.log10(roh));
  const schritt = ([1, 2, 5, 10].find((f) => f * basis >= roh) ?? 10) * basis;
  return { von: Math.floor(unten / schritt) * schritt, bis: Math.ceil(oben / schritt) * schritt, schritt };
}

export function liniendiagramm(d: Liniendiagramm): string {
  const werte = d.reihen.flatMap((r) => r.werte.filter((w): w is number => w !== null));
  const y = achse(Math.min(0, ...werte), Math.max(0, ...werte));
  const plotBreite = BREITE - RAND.links - RAND.rechts;
  const unten = RAND.oben + PLOT_HOEHE;
  const px = (i: number) => RAND.links + (d.x.length <= 1 ? plotBreite / 2 : (i * plotBreite) / (d.x.length - 1));
  const py = (w: number) => unten - ((w - y.von) / (y.bis - y.von)) * PLOT_HOEHE;
  const r = (n: number) => Math.round(n * 10) / 10;

  const legendenZeilen = Math.ceil(d.reihen.length / LEGENDE.spalten);
  const hoehe = unten + RAND.unten + legendenZeilen * LEGENDE.zeile + 10;
  const teile: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${hoehe}" viewBox="0 0 ${BREITE} ${hoehe}" font-family="${SCHRIFT}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="${BREITE / 2}" y="40" font-size="26" font-weight="bold" text-anchor="middle" fill="#222">${xml(d.titel)}</text>`,
  ];

  for (let w = y.von; w <= y.bis + y.schritt / 1000; w += y.schritt) {
    const yy = r(py(w));
    teile.push(
      `<line x1="${RAND.links}" y1="${yy}" x2="${BREITE - RAND.rechts}" y2="${yy}" stroke="${Math.abs(w) < y.schritt / 1000 ? "#888" : "#e5e5e5"}" stroke-width="1"/>`,
      `<text x="${RAND.links - 10}" y="${yy + 5}" font-size="15" text-anchor="end" fill="#555">${zahl(Math.abs(w) < y.schritt / 1000 ? 0 : w)}</text>`,
    );
  }
  // Bei vielen Punkten nur jede n-te x-Beschriftung
  const jede = Math.ceil(d.x.length / 14);
  d.x.forEach((text, i) => {
    if (i % jede !== 0 && i !== d.x.length - 1) return;
    teile.push(`<text x="${r(px(i))}" y="${unten + 28}" font-size="15" text-anchor="middle" fill="#555">${xml(text)}</text>`);
  });

  d.reihen.forEach((reihe, i) => {
    const { farbe, strich } = stil(i);
    let pfad = "";
    let offen = false;
    reihe.werte.forEach((w, j) => {
      if (w === null) {
        offen = false;
        return;
      }
      pfad += `${offen ? "L" : "M"}${r(px(j))} ${r(py(w))} `;
      offen = true;
    });
    if (pfad) {
      teile.push(
        `<path d="${pfad.trim()}" fill="none" stroke="${farbe}" stroke-width="3" stroke-linejoin="round"${strich ? ` stroke-dasharray="${strich}"` : ""}/>`,
      );
    }
    reihe.werte.forEach((w, j) => {
      if (w !== null) teile.push(`<circle cx="${r(px(j))}" cy="${r(py(w))}" r="4" fill="${farbe}"/>`);
    });

    const spalte = i % LEGENDE.spalten;
    const zeile = Math.floor(i / LEGENDE.spalten);
    const lx = RAND.links + spalte * (plotBreite / LEGENDE.spalten);
    const ly = unten + RAND.unten + zeile * LEGENDE.zeile + 15;
    teile.push(
      `<line x1="${r(lx)}" y1="${ly}" x2="${r(lx + 34)}" y2="${ly}" stroke="${farbe}" stroke-width="4"${strich ? ` stroke-dasharray="${strich}"` : ""}/>`,
      `<text x="${r(lx + 44)}" y="${ly + 6}" font-size="17" fill="#222">${xml(kuerze(reihe.name, 26))}</text>`,
    );
  });

  teile.push("</svg>");
  return teile.join("\n");
}
