import { BOSS_STUFEN, type BossStufe, SCHWAECHE_FAKTOR, bossAnzeigename } from "../scoring/boss.js";
import { fuelle } from "../texte/sprueche.js";
import { bossZeichnung } from "./figur.js";
import { bossTexte } from "./texte.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Bricht einen Text grob nach Zeichen um (DejaVu Sans, ohne Messung). */
function zeilen(text: string, max: number): string[] {
  const out: string[] = [];
  let z = "";
  for (const wort of text.split(" ")) {
    if (z && (z + " " + wort).length > max) {
      out.push(z);
      z = wort;
    } else z = z ? `${z} ${wort}` : wort;
  }
  if (z) out.push(z);
  return out;
}

/** WANTED-Steckbrief des Bosses für die Ankündigung in der Gruppe (SVG, 600 × 840). */
export function steckbriefSvg(name: string, stufe: BossStufe, lebenspunkte: number, opfer: string, schwaeche: string | null = null): string {
  const t = bossTexte(name);
  const anzeige = bossAnzeigename(name, stufe);
  const rot = "#8f1d14";
  const tinte = "#3a2412";
  const titel = zeilen(anzeige.toUpperCase(), 22);
  const info: [string, string][] = [
    ["Lebenspunkte", lebenspunkte.toLocaleString("de-DE")],
    ["Kopfgeld", `+${BOSS_STUFEN[stufe].bonus} Punkte für jeden, der mitprügelt`],
    ...(schwaeche ? ([["Schwäche", `${schwaeche} (${SCHWAECHE_FAKTOR}× Schaden)`]] as [string, string][]) : []),
    ["Angst vor", t.schwaeche],
    ["Zuletzt gesehen", fuelle(t.zuletztGesehen, { opfer })],
  ];
  let y = 656 + (titel.length - 1) * 40;
  const infoZeilen = info
    .map(([k, v]) => {
      const teile = zeilen(v, 44);
      const zeile =
        `<text x="60" y="${y}" font-size="15" font-weight="700" fill="${rot}" letter-spacing="2">${esc(k.toUpperCase())}</text>` +
        teile.map((teil, i) => `<text x="60" y="${y + 24 + i * 24}" font-size="20" fill="${tinte}">${esc(teil)}</text>`).join("");
      y += 24 + teile.length * 24 + 12;
      return zeile;
    })
    .join("");
  const hoehe = Math.max(840, y + 30);
  const flecken = [
    [70, 120, 28],
    [520, 210, 22],
    [470, 760, 34],
    [110, 640, 18],
  ]
    .map(([x, yy, r]) => `<circle cx="${x}" cy="${yy}" r="${r}" fill="#b98f55" opacity=".18"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${hoehe}" viewBox="0 0 600 ${hoehe}" font-family="DejaVu Sans">
  <rect width="600" height="${hoehe}" fill="#2a1a10"/>
  <rect x="16" y="16" width="568" height="${hoehe - 32}" rx="6" fill="#ecd9a8" stroke="#a07a45" stroke-width="4"/>
  ${flecken}
  <rect x="30" y="30" width="540" height="${hoehe - 60}" fill="none" stroke="${tinte}" stroke-width="2" stroke-dasharray="10 6"/>
  <text x="300" y="112" font-size="82" font-weight="900" text-anchor="middle" fill="${rot}" letter-spacing="6">WANTED</text>
  <text x="300" y="148" font-size="22" font-weight="700" text-anchor="middle" fill="${tinte}" letter-spacing="3">${stufe === 2 ? "AUFGEPUMPT UND GEFÄHRLICH" : "TOT ODER LEBENDIG"}</text>
  <rect x="120" y="170" width="360" height="360" fill="${stufe === 2 ? "#4a0d0f" : "#2d1846"}" stroke="${tinte}" stroke-width="4"/>
  <clipPath id="rahmen"><rect x="120" y="170" width="360" height="360"/></clipPath>
  <g clip-path="url(#rahmen)"><g transform="translate(288 356) scale(1.25) translate(-120 -128)">${bossZeichnung(name, stufe)}</g></g>
  ${titel.map((z, i) => `<text x="300" y="${590 + i * 40}" font-size="36" font-weight="900" text-anchor="middle" fill="${tinte}">${esc(z)}</text>`).join("")}
  <path d="M60 ${618 + (titel.length - 1) * 40} H540" stroke="${tinte}" stroke-width="2"/>
  ${infoZeilen}
</svg>`;
}
