import { describe, expect, it } from "vitest";
import { compendiumVorschlag, entscheide, noetigeStimmen, sportartName } from "./neue-sportart.js";

describe("neue Sportart", () => {
  it("schlägt Stufen nach Compendium vor", () => {
    expect(compendiumVorschlag("Handball")).toEqual({ faktor: 3, met: 12 });
    expect(compendiumVorschlag(" golf ")).toEqual({ faktor: 2, met: 4.8 });
    expect(compendiumVorschlag("Bowling")).toEqual({ faktor: 1, met: 3.8 });
    expect(compendiumVorschlag("Quidditch")).toBeUndefined();
  });

  it("bereinigt Namen", () => {
    expect(sportartName("  stand up   paddling ")).toBe("Stand up paddling");
    expect(sportartName("Kickboxen")).toBe("Kickboxen");
    expect(sportartName("x")).toBeNull();
    expect(sportartName("<script>")).toBeNull();
    expect(sportartName("a".repeat(21))).toBeNull();
  });

  it("Mehrheit entscheidet, Gleichstand nach Vorschlag, sonst mittel", () => {
    expect(entscheide([3, 3, 2])).toBe(3);
    expect(entscheide([1, 3], 3)).toBe(3);
    expect(entscheide([1, 3])).toBe(1);
    expect(entscheide([1, 2, 3])).toBe(2);
    expect(entscheide([], 3)).toBe(3);
    expect(entscheide([])).toBe(2);
  });

  it("die Hälfte der Gruppe reicht", () => {
    expect([1, 2, 3, 4, 5, 8].map(noetigeStimmen)).toEqual([1, 1, 2, 2, 3, 4]);
  });
});
