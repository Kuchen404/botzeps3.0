import { describe, expect, it } from "vitest";
import { einheitsLast, gesamtLast, pruefeSchritte, schrittFaktor, serienBonus, werteWochen, wochenpunkte } from "./fleiss.js";

describe("Fleiß", () => {
  it("Last = Minuten × Faktor", () => {
    expect(einheitsLast({ minuten: 45, faktor: 2 })).toBe(90);
    expect(einheitsLast({ minuten: 30, faktor: 3 })).toBe(90);
  });

  it("Kommafaktoren: Last auf ganze Punkte gerundet", () => {
    expect(einheitsLast({ minuten: 45, faktor: 4.5 })).toBe(203);
    expect(einheitsLast({ minuten: 45, faktor: 0.5 })).toBe(23);
  });

  it("Schritte beim Spazieren: Faktor aus dem Tempo, 0,5 bis 3", () => {
    expect(schrittFaktor(60, 5400)).toBe(0.5); // 90 pro Minute
    expect(schrittFaktor(60, 6600)).toBe(1); // 110
    expect(schrittFaktor(60, 6900)).toBe(1.5); // 115
    expect(schrittFaktor(60, 7200)).toBe(2); // 120
    expect(schrittFaktor(60, 7800)).toBe(3); // 130
    expect(schrittFaktor(30, 5000)).toBe(3); // 167, gedeckelt
    expect(pruefeSchritte(60, 7200)).toBeNull();
    expect(pruefeSchritte(60, 8400)).toBeNull(); // 140, gerade noch Gehen
    // Schritte vom ganzen Tag auf einen kurzen Spaziergang gerechnet
    expect(pruefeSchritte(45, 8715)).toBe(
      "8.715 Schritte in 45 min wären 194 pro Minute, das ist kein Spazieren mehr (höchstens 140). Nur die Schritte vom Spaziergang selbst zählen, nicht die vom ganzen Tag.",
    );
    expect(pruefeSchritte(60, 1000)).toContain("passt nicht");
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

  it("vergibt 10 Punkte für das Wochenziel (450) und deckelt bei 15", () => {
    expect(wochenpunkte(0)).toBe(0);
    expect(wochenpunkte(225)).toBe(5);
    expect(wochenpunkte(450)).toBe(10);
    expect(wochenpunkte(675)).toBe(15);
    expect(wochenpunkte(10_000)).toBe(15);
    expect(wochenpunkte(150, 300)).toBe(5);
  });

  it("Wochenziel: 150 min Krafttraining, 100 min Joggen, 75 min Spinning oder 15 Stunden Spazieren", () => {
    const krafttraining = gesamtLast(
      ["2026-10-12", "2026-10-14", "2026-10-16"].map((datum) => ({ datum, minuten: 50, faktor: 3 })),
    );
    const joggen = gesamtLast([{ datum: "2026-10-12", minuten: 100, faktor: 4.5 }]);
    const spinning = gesamtLast([{ datum: "2026-10-12", minuten: 75, faktor: 6 }]);
    const spazieren = gesamtLast(
      Array.from({ length: 8 }, (_, i) => ({ datum: `2026-10-${12 + i}`, minuten: 112.5, faktor: 0.5 })),
    );
    expect([krafttraining, joggen, spinning]).toEqual([450, 450, 450]);
    expect(spazieren).toBeGreaterThanOrEqual(448);
  });

  it("Serienbonus ab der 3. Woche, höchstens +3", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(serienBonus)).toEqual([0, 0, 1, 2, 3, 3, 3]);
  });

  it("verpasstes Ziel bricht die Serie", () => {
    const wochen = werteWochen([450, 450, 450, 449, 450, 450, 450]);
    expect(wochen.map((w) => w.serie)).toEqual([1, 2, 3, 0, 1, 2, 3]);
    expect(wochen.map((w) => w.bonus)).toEqual([0, 0, 1, 0, 0, 0, 1]);
    expect(wochen[3]?.punkte).toBeCloseTo(9.978, 3);
  });

  it("gute Season mit 10 Wochen ergibt rund 100 Fleißpunkte plus Bonus", () => {
    const summe = werteWochen(Array(10).fill(450)).reduce((s, w) => s + w.punkte, 0);
    // 10 × 10 Basis + Bonus 1 + 2 + 3 × 6
    expect(summe).toBe(100 + 1 + 2 + 18);
  });
});
