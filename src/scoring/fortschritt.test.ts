import { describe, expect, it } from "vitest";
import { aktuellerWert, fortschritt, massen, startwert, type Messung } from "./fortschritt.js";

const m = (datum: string, gewichtKg: number, fettPct: number, muskelPct: number): Messung => ({
  datum,
  gewichtKg,
  fettPct,
  muskelPct,
});

describe("Fortschritt", () => {
  it("rechnet Prozente in Massen um", () => {
    const r = massen(m("2026-10-01", 80, 25, 40));
    expect(r.fettKg).toBe(20);
    expect(r.muskelKg).toBe(32);
  });

  it("Konzept-Beispiel: gleiche relative Leistung gibt gleiche Punkte", () => {
    // A: 90 kg, 30 % Fett → 27 kg Fett; B: 75 kg, 12 % → 9 kg. Beide −10 % Fettmasse, Muskel gehalten.
    const a = fortschritt(
      { fettKg: 27, muskelKg: 36, anzahlMessungen: 3 },
      { fettKg: 24.3, muskelKg: 36, anzahlMessungen: 3 },
    );
    const b = fortschritt(
      { fettKg: 9, muskelKg: 33.75, anzahlMessungen: 3 },
      { fettKg: 8.1, muskelKg: 33.75, anzahlMessungen: 3 },
    );
    expect(a.punkte).toBeCloseTo(100, 9);
    expect(b.punkte).toBeCloseTo(100, 9);
  });

  it("Muskelaufbau zählt dreifach", () => {
    const r = fortschritt(
      { fettKg: 20, muskelKg: 30, anzahlMessungen: 3 },
      { fettKg: 20, muskelKg: 30.6, anzahlMessungen: 3 },
    );
    expect(r.muskelAufbauPct).toBeCloseTo(2, 9);
    expect(r.punkte).toBeCloseTo(60, 9);
  });

  it("kann negativ werden, aber nicht unter −50", () => {
    const leicht = fortschritt(
      { fettKg: 20, muskelKg: 30, anzahlMessungen: 3 },
      { fettKg: 21, muskelKg: 30, anzahlMessungen: 3 },
    );
    expect(leicht.punkte).toBeCloseTo(-50, 9);
    const stark = fortschritt(
      { fettKg: 20, muskelKg: 30, anzahlMessungen: 3 },
      { fettKg: 26, muskelKg: 28, anzahlMessungen: 3 },
    );
    expect(stark.punkte).toBe(-50);
  });

  it("Startwert braucht mindestens 3 Messungen im Kalibrierfenster", () => {
    const messungen = [
      m("2026-10-05", 80, 25, 40),
      m("2026-10-07", 80, 26, 40),
      m("2026-10-20", 70, 20, 40), // außerhalb
    ];
    expect(startwert(messungen, "2026-10-05", "2026-10-11")).toBeNull();
    const mitDritter = [...messungen, m("2026-10-09", 80, 24, 40)];
    expect(startwert(mitDritter, "2026-10-05", "2026-10-11")).toEqual({
      fettKg: 20,
      muskelKg: 32,
      anzahlMessungen: 3,
    });
  });

  it("ein absichtlich schlechter Einzelwert wird durch den Mittelwert gedämpft", () => {
    const messungen = [
      m("2026-10-05", 80, 25, 40),
      m("2026-10-06", 80, 25, 40),
      m("2026-10-07", 80, 34, 40), // ausgereizter Ausreißer
    ];
    const start = startwert(messungen, "2026-10-05", "2026-10-11");
    expect(start?.fettKg).toBeCloseTo(22.4, 9); // statt 27,2 bei Einzelwert
  });

  it("aktueller Wert = Mittel der letzten 7 Tage", () => {
    const messungen = [m("2026-10-20", 80, 30, 40), m("2026-10-25", 80, 20, 40), m("2026-10-26", 80, 22, 40)];
    const r = aktuellerWert(messungen, "2026-10-27", "2026-10-12");
    expect(r?.anzahlMessungen).toBe(2);
    expect(r?.fettKg).toBeCloseTo(16.8, 9);
  });

  it("zu wenig frische Messungen: die letzten zwei zählen", () => {
    const messungen = [m("2026-10-14", 80, 20, 40), m("2026-10-15", 80, 30, 40), m("2026-10-26", 80, 25, 40)];
    const r = aktuellerWert(messungen, "2026-10-27", "2026-10-12");
    expect(r?.anzahlMessungen).toBe(2);
    expect(r?.fettKg).toBeCloseTo(22, 9);
  });

  it("Messungen aus der Kalibrierung zählen nicht als aktueller Wert", () => {
    const messungen = [m("2026-10-10", 80, 30, 40), m("2026-10-11", 80, 30, 40), m("2026-10-12", 80, 20, 40), m("2026-10-13", 80, 20, 40)];
    const r = aktuellerWert(messungen, "2026-10-14", "2026-10-12");
    expect(r?.anzahlMessungen).toBe(2);
    expect(r?.fettKg).toBeCloseTo(16, 9);
  });

  it("ohne zwei Messungen nach der Kalibrierung gibt es keinen aktuellen Wert", () => {
    expect(aktuellerWert([m("2026-10-26", 80, 25, 40)], "2026-10-27", "2026-10-12")).toBeNull();
    expect(aktuellerWert([], "2026-10-27", "2026-10-12")).toBeNull();
  });
});
