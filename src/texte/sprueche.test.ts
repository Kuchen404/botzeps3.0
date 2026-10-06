import { describe, expect, it } from "vitest";
import { SPRUECHE, fuelle, platzKategorie, waehleSpruch, type Kategorie } from "./sprueche.js";

describe("Sprüche", () => {
  it("jede Kategorie hat Sprüche", () => {
    for (const [kategorie, liste] of Object.entries(SPRUECHE)) {
      expect(liste.length, kategorie).toBeGreaterThan(0);
    }
  });

  it("nutzt nur bekannte Platzhalter", () => {
    const erlaubt = new Set(["name", "platz", "punkte", "abstand", "minuten", "sportart", "serie", "opfer", "rang", "boss"]);
    for (const liste of Object.values(SPRUECHE)) {
      for (const spruch of liste) {
        for (const [, p] of spruch.matchAll(/\{(\w+)\}/g)) expect(erlaubt, spruch).toContain(p);
      }
    }
  });

  it("füllt Platzhalter", () => {
    expect(fuelle("{name} auf Platz {platz} mit {punkte}", { name: "Kevin", platz: 2, punkte: 87.5 })).toBe(
      "Kevin auf Platz 2 mit 87.5",
    );
    expect(fuelle("{name} {unbekannt}", { name: "Kevin" })).toBe("Kevin {unbekannt}");
  });

  it("ordnet Plätze Kategorien zu", () => {
    const bei9 = Array.from({ length: 9 }, (_, i) => platzKategorie(i + 1, 9));
    expect(bei9).toEqual<Kategorie[]>(["platz1", "oben", "oben", "mitte", "mitte", "mitte", "unten", "unten", "letzter"]);
    expect(platzKategorie(1, 1)).toBe("platz1");
    expect(platzKategorie(2, 2)).toBe("letzter");
  });

  it("wiederholt nicht den vorherigen Spruch", () => {
    const erster = waehleSpruch("platz1", undefined, () => 0);
    for (let i = 0; i < 50; i++) {
      expect(waehleSpruch("platz1", erster, Math.random)).not.toBe(erster);
    }
    expect(waehleSpruch("platz1", undefined, () => 0.9999999)).toBe(SPRUECHE.platz1.at(-1));
  });
});
