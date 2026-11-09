import { describe, expect, it } from "vitest";
import { FIGUREN, figurSvg, figurLaufSvg } from "./figuren.js";
import { createHash } from "node:crypto";
import { ATLAS_DATEIEN } from "./atlanten.js";
import { figurMedium } from "./arcade.js";
import { Resvg } from "@resvg/resvg-js";

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

  it("jede Lauf-Figur hat getrennte Gelenke und verwendet ihren vorhandenen Avatar-Atlas", () => {
    for (let nr=0;nr<FIGUREN.length;nr++) {
      const svg=figurLaufSvg(nr,`lauf${nr}`)!;
      expect(svg.match(/class="bz-lauf-arm /g)).toHaveLength(2);
      expect(svg.match(/class="bz-lauf-bein /g)).toHaveLength(2);
      expect(svg.match(/class="bz-lauf-wade"/g)).toHaveLength(2);
      expect(svg).toContain(ATLAS_DATEIEN[nr]);expect(svg).toContain(FIGUREN[nr]!.shirt);
      expect(svg).not.toMatch(/undefined|NaN/);
      const eingebettet=svg.replace(`/api/figurbild/${ATLAS_DATEIEN[nr]}`,`data:image/png;base64,${figurMedium(ATLAS_DATEIEN[nr]!)!.toString("base64")}`);
      const pixel=new Resvg(eingebettet).render().pixels;
      expect(pixel.some((a,i)=>i%4===3&&a>0)).toBe(true);
    }
    expect(figurLaufSvg(-1,"unbekannt")).toBeNull();expect(figurLaufSvg(12,"unbekannt")).toBeNull();
  });

  it("Zombie-Variante bekommt einen Farbfilter", () => {
    expect(figurSvg(FIGUREN[0]!, "bereit", { id: "z", zombie: true })).toContain('filter="url(#zz)"');
  });

  it("jede Figur teilt für alle Posen einen vollständigen, versionierten PNG-Atlas", () => {
    expect(ATLAS_DATEIEN).toHaveLength(FIGUREN.length);
    for (const [nr, f] of FIGUREN.entries()) {
      const datei = ATLAS_DATEIEN[nr]!;
      const png = figurMedium(datei)!;
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([600, 600]);
      expect(png.length).toBeLessThan(100 * 1024);
      const raster = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><image href="data:image/png;base64,${png.toString("base64")}" width="600" height="600"/></svg>`).render().pixels;
      // Der transparente Rand muss die Palettenreduktion überleben.
      for (const y of [0, 300]) for (const x of [0, 200, 400]) expect(raster[(y * 600 + x) * 4 + 3]).toBe(0);
      expect(raster.some((a, i) => i % 4 === 3 && a > 0)).toBe(true);
      expect(datei).toBe(`${nr}-${createHash("sha256").update(png).digest("hex").slice(0, 12)}.png`);
      const ausschnitte = new Set<string>();
      for (const pose of ["bereit", "schlag", "jubel", "ko", "ziehen", "klettern"] as const) {
        const svg = figurSvg(f, pose, { id: `a${nr}${pose}` });
        expect(svg).toContain(`href="/api/figurbild/${datei}"`);
        expect(svg).not.toContain("data:image");
        expect(svg.length).toBeLessThan(1500);
        ausschnitte.add(svg.match(/viewBox="([\d ]+200 300)"/)![1]!);
      }
      expect(ausschnitte.size).toBe(6);
    }
    expect(figurMedium("../medien/prompts.json")).toBeNull();
    expect(figurMedium("0.png")).toBeNull();
  });
});

