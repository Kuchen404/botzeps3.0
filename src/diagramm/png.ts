import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";

/**
 * Schriften: zusätzlich zu den Systemschriften wird /usr/share/fonts direkt durchsucht. Im schlanken
 * Docker-Image fehlt fontconfig (/etc/fonts), dann findet resvg über `loadSystemFonts` gar nichts und
 * lässt jeden Text weg – das Diagramm hatte dann nur Linien, keine Namen und Achsen.
 */
const SCHRIFTEN: ResvgRenderOptions["font"] = {
  loadSystemFonts: true,
  fontDirs: ["/usr/share/fonts", "/usr/local/share/fonts"],
  defaultFontFamily: "DejaVu Sans",
};

/** Rendert ein SVG als PNG für Telegram (das keine SVG-Fotos annimmt). Schrift: DejaVu Sans aus dem System. */
export function alsPng(svg: string): Buffer {
  return new Resvg(svg, { font: SCHRIFTEN }).render().asPng();
}

/** Prüft, ob resvg eine Schrift findet, d. h. ob Text überhaupt im Bild landet. */
export function schriftVorhanden(): boolean {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><text x="5" y="30" font-size="30" fill="#000">Ab</text></svg>`;
  const pixel = new Resvg(svg, { font: SCHRIFTEN }).render().pixels;
  for (let i = 3; i < pixel.length; i += 4) if (pixel[i]! > 0) return true;
  return false;
}
