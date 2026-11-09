import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

interface Stand { schnitt: number[]; zug?: number }
const { tauziehenLage, tauziehenAusschlag, tauziehenWechsel, tauziehenSichtbar, tauziehenFortsetzung, tauziehenSignaturen } = runInNewContext(
  readFileSync(new URL("../miniapp/spiele/tauziehen.js", import.meta.url), "utf8") + ";({ tauziehenLage, tauziehenAusschlag, tauziehenWechsel, tauziehenSichtbar, tauziehenFortsetzung, tauziehenSignaturen })",
  { window: { addEventListener() {} }, document: { addEventListener() {} } },
) as {
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
});
