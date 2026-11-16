import { createHash } from "node:crypto";
import { figurMedium } from "../figuren/arcade.js";
import { TAUZIEHEN_ARENA } from "../figuren/tauziehen-medien.js";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

interface Stand { schnitt: number[]; zug?: number }
const { tauziehenLage, tauziehenAusschlag, tauziehenWechsel, tauziehenSichtbar, tauziehenFortsetzung, tauziehenSignaturen, tauziehenSeilPunkte, tauziehenKoerperZeile, tauziehenAufstellung, tauziehenLandung, tauziehenSeilMarke } = runInNewContext(
  readFileSync(new URL("../miniapp/spiele/tauziehen.js", import.meta.url), "utf8") + ";({ tauziehenLage, tauziehenAusschlag, tauziehenWechsel, tauziehenSichtbar, tauziehenFortsetzung, tauziehenSignaturen, tauziehenSeilPunkte, tauziehenKoerperZeile, tauziehenAufstellung, tauziehenLandung, tauziehenSeilMarke })",
  { window: { addEventListener() {} }, document: { addEventListener() {} } },
) as {
  tauziehenSeilPunkte: (breite: number, versatz: number, senke: number, impuls: number, zeit: number, griffe?: {x:number;y:number;seite:number}[]) => number[][];
  tauziehenSeilMarke: (p:number[][],x:number) => number[];
  tauziehenAufstellung: (b:number,n:number) => {x:number;w:number;h:number;label:number}[];
  tauziehenLandung: (b:number,s:number,p:number,n:number,g:boolean) => {x:number;fuss:number};
  tauziehenKoerperZeile: (y: number, neigung: number, beuge: number) => {x: number; y: number};
  tauziehenLage: (s: Stand) => { schnitt: number[]; zug: number; seite: number | null };
  tauziehenAusschlag: (n: number) => number;
  tauziehenWechsel: (vorher: Stand, station: { art: string; stand: Stand }) => { korrektur: boolean; training: boolean; aktiv: number | null; wechsel: boolean; ausgleich: boolean };
  tauziehenSichtbar: (ids: string[], sp: { id: string; ich?: boolean }[], aktiv: string[], limit: number) => string[];
  tauziehenFortsetzung: (alt: string[] | undefined, neu: string[]) => number | null;
  tauziehenSignaturen: (stationen: { zeitpunkt: string; art: string; stand: Stand }[]) => string[];
};

describe("Tauziehen-Inszenierung", () => {
  it("entscheidet mit den Durchschnitten und nicht mit dem irreführenden zug-Feld oder der Teamgröße", () => {
    expect(tauziehenLage({ schnitt: [60, 90], zug: .5 })).toEqual({ schnitt: [60, 90], zug: -.2, seite: 1 });
    expect(tauziehenLage({ schnitt: [90, 60] }).seite).toBe(0);
  });
  it.each([[0, 0], [42, 42]])("hält echte Gleichstände exakt neutral: %s:%s", (l, r) => {
    expect(tauziehenLage({ schnitt: [l, r] }).seite).toBeNull();
    expect(tauziehenAusschlag(tauziehenLage({ schnitt: [l, r] }).zug)).toBe(0);
  });
  it("rundet einen sehr knappen tatsächlichen Vorsprung nicht zum Gleichstand", () => {
    expect(tauziehenLage({ schnitt: [33.333333, 33.333334] }).seite).toBe(1);
    expect(tauziehenAusschlag(-.06)).toBeLessThan(-.2);
  });
  it("begrenzt den Ausschlag und behandelt fehlende/ungültige Last als null", () => {
    expect(tauziehenAusschlag(100)).toBe(1);
    expect(tauziehenAusschlag(-100)).toBe(-1);
    expect(tauziehenLage({ schnitt: [NaN, Infinity] })).toEqual({ schnitt: [0, 0], zug: 0, seite: null });
    expect(tauziehenLage({ schnitt: [-10] }).schnitt).toEqual([0, 0]);
  });
  it("hebt nur einen echten Seitenwechsel durch Training als Führungswechsel hervor", () => {
    const w = tauziehenWechsel({ schnitt: [90, 60] }, { art: "training", stand: { schnitt: [90, 120] } });
    expect(w).toMatchObject({ training: true, aktiv: 1, wechsel: true, korrektur: false });
    expect(tauziehenWechsel({ schnitt: [0, 0] }, { art: "training", stand: { schnitt: [60, 0] } }).wechsel).toBe(false);
    expect(tauziehenWechsel({ schnitt: [60, 0] }, { art: "training", stand: { schnitt: [60, 60] } }).ausgleich).toBe(true);
  });
  it("erzählt Löschungen und sinkende Last nicht als Trainingszug oder dramatischen Führungswechsel", () => {
    for (const art of ["korrektur", "training"]) expect(tauziehenWechsel({ schnitt: [120, 90] }, { art, stand: { schnitt: [30, 90] } })).toMatchObject({ korrektur: true, training: false, wechsel: false });
    expect(tauziehenWechsel({ schnitt: [10, 10] }, { art: "tag", stand: { schnitt: [10, 10] } }).training).toBe(false);
  });
  it("behält in großen Teams die eigene und die gerade trainierende Figur mit stabilen IDs", () => {
    const sp = Array.from({ length: 80 }, (_, i) => ({ id: String(i), ich: i === 79 }));
    expect(tauziehenSichtbar(sp.map(s => s.id), sp, ["22"], 2)).toEqual(["79", "22"]);
    expect(tauziehenSichtbar(["0", "1"], sp, ["79", "1", "1", "fremd"], 3)).toEqual(["1", "0"]);
  });
  it("spielt nur neue Zustände, erzählt Änderungen neu und ignoriert geänderte Abrufzeiten", () => {
    expect(tauziehenFortsetzung(undefined, ["a", "b"])).toBe(0);
    expect(tauziehenFortsetzung(["a"], ["a", "b"])).toBe(0);
    expect(tauziehenFortsetzung(["a", "b"], ["a", "b"])).toBeNull();
    expect(tauziehenFortsetzung(["a", "b"], ["a", "c"])).toBe(0);
    const key = (zeitpunkt: string) => tauziehenSignaturen([{ zeitpunkt, art: "tag", stand: { schnitt: [10, 20] } }]);
    expect(key("2026-10-23T05:00:00Z")).toEqual(key("2026-10-23T05:05:00Z"));
  });
  it("hält Seilenden fest und verlegt die freie Welle mit dem tatsächlichen Knoten", () => {
    for (const breite of [256, 326, 448]) for (const versatz of [-.13 * breite, 0, .13 * breite]) {
      const punkte = tauziehenSeilPunkte(breite, versatz, 18, 7, 100);
      expect(punkte[0]![0]).toBeGreaterThanOrEqual(8);
      expect(punkte.at(-1)![0]).toBeLessThanOrEqual(breite-8);
      expect(punkte[0]![1]).toBeGreaterThan(228);
      expect(punkte.every(p => p.every(Number.isFinite))).toBe(true);
      expect(punkte.some(p => p[1]! > 245)).toBe(true);
    }
    expect(tauziehenSeilPunkte(0, 0, 0, 0, 0)).toEqual([]);
    const a = tauziehenSeilPunkte(320, 0, 0, 4, 0);
    expect(a).not.toEqual(tauziehenSeilPunkte(320, 0, 0, 4, 60));
    const ruhig=tauziehenSeilPunkte(320,0,0,0,0);
    expect(ruhig.slice(2,-2).every(p=>p[1]===228)).toBe(true);
  });
  it("verformt Oberkörper kontinuierlich, ohne die Füße vom Boden zu heben", () => {
    for (const neigung of [-5, 5, 18]) {
      expect(tauziehenKoerperZeile(284, neigung, 5).x).toBeCloseTo(0);
      expect(tauziehenKoerperZeile(284, neigung, 5).y).toBe(284);
      expect(tauziehenKoerperZeile(300, neigung, 5).x).toBeCloseTo(0);
      expect(tauziehenKoerperZeile(300, neigung, 5).y).toBe(300);
      expect(tauziehenKoerperZeile(80, neigung, 5).x).toBe(neigung);
      for (let y = 0; y < 300; y++) expect(tauziehenKoerperZeile(y + 1, neigung, 5).y).toBeGreaterThan(tauziehenKoerperZeile(y, neigung, 5).y);
    }
    expect(tauziehenKoerperZeile(100, 5, 3)).not.toEqual(tauziehenKoerperZeile(100, 6, 3));
  });
  it("liefert die Arena unter 100 KiB über die feste Medien-Allowlist", () => {
    const b = figurMedium(TAUZIEHEN_ARENA)!;
    expect(b.length).toBeLessThan(100 * 1024);
    expect(TAUZIEHEN_ARENA).toBe('tauziehen-arena-' + createHash('sha256').update(b).digest('hex').slice(0,12) + '.png');
    expect([b.readUInt32BE(16),b.readUInt32BE(20)]).toEqual([480,480]);
    expect(figurMedium('tauziehen-fremd.png')).toBe(null);
    expect(figurMedium('../tauziehen-medien.ts')).toBe(null);
  });

  it("bindet das sichtbare Seil an alle Hände und hält Fransen vom Rand fern",()=>{
    const griffe=[{x:50,y:230,seite:0},{x:100,y:227,seite:0},{x:205,y:226,seite:1},{x:260,y:229,seite:1}];
    const punkte=tauziehenSeilPunkte(320,30,18,7,40,griffe);
    for(const g of griffe)expect(punkte.some(p=>p[0]===g.x&&p[1]===g.y)).toBe(true);
    const m=tauziehenSeilMarke(punkte,160);expect(m[0]).toBe(160);expect(m[1]).toBeGreaterThan(230);
    expect(punkte.every(p=>p[0]!>=8&&p[0]!<=312)).toBe(true);
  });
  it("staffelt vier kleine Teams ohne verzerrte Figuren oder abgeschnittene Außenpositionen",()=>{
    for(const breite of [254,326,414,448])for(const n of [1,2,3,4]){
      const plan=tauziehenAufstellung(breite,n);expect(plan.length).toBe(n);
      for(const p of plan){expect(p.h/p.w).toBeCloseTo(1.5);expect(p.x-p.w/2-breite*.025-6).toBeGreaterThan(0);expect(p.x+p.w/2+breite*.025+6).toBeLessThan(breite);}
      for(let i=1;i<plan.length;i++)expect(plan[i]!.x).toBeGreaterThan(plan[i-1]!.x);
    }
    expect(tauziehenAufstellung(320,0)).toEqual([]);
  });
  it("verteilt Schlamm-Landungen innerhalb der Grube, auch bei Seilriss und beiden Teams",()=>{
    for(const breite of [254,326,448])for(const gleich of [true,false])for(const seite of [0,1])for(const n of [1,2,3,4])for(let i=0;i<n;i++){
      const p=tauziehenLandung(breite,seite,i,n,gleich);expect(p.x).toBeGreaterThanOrEqual(breite*.27);expect(p.x).toBeLessThanOrEqual(breite*.73);expect(p.fuss).toBeGreaterThanOrEqual(307);expect(p.fuss).toBeLessThanOrEqual(314);
    }
  });

});
