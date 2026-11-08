import { describe, expect, it } from "vitest";
import { FIGUREN, figurSvg } from "./figuren.js";

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

