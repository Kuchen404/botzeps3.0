import { describe, expect, it } from "vitest";
import type { TeilnehmerStand } from "../scoring/season.js";
import { type Extras, sonderpreise } from "./texte.js";

const stand = (id: string) => ({ id, name: id, wochen: [], fortschritt: null }) as unknown as TeilnehmerStand;
const extras = (tagesserie: number): Extras => ({ minuten: 0, messungen: 0, sportarten: 0, tagesserie });

describe("Sonderpreis Das Uhrwerk", () => {
  it("geht an die längste Tagesserie der Season, erst ab 3 Tagen", () => {
    const staende = [stand("a"), stand("b"), stand("c")];
    const preis = (m: Map<string, Extras>) => sonderpreise(staende, m).find((p) => p.art === "uhrwerk");
    expect(preis(new Map([["a", extras(5)], ["b", extras(5)], ["c", extras(2)]]))).toEqual({
      art: "uhrwerk",
      titel: "Das Uhrwerk",
      gewinner: ["a", "b"],
      wert: "5 Tage am Stück trainiert",
    });
    expect(preis(new Map([["a", extras(2)]]))).toBeUndefined();
  });
});
