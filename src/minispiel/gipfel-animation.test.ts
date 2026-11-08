import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { gipfel, type Spieler } from "./spiele.js";

class Element {
  className = "";
  textContent = "";
  innerHTML = "";
  hidden = false;
  title = "";
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  children: Element[] = [];
  classList = {
    toggle: (name: string, active: boolean) => {
      const klassen = new Set(this.className.split(" "));
      if (active) klassen.add(name); else klassen.delete(name);
      this.className = [...klassen].join(" ");
    },
    remove: (name: string) => { this.classList.toggle(name, false); },
  };
  appendChild(e: Element) { this.children.push(e); return e; }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  all(klasse: string): Element[] {
    return [...(this.className.split(" ").includes(klasse) ? [this] : []), ...this.children.flatMap((e) => e.all(klasse))];
  }
}

type Stand = { kletterer: ReturnType<typeof gipfel> };
type Szene = { inhalt: Element; zeichne: (stand: Stand, meta: { vorher: Stand | null; bewegt: boolean }) => void; beschreibe: (stand: Stand) => string };
function szene(spieler: { id: string; name: string; figur?: number; ich?: boolean }[]) {
  let config: Szene;
  const window = { MINISPIEL_SZENEN: {} as Record<string, (a: unknown) => unknown> };
  runInNewContext(readFileSync(new URL("../miniapp/spiele/gipfel.js", import.meta.url), "utf8"), {
    window,
    document: { createElement: () => new Element(), createElementNS: () => new Element() },
    minispielAvatar: (_a: unknown, id: string, pose: string) => {
      const e = new Element(); e.className = "ms-avatar"; e.dataset = { id, pose }; return e;
    },
    minispielSetzePose: (e: Element, _a: unknown, _id: string, pose: string) => { e.dataset.pose = pose; },
    minispielAnimationSzene: (_a: unknown, c: Szene) => { config = c; return c.inhalt; },
    setTimeout,
    clearTimeout,
  });
  window.MINISPIEL_SZENEN.gipfel!({ spieler });
  return config!;
}

const woche = { start: "2026-11-02", ziel: 100 };
function training(id: number, minuten: number, erstellt: string) {
  return { id, minuten, erstellt, datum: "2026-11-03", faktor: 1 as const };
}

describe("Gipfel-Expedition", () => {
  it("zeigt erst am echten Wochenziel die Fahne und wahrt die Ankunftsreihenfolge", () => {
    const spieler: Spieler[] = [
      { id: "anna", name: "Anna", trainings: [training(1, 99, "2026-11-03T10:00:00Z")] },
      { id: "ben", name: "Ben", trainings: [training(2, 100, "2026-11-03T09:00:00Z")] },
      { id: "cem", name: "Cem", trainings: [training(3, 120, "2026-11-03T08:00:00Z")] },
    ];
    const s = szene(spieler);
    const stand = { kletterer: gipfel({ art: "gipfel", spieler: spieler.map((sp) => sp.id) }, spieler, woche) };
    s.zeichne(stand, { vorher: null, bewegt: false });
    const fahnen = s.inhalt.all("gipfel-fahne");
    expect(fahnen.map((f) => [f.hidden, f.textContent])).toEqual([[true, "⚑ 0"], [false, "⚑ 2"], [false, "⚑ 1"]]);
    expect(s.beschreibe(stand)).toBe("2 von 3 am Gipfel. Zuerst oben: Cem.");
    expect(s.inhalt.all("ms-avatar").map((f) => f.dataset.pose)).toEqual(["klettern", "jubel", "jubel"]);
  });

  it("entfernt Fahne und Jubel nach einer Trainingskorrektur", () => {
    const s = szene([{ id: "a", name: "Alex" }]);
    const oben = { kletterer: [{ id: "a", last: 100, anteil: 1, hoehe: 8850, oben: "2026-11-03T10:00:00Z" }] };
    const korrigiert = { kletterer: [{ id: "a", last: 20, anteil: .2, hoehe: 1770, oben: null }] };
    s.zeichne(oben, { vorher: null, bewegt: false });
    s.zeichne(korrigiert, { vorher: oben, bewegt: false });
    expect(s.inhalt.all("gipfel-fahne")[0]!.hidden).toBe(true);
    expect(s.inhalt.all("ms-avatar")[0]!.dataset.pose).toBe("klettern");
    expect(s.inhalt.all("gipfel-kletterer")[0]!.style.transform).toBe("translateY(-38px)");
    expect(s.inhalt.all("gipfel-stand")[0]!.children[0]!.attributes["aria-label"]).toContain("Basislager");
    expect(s.beschreibe(korrigiert)).toContain("Noch niemand");
  });

  it("partitioniert alle Personen in kleine, überlappungsfreie Seilschaften", () => {
    const spieler = Array.from({ length: 23 }, (_, i) => ({ id: String(i), name: `Person ${i}` }));
    const s = szene(spieler);
    expect(s.inhalt.all("gipfel-seilschaft")).toHaveLength(6);
    expect(s.inhalt.all("gipfel-kletterer")).toHaveLength(23);
    expect(s.inhalt.all("ms-avatar").map((e) => e.dataset.id)).toEqual(spieler.map((sp) => sp.id));
    for (const gruppe of s.inhalt.all("gipfel-landschaft")) {
      const positionen = gruppe.all("gipfel-kletterer").map((e) => e.style.left);
      expect(positionen.length).toBeLessThanOrEqual(4);
      expect(new Set(positionen).size).toBe(positionen.length);
    }
  });

  it("verwendet keine Gipfelfahne nur aufgrund gerundeter Höhe oder Anteil", () => {
    const s = szene([{ id: "a", name: "Alex" }]);
    s.zeichne({ kletterer: [{ id: "a", last: 99.99, anteil: 1, hoehe: 8850, oben: null }] }, { vorher: null, bewegt: false });
    expect(s.inhalt.all("gipfel-fahne")[0]!.hidden).toBe(true);
    expect(s.inhalt.all("ms-avatar")[0]!.dataset.pose).toBe("klettern");
  });

  it("klettert bei einer echten Ankunft und zeigt die Fahne erst nach dem Schritt", () => {
    vi.useFakeTimers();
    try {
      const s = szene([{ id: "a", name: "Alex" }]);
      const vorher = { kletterer: [{ id: "a", last: 60, anteil: .6, hoehe: 5310, oben: null }] };
      const oben = { kletterer: [{ id: "a", last: 100, anteil: 1, hoehe: 8850, oben: "2026-11-03T10:00:00Z" }] };
      s.zeichne(vorher, { vorher: null, bewegt: false });
      s.zeichne(oben, { vorher, bewegt: true });
      expect(s.inhalt.all("steigt")).toHaveLength(1);
      expect(s.inhalt.all("ms-avatar")[0]!.dataset.pose).toBe("klettern");
      expect(s.inhalt.all("gipfel-fahne")[0]!.hidden).toBe(true);
      vi.advanceTimersByTime(1000);
      expect(s.inhalt.all("steigt")).toHaveLength(0);
      expect(s.inhalt.all("ms-avatar")[0]!.dataset.pose).toBe("jubel");
      expect(s.inhalt.all("gipfel-fahne")[0]!.hidden).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it("überspringt Bewegungen sofort und verwirft ausstehende Gipfel-Jubel", () => {
    vi.useFakeTimers();
    try {
      const s = szene([{ id: "a", name: "Alex" }]);
      const unten = { kletterer: [{ id: "a", last: 0, anteil: 0, hoehe: 0, oben: null }] };
      const oben = { kletterer: [{ id: "a", last: 100, anteil: 1, hoehe: 8850, oben: "2026-11-03T10:00:00Z" }] };
      s.zeichne(oben, { vorher: unten, bewegt: true });
      s.zeichne(unten, { vorher: oben, bewegt: false });
      vi.runAllTimers();
      expect(s.inhalt.all("ms-avatar")[0]!.dataset.pose).toBe("bereit");
      expect(s.inhalt.all("gipfel-fahne")[0]!.hidden).toBe(true);
      expect(s.inhalt.all("gipfel-kletterer")[0]!.style.transition).toBe("none");
      expect(s.inhalt.all("steigt")).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });

});
