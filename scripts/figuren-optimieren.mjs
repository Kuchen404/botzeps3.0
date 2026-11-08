// ImageGen-Atlanten normalisieren. Aufruf: node scripts/figuren-optimieren.mjs quellen.json
// quellen.json: [{ "nr": 0, "path": "/absolut/zum/transparenten-3x2-atlas.png" }, …]
// ImageMagick 7 (magick) erforderlich; kein Bestandteil des Produktions-Builds.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const quellen = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (quellen.length !== 12 || new Set(quellen.map(q => q.nr)).size !== 12 || quellen.some(q => !Number.isInteger(q.nr) || q.nr < 0 || q.nr > 11)) {
  throw new Error('Genau zwölf Quellen mit eindeutigen Figurennummern 0–11 erforderlich.');
}
const ziel = new URL('../src/figuren/medien/', import.meta.url);
const temp = mkdtempSync(join(tmpdir(), 'botzeps-figuren-'));
const magick = (...args) => execFileSync('magick', args, { encoding: 'utf8' }).trim();
const dateien = [];
try {
  for (const { nr, path } of quellen) {
    const [w, h] = magick('identify', '-format', '%w %h', path).split(' ').map(Number);
    if (w % 3 || h % 2) throw new Error(`Ungültiges 3×2-Raster: ${path}`);
    const zellen = [];
    for (let i = 0; i < 6; i++) {
      const datei = join(temp, `${nr}-${i}.png`);
      magick(path, '-crop', `${w / 3}x${h / 2}+${i % 3 * w / 3}+${Math.floor(i / 3) * h / 2}`, '+repage', datei);
      const box = magick(datei, '-alpha', 'extract', '-threshold', '8%', '-format', '%@', 'info:');
      const match = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(box);
      if (!match || Number(match[1]) === 0 || Number(match[2]) === 0) throw new Error(`Leere Pose ${nr}/${i}`);
      zellen.push({ datei, box, w: Number(match[1]), h: Number(match[2]) });
    }
    // Innerhalb einer Figur identischer Maßstab; Füße in allen Posen bei y=286.
    const massstab = Math.min(190 / Math.max(...zellen.map(z => z.w)), 270 / Math.max(...zellen.map(z => z.h)));
    for (const z of zellen) {
      magick(z.datei, '-crop', z.box, '+repage', '-resize', `${Math.round(z.w * massstab)}x${Math.round(z.h * massstab)}!`, '-background', 'none', '-gravity', 'south', '-extent', '200x286', '-gravity', 'north', '-extent', '200x300', z.datei);
    }
    const atlas = join(temp, `atlas-${nr}.png`);
    magick('montage', ...zellen.map(z => z.datei), '-tile', '3x2', '-geometry', '200x300+0+0', '-background', 'none', atlas);
    // PNG-Farbtyp automatisch wählen: ein erzwungener Typ 3 verliert in manchen
    // ImageMagick-Versionen die Alpha-Palette. Der PNG-Schreiber erhält tRNS selbst.
    magick(atlas, '-strip', '-dither', 'None', '-colors', '192', '-define', 'png:compression-level=9', atlas);
    const bytes = readFileSync(atlas);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    const name = `${nr}-${hash}.png`;
    writeFileSync(new URL(name, ziel), bytes);
    dateien[nr] = name;
    console.log(`${nr}: ${name} · ${(bytes.length / 1024).toFixed(1)} KB für sechs Posen`);
  }
  writeFileSync(new URL('../src/figuren/atlanten.ts', import.meta.url), '// Generiert mit scripts/figuren-optimieren.mjs; Reihenfolge entspricht FIGUREN.\nexport const ATLAS_DATEIEN: readonly string[] = ' + JSON.stringify(dateien, null, 2) + ';\n');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
