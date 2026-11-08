import { afterEach, describe, expect, it } from "vitest";
import { uhr } from "../bot/kontext.js";
import { testBot, knopf, befehl, GRUPPE, PETER } from "../bot/testhilfe.js";
import { aendereSeason, seasonNachId } from "../db/season-repo.js";
import { minispielDerApp, minispielFuerApp } from "./ablauf.js";
import { animationFuerApp } from "./animation.js";
import type { MinispielDaten } from "./spiele.js";

const original = uhr.jetzt;
afterEach(() => { uhr.jetzt = original; });

/** Season ab 12.10., Woche 3 = 02.–08.11. mit Zombie-Spiel, Woche 4 beginnt Montag 09.11. */
async function aufbau() {
  uhr.jetzt = () => new Date("2026-10-05T10:00:00Z");
  const t = testBot();
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  aendereSeason(t.db, 1, { wochen: 6 });
  const s = seasonNachId(t.db, 1)!;
  expect(s.start).toBe("2026-10-12");
  const ids = (t.db.prepare("SELECT CAST(id AS TEXT) AS id FROM nutzer ORDER BY name").all() as { id: string }[]).map((x) => x.id);
  const [a, b] = ids as [string, string];
  const sport = (t.db.prepare("SELECT id FROM sportart LIMIT 1").get() as { id: number }).id;
  const training = (id: string, datum: string, erstellt: string) =>
    t.db.prepare("INSERT INTO training (nutzer,datum,minuten,sportart,faktor,erstellt_am) VALUES (?,?,60,?,2,?)").run(Number(id), datum, sport, erstellt);
  const spiel = (woche: number, d: MinispielDaten | null, art = "zombie") =>
    t.db.prepare("INSERT OR REPLACE INTO minispiel (season,woche,art,daten) VALUES (1,?,?,?)").run(woche, d?.art ?? art, d ? JSON.stringify(d) : null);
  const bericht = (woche: number) =>
    t.db.prepare("INSERT INTO wochenstand (season,nutzer,woche,last,fleisspunkte,gesamt,platz) VALUES (1,?,?,0,0,0,1)").run(Number(a), woche);
  // b trainiert nur Montag bis Donnerstag, ist also nach Freitag und Samstag ohne Training gebissen.
  for (const tag of ["02", "03", "04", "05"]) training(b, `2026-11-${tag}`, `2026-11-${tag}T10:00:00Z`);
  for (const tag of ["02", "03", "04", "05", "06", "07", "08"]) training(a, `2026-11-${tag}`, `2026-11-${tag}T10:00:00Z`);
  spiel(3, { art: "zombie", spieler: ids, patientNull: "bot-gibt-es-nicht", gemeldet: [] });
  return { ...t, s, a, b, spiel, bericht, training };
}

describe("Minispiel nach dem Sonntagsbericht", () => {
  it("läuft bis zum Bericht und gilt danach als abgeschlossen", async () => {
    const t = await aufbau();
    try {
      uhr.jetzt = () => new Date("2026-11-08T18:00:00Z");
      expect(minispielDerApp(t.db, t.s, "2026-11-08")).toMatchObject({ woche: 3, abgeschlossen: false, fertigeTage: 6 });
      expect(animationFuerApp(t.db, t.s, "2026-11-08", t.a)!.abgeschlossen).toBe(false);
      t.bericht(3);
      expect(minispielDerApp(t.db, t.s, "2026-11-08")).toMatchObject({ woche: 3, abgeschlossen: true, fertigeTage: 7 });
      expect(minispielFuerApp(t.db, t.s, "2026-11-08", t.a)).toMatchObject({ woche: 4, abgeschlossen: true });
      expect(animationFuerApp(t.db, t.s, "2026-11-08", t.a)!.abgeschlossen).toBe(true);
    } finally { t.db.close(); }
  });

  it("zeigt am Montag den Endstand der Vorwoche, bis das neue Spiel angekündigt ist", async () => {
    const t = await aufbau();
    try {
      uhr.jetzt = () => new Date("2026-11-09T06:00:00Z");
      // Ohne Bericht (z. B. Bot war aus) nichts Altes zeigen
      expect(minispielDerApp(t.db, t.s, "2026-11-09")).toBeNull();
      t.bericht(3);
      t.spiel(4, null, "gipfel"); // Teaser hat das Spiel festgelegt, angekündigt ist es noch nicht
      const alt = minispielDerApp(t.db, t.s, "2026-11-09")!;
      expect(alt).toMatchObject({ woche: 3, abgeschlossen: true, stichtag: "2026-11-08" });
      // Ein Montagstraining gehört nicht mehr zur alten Woche
      t.training(t.b, "2026-11-09", "2026-11-09T05:00:00Z");
      const anim = animationFuerApp(t.db, t.s, "2026-11-09", t.a)!;
      expect(anim).toMatchObject({ art: "zombie", abgeschlossen: true, id: "1:3:zombie" });
      expect((anim.aktuell as { zombies: { id: string }[] }).zombies.map((z) => z.id)).toContain(t.b);
      // Ankündigung um 9 Uhr: ab dann das neue Spiel
      uhr.jetzt = () => new Date("2026-11-09T08:05:00Z");
      t.spiel(4, { art: "gipfel", spieler: [t.a, t.b] });
      expect(minispielDerApp(t.db, t.s, "2026-11-09")).toMatchObject({ woche: 4, abgeschlossen: false });
    } finally { t.db.close(); }
  });

  it("ohne neues Spiel nur bis Montagabend", async () => {
    const t = await aufbau();
    try {
      t.bericht(3);
      uhr.jetzt = () => new Date("2026-11-09T20:00:00Z");
      expect(minispielDerApp(t.db, t.s, "2026-11-09")?.woche).toBe(3);
      uhr.jetzt = () => new Date("2026-11-10T08:00:00Z");
      expect(minispielDerApp(t.db, t.s, "2026-11-10")).toBeNull();
    } finally { t.db.close(); }
  });
});
