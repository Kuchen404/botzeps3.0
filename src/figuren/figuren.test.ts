import { describe, expect, it } from "vitest";
import { FIGUREN, figurSvg, figurLaufSvg, figurKletterSvg } from "./figuren.js";
import { createHash } from "node:crypto";
import { ATLAS_DATEIEN } from "./atlanten.js";
import { BERG_ATLANTEN, BERG_BILDER } from "./berg-atlanten.js";
import { LAUF_ATLANTEN, JAGD_KULISSE } from "./lauf-atlanten.js";
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

  it("jede Figur hat vier illustrierte Laufphasen in einem kompakten transparenten Atlas", () => {
    expect(LAUF_ATLANTEN).toHaveLength(12);
    for(let nr=0;nr<FIGUREN.length;nr++) {
      const datei=LAUF_ATLANTEN[nr]!,png=figurMedium(datei)!;
      expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([400,600]);
      expect(png.length).toBeLessThan(100*1024);
      expect(datei).toBe(`lauf-${nr}-${createHash("sha256").update(png).digest("hex").slice(0,12)}.png`);
      const svg=figurLaufSvg(nr,`lauf${nr}`)!;
      expect(svg).toContain('class="bz-lauf-atlas"');expect(svg).toContain(datei);
      expect(svg).toContain(`clip-path="url(#lauf${nr}lauf)"`);expect(svg).not.toMatch(/bz-lauf-arm|bz-lauf-bein|undefined|NaN/);
      const raster=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><image href="data:image/png;base64,${png.toString("base64")}" width="400" height="600"/></svg>`).render().pixels;
      const phasen=[];
      for(let i=0;i<4;i++){
        const x=i%2*200,y=Math.floor(i/2)*300;
        expect(raster[(y*400+x)*4+3]).toBe(0);
        const pixel=Buffer.concat(Array.from({length:300},(_,zeile)=>raster.subarray(((y+zeile)*400+x)*4,((y+zeile)*400+x+200)*4)));
        expect(pixel.some((a,j)=>j%4===3&&a>0)).toBe(true);phasen.push(createHash("sha256").update(pixel).digest("hex"));
      }
      expect(new Set(phasen).size).toBe(4);
      const eingebettet=svg.replace(`/api/figurbild/${datei}`,`data:image/png;base64,${png.toString("base64")}`);
      expect(new Resvg(eingebettet).render().pixels.some((a,i)=>i%4===3&&a>0)).toBe(true);
    }
    expect(figurLaufSvg(-1,"unbekannt")).toBeNull();expect(figurLaufSvg(12,"unbekannt")).toBeNull();
    expect(figurMedium(JAGD_KULISSE)!.length).toBeLessThan(150*1024);
  });

  it("jede Bergfigur hat vier transparente Kletterphasen mit festen Medien und Größenlimit", () => {
    expect(BERG_ATLANTEN).toHaveLength(12);
    for(let nr=0;nr<FIGUREN.length;nr++) {
      const datei=BERG_ATLANTEN[nr]!,png=figurMedium(datei)!,svg=figurKletterSvg(nr,`berg${nr}`)!;
      expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([400,600]);expect(png.length).toBeLessThan(100*1024);
      expect(datei).toBe(`berg-${nr}-${createHash("sha256").update(png).digest("hex").slice(0,12)}.png`);
      expect(svg).toContain('class="bz-berg-atlas"');expect(svg).toContain(datei);expect(svg).not.toMatch(/undefined|NaN/);
      const raster=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><image href="data:image/png;base64,${png.toString("base64")}" width="400" height="600"/></svg>`).render().pixels;
      const phasen=[];
      for(let i=0;i<4;i++){const x=i%2*200,y=Math.floor(i/2)*300;expect(raster[(y*400+x)*4+3]).toBe(0);const p=Buffer.concat(Array.from({length:300},(_,zeile)=>raster.subarray(((y+zeile)*400+x)*4,((y+zeile)*400+x+200)*4)));expect(p.some((a,j)=>j%4===3&&a>0)).toBe(true);phasen.push(createHash("sha256").update(p).digest("hex"));}
      expect(new Set(phasen).size).toBe(4);
      expect(new Resvg(svg.replace(`/api/figurbild/${datei}`,`data:image/png;base64,${png.toString("base64")}`)).render().pixels.some((a,i)=>i%4===3&&a>0)).toBe(true);
    }
    for(const datei of Object.values(BERG_BILDER))expect(figurMedium(datei)!.length).toBeLessThan(350*1024);
    expect(figurKletterSvg(-1,'unbekannt')).toBeNull();expect(figurKletterSvg(12,'unbekannt')).toBeNull();
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

