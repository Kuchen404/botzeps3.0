import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

interface Stand { patientNull: string | null; zombies: { id: string; tag: number }[]; menschen: string[] }
const { zombieInfizierte, zombieWechsel, zombieFortsetzung, zombieSignaturen } = runInNewContext(
  readFileSync(new URL("../miniapp/spiele/zombie.js", import.meta.url), "utf8") + ";({ zombieInfizierte, zombieWechsel, zombieFortsetzung, zombieSignaturen })",
  { window: { addEventListener() {} }, document: { addEventListener() {} } },
) as {
  zombieInfizierte: (stand: Stand) => Set<string>;
  zombieWechsel: (vorher: Stand, station: { art: string; stand: Stand }) => { korrektur: boolean; bisse: string[] };
  zombieFortsetzung: (alt: string[] | undefined, neu: string[]) => number | null;
  zombieSignaturen: (stationen: { art: string; stand: Stand; zeitpunkt: string }[]) => string[];
};
const start: Stand = { patientNull: "p", zombies: [{ id: "p", tag: 0 }], menschen: ["a", "b"] };
const biss: Stand = { patientNull: "p", zombies: [{ id: "p", tag: 0 }, { id: "a", tag: 1 }, { id: "b", tag: 1 }], menschen: [] };

describe("Zombie-Inszenierung folgt den Serverzuständen", () => {
  it("zählt Patient Null von Anfang an als Zombie und führt dieselbe ID nur einmal", () => {
    expect([...zombieInfizierte({ ...start, zombies: [] })]).toEqual(["p"]);
    expect([...zombieInfizierte({ ...start, zombies: [...start.zombies, ...start.zombies] })]).toEqual(["p"]);
    expect([...zombieInfizierte({ patientNull: null, zombies: [], menschen: [] })]).toEqual([]);
  });
  it("inszeniert mehrere neue Bisse einzeln, ohne einen erfundenen Verursacher zuzuordnen", () => {
    expect(zombieWechsel(start, { art: "tag", stand: biss })).toEqual({ korrektur: false, bisse: ["a", "b"] });
    expect(zombieWechsel(biss, { art: "tag", stand: biss }).bisse).toEqual([]);
  });
  it("heilt bei einem normalen Training niemanden, solange der Serverstand unverändert bleibt", () => {
    expect(zombieWechsel(biss, { art: "training", stand: biss })).toEqual({ korrektur: false, bisse: [] });
    expect([...zombieInfizierte(biss)]).toEqual(["p", "a", "b"]);
  });
  it("erzählt Löschkorrekturen nicht als neuen Angriff, selbst wenn sie Zombies ergänzen", () => {
    expect(zombieWechsel(start, { art: "korrektur", stand: biss })).toEqual({ korrektur: true, bisse: [] });
  });
  it("behandelt rückwirkend entfernte Infektionen als Korrektur statt als Heilung im Kampf", () => {
    expect(zombieWechsel(biss, { art: "training", stand: start })).toEqual({ korrektur: true, bisse: [] });
    expect(zombieWechsel(start, { art: "tag", stand: { ...start, patientNull: "b" } }).korrektur).toBe(true);
  });
  it("spielt beim ersten Öffnen ab Anfang und nach einer Aktualisierung nur neue Stationen", () => {
    expect(zombieFortsetzung(undefined, ["start", "biss-a"])).toBe(0);
    expect(zombieFortsetzung(["start", "biss-a"], ["start", "biss-a", "biss-b"])).toBe(1);
    expect(zombieFortsetzung(["start", "biss-a"], ["start", "biss-a"])).toBeNull();
  });
  it("erzählt veränderte oder verkürzte Historien neu, auch bei gleichem Endstand", () => {
    expect(zombieFortsetzung(["start", "biss-a", "ende"], ["start", "biss-b", "ende"])).toBe(0);
    expect(zombieFortsetzung(["start", "biss-a"], ["start"])).toBe(0);
    expect(zombieFortsetzung(undefined, [])).toBeNull();
  });
  it("wiederholt vor der Morgenmeldung keinen Biss nur wegen einer neuen Abrufzeit", () => {
    const alt = zombieSignaturen([{ art: "tag", stand: biss, zeitpunkt: "2026-10-24T05:00:00Z" }]);
    const neu = zombieSignaturen([{ art: "tag", stand: biss, zeitpunkt: "2026-10-24T05:05:00Z" }]);
    expect(zombieFortsetzung(alt, neu)).toBeNull();
    expect(zombieSignaturen([{ art: "korrektur", stand: biss, zeitpunkt: "2026-10-24T05:05:00Z" }])).not.toEqual(alt);
  });
});
