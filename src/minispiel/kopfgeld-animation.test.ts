import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Kleines DOM für die Szenenlogik; echte SVGs/Layout werden zusätzlich im Browser geprüft.
class Element {
  className = "";
  textContent = "";
  innerHTML = "";
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  children: Element[] = [];
  style: Record<string, unknown> & { setProperty: (key: string, value: string) => void } = {
    setProperty: (key, value) => { this.style[key] = value; },
  };
  appendChild(child: Element) { this.children.push(child); return child; }
  setAttribute(key: string, value: string) { this.attributes[key] = value; }
  find(klasse: string): Element[] {
    const selbst: Element[] = this.className.split(" ").includes(klasse) ? [this] : [];
    return selbst.concat(this.children.flatMap((x) => x.find(klasse)));
  }
  text(): string { return this.textContent + this.children.map((x) => x.text()).join(" "); }
}
interface Stand {
  gejagter: string;
  gejagterLast: number;
  jaeger: string[];
  lasten: Record<string, number>;
}
interface Meta { vorher: Stand | null; bewegt: boolean }
interface Config {
  klasse: string;
  inhalt: Element;
  zeichne: (stand: Stand, meta: Meta) => void;
  beschreibe: (stand: Stand, meta: Meta) => string;
}
const stand = (ziel: number, hunter: number): Stand => ({
  gejagter: "ziel", gejagterLast: ziel, jaeger: hunter > ziel ? ["hunter"] : [], lasten: { ziel, hunter },
});
function szene(aktuell: Stand, verlauf: Stand[] = [], mehr = 0) {
  let config!: Config;
  const namen = [{ id: "ziel", name: "Käpt’n Ziel", ich: false, figur: 4 }, { id: "hunter", name: "Jäger <script>", ich: true, figur: null }];
  for (let i = 0; i < mehr; i++) namen.push({ id: `extra${i}`, name: `Verfolger ${i}`, ich: false, figur: null });
  const window: { MINISPIEL_SZENEN: Record<string, (a: unknown) => Element> } = { MINISPIEL_SZENEN: {} };
  runInNewContext(readFileSync(new URL("../miniapp/spiele/kopfgeld.js", import.meta.url), "utf8"), {
    window,
    document: { createElement: () => new Element(), createElementNS: () => new Element() },
    minispielAvatar: (_a: unknown, id: string, pose: string) => {
      const avatar = new Element();
      avatar.className = "ms-avatar";
      avatar.dataset.id = id;
      avatar.dataset.pose = pose;
      return avatar;
    },
    minispielSetzePose: (avatar: Element, _a: unknown, id: string, pose: string) => {
      expect(avatar.dataset.id).toBe(id);
      avatar.dataset.pose = pose;
    },
    minispielAnimationSzene: (_a: unknown, c: Config) => { config = c; return c.inhalt; },
  });
  const root = window.MINISPIEL_SZENEN.kopfgeld!({
    aktuell, verlauf: verlauf.map((s) => ({ stand: s })), spieler: namen,
  });
  return { root, config, zeichne: (s: Stand, vorher: Stand | null = null, bewegt = false) => config.zeichne(s, { vorher, bewegt }) };
}

describe("Kopfgeldjagd-Animation", () => {
  it("zeigt bei Gleichstand einen freien Gejagten und niemals ein Fang-Lasso", () => {
    const gleich = stand(120, 120);
    const { root, zeichne } = szene(gleich);
    zeichne(gleich);
    expect(root.find("kg-spur")[0]!.dataset.gefangen).toBe("false");
    expect(root.find("kg-spurstatus")[0]!.textContent).toContain("Gleichstand reicht nicht");
    expect(root.find("kg-schild")[0]!.textContent).toBe("Auf der Flucht");
    expect(root.dataset.aktion).toBe("");
  });

  it("wirft erst beim echten Überholen das Lasso und lässt den Gejagten beim Aufholen entkommen", () => {
    const start = stand(120, 110), fang = stand(120, 140), flucht = stand(140, 140);
    const { root, zeichne } = szene(flucht, [start, fang, flucht]);
    zeichne(fang, start, true);
    expect(root.dataset.aktion).toBe("fang");
    expect(root.find("kg-spur")[0]!.dataset.gefangen).toBe("true");
    expect(root.find("kg-laeufer")[0]!.find("ms-avatar")[0]!.dataset.pose).toBe("ziehen");
    expect(root.find("kg-held-bild")[0]!.find("ms-avatar")[0]!.dataset.pose).toBe("ko");
    expect(root.find("kg-lage-text")[0]!.textContent).toContain("wirft das Lasso");
    zeichne(flucht, fang, true);
    expect(root.dataset.aktion).toBe("flucht");
    expect(root.find("kg-spur")[0]!.dataset.gefangen).toBe("false");
    expect(root.find("kg-lage-text")[0]!.textContent).toContain("entwischt");
    expect(root.find("kg-held-bild")[0]!.find("ms-avatar")[0]!.dataset.pose).toBe("jubel");
  });

  it("verwendet dieselbe Lastskala für die ganze Wiedergabe und bewahrt genaue Daten", () => {
    const start = stand(50, 25), ende = stand(100, 200);
    const { root, zeichne } = szene(ende, [start, ende]);
    zeichne(start);
    expect(root.style["--kg-ziel"]).toBe("25%");
    expect(root.find("kg-laeufer")[0]!.style.left).toBe("12.5%");
    expect(root.find("kg-poster-last")[0]!.textContent).toBe("50 Lastpunkte");
    zeichne(ende, start, true);
    expect(root.style["--kg-ziel"]).toBe("50%");
    expect(root.find("kg-laeufer")[0]!.style.left).toBe("100%");
  });

  it("überspringt Bewegungen für den sofortigen Endstand, auch wenn sich der Fang geändert hat", () => {
    const start = stand(40, 10), ende = stand(40, 80);
    const { root, zeichne } = szene(ende);
    zeichne(ende, start, false);
    expect(root.dataset.sofort).toBe("true");
    expect(root.dataset.abspielen).toBe("false");
    expect(root.dataset.aktion).toBe("");
    expect(root.find("kg-spur")[0]!.dataset.gefangen).toBe("true");
  });

  it("übernimmt Spieleridentitäten, sichere Namen, fehlende Figuren und viele Verfolger", () => {
    const ende = stand(0, 0);
    const { root, zeichne, config } = szene(ende, [], 70);
    zeichne(ende);
    expect(config.klasse).toBe("ms-kopfgeld");
    expect(root.find("kg-spur")).toHaveLength(71);
    expect(root.find("kg-spurname")[0]!.textContent).toBe("Jäger <script> · du");
    expect(root.find("kg-spurname")[0]!.innerHTML).toBe("");
    expect(root.find("kg-poster-figur")[0]!.find("ms-avatar")[0]!.dataset.id).toBe("ziel");
    expect(root.find("kg-spur").every((p) => p.dataset.gefangen === "false")).toBe(true);
    expect(root.style["--kg-ziel"]).toBe("0%");
  });
});
