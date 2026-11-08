import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const { bombenFortsetzung, bombenFlugFrames } = runInNewContext(
  readFileSync(new URL("./spiele/bombe.js", import.meta.url), "utf8") + ";({ bombenFortsetzung, bombenFlugFrames })",
  { window: { addEventListener() {} }, document: { addEventListener() {} } },
) as {
  bombenFortsetzung: (alt: string[] | undefined, neu: string[]) => number | null;
  bombenFlugFrames: (von: number, nach: number, hoehe: number, richtung: number) => { transform: string }[];
};

describe("Bomben-Inszenierung", () => {
  it("erzählt beim ersten Öffnen alle Stationen und wiederholt unveränderte Stände nicht", () => {
    expect(bombenFortsetzung(undefined, ["a", "b", "c"])).toBe(0);
    expect(bombenFortsetzung(["a", "b"], ["a", "b"])).toBeNull();
    expect(bombenFortsetzung(undefined, [])).toBeNull();
  });
  it("zeigt neue Übergaben auch dann, wenn die Bombe zum selben Spieler zurückkehrt", () => {
    expect(bombenFortsetzung(["a"], ["a", "b", "a"])).toBe(0);
    expect(bombenFortsetzung(["a", "b"], ["a", "b", "c", "a", "b"])).toBe(1);
  });
  it("beginnt bei gelöschten oder veränderten Stationen wieder mit der vollständigen Historie", () => {
    expect(bombenFortsetzung(["a", "b", "c"], ["a", "c"])).toBe(0);
    expect(bombenFortsetzung(["a", "b", "c"], ["a", "korrektur", "c"])).toBe(0);
  });
  it("landet in beiden Wurfrichtungen exakt an der Empfängerhand und fliegt über die Figuren", () => {
    for (const [von, nach, richtung] of [[90, 220, 1], [220, 90, -1]] as const) {
      const frames = bombenFlugFrames(von, nach, 60, richtung);
      expect(frames[0]!.transform).toBe(`translate(${von}px,140px) rotate(0deg)`);
      expect(frames.at(-1)!.transform).toBe(`translate(${nach}px,140px) rotate(${richtung * 360}deg)`);
      expect(frames[8]!.transform).toContain("80px)");
      expect(frames.every((f) => !/NaN|Infinity/.test(f.transform))).toBe(true);
    }
  });
});
