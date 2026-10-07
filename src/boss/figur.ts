import type { BossStufe } from "../scoring/boss.js";

/**
 * Gezeichnete Bosse als SVG (Comic-Stil, angelehnt an die Emojis von früher).
 * Stufe 1 hat Ärmchen und guckt überheblich, Stufe 2 ist aufgepumpt: dicke Bizepse
 * mit Adern, Testo-Spritzen in den Armen, Dampf, rote Aura und ein Gewicht zum Thema.
 * Das SVG hat die viewBox 0 0 240 240 und kann eingebettet oder als PNG gerendert werden.
 */

const LINIE = "#1d1d1f";

interface Figur {
  /** Farbe der Arme */
  haut: string;
  /** Schultern links und rechts, an denen die Arme ansetzen */
  schulter: readonly [number, number, number, number];
  /** Körper samt Gesicht; `wut` ist für Stufe 2 */
  koerper: (wut: boolean) => string;
  /** Gewicht in der rechten Faust (Stufe 2), Mittelpunkt der Faust als Ursprung */
  gewicht: () => string;
  /** Extra über allem in Stufe 2 (z. B. Stachelhalsband) */
  extra?: () => string;
}

function augen(x1: number, x2: number, y: number, wut: boolean, r = 9): string {
  const iris = wut ? "#e0161e" : LINIE;
  const auge = (x: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${LINIE}" stroke-width="2.5"/><circle cx="${x + (x < 120 ? 2 : -2)}" cy="${y + 1}" r="${r * 0.45}" fill="${iris}"/>`;
  // Augenbrauen: böse nach innen geneigt, sonst überheblich halb geschlossen
  const brauen = wut
    ? `<path d="M${x1 - r - 3} ${y - r - 6} L${x1 + r + 2} ${y - r + 3} M${x2 + r + 3} ${y - r - 6} L${x2 - r - 2} ${y - r + 3}" stroke="${LINIE}" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M${x1 - r} ${y - 1} A${r} ${r} 0 0 1 ${x1 + r} ${y - 1} Z M${x2 - r} ${y - 1} A${r} ${r} 0 0 1 ${x2 + r} ${y - 1} Z" fill="${LINIE}" opacity=".85"/>`;
  return auge(x1) + auge(x2) + brauen;
}

function mund(x: number, y: number, breite: number, wut: boolean): string {
  if (!wut) {
    // Fieses Grinsen
    return `<path d="M${x - breite / 2} ${y} Q${x} ${y + breite * 0.45} ${x + breite / 2} ${y - 4}" fill="none" stroke="${LINIE}" stroke-width="4" stroke-linecap="round"/>`;
  }
  const h = breite * 0.42;
  const zaehne = [0.2, 0.4, 0.6, 0.8]
    .map((t) => `<path d="M${x - breite / 2 + t * breite - 5} ${y} l5 ${h * 0.45} l5 ${-h * 0.45} Z" fill="#fff"/>`)
    .join("");
  return `<path d="M${x - breite / 2} ${y} Q${x} ${y + h * 2} ${x + breite / 2} ${y} Z" fill="#5a0b0f" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>${zaehne}`;
}

/** Hantel waagrecht durch die Faust; Scheiben in Farbe und Form frei. */
function hantel(scheibe: (x: number) => string, stange = "#9a9a9f"): string {
  return `<rect x="-38" y="-4" width="76" height="8" rx="3" fill="${stange}" stroke="${LINIE}" stroke-width="2"/>${scheibe(-32)}${scheibe(32)}`;
}

const figuren: Record<string, Figur> = {
  "Der innere Schweinehund": {
    haut: "#f6a3b5",
    schulter: [82, 132, 158, 132],
    koerper: (wut) => `
      <ellipse cx="120" cy="158" rx="50" ry="48" fill="#f6a3b5" stroke="${LINIE}" stroke-width="3"/>
      <ellipse cx="120" cy="168" rx="28" ry="26" fill="#fbcbd5"/>
      <path d="M86 62 Q70 70 74 104 Q86 96 92 78 Z M154 62 Q170 70 166 104 Q154 96 148 78 Z" fill="#8b5a3c" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="120" cy="90" r="40" fill="#f6a3b5" stroke="${LINIE}" stroke-width="3"/>
      ${augen(104, 136, 80, wut)}
      <ellipse cx="120" cy="104" rx="18" ry="12" fill="#ee7f99" stroke="${LINIE}" stroke-width="3"/>
      <ellipse cx="114" cy="104" rx="3" ry="5" fill="${LINIE}"/><ellipse cx="126" cy="104" rx="3" ry="5" fill="${LINIE}"/>
      ${mund(120, 118, 26, wut)}`,
    gewicht: () => hantel((x) => `<rect x="${x - 7}" y="-22" width="14" height="44" rx="3" fill="#2b2b2e" stroke="${LINIE}" stroke-width="2"/>`),
    // Stachelhalsband
    extra: () =>
      `<rect x="88" y="124" width="64" height="12" rx="5" fill="#2b2b2e" stroke="${LINIE}" stroke-width="2"/>` +
      [96, 108, 120, 132, 144].map((x) => `<path d="M${x - 4} 126 L${x} 114 L${x + 4} 126 Z" fill="#d9d9de" stroke="${LINIE}" stroke-width="1.5"/>`).join(""),
  },
  "Der Dönerteller XXL": {
    haut: "#e3b36a",
    schulter: [68, 140, 172, 140],
    koerper: (wut) => `
      <ellipse cx="120" cy="204" rx="86" ry="16" fill="#f4f4f6" stroke="${LINIE}" stroke-width="3"/>
      <path d="M62 196 Q50 120 82 78 L158 78 Q190 120 178 196 Z" fill="#e3b36a" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M78 84 Q90 60 104 78 Q114 56 126 76 Q140 56 150 78 Q162 64 164 86" fill="#5bbf3a" stroke="${LINIE}" stroke-width="3"/>
      <circle cx="96" cy="80" r="9" fill="#e5352b" stroke="${LINIE}" stroke-width="2"/><circle cx="142" cy="78" r="9" fill="#e5352b" stroke="${LINIE}" stroke-width="2"/>
      <path d="M84 92 L156 92" stroke="#8a4b22" stroke-width="7" stroke-linecap="round"/>
      <path d="M90 98 Q120 108 150 98" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${augen(102, 138, 130, wut, 10)}
      ${mund(120, 156, 36, wut)}`,
    // Riesige Spritze voll Knoblauchsoße
    gewicht: () => `
      <g transform="rotate(-70)">
        <rect x="-10" y="-60" width="20" height="62" rx="4" fill="#fffbe8" stroke="${LINIE}" stroke-width="2.5"/>
        <rect x="-7" y="-40" width="14" height="40" fill="#ffffff"/>
        <rect x="-3" y="-78" width="6" height="18" fill="#9a9a9f" stroke="${LINIE}" stroke-width="1.5"/>
        <rect x="-14" y="-82" width="28" height="6" rx="2" fill="#9a9a9f" stroke="${LINIE}" stroke-width="1.5"/>
        <path d="M0 2 L0 22" stroke="${LINIE}" stroke-width="2.5"/>
        <text x="0" y="-26" font-size="9" font-weight="700" text-anchor="middle" fill="#c58a1a" transform="rotate(90 0 -26)">SOSSE</text>
      </g>`,
  },
  "Das Sofa der Verdammnis": {
    haut: "#7b2d8e",
    schulter: [66, 150, 174, 150],
    koerper: (wut) => `
      <path d="M86 64 L76 40 L98 58 Z M154 64 L164 40 L142 58 Z" fill="#e0161e" stroke="${LINIE}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="62" y="58" width="116" height="104" rx="22" fill="#7b2d8e" stroke="${LINIE}" stroke-width="3"/>
      <rect x="48" y="128" width="30" height="66" rx="12" fill="#6a2479" stroke="${LINIE}" stroke-width="3"/>
      <rect x="162" y="128" width="30" height="66" rx="12" fill="#6a2479" stroke="${LINIE}" stroke-width="3"/>
      <rect x="72" y="152" width="96" height="34" rx="10" fill="#8f3ca3" stroke="${LINIE}" stroke-width="3"/>
      <path d="M120 152 L120 186" stroke="${LINIE}" stroke-width="2.5"/>
      <rect x="62" y="194" width="10" height="14" fill="#3a1d12"/><rect x="168" y="194" width="10" height="14" fill="#3a1d12"/>
      ${augen(102, 138, 96, wut, 11)}
      ${mund(120, 122, 40, wut)}`,
    // Hantel aus Sofakissen
    gewicht: () => hantel((x) => `<rect x="${x - 10}" y="-20" width="20" height="40" rx="8" fill="#c06bd6" stroke="${LINIE}" stroke-width="2"/>`),
  },
  "König Bierbauch": {
    haut: "#f2c195",
    schulter: [76, 120, 164, 120],
    koerper: (wut) => `
      <circle cx="120" cy="152" r="56" fill="#f2c195" stroke="${LINIE}" stroke-width="3"/>
      <path d="M100 142 Q104 138 108 142 M132 142 Q136 138 140 142" stroke="#b07a52" stroke-width="2.5" fill="none"/>
      <circle cx="120" cy="170" r="4" fill="#b07a52"/>
      <path d="M64 168 Q120 186 176 168 L178 182 Q120 200 62 182 Z" fill="#2f5aa8" stroke="${LINIE}" stroke-width="3"/>
      <circle cx="120" cy="82" r="30" fill="#f2c195" stroke="${LINIE}" stroke-width="3"/>
      <path d="M92 90 Q96 124 120 124 Q144 124 148 90 Q134 104 120 102 Q106 104 92 90 Z" fill="#c8742e" stroke="${LINIE}" stroke-width="2.5"/>
      <path d="M94 58 L98 34 L110 48 L120 30 L130 48 L142 34 L146 58 Z" fill="#f5c400" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="120" cy="44" r="3.5" fill="#e0161e"/>
      ${augen(108, 132, 78, wut, 7)}
      ${mund(120, 98, 20, wut)}`,
    // Bierfässer als Hantelscheiben
    gewicht: () =>
      hantel(
        (x) =>
          `<rect x="${x - 13}" y="-18" width="26" height="36" rx="9" fill="#a0612b" stroke="${LINIE}" stroke-width="2"/><path d="M${x - 13} -8 h26 M${x - 13} 8 h26" stroke="#5b3714" stroke-width="2.5"/>`,
      ),
  },
  "Die Chipstüte des Grauens": {
    haut: "#f5c400",
    schulter: [72, 136, 168, 136],
    koerper: (wut) => `
      <path d="M74 60 L166 60 L176 196 L64 196 Z" fill="#e5352b" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M72 60 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10" fill="#e5352b" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M64 196 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10 l8 10 l8 -10" fill="#e5352b" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="120" cy="164" rx="40" ry="20" fill="#f5c400" stroke="${LINIE}" stroke-width="2.5"/>
      <text x="120" y="171" font-size="18" font-weight="900" text-anchor="middle" fill="#e5352b">CHIPS</text>
      ${augen(102, 138, 98, wut, 11)}
      ${mund(120, 126, 38, wut)}`,
    // Hantel mit Chips als Scheiben
    gewicht: () => hantel((x) => `<ellipse cx="${x}" cy="0" rx="10" ry="22" fill="#f5c400" stroke="${LINIE}" stroke-width="2"/><path d="M${x - 4} -12 q4 6 0 12 q-4 6 0 12" stroke="#d29a00" stroke-width="2" fill="none"/>`),
  },
  "Der Lieferdienst-Lord": {
    haut: "#f0b98d",
    schulter: [80, 128, 160, 128],
    koerper: (wut) => `
      <path d="M70 128 L50 204 L190 204 L170 128 Z" fill="#5b2a86" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="80" y="120" width="80" height="80" rx="18" fill="#e5352b" stroke="${LINIE}" stroke-width="3"/>
      <rect x="98" y="142" width="44" height="30" rx="4" fill="#fff" stroke="${LINIE}" stroke-width="2"/>
      <text x="120" y="162" font-size="13" font-weight="900" text-anchor="middle" fill="#e5352b">LORD</text>
      <circle cx="120" cy="88" r="32" fill="#f0b98d" stroke="${LINIE}" stroke-width="3"/>
      <path d="M86 86 Q86 48 120 48 Q154 48 154 86 L146 86 Q144 62 120 62 Q96 62 94 86 Z" fill="#f5c400" stroke="${LINIE}" stroke-width="3"/>
      <rect x="88" y="78" width="64" height="8" rx="4" fill="#2b2b2e"/>
      ${augen(107, 133, 94, wut, 8)}
      ${mund(120, 108, 22, wut)}`,
    // Pizzakartons als Gewichte
    gewicht: () =>
      hantel(
        (x) =>
          `<rect x="${x - 8}" y="-24" width="16" height="48" fill="#d9a066" stroke="${LINIE}" stroke-width="2"/><path d="M${x - 8} -8 h16 M${x - 8} 8 h16" stroke="${LINIE}" stroke-width="1.5"/>`,
      ),
  },
  "Graf Gemütlich": {
    haut: "#8d6a4f",
    schulter: [80, 134, 160, 134],
    koerper: (wut) => `
      <path d="M76 124 L54 206 L186 206 L164 124 Z" fill="#1d1d1f" stroke="${LINIE}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M80 124 L64 206 L80 206 Z M160 124 L176 206 L160 206 Z" fill="#b3121b"/>
      <ellipse cx="120" cy="160" rx="44" ry="48" fill="#8d6a4f" stroke="${LINIE}" stroke-width="3"/>
      <ellipse cx="120" cy="168" rx="26" ry="30" fill="#b89a7e"/>
      <circle cx="120" cy="90" r="36" fill="#8d6a4f" stroke="${LINIE}" stroke-width="3"/>
      <ellipse cx="120" cy="96" rx="30" ry="24" fill="#e5d3bd"/>
      <ellipse cx="105" cy="92" rx="11" ry="8" fill="#4a3426" transform="rotate(-20 105 92)"/>
      <ellipse cx="135" cy="92" rx="11" ry="8" fill="#4a3426" transform="rotate(20 135 92)"/>
      ${augen(105, 135, 92, wut, 6)}
      <circle cx="135" cy="92" r="9" fill="none" stroke="#f5c400" stroke-width="2.5"/><path d="M144 94 Q150 110 146 124" stroke="#f5c400" stroke-width="1.5" fill="none"/>
      <ellipse cx="120" cy="104" rx="6" ry="4" fill="${LINIE}"/>
      ${mund(120, 112, 20, wut)}
      <rect x="96" y="30" width="48" height="30" rx="3" fill="#1d1d1f" stroke="${LINIE}" stroke-width="2"/>
      <rect x="84" y="56" width="72" height="8" rx="3" fill="#1d1d1f"/>
      <rect x="96" y="48" width="48" height="6" fill="#b3121b"/>`,
    gewicht: () => hantel((x) => `<circle cx="${x}" cy="0" r="20" fill="#2b2b2e" stroke="${LINIE}" stroke-width="2"/><circle cx="${x}" cy="0" r="6" fill="#9a9a9f"/>`),
  },
};

/** Unbekannte Namen (z. B. aus alten Datenbanken) bekommen den Schweinehund. */
function figurVon(name: string): Figur {
  return figuren[name] ?? figuren["Der innere Schweinehund"]!;
}

/** Ärmchen für Stufe 1: dünn, hängend, mit kleiner Faust. */
function aermchen(f: Figur): string {
  const [lx, ly, rx, ry] = f.schulter;
  const arm = (x: number, y: number, s: number) =>
    `<path d="M${x} ${y} q${-s * 22} 10 ${-s * 24} 38" fill="none" stroke="${LINIE}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M${x} ${y} q${-s * 22} 10 ${-s * 24} 38" fill="none" stroke="${f.haut}" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="${x - s * 24}" cy="${y + 40}" r="7" fill="${f.haut}" stroke="${LINIE}" stroke-width="2.5"/>`;
  return arm(lx, ly, 1) + arm(rx, ry, -1);
}

/** Testo-Spritze, steckt schräg im Bizeps. */
function spritze(x: number, y: number, winkel: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${winkel})">
    <path d="M0 0 L0 -12" stroke="${LINIE}" stroke-width="2"/>
    <rect x="-6" y="-44" width="12" height="32" rx="2" fill="#e9fbff" stroke="${LINIE}" stroke-width="2"/>
    <rect x="-4" y="-30" width="8" height="17" fill="#3fd13f"/>
    <rect x="-2" y="-54" width="4" height="10" fill="#9a9a9f"/>
    <rect x="-8" y="-58" width="16" height="5" rx="2" fill="#9a9a9f" stroke="${LINIE}" stroke-width="1.5"/>
    <text x="0" y="-33" font-size="7" font-weight="900" text-anchor="middle" fill="#0b6b0b">T</text>
  </g>`;
}

/** Aufgepumpter Arm: Oberarm waagrecht, Unterarm hoch, dicker Bizeps mit Adern und Spritze. */
function pumparm(f: Figur, x: number, y: number, s: 1 | -1, mitGewicht: boolean): string {
  const ellbogen = [x - s * 62, y + 4] as const;
  const faust = [x - s * 64, y - 46] as const;
  const dick = (d: string, w: number) =>
    `<path d="${d}" fill="none" stroke="${LINIE}" stroke-width="${w + 6}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${f.haut}" stroke-width="${w}" stroke-linecap="round"/>`;
  const oben = `M${x} ${y} L${ellbogen[0]} ${ellbogen[1]}`;
  const unten = `M${ellbogen[0]} ${ellbogen[1]} L${faust[0]} ${faust[1]}`;
  const bx = x - s * 36;
  const bizeps = `<ellipse cx="${bx}" cy="${y - 10}" rx="28" ry="20" fill="${f.haut}" stroke="${LINIE}" stroke-width="3"/>`;
  const adern = `<path d="M${bx - s * 16} ${y - 6} q${s * 8} -10 ${s * 16} -6 t${s * 14} -8 M${bx - s * 4} ${y - 2} q${s * 6} -6 ${s * 12} -2" stroke="#3b6fd6" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".85"/>`;
  return (
    dick(oben, 26) +
    dick(unten, 22) +
    bizeps +
    adern +
    `<circle cx="${faust[0]}" cy="${faust[1]}" r="15" fill="${f.haut}" stroke="${LINIE}" stroke-width="3"/>` +
    spritze(bx + s * 16, y - 26, s * 12) +
    (mitGewicht ? `<g transform="translate(${faust[0]} ${faust[1] - 2})">${f.gewicht()}</g>` : "")
  );
}

/** Die eigentliche Zeichnung ohne äußeres <svg>, Koordinaten 0..240. */
export function bossZeichnung(name: string, stufe: BossStufe): string {
  const f = figurVon(name);
  if (stufe === 1) return `<g>${f.koerper(false)}${aermchen(f)}</g>`;
  const [lx, ly, rx, ry] = f.schulter;
  const dampf = [
    [70, 46],
    [170, 46],
  ]
    .map(([x, y]) => `<g fill="#fff" opacity=".8"><circle cx="${x}" cy="${y}" r="9"/><circle cx="${x! + (x! < 120 ? -8 : 8)}" cy="${y! - 10}" r="7"/><circle cx="${x! + (x! < 120 ? -14 : 14)}" cy="${y! - 22}" r="5"/></g>`)
    .join("");
  const schweiss = `<path d="M150 70 q4 8 0 12 q-4 -4 0 -12 Z M92 64 q4 8 0 12 q-4 -4 0 -12 Z" fill="#7fd0ff" stroke="${LINIE}" stroke-width="1.2"/>`;
  return `<g transform="translate(120 128) scale(.9) translate(-120 -128)">
    <defs><radialGradient id="aura" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#ff2d2d" stop-opacity=".55"/><stop offset="1" stop-color="#ff2d2d" stop-opacity="0"/></radialGradient></defs>
    <circle cx="120" cy="128" r="118" fill="url(#aura)"/>
    ${dampf}
    ${f.koerper(true)}
    ${f.extra?.() ?? ""}
    ${pumparm(f, lx, ly, 1, false)}
    ${pumparm(f, rx, ry, -1, true)}
    ${schweiss}
  </g>`;
}

/** Fertiges SVG in beliebiger Größe. */
export function bossSvg(name: string, stufe: BossStufe, groesse = 240): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -20 300 280" width="${groesse}" height="${groesse}">${bossZeichnung(name, stufe)}</svg>`;
}
