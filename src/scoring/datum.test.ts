import { describe, expect, it } from "vitest";
import { imZeitraum, lokalesDatum, plusTage, tageZwischen, zeitpunktIn } from "./datum.js";

describe("datum", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(plusTage("2026-12-30", 3)).toBe("2027-01-02");
    expect(plusTage("2026-03-01", -1)).toBe("2026-02-28");
    expect(tageZwischen("2026-10-01", "2026-10-15")).toBe(14);
  });

  it("ignoriert die Zeitumstellung", () => {
    expect(plusTage("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("prüft geschlossene Zeiträume", () => {
    expect(imZeitraum("2026-10-01", "2026-10-01", "2026-10-07")).toBe(true);
    expect(imZeitraum("2026-10-07", "2026-10-01", "2026-10-07")).toBe(true);
    expect(imZeitraum("2026-10-08", "2026-10-01", "2026-10-07")).toBe(false);
  });

  it("liefert das lokale Datum in der Zeitzone der Gruppe", () => {
    // 23:30 UTC ist in Berlin schon der nächste Tag
    expect(lokalesDatum(new Date("2026-10-06T23:30:00Z"), "Europe/Berlin")).toBe("2026-10-07");
    expect(lokalesDatum(new Date("2026-10-06T23:30:00Z"), "UTC")).toBe("2026-10-06");
  });

  it("lehnt ungültige Daten ab", () => {
    expect(() => plusTage("6.10.2026", 1)).toThrow();
  });
});

describe("zeitpunktIn", () => {
  it("rechnet Berliner Ortszeit in UTC um, Sommer- und Winterzeit", () => {
    expect(zeitpunktIn("2026-10-18", "20:00", "Europe/Berlin").toISOString()).toBe("2026-10-18T18:00:00.000Z");
    expect(zeitpunktIn("2026-11-01", "20:00", "Europe/Berlin").toISOString()).toBe("2026-11-01T19:00:00.000Z");
    expect(zeitpunktIn("2026-10-25", "19:00", "Europe/Berlin").toISOString()).toBe("2026-10-25T18:00:00.000Z");
    expect(zeitpunktIn("2026-10-18", "07:30", "UTC").toISOString()).toBe("2026-10-18T07:30:00.000Z");
  });
});
