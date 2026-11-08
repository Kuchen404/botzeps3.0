import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { BOSS_NAMEN } from "../scoring/boss.js";
import { bossSvg } from "./figur.js";
import { steckbriefSvg } from "./plakat.js";

describe("Arcade-Bosse", () => {
  for (const name of BOSS_NAMEN) {
    it(`${name}: beide Formen rendern mit eingebetteten Bildern`, () => {
      const formen = [1, 2].map(stufe => {
        const svg = bossSvg(name, stufe as 1 | 2);
        expect(Buffer.byteLength(svg)).toBeLessThan(180_000);
        const png = new Resvg(svg).render();
        let sichtbar = 0;
        const pixels = png.pixels;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 128) sichtbar++;
        expect(sichtbar).toBeGreaterThan(4_000);
        expect(sichtbar).toBeLessThan(45_000);
        const plakat = steckbriefSvg(name, stufe as 1 | 2, 2400, "Alex");
        expect(new Resvg(plakat).render().width).toBe(600);
        return png.asPng();
      });
      expect(formen[0]!.equals(formen[1]!)).toBe(false);
    });
  }
  it("behält die Vektor-Ersatzfigur für unbekannte Namen", () => {
    expect(bossSvg("Unbekannt", 1)).not.toContain("data:image/png");
  });
});
