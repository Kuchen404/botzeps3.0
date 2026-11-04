import { describe, expect, it } from "vitest";
import { istFaktorMinimalist, kuschelsportler, lauwarmBeimPost, lauwarmBilanz } from "./lauwarm.js";

const t = (faktor: number, minuten = 30) => ({ faktor, minuten });

describe("Faktor-Minimalisten", () => {
  it("zählt ×0,5 und ×1 als Kuschelsport, ×1,5 nicht mehr", () => {
    expect(lauwarmBilanz([t(0.5, 40), t(1, 20), t(1.5), t(4.5)])).toEqual({ eintraege: 4, lauwarm: 2, minuten: 60 });
  });

  it("braucht mindestens 3 Kuschel-Einträge und ⅔ aller Einträge", () => {
    expect(istFaktorMinimalist(lauwarmBilanz([t(1), t(1)]))).toBe(false);
    expect(istFaktorMinimalist(lauwarmBilanz([t(1), t(1), t(0.5)]))).toBe(true);
    expect(istFaktorMinimalist(lauwarmBilanz([t(1), t(1), t(0.5), t(4.5)]))).toBe(true); // 75 %
    expect(istFaktorMinimalist(lauwarmBilanz([t(1), t(1), t(0.5), t(4.5), t(3)]))).toBe(false); // 60 %
  });

  it("Spruch beim Post nur bei jedem 3. Kuschel-Eintrag der Woche", () => {
    const woche = (n: number) => lauwarmBilanz(Array.from({ length: n }, () => t(1)));
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => lauwarmBeimPost(t(1), woche(n)))).toEqual([false, false, true, false, false, true, false]);
    // Ein richtiges Training löst nie etwas aus
    expect(lauwarmBeimPost(t(4.5), lauwarmBilanz([t(1), t(1), t(1), t(4.5)]))).toBe(false);
  });

  it("Kuschelsportler der Woche: höchster Anteil, dann meiste Minuten", () => {
    const k = kuschelsportler([
      { id: "a", bilanz: lauwarmBilanz([t(1, 60), t(1, 60), t(1, 60), t(5)]) },
      { id: "b", bilanz: lauwarmBilanz([t(1, 10), t(1, 10), t(1, 10)]) },
      { id: "c", bilanz: lauwarmBilanz([t(1, 50), t(1, 50), t(1, 50)]) },
      { id: "d", bilanz: lauwarmBilanz([t(5), t(5)]) },
    ]);
    expect(k?.id).toBe("c");
    expect(kuschelsportler([{ id: "d", bilanz: lauwarmBilanz([t(1), t(5)]) }])).toBeUndefined();
  });
});
