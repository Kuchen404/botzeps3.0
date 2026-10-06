import { describe, expect, it } from "vitest";
import { bossAnzeigename, bossKampf, bossLebenspunkte, bossWoche, lebensbalken } from "./boss.js";
import { laengsteTagesserie, trainingsErfolge, wochenErfolge, finaleErfolge } from "./erfolge.js";
import { naechsterRang, rangFuer, rangIndex } from "./raenge.js";
import { STANDARD_SEASON, seasonStand, type Teilnehmer } from "./season.js";
import { werteWochen } from "./fleiss.js";

describe("Ränge", () => {
  it("steigen mit der lebenslangen Last", () => {
    expect(rangFuer(0).name).toBe("Couchkartoffel");
    expect(rangFuer(999).name).toBe("Couchkartoffel");
    expect(rangFuer(1_000).name).toBe("Lauch");
    expect(rangFuer(1_000_000).name).toBe("Botzeps");
    expect(rangIndex(3_000)).toBe(2);
  });

  it("zeigen, was bis zum nächsten Rang fehlt", () => {
    expect(naechsterRang(400)).toMatchObject({ rang: { name: "Lauch" }, fehlen: 600 });
    expect(naechsterRang(60_000)).toBeNull();
  });
});

describe("Erfolge", () => {
  it("zählt Tage am Stück", () => {
    expect(laengsteTagesserie([])).toBe(0);
    expect(laengsteTagesserie(["2026-10-01", "2026-10-02", "2026-10-02", "2026-10-04"])).toBe(2);
    expect(laengsteTagesserie(["2026-09-29", "2026-09-30", "2026-10-01"])).toBe(3);
  });

  it("aus Trainings", () => {
    expect(trainingsErfolge([])).toEqual([]);
    const tage = Array.from({ length: 7 }, (_, i) => ({ datum: `2026-10-0${i + 1}`, minuten: 150, faktor: 3 as const, sportart: `S${i % 5}` }));
    expect(trainingsErfolge(tage)).toEqual(["erste_einheit", "minuten_1000", "einheit_120", "sportarten_5", "tage_7"]);
  });

  it("aus Wochen und Finale", () => {
    expect(wochenErfolge(werteWochen([300, 450, 300, 300, 300]), 300)).toEqual(["wochenziel", "deckel", "serie_5"]);
    expect(wochenErfolge(werteWochen([100]), 300)).toEqual([]);
    expect(finaleErfolge(1)).toEqual(["champion", "podest"]);
    expect(finaleErfolge(3)).toEqual(["podest"]);
    expect(finaleErfolge(4)).toEqual([]);
  });
});

describe("Boss", () => {
  it("kommt in Woche 2 und aufgepumpt in der vorletzten", () => {
    expect(bossWoche(1, 10)).toBe(1);
    expect(bossWoche(2, 10)).toBe(8);
    expect(bossWoche(2, 4)).toBe(2);
    expect(bossWoche(1, 3)).toBeNull();
    expect(bossAnzeigename("König Bierbauch", 2)).toBe("König Bierbauch (aufgepumpt)");
  });

  it("Lebenspunkte wachsen mit der Gruppe, aufgepumpt deutlich mehr", () => {
    expect(bossLebenspunkte(2, 4, 300)).toBe(1800);
    expect(bossLebenspunkte(1, 4, 300)).toBe(1300);
    expect(bossLebenspunkte(1, 2, 300)).toBe(650);
  });

  it("Lebensbalken", () => {
    expect(lebensbalken({ lebenspunkte: 1000, schaden: 600 })).toBe("▓▓▓▓░░░░░░");
    expect(lebensbalken({ lebenspunkte: 1000, schaden: 2000 })).toBe("░░░░░░░░░░");
  });

  it("Bonus nur für Beteiligte und nur, wenn der Boss fällt", () => {
    const s = { ...STANDARD_SEASON, start: "2026-10-12" };
    const t = (id: string, minuten: number): Teilnehmer => ({
      id,
      name: id,
      beitritt: "2026-10-01",
      trainings: minuten ? [{ datum: "2026-10-20", minuten, faktor: 3 }] : [],
      messungen: [],
    });
    const gruppe = [t("a", 120), t("b", 100), t("c", 0)];
    const boss = { stufe: 1 as const, woche: 1, lebenspunkte: 600 };

    const stand = seasonStand({ ...s, bosse: [boss] }, gruppe, "2026-10-25");
    expect(Object.fromEntries(stand.map((st) => [st.id, st.bossBonus]))).toEqual({ a: 5, b: 5, c: 0 });
    expect(bossKampf(boss, stand)).toMatchObject({ schaden: 660, besiegt: true, drueckeberger: ["c"] });

    const zuStark = seasonStand({ ...s, bosse: [{ ...boss, lebenspunkte: 700 }] }, gruppe, "2026-10-25");
    expect(zuStark.every((st) => st.bossBonus === 0)).toBe(true);
  });
});
