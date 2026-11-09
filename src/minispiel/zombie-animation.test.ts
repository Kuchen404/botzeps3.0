import { createHash } from "node:crypto";
import { figurMedium } from "../figuren/arcade.js";
import { ZOMBIE_ANGRIFFE } from "../figuren/zombie-angriffe.js";
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

const warnung = runInNewContext(readFileSync(new URL('../miniapp/spiele/zombie.js', import.meta.url), 'utf8') + ';zombieWarnung', { window: { addEventListener() {} }, document: { addEventListener() {} } }) as (s: object, id: string, jetzt: number, abgeschlossen?: boolean) => {stufe:string;text:string}|null;
describe('Kalenderfristen im aktuellen Stand und Rückblick', () => {
  const gefahr = { a: { warnAb: '2026-10-19T22:00:00Z', frist: '2026-10-20T22:00:00Z' } }, s = {...start,gefahr};
  it('zeigt vor dem ersten vollständig ausgelassenen Tag keine Warnung', () => {
    expect(warnung(s,'a',Date.parse('2026-10-19T21:59:59Z'))).toBeNull();
    expect(warnung(s,'a',Date.parse('2026-10-19T22:00:00Z'))).toMatchObject({stufe:'warnung',text:'Trainieren: 24:00 h'});
  });
  it('wechselt genau sechs Stunden vor Ablauf auf rot und bleibt unter einer Minute verständlich', () => {
    expect(warnung(s,'a',Date.parse('2026-10-20T15:59:59Z'))?.stufe).toBe('warnung');
    expect(warnung(s,'a',Date.parse('2026-10-20T16:00:00Z'))).toMatchObject({stufe:'kritisch',text:'⚠ Noch 06:00 h'});
    expect(warnung(s,'a',Date.parse('2026-10-20T21:59:01Z'))?.text).toBe('⚠ Noch <1 Min.');
    expect(warnung(s,'a',Date.parse('2026-10-20T22:00:00Z'))).toMatchObject({stufe:'abgelaufen',text:'Frist abgelaufen · wird geprüft'});
    expect(s.zombies).toEqual(start.zombies);
  });
  it('hält Infizierte, fehlende oder ungültige Angaben und den Abschluss frei von Countdowns', () => {
    const jetzt=Date.parse('2026-10-20T18:00:00Z');
    expect(warnung({...biss,gefahr},'a',jetzt)).toBeNull();expect(warnung(start,'a',jetzt)).toBeNull();expect(warnung(s,'a',jetzt,true)).toBeNull();
    expect(warnung({...start,gefahr:{a:{warnAb:'kaputt',frist:'kaputt'}}},'a',jetzt)).toBeNull();
  });
  it('kann dieselben Fristen am historischen Stationszeitpunkt ohne heutiges Wissen anzeigen', () => {
    expect(warnung(s,'a',Date.parse('2026-10-19T07:00:00Z'))).toBeNull();
    expect(warnung(s,'a',Date.parse('2026-10-20T07:00:00Z'))?.text).toBe('Trainieren: 15:00 h');
  });
});

it('liefert alle 13 Angriffsatlanten unter 100 KB mit vier unterschiedlichen, transparent begrenzten Phasen', () => {
  expect(Object.keys(ZOMBIE_ANGRIFFE)).toHaveLength(13);
  for (const [key,datei] of Object.entries(ZOMBIE_ANGRIFFE)) {
    const png=figurMedium(datei)!;expect(png.length).toBeLessThanOrEqual(102400);expect(datei).toBe('zombie-angriff-'+key+'-'+createHash('sha256').update(png).digest('hex').slice(0,12)+'.png');
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([400,600]);
    const pixels=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><image href="data:image/png;base64,${png.toString('base64')}" width="400" height="600"/></svg>`).render().pixels, hashes=[];
    for(let i=0;i<4;i++){
      const x=i%2*200,y=Math.floor(i/2)*300, cell=Buffer.concat(Array.from({length:300},(_,j)=>pixels.subarray(((y+j)*400+x)*4,((y+j)*400+x+200)*4)));
      hashes.push(createHash('sha256').update(cell).digest('hex'));
      let fuss=0,rand=false;for(let cy=0;cy<300;cy++)for(let cx=0;cx<200;cx++)if(cell[(cy*200+cx)*4+3]!>20){fuss=Math.max(fuss,cy);if(cx===0||cx===199)rand=true;}
      expect(rand).toBe(false);expect(fuss).toBeGreaterThanOrEqual(280);expect(fuss).toBeLessThanOrEqual(284);
    }expect(new Set(hashes).size).toBe(4);
  }
});

it('lädt Gast-Grundposen und Gast-Angriff getrennt trotz gleichem Figurenschlüssel', async () => {
  const geladen:string[]=[];
  class Bild { onload?:()=>void; set src(url:string){geladen.push(url);this.onload?.();} }
  const laden=runInNewContext(readFileSync(new URL('../miniapp/spiele/zombie.js',import.meta.url),'utf8')+';zombieBilder', {window:{addEventListener(){}},document:{addEventListener(){}},Image:Bild}) as (a:object)=>Promise<unknown>;
  await laden({zombieBilder:{gym:'kulisse',gast:'grundposen'},zombieAngriffe:{gast:'angriff',0:'avatar0'}});
  expect(geladen.sort()).toEqual(['angriff','avatar0','grundposen','kulisse']);
});

const serum = runInNewContext(readFileSync(new URL('../miniapp/spiele/zombie.js', import.meta.url), 'utf8') + ';({zombieGegengift,zombieBissAngreifer})', {window:{addEventListener(){}},document:{addEventListener(){}}}) as {
  zombieGegengift:(vorher:object,station:{art:string;stand:object})=>string[];
  zombieBissAngreifer:(s:Stand,spieler:{id:string}[],ziel:string)=>string|null;
};
describe('Gegengift und erfolgreiche Bisse erklären Serverereignisse', () => {
  const schutz={a:{bis:'2026-10-22T22:00:00Z'}}, erneuert={...start,schutz};
  it('zeigt eine neue Dosis nur bei tatsächlicher Schutzverlängerung durch Training', () => {
    expect(serum.zombieGegengift(start,{art:'training',stand:erneuert})).toEqual(['a']);
    expect(serum.zombieGegengift(erneuert,{art:'training',stand:erneuert})).toEqual([]);
    expect(serum.zombieGegengift(erneuert,{art:'training',stand:{...start,schutz:{a:{bis:'2026-10-23T22:00:00Z'}}}})).toEqual(['a']);
    expect(serum.zombieGegengift(start,{art:'tag',stand:erneuert})).toEqual([]);
  });
  it('erzählt Wochenendschutz, jedoch keine Korrektur oder Heilung Infizierter als Einnahme', () => {
    expect(serum.zombieGegengift({...erneuert,gefahr:{a:{}}},{art:'training',stand:erneuert})).toEqual(['a']);
    expect(serum.zombieGegengift(start,{art:'korrektur',stand:erneuert})).toEqual([]);
    expect(serum.zombieGegengift(biss,{art:'training',stand:{...biss,schutz}})).toEqual([]);
    expect(serum.zombieGegengift(biss,{art:'training',stand:erneuert})).toEqual([]);
    expect(serum.zombieGegengift(start,{art:'training',stand:start})).toEqual([]);
  });
  it('besetzt einen Biss nur mit einem bereits sichtbaren Infizierten, ohne Spielstände zu verändern', () => {
    const snapshot=JSON.stringify(start),spieler=[{id:'a'},{id:'p'},{id:'b'}];
    expect(serum.zombieBissAngreifer(start,spieler,'a')).toBe('p');
    expect(serum.zombieBissAngreifer(start,[{id:'a'},{id:'b'}],'a')).toBeNull();
    expect(serum.zombieBissAngreifer({...start,patientNull:null,zombies:[]},spieler,'a')).toBeNull();
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});
