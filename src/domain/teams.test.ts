import { describe, expect, it } from "vitest";
import { TEAMNAMEN, teamName, teamnamen, verteile } from "./teams.js";

describe("Teams", () => {
  it("Schlangen-Draft: die Stärksten landen nicht zusammen", () => {
    const leute = [100, 90, 80, 70].map((staerke) => ({ staerke }));
    const teams = verteile(leute, 2, () => 0.5);
    expect(teams.map((t) => t.map((x) => x.staerke))).toEqual([
      [100, 70],
      [90, 80],
    ]);
  });

  it("Größen unterscheiden sich höchstens um 1, Unbekannte werden mit verteilt", () => {
    const leute = [...[50, 40].map((staerke) => ({ staerke })), ...Array.from({ length: 9 }, () => ({ staerke: null }))];
    const teams = verteile(leute, 3);
    expect(teams.map((t) => t.length).sort()).toEqual([3, 4, 4]);
    expect(teams.flat()).toHaveLength(11);
  });

  it("Teamnamen", () => {
    expect(teamName("  Bizeps   Brigade ")).toBe("Bizeps Brigade");
    expect(teamName("Die 3 Musketiere!")).toBe("Die 3 Musketiere!");
    expect(teamName("<script>")).toBeNull();
    expect(teamName("x")).toBeNull();
    expect(teamName("a".repeat(31))).toBeNull();
    const namen = teamnamen(4);
    expect(new Set(namen).size).toBe(4);
    expect(namen.every((n) => (TEAMNAMEN as readonly string[]).includes(n))).toBe(true);
    expect(teamnamen(TEAMNAMEN.length + 1).at(-1)).toBe(`Team ${TEAMNAMEN.length + 1}`);
  });
});
