import { describe, expect, it } from "vitest";
import { bombenVerlauf, type BombenTraining } from "./bombenverlauf.js";
const start = "2026-11-02T08:00:00.000Z";
const bis = "2026-11-06T18:00:00.000Z";
const d = { art: "bombe" as const, spieler: ["a", "b", "c"] };
const spieler = [{ id: "a", name: "Alex" }, { id: "b", name: "Berta" }, { id: "c", name: "Chris" }];
let id = 0;
function tr(spieler: string, erstellt: string, datum = erstellt.slice(0, 10), geloescht: string | null = null): BombenTraining {
  return { id: ++id, spieler, erstellt, datum, geloescht, minuten: 30, faktor: 1 };
}
const ids = (liste: BombenTraining[], von = start, ende = bis) => bombenVerlauf(d, spieler, liste, von, ende).map((s) => s.traeger);

describe("Chronologischer Bombenrückblick", () => {
  it("zeigt an Tag fünf alle Übergaben, einschließlich Rückkehr zum ersten Spieler", () => {
    const trainings = [tr("a", "2026-11-02T10:00:00Z"), tr("b", "2026-11-03T10:00:00Z"), tr("c", "2026-11-04T10:00:00Z")];
    expect(ids(trainings)).toEqual(["a", "b", "c", "a"]);
    expect(ids([...trainings].reverse())).toEqual(["a", "b", "c", "a"]);
  });
  it("beginnt beim damaligen Träger mit Trainings vor der Ankündigung", () => {
    expect(ids([tr("a", "2026-11-02T07:00:00Z"), tr("b", "2026-11-02T07:30:00Z")])).toEqual(["c"]);
    expect(ids([])).toEqual(["a"]);
    expect(ids([], start, "2026-11-02T07:00:00Z")).toEqual([]);
  });
  it("sortiert Nachträge nach Eintragszeit und überspringt Trainings ohne Trägerwechsel", () => {
    const trainings = [
      tr("b", "2026-11-02T10:00:00Z"), // A behält die Bombe.
      tr("a", "2026-11-04T10:00:00Z", "2026-11-02"), // C übernimmt erst am Mittwoch.
      tr("b", "2026-11-05T10:00:00Z"), // C behält die Bombe.
    ];
    const v = bombenVerlauf(d, spieler, trainings, start, bis);
    expect(v.map((s) => s.traeger)).toEqual(["a", "c"]);
    expect(v[1]?.zeitpunkt).toBe("2026-11-04T10:00:00Z");
  });
  it("behält eine frühere Übergabe und zeigt eine Löschung als Korrektur", () => {
    const trainings = [tr("a", "2026-11-02T10:00:00Z", "2026-11-02", "2026-11-03T10:00:00Z")];
    expect(ids(trainings)).toEqual(["a", "b", "a"]);
    expect(bombenVerlauf(d, spieler, trainings, start, bis)[2]?.art).toBe("korrektur");
    expect(ids([tr("a", "2026-11-01T10:00:00Z", "2026-11-01", "2026-11-02T07:00:00Z")])).toEqual(["a"]);
  });
  it("löst Gleichstände deterministisch und ignoriert andere Spieler und spätere Einträge", () => {
    expect(ids([tr("a", start), tr("b", start), tr("x", start), tr("c", "2026-11-07T10:00:00Z")])).toEqual(["a", "b", "c"]);
    expect(ids([tr("a", "2026-11-02T10:00:00Z", "2026-11-02", "2026-11-07T10:00:00Z")])).toEqual(["a", "b"]);
  });
  it("liefert bei fehlenden Teilnehmern keinen erfundenen Träger", () => {
    expect(bombenVerlauf(d, [], [], start, bis)).toEqual([]);
  });
});
