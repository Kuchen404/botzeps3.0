/**
 * Spielerfiguren im Arcade-Comicstil der Bosse. Die zwölf festen Figuren verwenden
 * illustrierte Posen aus einem gecachten Atlas; eigene Baukastenfiguren bleiben möglich.
 */

import { arcadeSpieler } from "./arcade.js";

export type Pose = "bereit" | "schlag" | "jubel" | "ko" | "ziehen" | "klettern";
type Mimik = "grimm" | "schrei" | "freude" | "ko";
type Punkt = readonly [number, number];
type Arm = readonly [Punkt, Punkt, Punkt];

export interface Figur {
  name: string;
  haut: string;
  frisur: "stachel" | "pferdeschwanz" | "kurz" | "dutt" | "opa" | "irokese" | "afro" | "lang" | "zoepfe" | "locken" | "scheitel";
  haar: string;
  haarband?: string;
  kopf?: "stirnband" | "cap" | "helm" | "wikinger" | "badekappe" | "muetze";
  kopfFarbe?: string;
  kopfFarbe2?: string;
  brille?: "rund" | "sonne";
  brillenFarbe?: string;
  bart?: "voll" | "stoppel";
  bartFarbe?: string;
  schnauzer?: boolean;
  augen?: string;
  shirt: string;
  tank?: boolean;
  streifen?: string;
  kette?: boolean;
  hose: string;
  hosenstreifen?: string;
  socken?: string;
  schuh: string;
  handschuh: string;
  bandage?: string;
  schweissband?: string;
  emblem?: string;
  emblemFarbe?: string;
}

export interface FigurOptionen {
  /** Eindeutiger Präfix für clipPath-/filter-ids im Dokument */
  id?: string;
  mimik?: Mimik;
  breite?: number;
  hoehe?: number;
  viewBox?: string;
  /** Grünstich und K.o.-Gesicht für die Zombie-Woche */
  zombie?: boolean;
}

const K = "#1d1326"; // Konturfarbe wie bei den Bossen
const W = 3.2;       // Konturstärke

function mix(hex: string, ziel: string, t: number): string {
  const a = parseInt(hex.slice(1), 16), b = parseInt(ziel.slice(1), 16);
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
const dunkel = (h: string, t = 0.28) => mix(h, "#2a1030", t);
const hell = (h: string, t = 0.45) => mix(h, "#fff8e8", t);

const o = (fill: string, extra = "") => `fill="${fill}" stroke="${K}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round" ${extra}`;

// Gliedmaße: dicke Kontur + Füllung als zwei Striche
function glied(d: string, farbe: string, breite = 9): string {
  return `<path d="${d}" fill="none" stroke="${K}" stroke-width="${breite + W * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${hell(farbe, 0.5)}" stroke-width="2" stroke-linecap="round" opacity=".55" transform="translate(-2 -1.5)"/>`;
}

function faust(x: number, y: number, f: Figur, r = 8.5): string {
  // Handschuh/Faust mit Daumenwulst, Glanz und Zellschatten
  return `<g transform="translate(${x} ${y})">` +
    `<circle r="${r}" ${o(f.handschuh)}/>` +
    `<path d="M${-r * 0.2} ${r * 0.95} A${r} ${r} 0 0 0 ${r * 0.95} ${-r * 0.2} A${r * 0.9} ${r * 0.9} 0 0 1 ${-r * 0.2} ${r * 0.95}Z" fill="${dunkel(f.handschuh)}"/>` +
    `<path d="M${-r * 0.55} ${-r * 0.05} q${r * 0.5} ${-r * 0.35} ${r * 1.05} 0" fill="none" stroke="${K}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="${-r * 0.35}" cy="${-r * 0.45}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity=".75" transform="rotate(-30 ${-r * 0.35} ${-r * 0.45})"/>` +
    (f.bandage ? `<rect x="${-r * 0.75}" y="${r * 0.55}" width="${r * 1.5}" height="${r * 0.55}" rx="2" ${o(f.bandage)} stroke-width="2.2"/>` : "") +
    `</g>`;
}

const POSEN: Record<Pose, { l: Arm; r: Arm; mimik: Mimik; huepf: number; faustR?: number }> = {
  //            linke Schulter→Ellbogen→Faust,  rechte Schulter→Ellbogen→Faust
  bereit: { l: [[-18, 97], [-30, 110], [-20, 95]], r: [[18, 97], [30, 110], [20, 95]], mimik: "grimm", huepf: 0 },
  schlag: { l: [[-18, 97], [-30, 110], [-20, 95]], r: [[18, 95], [36, 84], [47, 60]], mimik: "schrei", huepf: -3, faustR: 11 },
  jubel: { l: [[-18, 95], [-36, 80], [-42, 50]], r: [[18, 95], [36, 80], [42, 50]], mimik: "freude", huepf: -6 },
  ko: { l: [[-18, 98], [-26, 114], [-28, 128]], r: [[18, 98], [26, 114], [28, 128]], mimik: "ko", huepf: 4 },
  ziehen: { l: [[-18, 98], [-30, 106], [-40, 104]], r: [[18, 98], [-6, 110], [-26, 106]], mimik: "schrei", huepf: 0 },
  klettern: { l: [[-18, 95], [-36, 82], [-44, 52]], r: [[18, 98], [28, 112], [24, 122]], mimik: "grimm", huepf: 0 },
};

function beine(f: Figur, pose: Pose): string {
  const s = f.schuh, h = f.hose;
  const sp = pose === "jubel" ? 3 : pose === "ko" ? 4 : 0;
  let d = "";
  d += glied(`M-9 120 L${-11 - sp} 143`, f.haut, 10);
  d += glied(`M9 120 L${11 + sp} 143`, f.haut, 10);
  if (f.socken) d += `<rect x="${-17 - sp}" y="134" width="12" height="8" rx="2" ${o(f.socken)} stroke-width="2.4"/><rect x="${5 + sp}" y="134" width="12" height="8" rx="2" ${o(f.socken)} stroke-width="2.4"/>`;
  // Schuhe
  for (const sx of [-1, 1]) {
    const x = sx * (12 + sp);
    d += `<path d="M${x - 9} 152 q0 -12 ${9} -12 q${9 + sx * 3} 0 ${10 + sx * 3} 10 q0 3 -3 3 h-${16 + sx * 0}Z" ${o(s)}/>`;
    d += `<path d="M${x - 9} 150 h${19 + sx * 3}" stroke="${hell(s, 0.75)}" stroke-width="2.5" fill="none"/>`;
    d += `<ellipse cx="${x - 2}" cy="${144}" rx="3" ry="1.6" fill="#fff" opacity=".7"/>`;
  }
  // Hose
  d += `<path d="M-21 108 L-22 126 Q-12 129 -2 125 L0 117 L2 125 Q12 129 22 126 L21 108Z" ${o(h)}/>`;
  d += `<path d="M10 110 L19 110 L20 125 Q15 127 11 126Z" fill="${dunkel(h)}"/>`;
  if (f.hosenstreifen) d += `<path d="M-19 110 L-20 124 M19 110 L20 124" stroke="${f.hosenstreifen}" stroke-width="3"/>`;
  return d;
}

function rumpf(f: Figur): string {
  const t = f.shirt;
  let d = "";
  // Oberkörper (leicht V-förmig, sportlich)
  d += `<path d="M-21 90 Q0 84 21 90 L19 112 Q0 116 -19 112Z" ${o(t)}/>`;
  d += `<path d="M9 89 Q16 89 21 90 L19 112 Q14 113 9 113 Q14 100 9 89Z" fill="${dunkel(t)}"/>`;
  d += `<path d="M-15 93 Q-16 100 -14 106" stroke="${hell(t, 0.6)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  if (f.tank) {
    // Tanktop: Schultern frei
    d += `<path d="M-21 90 Q-17 89 -14 89 Q-15 96 -20 100Z M21 90 Q17 89 14 89 Q15 96 20 100Z" fill="${f.haut}" stroke="${K}" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
  // Ausschnitt
  d += `<path d="M-7 88 Q0 95 7 88" ${o(f.haut)} stroke-width="2.4"/>`;
  if (f.kette) d += `<path d="M-8 89 Q0 99 8 89" fill="none" stroke="#f5b82e" stroke-width="2.6"/><circle cx="0" cy="97" r="2.8" ${o("#ffd54a")} stroke-width="1.8"/>`;
  if (f.streifen) d += `<path d="M-20 103 Q0 107 20 103" stroke="${f.streifen}" stroke-width="3.5" fill="none"/>`;
  // Brust-Emblem
  if (f.emblem) d += emblem(f.emblem, f.emblemFarbe || "#ffd54a");
  return d;
}

function emblem(art: string, farbe: string): string {
  const g = (p: string) => `<g transform="translate(0 102)">${p}</g>`;
  switch (art) {
    case "blitz": return g(`<path d="M2 -8 L-5 1 L0 1 L-2 8 L5 -1 L0 -1Z" ${o(farbe)} stroke-width="1.8"/>`);
    case "stern": return g(`<path d="M0 -7 L2 -2 L7 -2 L3 1.5 L4.5 7 L0 4 L-4.5 7 L-3 1.5 L-7 -2 L-2 -2Z" ${o(farbe)} stroke-width="1.8"/>`);
    case "hantel": return g(`<rect x="-7" y="-1.5" width="14" height="3" ${o(farbe)} stroke-width="1.6"/><rect x="-9" y="-5" width="3.5" height="10" rx="1" ${o(farbe)} stroke-width="1.6"/><rect x="5.5" y="-5" width="3.5" height="10" rx="1" ${o(farbe)} stroke-width="1.6"/>`);
    case "flamme": return g(`<path d="M0 -8 Q6 -2 4 3 Q3 7 0 7 Q-4 7 -5 3 Q-6 -1 -2 -3 Q-2 1 0 1 Q-1 -4 0 -8Z" ${o(farbe)} stroke-width="1.8"/>`);
    case "herz": return g(`<path d="M0 6 Q-8 0 -6 -4 Q-3 -8 0 -3 Q3 -8 6 -4 Q8 0 0 6Z" ${o(farbe)} stroke-width="1.8"/>`);
    case "welle": return g(`<path d="M-7 2 Q-4 -4 -1 1 Q2 6 6 -1" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M-7 2 Q-4 -4 -1 1 Q2 6 6 -1" fill="none" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round"/>`);
    case "rad": return g(`<circle r="6" ${o(farbe)} stroke-width="1.8"/><circle r="2" fill="${K}"/><path d="M0 -6V6M-6 0H6" stroke="${K}" stroke-width="1.2"/>`);
    case "totenkopf": return g(`<path d="M-6 0 Q-6 -7 0 -7 Q6 -7 6 0 Q6 3 3 4 V6 H-3 V4 Q-6 3 -6 0Z" ${o(farbe)} stroke-width="1.6"/><circle cx="-2.4" cy="-1" r="1.6" fill="${K}"/><circle cx="2.4" cy="-1" r="1.6" fill="${K}"/>`);
    case "zahl": return g(`<text y="4.5" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="900" font-size="12" fill="${farbe}" stroke="${K}" stroke-width="1.6" paint-order="stroke">1</text>`);
    case "krone": return g(`<path d="M-7 4 L-7 -4 L-3.5 0 L0 -6 L3.5 0 L7 -4 L7 4Z" ${o(farbe)} stroke-width="1.8"/>`);
    case "blatt": return g(`<path d="M-5 6 Q-7 -5 6 -7 Q7 5 -5 6Z" ${o(farbe)} stroke-width="1.8"/><path d="M-5 6 L3 -3" stroke="${K}" stroke-width="1.4"/>`);
    case "pfote": return g(`<ellipse cx="0" cy="2.5" rx="4.5" ry="3.8" ${o(farbe)} stroke-width="1.6"/><circle cx="-5" cy="-3" r="2" ${o(farbe)} stroke-width="1.4"/><circle cx="-1.7" cy="-5.5" r="2" ${o(farbe)} stroke-width="1.4"/><circle cx="1.7" cy="-5.5" r="2" ${o(farbe)} stroke-width="1.4"/><circle cx="5" cy="-3" r="2" ${o(farbe)} stroke-width="1.4"/>`);
  }
  return "";
}

function arme(f: Figur, p: { l: Arm; r: Arm }, seite: "l" | "r"): string {
  const [s, e, h] = p[seite];
  let d = "";
  const armFarbe = f.haut;
  d += glied(`M${s[0]} ${s[1]} L${e[0]} ${e[1]} L${h[0]} ${h[1]}`, armFarbe, 9);
  if (!f.tank) {
    // Ärmel
    const dx = (e[0] - s[0]) * 0.38, dy = (e[1] - s[1]) * 0.38;
    d += `<path d="M${s[0]} ${s[1]} L${s[0] + dx} ${s[1] + dy}" stroke="${K}" stroke-width="${14 + W * 2}" stroke-linecap="round"/><path d="M${s[0]} ${s[1]} L${s[0] + dx} ${s[1] + dy}" stroke="${f.shirt}" stroke-width="14" stroke-linecap="round"/>`;
  }
  if (f.schweissband) {
    const bx = e[0] + (h[0] - e[0]) * 0.62, by = e[1] + (h[1] - e[1]) * 0.62;
    d += `<circle cx="${bx}" cy="${by}" r="5.6" ${o(f.schweissband)} stroke-width="2.2"/>`;
  }
  return d;
}

function kopfClip(id: string): string {
  return `<clipPath id="${id}k"><ellipse cx="0" cy="56" rx="33" ry="31"/></clipPath>`;
}

function haareHinten(f: Figur): string {
  const c = f.haar, d = dunkel(c);
  switch (f.frisur) {
    case "pferdeschwanz": return `<path d="M22 40 Q48 36 46 64 Q44 84 34 92 Q38 72 28 58Z" ${o(c)}/><path d="M38 52 Q44 70 36 86" stroke="${d}" stroke-width="3" fill="none"/><rect x="21" y="38" width="9" height="9" rx="3" transform="rotate(20 25 42)" ${o(f.haarband || "#ff4d8d")} stroke-width="2.4"/>`;
    case "afro": return `<g ${o(c)}><circle cx="0" cy="38" r="36"/><circle cx="-30" cy="52" r="16"/><circle cx="30" cy="52" r="16"/><circle cx="-24" cy="24" r="16"/><circle cx="24" cy="24" r="16"/><circle cx="0" cy="12" r="18"/></g><g fill="${c}"><circle cx="0" cy="38" r="34"/></g><g fill="${d}" opacity=".6"><circle cx="18" cy="20" r="5"/><circle cx="30" cy="46" r="5"/><circle cx="-8" cy="10" r="4"/></g>`;
    case "zoepfe": return `<g>${[-1, 1].map((sx) => `<path d="M${sx * 28} 54 Q${sx * 38} 74 ${sx * 34} 100" fill="none" stroke="${K}" stroke-width="${12 + W * 2}" stroke-linecap="round"/><path d="M${sx * 28} 54 Q${sx * 38} 74 ${sx * 34} 100" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round"/>${[66, 78, 90].map((y) => `<path d="M${sx * 36 - 5} ${y} q5 4 10 0" stroke="${d}" stroke-width="2.4" fill="none"/>`).join("")}<circle cx="${sx * 34}" cy="102" r="4" ${o(f.haarband || "#ff4d8d")} stroke-width="2.2"/>`).join("")}</g>`;
    case "lang": return `<path d="M-34 52 Q-38 22 0 18 Q38 22 34 52 L36 96 Q24 100 22 88 L-22 88 Q-24 100 -36 96Z" ${o(c)}/><path d="M24 60 L28 92" stroke="${d}" stroke-width="3"/>`;
  }
  return "";
}

function haareVorne(f: Figur): string {
  const c = f.haar, d = dunkel(c), l = hell(c, 0.5);
  switch (f.frisur) {
    case "stachel":
      return `<path d="M-33 54 Q-36 40 -32 32 L-40 24 L-26 22 L-30 8 L-14 14 L-10 -2 L2 10 L10 -4 L14 12 L28 4 L26 20 L40 20 L32 32 Q36 42 33 54 Q30 40 22 36 Q4 44 -14 38 Q-26 38 -33 54Z" ${o(c)}/>` +
        `<path d="M14 14 L26 8 L24 22 L36 24 L30 34 Q28 36 22 36 Q20 26 14 14Z" fill="${d}"/><path d="M-24 30 L-26 22 M-8 22 L-9 14" stroke="${l}" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>`;
    case "pferdeschwanz": case "zoepfe": case "dutt":
      return `<path d="M-33 56 Q-36 22 0 22 Q36 22 33 56 Q30 42 20 36 Q8 30 -2 38 Q-12 30 -24 36 Q-31 44 -33 56Z" ${o(c)}/>` +
        `<path d="M8 28 Q28 30 31 50 Q26 38 14 34Z" fill="${d}"/><path d="M-22 30 Q-14 26 -6 27" stroke="${l}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
        (f.frisur === "dutt" ? `<circle cx="0" cy="16" r="12" ${o(c)}/><path d="M-6 10 Q0 6 6 10" stroke="${l}" stroke-width="2.5" fill="none"/><path d="M-10 22 Q0 28 10 22" stroke="${K}" stroke-width="2.4" fill="none"/>` : "");
    case "afro":
      return `<path d="M-32 50 Q-34 30 -20 26 Q-14 18 -4 24 Q4 16 14 24 Q26 20 30 32 Q36 40 32 50 Q26 36 14 36 Q0 40 -14 36 Q-26 36 -32 50Z" ${o(c)}/><g fill="${d}" opacity=".6"><circle cx="16" cy="30" r="3"/><circle cx="-12" cy="28" r="3"/></g>`;
    case "irokese":
      return `<path d="M-30 50 Q-34 34 -24 28 L-22 44Z M30 50 Q34 34 24 28 L22 44Z" fill="${dunkel(f.haut, 0.15)}" opacity=".5"/>` +
        `<path d="M-9 34 L-14 18 L-6 20 L-8 2 L0 8 L2 -10 L8 6 L14 0 L12 18 L18 16 L10 34 Q0 30 -9 34Z" ${o(c)}/><path d="M2 -6 L6 8 L12 4 L10 18 L14 18 L9 30 Q6 30 4 30Z" fill="${d}"/>`;
    case "locken":
      return `<g ${o(c)}><circle cx="-26" cy="40" r="10"/><circle cx="-16" cy="28" r="11"/><circle cx="0" cy="24" r="12"/><circle cx="16" cy="28" r="11"/><circle cx="26" cy="40" r="10"/></g><g fill="${c}"><ellipse cx="0" cy="36" rx="26" ry="9"/></g><g fill="${l}" opacity=".7"><circle cx="-16" cy="25" r="3"/><circle cx="-1" cy="20" r="3"/></g><g fill="${d}"><circle cx="20" cy="32" r="4"/><circle cx="28" cy="44" r="4"/></g>`;
    case "scheitel":
      return `<path d="M-33 56 Q-38 20 4 20 Q38 22 33 54 Q30 38 18 34 Q-6 34 -24 46 Q-30 50 -33 56Z" ${o(c)}/><path d="M-26 40 Q-8 26 20 30" stroke="${l}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 30 Q30 32 31 48 Q26 38 14 36Z" fill="${d}"/>`;
    case "opa":
      return `<g ${o(c)}><path d="M-34 60 Q-38 44 -28 38 Q-24 48 -26 60Z"/><path d="M34 60 Q38 44 28 38 Q24 48 26 60Z"/></g><path d="M-6 26 q4 -8 2 -14 M2 26 q2 -6 6 -9" stroke="${K}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case "kurz":
      return `<path d="M-32 52 Q-36 24 0 22 Q36 24 32 52 Q30 38 22 34 L-22 34 Q-30 38 -32 52Z" ${o(c)}/><path d="M12 26 Q30 30 31 46 Q26 36 16 34Z" fill="${d}"/>`;
    case "lang":
      return `<path d="M-33 58 Q-36 22 0 22 Q36 22 33 58 Q28 40 10 34 Q4 42 -6 36 Q-24 38 -33 58Z" ${o(c)}/><path d="M-24 34 Q-12 28 -2 30" stroke="${l}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  return "";
}

function kopf(f: Figur, mimik: Mimik, id: string): string {
  const hautD = dunkel(f.haut, 0.22);
  let d = "";
  // Ohren
  d += `<ellipse cx="-32" cy="60" rx="6.5" ry="8" ${o(f.haut)}/><ellipse cx="32" cy="60" rx="6.5" ry="8" ${o(f.haut)}/>`;
  d += `<path d="M30 56 q4 3 0 8" stroke="${hautD}" stroke-width="2.4" fill="none"/>`;
  d += `<ellipse cx="0" cy="56" rx="33" ry="31" ${o(f.haut)}/>`;
  // Zellschatten rechts + Kinn
  d += `<g clip-path="url(#${id}k)"><path d="M14 20 Q40 40 30 76 Q20 92 -10 90 Q22 80 22 56 Q24 34 14 20Z" fill="${hautD}" opacity=".85"/></g>`;
  d += `<ellipse cx="-15" cy="38" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 -15 38)"/>`;
  if (f.bart) d += bart(f);
  // Wangen
  d += `<ellipse cx="-20" cy="69" rx="6" ry="3.5" fill="#ff5f6d" opacity=".35"/><ellipse cx="20" cy="69" rx="6" ry="3.5" fill="#ff5f6d" opacity=".3"/>`;
  d += gesicht(f, mimik);
  return d;
}

function bart(f: Figur): string {
  const c = f.bartFarbe || f.haar;
  if (f.bart === "voll") return `<path d="M-31 60 Q-30 92 0 96 Q30 92 31 60 Q24 70 14 72 Q0 66 -14 72 Q-24 70 -31 60Z" ${o(c)}/><path d="M14 74 Q24 74 30 64 Q28 86 10 92Z" fill="${dunkel(c)}"/><path d="M-20 80 q4 4 8 4 M-4 88 q4 2 8 0" stroke="${hell(c, 0.5)}" stroke-width="2.2" fill="none"/>`;
  if (f.bart === "stoppel") return `<path d="M-28 66 Q-24 90 0 92 Q24 90 28 66 Q20 82 0 84 Q-20 82 -28 66Z" fill="${dunkel(f.haut, 0.35)}" opacity=".45"/>`;
  return "";
}

function schnauzer(f: Figur): string {
  if (!f.schnauzer) return "";
  const c = f.bartFarbe || f.haar;
  return `<path d="M0 70 Q-8 64 -16 68 Q-22 72 -24 66 Q-22 76 -12 76 Q-4 76 0 72 Q4 76 12 76 Q22 76 24 66 Q22 72 16 68 Q8 64 0 70Z" ${o(c)} stroke-width="2.6"/>`;
}

function gesicht(f: Figur, mimik: Mimik): string {
  let d = "";
  const brille = f.brille;
  const augen = (dx: number, dy: number) => [-1, 1].map((s) =>
    `<ellipse cx="${s * 12}" cy="58" rx="7" ry="8.5" ${o("#fff")} stroke-width="2.6"/>` +
    `<circle cx="${s * 12 + dx}" cy="${59 + dy}" r="4" fill="${f.augen || K}"/><circle cx="${s * 12 + dx}" cy="${59 + dy}" r="2" fill="${K}"/>` +
    `<circle cx="${s * 12 + dx - 1.5}" cy="${57.5 + dy}" r="1.4" fill="#fff"/>`).join("");
  const brauen = (wut: number) => [-1, 1].map((s) =>
    `<path d="M${s * 20} ${47 - wut} Q${s * 13} ${45 - wut * 1.6} ${s * 5} ${48 + wut}" fill="none" stroke="${K}" stroke-width="4.4" stroke-linecap="round"/>`).join("");
  const nase = `<path d="M-2 64 Q2 67 4 64" fill="none" stroke="${dunkel(f.haut, 0.4)}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (mimik === "grimm") {
    d += brille === "sonne" ? "" : augen(1, 1) + brauen(3);
    d += nase;
    // selbstbewusstes Grinsen mit Zähnen
    d += `<path d="M-11 73 Q0 80 12 71 Q10 81 0 82 Q-9 81 -11 73Z" ${o("#7a1428")} stroke-width="2.6"/><path d="M-9 74 Q0 79 10 72 L9 75 Q0 80 -8 76Z" fill="#fff"/>`;
  } else if (mimik === "schrei") {
    d += brille === "sonne" ? "" : [-1, 1].map((s) => `<path d="M${s * 18} 56 Q${s * 12} 52 ${s * 6} 58 Q${s * 12} 64 ${s * 18} 56Z" ${o("#fff")} stroke-width="2.6"/><circle cx="${s * 11}" cy="58" r="2.6" fill="${K}"/>`).join("") + brauen(5);
    d += nase;
    d += `<path d="M-12 70 Q0 66 12 70 Q12 86 0 88 Q-12 86 -12 70Z" ${o("#7a1428")} stroke-width="2.6"/><path d="M-10 71 Q0 68 10 71 L9 74 Q0 72 -9 74Z" fill="#fff"/><path d="M-6 84 Q0 78 6 84 Q0 87 -6 84Z" fill="#ff6f8a"/>`;
  } else if (mimik === "freude") {
    d += brille === "sonne" ? "" : [-1, 1].map((s) => `<path d="M${s * 18} 61 Q${s * 12} 50 ${s * 6} 61" fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`).join("") + [-1, 1].map((s) => `<path d="M${s * 19} 46 Q${s * 13} 41 ${s * 6} 45" fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`).join("");
    d += nase;
    d += `<path d="M-13 70 Q0 72 13 70 Q12 86 0 87 Q-12 86 -13 70Z" ${o("#7a1428")} stroke-width="2.6"/><path d="M-11 71 Q0 73 11 71 L10 74 Q0 76 -10 74Z" fill="#fff"/><path d="M-6 84 Q0 78 6 84 Q0 87 -6 84Z" fill="#ff6f8a"/>`;
  } else if (mimik === "ko") {
    d += [-1, 1].map((s) => `<path d="M${s * 12 - 5} 53 l10 10 M${s * 12 + 5} 53 l-10 10" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`).join("");
    d += nase;
    d += `<path d="M-10 77 q3 -4 6 0 q3 4 6 0 q3 -4 6 0" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M5 78 q3 6 0 9 q-3 -3 0 -9Z" fill="#ff6f8a" stroke="${K}" stroke-width="1.6"/>`;
  }
  d += schnauzer(f);
  if (brille === "rund" && mimik !== "ko") d += `<g fill="none" stroke="${K}" stroke-width="2.8"><circle cx="-12" cy="58" r="10"/><circle cx="12" cy="58" r="10"/><path d="M-2 57 Q0 55 2 57 M-22 56 L-31 54 M22 56 L31 54"/></g><g fill="#bfe8ff" opacity=".25"><circle cx="-12" cy="58" r="9"/><circle cx="12" cy="58" r="9"/></g>`;
  if (brille === "sonne" && mimik !== "ko") d += `<path d="M-30 52 L30 52 Q30 66 18 66 Q8 66 4 56 L-4 56 Q-8 66 -18 66 Q-30 66 -30 52Z" ${o(f.brillenFarbe || "#1f2a44")}/><path d="M-24 55 L-16 55 M8 55 L16 55" stroke="#9fe8ff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/><path d="M-18 44 Q-11 41 -4 44 M18 44 Q11 41 4 44" fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`;
  return d;
}

function aufsatz(f: Figur): string {
  const a = f.kopf;
  if (!a) return "";
  const c = f.kopfFarbe || "#e8423a";
  switch (a) {
    case "stirnband":
      return `<path d="M-33 44 Q0 30 33 44 L32 52 Q0 38 -32 52Z" ${o(c)}/><path d="M-32 46 Q-44 40 -50 48 Q-42 50 -38 56 Q-36 50 -32 50Z M-33 48 Q-42 56 -40 64 Q-36 58 -31 54Z" ${o(c)} stroke-width="2.6"/><path d="M-20 41 Q0 34 20 41" stroke="${hell(c, 0.6)}" stroke-width="2" fill="none"/>`;
    case "cap":
      return `<path d="M-34 46 Q-36 14 0 12 Q36 14 34 46 Q0 38 -34 46Z" ${o(c)}/><path d="M10 14 Q34 18 34 44 Q28 40 22 40 Q24 24 10 14Z" fill="${dunkel(c)}"/><path d="M-38 46 Q0 34 38 46 Q42 52 34 54 Q0 44 -34 54 Q-42 52 -38 46Z" ${o(f.kopfFarbe2 || dunkel(c, 0.15))}/><circle cx="0" cy="13" r="3.5" ${o(c)} stroke-width="2"/><path d="M-6 22 L6 22 L4 34 L-4 34Z" ${o("#fff")} stroke-width="2"/><text x="0" y="32" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="900" font-size="9" fill="${c}">B</text>`;
    case "helm":
      return `<path d="M-36 48 Q-38 10 0 8 Q38 10 36 48 Q20 40 0 40 Q-20 40 -36 48Z" ${o(c)}/><path d="M-12 12 L-14 38 M0 9 L0 38 M12 12 L14 38" stroke="${K}" stroke-width="3"/><path d="M-26 22 Q-20 14 -12 12 L-14 38 Q-22 38 -28 42Z" fill="${hell(c, 0.4)}"/><path d="M14 12 Q34 16 36 46 Q26 40 14 38Z" fill="${dunkel(c)}"/><path d="M-36 48 Q0 36 36 48" fill="none" stroke="${K}" stroke-width="3"/>`;
    case "wikinger":
      return `<path d="M-30 30 Q-52 24 -50 2 Q-42 14 -28 18Z" ${o("#f6ecd2")}/><path d="M30 30 Q52 24 50 2 Q42 14 28 18Z" ${o("#f6ecd2")}/><path d="M-46 6 Q-42 14 -32 18 M46 6 Q42 14 32 18" stroke="${dunkel("#f6ecd2", 0.3)}" stroke-width="3" fill="none"/>` +
        `<path d="M-35 46 Q-36 12 0 10 Q36 12 35 46 Q0 36 -35 46Z" ${o("#aeb8c6")}/><path d="M12 12 Q36 16 35 44 Q26 40 18 39Z" fill="#7b8596"/><path d="M-35 46 Q0 36 35 46 L34 52 Q0 42 -34 52Z" ${o("#c58b2a")}/><path d="M-4 10 L-4 40 L4 40 L4 10" ${o("#c58b2a")} stroke-width="2.6"/><circle cx="-20" cy="46" r="1.8" fill="${K}"/><circle cx="20" cy="46" r="1.8" fill="${K}"/><ellipse cx="-18" cy="24" rx="6" ry="3" fill="#fff" opacity=".6" transform="rotate(-30 -18 24)"/>`;
    case "badekappe":
      return `<path d="M-34 52 Q-38 14 0 12 Q38 14 34 52 Q20 42 0 42 Q-20 42 -34 52Z" ${o(c)}/><path d="M12 15 Q36 20 34 50 Q28 44 20 42Z" fill="${dunkel(c)}"/><ellipse cx="-14" cy="22" rx="8" ry="4" fill="#fff" opacity=".55" transform="rotate(-25 -14 22)"/>` +
        `<path d="M-33 40 L33 40" stroke="${K}" stroke-width="6"/><path d="M-33 40 L33 40" stroke="#ff9f1a" stroke-width="3"/><g ${o("#5fd8ff")} stroke-width="2.6"><ellipse cx="-11" cy="38" rx="9" ry="7"/><ellipse cx="11" cy="38" rx="9" ry="7"/></g><path d="M-14 35 l4 0 M8 35 l4 0" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
    case "muetze":
      return `<path d="M-34 48 Q-36 10 0 8 Q36 10 34 48Z" ${o(c)}/><path d="M-20 14 L-22 44 M-8 10 L-8 44 M6 10 L6 44 M20 14 L22 44" stroke="${dunkel(c)}" stroke-width="2.5"/><path d="M-36 44 Q0 36 36 44 L36 54 Q0 46 -36 54Z" ${o(f.kopfFarbe2 || "#fff")}/><circle cx="0" cy="4" r="9" ${o(f.kopfFarbe2 || "#fff")}/>`;
  }
  return "";
}

function sterne(): string {
  const stern = (x: number, y: number, s: number) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -7 L2 -2 L7 -2 L3 1.5 L4.5 7 L0 4 L-4.5 7 L-3 1.5 L-7 -2 L-2 -2Z" ${o("#ffd54a")} stroke-width="1.8"/>`;
  return `<ellipse cx="0" cy="20" rx="30" ry="7" fill="none" stroke="#ffd54a" stroke-width="2" stroke-dasharray="4 5" opacity=".9"/>` + stern(-24, 18, 1) + stern(10, 26, 0.8) + stern(26, 15, 0.9);
}

export function figurSvg(f: Figur, pose: Pose = "bereit", opt: FigurOptionen = {}): string {
  const id = opt.id ?? "f";
  // Individuelle Mimik bleibt für eigene Baukastenfiguren verfügbar.
  const illustration = opt.mimik ? null : arcadeSpieler(FIGUREN.indexOf(f), pose, id);
  if (illustration) {
    const w = opt.breite ? ` width="${opt.breite}"` : "";
    const h = opt.hoehe ? ` height="${opt.hoehe}"` : "";
    const filter = opt.zombie ? ` filter="url(#${id}z)"` : "";
    const defs = opt.zombie ? `<defs><filter id="${id}z"><feColorMatrix type="matrix" values=".45 .45 .1 0 0  .55 .75 .15 0 .05  .2 .35 .2 0 0  0 0 0 1 0"/></filter></defs>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${opt.viewBox || "-58 -12 116 172"}"${w}${h} role="img" aria-label="${f.name}" class="bz-spieler-illustriert">${defs}<g class="bz-spieler"${filter}>${illustration}</g></svg>`;
  }
  const p = POSEN[pose];
  const mimik = opt.mimik || p.mimik;
  const r = p.faustR || 8.5;
  let inner = "";
  inner += haareHinten(f);
  inner += beine(f, pose);
  // Arm hinter dem Körper zuerst (bei Zug-Pose beide vorne)
  inner += arme(f, p, "l");
  inner += rumpf(f);
  inner += arme(f, p, "r");
  inner += kopf(f, mimik, id);
  inner += haareVorne(f);
  inner += aufsatz(f);
  if (pose === "ko") inner += sterne();
  inner += faust(p.l[2][0], p.l[2][1], f, 8.5);
  inner += faust(p.r[2][0], p.r[2][1], f, r);
  if (pose === "schlag") inner += `<g stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"><path d="M36 76 L30 90"/><path d="M44 80 L40 94"/><path d="M54 70 L58 82"/></g>`;
  const neig = pose === "ko" ? ` rotate(-8 0 150)` : "";
  const view = opt.viewBox || "-58 -12 116 172";
  const w = opt.breite ? ` width="${opt.breite}"` : "";
  const h = opt.hoehe ? ` height="${opt.hoehe}"` : "";
  const filter = opt.zombie ? ` filter="url(#${id}z)"` : "";
  const defs = kopfClip(id) + (opt.zombie ? `<filter id="${id}z"><feColorMatrix type="matrix" values=".45 .45 .1 0 0  .55 .75 .15 0 .05  .2 .35 .2 0 0  0 0 0 1 0"/></filter>` : "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}"${w}${h} overflow="visible"><defs>${defs}</defs><g class="bz-spieler"${filter} transform="translate(0 ${p.huepf})${neig}">${inner}</g></svg>`;
}

// Die 12 Startfiguren – frei zuteilbar, jede aus Baukasten-Teilen
export const FIGUREN: readonly Figur[] = [
  { name: "Der Pumper", haut: "#f2c08f", frisur: "stachel", haar: "#2b1d16", kopf: "stirnband", kopfFarbe: "#e8423a", shirt: "#e8423a", tank: true, hose: "#1f2a44", schuh: "#f4f1ea", handschuh: "#e8423a", emblem: "hantel", emblemFarbe: "#ffd54a", bart: "stoppel" },
  { name: "Die Rakete", haut: "#ffd9b8", frisur: "pferdeschwanz", haar: "#ffcf3a", haarband: "#ff4d8d", shirt: "#18c3b5", hose: "#2b2d6e", schuh: "#ff4d8d", handschuh: "#ff4d8d", emblem: "blitz", emblemFarbe: "#ffe14a", schweissband: "#fff" },
  { name: "Der Bär", haut: "#e9b48a", frisur: "kurz", haar: "#5a3720", bart: "voll", bartFarbe: "#6b3f22", shirt: "#3f7f3a", tank: true, hose: "#2a2a2a", schuh: "#333", handschuh: "#c8952a", bandage: "#f4f1ea", emblem: "pfote", emblemFarbe: "#f6d38a" },
  { name: "Der Radprofi", haut: "#c98a5e", frisur: "kurz", haar: "#1b1410", kopf: "helm", kopfFarbe: "#ffcc1a", brille: "sonne", shirt: "#ffcc1a", streifen: "#1d4ed8", hose: "#1b1b1b", schuh: "#1d4ed8", handschuh: "#1d4ed8", emblem: "rad", emblemFarbe: "#fff", hosenstreifen: "#ffcc1a" },
  { name: "Die Zen-Meisterin", haut: "#8a5534", frisur: "dutt", haar: "#1e1210", shirt: "#9b5de5", hose: "#3a2a5e", schuh: "#f4f1ea", handschuh: "#f15bb5", emblem: "blatt", emblemFarbe: "#7bd389", kette: true },
  { name: "Der Kapitän", haut: "#ffd2a8", frisur: "kurz", haar: "#8a4a1e", kopf: "cap", kopfFarbe: "#2e6bd8", kopfFarbe2: "#1d3f8a", shirt: "#f4f1ea", streifen: "#2e6bd8", hose: "#2e6bd8", schuh: "#e8423a", handschuh: "#2e6bd8", emblem: "stern", emblemFarbe: "#e8423a", bart: "stoppel" },
  { name: "Die Wasserratte", haut: "#f6c9a0", frisur: "kurz", haar: "#3a2416", kopf: "badekappe", kopfFarbe: "#ff4d6d", shirt: "#0aa3d8", hose: "#073b6b", schuh: "#ffd23f", handschuh: "#ffd23f", emblem: "welle", emblemFarbe: "#bff3ff" },
  { name: "Opa Turbo", haut: "#f0bf96", frisur: "opa", haar: "#e6e6ea", schnauzer: true, bartFarbe: "#e6e6ea", brille: "rund", shirt: "#c0392b", hose: "#4b4b55", schuh: "#f4f1ea", socken: "#fff", handschuh: "#f39c12", emblem: "zahl", emblemFarbe: "#ffd54a", schweissband: "#f39c12" },
  { name: "Der Punk", haut: "#ffdcc0", frisur: "irokese", haar: "#3ee05a", shirt: "#1b1b22", tank: true, hose: "#5b2a86", schuh: "#d83b3b", handschuh: "#1b1b22", bandage: "#d83b3b", emblem: "totenkopf", emblemFarbe: "#f4f1ea", kette: true },
  { name: "Die Läuferin", haut: "#6e4128", frisur: "afro", haar: "#22140e", kopf: "stirnband", kopfFarbe: "#ff9f1a", shirt: "#ff9f1a", hose: "#1b1b22", schuh: "#7cf05a", handschuh: "#7cf05a", emblem: "flamme", emblemFarbe: "#ffe14a", schweissband: "#ff9f1a" },
  { name: "Der Wikinger", haut: "#f5c7a1", frisur: "lang", haar: "#d8642a", kopf: "wikinger", bart: "voll", bartFarbe: "#d8642a", shirt: "#7a5232", tank: true, hose: "#3f3f46", schuh: "#5a3a22", handschuh: "#8b5a2b", bandage: "#c9c2b0", emblem: "krone", emblemFarbe: "#ffd54a" },
  { name: "Die Boxerin", haut: "#b87a4b", frisur: "zoepfe", haar: "#2a1a12", haarband: "#ffd23f", shirt: "#ff4d8d", tank: true, hose: "#ffd23f", schuh: "#f4f1ea", handschuh: "#d81b3a", emblem: "herz", emblemFarbe: "#fff", hosenstreifen: "#ff4d8d" },
];
