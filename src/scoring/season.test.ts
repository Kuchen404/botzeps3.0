import { describe, expect, it } from "vitest";
import type { Messung } from "./fortschritt.js";
import type { Training } from "./fleiss.js";
import { plusTage } from "./datum.js";
import {
  STANDARD_SEASON,
  fleissDerWoche,
  roteLaterne,
  kalibrierFenster,
  rangliste,
  seasonEnde,
  seasonStand,
  teamStand,
  teilnehmerStand,
  wocheVon,
  type SeasonEinstellungen,
  type Teilnehmer,
} from "./season.js";

const season: SeasonEinstellungen = { ...STANDARD_SEASON, start: "2026-10-12" }; // Montag

/** Je eine Woche 300 Last (3 × 50 min Krafttraining) ab Wochenstart. */
function zielwoche(wochenstart: string): Training[] {
  return [0, 2, 4].map((t) => ({ datum: plusTage(wochenstart, t), minuten: 50, faktor: 2 as const }));
}

function messungen(von: string, anzahl: number, gewichtKg: number, fettPct: number, muskelPct: number): Messung[] {
  return Array.from({ length: anzahl }, (_, i) => ({ datum: plusTage(von, i), gewichtKg, fettPct, muskelPct }));
}

function teilnehmer(teil: Partial<Teilnehmer> & Pick<Teilnehmer, "id">): Teilnehmer {
  return { name: teil.id, beitritt: "2026-10-01", trainings: [], messungen: [], ...teil };
}

describe("Season-Zeitraum", () => {
  it("10 Wochen inklusive letztem Tag", () => {
    expect(seasonEnde(season)).toBe("2026-12-20");
    expect(wocheVon(season, "2026-10-11")).toBeNull();
    expect(wocheVon(season, "2026-10-12")).toBe(0);
    expect(wocheVon(season, "2026-10-18")).toBe(0);
    expect(wocheVon(season, "2026-10-19")).toBe(1);
    expect(wocheVon(season, "2026-12-20")).toBe(9);
    expect(wocheVon(season, "2026-12-21")).toBeNull();
  });

  it("Kalibrierfenster: 7 Tage vor Start, bei spätem Einstieg ab Beitritt", () => {
    expect(kalibrierFenster(season, "2026-10-01")).toEqual({ von: "2026-10-05", bis: "2026-10-11" });
    expect(kalibrierFenster(season, "2026-10-12")).toEqual({ von: "2026-10-05", bis: "2026-10-11" });
    expect(kalibrierFenster(season, "2026-10-20")).toEqual({ von: "2026-10-20", bis: "2026-10-26" });
  });
});

describe("Teilnehmer-Stand", () => {
  it("ohne Daten: 0 Punkte, keine Fehler", () => {
    const st = teilnehmerStand(season, teilnehmer({ id: "leer" }), "2026-11-01");
    expect(st.gesamt).toBe(0);
    expect(st.start).toBeNull();
    expect(st.fortschritt).toBeNull();
    expect(st.wochen).toHaveLength(3);
  });

  it("vor Season-Start gibt es noch keine Wochen", () => {
    const st = teilnehmerStand(season, teilnehmer({ id: "früh" }), "2026-10-08");
    expect(st.wochen).toHaveLength(0);
    expect(st.gesamt).toBe(0);
  });

  it("ignoriert Trainings außerhalb der Season", () => {
    const st = teilnehmerStand(
      season,
      teilnehmer({
        id: "x",
        trainings: [
          { datum: "2026-10-11", minuten: 60, faktor: 3 },
          { datum: "2026-12-21", minuten: 60, faktor: 3 },
        ],
      }),
      "2027-01-31",
    );
    expect(st.fleiss).toBe(0);
    expect(st.wochen).toHaveLength(10);
  });

  it("volle Season: Fleiß + Fortschritt", () => {
    const trainings = Array.from({ length: 10 }, (_, w) => zielwoche(plusTage(season.start, w * 7))).flat();
    const t = teilnehmer({
      id: "kevin",
      trainings,
      messungen: [
        ...messungen("2026-10-05", 3, 90, 30, 40), // Start: 27 kg Fett, 36 kg Muskel
        ...messungen("2026-12-15", 3, 87.3, 100 * (24.3 / 87.3), 100 * (36 / 87.3)), // −10 % Fett
      ],
    });
    const st = teilnehmerStand(season, t, "2026-12-31");
    expect(st.fleiss).toBe(121);
    expect(st.fortschritt?.punkte).toBeCloseTo(100, 6);
    expect(st.gesamt).toBeCloseTo(221, 6);
  });

  it("Gewichtung verschiebt die Säulen, 50/50 ist neutral", () => {
    const t = teilnehmer({
      id: "g",
      trainings: zielwoche(season.start),
      messungen: [...messungen("2026-10-05", 3, 80, 25, 40), ...messungen("2026-10-17", 2, 80, 22.5, 40)],
    });
    const neutral = teilnehmerStand(season, t, "2026-10-18");
    expect(neutral.fleiss).toBe(10);
    expect(neutral.fortschritt?.punkte).toBeCloseTo(100, 6);
    expect(neutral.gesamt).toBeCloseTo(110, 6);

    const nurFleiss = teilnehmerStand({ ...season, gewichtFleiss: 100, gewichtFortschritt: 0 }, t, "2026-10-18");
    expect(nurFleiss.gesamt).toBeCloseTo(20, 6);
  });

  it("später Einstieg: verpasste Wochen zählen 0, eigene Kalibrierwoche", () => {
    const t = teilnehmer({
      id: "spät",
      beitritt: "2026-10-26", // Beginn Woche 2
      trainings: [...zielwoche("2026-10-12"), ...zielwoche("2026-10-26")],
      messungen: [...messungen("2026-10-26", 3, 80, 25, 40), ...messungen("2026-11-05", 2, 80, 20, 40)],
    });
    const st = teilnehmerStand(season, t, "2026-11-08");
    expect(st.wochen.map((w) => w.last)).toEqual([0, 0, 300, 0]);
    expect(st.start?.fettKg).toBeCloseTo(20, 9);
    expect(st.fortschritt?.punkte).toBeCloseTo(200, 6);
  });

  it("während der Kalibrierung gibt es noch keinen Fortschritt", () => {
    const t = teilnehmer({ id: "k", beitritt: "2026-10-26", messungen: messungen("2026-10-26", 4, 80, 25, 40) });
    const st = teilnehmerStand(season, t, "2026-10-30");
    expect(st.start).not.toBeNull();
    expect(st.fortschritt).toBeNull();
  });
});

describe("Rangliste", () => {
  it("sortiert nach Gesamt, bei Gleichstand gewinnt mehr Fleiß", () => {
    const r = rangliste([
      { id: "a", gesamt: 100, fleissGewichtet: 40 },
      { id: "b", gesamt: 120, fleissGewichtet: 10 },
      { id: "c", gesamt: 100, fleissGewichtet: 60 },
    ]);
    expect(r.map((x) => [x.id, x.platz])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("völliger Gleichstand teilt den Platz", () => {
    const r = rangliste([
      { id: "a", gesamt: 50, fleissGewichtet: 20 },
      { id: "b", gesamt: 50, fleissGewichtet: 20 },
      { id: "c", gesamt: 10, fleissGewichtet: 0 },
    ]);
    expect(r.map((x) => x.platz)).toEqual([1, 1, 3]);
  });

  it("seasonStand liefert die fertige Rangliste", () => {
    const stand = seasonStand(
      season,
      [teilnehmer({ id: "faul" }), teilnehmer({ id: "fleißig", trainings: zielwoche(season.start) })],
      "2026-10-18",
    );
    expect(stand.map((s) => s.id)).toEqual(["fleißig", "faul"]);
    expect(stand[0]?.platz).toBe(1);
  });
});

describe("Fleiß der Woche", () => {
  it("höchste Wochenlast gewinnt, Gleichstand teilen sich den Titel", () => {
    const stand = seasonStand(
      season,
      [
        teilnehmer({ id: "a", trainings: [{ datum: "2026-10-12", minuten: 60, faktor: 3 }] }),
        teilnehmer({ id: "b", trainings: [{ datum: "2026-10-13", minuten: 90, faktor: 2 }] }),
        teilnehmer({ id: "c", trainings: [{ datum: "2026-10-13", minuten: 30, faktor: 1 }] }),
      ],
      "2026-10-18",
    );
    expect(fleissDerWoche(stand, 0).map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("niemand trainiert: kein Titel", () => {
    const stand = seasonStand(season, [teilnehmer({ id: "a" })], "2026-10-18");
    expect(fleissDerWoche(stand, 0)).toEqual([]);
  });
});

describe("Teams", () => {
  it("Durchschnitt nur über Mitglieder mit Startwert, +3 wenn alle ihr Ziel schaffen", () => {
    const mitStart = messungen("2026-10-05", 3, 80, 25, 40);
    const stand = seasonStand(
      season,
      [
        teilnehmer({ id: "a", trainings: zielwoche(season.start), messungen: mitStart }),
        teilnehmer({ id: "b", trainings: zielwoche(season.start), messungen: mitStart }),
        teilnehmer({ id: "c", trainings: zielwoche(season.start) }), // ohne Startwert
        teilnehmer({ id: "d", messungen: mitStart }),
      ],
      "2026-10-18",
    );
    const teams = teamStand(
      [
        { id: "t1", name: "Bizeps", mitglieder: ["a", "b", "c"] },
        { id: "t2", name: "Couch", mitglieder: ["d"] },
      ],
      stand,
    );
    expect(teams[0]).toMatchObject({ id: "t1", durchschnitt: 10, bonus: 3, gesamt: 13, platz: 1 });
    expect(teams[1]).toMatchObject({ id: "t2", durchschnitt: 0, bonus: 0, platz: 2 });
  });
});

describe("Rote Laterne", () => {
  const START = "2026-10-12";
  const t = (id: string, last: number, beitritt = "2026-10-06") => ({ id, last, beitritt });

  it("geht an alle mit der niedrigsten Last", () => {
    expect(roteLaterne(START, 0, [t("a", 300), t("b", 40), t("c", 40)])).toEqual(["b", "c"]);
  });

  it("nicht, wenn alle gleich viel haben oder nur einer dabei ist", () => {
    expect(roteLaterne(START, 0, [t("a", 0), t("b", 0)])).toEqual([]);
    expect(roteLaterne(START, 0, [t("a", 10)])).toEqual([]);
  });

  it("nur, wer die ganze Woche dabei war", () => {
    // c kommt mitten in Woche 2 dazu: zählt erst ab Woche 3
    expect(roteLaterne(START, 1, [t("a", 300), t("b", 100), t("c", 0, "2026-10-21")])).toEqual(["b"]);
    expect(roteLaterne(START, 2, [t("a", 300), t("b", 100), t("c", 0, "2026-10-21")])).toEqual(["c"]);
  });
});
