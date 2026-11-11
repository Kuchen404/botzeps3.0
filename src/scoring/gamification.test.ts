import { describe, expect, it } from "vitest";
import { bossAnzeigename, bossKampf, bossLebenspunkte, bossWoche, lebensbalken } from "./boss.js";
import {
  BOSS_ERFOLGE,
  ERFOLGE,
  ERFOLG_ARTEN,
  bossSiegErfolge,
  erfolgText,
  folgeErfolge,
  freischaltZeilen,
  laengsteTagesserie,
  laternenErfolge,
  sichtbar,
  trainingsErfolge,
  wochenErfolge,
  finaleErfolge,
} from "./erfolge.js";
import { BOSS_NAMEN } from "./boss.js";
import { naechsterRang, rangFuer, rangIndex } from "./raenge.js";
import { STANDARD_SEASON, seasonStand, type Teilnehmer } from "./season.js";
import { werteWochen } from "./fleiss.js";

describe("Ränge", () => {
  it("steigen mit der lebenslangen Last", () => {
    expect(rangFuer(0).name).toBe("Couchkartoffel");
    expect(rangFuer(1_499).name).toBe("Couchkartoffel");
    expect(rangFuer(1_500).name).toBe("Lauch");
    expect(rangFuer(1_000_000).name).toBe("Botzeps");
    expect(rangIndex(4_500)).toBe(2);
  });

  it("zeigen, was bis zum nächsten Rang fehlt", () => {
    expect(naechsterRang(400)).toMatchObject({ rang: { name: "Lauch" }, fehlen: 1100 });
    expect(naechsterRang(90_000)).toBeNull();
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
    expect(wochenErfolge(werteWochen([300, 450, 300, 300, 300], 300), 300)).toEqual(["wochenziel", "deckel", "serie_5"]);
    expect(wochenErfolge(werteWochen([100]), 300)).toEqual([]);
    expect(finaleErfolge(1)).toEqual(["champion", "podest"]);
    expect(finaleErfolge(3)).toEqual(["podest"]);
    expect(finaleErfolge(4)).toEqual([]);
  });
});

describe("Neue Erfolge", () => {
  it("lange Einheiten, viele Stunden, viele Sportarten", () => {
    const viel = Array.from({ length: 10 }, (_, i) => ({ datum: `2026-10-${10 + i}`, minuten: 3_000, faktor: 2 as const, sportart: `S${i}` }));
    expect(trainingsErfolge(viel)).toEqual(
      expect.arrayContaining(["minuten_30000", "einheit_120", "einheit_240", "sportarten_5", "sportarten_10"]),
    );
    const wenig = [{ datum: "2026-10-01", minuten: 239, faktor: 2 as const, sportart: "Joggen" }];
    expect(trainingsErfolge(wenig)).toEqual(["erste_einheit", "einheit_120"]);
  });

  it("jeder Boss hat seinen eigenen geheimen Erfolg, aufgepumpt gibt's extra", () => {
    for (const name of BOSS_NAMEN) expect(ERFOLGE[BOSS_ERFOLGE[name]!]).toMatchObject({ geheim: true });
    expect(bossSiegErfolge({ name: "Der innere Schweinehund", stufe: 1 })).toEqual(["bossbezwinger", "boss_schweinehund"]);
    expect(bossSiegErfolge({ name: "König Bierbauch", stufe: 2 })).toEqual(["bossbezwinger", "boss_bierbauch", "boss_aufgepumpt"]);
    expect(bossSiegErfolge({ name: "Testdrache", stufe: 1 })).toEqual(["bossbezwinger"]);
  });

  it("Bossjäger ab drei verschiedenen Bossen", () => {
    expect(folgeErfolge(["boss_sofa", "boss_doener", "bossbezwinger", "boss_aufgepumpt"])).toEqual([]);
    expect(folgeErfolge(["boss_sofa", "boss_doener", "boss_chips"])).toEqual(["bossjaeger"]);
  });

  it("Rote Laterne: erste und dritte in einer Season", () => {
    expect(laternenErfolge(0)).toEqual([]);
    expect(laternenErfolge(2)).toEqual(["laterne"]);
    expect(laternenErfolge(3)).toEqual(["laterne", "laterne_3"]);
  });

  it("geheime bleiben bis zum Freischalten unkenntlich, Schande gibt's mit 💩", () => {
    expect(sichtbar("zombie_ueberlebt", false)).toEqual({ titel: "???", beschreibung: "Geheimer Erfolg, mehr wird nicht verraten" });
    expect(sichtbar("zombie_ueberlebt", true).titel).toBe("Unbeißbar");
    expect(sichtbar("champion", false).titel).toBe("Champion");
    expect(erfolgText("tresor_huhn")).toBe("💩 Hühnchen (beim Tresor keinen Finger gerührt)");
    expect(erfolgText("champion")).toMatch(/^🏆 Champion/);
    // Nicht-geheime Erfolge verraten keine Bosse und Minispiele
    for (const art of ERFOLG_ARTEN) {
      const e: { titel: string; beschreibung: string; geheim?: boolean } = ERFOLGE[art];
      if (!e.geheim) expect(`${e.titel} ${e.beschreibung}`).not.toMatch(/Zombie|Bombe|Kopfgeld|Gipfel|Tauziehen|Tresor|Duell|aufgepumpt|Schwäche|Resistenz/);
    }
  });

  it("Freischalt-Meldung: einzeln wie gehabt, mehrere je Erfolg mit Namen", () => {
    expect(freischaltZeilen([{ name: "Kevin", arten: [] }])).toEqual([]);
    expect(freischaltZeilen([{ name: "Kevin", arten: ["champion"] }, { name: "Peter", arten: [] }])).toEqual([
      "Kevin schaltet frei:",
      "🏆 Champion (eine Season gewonnen)",
    ]);
    expect(
      freischaltZeilen([
        { name: "Kevin", arten: ["bossbezwinger", "boss_gnadenstoss"] },
        { name: "Peter", arten: ["bossbezwinger"] },
      ]),
    ).toEqual([
      "Freigeschaltet:",
      "🏆 Drachentöter (beim Sieg gegen einen Boss mitgeprügelt): Kevin, Peter",
      "🏆 Gnadenstoß (dem Boss den letzten Schlag verpasst): Kevin",
    ]);
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
