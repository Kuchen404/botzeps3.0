import { describe, expect, it } from "vitest";
import { BOT_ID, type MinispielDaten, type SpielTraining, type Spieler } from "./spiele.js";
import { minispielErfolge, spielkind } from "./erfolge.js";

const W = { start: "2026-11-02", ziel: 300 };
let nr = 0;
/** Training am Tag `tag` der Woche (0 = Montag) mit `last` Lastpunkten (Faktor 2). */
const tr = (tag: number, last: number): SpielTraining => ({
  id: ++nr,
  datum: `2026-11-0${2 + tag}`,
  minuten: last / 2,
  faktor: 2,
  erstellt: `2026-11-0${2 + tag}T10:00:${String(nr).padStart(2, "0")}Z`,
});
const sp = (id: string, ...trainings: SpielTraining[]): Spieler => ({ id, name: id.toUpperCase(), trainings });
const erfolge = (d: MinispielDaten, spieler: Spieler[]) => Object.fromEntries(minispielErfolge(d, spieler, W));

describe("Erfolge aus Minispielen", () => {
  it("Zombie: Überlebende und Gebissene, Patient Null geht leer aus", () => {
    const jeden = [0, 1, 2, 3, 4, 5, 6].map((t) => tr(t, 50));
    const d: MinispielDaten = { art: "zombie", spieler: ["a", "b", "c"], patientNull: "c", gemeldet: [] };
    expect(erfolge(d, [sp("a", ...jeden), sp("b"), sp("c")])).toEqual({ a: ["zombie_ueberlebt"], b: ["zombie_gebissen"] });
  });

  it("Bombe: nur der Träger am Ende", () => {
    const d: MinispielDaten = { art: "bombe", spieler: ["a", "b"] };
    expect(erfolge(d, [sp("a", tr(5, 50)), sp("b", tr(1, 50))])).toEqual({ b: ["bombe_bumm"] });
  });

  it("Kopfgeld: Jäger, oder der Gejagte ist unfassbar", () => {
    const d: MinispielDaten = { art: "kopfgeld", spieler: ["a", "b", "c"], gejagter: "a" };
    expect(erfolge(d, [sp("a", tr(0, 200)), sp("b", tr(0, 300)), sp("c", tr(0, 100))])).toEqual({ b: ["kopfgeld_jaeger"] });
    expect(erfolge(d, [sp("a", tr(0, 400)), sp("b", tr(0, 300)), sp("c")])).toEqual({ a: ["kopfgeld_unfassbar"] });
    // Wer selbst nichts macht, ist nicht unfassbar
    expect(erfolge(d, [sp("a"), sp("b"), sp("c")])).toEqual({});
  });

  it("Gipfel: Erstbesteiger und Basislager", () => {
    const d: MinispielDaten = { art: "gipfel", spieler: ["a", "b", "c"] };
    expect(erfolge(d, [sp("a", tr(2, 300)), sp("b", tr(1, 300)), sp("c", tr(0, 50))])).toEqual({
      b: ["gipfel_erster"],
      c: ["gipfel_basislager"],
    });
  });

  it("Tauziehen: Sieger und Schlamm, bei Gleichstand alle in den Schlamm", () => {
    const d: MinispielDaten = {
      art: "tauziehen",
      spieler: ["a", "b"],
      teams: [
        { name: "Team Eisen", mitglieder: ["a"] },
        { name: "Team Speck", mitglieder: ["b"] },
      ],
    };
    expect(erfolge(d, [sp("a", tr(0, 100)), sp("b", tr(0, 200))])).toEqual({ a: ["tauziehen_schlamm"], b: ["tauziehen_sieg"] });
    expect(erfolge(d, [sp("a"), sp("b")])).toEqual({ a: ["tauziehen_schlamm"], b: ["tauziehen_schlamm"] });
  });

  it("Tresor: Knacker nur, wenn er aufgeht, Hühnchen immer", () => {
    const d: MinispielDaten = { art: "tresor", spieler: ["a", "b"], code: [1, 2, 3, 4], ziel: 400 };
    expect(erfolge(d, [sp("a", tr(0, 400)), sp("b")])).toEqual({ a: ["tresor_geknackt"], b: ["tresor_huhn"] });
    expect(erfolge(d, [sp("a", tr(0, 100)), sp("b")])).toEqual({ b: ["tresor_huhn"] });
  });

  it("Duell: Sieger, und Schande für den, der gegen den Bot verliert", () => {
    const d: MinispielDaten = { art: "duell", spieler: ["a", "b", "c"], paare: [["a", "b"], ["c", BOT_ID]] };
    expect(erfolge(d, [sp("a", tr(0, 200)), sp("b", tr(0, 100)), sp("c", tr(0, 100))])).toEqual({ a: ["duell_sieg"], c: ["duell_bot"] });
    expect(erfolge(d, [sp("a"), sp("b"), sp("c", tr(0, 400))])).toEqual({ c: ["duell_sieg"] });
  });

  it("Spielkind erst, wenn alle sieben Spiele dabei waren", () => {
    expect(spielkind(["zombie", "bombe", "kopfgeld", "gipfel", "tauziehen", "tresor"])).toEqual([]);
    expect(spielkind(["zombie", "bombe", "kopfgeld", "gipfel", "tauziehen", "tresor", "duell", "zombie"])).toEqual(["spielkind"]);
  });
});
