import { describe, expect, it } from "vitest";
import { achse, alsPng, liniendiagramm, stil } from "./index.js";

describe("Liniendiagramm", () => {
  it("runde Achsenschritte, Null immer sichtbar", () => {
    expect(achse(0, 158)).toEqual({ von: 0, bis: 200, schritt: 50 });
    expect(achse(-16, 20)).toEqual({ von: -20, bis: 20, schritt: 10 });
    expect(achse(0, 0)).toEqual({ von: 0, bis: 1, schritt: 0.2 });
  });

  it("Namen werden escaped und gekürzt", () => {
    const svg = liniendiagramm({ titel: "A & B", x: ["Start", "W1"], reihen: [{ name: "<b>Hacker</b> mit sehr sehr langem Namen", werte: [0, 1] }] });
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain("&lt;b&gt;Hacker&lt;/b&gt; mit sehr se…");
    expect(svg).not.toContain("<b>");
  });

  it("Lücken unterbrechen die Linie", () => {
    const svg = liniendiagramm({ titel: "T", x: ["a", "b", "c", "d"], reihen: [{ name: "X", werte: [1, null, 2, 3] }] });
    const pfad = /<path d="([^"]+)"/.exec(svg)![1]!;
    expect(pfad.match(/M/g)).toHaveLength(2);
    expect(svg.match(/<circle/g)).toHaveLength(3);
  });

  it("beliebig viele Reihen: Legende wächst, Stile unterscheiden sich lange", () => {
    const reihen = Array.from({ length: 25 }, (_, i) => ({ name: `P${i}`, werte: [0, i] }));
    const svg = liniendiagramm({ titel: "T", x: ["Start", "W1"], reihen });
    const hoehe = Number(/height="(\d+)"/.exec(svg)![1]);
    expect(hoehe).toBeGreaterThan(540 + 8 * 30);
    const stile = new Set(reihen.map((_, i) => JSON.stringify(stil(i))));
    expect(stile.size).toBe(25);
  });

  it("rendert als PNG", () => {
    const png = alsPng(liniendiagramm({ titel: "T", x: ["Start", "W1"], reihen: [{ name: "Kevin", werte: [0, 12.5] }] }));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1000);
  });
});
