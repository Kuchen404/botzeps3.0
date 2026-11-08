import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

class Knoten {
  children: Knoten[] = [];
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  textContent = "";
  innerHTML = "";
  parent: Knoten | null = null;
  offsetWidth = 300;
  klassen = new Set<string>();
  classList = {
    add: (...namen: string[]) => namen.forEach((n) => this.klassen.add(n)),
    remove: (...namen: string[]) => namen.forEach((n) => this.klassen.delete(n)),
    contains: (name: string) => this.klassen.has(name),
  };
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
    if (k === "class") this.klassen = new Set(v.split(" "));
    if (k.startsWith("data-")) this.dataset[k.slice(5)] = v;
  }
  appendChild(k: Knoten) { k.parent = this; this.children.push(k); return k; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((k) => k !== this); }
  addEventListener() {}
  querySelector(sel: string): Knoten | null {
    if (sel === "svg" && this.innerHTML.includes("<svg")) return this;
    for (const kind of this.children) {
      if (sel.startsWith(".") && kind.classList.contains(sel.slice(1))) return kind;
      const gefunden = kind.querySelector(sel);
      if (gefunden) return gefunden;
    }
    return null;
  }
}
function el(_tag: string, attrs: Record<string, string> = {}, kinder: Knoten[] = []) {
  const k = new Knoten();
  for (const [name, wert] of Object.entries(attrs)) {
    if (name === "text") k.textContent = wert;
    else k.setAttribute(name, wert);
  }
  kinder.forEach((kind) => k.appendChild(kind));
  return k;
}
interface Paar { a: string; b: string; lastA: number; lastB: number }
interface Stand { paare: Paar[] }
interface Szene {
  klasse: string;
  inhalt: Knoten;
  zeichne: (stand: Stand, meta: { vorher: Stand | null; bewegt: boolean }) => void;
  beschreibe: (stand: Stand) => string;
}
function aufbau() {
  let config!: Szene;
  const window = { MINISPIEL_SZENEN: {} as Record<string, (a: unknown) => Knoten> };
  runInNewContext(readFileSync(new URL("../miniapp/spiele/duell.js", import.meta.url), "utf8"), {
    window, el,
    minispielAnimationSzene: (_a: unknown, c: Szene) => { config = c; return c.inhalt; },
    minispielAvatar: (_a: unknown, id: string, pose: string) => {
      const bild = el("div", { class: "ms-avatar", "data-id": id, "data-pose": pose });
      if (id !== "c") bild.innerHTML = '<svg data-gewaehlte-figur="7"></svg>';
      return bild;
    },
    minispielSetzePose: (bild: Knoten, _a: unknown, _id: string, pose: string) => { bild.dataset.pose = pose; },
  });
  window.MINISPIEL_SZENEN.duell!({
    spieler: [{ id: "a", name: "Anna", ich: true, figur: 7 }, { id: "b", name: "Bert", figur: 2 }, { id: "c", name: "Carl", figur: null }, { id: "bot", name: "Botzeps", figur: null }],
  });
  const zeichne = (stand: Stand, vorher: Stand | null = null, bewegt = false) => config.zeichne(stand, { vorher, bewegt });
  const pair = () => config.inhalt.querySelector(".duell-paar")!;
  return { get config() { return config; }, zeichne, pair };
}
const stand = (lastA: number, lastB: number): Stand => ({ paare: [{ a: "a", b: "b", lastA, lastB }] });

describe("Losduell-Szene", () => {
  it("zeigt beide echten Wochenlasten und gewählte Figuren, ohne einen Wochensieg vorwegzunehmen", () => {
    const t = aufbau();
    t.zeichne(stand(960, 450));
    expect(t.config.klasse).toBe("ms-duell");
    expect(t.pair().querySelector(".duell-links")!.querySelector(".duell-last")!.textContent).toBe("960");
    expect(t.pair().querySelector(".duell-rechts")!.querySelector(".duell-last")!.textContent).toBe("450");
    expect(t.pair().querySelector(".duell-vorsprung")!.textContent).toBe("Anna führt · +510 Lastpunkte");
    expect(t.config.beschreibe(stand(960, 450))).not.toMatch(/gewinnt|siegt|Schaden|HP/);
    expect(t.pair().querySelector(".duell-avatar")!.querySelector("svg")!.innerHTML).toContain('data-gewaehlte-figur="7"');
  });
  it("reagiert nur beim betroffenen Paar und hebt einen echten Führungswechsel hervor", () => {
    const t = aufbau();
    const vorher = { paare: [...stand(100, 80).paare, { a: "c", b: "bot", lastA: 40, lastB: 450 }] };
    t.zeichne(vorher);
    const nachher = { paare: [...stand(100, 120).paare, vorher.paare[1]!] };
    t.zeichne(nachher, vorher, true);
    expect(t.pair().dataset.vorne).toBe("rechts");
    expect(t.pair().classList.contains("duell-wechsel")).toBe(true);
    expect(t.pair().querySelector(".duell-athlet-rechts")!.classList.contains("duell-angriff")).toBe(true);
    expect(t.pair().querySelector(".duell-athlet-links")!.classList.contains("duell-reaktion")).toBe(true);
    const botpaar = t.config.inhalt.children.filter((k) => k.classList.contains("duell-paar"))[1]!;
    expect(botpaar.classList.contains("duell-wechsel")).toBe(false);
    expect(botpaar.querySelector(".duell-angriff")).toBeNull();
  });
  it("behandelt Gleichstand und bloßen Lastzuwachs ohne falschen Führungswechsel", () => {
    const t = aufbau();
    t.zeichne(stand(120, 120), stand(120, 80), true);
    expect(t.pair().dataset.vorne).toBe("gleich");
    expect(t.pair().classList.contains("duell-wechsel")).toBe(false);
    expect(t.pair().querySelector(".duell-vorsprung")!.textContent).toContain("Gleichstand");
    t.zeichne(stand(140, 120), stand(130, 120), true);
    expect(t.pair().classList.contains("duell-wechsel")).toBe(false);
  });
  it("stellt Anfang, Überspringen und reduzierte Bewegung sofort ruhig dar; Korrekturen schlagen nicht zu", () => {
    const t = aufbau();
    t.zeichne(stand(100, 120), stand(100, 80), true);
    t.zeichne(stand(200, 120), stand(100, 120), false);
    expect(t.pair().querySelector(".duell-angriff")).toBeNull();
    expect(t.pair().querySelector(".duell-reaktion")).toBeNull();
    expect(t.pair().classList.contains("duell-wechsel")).toBe(false);
    t.zeichne(stand(80, 120), stand(200, 120), true);
    expect(t.pair().querySelector(".duell-angriff")).toBeNull();
  });
  it("zeigt Botzeps als Roboter mit fester tatsächlicher Ziellast und nutzt den Initialen-Fallback", () => {
    const t = aufbau();
    const s = { paare: [{ a: "c", b: "bot", lastA: 450, lastB: 450 }] };
    t.zeichne(s);
    expect(t.pair().querySelector(".duell-bot")!.innerHTML).toContain("Trainingsroboter");
    expect(t.pair().querySelector(".duell-ersatz")).not.toBeNull();
    expect(t.pair().querySelector(".duell-bot-hinweis")!.textContent).toContain("von Anfang an");
    expect(t.config.beschreibe(s)).toContain("Gleichstand · 450 : 450");
  });
  it("zeigt alle Paare auch in großen Gruppen und räumt entfallene Paare auf", () => {
    const t = aufbau();
    t.zeichne({ paare: Array.from({ length: 20 }, (_, i) => ({ a: "links" + i, b: "rechts" + i, lastA: i, lastB: 0 })) });
    expect(t.config.inhalt.children.filter((k) => k.classList.contains("duell-paar"))).toHaveLength(20);
    t.zeichne({ paare: [] });
    expect(t.config.inhalt.querySelector(".duell-paar")).toBeNull();
    expect(t.config.inhalt.querySelector(".duell-leer")!.textContent).toContain("ausgelost");
  });
});
