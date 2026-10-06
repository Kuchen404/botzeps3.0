import { Resvg } from "@resvg/resvg-js";

/** Rendert ein SVG als PNG für Telegram (das keine SVG-Fotos annimmt). Schrift: DejaVu Sans aus dem System. */
export function alsPng(svg: string): Buffer {
  const bild = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" } });
  return bild.render().asPng();
}
