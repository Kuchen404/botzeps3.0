import { describe, expect, it } from "vitest";
import {
  BOT_ID,
  MINISPIEL_ARTEN,
  type DatenVon,
  type SpielTraining,
  type Spieler,
  bombentraeger,
  codeText,
  duelle,
  gipfel,
  kopfgeld,
  lasten,
  minispielWochen,
  seil,
  seilZeile,
  stelleAuf,
  tresor,
  waehleArt,
  zombies,
} from "./spiele.js";
import { fertigeTage, minispielErgebnis, minispielLage, minispielMarken, minispielNachTraining } from "./meldungen.js";

const W = { start: "2026-11-02", ziel: 300 };
let id = 0;
/** Training am Tag `tag` der Woche (0 = Montag), `last` Lastpunkte (Faktor 2), Eintrag in Reihenfolge. */
const tr = (tag: number, last: number, erstellt?: string): SpielTraining => ({
  id: ++id,
  datum: `2026-11-0${2 + tag}`,
  minuten: last > 240 ? last / 3 : last / 2,
  faktor: last > 240 ? 3 : 2,
  erstellt: erstellt ?? `2026-11-0${2 + tag}T10:00:${String(id).padStart(2, "0")}Z`,
});
const sp = (i: string, name: string, ...trainings: SpielTraining[]): Spieler => ({ id: i, name, trainings });
const reihe = (...werte: number[]) => {
  let i = 0;
  return () => werte[i++ % werte.length]!;
};

describe("Minispiel-Wochen", () => {
  it("alle Wochen außer der ersten und den Boss-Wochen, bei 10 Wochen genau sieben", () => {
    expect(minispielWochen(10)).toEqual([2, 3, 4, 5, 6, 7, 9]);
    expect(minispielWochen(10)).toHaveLength(MINISPIEL_ARTEN.length);
    expect(minispielWochen(4)).toEqual([3]);
    expect(minispielWochen(3)).toEqual([]);
  });

  it("wählt erst Spiele, die es in der Season noch nicht gab, dann keins zweimal hintereinander", () => {
    const bisher: (typeof MINISPIEL_ARTEN)[number][] = [];
    for (let i = 0; i < MINISPIEL_ARTEN.length; i++) bisher.push(waehleArt(bisher, 5, () => 0.99));
    expect(new Set(bisher).size).toBe(MINISPIEL_ARTEN.length);
    expect(waehleArt(bisher, 5, () => 0.99)).not.toBe(bisher.at(-1));
  });

  it("allein gibt's nur Spiele, die man allein spielen kann", () => {
    const arten = new Set(Array.from({ length: 20 }, (_, i) => waehleArt([], 1, () => i / 20)));
    expect([...arten].sort()).toEqual(["gipfel", "tresor"]);
  });
});

describe("Zombie-Woche", () => {
  const d: DatenVon<"zombie"> = { art: "zombie", spieler: ["k", "p", "m"], patientNull: "m", gemeldet: [] };
  // Kevin trainiert jeden zweiten Tag, Peter Montag und dann nicht mehr
  const spieler = [sp("k", "Kevin", tr(0, 100), tr(2, 100), tr(4, 100), tr(6, 100)), sp("p", "Peter", tr(0, 100)), sp("m", "Max")];

  it("gebissen wird, wer zwei Tage am Stück nicht trainiert; Patient Null von Anfang an", () => {
    expect(zombies(d, spieler, W, 2)).toEqual(new Map([["m", 0]]));
    // Di und Mi ohne Training: am Donnerstagmorgen (3 Tage vorbei) ist Peter gebissen, mit Tag 2
    expect(zombies(d, spieler, W, 3)).toEqual(new Map([["m", 0], ["p", 2]]));
    expect(zombies(d, spieler, W, 7).has("k")).toBe(false);
  });

  it("morgens werden nur die neu Gebissenen gemeldet", () => {
    const lage = minispielLage(d, spieler, W, 3)!;
    expect(lage.text).toBe("🧟 Gebissen: Peter. Zwei Tage keinen Finger gerührt, jetzt schlurfen sie.\n🧍 Noch Mensch: Kevin");
    expect(lage.gemeldet).toEqual(["p"]);
    expect(minispielLage({ ...d, gemeldet: ["p"] }, spieler, W, 4)).toBeNull();
  });

  it("Sonntag werden Überlebende gefeiert und Zombies verspottet", () => {
    const text = minispielErgebnis(d, spieler, W);
    expect(text).toContain("🧍 Überlebt: Kevin.");
    expect(text).toContain("🧟 Zombies: Max (Patient Null), Peter.");
    expect(minispielMarken(d, spieler, W, fertigeTage(W, "2026-11-06"))).toEqual(new Map([["m", "🧟"], ["p", "🧟"]]));
  });
});

describe("Tickende Bombe", () => {
  const d: DatenVon<"bombe"> = { art: "bombe", spieler: ["k", "p", "m"] };

  it("hängt an dem mit dem ältesten letzten Training, bei gleichem Tag an dem, der früher eingetragen hat", () => {
    const vorher = [sp("k", "Kevin", tr(1, 60, "2026-11-03T08:00:00Z")), sp("p", "Peter", tr(1, 60, "2026-11-03T07:00:00Z")), sp("m", "Max", tr(2, 60))];
    expect(bombentraeger(d, vorher)).toBe("p");
    // Wer nicht mitspielt, kriegt sie nicht; wer mitspielt und nie trainiert hat, sowieso
    expect(bombentraeger(d, [...vorher, sp("x", "Xaver")])).toBe("p");
    expect(bombentraeger({ ...d, spieler: [...d.spieler, "x"] }, [...vorher, sp("x", "Xaver")])).toBe("x");
  });

  it("wer sie hat und trainiert, wirft sie weiter", () => {
    const vorher = [sp("k", "Kevin", tr(1, 60)), sp("p", "Peter", tr(0, 60)), sp("m", "Max", tr(2, 60))];
    const nachher = vorher.map((s) => (s.id === "p" ? { ...s, trainings: [...s.trainings, tr(3, 60)] } : s));
    expect(minispielNachTraining(d, vorher, nachher, W, "p")).toEqual(["💣 Peter wirft die Bombe weiter! Jetzt tickt sie bei Kevin."]);
    expect(minispielNachTraining(d, vorher, nachher, W, "k")).toEqual([]);
    expect(minispielErgebnis(d, nachher, W)).toBe("💥 BUMM! Die Bombe ist bei Kevin hochgegangen, letztes Training am 03.11. Wir kratzen die Reste mit dem Spachtel von der Wand.");
  });
});

describe("Kopfgeldjagd", () => {
  const d: DatenVon<"kopfgeld"> = { art: "kopfgeld", spieler: ["k", "p", "m"], gejagter: "k" };

  it("geschnappt hat ihn, wer mehr Wochenlast hat; der Gejagte kann wieder entwischen", () => {
    const vorher = [sp("k", "Kevin", tr(0, 200)), sp("p", "Peter", tr(0, 100)), sp("m", "Max")];
    const p2 = vorher.map((s) => (s.id === "p" ? { ...s, trainings: [...s.trainings, tr(1, 150)] } : s));
    expect(minispielNachTraining(d, vorher, p2, W, "p")).toEqual(["🎯 Peter hat Kevin geschnappt! Kopfgeld kassiert."]);
    const k2 = p2.map((s) => (s.id === "k" ? { ...s, trainings: [...s.trainings, tr(2, 100)] } : s));
    expect(minispielNachTraining(d, p2, k2, W, "k")).toEqual(["🏃 Kevin entwischt Peter wieder."]);
    expect(kopfgeld(d, lasten(d, k2, W)).jaeger).toEqual([]);
    expect(minispielErgebnis(d, k2, W)).toContain("Kevin ist UNFASSBAR! Keiner kam an 300 Lastpunkte ran.");
    expect(minispielErgebnis(d, p2, W)).toContain("Kopfgeld kassiert haben Peter.");
  });

  it("gejagt wird der Tabellenführer", () => {
    expect(stelleAuf("kopfgeld", [{ id: "k" }, { id: "p" }], { ziel: 300, fuehrender: "p" })).toMatchObject({ gejagter: "p" });
  });
});

describe("Gipfelsturm", () => {
  const d: DatenVon<"gipfel"> = { art: "gipfel", spieler: ["k", "p", "m"] };

  it("oben ist, wer das Wochenziel hat, in der Reihenfolge der Ankunft; unter einem Viertel im Basislager", () => {
    const spieler = [
      sp("k", "Kevin", tr(0, 200), tr(3, 100, "2026-11-05T12:00:00Z")),
      sp("p", "Peter", tr(1, 300, "2026-11-03T12:00:00Z")),
      sp("m", "Max", tr(1, 50)),
    ];
    expect(gipfel(d, spieler, W).map((k) => [k.id, k.hoehe, k.oben !== null])).toEqual([
      ["p", 8850, true],
      ["k", 8850, true],
      ["m", 1470, false],
    ]);
    expect(minispielErgebnis(d, spieler, W)).toBe("🏔 Der Gipfelsturm ist vorbei!\n🚩 Oben: 1. Peter, 2. Kevin\n⛺ Basislager: Max. Da gibt's wenigstens Tee.");
    const vorher = spieler.map((s) => (s.id === "k" ? { ...s, trainings: s.trainings.slice(0, 1) } : s));
    expect(minispielNachTraining(d, vorher, spieler, W, "k")).toEqual(["🚩 Kevin ist oben, als 2."]);
    expect(minispielNachTraining(d, spieler, spieler, W, "m")).toEqual(["🧗 Max klettert auf 1.470 m."]);
  });
});

describe("Tauziehen", () => {
  it("lost zwei Teams, es zählt der Schnitt, das Seil wandert zum Stärkeren", () => {
    const d = stelleAuf("tauziehen", [{ id: "a" }, { id: "b" }, { id: "c" }], { ziel: 300 }, reihe(0)) as DatenVon<"tauziehen">;
    expect(d.teams.map((t) => t.mitglieder.length)).toEqual([2, 1]);
    const [a1, a2] = d.teams[0].mitglieder;
    const [b1] = d.teams[1].mitglieder;
    const spieler = [sp(a1!, "A1", tr(0, 100)), sp(a2!, "A2", tr(0, 100)), sp(b1!, "B1", tr(0, 300))];
    const s = seil(d, lasten(d, spieler, W));
    expect(s.schnitt).toEqual([100, 300]);
    expect(s.zug).toBe(-0.5);
    expect(seilZeile(d, s.zug)).toBe(`${d.teams[0].name} ━━━━━━━━🔴━━ ${d.teams[1].name}`);
    expect(minispielErgebnis(d, spieler, W)).toBe(`🪢 ${d.teams[1].name} gewinnt das Tauziehen (100:300 im Schnitt)! ${d.teams[0].name} liegt im Schlamm: A1, A2.`);
  });
});

describe("Tresor", () => {
  const d: DatenVon<"tresor"> = { art: "tresor", spieler: ["k", "p"], code: [4, 7, 1, 1], ziel: 400 };

  it("jedes Viertel verrät eine Ziffer, voll geht er auf", () => {
    const vorher = [sp("k", "Kevin", tr(0, 150)), sp("p", "Peter")];
    expect(tresor(d, lasten(d, vorher, W))).toEqual({ summe: 150, ziffern: 1, offen: false });
    expect(codeText(d, 1)).toBe("4 _ _ _");
    const nachher = [vorher[0]!, sp("p", "Peter", tr(1, 60))];
    expect(minispielNachTraining(d, vorher, nachher, W, "p")).toEqual(["🔓 Ziffer geknackt: 4 7 _ _"]);
    const offen = [vorher[0]!, sp("p", "Peter", tr(1, 300))];
    expect(minispielNachTraining(d, vorher, offen, W, "p")[0]).toContain("💰 TRESOR OFFEN! Code 4 7 1 1, Peter hat das letzte Schloss geknackt.");
    expect(minispielErgebnis(d, offen, W, () => 0)).toBe("💰 Tresor geknackt, Code 4 7 1 1! Drin: ein Proteinriegel von 2019.");
    expect(minispielErgebnis(d, vorher, W)).toBe("🔐 Der Tresor bleibt zu. Der Code wäre 4 7 1 1 gewesen, gefehlt haben 250 Lastpunkte.\n🐔 Kein Finger gerührt: Peter");
  });

  it("braucht 80 % des Wochenziels aller, auf 50 gerundet", () => {
    expect(stelleAuf("tresor", [{ id: "a" }, { id: "b" }, { id: "c" }], { ziel: 300 })).toMatchObject({ ziel: 700 });
  });
});

describe("Losduell", () => {
  it("lost Paare, wer übrig bleibt, kämpft gegen den Bot mit genau dem Wochenziel", () => {
    const d = stelleAuf("duell", [{ id: "a" }, { id: "b" }, { id: "c" }], { ziel: 300 }, reihe(0)) as DatenVon<"duell">;
    expect(d.paare).toHaveLength(2);
    expect(d.paare[1]![1]).toBe(BOT_ID);
    const [a, b] = d.paare[0]!;
    const c = d.paare[1]![0];
    const spieler = [sp(a, "Anna", tr(0, 100)), sp(b, "Bert", tr(0, 80)), sp(c, "Carl", tr(0, 50))];
    expect(duelle(d, lasten(d, spieler, W))[1]).toEqual({ a: c, b: BOT_ID, lastA: 50, lastB: 300 });
    const vorher = spieler.map((s) => (s.id === b ? { ...s, trainings: [] } : s));
    const bertVorne = spieler.map((s) => (s.id === b ? { ...s, trainings: [tr(0, 80), tr(1, 40)] } : s));
    expect(minispielNachTraining(d, vorher, bertVorne, W, b)).toEqual(["⚔️ Bert geht gegen Anna in Führung (120:100)."]);
    const ergebnis = minispielErgebnis(d, spieler, W);
    expect(ergebnis).toContain("• Anna schlägt Bert (100:80).");
    expect(ergebnis).toContain("• Botzeps schlägt Carl (300:50). Gegen den Bot verloren, peinlicher geht's nicht.");
  });
});
