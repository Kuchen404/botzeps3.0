import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** Kleines DOM für die Spiellogik; das tatsächliche Layout wird im Browser geprüft. */
class Knoten {
  children: Knoten[] = [];
  parent: Knoten | null = null;
  attributes: Record<string, string> = {};
  text = "";
  style = { setProperty: (_name: string, _wert: string) => {}, width: "" };
  classList = {
    contains: (name: string) => (this.attributes.class || "").split(/\s+/).includes(name),
    toggle: (name: string, aktiv: boolean) => {
      const klassen = new Set((this.attributes.class || "").split(/\s+/).filter(Boolean));
      if (aktiv) klassen.add(name); else klassen.delete(name);
      this.attributes.class = [...klassen].join(" ");
    },
  };
  constructor(attributes: Record<string, unknown> = {}, kinder: Knoten[] = []) {
    for (const [name, wert] of Object.entries(attributes)) {
      if (name === "text") this.textContent = String(wert);
      else this.attributes[name] = String(wert);
    }
    kinder.forEach((kind) => this.appendChild(kind));
  }
  get textContent(): string { return this.text + this.children.map((kind) => kind.textContent).join(""); }
  set textContent(text: string) { this.text = text; this.children = []; }
  setAttribute(name: string, wert: string) { this.attributes[name] = wert; }
  appendChild(kind: Knoten) { kind.remove(); kind.parent = this; this.children.push(kind); return kind; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((kind) => kind !== this); this.parent = null; }
  alle(klasse: string): Knoten[] { return this.children.flatMap((kind) => [...(kind.classList.contains(klasse) ? [kind] : []), ...kind.alle(klasse)]); }
  querySelector(selector: string) { return this.alle(selector.slice(1))[0] || null; }
}

type Stand = { summe: number; ziel: number; ziffern: number; offen: boolean; code: string; lasten: Record<string, number> };
type Meta = { vorher: Stand | null; bewegt: boolean };
type Konfiguration = { inhalt: Knoten; zeichne: (stand: Stand, meta: Meta) => void; beschreibe: (stand: Stand) => string };
const stand = (ziffern: number, sonst: Partial<Stand> = {}): Stand => ({
  summe: ziffern * 100, ziel: 400, ziffern, offen: ziffern === 4,
  code: [4, 7, 1, 9].map((ziffer, i) => i < ziffern ? String(ziffer) : "_").join(" "),
  lasten: { a: ziffern * 100 }, ...sonst,
});

function szene() {
  let config!: Konfiguration;
  const window = { MINISPIEL_SZENEN: {} as Record<string, (a: unknown) => Knoten> };
  runInNewContext(readFileSync(new URL("../miniapp/spiele/tresor.js", import.meta.url), "utf8"), {
    window,
    el: (_tag: string, attrs: Record<string, unknown>, kinder: Knoten[] = []) => new Knoten(attrs, kinder),
    minispielAvatar: (_a: unknown, id: string, pose: string) => new Knoten({ class: "ms-avatar", "data-id": id, "data-pose": pose }),
    minispielSetzePose: (node: Knoten, _a: unknown, _id: string, pose: string) => node.setAttribute("data-pose", pose),
    minispielAnimationSzene: (_a: unknown, cfg: Konfiguration) => { config = cfg; return cfg.inhalt; },
  });
  const root = window.MINISPIEL_SZENEN.tresor!({ spieler: [{ id: "a", name: "Anna", ich: true }, { id: "b", name: "Ben" }] });
  return {
    root,
    zeige: (neu: Stand, vorher: Stand | null = null, bewegt = false) => config.zeichne(neu, { vorher, bewegt }),
    status: (s: Stand) => config.beschreibe(s),
    ziffern: () => root.alle("tresor-ziffer").map((node) => node.textContent),
  };
}

describe("Tresor-Szene", () => {
  it("verrät pro echtem Viertel genau eine Ziffer und enthält keine Sonntagsbeute", () => {
    const s = szene();
    for (let i = 0; i <= 4; i++) {
      const aktuell = stand(i);
      s.zeige(aktuell, i ? stand(i - 1) : null, i > 0);
      expect(s.ziffern()).toEqual([4, 7, 1, 9].map((ziffer, index) => index < i ? String(ziffer) : "?"));
      expect(s.root.alle("tresor-riegel").filter((node) => node.classList.contains("geloest"))).toHaveLength(i);
      expect(s.root.alle("tresor-szene")[0]!.classList.contains("offen")).toBe(i === 4);
      expect(s.root.textContent).not.toContain("Proteinriegel");
      expect(s.root.textContent).not.toContain("Kreatin");
    }
    expect(s.status(stand(4))).toContain("am Sonntag");
  });

  it("maskiert selbst versehentlich mitgelieferte unbekannte Ziffern", () => {
    const s = szene();
    s.zeige(stand(1, { code: "4 7 1 9", offen: true }));
    expect(s.ziffern()).toEqual(["4", "?", "?", "?"]);
    expect(s.root.alle("tresor-code")[0]!.attributes["aria-label"]).toBe("Tresorcode: 4, unbekannt, unbekannt, unbekannt");
    expect(s.root.alle("tresor-szene")[0]!.classList.contains("offen")).toBe(false);
  });

  it("schließt nach einer Korrektur wieder und entfernt nicht mehr beitragende Avatare", () => {
    const s = szene();
    const offen = stand(4, { lasten: { a: 100, b: 300 } });
    s.zeige(offen);
    expect(s.root.alle("ms-avatar").map((node) => node.attributes["data-pose"])).toEqual(["jubel", "jubel"]);
    const korrektur = stand(1, { lasten: { b: 100 } });
    s.zeige(korrektur, offen, true);
    expect(s.root.alle("tresor-szene")[0]!.classList.contains("offen")).toBe(false);
    expect(s.ziffern()).toEqual(["4", "?", "?", "?"]);
    expect(s.root.alle("ms-avatar").map((node) => node.attributes["data-id"])).toEqual(["b"]);
    expect(s.root.alle("ms-avatar")[0]!.attributes["data-pose"]).toBe("bereit");
    s.zeige(stand(0), korrektur);
    expect(s.root.alle("ms-avatar")).toHaveLength(0);
    expect(s.root.alle("tresor-wartet")).toHaveLength(1);
  });

  it("zeichnet Überspringen und reduzierte Bewegung sofort ohne Trainingspose", () => {
    const s = szene();
    s.zeige(stand(2), stand(0), false);
    expect(s.root.alle("tresor-szene")[0]!.classList.contains("tresor-ruhig")).toBe(true);
    expect(s.root.alle("neu")).toHaveLength(0);
    expect(s.root.alle("ms-avatar")[0]!.attributes["data-pose"]).toBe("bereit");
  });
});
