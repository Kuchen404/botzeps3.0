import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { figurMedium } from '../figuren/arcade.js';
import { DUELL_BILDER } from '../figuren/duell-medien.js';

const ctx: Record<string, any> = { window: { innerWidth: 390, addEventListener() {} }, document: { addEventListener() {} } };
runInNewContext(readFileSync(new URL('../miniapp/spiele/duell.js', import.meta.url), 'utf8'), ctx);
const paar = (a = 0, b = 0, idA = 'a', idB = 'b') => ({ a: idA, b: idB, lastA: a, lastB: b });
const stand = (...paare: ReturnType<typeof paar>[]) => ({ paare });
const wechsel = (v: unknown, n: unknown, art = 'training') => ctx.duellWechsel(v, { art, stand: n });

describe('Losduell: Wochenlast und echte Trainingsaktionen', () => {
  it('entscheidet strikt nach tatsächlicher Last, einschließlich Nachkommastellen', () => {
    expect(ctx.duellFuehrt(paar(100.01, 100))).toBe('a');
    expect(ctx.duellFuehrt(paar(100, 100.01))).toBe('b');
    expect(ctx.duellFuehrt(paar(100, 100))).toBe(null);
    expect(ctx.duellFuehrt(paar())).toBe(null);
  });
  it('zeigt den Lastanteil ohne erfundene Trefferpunkte oder Wochenziel', () => {
    expect(ctx.duellAnteil(paar())).toBe(.5); expect(ctx.duellAnteil(paar(300, 100))).toBe(.75);
    expect(ctx.duellAnteil(paar(0, 300))).toBe(0); expect(ctx.duellAnteil(paar(300, 0))).toBe(1);
  });
  it('animiert genau den tatsächlichen Beitragenden und dessen Delta', () => {
    const p = paar(120, 80), n = paar(120, 180);
    expect(wechsel(stand(p), stand(n)).aktionen).toEqual([{ key: JSON.stringify(['a', 'b']), id: 'b', delta: 100 }]);
    expect(wechsel(stand(p), stand(n)).korrektur).toBe(false);
  });
  it('behält mehrere Zuwächse in derselben Station als getrennte Aktionen', () => {
    const w = wechsel(stand(paar(), paar(0, 300, 'c', 'bot')), stand(paar(100, 80), paar(90, 300, 'c', 'bot')));
    expect(w.aktionen.map((a: any) => [a.id, a.delta])).toEqual([['a', 100], ['b', 80], ['c', 90]]);
  });
  it('lässt Botzeps von Anfang an beim Wochenziel und erzeugt kein Bottraining', () => {
    const w = wechsel(stand(paar(0, 300, 'a', 'bot')), stand(paar(300, 300, 'a', 'bot')));
    expect(w.aktionen).toHaveLength(1); expect(w.aktionen[0].id).toBe('a');
    expect(ctx.duellFuehrt(paar(300, 300, 'a', 'bot'))).toBe(null);
    expect(wechsel(stand(paar(0, 300, 'a', 'bot')), stand(paar(0, 320, 'a', 'bot'))).korrektur).toBe(true);
  });
  it('korrigiert gelöschte Trainings und geänderte Paarungen ohne Angriff', () => {
    for (const n of [stand(paar(80, 200)), stand(paar(200, 200, 'b', 'a')), stand(), stand(paar(200, 200), paar(0, 0, 'c', 'd'))]) {
      const w = wechsel(stand(paar(200, 200)), n); expect(w.korrektur).toBe(true); expect(w.aktionen).toEqual([]);
    }
  });
  it('verwendet Tages- und Korrektursnapshots nicht als Trainingsschlag', () => {
    expect(wechsel(stand(paar()), stand(paar(200, 0)), 'tag').aktionen).toEqual([]);
    expect(wechsel(stand(paar()), stand(paar(200, 0)), 'korrektur').aktionen).toEqual([]);
    expect(wechsel(stand(paar()), stand(paar())).aktionen).toEqual([]);
  });
  it('bevorzugt das eigene Duell, respektiert die Wahl und behandelt leere Gruppen', () => {
    const paare = [paar(0, 0, 'c', 'd'), paar()], spieler = [{ id: 'b', ich: true }];
    expect(ctx.duellStartpaar(paare, spieler, null)).toBe(JSON.stringify(['a', 'b']));
    expect(ctx.duellStartpaar(paare, spieler, JSON.stringify(['c', 'd']))).toBe(JSON.stringify(['c', 'd']));
    expect(ctx.duellStartpaar(paare, spieler, 'weg')).toBe(JSON.stringify(['a', 'b']));
    expect(ctx.duellStartpaar([], spieler, 'weg')).toBe(null);
  });
  it('setzt bei neuen Zuständen fort, ignoriert verschobene Snapshot-Zeiten', () => {
    const a = [{ art: 'start', zeitpunkt: 'alt', stand: stand(paar()) }, { art: 'training', stand: stand(paar(20, 0)) }];
    const alt = ctx.duellSignaturen(a);
    expect(ctx.duellFortsetzung(alt, ctx.duellSignaturen([{ ...a[0], zeitpunkt: 'neu' }, a[1]]))).toBe(null);
    expect(ctx.duellFortsetzung(alt, ctx.duellSignaturen([...a, { art: 'training', stand: stand(paar(20, 50)) }]))).toBe(1);
    expect(ctx.duellFortsetzung(alt, ctx.duellSignaturen([a[0], { art: 'korrektur', stand: stand(paar()) }]))).toBe(0);
  });
  it('begrenzt ungültige Zahlen ohne falschen Vorsprung', () => {
    expect(ctx.duellFuehrt(paar(NaN, Infinity))).toBe(null);
    expect(ctx.duellAnteil(paar(-5, NaN))).toBe(.5);
    expect(ctx.duellListe({})).toEqual([]);
  });
  it('liefert kompakte, feste PNGs mit zutreffendem Inhalts-Hash', () => {
    for (const [art, datei] of Object.entries(DUELL_BILDER)) {
      const png = figurMedium(datei)!; expect(png.subarray(1, 4).toString()).toBe('PNG'); expect(png.length).toBeLessThan(300_000);
      expect(datei).toBe('duell-' + art + '-' + createHash('sha256').update(png).digest('hex').slice(0, 12) + '.png');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(art === 'ring' ? [600, 750] : [400, 600]);
    }
    expect(figurMedium('../duell-medien.ts')).toBe(null); expect(figurMedium('duell-fremd.png')).toBe(null);
  });
  it('enthält vier unterschiedliche transparente Roboterposen statt einer Vektorpuppe', () => {
    const png = figurMedium(DUELL_BILDER.bot)!, raster = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><image href="data:image/png;base64,${png.toString('base64')}" width="400" height="600"/></svg>`).render().pixels;
    const hashes = [];
    for (let i = 0; i < 4; i++) {
      const x = i % 2 * 200, y = Math.floor(i / 2) * 300;
      expect(raster[(y * 400 + x) * 4 + 3]).toBe(0);
      const pixel = Buffer.concat(Array.from({ length: 300 }, (_, zeile) => raster.subarray(((y + zeile) * 400 + x) * 4, ((y + zeile) * 400 + x + 200) * 4)));
      expect(pixel.some((p, j) => j % 4 === 3 && p > 0)).toBe(true); hashes.push(createHash('sha256').update(pixel).digest('hex'));
    }
    expect(new Set(hashes).size).toBe(4);
  });
});
