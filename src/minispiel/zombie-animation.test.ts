import { createHash } from "node:crypto";
import { figurMedium } from "../figuren/arcade.js";
import { ZOMBIE_BILDER } from "../figuren/zombie-medien.js";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

interface Stand { patientNull: string | null; zombies: { id: string; tag: number }[]; menschen: string[] }
const { zombieInfizierte, zombieWechsel, zombieFortsetzung, zombieSignaturen } = runInNewContext(
  readFileSync(new URL("../miniapp/spiele/zombie.js", import.meta.url), "utf8") + ";({ zombieInfizierte, zombieWechsel, zombieFortsetzung, zombieSignaturen })",
  { window: { addEventListener() {} }, document: { addEventListener() {} } },
) as {
  zombieInfizierte: (stand: Stand) => Set<string>;
  zombieWechsel: (vorher: Stand, station: { art: string; stand: Stand }) => { korrektur: boolean; bisse: string[] };
  zombieFortsetzung: (alt: string[] | undefined, neu: string[]) => number | null;
  zombieSignaturen: (stationen: { art: string; stand: Stand; zeitpunkt: string }[]) => string[];
};
const start: Stand = { patientNull: "p", zombies: [{ id: "p", tag: 0 }], menschen: ["a", "b"] };
const biss: Stand = { patientNull: "p", zombies: [{ id: "p", tag: 0 }, { id: "a", tag: 1 }, { id: "b", tag: 1 }], menschen: [] };

describe("Zombie-Inszenierung folgt den Serverzuständen", () => {
  it("zählt Patient Null von Anfang an als Zombie und führt dieselbe ID nur einmal", () => {
    expect([...zombieInfizierte({ ...start, zombies: [] })]).toEqual(["p"]);
    expect([...zombieInfizierte({ ...start, zombies: [...start.zombies, ...start.zombies] })]).toEqual(["p"]);
    expect([...zombieInfizierte({ patientNull: null, zombies: [], menschen: [] })]).toEqual([]);
  });
  it("inszeniert mehrere neue Bisse einzeln, ohne einen erfundenen Verursacher zuzuordnen", () => {
    expect(zombieWechsel(start, { art: "tag", stand: biss })).toEqual({ korrektur: false, bisse: ["a", "b"] });
    expect(zombieWechsel(biss, { art: "tag", stand: biss }).bisse).toEqual([]);
  });
  it("heilt bei einem normalen Training niemanden, solange der Serverstand unverändert bleibt", () => {
    expect(zombieWechsel(biss, { art: "training", stand: biss })).toEqual({ korrektur: false, bisse: [] });
    expect([...zombieInfizierte(biss)]).toEqual(["p", "a", "b"]);
  });
  it("erzählt Löschkorrekturen nicht als neuen Angriff, selbst wenn sie Zombies ergänzen", () => {
    expect(zombieWechsel(start, { art: "korrektur", stand: biss })).toEqual({ korrektur: true, bisse: [] });
  });
  it("behandelt rückwirkend entfernte Infektionen als Korrektur statt als Heilung im Kampf", () => {
    expect(zombieWechsel(biss, { art: "training", stand: start })).toEqual({ korrektur: true, bisse: [] });
    expect(zombieWechsel(start, { art: "tag", stand: { ...start, patientNull: "b" } }).korrektur).toBe(true);
  });
  it("spielt beim ersten Öffnen ab Anfang und nach einer Aktualisierung nur neue Stationen", () => {
    expect(zombieFortsetzung(undefined, ["start", "biss-a"])).toBe(0);
    expect(zombieFortsetzung(["start", "biss-a"], ["start", "biss-a", "biss-b"])).toBe(1);
    expect(zombieFortsetzung(["start", "biss-a"], ["start", "biss-a"])).toBeNull();
  });
  it("erzählt veränderte oder verkürzte Historien neu, auch bei gleichem Endstand", () => {
    expect(zombieFortsetzung(["start", "biss-a", "ende"], ["start", "biss-b", "ende"])).toBe(0);
    expect(zombieFortsetzung(["start", "biss-a"], ["start"])).toBe(0);
    expect(zombieFortsetzung(undefined, [])).toBeNull();
  });
  it("wiederholt vor der Morgenmeldung keinen Biss nur wegen einer neuen Abrufzeit", () => {
    const alt = zombieSignaturen([{ art: "tag", stand: biss, zeitpunkt: "2026-10-24T05:00:00Z" }]);
    const neu = zombieSignaturen([{ art: "tag", stand: biss, zeitpunkt: "2026-10-24T05:05:00Z" }]);
    expect(zombieFortsetzung(alt, neu)).toBeNull();
    expect(zombieSignaturen([{ art: "korrektur", stand: biss, zeitpunkt: "2026-10-24T05:05:00Z" }])).not.toEqual(alt);
  });
});

const extra = runInNewContext(readFileSync(new URL('../miniapp/spiele/zombie.js', import.meta.url), 'utf8') + ';({ zombiePositionen, zombieVersuch, zombieVerlaufGeaendert })', { window: { addEventListener() {} }, document: { addEventListener() {} } }) as {
  zombieVerlaufGeaendert: (alt: string[] | undefined, neu: string[]) => boolean;
  zombiePositionen: (s: Stand, spieler: { id: string }[], breite: number) => { hoehe: number; plan: Map<string, { x: number; y: number; w: number; zombie: boolean }> };
  zombieVersuch: (s: Stand, spieler: { id: string }[], index: number) => { angreifer: string; ziel: string } | null;
};
describe('Gemeinsames Gym und dekorative Abwehr', () => {
  it('plant jeden Spieler genau einmal samt Platz für sein Namensschild', () => {
    for (const n of [1, 6, 12, 80]) for (const breite of [256, 326, 448]) for (const infiziert of [1, Math.ceil(n / 2), n]) {
      const spieler = Array.from({ length: n }, (_, i) => ({ id: String(i) }));
      const s: Stand = { patientNull: '0', zombies: spieler.slice(0, infiziert).map(sp => ({ id: sp.id, tag: 0 })), menschen: spieler.slice(infiziert).map(sp => sp.id) };
      const p = extra.zombiePositionen(s, spieler, breite); expect(p.plan.size).toBe(n);
      const boxes = [...p.plan.values()].map(e => ({ l: e.x - e.w * .72, r: e.x + e.w * .72, t: e.y - e.w * 1.5 - 27, b: e.y }));
      for (let i = 0; i < boxes.length; i++) { const b = boxes[i]!; expect(b.l).toBeGreaterThanOrEqual(0); expect(b.r).toBeLessThanOrEqual(breite); expect(b.t).toBeGreaterThanOrEqual(0); expect(b.b).toBeLessThan(p.hoehe); for (let j = 0; j < i; j++) { const v = boxes[j]!; expect(b.l < v.r && b.r > v.l && b.t < v.b && b.b > v.t).toBe(false); } }
    }
  });
  it('wählt nur bekannte Infizierte und tatsächlich noch menschliche Ziele', () => {
    const spieler = [{ id: 'p' }, { id: 'a' }, { id: 'b' }];
    expect(extra.zombieVersuch(start, spieler, 0)).toEqual({ angreifer: 'p', ziel: 'a' });
    expect(extra.zombieVersuch(start, spieler, 1)).toEqual({ angreifer: 'p', ziel: 'b' });
    expect(extra.zombieVersuch(biss, spieler, 0)).toBe(null);
    expect(extra.zombieVersuch({ ...start, patientNull: 'weg', zombies: [] }, spieler, 0)).toBe(null);
    expect(extra.zombieVersuch(start, [], 0)).toBe(null);
  });
  it('verändert durch die Auswahl eines Abwehrversuchs keine Spielzustände', () => {
    const kopie = JSON.stringify(start); for (let i = 0; i < 20; i++) extra.zombieVersuch(start, [{ id: 'p' }, { id: 'a' }, { id: 'b' }], i);
    expect(JSON.stringify(start)).toBe(kopie);
  });
});

describe('Zombie-Gym-Medien', () => {
  it('liefert nur feste, kompakte PNGs mit passenden Hashes und vier transparenten Gastposen', () => {
    for (const [art, datei] of Object.entries(ZOMBIE_BILDER)) { const b = figurMedium(datei)!; expect(b.length).toBeLessThan(220_000); expect(datei).toBe('zombie-gym-' + art + '-' + createHash('sha256').update(b).digest('hex').slice(0, 12) + '.png'); expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual(art === 'gym' ? [600, 750] : [400, 600]); }
    const png = figurMedium(ZOMBIE_BILDER.gast)!, raster = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><image href="data:image/png;base64,${png.toString('base64')}" width="400" height="600"/></svg>`).render().pixels, hashes = [];
    for (let i = 0; i < 4; i++) { const x = i % 2 * 200, y = Math.floor(i / 2) * 300; expect(raster[(y * 400 + x) * 4 + 3]).toBe(0); const b = Buffer.concat(Array.from({ length: 300 }, (_, j) => raster.subarray(((y + j) * 400 + x) * 4, ((y + j) * 400 + x + 200) * 4))); expect(b.some((n, j) => j % 4 === 3 && n > 0)).toBe(true); hashes.push(createHash('sha256').update(b).digest('hex')); }
    expect(new Set(hashes).size).toBe(4); expect(figurMedium('../zombie-medien.ts')).toBe(null); expect(figurMedium('zombie-fremd.png')).toBe(null);
  });
});

it('spielt den ersten neuen Biss nach einem gesehenen Start ab statt ihn als Korrektur zu überspringen', () => {
  expect(zombieFortsetzung(['start'], ['start', 'biss-a'])).toBe(0);
  expect(extra.zombieVerlaufGeaendert(['start'], ['start', 'biss-a'])).toBe(false);
  expect(extra.zombieVerlaufGeaendert(['start', 'biss-a'], ['start', 'biss-b'])).toBe(true);
  expect(extra.zombieVerlaufGeaendert(['start', 'biss-a'], ['start'])).toBe(true);
  expect(extra.zombieVerlaufGeaendert(undefined, ['start'])).toBe(false);
});
