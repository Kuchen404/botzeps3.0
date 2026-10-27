import { describe, expect, it } from "vitest";
import { istSprung, parseSport, parseWaage } from "./eingabe.js";

describe("parseSport", () => {
  it("versteht Minuten und Sportart in beliebiger Reihenfolge", () => {
    expect(parseSport("45 Joggen")).toEqual({ ok: true, wert: { minuten: 45, sportart: "Joggen", tageZurueck: 0 } });
    expect(parseSport("Joggen 45")).toEqual({ ok: true, wert: { minuten: 45, sportart: "Joggen", tageZurueck: 0 } });
    expect(parseSport("45 min Radfahren")).toEqual({ ok: true, wert: { minuten: 45, sportart: "Radfahren", tageZurueck: 0 } });
    expect(parseSport("45min Radfahren")).toEqual({ ok: true, wert: { minuten: 45, sportart: "Radfahren", tageZurueck: 0 } });
  });

  it("erlaubt mehrteilige Sportarten und Rückdatieren bis vorgestern", () => {
    expect(parseSport("60 Stand Up Paddling gestern")).toEqual({
      ok: true,
      wert: { minuten: 60, sportart: "Stand Up Paddling", tageZurueck: 1 },
    });
    expect(parseSport("30 Yoga Vorgestern").ok && parseSport("30 Yoga Vorgestern")).toMatchObject({
      wert: { tageZurueck: 2 },
    });
  });

  it("lässt Teile weg, die fehlen", () => {
    expect(parseSport("")).toEqual({ ok: true, wert: { tageZurueck: 0 } });
    expect(parseSport("45")).toEqual({ ok: true, wert: { minuten: 45, tageZurueck: 0 } });
    expect(parseSport("Klettern")).toEqual({ ok: true, wert: { sportart: "Klettern", tageZurueck: 0 } });
  });

  it("lehnt unplausible Dauer ab", () => {
    expect(parseSport("3 Joggen").ok).toBe(false);
    expect(parseSport("300 Joggen").ok).toBe(false);
    expect(parseSport("45,5 Joggen").ok).toBe(false);
  });
});

describe("parseWaage", () => {
  it("versteht Punkt und Komma, mit und ohne Einheiten", () => {
    const erwartet = { ok: true, wert: { gewichtKg: 82.4, fettPct: 18.5, muskelPct: 41.2, tageZurueck: 0 } };
    expect(parseWaage("82.4 18.5 41.2")).toEqual(erwartet);
    expect(parseWaage("82,4 18,5 41,2")).toEqual(erwartet);
    expect(parseWaage("82,4kg 18,5% 41,2 %")).toEqual(erwartet);
  });

  it("gestern ist erlaubt", () => {
    expect(parseWaage("82 18 41 gestern")).toMatchObject({ ok: true, wert: { tageZurueck: 1 } });
  });

  it("leere Eingabe heißt: Anleitung zeigen", () => {
    expect(parseWaage("  ")).toBeNull();
  });

  it("prüft Anzahl und Plausibilität", () => {
    expect(parseWaage("82 18")).toMatchObject({ ok: false });
    expect(parseWaage("82 18 41 12")).toMatchObject({ ok: false });
    expect(parseWaage("20 18 41")).toMatchObject({ ok: false, fehler: expect.stringContaining("Gewicht") });
    expect(parseWaage("82 1 41")).toMatchObject({ ok: false, fehler: expect.stringContaining("Fett") });
    expect(parseWaage("82 8 95")).toMatchObject({ ok: false, fehler: expect.stringContaining("Muskel") });
    expect(parseWaage("82 45 60")).toMatchObject({ ok: false, fehler: expect.stringContaining("100") });
  });
});

describe("istSprung", () => {
  it("markiert mehr als 3 Prozentpunkte Fett oder 3 kg", () => {
    const mittel = { gewichtKg: 80, fettPct: 20 };
    expect(istSprung({ gewichtKg: 80, fettPct: 23 }, mittel)).toBe(false);
    expect(istSprung({ gewichtKg: 80, fettPct: 23.5 }, mittel)).toBe(true);
    expect(istSprung({ gewichtKg: 76.5, fettPct: 20 }, mittel)).toBe(true);
    expect(istSprung({ gewichtKg: 90, fettPct: 40 }, null)).toBe(false);
  });
});
