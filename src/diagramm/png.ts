import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Resvg, type ResvgRenderOptions } from "@resvg/resvg-js";

const SCHRIFT_ORDNER = ["/usr/share/fonts", "/usr/local/share/fonts"];

/** Alle DejaVu-Sans-Dateien unter den Schriftordnern (nur Verzeichnisse lesen, keine Schriften parsen). */
function dejavuDateien(ordner: string): string[] {
  try {
    return readdirSync(ordner, { recursive: true, encoding: "utf8" })
      .filter((d) => /(^|\/)DejaVuSans(-[A-Za-z]+)?\.ttf$/.test(d))
      .map((d) => join(ordner, d));
  } catch {
    return [];
  }
}

let schriften: ResvgRenderOptions["font"] | undefined;

/**
 * Schriften, einmal bestimmt: Gibt es DejaVu Sans unter /usr/share/fonts, lädt resvg nur diese Dateien.
 * Sonst werden Systemschriften und die Ordner komplett durchsucht. Dem Docker-Image fehlt fontconfig
 * (/etc/fonts), `loadSystemFonts` allein findet dort nichts und jeder Text fiele weg. Alles zu durchsuchen
 * kostet aber bei jedem Bild Zeit: auf Rechnern mit vielen Schriften (GitHub-Runner) Sekunden pro Diagramm.
 */
function schriftOptionen(): ResvgRenderOptions["font"] {
  if (!schriften) {
    const dateien = SCHRIFT_ORDNER.flatMap(dejavuDateien);
    schriften =
      dateien.length > 0
        ? { loadSystemFonts: false, fontFiles: dateien, defaultFontFamily: "DejaVu Sans" }
        : { loadSystemFonts: true, fontDirs: SCHRIFT_ORDNER, defaultFontFamily: "DejaVu Sans" };
  }
  return schriften;
}

/** Rendert ein SVG als PNG für Telegram (das keine SVG-Fotos annimmt). Schrift: DejaVu Sans aus dem System. */
export function alsPng(svg: string): Buffer {
  return new Resvg(svg, { font: schriftOptionen() }).render().asPng();
}

/** Prüft, ob resvg eine Schrift findet, d. h. ob Text überhaupt im Bild landet. */
export function schriftVorhanden(): boolean {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><text x="5" y="30" font-size="30" fill="#000">Ab</text></svg>`;
  const pixel = new Resvg(svg, { font: schriftOptionen() }).render().pixels;
  for (let i = 3; i < pixel.length; i += 4) if (pixel[i]! > 0) return true;
  return false;
}
