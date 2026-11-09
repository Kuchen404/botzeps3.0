import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { figurMedium } from '../figuren/arcade.js';
import { TRESOR_BILDER } from '../figuren/tresor-medien.js';

const ctx: Record<string, any> = { window: { innerWidth: 390, addEventListener() {} }, document: { addEventListener() {} } };
runInNewContext(readFileSync(new URL('../miniapp/spiele/tresor.js', import.meta.url), 'utf8'), ctx);
const stand = (ziffern: number, sonst: Record<string, unknown> = {}) => ({
  summe: ziffern * 100, ziel: 400, ziffern, offen: ziffern === 4,
  code: ['0', '7', '1', '9'].map((c, i) => i < ziffern ? c : '_').join(' '),
  lasten: { a: ziffern * 100 }, ...sonst,
});
const wechsel = (v: unknown, n: unknown, art = 'training') => ctx.tresorWechsel(v, { art, stand: n });

describe('Tresor: echte Ziffern und chronologischer Coup', () => {
  it('verrät nur verdiente Ziffern, einschließlich einer führenden Null', () => {
    for (let i = 0; i <= 4; i++) expect(ctx.tresorStand(stand(i)).code).toEqual(['0', '7', '1', '9'].map((c, j) => j < i ? c : '?'));
  });
  it('maskiert versehentlich vollständig übertragene Codes und ungültige Tokens', () => {
    expect(ctx.tresorStand(stand(1, { code: '0 7 1 9', offen: true })).code).toEqual(['0', '?', '?', '?']);
    expect(ctx.tresorStand(stand(4, { code: '0 12 <b> 9' })).code).toEqual(['0', '?', '?', '9']);
  });
  it('öffnet sofort bei bestätigtem Live-Erfolg, aber nie wegen eines gerundeten Balkens', () => {
    expect(ctx.tresorStand(stand(4)).offen).toBe(true);
    expect(ctx.tresorStand(stand(3, { summe: 400, offen: true })).offen).toBe(false);
    expect(ctx.tresorStand(stand(4, { offen: false })).offen).toBe(false);
  });
  it('zählt ein Training über mehrere Viertel als eine Aktion mit mehreren neuen Schlössern', () => {
    const w = wechsel(stand(0), stand(3));
    expect(w.training).toBe(true); expect(w.ids).toEqual(['a']); expect(w.neu).toEqual([0, 1, 2]); expect(w.oeffnen).toBe(false);
  });
  it('öffnet beim vierten Schloss einmal und wiederholt den Coup nicht bei weiterem Training', () => {
    expect(wechsel(stand(3), stand(4)).oeffnen).toBe(true);
    expect(wechsel(stand(4), stand(4, { summe: 450, lasten: { a: 450 } })).oeffnen).toBe(false);
  });
  it('erkennt gelöschte Beiträge, zurückgezogene Ziffern und geänderte Ziele als Korrektur', () => {
    for (const n of [stand(1), stand(4, { lasten: { a: 300 } }), stand(4, { ziel: 500 }), stand(4, { code: '0 8 1 9' }), stand(4, { offen: false })]) {
      const w = wechsel(stand(4), n); expect(w.korrektur).toBe(true); expect(w.training).toBe(false); expect(w.neu).toEqual([]); expect(w.oeffnen).toBe(false);
    }
  });
  it('behandelt einen ausdrücklich korrigierten Zuwachs ruhig und maskiert den neuen Stand exakt', () => {
    expect(wechsel(stand(1), stand(4), 'korrektur').korrektur).toBe(true);
    expect(ctx.tresorStand(stand(1, { code: '0 7 1 9' })).code).toEqual(['0', '?', '?', '?']);
  });
  it('identifiziert jeden tatsächlichen Beitragenden und animiert keine Tages-Snapshots als Training', () => {
    expect(wechsel(stand(0), stand(1, { lasten: { a: 20, b: 80, c: 0 } })).ids).toEqual(['a', 'b']);
    expect(wechsel(stand(0), stand(1), 'tag').training).toBe(false);
  });
  it('ignoriert verschobene Snapshot-Zeiten und setzt nur bei neuen Zuständen fort', () => {
    const a = [{ art: 'start', zeitpunkt: 'alt', stand: stand(0) }, { art: 'training', stand: stand(1) }];
    const alt = ctx.tresorSignaturen(a), gleich = ctx.tresorSignaturen([{ ...a[0], zeitpunkt: 'neu' }, a[1]]);
    expect(ctx.tresorFortsetzung(alt, gleich)).toBe(null);
    expect(ctx.tresorFortsetzung(alt, ctx.tresorSignaturen([...a, { art: 'training', stand: stand(2) }]))).toBe(1);
    expect(ctx.tresorFortsetzung(alt, ctx.tresorSignaturen([a[0], { art: 'korrektur', stand: stand(0) }]))).toBe(0);
  });
  it('verteilt 80 Spieler und die eigene Figur innerhalb der mobilen Bühne', () => {
    for (const breite of [256, 326, 448]) {
      const spieler = Array.from({ length: 80 }, (_, i) => ({ id: String(i), ich: i === 79 }));
      const plan = ctx.tresorPositionen(spieler, breite, breite * 1.25);
      expect(plan.size).toBe(80); expect(plan.get('79').y).toBeGreaterThan(plan.get('0').y - .01);
      for (const p of plan.values()) { expect(p.x * breite / 100 - p.w / 2).toBeGreaterThanOrEqual(0); expect(p.x * breite / 100 + p.w / 2).toBeLessThanOrEqual(breite); expect(p.y * breite * 1.25 / 100 - p.w * 1.5).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThan(100); }
    }
    expect(ctx.tresorPositionen([], 256, 320).size).toBe(0);
  });
  it('begrenzt ungültige Werte ohne erfundene Ziffern', () => {
    expect(ctx.tresorStand({ summe: NaN, ziel: -1, ziffern: Infinity }).code).toEqual(['?', '?', '?', '?']);
    expect(ctx.tresorStand({ summe: NaN, ziel: -1, ziffern: Infinity }).offen).toBe(false);
  });
  it('liefert nur feste, kompakte Bilddateien und sperrt fremde Pfade', () => {
    for (const [art, datei] of Object.entries(TRESOR_BILDER)) {
      const b = figurMedium(datei)!;
      expect(b.subarray(1, 4).toString()).toBe('PNG'); expect(b.length).toBeLessThan(240_000);
      expect(datei).toBe('tresor-' + art + '-' + createHash('sha256').update(b).digest('hex').slice(0, 12) + '.png');
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual(art === 'raum' ? [600, 750] : art === 'tresor' ? [400, 500] : [300, 375]);
    }
    expect(figurMedium('../tresor-medien.ts')).toBe(null);
    expect(figurMedium('tresor-fremd.png')).toBe(null);
  });
});
