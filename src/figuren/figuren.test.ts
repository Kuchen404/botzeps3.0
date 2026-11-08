import { describe, expect, it } from "vitest";
import { FIGUREN, figurSvg } from "./figuren.js";
import { teileFigurenZu } from "./zuteilung.js";

describe("Spielerfiguren", () => {
  it("12 Figuren, jede Pose rendert als SVG mit eigener clipPath-id", () => {
    expect(FIGUREN).toHaveLength(12);
    for (const [nr, f] of FIGUREN.entries()) {
      for (const pose of ["bereit", "schlag", "jubel", "ko", "ziehen", "klettern"] as const) {
        const svg = figurSvg(f, pose, { id: `t${nr}${pose}` });
        expect(svg).toMatch(/^<svg [^>]*viewBox/);
        expect(svg).toContain(`id="t${nr}${pose}k"`);
        expect(svg).not.toContain("undefined");
        expect(svg).not.toContain("NaN");
      }
    }
  });

  it("Zombie-Variante bekommt einen Farbfilter", () => {
    expect(figurSvg(FIGUREN[0]!, "bereit", { id: "z", zombie: true })).toContain('filter="url(#zz)"');
  });
});

describe("Figuren zuteilen", () => {
  it("gewählte bleiben, der Rest bekommt freie in id-Reihenfolge", () => {
    const z = teileFigurenZu([
      { id: 3, figur: null },
      { id: 1, figur: 0 },
      { id: 2, figur: null },
      { id: 4, figur: 2 },
    ]);
    expect([...z.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 0],
      [2, 1],
      [3, 3],
      [4, 2],
    ]);
  });

  it("mehr als 12 Leute: reihum doppelt", () => {
    const z = teileFigurenZu(Array.from({ length: 14 }, (_, i) => ({ id: i + 1, figur: null })));
    expect(new Set(z.values()).size).toBe(12);
    expect(z.get(13)).toBe(13 % 12);
  });
});
