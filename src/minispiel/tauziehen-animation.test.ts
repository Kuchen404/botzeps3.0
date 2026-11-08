import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

class Element {
  className = "";
  textContent = "";
  hidden = false;
  offsetWidth = 400;
  children: Element[] = [];
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  style = { setProperty: (name: string, value: string) => this.properties.set(name, value) };
  classList = {
    add: (name: string) => { this.className += ` ${name}`; },
    remove: (name: string) => { this.className = this.className.split(" ").filter((n) => n !== name).join(" "); },
  };
  appendChild(child: Element) { this.children.push(child); return child; }
  replaceChildren(...children: Element[]) { this.children = children; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  find(klasse: string): Element[] {
    return [this, ...this.children.flatMap((child) => child.find(klasse))].filter((e) => e.className.split(" ").includes(klasse));
  }
}
interface Stand {
  teams: { name: string; mitglieder: string[] }[];
  schnitt: [number, number];
  zug: number;
  lasten: Record<string, number>;
}
interface Meta { index: number; anzahl: number; bewegt: boolean; vorher: Stand | null; station: { art: string } }
interface Config { inhalt: Element; zeichne: (s: Stand, m: Meta) => void; beschreibe: (s: Stand, m: Meta) => string }
const quelltext = readFileSync(new URL("../miniapp/spiele/tauziehen.js", import.meta.url), "utf8");
function szene(abgeschlossen = false, anzahl = 3) {
  let config: Config | undefined;
  const posen: { id: string; pose: string }[] = [];
  const spieler = Array.from({ length: anzahl }, (_, n) => ({ id: String(n), name: n === 1 ? "<img onerror=alert(1)>" : `Person ${n}`, ich: n === anzahl - 1, figur: n % 12 }));
  const window = { MINISPIEL_SZENEN: {} as Record<string, (a: unknown) => Element> };
  runInNewContext(quelltext, {
    window, document: { createElement: () => new Element() },
    minispielAnimationSzene: (_a: unknown, c: Config) => { config = c; return c.inhalt; },
    minispielAvatar: (_a: unknown, id: string, pose: string) => { posen.push({ id, pose }); return new Element(); },
  });
  window.MINISPIEL_SZENEN.tauziehen!({ abgeschlossen, spieler });
  const stand: Stand = {
    teams: [{ name: "Team Eisen", mitglieder: spieler.slice(0, -1).map((s) => s.id) }, { name: "Team Pizza", mitglieder: [String(anzahl - 1)] }],
    schnitt: [60, 90], zug: -0.2,
    lasten: Object.fromEntries(spieler.map((s, n) => [s.id, n === anzahl - 1 ? 90 : 60])),
  };
  const meta: Meta = { index: 1, anzahl: 2, bewegt: false, vorher: null, station: { art: "training" } };
  return { config: config!, stand, meta, posen, root: config!.inhalt };
}

describe("Tauziehen-Szene", () => {
  it("zieht anhand des Durchschnitts zum stärkeren Team, auch wenn dessen Team kleiner ist", () => {
    const { config, stand, meta, root, posen } = szene();
    // Links 120 insgesamt, rechts 90: Nur die Durchschnitte 60:90 dürfen entscheiden.
    config.zeichne(stand, meta);
    expect(root.attributes.get("data-zug")).toBe("-0.2");
    expect(parseFloat(root.find("tz-rope")[0]!.properties.get("--tz-shift")!)).toBeCloseTo(2.8);
    expect(config.beschreibe(stand, meta)).toContain("Team Pizza zieht");
    expect(root.find("tz-average").map((e) => e.textContent)).toEqual(["60", "90"]);
    expect(posen).toHaveLength(3);
    expect(posen.every((p) => p.pose === "ziehen")).toBe(true);
  });

  it("zeigt während der Woche selbst bei extremem Vorsprung keine Schlamm-Niederlage", () => {
    const { config, stand, meta, root } = szene();
    stand.schnitt = [1000, 0];
    config.zeichne(stand, meta);
    expect(root.attributes.has("data-ergebnis")).toBe(false);
    expect(config.beschreibe(stand, meta)).toContain("noch alles offen");
    expect(root.find("tz-rope")[0]!.properties.get("--tz-shift")).toBe("-14%");
  });

  it("zeigt nur die letzte Station eines ausdrücklich abgeschlossenen Spiels als Ergebnis", () => {
    const { config, stand, meta, root, posen } = szene(true);
    config.zeichne(stand, { ...meta, index: 0 });
    expect(root.attributes.has("data-ergebnis")).toBe(false);
    config.zeichne(stand, meta);
    expect(root.attributes.get("data-ergebnis")).toBe("rechts");
    expect(posen.slice(-3).map((p) => p.pose)).toEqual(["ko", "ko", "jubel"]);
    expect(config.beschreibe(stand, meta)).toContain("Team Pizza gewinnt");
    config.zeichne(stand, { ...meta, index: 0 });
    expect(root.attributes.has("data-ergebnis")).toBe(false);
  });

  it.each([[0, 0], [42, 42]])("hält Gleichstand und fehlende Last neutral: %s:%s", (links, rechts) => {
    const { config, stand, meta, root } = szene(true);
    stand.schnitt = [links, rechts];
    config.zeichne(stand, meta);
    expect(root.attributes.get("data-zug")).toBe("0");
    expect(root.attributes.has("data-ergebnis")).toBe(false);
    expect(config.beschreibe(stand, meta)).not.toContain("gewinnt");
  });

  it("setzt Trainings als einzelne Züge um und bleibt beim Überspringen oder Korrigieren ruhig", () => {
    const { config, stand, meta, root } = szene();
    const vorher = { ...stand, schnitt: [0, 0] as [number, number] };
    config.zeichne(stand, { ...meta, vorher, bewegt: true });
    expect(root.className).toContain("tz-tug");
    config.zeichne(stand, { ...meta, vorher, bewegt: false });
    expect(root.className).not.toContain("tz-tug");
    expect(root.attributes.get("data-bewegt")).toBe("false");
    config.zeichne(stand, { ...meta, vorher, bewegt: true, station: { art: "korrektur" } });
    expect(root.className).not.toContain("tz-tug");
  });

  it("begrenzt Figuren bei großen Teams, zeigt alle Mitglieder und behält die eigene Figur", () => {
    const { config, stand, meta, root, posen } = szene(false, 80);
    stand.teams[0]!.mitglieder = [...stand.teams[0]!.mitglieder.slice(1), "79"];
    stand.teams[1]!.mitglieder = ["0"];
    config.zeichne(stand, meta);
    expect(posen).toHaveLength(5);
    expect(posen.slice(0, 4).some((p) => p.id === "79")).toBe(true);
    expect(root.find("tz-more")[0]!.textContent).toBe("+75 am Seil");
    expect(root.find("tz-roster")[0]!.children).toHaveLength(79);
    expect(root.find("tz-roster")[0]!.children[0]!.children[0]!.textContent).toBe("<img onerror=alert(1)>");
  });
});
