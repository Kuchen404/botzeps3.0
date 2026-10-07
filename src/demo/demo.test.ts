import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uhr } from "../bot/kontext.js";
import { GRUPPE, KEVIN, befehl, testBot } from "../bot/testhilfe.js";
import { berechneStand } from "../bericht/stand.js";
import { seasonNachId } from "../db/season-repo.js";
import { DEMO_TAKT, aktiviereDemo, parseSprung } from "./index.js";

const echteUhr = uhr.jetzt;

beforeEach(() => {
  DEMO_TAKT.etappeMs = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T10:00:00Z")); // Dienstag
});
afterEach(() => {
  vi.useRealTimers();
  uhr.jetzt = echteUhr;
});

function demoBot() {
  const t = testBot({ demo: true });
  aktiviereDemo(t.db);
  const gruppenTexte = () =>
    t.aufrufe
      .filter((a) => (a.methode === "sendMessage" || a.methode === "sendPhoto") && a.payload.chat_id === GRUPPE.id)
      .map((a) => String(a.payload.text ?? a.payload.caption ?? ""))
      .filter((x) => x !== ""); // Punkteverlauf als Bild ohne Text
  return { ...t, gruppenTexte };
}

describe("Demo-Modus", () => {
  it("gibt es ohne DEMO_MODUS nicht", async () => {
    const t = testBot();
    await t.bot.handleUpdate(befehl("/demo"));
    expect(t.gesendet()).toHaveLength(0);
  });

  it("legt eine Season mit Fake-Leuten an, Kalibrierung bis heute simuliert", async () => {
    const { db, bot, letzterText } = demoBot();
    await bot.handleUpdate(befehl("/demo"));
    expect(letzterText()).toContain("6 Wochen ab Montag, 12.10.2026");
    expect(letzterText()).toContain("Hantel-Hans");
    const teilnehmer = db.prepare("SELECT COUNT(*) AS n FROM teilnahme").get() as { n: number };
    expect(teilnehmer.n).toBe(6);
    // Kalibrierwoche ab Mo 05.10.: Montag und Dienstag gemessen, noch keine Trainings
    expect(db.prepare("SELECT COUNT(*) AS n FROM messung").get()).toEqual({ n: 12 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM training").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT erinnerungen FROM nutzer WHERE telegram_id < 0").pluck().all()).toEqual([0, 0, 0, 0, 0]);
  });

  it("spult von Ereignis zu Ereignis bis zum Finale", async () => {
    const { db, bot, gruppenTexte } = demoBot();
    await bot.handleUpdate(befehl("/demo"));

    await bot.handleUpdate(befehl("/vorspulen"));
    expect(uhr.jetzt().toISOString()).toBe("2026-10-18T18:01:00.000Z");
    const nachSprung1 = gruppenTexte();
    expect(nachSprung1.at(-3)).toContain("Vorgespult auf Sonntag, 18.10.2026, 20:01 Uhr (Woche 1 von 6)");
    expect(nachSprung1.at(-3)).toContain("Hantel-Hans:");
    expect(nachSprung1.at(-2)).toContain("Wochenbericht „Demo-Season“, Woche 1 von 6");
    expect(nachSprung1.at(-1)).toContain("Morgen früh um 9 kommt was");
    expect(t(db, "SELECT COUNT(*) FROM training")).toBeGreaterThan(5);
    expect(t(db, "SELECT COUNT(*) FROM training WHERE datum > '2026-10-18'")).toBe(0);

    await bot.handleUpdate(befehl("/vorspulen"));
    expect(gruppenTexte().at(-1)).toContain("BOSS-WOCHE");

    await bot.handleUpdate(befehl("/vorspulen ende"));
    const texte = gruppenTexte();
    expect(texte.filter((x) => x.includes("Wochenbericht „Demo-Season“"))).toHaveLength(5);
    expect(texte.filter((x) => x.startsWith("🐉"))).toHaveLength(2);
    expect(texte.filter((x) => x.startsWith("⚠️ Achtung") || x.startsWith("⚠️ Aus dem Keller"))).toHaveLength(2);
    // Nach dem Finale noch die Auflösung des Minispiels der letzten Woche
    expect(texte.at(-2)).toContain("Finale „Demo-Season“");
    expect(t(db, "SELECT woche FROM minispiel WHERE daten IS NOT NULL")).toBe(5);
    expect(t(db, "SELECT MAX(datum) FROM training")).toBe("2026-11-22");

    await bot.handleUpdate(befehl("/vorspulen"));
    expect(gruppenTexte().at(-1)).toContain("Die Season ist durch");
  });

  it("alle haben nach der ersten Woche einen Fortschritt, auch der Autopilot", async () => {
    const { db, bot } = demoBot();
    await bot.handleUpdate(befehl("/demo"));
    await bot.handleUpdate(befehl("/vorspulen"));
    await bot.handleUpdate(befehl("/vorspulen"));
    expect(uhr.jetzt().toISOString()).toBe("2026-10-19T07:01:00.000Z");
    const s = seasonNachId(db, t(db, "SELECT id FROM season") as number)!;
    const staende = berechneStand(db, s, "2026-10-19");
    expect(staende).toHaveLength(6);
    expect(staende.filter((st) => st.fortschritt === null).map((st) => st.name)).toEqual([]);
  });

  it("Tage vorspulen, eigene Einträge zählen zur verstellten Zeit", async () => {
    const { db, bot, gruppenTexte } = demoBot();
    await bot.handleUpdate(befehl("/demo"));
    await bot.handleUpdate(befehl("/autopilot aus"));
    await bot.handleUpdate(befehl("/vorspulen 8"));
    expect(uhr.jetzt().toISOString()).toBe("2026-10-14T10:00:00.000Z");
    expect(gruppenTexte().at(-1)).toContain("(Woche 1 von 6)");
    expect(gruppenTexte().at(-1)).not.toContain("Kevin");
    await bot.handleUpdate(befehl("/sport 60 Joggen"));
    expect(t(db, "SELECT datum FROM training t JOIN nutzer n ON n.id = t.nutzer WHERE n.telegram_id = 42")).toBe("2026-10-14");
  });

  it("/demo fängt von vorne an und setzt die Uhr zurück", async () => {
    const { db, bot } = demoBot();
    await bot.handleUpdate(befehl("/demo 4"));
    await bot.handleUpdate(befehl("/vorspulen ende"));
    await bot.handleUpdate(befehl("/demo"));
    expect(uhr.jetzt().toISOString()).toBe("2026-10-06T10:00:00.000Z");
    expect(t(db, "SELECT COUNT(*) FROM season")).toBe(1);
    expect(t(db, "SELECT COUNT(*) FROM nutzer WHERE telegram_id < 0")).toBe(5);
    expect(t(db, "SELECT COUNT(*) FROM training")).toBe(0);
    expect(t(db, "SELECT COUNT(*) FROM erfolg")).toBe(0);
    expect(t(db, "SELECT COUNT(*) FROM nutzer WHERE telegram_id = ?", KEVIN.id)).toBe(1);
  });

  it("Uhr übersteht einen Neustart", async () => {
    const { db, bot } = demoBot();
    await bot.handleUpdate(befehl("/demo"));
    await bot.handleUpdate(befehl("/vorspulen 2"));
    uhr.jetzt = echteUhr;
    aktiviereDemo(db);
    expect(uhr.jetzt().toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });

  it("versteht die Sprungangaben", () => {
    expect(parseSprung("")).toEqual({ art: "ereignis" });
    expect(parseSprung("3")).toEqual({ art: "tage", tage: 3 });
    expect(parseSprung("3 Tage")).toEqual({ art: "tage", tage: 3 });
    expect(parseSprung("Ende")).toEqual({ art: "ende" });
    expect(parseSprung("0")).toBeNull();
    expect(parseSprung("bla")).toBeNull();
  });
});

function t(db: ReturnType<typeof testBot>["db"], sql: string, ...werte: unknown[]): unknown {
  return db.prepare(sql).pluck().get(...werte);
}
