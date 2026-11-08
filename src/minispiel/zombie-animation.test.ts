import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** Kleine DOM-Schnittstelle: prüft die Szene mit den echten Server-Frames, ohne Browser-Abhängigkeit. */
class Knoten {
  kinder: Knoten[];
  textContent: string;
  innerHTML = "";
  classList: { add: (klasse: string) => void };
  constructor(public tag: string, public attrs: Record<string, string> = {}, kinder: Knoten[] = []) {
    this.kinder = kinder;
    this.textContent = attrs.text ?? "";
    this.classList = { add: (klasse) => { this.attrs.class = `${this.attrs.class ?? ""} ${klasse}`.trim(); } };
  }
  appendChild(kind: Knoten) { this.kinder.push(kind); }
  replaceChildren(...kinder: Knoten[]) { this.kinder = kinder; }
}
interface Stand { patientNull: string; zombies: { id: string; tag: number }[]; menschen: string[] }
interface Meta { vorher: Stand | null; bewegt: boolean; station: { zeitpunkt: string; art: string; stand: Stand }; index: number; anzahl: number }
interface Konfig { inhalt: Knoten; klasse: string; zeichne: (stand: Stand, meta: Meta) => void; beschreibe: (stand: Stand, meta: Meta) => string }
const quelle = readFileSync(new URL("../miniapp/spiele/zombie.js", import.meta.url), "utf8");
const start: Stand = { patientNull: "0", zombies: [{ id: "0", tag: 0 }], menschen: ["1", "2"] };
const biss: Stand = { patientNull: "0", zombies: [{ id: "0", tag: 0 }, { id: "1", tag: 2 }], menschen: ["2"] };
const meta = (stand: Stand, vorher: Stand | null = null, bewegt = false, index = 0): Meta => ({ vorher, bewegt, station: { zeitpunkt: "2026-11-05T08:00:00Z", art: index ? "tag" : "start", stand }, index, anzahl: 3 });
function baue(anzahl = 3, abgeschlossen = false) {
  let konfig!: Konfig;
  const avatare: { id: string; pose: string }[] = [];
  const window = { MINISPIEL_SZENEN: {} as Record<string, (a: unknown) => Knoten> };
  runInNewContext(quelle, {
    window,
    el: (tag: string, attrs?: Record<string, string>, kinder?: Knoten[]) => new Knoten(tag, attrs, kinder),
    minispielAvatar: (_a: unknown, id: string, pose: string) => { avatare.push({ id, pose }); return new Knoten("div", { class: "ms-avatar", "data-id": id, "data-pose": pose }); },
    minispielAnimationSzene: (_a: unknown, k: Konfig) => { konfig = k; return k.inhalt; },
  });
  const spieler = Array.from({ length: anzahl }, (_, i) => ({ id: String(i), name: i === 1 ? '<img src=x onerror="alert(1)">' : `Spieler ${i}`, ich: i === 2, figur: i % 12 }));
  const dom = window.MINISPIEL_SZENEN.zombie!({ spieler, abgeschlossen, zeitzone: "Europe/Berlin" });
  return { konfig, avatare, dom };
}
function finde(dom: Knoten, klasse: string): Knoten[] {
  return [...((dom.attrs.class ?? "").split(" ").includes(klasse) ? [dom] : []), ...dom.kinder.flatMap((kind) => finde(kind, klasse))];
}

describe("Zombie-Animationsszene", () => {
  it("zeigt Patient Null vom Start an und verwendet für jeden die gewählte bereit-Figur", () => {
    const { konfig, avatare, dom } = baue();
    konfig.zeichne(start, meta(start));
    expect(konfig.klasse).toBe("ms-zombie");
    expect(avatare).toEqual(["0", "1", "2"].map((id) => ({ id, pose: "bereit" })));
    expect(finde(dom, "is-zombie").map((el) => el.attrs["data-id"])).toEqual(["0"]);
    expect(finde(dom, "zg-badge").map((el) => el.textContent)).toEqual(["Patient Null", "Noch Mensch", "Noch Mensch"]);
    expect(finde(dom, "zg-name")[1]!.textContent).toContain("<img src=x");
    expect(finde(dom, "zg-name")[1]!.innerHTML).toBe("");
    expect(finde(dom, "zg-name")[2]!.textContent).toBe("Spieler 2 (du)");
  });

  it("übernimmt historische Bisse, hebt neue Bisse hervor und heilt beim Training niemanden", () => {
    const { konfig, dom } = baue();
    konfig.zeichne(biss, meta(biss, start, true, 1));
    expect(finde(dom, "is-new").map((el) => el.attrs["data-id"])).toEqual(["1"]);
    expect(finde(dom, "is-zombie")).toHaveLength(2);
    expect(finde(dom, "zg-story")[0]!.textContent).toContain("wurde gebissen");
    const training = meta(biss, biss, true, 2);
    training.station.art = "training";
    konfig.zeichne(biss, training);
    expect(finde(dom, "is-zombie")).toHaveLength(2);
    expect(finde(dom, "is-new")).toHaveLength(0);
    expect(finde(dom, "zg-badge")[1]!.textContent).toBe("Zombie · Tag 3");
  });

  it("rendert beim Überspringen oder reduzierter Bewegung sofort den aktuellen Stand ohne Bissbewegung", () => {
    const { konfig, dom } = baue(3, true);
    konfig.zeichne(biss, meta(biss, start, false, 2));
    expect(finde(dom, "is-zombie")).toHaveLength(2);
    expect(finde(dom, "is-new")).toHaveLength(0);
    expect(finde(dom, "zg-heading")[0]!.kinder[0]!.textContent).toBe("Die Überlebenden stehen fest");
    konfig.zeichne(start, meta(start));
    expect(finde(dom, "is-zombie")).toHaveLength(1);
    expect(finde(dom, "zg-heading")[0]!.kinder[0]!.textContent).toBe("Die letzte Trainingsrunde");
  });

  it("zeigt auch große Gruppen vollständig und erklärt den Fall ohne Überlebende", () => {
    const { konfig, dom, avatare } = baue(60);
    const alle: Stand = { patientNull: "0", zombies: Array.from({ length: 60 }, (_, i) => ({ id: String(i), tag: i ? 1 : 0 })), menschen: [] };
    konfig.zeichne(alle, meta(alle));
    expect(avatare).toHaveLength(60);
    expect(finde(dom, "zg-person")).toHaveLength(60);
    expect(finde(dom, "is-zombie")).toHaveLength(60);
    expect(finde(dom, "zg-story")[0]!.textContent).toContain("Alle sind Zombies");
    expect(finde(dom, "zg-counter")[1]!.kinder[1]!.textContent).toBe("60 Zombies");
  });
});
