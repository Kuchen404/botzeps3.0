import { describe, expect, it } from "vitest";
import { migriere, oeffneDb } from "./index.js";
import { speichereGruppe, speichereNutzer, sportartenDerGruppe, trageMitgliedEin } from "./repo.js";
import { STANDARD_SPORTARTEN } from "../domain/sportarten.js";

describe("Datenbank", () => {
  it("migriert genau einmal", () => {
    const db = oeffneDb(":memory:");
    expect(migriere(db)).toEqual([]);
    const versionen = db.prepare("SELECT version FROM schema_version").all();
    expect(versionen).toHaveLength(1);
  });

  it("registriert Nutzer und Gruppen idempotent", () => {
    const db = oeffneDb(":memory:");
    const a = speichereNutzer(db, 42, "Kevin");
    const b = speichereNutzer(db, 42, "Kevin K.");
    expect(b.id).toBe(a.id);
    expect(b.name).toBe("Kevin K.");

    const g1 = speichereGruppe(db, -100, "Pumper");
    const g2 = speichereGruppe(db, -100, "Pumper 2026");
    expect(g2).toBe(g1);
    expect(sportartenDerGruppe(db, g1)).toHaveLength(STANDARD_SPORTARTEN.length);

    expect(trageMitgliedEin(db, g1, a.id)).toBe(true);
    expect(trageMitgliedEin(db, g1, a.id)).toBe(false);
  });

  it("lehnt unplausible Messwerte ab", () => {
    const db = oeffneDb(":memory:");
    const n = speichereNutzer(db, 1, "Test");
    const neu = db.prepare(
      "INSERT INTO messung (nutzer, zeitpunkt, datum, gewicht_kg, fett_pct, muskel_pct) VALUES (?, ?, ?, ?, ?, ?)",
    );
    expect(() => neu.run(n.id, "2026-10-06T07:00:00Z", "2026-10-06", 80, 2, 40)).toThrow(/CHECK/);
    expect(() => neu.run(n.id, "2026-10-06T07:00:00Z", "2026-10-06", 80, 20, 40)).not.toThrow();
  });
});
