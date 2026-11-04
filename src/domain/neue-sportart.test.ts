import { describe, expect, it } from "vitest";
import { compendiumVorschlag, entscheide, erlaubteFaktoren, noetigeStimmen, sportartName } from "./neue-sportart.js";
import { STANDARD_SPORTARTEN, faktorAusMet, schwesterName, sucheSportart, varianten } from "./sportarten.js";

describe("neue Sportart", () => {
  it("Faktor = MET − 3, auf 0,5 gerundet, Training mindestens 1, Alltag 0,5, höchstens 6", () => {
    expect(faktorAusMet(7.3)).toBe(4.5);
    expect(faktorAusMet(5.8)).toBe(3);
    expect(faktorAusMet(2.3)).toBe(1);
    expect(faktorAusMet(2.0, true)).toBe(0.5);
    expect(faktorAusMet(12)).toBe(6);
  });

  it("Startliste wie mit der Gruppe abgestimmt (Variante B)", () => {
    const f = Object.fromEntries(STANDARD_SPORTARTEN.map((s) => [s.name, s.faktor]));
    expect(f).toEqual({
      Spazierengehen: 0.5,
      Yoga: 1,
      Dehnen: 1,
      Pilates: 1,
      Tischtennis: 1,
      "Tanzen locker": 1,
      "Radfahren locker": 1,
      Wandern: 2.5,
      Krafttraining: 3,
      "Schwimmen locker": 3,
      Fußball: 4,
      HIIT: 4,
      Joggen: 4.5,
      Squash: 4.5,
      "Tanzen sportlich": 4.5,
      Klettern: 5,
      "Radfahren sportlich": 5,
      "Schwimmen sportlich": 5,
      Spinning: 6,
    });
  });

  it("schlägt Faktoren nach Compendium 2024 vor, auch für Alltag", () => {
    expect(compendiumVorschlag("Handball")).toEqual({ faktor: 6, met: 12, code: "15320" });
    expect(compendiumVorschlag(" tennis ")).toEqual({ faktor: 4, met: 6.8, code: "15675" });
    expect(compendiumVorschlag("Gartenarbeit")?.faktor).toBe(0.5);
    expect(compendiumVorschlag("Platten  tragen")?.faktor).toBe(3);
    expect(compendiumVorschlag("Gassi gehen")?.faktor).toBe(0.5);
    expect(compendiumVorschlag("Quidditch")).toBeUndefined();
  });

  it("Aliase und Varianten", () => {
    expect(sucheSportart(STANDARD_SPORTARTEN, "Laufen")?.name).toBe("Joggen");
    expect(sucheSportart(STANDARD_SPORTARTEN, "Radfahren")).toBeUndefined();
    expect(varianten(STANDARD_SPORTARTEN, "radfahren").map((s) => s.name)).toEqual(["Radfahren locker", "Radfahren sportlich"]);
    expect(schwesterName("Schwimmen locker")).toBe("Schwimmen sportlich");
    expect(schwesterName("Tanzen sportlich")).toBe("Tanzen locker");
    expect(schwesterName("Joggen")).toBeNull();
  });

  it("bereinigt Namen", () => {
    expect(sportartName("  stand up   paddling ")).toBe("Stand up paddling");
    expect(sportartName("Kickboxen")).toBe("Kickboxen");
    expect(sportartName("x")).toBeNull();
    expect(sportartName("<script>")).toBeNull();
    expect(sportartName("a".repeat(21))).toBeNull();
  });

  it("Mehrheit entscheidet, Gleichstand nach Vorschlag, sonst der niedrigere Wert", () => {
    expect(entscheide([3, 3, 2.5])).toBe(3);
    expect(entscheide([1, 4], 4)).toBe(4);
    expect(entscheide([1, 4.5])).toBe(1);
    expect(entscheide([6, 2.5, 3])).toBe(2.5);
    expect(entscheide([], 4)).toBe(4);
    expect(entscheide([])).toBe(1);
  });

  it("wählbar sind die fünf Vergleiche und der Vorschlag", () => {
    expect(erlaubteFaktoren()).toEqual([1, 2.5, 3, 4.5, 6]);
    expect(erlaubteFaktoren(4)).toEqual([1, 2.5, 3, 4, 4.5, 6]);
    expect(erlaubteFaktoren(3)).toEqual([1, 2.5, 3, 4.5, 6]);
  });

  it("die Hälfte der Gruppe reicht", () => {
    expect([1, 2, 3, 4, 5, 8].map(noetigeStimmen)).toEqual([1, 1, 2, 2, 3, 4]);
  });
});
