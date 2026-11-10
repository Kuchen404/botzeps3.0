import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Dieselben Funktionen wie im ausgelieferten Controller, ohne eine zweite Berechnung.
const funktionen = runInNewContext(
  readFileSync(new URL("./spiele/bosskampf.js", import.meta.url), "utf8") + ";({ bossAuftrittProfil, bossTrefferWucht, bossSchweinTreffer, bossSchweinZustand })",
  { document: { addEventListener() {} }, window: {} },
) as {
  bossAuftrittProfil: (motiv: string, stufe: number) => {
    motiv: string; start: { transform: string; opacity: number }[]; ende: { transform: string; opacity: number }[];
    dauer: number; erholung: number; wucht: number;
  };
  bossSchweinZustand: (schaden: number, lp: number) => string;
  bossSchweinTreffer: (schaden: number, lp: number) => string;
  bossTrefferWucht: (schaden: number, lp: number) => Record<string, number>;
};

describe("Boss-Auftritt und Trefferwucht", () => {
  it("führt jeden eigenen Auftritt lückenlos zurück zum selben sichtbaren Bühnenpunkt", () => {
    const starts = new Set();
    const enden = new Set();
    for (const motiv of ["sofa", "chips", "schweinehund", "doenerteller", "bierbauch", "lieferdienst", "gemuetlich"]) {
      for (const stufe of [1, 2]) {
        const p = funktionen.bossAuftrittProfil(motiv, stufe);
        expect(p.start[0]!.opacity).toBe(0);
        expect(p.start.at(-1)).toEqual(p.ende[0]);
        expect(p.ende.at(-1)!.opacity).toBe(1);
        expect(p.dauer + p.erholung).toBeLessThan(2000);
        enden.add(p.ende.at(-1)!.transform);
        if (stufe === 1) starts.add(JSON.stringify(p.start));
      }
      expect(funktionen.bossAuftrittProfil(motiv, 2).wucht).toBeGreaterThan(funktionen.bossAuftrittProfil(motiv, 1).wucht);
    }
    expect(starts.size).toBe(7);
    expect(enden.size).toBe(1);
  });

  it("zeigt auch ältere unbekannte Bosse mit einem vollständigen Ersatzauftritt", () => {
    const p = funktionen.bossAuftrittProfil("unbekannt", 1);
    expect(p.motiv).toBe("standard");
    expect(p.start).toEqual(funktionen.bossAuftrittProfil("sofa", 1).start);
    expect(p.ende).toEqual(funktionen.bossAuftrittProfil("sofa", 1).ende);
  });

  it("steigert die Effekte mit echtem Schaden und begrenzt auch massiven Über-Schaden", () => {
    const klein = funktionen.bossTrefferWucht(10, 1000);
    const mittel = funktionen.bossTrefferWucht(100, 1000);
    const gross = funktionen.bossTrefferWucht(1000, 1000);
    for (const key of Object.keys(klein)) {
      expect(mittel[key]!).toBeGreaterThan(klein[key]!);
      expect(gross[key]!).toBeGreaterThan(mittel[key]!);
    }
    expect(funktionen.bossTrefferWucht(1e12, 1000)).toEqual(gross);
    expect(gross.kamera).toBeLessThanOrEqual(5);
    expect(gross.schrift).toBeLessThanOrEqual(36);
  });

  it("hält gleiche LP-Anteile gleich stark und liefert für null oder negative Beiträge endliche Werte", () => {
    expect(funktionen.bossTrefferWucht(100, 1000)).toEqual(funktionen.bossTrefferWucht(200, 2000));
    expect(funktionen.bossTrefferWucht(-10, 1000)).toEqual(funktionen.bossTrefferWucht(0, 1000));
    for (const w of Object.values(funktionen.bossTrefferWucht(0, 0))) expect(Number.isFinite(w)).toBe(true);
  });
});

it('trennt kleine und große Schweinehund-Treffer exakt bei zehn Prozent der maximalen LP',()=>{
  expect(funktionen.bossSchweinTreffer(99.9,1000)).toBe('trefferKlein');expect(funktionen.bossSchweinTreffer(100,1000)).toBe('trefferGross');expect(funktionen.bossSchweinTreffer(2000,1000)).toBe('trefferGross');expect(funktionen.bossSchweinTreffer(-10,1000)).toBe('trefferKlein');
});

it('zeigt die drei Schweinehund-Zustände an den exakten verbleibenden LP-Grenzen',()=>{
  expect(funktionen.bossSchweinZustand(399.9,1000)).toBe('selbstsicher');expect(funktionen.bossSchweinZustand(400,1000)).toBe('knurrend');expect(funktionen.bossSchweinZustand(749.9,1000)).toBe('knurrend');expect(funktionen.bossSchweinZustand(750,1000)).toBe('nervoes');expect(funktionen.bossSchweinZustand(2000,1000)).toBe('nervoes');expect(funktionen.bossSchweinZustand(-100,1000)).toBe('selbstsicher');
});
