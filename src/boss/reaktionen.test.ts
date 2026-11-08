import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { BOSS_REAKTIONS_PFAD, bossReaktionen, bossReaktionsMedium } from "./reaktionen.js";

describe("Eigene Reaktionsposen für Sofa und Chips", () => {
  for (const name of ["Das Sofa der Verdammnis", "Die Chipstüte des Grauens"]) {
    it(`${name}: vier unterschiedliche, vollständig beschnittene transparente Posen teilen einen Atlas`, () => {
      const bilder: Buffer[] = [];
      const uris = new Set();
      for (const stufe of [1, 2] as const) {
        const r = bossReaktionen(name, stufe)!;
        uris.add(r.atlas);
        expect(r.atlas).toMatch(/^\/api\/bossbild\/(sofa|chips)-reaktionen-[a-f0-9]{12}\.png$/);
        const atlas = bossReaktionsMedium(r.atlas.slice(BOSS_REAKTIONS_PFAD.length))!;
        expect(atlas.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
        for (const svg of [r.treffer,r.ko]) {
          expect(svg).toContain('clip-path="url(#reaktion');
          const png = new Resvg(svg.replace(r.atlas,`data:image/png;base64,${atlas.toString("base64")}`)).render();
          let sichtbar = 0;
          const pixels = png.pixels;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 128) sichtbar++;
          expect(sichtbar).toBeGreaterThan(4000);
          expect(sichtbar).toBeLessThan(45000);
          bilder.push(png.asPng());
        }
      }
      expect(uris.size).toBe(1);
      for (let a=0;a<bilder.length;a++) for (let b=a+1;b<bilder.length;b++) expect(bilder[a]!.equals(bilder[b]!)).toBe(false);
    });
  }
  it("liefert keine fremden Dateien oder fremden Bossmotive", () => {
    for (const name of ["König Bierbauch", "__proto__", "constructor"]) expect(bossReaktionen(name,1)).toBeNull();
    for (const f of ["../../.env","sofa1.png","chips-reaktionen.png","unbekannt.png"]) expect(bossReaktionsMedium(f)).toBeNull();
  });
});
