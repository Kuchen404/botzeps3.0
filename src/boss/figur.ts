import type { BossStufe } from "../scoring/boss.js";

/**
 * Gezeichnete Bosse als SVG im Cartoon-Stil: geschwungene Formen mit Schatten unten rechts,
 * Licht oben links und kräftiger Tuschelinie. Stufe 1 hat Ärmchen und guckt überheblich,
 * Stufe 2 ist aufgepumpt. Jeder Boss hat eigene Armformen, Posen, Muskelmuster, Hände,
 * einen Gegenstand in der Hand, ein Gewicht zum Thema und eigene Effekte um sich herum. Koordinaten 0..240 (Stufe 2 ragt etwas hinaus), siehe `bossSvg`.
 */

const LINIE = "#231815";

/** Mischt eine Hex-Farbe mit Schwarz (t < 0) oder Weiß (t > 0). */
function mische(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(kanal);
  return `#${((1 << 24) | (r! << 16) | (g! << 8) | b!).toString(16).slice(1)}`;
}

/** Zeichenkontext: vergibt eindeutige ids für Masken, damit mehrere Bosse auf einer Seite gehen. */
class Stift {
  private n = 0;
  /** Farbiges Gegenlicht unten rechts (Stufe 2 im Schein der Aura) */
  rand: string | null = null;
  constructor(private readonly praefix: string) {}

  /** Weicher Schlagschatten der Fläche auf das, was dahinter liegt (Arme auf dem Körper). */
  wurf(d: string): string {
    return `<path d="${d}" fill="#1a0a08" opacity=".32" transform="translate(5 7)" filter="url(#${this.praefix}w)"/>`;
  }

  /** Weichzeichner für die Schattierungsmasken; muss einmal pro Zeichnung in die Ausgabe. */
  defs(): string {
    return `<filter id="${this.praefix}w" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.6"/></filter>`;
  }

  /**
   * Fläche wie mit Pinsel und Tusche: weicher Schatten unten rechts mit dunklerem Kern,
   * Licht und Glanzkante oben links, Umriss unten rechts dick und oben links dünn.
   */
  form(d: string, farbe: string, o: { linie?: number; schatten?: number; licht?: number } = {}): string {
    const id = `${this.praefix}m${++this.n}`;
    const linie = o.linie ?? 3.4;
    const maske = (name: string, verschiebung: string, weich: boolean) =>
      `<mask id="${id}${name}" maskUnits="userSpaceOnUse" x="-200" y="-200" width="700" height="700"><rect x="-200" y="-200" width="700" height="700" fill="#fff"/><path d="${d}" transform="translate(${verschiebung})" fill="#000"${weich ? ` filter="url(#${this.praefix}w)"` : ""}/></mask>`;
    const schatten = o.schatten ?? -0.22;
    return (
      maske("s", "-9 -8", true) +
      maske("k", "-20 -18", true) +
      maske("l", "6 7", true) +
      maske("g", "2.2 2.8", false) +
      (this.rand ? maske("r", "-2.6 -3.2", false) : "") +
      `<path d="${d}" fill="${LINIE}" stroke="${LINIE}" stroke-width="${linie}" stroke-linejoin="round" transform="translate(${linie * 0.38} ${linie * 0.5})"/>` +
      `<path d="${d}" fill="${farbe}"/>` +
      `<path d="${d}" fill="${mische(farbe, schatten)}" mask="url(#${id}s)"/>` +
      `<path d="${d}" fill="${mische(farbe, schatten * 1.6)}" opacity=".3" mask="url(#${id}k)"/>` +
      `<path d="${d}" fill="${mische(farbe, 0.5)}" opacity="${o.licht ?? 0.7}" mask="url(#${id}l)"/>` +
      `<path d="${d}" fill="#fff" opacity="${(o.licht ?? 0.7) * 0.55}" mask="url(#${id}g)"/>` +
      (this.rand ? `<path d="${d}" fill="${this.rand}" opacity=".6" mask="url(#${id}r)"/>` : "") +
      `<path d="${d}" fill="none" stroke="${LINIE}" stroke-width="${linie * 0.62}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
  }

  /** Inhalt nur innerhalb der Fläche `d` zeichnen (Muster auf Armen). */
  clip(d: string, inhalt: string): string {
    const id = `${this.praefix}c${++this.n}`;
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inhalt}</g>`;
  }
}

/** Linie ohne Fläche (Falten, Adern, Knöchel). */
const strich = (d: string, breite = 2.4, farbe = LINIE) =>
  `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Augen als leicht schräge Ellipsen; böse mit roter Iris und Brauen, sonst halb geschlossen. */
function augen(x1: number, x2: number, y: number, wut: boolean, r = 9): string {
  const iris = wut ? "#d9141c" : LINIE;
  const auge = (x: number, seite: 1 | -1) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.12}" transform="rotate(${seite * 8} ${x} ${y})" fill="#fffdf6" stroke="${LINIE}" stroke-width="2.6"/>` +
    `<circle cx="${x - seite * r * 0.25}" cy="${y + r * 0.15}" r="${r * 0.48}" fill="${iris}"/>` +
    `<circle cx="${x - seite * r * 0.25 + r * 0.18}" cy="${y - r * 0.05}" r="${r * 0.14}" fill="#fff"/>`;
  const brauen = wut
    ? `<path d="M${x1 - r - 4} ${y - r - 8} Q${x1} ${y - r - 6} ${x1 + r + 3} ${y - r + 3} L${x1 + r + 1} ${y - r - 3} Q${x1 - 2} ${y - r - 12} ${x1 - r - 4} ${y - r - 8} Z M${x2 + r + 4} ${y - r - 8} Q${x2} ${y - r - 6} ${x2 - r - 3} ${y - r + 3} L${x2 - r - 1} ${y - r - 3} Q${x2 + 2} ${y - r - 12} ${x2 + r + 4} ${y - r - 8} Z" fill="${LINIE}" stroke="${LINIE}" stroke-width="2" stroke-linejoin="round"/>`
    : `<path d="M${x1 - r - 1} ${y - 1} Q${x1} ${y - r * 1.5} ${x1 + r + 1} ${y - 2} Q${x1} ${y - r * 0.45} ${x1 - r - 1} ${y - 1} Z M${x2 - r - 1} ${y - 2} Q${x2} ${y - r * 1.5} ${x2 + r + 1} ${y - 1} Q${x2} ${y - r * 0.45} ${x2 - r - 1} ${y - 2} Z" fill="${LINIE}" opacity=".9"/>`;
  return auge(x1, 1) + auge(x2, -1) + brauen;
}

/** Fieses Grinsen (Stufe 1) oder brüllendes Maul mit Zähnen (Stufe 2). */
function mund(x: number, y: number, b: number, wut: boolean): string {
  if (!wut) {
    return (
      `<path d="M${x - b / 2} ${y - 2} Q${x - b / 6} ${y + b * 0.42} ${x + b / 2} ${y - 6}" fill="none" stroke="${LINIE}" stroke-width="3.6" stroke-linecap="round"/>` +
      strich(`M${x + b / 2 - 3} ${y - 9} q5 1 6 6`, 2.4)
    );
  }
  const h = b * 0.5;
  const maul = `M${x - b / 2} ${y} Q${x - b / 4} ${y - 5} ${x} ${y - 3} Q${x + b / 4} ${y - 5} ${x + b / 2} ${y} Q${x + b / 3} ${y + h * 1.5} ${x} ${y + h * 1.4} Q${x - b / 3} ${y + h * 1.5} ${x - b / 2} ${y} Z`;
  const zaehne = [-0.3, -0.1, 0.1, 0.3]
    .map((t) => `<path d="M${x + t * b - 4} ${y - 2} l4 ${h * 0.5} l4 ${-h * 0.5} Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.2" stroke-linejoin="round"/>`)
    .join("");
  const zunge = `<path d="M${x - b / 5} ${y + h * 1.2} Q${x} ${y + h * 0.7} ${x + b / 5} ${y + h * 1.2} Q${x} ${y + h * 1.45} ${x - b / 5} ${y + h * 1.2} Z" fill="#e85a6b"/>`;
  return `<path d="${maul}" fill="#4a0a10" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>${zunge}${zaehne}`;
}

/** Zottelige Umrisslinie (Fell) um eine Ellipse; `zipfel` ist die Länge der Büschel relativ zum Radius. */
function zottel(cx: number, cy: number, rx: number, ry: number, n: number, zipfel: number): string {
  const pt = (w: number, f: number) => `${(cx + Math.cos(w) * rx * f).toFixed(1)} ${(cy + Math.sin(w) * ry * f).toFixed(1)}`;
  let d = `M${pt(0, 1)}`;
  for (let i = 0; i < n; i++) {
    const w0 = (i / n) * Math.PI * 2;
    const w1 = ((i + 0.6) / n) * Math.PI * 2;
    const w2 = ((i + 1) / n) * Math.PI * 2;
    const lang = 1 + zipfel * (i % 3 === 0 ? 1.3 : 1);
    d += ` Q${pt(w0 + 0.05, 1 + zipfel * 0.5)} ${pt(w1, lang)} Q${pt(w1, 1.02)} ${pt(w2, 1)}`;
  }
  return d + " Z";
}

/** Gegenstand in einer Hand; Ursprung ist die Hand bzw. Faust. */
type Ding = (st: Stift) => string;

interface Figur {
  haut: string;
  /** Schultern links und rechts */
  schulter: readonly [number, number, number, number];
  koerper: (st: Stift, wut: boolean) => string;
  /** Gewicht in der rechten Faust (Stufe 2); Ursprung ist die Faust */
  gewicht: Ding;
  extra?: (st: Stift) => string;
  /** Stufe 1: Ärmchen links und rechts, Hand und was die linke Hand hält */
  aermchen: { form: readonly [ArmForm, ArmForm]; hand: Hand; ding?: Ding; farbe?: string };
  /** Stufe 2: Pose je Arm, Muster auf den Muskeln, Faust und was die linke Faust hält */
  pump: { pose: readonly [Pose, Pose]; muster: Muster; hand: Hand; ding: Ding; farbe?: string };
  /** Stufe 2: was um den Boss herumfliegt (statt Dampf) */
  rage: (st: Stift) => string;
  /** Farbe der Aura hinter Stufe 2 */
  aura: string;
  schwitzt?: boolean;
}

type ArmForm = "haengen" | "huefte" | "stock" | "lang";
type Pose = "bizeps" | "stemmen" | "haengen";
type Hand = "faust" | "huf" | "krallen" | "handschuh";
interface Muster {
  art: "adern" | "haare" | "fell" | "naehte" | "knister" | "aermel";
  farbe: string;
}

/** Kreis als Pfad, damit er durch `Stift.form` gehen kann. */
function kreis(x: number, y: number, r: number): string {
  const k = r * 0.55;
  return `M${x} ${y - r} C${x + k} ${y - r} ${x + r} ${y - k} ${x + r} ${y} C${x + r} ${y + k} ${x + k} ${y + r} ${x} ${y + r} C${x - k} ${y + r} ${x - r} ${y + k} ${x - r} ${y} C${x - r} ${y - k} ${x - k} ${y - r} ${x} ${y - r} Z`;
}

/** Faust: Fingerknöchel oben, Daumen quer davor; `r` ist der ungefähre Radius. */
function faust(st: Stift, haut: string, r: number): string {
  const k = r / 13;
  const p = (t: string) => t.replace(/-?\d+(\.\d+)?/g, (z) => String(Math.round(Number(z) * k * 10) / 10));
  return (
    st.form(p("M-12 6 C-14 -2 -13 -10 -8 -13 C-5 -15 -2 -14 -1 -12 C1 -15 5 -15 6 -12 C8 -14 12 -13 12 -9 C14 -4 13 4 10 8 C6 13 -6 14 -12 6 Z"), haut, { linie: 2.6 }) +
    strich(p("M-1 -12 L-1.5 -6 M6 -12 L5.5 -6"), 1.6) +
    st.form(p("M-12 4 C-8 -1 0 -2 6 0 C8 1 8 4 5 5 C0 4 -6 6 -10 9 Z"), haut, { linie: 2 })
  );
}

/**
 * Hand bzw. Faust, Knöchel zeigen nach oben (−y), gedreht um `winkel`.
 * Huf und Krallen machen aus der Hand etwas Tierisches, der Handschuh ist für Comicärmchen.
 */
function hand(st: Stift, typ: Hand, haut: string, x: number, y: number, r: number, winkel: number): string {
  let inhalt: string;
  switch (typ) {
    case "huf":
      inhalt =
        st.form(`M${-r} ${r * 0.3} C${-r * 1.1} ${-r * 1.2} ${r * 1.1} ${-r * 1.2} ${r} ${r * 0.3} C${r * 0.6} ${r * 1.1} ${-r * 0.6} ${r * 1.1} ${-r} ${r * 0.3} Z`, "#6b3b45", { linie: 2.4 }) +
        strich(`M0 ${-r * 0.85} L0 ${r * 0.2}`, 2.4);
      break;
    case "krallen":
      inhalt =
        [-0.6, 0, 0.6]
          .map((t) => st.form(`M${t * r - 3} ${-r * 0.6} Q${t * r - 3} ${-r * 1.9} ${t * r + 3} ${-r * 2.1} Q${t * r + 1} ${-r * 1.3} ${t * r + 3.5} ${-r * 0.6} Z`, "#efe6cf", { linie: 1.8 }))
          .join("") + faust(st, haut, r);
      break;
    case "handschuh":
      inhalt =
        faust(st, "#fffdf6", r) +
        st.form(`M${-r * 0.8} ${r * 0.75} Q0 ${r * 0.55} ${r * 0.8} ${r * 0.75} L${r * 0.75} ${r * 1.35} Q0 ${r * 1.2} ${-r * 0.75} ${r * 1.35} Z`, "#fffdf6", { linie: 2 });
      break;
    default:
      inhalt = faust(st, haut, r);
  }
  return `<g transform="translate(${x} ${y}) rotate(${winkel})">${inhalt}</g>`;
}

/** Ärmchen der Stufe 1, nach links gezeichnet, Schulter im Ursprung. */
const ARMFORMEN: Record<ArmForm, { d?: string; stock?: string; hand: readonly [number, number]; winkel: number; r: number }> = {
  // dünn und hängend
  haengen: { d: "M2 -5 C-12 -3 -22 10 -25 34 L-15 36 C-15 18 -9 8 2 5 C7 3 7 -3 2 -5 Z", hand: [-20, 41], winkel: 180, r: 8 },
  // Hand in die Hüfte gestemmt, Ellbogen raus: überheblich
  huefte: { d: "M2 -5 C-16 -4 -30 8 -30 20 C-30 28 -22 34 -12 37 L-8 29 C-14 27 -19 24 -19 20 C-19 13 -9 7 2 5 C7 3 7 -3 2 -5 Z", hand: [-6, 34], winkel: 115, r: 8 },
  // Comicärmchen als Strich, wie bei Verpackungsmaskottchen
  stock: { stock: "M0 0 Q-22 6 -24 34", hand: [-24, 40], winkel: 180, r: 7 },
  // lang und schlaff bis zum Boden
  lang: { d: "M3 -7 C-14 -4 -26 14 -28 40 C-29 54 -28 64 -26 72 L-14 72 C-14 60 -15 48 -14 38 C-12 18 -6 8 3 5 C8 3 8 -5 3 -7 Z", hand: [-20, 76], winkel: 180, r: 8 },
};

function aermchen(st: Stift, f: Figur, x: number, y: number, s: 1 | -1, form: ArmForm, ding: Ding | undefined): string {
  const a = ARMFORMEN[form];
  const farbe = f.aermchen.farbe ?? f.haut;
  const arm = a.d
    ? st.form(a.d, farbe, { linie: 2.8 })
    : strich(a.stock!, 6.4) + strich(a.stock!, 2.6, farbe);
  // Gegenstand nicht spiegeln (Schrift), daher außerhalb der gespiegelten Gruppe
  const [hx, hy] = a.hand;
  const gegenstand = ding ? `<g transform="translate(${x + s * hx} ${y + hy}) scale(.6)">${ding(st)}</g>` : "";
  return (
    `<g transform="translate(${x} ${y}) scale(${s} 1)">${a.d ? st.wurf(a.d) : ""}${arm}</g>` +
    gegenstand +
    `<g transform="translate(${x} ${y}) scale(${s} 1)">${hand(st, f.aermchen.hand, f.haut, hx, hy, a.r, a.winkel)}</g>`
  );
}

/**
 * Aufgepumpte Arme als je eine Form, nach links gezeichnet, Schulter im Ursprung.
 * Bizeps: Doppelbizeps-Pose. Stemmen: Faust über dem Kopf. Hängen: Gorillaarme bis zum Boden.
 */
const POSEN: Record<Pose, { d: string; faust: readonly [number, number]; winkel: number; falte: string; adern: string; gelenk: string }> = {
  bizeps: {
    d:
      "M2 -16 C-6 -36 -22 -50 -37 -47 C-50 -44 -55 -32 -52 -20 C-54 -30 -55 -40 -56 -48 " +
      "C-55 -58 -60 -70 -71 -71 C-84 -72 -90 -60 -85 -48 C-88 -36 -88 -14 -80 0 " +
      "C-76 14 -60 20 -46 15 C-30 13 -14 16 2 13 C12 8 12 -10 2 -16 Z",
    faust: [-71, -59],
    winkel: -8,
    falte: "M-52 -20 C-46 -13 -36 -13 -26 -18",
    adern: "M-12 -26 C-18 -36 -26 -32 -32 -38 S-40 -34 -45 -38 M-24 -20 C-30 -22 -34 -20 -38 -24 M-66 -36 C-70 -26 -68 -18 -72 -8",
    gelenk: "M-57 -46 Q-71 -41 -86 -47",
  },
  stemmen: {
    d:
      "M2 13 C-20 16 -46 8 -58 -12 C-66 -30 -64 -58 -62 -84 C-70 -92 -68 -108 -56 -110 " +
      "C-44 -114 -36 -106 -38 -94 C-40 -76 -40 -62 -36 -50 C-28 -52 -14 -44 -10 -32 C-6 -24 0 -19 2 -16 C12 -10 12 8 2 13 Z",
    faust: [-52, -99],
    winkel: 0,
    falte: "M-36 -50 C-42 -44 -46 -36 -48 -26",
    adern: "M-12 -22 C-24 -28 -30 -18 -40 -22 M-50 -30 C-54 -46 -50 -62 -54 -80",
    gelenk: "M-63 -84 Q-50 -79 -38 -88",
  },
  haengen: {
    d:
      "M6 -14 C-14 -26 -40 -20 -46 2 C-52 18 -52 32 -46 44 C-58 56 -62 72 -56 84 " +
      "C-52 96 -36 98 -30 88 C-26 74 -26 58 -28 48 C-22 36 -18 24 -14 14 C-8 8 0 8 6 6 C14 0 14 -10 6 -14 Z",
    faust: [-44, 86],
    winkel: 180,
    falte: "M-46 44 C-40 47 -34 48 -28 48",
    adern: "M-18 -6 C-30 0 -36 16 -40 30 M-48 54 C-52 62 -48 70 -50 76",
    gelenk: "M-57 76 Q-44 81 -29 76",
  },
};

/** Muster auf dem Muskel, auf die Armfläche beschnitten. */
function muster(st: Stift, m: Muster, p: (typeof POSEN)[Pose]): string {
  const raster = (schritt: number, f: (x: number, y: number, i: number) => string) => {
    let out = "";
    let i = 0;
    for (let y = -125; y < 110; y += schritt) for (let x = -110 + ((y / schritt) % 2) * (schritt / 2); x < 20; x += schritt) out += f(x, y, i++);
    return out;
  };
  switch (m.art) {
    case "adern":
      return strich(p.adern, 2.2, m.farbe);
    case "haare":
      return st.clip(p.d, `<path d="${raster(9, (x, y, i) => `M${x} ${y} l${i % 3 - 1} -5 `)}" stroke="${m.farbe}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".7"/>`);
    case "fell":
      return st.clip(p.d, `<path d="${raster(11, (x, y) => `M${x} ${y} q-3 5 0 10 `)}" stroke="${m.farbe}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".75"/>`);
    case "naehte": {
      // Chesterfield-Polster: Rautennähte mit Knöpfen an den Kreuzungen
      let linien = "";
      for (let k = -260; k < 160; k += 18) linien += `M${k} -130 l240 240 M${k + 240} -130 l-240 240 `;
      const knoepfe = raster(18, (x, y) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${m.farbe}"/>`);
      return st.clip(p.d, `<path d="${linien}" stroke="${m.farbe}" stroke-width="1.4" fill="none" opacity=".8"/><g transform="translate(-1 -4)">${knoepfe}</g>`);
    }
    case "knister":
      return st.clip(p.d, `<path d="${raster(14, (x, y, i) => (i % 2 ? `M${x} ${y} l4 -5 l4 5 l4 -5 ` : `M${x} ${y} l7 3 `))}" stroke="${m.farbe}" stroke-width="1.6" stroke-linejoin="round" fill="none" opacity=".8"/>`);
    case "aermel":
      // Samtärmel mit Goldstickerei und Goldbund am Handgelenk
      return (
        st.clip(p.d, raster(16, (x, y) => `<path d="M${x} ${y - 3} l3 3 l-3 3 l-3 -3 Z" fill="${m.farbe}" opacity=".8"/>`)) +
        strich(p.gelenk, 9, LINIE) +
        strich(p.gelenk, 5.6, m.farbe)
      );
  }
}

function pumparm(st: Stift, f: Figur, x: number, y: number, s: 1 | -1, pose: Pose, ding: Ding): string {
  const p = POSEN[pose];
  const { muster: m, hand: h, farbe } = f.pump;
  const [fx, fy] = p.faust;
  // Gegenstand hinter dem Arm, damit die Faust ihn umschließt; nicht spiegeln, sonst stünde Schrift verkehrt
  const gegenstand = `<g transform="translate(${x + s * fx} ${y + fy})">${ding(st)}</g>`;
  return (
    gegenstand +
    `<g transform="translate(${x} ${y}) scale(${s} 1)">` +
    st.wurf(p.d) +
    st.form(p.d, farbe ?? f.haut) +
    muster(st, m, p) +
    strich(p.falte, 2.4) +
    hand(st, h, f.haut, fx, fy, 14, p.winkel) +
    `</g>`
  );
}

/** Wölkchen (Staub, Dampf, Schaum). */
const wolke = (x: number, y: number, farbe: string, g = 1) =>
  `<path transform="translate(${x} ${y}) scale(${g})" d="M0 0 c-6 -2 -8 -10 -2 -13 c-1 -7 9 -9 11 -3 c6 -1 8 7 3 10 c2 6 -8 9 -12 6 Z" fill="${farbe}" stroke="${LINIE}" stroke-width="1.4"/>`;

/** Kleiner Stern als Funkeln. */
const funkeln = (x: number, y: number, r: number, farbe = "#fffdf6") =>
  `<path d="M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z" fill="${farbe}"/>`;

// Gegenstände in der Hand
const dinge = {
  /** Gesprengte Kette, baumelt aus der Faust */
  kette: (st: Stift) =>
    [
      [-12, 4, 30],
      [-22, 12, -20],
      [-30, 23, 40],
      [-35, 36, -10],
    ]
      .map(([x, y, w], i) => {
        const glied = i === 3 ? "M-7 -2 C-7 -6 -4 -7 0 -7 C6 -7 7 -4 7 0 C7 4 4 6 2 6" : "M-7 0 C-7 -5 -4 -7 0 -7 C4 -7 7 -5 7 0 C7 5 4 7 0 7 C-4 7 -7 5 -7 0 Z";
        return `<g transform="translate(${x} ${y}) rotate(${w})"><path d="${glied}" fill="none" stroke="${LINIE}" stroke-width="5.4" stroke-linecap="round"/><path d="${glied}" fill="none" stroke="#a3a3aa" stroke-width="2.6" stroke-linecap="round"/></g>`;
      })
      .join(""),
  /** Dönermesser mit langer Klinge */
  messer: (st: Stift) =>
    st.form("M-6 -86 C-2 -92 4 -90 6 -84 L5 -22 L-5 -22 Z", "#dfe3ea", { linie: 2.4, licht: 0.9 }) +
    st.form("M-10 -24 L10 -24 L10 -18 L-10 -18 Z", "#34343a", { linie: 2 }) +
    st.form("M-5 -18 L5 -18 L5 12 L-5 12 Z", "#3a1d12", { linie: 2 }) +
    strich("M-1 -80 L-1 -30", 1.6, "#fff"),
  /** Plastikgabel vom Imbiss */
  gabel: (_st: Stift) =>
    `<path d="M0 6 L0 -26 M-6 -40 L-6 -30 Q0 -22 6 -30 L6 -40 M0 -40 L0 -26" fill="none" stroke="${LINIE}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M0 6 L0 -26 M-6 -40 L-6 -30 Q0 -22 6 -30 L6 -40 M0 -40 L0 -26" fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  /** Fernbedienung, ragt nach vorne raus */
  fernbedienung: (st: Stift) =>
    `<g transform="rotate(-20)">${st.form("M-40 -7 Q-42 0 -40 7 L4 7 L4 -7 Z", "#34343a", { linie: 2.4 })}` +
    `<circle cx="-33" cy="0" r="3" fill="#d9141c"/><circle cx="-24" cy="-2" r="1.8" fill="#a3a3aa"/><circle cx="-24" cy="3" r="1.8" fill="#a3a3aa"/><circle cx="-17" cy="-2" r="1.8" fill="#a3a3aa"/><circle cx="-17" cy="3" r="1.8" fill="#a3a3aa"/></g>`,
  /** Maßkrug, Schaum läuft über */
  mass: (st: Stift) =>
    st.form("M-6 -30 C6 -30 12 -24 12 -14 C12 -4 6 2 -4 2 L-4 -6 C2 -6 4 -10 4 -14 C4 -18 2 -22 -6 -22 Z", "#e8f4f8", { linie: 2.2 }) +
    st.form("M-46 -34 L-6 -34 L-8 10 Q-26 14 -44 10 Z", "#f4b400", { linie: 2.6, licht: 0.5 }) +
    strich("M-36 -26 L-37 2 M-26 -26 L-26 4 M-16 -26 L-15 2", 2, "#c98a00") +
    st.form("M-50 -32 C-54 -42 -44 -48 -38 -44 C-34 -52 -20 -52 -18 -44 C-12 -48 -2 -44 -4 -34 C-2 -30 -4 -24 -10 -26 C-10 -20 -16 -20 -18 -26 L-46 -26 C-50 -26 -52 -30 -50 -32 Z", "#fffdf6", { linie: 2.4 }),
  /** Riesenchip */
  chip: (st: Stift) =>
    st.form("M-24 -30 C-20 -48 14 -52 24 -38 C30 -28 22 -12 4 -10 C-14 -8 -28 -16 -24 -30 Z", "#f4c400", { linie: 2.6 }) +
    `<circle cx="-8" cy="-32" r="2.2" fill="#c99200"/><circle cx="8" cy="-26" r="2.6" fill="#c99200"/><circle cx="12" cy="-38" r="1.8" fill="#c99200"/><circle cx="-14" cy="-20" r="1.6" fill="#7aa83a"/>`,
  /** Handy mit Bestellung */
  handy: (st: Stift) =>
    st.form("M-13 -58 Q-13 -62 -9 -62 L9 -62 Q13 -62 13 -58 L13 -6 Q13 -2 9 -2 L-9 -2 Q-13 -2 -13 -6 Z", "#2f2f35", { linie: 2.4 }) +
    `<rect x="-9" y="-56" width="18" height="44" rx="2" fill="#ffe7a3"/>` +
    `<path d="M0 -50 L-7 -32 Q0 -29 7 -32 Z" fill="#f4c400" stroke="#c42a21" stroke-width="1.4"/><circle cx="-1" cy="-38" r="1.6" fill="#e2352b"/><circle cx="2" cy="-43" r="1.4" fill="#e2352b"/>` +
    `<rect x="-7" y="-26" width="14" height="6" rx="2" fill="#5cbf3b"/>`,
  /** Kelch mit Rotwein */
  kelch: (st: Stift) =>
    st.form("M-16 -48 L16 -48 C16 -30 8 -22 3 -20 L3 -6 L10 -2 L-10 -2 L-3 -6 L-3 -20 C-8 -22 -16 -30 -16 -48 Z", "#f4c400", { linie: 2.4 }) +
    `<path d="M-14 -44 L14 -44 C12 -32 6 -26 0 -25 C-6 -26 -12 -32 -14 -44 Z" fill="#8f0f16"/>` +
    `<circle cx="-6" cy="-36" r="2.4" fill="#d9141c"/><circle cx="7" cy="-34" r="2.4" fill="#2e58a6"/>`,
};

/** Hantel waagrecht durch die Faust. */
function hantel(st: Stift, scheibe: (x: number) => string): string {
  return st.form("M-38 -4 Q0 -6 38 -4 L38 4 Q0 6 -38 4 Z", "#a3a3aa", { linie: 2.4 }) + scheibe(-32) + scheibe(32);
}

const figuren: Record<string, Figur> = {
  "Der innere Schweinehund": {
    haut: "#f5a0b4",
    schulter: [84, 134, 156, 134],
    aermchen: { form: ["huefte", "huefte"], hand: "huf" },
    pump: { pose: ["bizeps", "stemmen"], muster: { art: "adern", farbe: "#c2456a" }, hand: "huf", ding: dinge.kette },
    aura: "#ff2d2d",
    schwitzt: true,
    // Schlammspritzer und Gestank
    rage: () =>
      [
        [56, 52, 1],
        [190, 64, 0.8],
        [34, 176, 0.9],
        [208, 188, 1.1],
      ]
        .map(([x, y, g]) => `<path transform="translate(${x} ${y}) scale(${g})" d="M-10 -2 C-14 -12 -2 -16 2 -10 C6 -18 18 -12 12 -4 C20 0 14 12 6 8 C4 16 -8 14 -6 6 C-14 8 -16 0 -10 -2 Z M16 -16 a3 3 0 1 0 0.1 0 M-16 10 a2.4 2.4 0 1 0 0.1 0" fill="#7a4a24" stroke="${LINIE}" stroke-width="1.4"/>`)
        .join("") + strich("M98 36 q-6 -8 0 -16 q6 -8 0 -16 M120 30 q-6 -8 0 -16 q6 -8 0 -16 M142 36 q-6 -8 0 -16 q6 -8 0 -16", 3, "#9bc83a"),
    koerper: (st, wut) => {
      const fuss = (x: number, s: 1 | -1) =>
        `<g transform="translate(${x} 0) scale(${s} 1)">` +
        st.form("M-14 200 C-20 210 -18 218 -6 220 C6 221 12 216 10 206 Z", "#f5a0b4", { linie: 3 }) +
        st.form("M-18 212 C-18 220 -10 223 -2 223 C6 223 11 220 11 214 C2 217 -10 217 -18 212 Z", "#6b3b45", { linie: 2.4 }) +
        strich("M-3 215 L-3 222", 1.8) +
        `</g>`;
      return (
        // Ringelschwanz hinter dem Körper
        strich("M170 178 C184 178 192 168 186 160 C180 152 170 160 176 166 C180 170 188 166 190 160", 7, LINIE) +
        strich("M170 178 C184 178 192 168 186 160 C180 152 170 160 176 166 C180 170 188 166 190 160", 3.4, "#f5a0b4") +
        // ein Körper von den Ohren bis zum Hängebauch, birnenförmig
        st.form(
          "M120 46 C142 44 158 58 161 76 C163 88 161 98 158 105 C170 110 178 120 182 134 C192 158 193 182 183 198 " +
            "C176 208 162 212 146 212 C132 214 108 214 94 212 C78 212 64 208 57 198 C47 182 48 158 58 134 " +
            "C62 120 70 110 82 105 C79 98 77 88 79 76 C82 58 98 44 120 46 Z",
          "#f5a0b4",
        ) +
        `<path d="M120 132 C146 132 168 152 170 178 C171 196 150 206 120 206 C90 206 69 196 70 178 C72 152 94 132 120 132 Z" fill="#fbd0da" opacity=".7"/>` +
        strich("M66 186 C88 204 152 204 174 186", 2.4, "#c2607a") +
        fuss(92, 1) +
        fuss(148, -1) +
        strich("M118 176 q2 4 5 0", 2.2, "#c2607a") +
        strich("M60 148 q8 6 16 3 M180 148 q-8 6 -16 3 M64 166 q6 4 12 2 M176 166 q-6 4 -12 2", 2, "#c2607a") +
        // Doppelkinn
        strich("M88 112 C100 124 140 124 152 112", 2.4, "#c2607a") +
        strich("M96 120 C108 128 132 128 144 120", 1.8, "#c2607a") +
        // Hängeohren mit Knick
        st.form("M88 60 C72 54 54 64 52 86 C50 104 58 120 70 121 C80 122 84 110 82 98 C81 86 86 72 96 64 Z", "#8b5a3c") +
        strich("M66 74 C62 88 64 104 70 114", 1.8, "#5e3a24") +
        st.form("M152 60 C168 54 186 64 188 86 C190 104 182 120 170 121 C160 122 156 110 158 98 C159 86 154 72 144 64 Z", "#8b5a3c") +
        strich("M174 74 C178 88 176 104 170 114", 1.8, "#5e3a24") +
        strich("M114 47 q1 -9 8 -12 M120 46 q4 -7 11 -7", 2.6) +
        `<ellipse cx="91" cy="100" rx="8" ry="5" fill="#ff7f9a" opacity=".5"/><ellipse cx="149" cy="100" rx="8" ry="5" fill="#ff7f9a" opacity=".5"/>` +
        augen(104, 136, 80, wut) +
        // Rüssel, leicht nach oben gestülpt
        st.form("M98 102 C95 90 106 86 120 86 C134 86 145 90 142 102 C140 113 131 116 120 116 C109 116 100 113 98 102 Z", "#ec7d98", { linie: 3 }) +
        `<path d="M110 96 C106 98 106 106 111 107 C115 108 116 98 110 96 Z M130 96 C136 98 136 106 131 107 C127 108 126 98 130 96 Z" fill="${LINIE}"/>` +
        mund(120, 122, 26, wut)
      );
    },
    gewicht: (st) => hantel(st, (x) => st.form(`M${x - 7} -22 Q${x} -25 ${x + 7} -22 L${x + 7} 22 Q${x} 25 ${x - 7} 22 Z`, "#34343a", { linie: 2.4 })),
    // Stachelhalsband
    extra: (st) =>
      st.form("M86 128 Q120 140 154 128 L154 140 Q120 152 86 140 Z", "#2f2f35", { linie: 2.6 }) +
      [96, 108, 120, 132, 144]
        .map((x) => {
          const y = 132 + (x - 120) ** 2 / 400;
          return st.form(`M${x - 4} ${y} L${x} ${y - 12} L${x + 4} ${y} Z`, "#dcdce2", { linie: 1.6 });
        })
        .join(""),
  },
  "Der Dönerteller XXL": {
    haut: "#d39a55",
    schulter: [70, 142, 170, 142],
    aermchen: { form: ["haengen", "huefte"], hand: "faust", ding: dinge.gabel },
    pump: { pose: ["stemmen", "bizeps"], muster: { art: "adern", farbe: "#d9141c" }, hand: "faust", ding: dinge.messer },
    aura: "#ff7a00",
    schwitzt: true,
    // Scharf: Flammen und fliegende Peperoni
    rage: (st) =>
      [
        [70, 58, 1],
        [178, 50, 1.2],
        [120, 30, 0.8],
      ]
        .map(([x, y, g]) => `<g transform="translate(${x} ${y}) scale(${g})">${st.form("M0 12 C-12 12 -14 0 -8 -8 C-8 -2 -4 0 -3 -2 C-6 -10 0 -18 4 -22 C4 -14 12 -10 10 0 C12 -2 13 -6 12 -8 C18 0 14 12 0 12 Z", "#ff8a00", { linie: 2.2 })}<path d="M0 10 C-6 10 -7 3 -3 -2 C-2 2 2 3 2 -2 C6 2 6 10 0 10 Z" fill="#ffd23a"/></g>`)
        .join("") +
      [
        [34, 122, -30],
        [210, 106, 40],
        [208, 196, 120],
      ]
        .map(([x, y, w]) => `<g transform="translate(${x} ${y}) rotate(${w})">${st.form("M-4 -10 C4 -10 6 0 4 10 C2 18 -2 22 -2 16 C-4 8 -8 -4 -4 -10 Z", "#e2352b", { linie: 2 })}${st.form("M-4 -10 C-4 -14 0 -16 2 -18 L3 -15 C1 -14 0 -12 2 -10 Z", "#5cbf3b", { linie: 1.6 })}</g>`)
        .join(""),
    koerper: (st, wut) => {
      const fladen = (s: 1 | -1) =>
        `<g transform="translate(120 0) scale(${s} 1) translate(-120 0)">` +
        st.form("M70 126 L50 62 C60 56 78 62 90 76 Z", "#ecc47e", { linie: 2.8 }) +
        strich("M62 78 l10 6 M66 92 l12 6 M70 106 l10 6", 2.4, "#a8692a") +
        `</g>`;
      const pommes = (x: number, y: number, w: number) =>
        `<g transform="translate(${x} ${y}) rotate(${w})">${st.form("M-4 -16 L4 -16 L4 10 L-4 10 Z", "#f6c94a", { linie: 2 })}</g>`;
      const huegel =
        "M58 198 C50 172 54 142 68 120 C74 102 88 88 102 86 C110 72 130 72 138 84 C154 86 168 100 172 118 " +
        "C186 142 190 172 182 198 C150 206 90 206 58 198 Z";
      return (
        st.form("M28 204 C28 190 80 184 120 184 C160 184 212 190 212 204 C212 218 160 224 120 224 C80 224 28 218 28 204 Z", "#f6f4ef") +
        `<path d="M48 202 C48 194 90 190 120 190 C150 190 192 194 192 202 C192 210 150 214 120 214 C90 214 48 210 48 202 Z" fill="#e4e0d8"/>` +
        pommes(52, 192, -50) +
        pommes(44, 198, -70) +
        pommes(190, 192, 52) +
        pommes(198, 199, 72) +
        fladen(1) +
        fladen(-1) +
        // Fleischberg aus Dönerspänen
        st.form(huegel, "#b8733a") +
        st.clip(
          huegel,
          strich("M60 150 q10 -6 20 0 q10 6 20 0 M150 150 q10 -6 20 0 q10 6 20 0 M58 176 q12 -6 24 0 q12 6 24 0 q12 -6 24 0 q12 6 24 0 q12 -6 24 0 M76 118 q8 -5 16 0 M146 118 q8 -5 16 0 M70 194 q14 -6 28 0 q14 6 28 0 q14 -6 28 0 q14 6 28 0", 2.2, "#7a4416"),
        ) +
        // Salat, Tomate, Zwiebel und Soße obendrauf
        st.form("M72 98 C70 84 84 78 92 86 C96 72 112 70 118 80 C126 68 144 70 146 82 C156 76 170 84 166 98 C160 106 148 102 142 106 C128 100 112 100 98 106 C90 102 78 106 72 98 Z", "#5cbf3b", { linie: 2.8 }) +
        strich("M86 92 l6 6 M108 84 l2 8 M130 84 l-2 8 M150 90 l-6 6", 1.8, "#2f7a1f") +
        st.form(kreis(94, 84, 8), "#e2352b", { linie: 2.2 }) +
        st.form(kreis(146, 82, 8), "#e2352b", { linie: 2.2 }) +
        `<path d="M94 80 v8 M90 84 h8 M146 78 v8 M142 82 h8" stroke="#ffd0c4" stroke-width="1.4"/>` +
        `<ellipse cx="120" cy="80" rx="9" ry="6" fill="none" stroke="${LINIE}" stroke-width="4.4"/><ellipse cx="120" cy="80" rx="9" ry="6" fill="none" stroke="#c99adf" stroke-width="2.2"/>` +
        strich("M74 104 L84 112 L94 102 L106 112 L118 102 L130 112 L142 102 L154 112 L166 104", 7) +
        strich("M74 104 L84 112 L94 102 L106 112 L118 102 L130 112 L142 102 L154 112 L166 104", 4, "#fffdf6") +
        augen(102, 138, 134, wut, 10) +
        mund(120, 160, 36, wut)
      );
    },
    // Dönerspieß als Keule
    gewicht: (st) =>
      strich("M0 18 L0 -82", 6.4) +
      strich("M0 18 L0 -82", 3, "#a3a3aa") +
      st.form("M-9 -6 C-14 -26 -18 -48 -20 -70 Q0 -76 20 -70 C18 -48 14 -26 9 -6 Q0 -3 -9 -6 Z", "#a8642c", { linie: 2.6 }) +
      strich("M-17 -60 Q0 -56 17 -62 M-15 -44 Q0 -40 15 -46 M-12 -28 Q0 -24 12 -30 M-10 -14 Q0 -11 10 -15", 2, "#6e3a14") +
      strich("M-6 -66 l2 6 M8 -52 l-2 6 M-4 -36 l2 6", 1.6, "#e2352b"),
  },
  "Das Sofa der Verdammnis": {
    haut: "#7a2c8c",
    schulter: [66, 150, 174, 150],
    aermchen: { form: ["haengen", "haengen"], hand: "faust", ding: dinge.fernbedienung },
    pump: { pose: ["haengen", "haengen"], muster: { art: "naehte", farbe: "#4e1a5b" }, hand: "faust", ding: dinge.fernbedienung },
    aura: "#b02dff",
    // Staubwolken, Popcorn und herausspringende Sprungfedern
    rage: () =>
      [
        [30, 214, 1.4],
        [214, 214, 1.4],
        [44, 196, 1],
        [196, 196, 1],
      ]
        .map(([x, y, g]) => wolke(x!, y!, "#cbb79a", g))
        .join("") +
      [
        [70, 34, -20],
        [172, 30, 20],
      ]
        .map(([x, y, w]) => `<g transform="translate(${x} ${y}) rotate(${w})"><path d="M0 22 C-10 20 -10 14 0 13 C10 12 10 6 0 5 C-10 4 -10 -2 0 -3 C10 -4 10 -10 0 -11 C-8 -12 -8 -16 0 -18" fill="none" stroke="${LINIE}" stroke-width="4.6" stroke-linecap="round"/><path d="M0 22 C-10 20 -10 14 0 13 C10 12 10 6 0 5 C-10 4 -10 -2 0 -3 C10 -4 10 -10 0 -11 C-8 -12 -8 -16 0 -18" fill="none" stroke="#c9ccd4" stroke-width="2" stroke-linecap="round"/></g>`)
        .join("") +
      [
        [40, 100],
        [204, 120],
        [120, 22],
        [26, 150],
      ]
        .map(([x, y]) => `<path transform="translate(${x} ${y})" d="M-5 0 C-8 -6 -2 -9 0 -6 C2 -10 8 -7 6 -2 C10 0 7 7 2 5 C0 9 -6 7 -5 3 C-9 3 -9 -1 -5 0 Z" fill="#fff7d6" stroke="${LINIE}" stroke-width="1.4"/>`)
        .join(""),
    koerper: (st, wut) => {
      const lehne =
        "M74 152 C68 124 62 96 56 72 C52 56 62 44 76 50 C84 40 102 36 120 42 C138 36 156 40 164 50 " +
        "C178 44 188 56 184 72 C178 96 172 124 166 152 Z";
      // Polsterknöpfe und Rautennähte in der Lehne
      let rauten = "";
      for (let k = -40; k < 260; k += 26) rauten += `M${k} 40 l120 120 M${k + 120} 40 l-120 120 `;
      const knoepfe = [
        [94, 70],
        [120, 66],
        [146, 70],
        [107, 92],
        [133, 92],
        [94, 114],
        [146, 114],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#3e1249"/>`)
        .join("");
      const rolle = (s: 1 | -1) =>
        `<g transform="translate(120 0) scale(${s} 1) translate(-120 0)">` +
        st.form("M38 198 C34 172 34 148 42 134 C50 120 72 118 82 130 C88 138 88 150 84 158 L86 198 C70 204 52 204 38 198 Z", "#6a2379") +
        strich("M60 150 C50 152 46 142 52 136 C58 130 70 134 68 144 C66 154 52 158 44 150", 2.4, "#3e1249") +
        strich("M44 172 C46 182 52 190 60 194", 1.8, "#3e1249") +
        `</g>`;
      const bein = (x: number, s: 1 | -1) =>
        `<g transform="translate(${x} 0) scale(${s} 1)">${st.form("M-6 198 C-10 206 -4 210 -12 218 C-6 221 2 216 4 208 L6 198 Z", "#4a2a14", { linie: 2.2 })}</g>`;
      // Volant mit Bögen
      const volant = "M40 192 L200 192 L200 200 " + Array.from({ length: 10 }, (_, i) => `Q${195 - i * 16} 210 ${184 - i * 16} 200`).join(" ") + " L40 200 Z";
      return (
        bein(62, 1) +
        bein(178, -1) +
        st.form("M90 64 C80 52 76 36 84 22 C88 38 98 48 108 56 Z", "#d9141c", { linie: 2.6 }) +
        st.form("M150 64 C160 52 164 36 156 22 C152 38 142 48 132 56 Z", "#d9141c", { linie: 2.6 }) +
        st.form(lehne, "#7a2c8c") +
        st.clip(lehne, `<path d="${rauten}" stroke="#4e1a5b" stroke-width="1.6" fill="none" opacity=".55"/>`) +
        knoepfe +
        strich("M66 64 C70 84 72 112 76 140 M174 64 C170 84 168 112 164 140", 2, "#4e1a5b") +
        st.form(volant, "#5a1c68", { linie: 2.6 }) +
        rolle(1) +
        rolle(-1) +
        // durchgesessenes Kissen
        st.form("M72 188 C66 168 80 156 120 158 C160 156 174 168 168 188 C150 196 90 196 72 188 Z", "#8f3aa4") +
        strich("M84 168 C100 176 140 176 156 168 M100 186 q6 -4 12 0 M128 186 q6 -4 12 0", 1.8, "#5a1c68") +
        augen(102, 138, 92, wut, 11) +
        mund(120, 118, 40, wut)
      );
    },
    // Hantel aus Sofakissen
    gewicht: (st) => hantel(st, (x) => st.form(`M${x - 11} -16 C${x - 12} -24 ${x + 12} -24 ${x + 11} -16 L${x + 11} 16 C${x + 12} 24 ${x - 12} 24 ${x - 11} 16 Z`, "#c169d6", { linie: 2.4 })),
  },
  "König Bierbauch": {
    haut: "#f1bf92",
    schulter: [78, 124, 162, 124],
    aermchen: { form: ["haengen", "huefte"], hand: "faust", ding: dinge.mass },
    pump: { pose: ["stemmen", "bizeps"], muster: { art: "haare", farbe: "#8a4a20" }, hand: "faust", ding: dinge.mass },
    aura: "#ffb000",
    schwitzt: true,
    // Bierschaum spritzt, Bläschen steigen
    rage: () =>
      [
        [60, 46, 1.3],
        [184, 42, 1.3],
        [204, 70, 0.9],
        [40, 74, 0.9],
      ]
        .map(([x, y, g]) => wolke(x!, y!, "#fffdf6", g))
        .join("") +
      [
        [30, 120, 5],
        [212, 132, 6],
        [24, 96, 3.4],
        [218, 104, 3.6],
        [36, 150, 3],
        [206, 160, 3.4],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd54a" fill-opacity=".5" stroke="#fffdf6" stroke-width="1.8"/>`)
        .join("") +
      `<path d="M96 30 c-2 6 4 8 4 2 Z M146 26 c-2 6 4 8 4 2 Z M120 18 c-2 6 4 8 4 2 Z" fill="#f4b400" stroke="${LINIE}" stroke-width="1.2"/>`,
    koerper: (st, wut) => {
      const leib =
        "M120 50 C138 49 150 62 150 80 C150 92 147 100 142 106 C160 112 176 128 182 152 C190 182 176 206 150 212 " +
        "C132 216 108 216 90 212 C64 206 50 182 58 152 C64 128 80 112 98 106 C93 100 90 92 90 80 C90 62 102 49 120 50 Z";
      const hermelin = [92, 106, 120, 134, 148].map((x, i) => `<path d="M${x} ${118 + (i % 2) * 4} l-2 6 l2 -2 l2 2 Z" fill="${LINIE}"/>`).join("");
      return (
        // Königsmantel
        st.form("M86 110 C60 140 44 180 38 214 C80 222 160 222 202 214 C196 180 180 140 154 110 Z", "#b3141c") +
        strich("M60 160 C56 180 54 198 54 212 M180 160 C184 180 186 198 186 212", 2, "#7a0c12") +
        st.form(leib, "#f1bf92") +
        strich("M98 150 q6 -5 12 0 M130 150 q6 -5 12 0", 2.4, "#b0754d") +
        strich("M117 176 q3 5 6 0", 2.6, "#b0754d") +
        strich("M100 138 l-2 5 M106 136 l0 5 M134 136 l0 5 M140 138 l2 5 M114 160 l-1 5 M126 160 l1 5", 1.6, "#9a6640") +
        // Lederhose mit Hosenträgern
        st.form("M60 182 C84 198 156 198 180 182 C184 194 180 206 170 213 L70 213 C60 206 56 194 60 182 Z", "#6b4423") +
        strich("M66 196 C90 206 150 206 174 196", 1.6, "#d9b98a") +
        strich("M98 110 C92 140 88 168 90 192 M142 110 C148 140 152 168 150 192", 8.4) +
        strich("M98 110 C92 140 88 168 90 192 M142 110 C148 140 152 168 150 192", 5, "#2f6b3a") +
        `<path d="M89 170 h4 M147 170 h4" stroke="#f4c400" stroke-width="5" stroke-linecap="round"/>` +
        // Hermelinkragen
        st.form("M80 108 C96 124 144 124 160 108 C164 120 150 132 120 133 C90 132 76 120 80 108 Z", "#fffdf6", { linie: 2.8 }) +
        hermelin +
        // langer Bart
        st.form("M92 88 C88 114 96 142 110 152 C113 162 127 162 130 152 C144 142 152 114 148 88 C140 102 130 106 120 103 C110 106 100 102 92 88 Z", "#c66f2a") +
        strich("M108 112 C106 126 110 140 116 148 M132 112 C134 126 130 140 124 148 M120 112 L120 150", 1.8, "#8a4416") +
        `<ellipse cx="100" cy="90" rx="6" ry="4" fill="#ff8a7a" opacity=".55"/><ellipse cx="140" cy="90" rx="6" ry="4" fill="#ff8a7a" opacity=".55"/>` +
        st.form(kreis(120, 90, 5.5), "#ee8f7a", { linie: 2.2 }) +
        // schiefe Krone
        `<g transform="rotate(-12 120 50)">${st.form("M96 60 L94 36 L108 48 L120 28 L132 48 L146 36 L144 60 C128 55 112 55 96 60 Z", "#f4c400", { linie: 3 })}<circle cx="120" cy="45" r="3.6" fill="#d9141c" stroke="${LINIE}" stroke-width="1.4"/></g>` +
        augen(108, 132, 78, wut, 7) +
        mund(120, 100, 20, wut)
      );
    },
    // Bierfässer als Hantelscheiben
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x - 13} -16 C${x - 16} -6 ${x - 16} 6 ${x - 13} 16 C${x - 4} 20 ${x + 4} 20 ${x + 13} 16 C${x + 16} 6 ${x + 16} -6 ${x + 13} -16 C${x + 4} -20 ${x - 4} -20 ${x - 13} -16 Z`, "#a05f2a", { linie: 2.4 }) +
          strich(`M${x - 15} -7 Q${x} -4 ${x + 15} -7 M${x - 15} 7 Q${x} 10 ${x + 15} 7`, 2.4, "#5b3714"),
      ),
  },
  "Die Chipstüte des Grauens": {
    haut: "#f4c400",
    schulter: [72, 138, 168, 138],
    aermchen: { form: ["stock", "stock"], hand: "handschuh", ding: dinge.chip },
    pump: { pose: ["stemmen", "stemmen"], muster: { art: "knister", farbe: "#c99200" }, hand: "handschuh", ding: dinge.chip },
    aura: "#ff2d2d",
    // Krümelexplosion und Salzfunkeln
    rage: () =>
      [
        [44, 60, 20],
        [196, 70, -30],
        [26, 130, 60],
        [214, 150, 10],
        [70, 30, -50],
        [168, 24, 80],
        [40, 200, 30],
        [204, 206, -60],
      ]
        .map(([x, y, w], i) => `<path transform="translate(${x} ${y}) rotate(${w}) scale(${0.7 + (i % 3) * 0.25})" d="M-8 -4 L-2 -9 L7 -6 L9 2 L2 8 L-7 5 Z" fill="#f4c400" stroke="${LINIE}" stroke-width="1.6" stroke-linejoin="round"/>`)
        .join("") +
      funkeln(58, 96, 7) +
      funkeln(184, 104, 8) +
      funkeln(96, 22, 6) +
      funkeln(150, 40, 5) +
      funkeln(212, 40, 6),
    koerper: (st, wut) => {
      const oben = (x0: number, y0: number, x1: number, y1: number, h: number) =>
        Array.from({ length: 12 }, (_, i) => {
          const t = (i + 1) / 12;
          return `L${(x0 + (x1 - x0) * t).toFixed(1)} ${(y0 + (y1 - y0) * t + (i % 2 === 0 ? -h : 0)).toFixed(1)}`;
        }).join(" ");
      const tuete = `M70 64 ${oben(70, 64, 168, 56, 9)} C182 92 190 148 178 194 L62 198 C50 150 56 104 70 64 Z`;
      return (
        // Chips quellen oben rechts aus einem Riss
        st.form("M150 52 C152 38 166 34 172 42 C176 50 166 60 150 52 Z", "#f4c400", { linie: 2 }) +
        st.form("M138 56 C134 44 144 36 152 42 C158 48 150 58 138 56 Z", "#f0b400", { linie: 2 }) +
        st.form(tuete, "#e2352b") +
        st.form(`M62 192 L178 188 L179 198 ${oben(179, 198, 61, 204, -8)} Z`, "#c42a21", { linie: 2.6 }) +
        st.form("M70 64 L168 56 L169 66 C136 70 102 72 71 74 Z", "#c42a21", { linie: 2.4 }) +
        // Knicke und Falten der Folie
        strich("M84 78 L96 118 L88 168 M156 72 L146 112 L160 158 M110 182 l8 -12 l8 10", 2.2, "#9c1e16") +
        strich("M78 86 C74 116 74 146 78 176", 5, "#fff") +
        `<path d="M78 86 C74 116 74 146 78 176" stroke="#ff9a8f" stroke-width="2" fill="none" opacity=".8"/>` +
        `<g transform="rotate(-6 120 164)">` +
        st.form("M78 164 C78 148 100 142 120 142 C140 142 162 148 162 164 C162 180 140 186 120 186 C100 186 78 180 78 164 Z", "#f4c400", { linie: 2.8 }) +
        `<text x="120" y="171" font-size="19" font-weight="900" text-anchor="middle" fill="#e2352b" letter-spacing="1">CHIPS</text></g>` +
        st.form("M192 120 C200 110 214 116 210 128 C206 136 194 134 192 120 Z", "#f4c400", { linie: 2 }) +
        st.form("M36 168 C42 158 56 162 54 172 C52 180 38 178 36 168 Z", "#f4c400", { linie: 2 }) +
        augen(102, 138, 102, wut, 11) +
        mund(120, 128, 38, wut)
      );
    },
    // Hantel mit Chips als Scheiben
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x} -24 C${x + 12} -20 ${x + 12} 20 ${x} 24 C${x - 12} 20 ${x - 12} -20 ${x} -24 Z`, "#f4c400", { linie: 2.4 }) +
          strich(`M${x - 3} -12 q5 6 0 12 q-5 6 0 12`, 2, "#c99200"),
      ),
  },
  "Der Lieferdienst-Lord": {
    haut: "#efb88b",
    schulter: [82, 130, 158, 130],
    aermchen: { form: ["haengen", "haengen"], hand: "faust", ding: dinge.handy, farbe: "#5a2985" },
    pump: { pose: ["bizeps", "haengen"], muster: { art: "aermel", farbe: "#f4c400" }, hand: "faust", ding: dinge.handy, farbe: "#5a2985" },
    aura: "#ff2d6e",
    schwitzt: true,
    // Benachrichtigungen prasseln herein
    rage: (st) =>
      [
        [56, 44, 1, "!"],
        [190, 38, 1.15, "3"],
        [212, 96, 0.8, "!"],
        [28, 108, 0.85, "9"],
      ]
        .map(([x, y, g, t]) => `<g transform="translate(${x} ${y}) scale(${g})">${st.form(kreis(0, 0, 12), "#e2352b", { linie: 2.4 })}<text x="0" y="6" font-size="16" font-weight="900" text-anchor="middle" fill="#fff">${t}</text></g>`)
        .join("") +
      `<g transform="translate(120 22) rotate(-8)">${st.form("M-10 6 C-10 -4 -8 -12 0 -12 C8 -12 10 -4 10 6 L14 10 L-14 10 Z", "#f4c400", { linie: 2.2 })}<circle cx="0" cy="13" r="3" fill="#f4c400" stroke="${LINIE}" stroke-width="1.6"/></g>` +
      strich("M98 18 l-8 -4 M100 30 l-9 1 M142 18 l8 -4 M140 30 l9 1", 2.4, "#fffdf6"),
    koerper: (st, wut) =>
      // Lieferrucksack hinter allem
      st.form("M66 48 L174 48 C180 48 184 52 184 58 L184 142 L56 142 L56 58 C56 52 60 48 66 48 Z", "#1fa39a") +
      strich("M60 62 L180 62", 2, "#137068") +
      `<path d="M158 70 L174 70 L166 90 Z" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.6" stroke-linejoin="round"/>` +
      // Umhang mit Goldborte
      st.form("M80 122 C58 150 46 182 40 212 C80 220 160 220 200 212 C194 182 182 150 160 122 Z", "#5a2985") +
      strich("M78 128 C58 156 48 186 44 210 M162 128 C182 156 192 186 196 210", 3.4, "#f4c400") +
      // Jacke mit Bauch
      st.form("M86 122 C78 146 72 176 78 200 C96 214 144 214 162 200 C168 176 162 146 154 122 C140 114 100 114 86 122 Z", "#e2352b") +
      strich("M120 120 L120 206", 2, "#9c1e16") +
      strich("M82 188 C100 196 140 196 158 188", 2, "#9c1e16") +
      `<g transform="rotate(-8 132 158)">${st.form("M114 146 Q132 142 150 146 L150 168 Q132 172 114 168 Z", "#fffdf6", { linie: 2.2 })}<text x="132" y="162" font-size="11" font-weight="900" text-anchor="middle" fill="#e2352b">LORD</text></g>` +
      // Kopf mit Doppelkinn und Stoppeln
      st.form("M120 60 C141 59 154 74 153 94 C153 106 148 114 142 118 C136 124 128 126 120 126 C112 126 104 124 98 118 C92 114 87 106 87 94 C86 74 99 59 120 60 Z", "#efb88b") +
      strich("M102 118 C110 124 130 124 138 118", 2, "#b77b53") +
      `<path d="M96 108 C100 120 140 120 144 108 C140 116 100 116 96 108 Z" fill="#7a5a48" opacity=".35"/>` +
      // Fahrradhelm mit Schlitzen, darauf ein Krönchen
      st.form("M84 92 C80 62 98 46 120 46 C142 46 160 62 156 92 C150 82 140 76 120 76 C100 76 90 82 84 92 Z", "#f4c400") +
      strich("M104 52 L106 70 M120 48 L120 70 M136 52 L134 70", 3, "#b98a00") +
      st.form("M86 86 Q120 76 154 86 L156 94 Q120 84 84 94 Z", "#2f2f35", { linie: 2.2 }) +
      `<g transform="rotate(10 120 40)">${st.form("M108 46 L106 32 L114 38 L120 28 L126 38 L134 32 L132 46 Z", "#f4c400", { linie: 2.2 })}</g>` +
      augen(107, 133, 100, wut, 8) +
      mund(120, 112, 22, wut),
    // Pizzakartons als Gewichte
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x - 8} -24 Q${x} -26 ${x + 8} -24 L${x + 8} 24 Q${x} 26 ${x - 8} 24 Z`, "#d79e63", { linie: 2.2 }) +
          strich(`M${x - 8} -8 h16 M${x - 8} 8 h16`, 1.6),
      ),
  },
  "Graf Gemütlich": {
    haut: "#8b684d",
    schulter: [82, 136, 158, 136],
    aermchen: { form: ["lang", "lang"], hand: "krallen" },
    pump: { pose: ["bizeps", "haengen"], muster: { art: "fell", farbe: "#5e4330" }, hand: "krallen", ding: dinge.kelch },
    aura: "#a8131b",
    // Fledermäuse und, trotz allem, ein Nickerchen
    rage: (st) =>
      [
        [50, 46, 1, -10],
        [194, 34, 1.2, 12],
        [212, 96, 0.8, -6],
        [30, 118, 0.75, 8],
      ]
        .map(([x, y, g, w]) => `<g transform="translate(${x} ${y}) scale(${g}) rotate(${w})">${st.form("M0 -2 C-4 -10 -12 -12 -20 -8 C-18 -4 -18 0 -20 4 C-14 2 -10 4 -8 8 C-6 4 -3 3 0 4 C3 3 6 4 8 8 C10 4 14 2 20 4 C18 0 18 -4 20 -8 C12 -12 4 -10 0 -2 Z", "#1f1c22", { linie: 1.8, licht: 0.3 })}<circle cx="-2" cy="-1" r="1.1" fill="#d9141c"/><circle cx="2" cy="-1" r="1.1" fill="#d9141c"/></g>`)
        .join("") +
      `<g font-weight="900" fill="#fffdf6" stroke="${LINIE}" stroke-width="1.2" paint-order="stroke"><text x="146" y="26" font-size="14">Z</text><text x="160" y="14" font-size="18">Z</text><text x="178" y="0" font-size="22">Z</text></g>`,
    koerper: (st, wut) =>
      // Umhang mit hohem Draculakragen
      st.form("M84 120 C60 150 48 184 42 212 C82 222 158 222 198 212 C192 184 180 150 156 120 Z", "#1f1c22") +
      `<path d="M86 128 C68 156 58 186 54 208 L76 210 Z M154 128 C172 156 182 186 186 208 L164 210 Z" fill="#a8131b"/>` +
      st.form("M92 122 C76 108 62 84 56 58 C72 70 88 84 100 100 Z", "#a8131b", { linie: 2.8 }) +
      st.form("M148 122 C164 108 178 84 184 58 C168 70 152 84 140 100 Z", "#a8131b", { linie: 2.8 }) +
      strich("M64 70 C74 86 84 100 94 112 M176 70 C166 86 156 100 146 112", 1.8, "#6e0b10") +
      // zotteliger Leib
      st.form(zottel(120, 168, 44, 42, 26, 0.09), "#8b684d") +
      `<path d="M120 144 C136 144 146 160 144 178 C142 196 132 202 120 202 C108 202 98 196 96 178 C94 160 104 144 120 144 Z" fill="#b39478" opacity=".9"/>` +
      strich("M108 156 q-3 6 0 12 M132 156 q3 6 0 12 M114 178 q-2 6 1 10 M126 178 q2 6 -1 10", 1.6, "#8b684d") +
      strich("M98 204 C94 212 98 218 104 218 M106 206 C104 214 108 219 113 218 M142 204 C146 212 142 218 136 218 M134 206 C136 214 132 219 127 218", 5) +
      strich("M98 204 C94 212 98 218 104 218 M106 206 C104 214 108 219 113 218 M142 204 C146 212 142 218 136 218 M134 206 C136 214 132 219 127 218", 2.4, "#efe6cf") +
      // zotteliger Kopf mit Faultiermaske
      st.form(zottel(120, 94, 38, 35, 22, 0.1), "#8b684d") +
      st.form("M120 74 C142 74 154 86 152 100 C150 114 136 122 120 122 C104 122 90 114 88 100 C86 86 98 74 120 74 Z", "#e6d3bb", { licht: 0.5 }) +
      `<path d="M92 90 C96 80 110 82 116 92 C114 102 98 104 92 90 Z M148 90 C144 80 130 82 124 92 C126 102 142 104 148 90 Z" fill="#4a3426"/>` +
      augen(105, 135, 92, wut, 6) +
      `<circle cx="135" cy="92" r="9.5" fill="none" stroke="#f4c400" stroke-width="2.6"/>` +
      strich("M144 95 Q151 110 146 126", 1.6, "#f4c400") +
      `<path d="M114 103 C114 99 126 99 126 103 C126 108 114 108 114 103 Z" fill="${LINIE}"/>` +
      mund(120, 113, 20, wut) +
      // Zylinder, schief und etwas eingedrückt
      `<g transform="rotate(9 120 62)">` +
      st.form("M98 62 C94 48 96 34 100 24 C112 20 128 20 140 24 C142 36 146 48 142 62 Z", "#1f1c22", { licht: 0.35 }) +
      `<path d="M97 50 C112 47 128 47 143 50 L142 58 C128 55 112 55 98 58 Z" fill="#a8131b"/>` +
      st.form("M78 64 C92 56 148 56 162 64 C162 70 148 72 120 70 C92 72 78 70 78 64 Z", "#1f1c22", { licht: 0.35 }) +
      `</g>`,
    gewicht: (st) =>
      hantel(
        st,
        (x) =>
          st.form(`M${x} -21 C${x + 12} -21 ${x + 21} -12 ${x + 21} 0 C${x + 21} 12 ${x + 12} 21 ${x} 21 C${x - 12} 21 ${x - 21} 12 ${x - 21} 0 C${x - 21} -12 ${x - 12} -21 ${x} -21 Z`, "#34343a", { linie: 2.4 }) +
          `<circle cx="${x}" cy="0" r="5" fill="#a3a3aa"/>`,
      ),
  },
};

/** Unbekannte Namen (z. B. aus alten Datenbanken) bekommen den Schweinehund. */
function figurVon(name: string): Figur {
  return figuren[name] ?? figuren["Der innere Schweinehund"]!;
}

/** Weicher Bodenschatten, damit der Boss steht statt schwebt. */
const boden = (_f: Figur) => `<ellipse cx="120" cy="216" rx="78" ry="9" fill="#000" opacity=".28"/>`;

let zaehler = 0;

/** Die eigentliche Zeichnung ohne äußeres <svg>. */
export function bossZeichnung(name: string, stufe: BossStufe): string {
  const f = figurVon(name);
  const id = `b${++zaehler}`;
  const st = new Stift(id);
  const [lx, ly, rx, ry] = f.schulter;
  if (stufe === 1) {
    const [fl, fr] = f.aermchen.form;
    return `<g>${st.defs()}${boden(f)}${f.koerper(st, false)}${aermchen(st, f, lx, ly, 1, fl, f.aermchen.ding)}${aermchen(st, f, rx, ry, -1, fr, undefined)}</g>`;
  }
  const [pl, pr] = f.pump.pose;
  st.rand = mische(f.aura, 0.25);
  const schweiss = f.schwitzt
    ? `<path d="M150 68 C154 76 156 80 153 83 C150 86 146 83 147 79 C147 76 149 72 150 68 Z M92 62 C96 70 98 74 95 77 C92 80 88 77 89 73 C89 70 91 66 92 62 Z" fill="#8fd8ff" stroke="${LINIE}" stroke-width="1.3"/>`
    : "";
  return `<g transform="translate(120 128) scale(.9) translate(-120 -128)">
    <defs><radialGradient id="${id}a" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="${f.aura}" stop-opacity=".6"/><stop offset="1" stop-color="${f.aura}" stop-opacity="0"/></radialGradient></defs>
    ${st.defs()}
    <circle cx="120" cy="128" r="118" fill="url(#${id}a)"/>
    ${f.rage(st)}
    ${boden(f)}
    <g>
      ${f.koerper(st, true)}
      ${f.extra?.(st) ?? ""}
      ${pumparm(st, f, lx, ly, 1, pl, f.pump.ding)}
      ${pumparm(st, f, rx, ry, -1, pr, f.gewicht)}
      ${schweiss}
    </g>
  </g>`;
}

/** Fertiges SVG in beliebiger Größe. */
export function bossSvg(name: string, stufe: BossStufe, groesse = 240): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -20 300 280" width="${groesse}" height="${groesse}">${bossZeichnung(name, stufe)}</svg>`;
}
