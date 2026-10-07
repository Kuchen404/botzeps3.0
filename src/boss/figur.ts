import type { BossStufe } from "../scoring/boss.js";

/**
 * Gezeichnete Bosse als SVG im Cartoon-Stil: geschwungene Formen mit Schatten unten rechts,
 * Licht oben links und kräftiger Tuschelinie. Stufe 1 hat Ärmchen und guckt überheblich,
 * Stufe 2 ist aufgepumpt: Bizepse mit Adern, Testo-Spritzen, Dampf, rote Aura und ein Gewicht
 * zum Thema. Koordinaten 0..240 (Stufe 2 ragt etwas hinaus), siehe `bossSvg`.
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
  constructor(private readonly praefix: string) {}

  /** Fläche mit Schatten unten rechts, Licht oben links und Umriss. */
  form(d: string, farbe: string, o: { linie?: number; schatten?: number; licht?: number } = {}): string {
    const s = `${this.praefix}s${++this.n}`;
    const l = `${this.praefix}l${this.n}`;
    const maske = (id: string, verschiebung: string) =>
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="-200" y="-200" width="700" height="700"><rect x="-200" y="-200" width="700" height="700" fill="#fff"/><path d="${d}" transform="translate(${verschiebung})" fill="#000"/></mask>`;
    return (
      maske(s, "-9 -8") +
      maske(l, "5 6") +
      `<path d="${d}" fill="${farbe}"/>` +
      `<path d="${d}" fill="${mische(farbe, o.schatten ?? -0.28)}" mask="url(#${s})"/>` +
      `<path d="${d}" fill="${mische(farbe, 0.55)}" opacity="${o.licht ?? 0.7}" mask="url(#${l})"/>` +
      `<path d="${d}" fill="none" stroke="${LINIE}" stroke-width="${o.linie ?? 3.4}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
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

interface Figur {
  haut: string;
  /** Schultern links und rechts */
  schulter: readonly [number, number, number, number];
  koerper: (st: Stift, wut: boolean) => string;
  /** Gewicht in der rechten Faust (Stufe 2); Ursprung ist die Faust */
  gewicht: (st: Stift) => string;
  extra?: (st: Stift) => string;
}

/** Hantel waagrecht durch die Faust. */
function hantel(st: Stift, scheibe: (x: number) => string): string {
  return st.form("M-38 -4 Q0 -6 38 -4 L38 4 Q0 6 -38 4 Z", "#a3a3aa", { linie: 2.4 }) + scheibe(-32) + scheibe(32);
}

const figuren: Record<string, Figur> = {
  "Der innere Schweinehund": {
    haut: "#f5a0b4",
    schulter: [84, 134, 156, 134],
    koerper: (st, wut) =>
      st.form("M120 112 C152 110 174 140 171 172 C168 200 146 212 120 211 C93 212 71 199 69 171 C67 140 89 113 120 112 Z", "#f5a0b4") +
      `<path d="M120 142 C140 142 150 160 148 180 C146 198 134 204 120 204 C106 204 94 198 92 180 C90 160 100 142 120 142 Z" fill="#fbc9d4" opacity=".9"/>` +
      st.form("M96 204 C92 214 98 220 108 219 C114 218 116 210 112 204 Z", "#e88aa0") +
      st.form("M144 204 C148 214 142 220 132 219 C126 218 124 210 128 204 Z", "#e88aa0") +
      st.form("M92 64 C76 54 58 64 62 92 C64 108 76 112 82 102 C86 90 90 78 98 70 Z", "#8b5a3c") +
      st.form("M148 64 C164 54 182 64 178 92 C176 108 164 112 158 102 C154 90 150 78 142 70 Z", "#8b5a3c") +
      st.form("M120 50 C147 49 163 70 161 95 C159 117 141 130 120 129 C99 130 81 117 79 95 C77 70 93 49 120 50 Z", "#f5a0b4") +
      augen(104, 136, 82, wut) +
      st.form("M102 103 C101 93 139 93 138 103 C139 115 101 115 102 103 Z", "#ec7d98", { linie: 3 }) +
      `<ellipse cx="113" cy="103" rx="3.2" ry="5" fill="${LINIE}" transform="rotate(-10 113 103)"/><ellipse cx="127" cy="103" rx="3.2" ry="5" fill="${LINIE}" transform="rotate(10 127 103)"/>` +
      mund(120, 119, 26, wut),
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
    haut: "#e2b066",
    schulter: [70, 142, 170, 142],
    koerper: (st, wut) =>
      st.form("M30 204 C30 192 80 186 120 186 C160 186 210 192 210 204 C210 216 160 222 120 222 C80 222 30 216 30 204 Z", "#f6f4ef") +
      strich("M44 206 C70 214 170 214 196 206", 2, "#c9c4bb") +
      st.form("M64 198 C52 152 58 104 84 80 C101 66 139 66 156 80 C182 104 188 152 176 198 C148 206 92 206 64 198 Z", "#e2b066") +
      strich("M78 120 q4 8 2 16 M160 112 q-4 10 -1 18 M90 176 q8 4 16 2", 2, "#b98340") +
      st.form("M76 88 C82 72 92 70 100 80 C106 64 118 62 124 76 C132 62 146 64 148 78 C156 70 166 76 164 92 C150 98 92 98 76 88 Z", "#5cbf3b", { linie: 3 }) +
      st.form("M88 84 C88 76 102 76 102 84 C102 92 88 92 88 84 Z", "#e2352b", { linie: 2.4 }) +
      st.form("M136 82 C136 74 150 74 150 82 C150 90 136 90 136 82 Z", "#e2352b", { linie: 2.4 }) +
      st.form("M82 96 C100 90 140 90 158 96 C158 103 140 104 120 101 C100 104 82 103 82 96 Z", "#8d4a1f", { linie: 2.6 }) +
      `<path d="M92 106 C104 112 136 112 148 106" stroke="#fffdf6" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      augen(102, 138, 132, wut, 10) +
      mund(120, 158, 36, wut),
    // Riesige Spritze voll Knoblauchsoße
    gewicht: (st) => `<g transform="rotate(-70)">
        ${st.form("M-10 -60 Q0 -63 10 -60 L10 0 Q0 3 -10 0 Z", "#fffbe9", { linie: 2.6 })}
        <path d="M-7 -40 L7 -40 L7 -3 Q0 -1 -7 -3 Z" fill="#fff"/>
        ${st.form("M-3 -78 L3 -78 L3 -60 L-3 -60 Z", "#a3a3aa", { linie: 1.6 })}
        ${st.form("M-15 -83 Q0 -86 15 -83 L15 -77 Q0 -75 -15 -77 Z", "#a3a3aa", { linie: 1.6 })}
        ${strich("M0 2 L0 22", 2.6)}
        <text x="0" y="-26" font-size="9" font-weight="700" text-anchor="middle" fill="#c58a1a" transform="rotate(90 0 -26)">SOSSE</text>
      </g>`,
  },
  "Das Sofa der Verdammnis": {
    haut: "#7a2c8c",
    schulter: [66, 150, 174, 150],
    koerper: (st, wut) =>
      st.form("M90 64 C80 54 76 40 82 26 C86 40 96 50 106 58 Z", "#d9141c", { linie: 2.6 }) +
      st.form("M150 64 C160 54 164 40 158 26 C154 40 144 50 134 58 Z", "#d9141c", { linie: 2.6 }) +
      st.form("M66 154 C58 112 60 80 72 64 C96 50 144 50 168 64 C180 80 182 112 174 154 Z", "#7a2c8c") +
      [
        [92, 132],
        [120, 136],
        [148, 132],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#4e1a5b"/>` + strich(`M${x! - 8} ${y! - 6} l8 6 l8 -6 M${x} ${y} l0 10`, 1.6, "#4e1a5b"))
        .join("") +
      st.form("M44 198 C38 170 40 140 54 132 C70 124 84 136 84 152 L82 198 C70 202 54 202 44 198 Z", "#6a2379") +
      st.form("M196 198 C202 170 200 140 186 132 C170 124 156 136 156 152 L158 198 C170 202 186 202 196 198 Z", "#6a2379") +
      st.form("M74 190 C70 168 78 154 120 154 C162 154 170 168 166 190 C146 196 94 196 74 190 Z", "#8f3aa4") +
      strich("M120 156 C118 168 118 180 120 192", 2.4) +
      st.form("M58 198 L72 198 L68 214 L62 214 Z", "#3a1d12", { linie: 2 }) +
      st.form("M182 198 L168 198 L172 214 L178 214 Z", "#3a1d12", { linie: 2 }) +
      augen(102, 138, 96, wut, 11) +
      mund(120, 120, 40, wut),
    // Hantel aus Sofakissen
    gewicht: (st) => hantel(st, (x) => st.form(`M${x - 11} -16 C${x - 12} -24 ${x + 12} -24 ${x + 11} -16 L${x + 11} 16 C${x + 12} 24 ${x - 12} 24 ${x - 11} 16 Z`, "#c169d6", { linie: 2.4 })),
  },
  "König Bierbauch": {
    haut: "#f1bf92",
    schulter: [78, 124, 162, 124],
    koerper: (st, wut) =>
      st.form("M120 102 C168 100 186 140 180 174 C174 202 148 213 120 212 C92 213 66 202 60 174 C54 140 72 100 120 102 Z", "#f1bf92") +
      strich("M98 140 q6 -5 12 0 M130 140 q6 -5 12 0", 2.4, "#b0754d") +
      strich("M117 168 q3 5 6 0", 2.6, "#b0754d") +
      st.form("M62 170 C90 184 150 184 178 170 L180 186 C150 202 90 202 60 186 Z", "#2e58a6") +
      st.form("M120 52 C140 51 151 66 150 84 C149 102 136 112 120 112 C104 112 91 102 90 84 C89 66 100 51 120 52 Z", "#f1bf92") +
      st.form("M90 88 C88 110 100 130 112 128 C114 134 126 134 128 128 C140 130 152 110 150 88 C142 102 132 106 120 103 C108 106 98 102 90 88 Z", "#c66f2a") +
      st.form("M92 60 L94 34 L108 48 L120 26 L132 48 L146 34 L148 60 C130 54 110 54 92 60 Z", "#f4c400", { linie: 3 }) +
      `<circle cx="120" cy="44" r="3.6" fill="#d9141c" stroke="${LINIE}" stroke-width="1.4"/>` +
      augen(108, 132, 80, wut, 7) +
      mund(120, 98, 20, wut),
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
    koerper: (st, wut) => {
      const zacken = (y: number, r: number) => `M70 ${y} ` + Array.from({ length: 13 }, (_, i) => `l8 ${i % 2 === 0 ? -r : r}`).join(" ");
      return (
        st.form(`${zacken(62, 10)} L166 62 C176 104 182 152 176 198 L64 198 C58 152 64 104 74 62 Z`, "#e2352b") +
        st.form(`${zacken(196, -10)} L176 196 L176 204 L64 204 Z`, "#c42a21", { linie: 2.6 }) +
        strich("M82 80 C76 120 76 160 80 186 M158 80 C164 120 164 160 160 186", 2, "#a81f17") +
        st.form("M80 164 C80 150 100 144 120 144 C140 144 160 150 160 164 C160 178 140 184 120 184 C100 184 80 178 80 164 Z", "#f4c400", { linie: 2.8 }) +
        `<text x="120" y="171" font-size="18" font-weight="900" text-anchor="middle" fill="#e2352b">CHIPS</text>` +
        st.form("M190 120 C198 112 210 116 208 126 C206 134 194 134 190 120 Z", "#f4c400", { linie: 2 }) +
        st.form("M40 168 C46 160 58 164 56 172 C54 180 42 178 40 168 Z", "#f4c400", { linie: 2 }) +
        augen(102, 138, 100, wut, 11) +
        mund(120, 126, 38, wut)
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
    koerper: (st, wut) =>
      st.form("M74 126 C58 150 48 180 44 208 C80 214 160 214 196 208 C192 180 182 150 166 126 Z", "#5a2985") +
      strich("M74 132 C70 160 66 186 64 206 M166 132 C170 160 174 186 176 206", 2, "#3d1a5c") +
      st.form("M82 128 C80 154 82 182 86 202 C108 208 132 208 154 202 C158 182 160 154 158 128 C140 118 100 118 82 128 Z", "#e2352b") +
      st.form("M98 146 Q120 142 142 146 L142 174 Q120 178 98 174 Z", "#fffdf6", { linie: 2.2 }) +
      `<text x="120" y="164" font-size="13" font-weight="900" text-anchor="middle" fill="#e2352b">LORD</text>` +
      st.form("M120 56 C140 55 153 70 152 90 C151 108 137 120 120 120 C103 120 89 108 88 90 C87 70 100 55 120 56 Z", "#efb88b") +
      st.form("M84 90 C82 60 98 44 120 44 C142 44 158 60 156 90 C152 82 148 76 146 74 C138 66 102 66 94 74 C92 76 88 82 84 90 Z", "#f4c400") +
      st.form("M88 80 Q120 72 152 80 L152 88 Q120 80 88 88 Z", "#2f2f35", { linie: 2.2 }) +
      augen(107, 133, 98, wut, 8) +
      mund(120, 110, 22, wut),
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
    koerper: (st, wut) =>
      st.form("M80 122 C64 150 54 182 50 208 C90 214 150 214 190 208 C186 182 176 150 160 122 L148 134 L120 128 L92 134 Z", "#1f1c22") +
      `<path d="M84 128 C72 156 64 186 62 206 L80 206 Z M156 128 C168 156 176 186 178 206 L160 206 Z" fill="#a8131b"/>` +
      st.form("M120 112 C146 112 166 134 164 166 C164 172 168 176 162 182 C158 200 142 210 120 210 C98 210 82 200 78 182 C72 176 76 172 76 166 C74 134 94 112 120 112 Z", "#8b684d") +
      strich("M88 150 l-6 4 M86 164 l-7 2 M152 150 l6 4 M154 164 l7 2 M104 196 l-2 6 M136 196 l2 6", 1.8, "#5e4330") +
      `<path d="M120 140 C136 140 146 156 144 176 C142 194 132 200 120 200 C108 200 98 194 96 176 C94 156 104 140 120 140 Z" fill="#b39478" opacity=".9"/>` +
      st.form("M120 54 C144 52 160 70 158 94 C162 98 160 102 156 104 C150 122 136 128 120 128 C104 128 90 122 84 104 C80 102 78 98 82 94 C80 70 96 52 120 54 Z", "#8b684d") +
      st.form("M120 74 C140 74 152 84 150 98 C148 112 134 120 120 120 C106 120 92 112 90 98 C88 84 100 74 120 74 Z", "#e6d3bb", { licht: 0.5 }) +
      `<path d="M94 90 C98 82 110 84 114 92 C112 100 100 102 94 90 Z M146 90 C142 82 130 84 126 92 C128 100 140 102 146 90 Z" fill="#4a3426"/>` +
      augen(105, 135, 92, wut, 6) +
      `<circle cx="135" cy="92" r="9.5" fill="none" stroke="#f4c400" stroke-width="2.6"/>` +
      strich("M144 95 Q151 110 146 126", 1.6, "#f4c400") +
      `<path d="M114 103 C114 99 126 99 126 103 C126 108 114 108 114 103 Z" fill="${LINIE}"/>` +
      mund(120, 113, 20, wut) +
      st.form("M98 60 C96 46 96 34 100 26 C112 22 128 22 140 26 C144 34 144 46 142 60 Z", "#1f1c22", { licht: 0.35 }) +
      `<path d="M98 50 C112 47 128 47 142 50 L142 58 C128 55 112 55 98 58 Z" fill="#a8131b"/>` +
      st.form("M80 62 C92 56 148 56 160 62 C160 68 148 70 120 68 C92 70 80 68 80 62 Z", "#1f1c22", { licht: 0.35 }),
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

/** Ärmchen für Stufe 1, nach links gezeichnet (rechts gespiegelt): dünn, hängend, kleine Hand. */
function aermchen(st: Stift, f: Figur, x: number, y: number, s: 1 | -1): string {
  const d = "M2 -5 C-12 -3 -22 10 -24 30 C-30 34 -33 44 -27 49 C-20 53 -14 46 -17 38 C-15 18 -9 8 2 5 Z";
  return `<g transform="translate(${x} ${y}) scale(${s} 1)">${st.form(d, f.haut, { linie: 2.8 })}</g>`;
}

/** Testo-Spritze, steckt schräg im Bizeps. */
function spritze(st: Stift, x: number, y: number, winkel: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${winkel})">
    ${strich("M0 0 L0 -12", 2)}
    ${st.form("M-6 -44 Q0 -46 6 -44 L6 -12 Q0 -10 -6 -12 Z", "#e6faff", { linie: 2.2, licht: 0.9 })}
    <path d="M-4 -30 L4 -30 L4 -13 Q0 -12 -4 -13 Z" fill="#3fd13f"/>
    ${st.form("M-2 -54 L2 -54 L2 -44 L-2 -44 Z", "#a3a3aa", { linie: 1.4 })}
    ${st.form("M-9 -59 Q0 -61 9 -59 L9 -54 Q0 -53 -9 -54 Z", "#a3a3aa", { linie: 1.4 })}
    <text x="0" y="-33" font-size="7" font-weight="900" text-anchor="middle" fill="#0b6b0b">T</text>
  </g>`;
}

/**
 * Aufgepumpter Arm als eine Form: Deltamuskel, Bizepsberg, dicker Unterarm, Faust.
 * Nach links gezeichnet, Schulter im Ursprung; rechts per Spiegelung.
 */
function pumparm(st: Stift, f: Figur, x: number, y: number, s: 1 | -1, mitGewicht: boolean): string {
  const arm =
    "M2 -16 C-6 -36 -22 -50 -37 -47 C-50 -44 -55 -32 -52 -20 C-54 -30 -55 -40 -56 -48 " +
    "C-55 -58 -60 -70 -71 -71 C-84 -72 -90 -60 -85 -48 C-88 -36 -88 -14 -80 0 " +
    "C-76 14 -60 20 -46 15 C-30 13 -14 16 2 13 Z";
  const bizepsfalte = strich("M-52 -20 C-46 -13 -36 -13 -26 -18", 2.4);
  const knoechel = strich("M-80 -62 q4 -3 8 0 M-82 -54 q5 -3 10 0", 2);
  const adern = strich("M-12 -26 C-18 -36 -26 -32 -32 -38 S-40 -34 -45 -38 M-24 -20 C-30 -22 -34 -20 -38 -24 M-66 -36 C-70 -26 -68 -18 -72 -8", 2.2, "#4a74d6");
  // Gewicht nicht spiegeln, sonst stünde Schrift verkehrt
  const gewicht = mitGewicht ? `<g transform="translate(${x - s * 70} ${y - 60})">${f.gewicht(st)}</g>` : "";
  return `<g transform="translate(${x} ${y}) scale(${s} 1)">${st.form(arm, f.haut)}${bizepsfalte}${adern}${knoechel}${spritze(st, -28, -42, -16)}</g>${gewicht}`;
}

let zaehler = 0;

/** Die eigentliche Zeichnung ohne äußeres <svg>. */
export function bossZeichnung(name: string, stufe: BossStufe): string {
  const f = figurVon(name);
  const id = `b${++zaehler}`;
  const st = new Stift(id);
  const [lx, ly, rx, ry] = f.schulter;
  if (stufe === 1) {
    return `<g>${f.koerper(st, false)}${aermchen(st, f, lx, ly, 1)}${aermchen(st, f, rx, ry, -1)}</g>`;
  }
  const dampf = [
    [72, 48, -1],
    [168, 48, 1],
  ]
    .map(
      ([x, y, r]) =>
        `<g fill="#fff" opacity=".8"><path d="M${x} ${y} c-6 -2 -8 -10 -2 -13 c-1 -7 9 -9 11 -3 c6 -1 8 7 3 10 c2 6 -8 9 -12 6 Z"/><path d="M${x! + r! * 10} ${y! - 18} c-4 -1 -5 -7 -1 -9 c0 -5 7 -6 8 -2 c4 0 5 5 2 7 c1 4 -6 6 -9 4 Z"/></g>`,
    )
    .join("");
  const schweiss = `<path d="M150 68 C154 76 156 80 153 83 C150 86 146 83 147 79 C147 76 149 72 150 68 Z M92 62 C96 70 98 74 95 77 C92 80 88 77 89 73 C89 70 91 66 92 62 Z" fill="#8fd8ff" stroke="${LINIE}" stroke-width="1.3"/>`;
  return `<g transform="translate(120 128) scale(.9) translate(-120 -128)">
    <defs><radialGradient id="${id}a" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#ff2d2d" stop-opacity=".55"/><stop offset="1" stop-color="#ff2d2d" stop-opacity="0"/></radialGradient></defs>
    <circle cx="120" cy="128" r="118" fill="url(#${id}a)"/>
    ${dampf}
    <g>
      ${f.koerper(st, true)}
      ${f.extra?.(st) ?? ""}
      ${pumparm(st, f, lx, ly, 1, false)}
      ${pumparm(st, f, rx, ry, -1, true)}
      ${schweiss}
    </g>
  </g>`;
}

/** Fertiges SVG in beliebiger Größe. */
export function bossSvg(name: string, stufe: BossStufe, groesse = 240): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -20 300 280" width="${groesse}" height="${groesse}">${bossZeichnung(name, stufe)}</svg>`;
}
