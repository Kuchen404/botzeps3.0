import { describe, expect, it } from "vitest";
import { einheitsLast, gesamtLast, serienBonus, werteWochen, wochenpunkte } from "./fleiss.js";

describe("Fleiß", () => {
  it("Last = Minuten × Faktor", () => {
    expect(einheitsLast({ minuten: 45, faktor: 2 })).toBe(90);
    expect(einheitsLast({ minuten: 30, faktor: 3 })).toBe(90);
  });

  it("deckelt eine Einheit bei 120 Minuten", () => {
    expect(einheitsLast({ minuten: 240, faktor: 1 })).toBe(120);
  });

  it("zählt pro Tag nur die zwei stärksten Einheiten", () => {
    const tag = "2026-10-12";
    const last = gesamtLast([
      { datum: tag, minuten: 10, faktor: 1 },
      { datum: tag, minuten: 60, faktor: 3 },
      { datum: tag, minuten: 30, faktor: 2 },
      { datum: "2026-10-13", minuten: 20, faktor: 1 },
    ]);
    expect(last).toBe(180 + 60 + 20);
  });

  it("vergibt 10 Punkte für das Wochenziel und deckelt bei 15", () => {
    expect(wochenpunkte(0)).toBe(0);
    expect(wochenpunkte(150)).toBe(5);
    expect(wochenpunkte(300)).toBe(10);
    expect(wochenpunkte(450)).toBe(15);
    expect(wochenpunkte(10_000)).toBe(15);
  });

  it("Beispiele aus dem Konzept erreichen das Wochenziel", () => {
    const krafttraining = gesamtLast(
      ["2026-10-12", "2026-10-14", "2026-10-16"].map((datum) => ({ datum, minuten: 50, faktor: 2 as const })),
    );
    const joggen = gesamtLast([{ datum: "2026-10-12", minuten: 100, faktor: 3 }]);
    expect(krafttraining).toBe(300);
    expect(joggen).toBe(300);
  });

  it("Serienbonus ab der 3. Woche, höchstens +3", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(serienBonus)).toEqual([0, 0, 1, 2, 3, 3, 3]);
  });

  it("verpasstes Ziel bricht die Serie", () => {
    const wochen = werteWochen([300, 300, 300, 299, 300, 300, 300]);
    expect(wochen.map((w) => w.serie)).toEqual([1, 2, 3, 0, 1, 2, 3]);
    expect(wochen.map((w) => w.bonus)).toEqual([0, 0, 1, 0, 0, 0, 1]);
    expect(wochen[3]?.punkte).toBeCloseTo(9.967, 3);
  });

  it("gute Season mit 10 Wochen ergibt rund 100 Fleißpunkte plus Bonus", () => {
    const summe = werteWochen(Array(10).fill(300)).reduce((s, w) => s + w.punkte, 0);
    // 10 × 10 Basis + Bonus 1 + 2 + 3 × 6
    expect(summe).toBe(100 + 1 + 2 + 18);
  });
});
