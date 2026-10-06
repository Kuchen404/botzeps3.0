import { afterEach, describe, expect, it } from "vitest";
import { aendereSeason } from "./db/season-repo.js";
import { uhr } from "./bot/kontext.js";
import { GRUPPE, PETER, PRIVAT, befehl, knopf, testBot } from "./bot/testhilfe.js";
import { fuehreAus, plane } from "./zeitplan.js";

const TZ = "Europe/Berlin";
const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});

function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T08:00:00Z`);
}

/** Season ab Mo 12.10.2026 mit Kevin und Peter, 4 Wochen: Boss in Woche 2, aufgepumpt in Woche 3. */
async function aufbau() {
  const t = testBot();
  tag("2026-10-06");
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  aendereSeason(t.db, 1, { wochen: 4 });
  const gesendet: string[] = [];
  const lauf = async (iso: string) => {
    const jetzt = new Date(iso);
    plane(t.db, jetzt, TZ);
    return fuehreAus(t.db, async (_chat, text) => void gesendet.push(text), jetzt, TZ);
  };
  return { ...t, gesendet, lauf };
}

describe("Gamification", () => {
  it("meldet Überholmanöver und neue Spitze direkt im Trainingspost", async () => {
    const { bot, letzterText } = await aufbau();
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/sport 60 Joggen", GRUPPE, PETER));
    expect(letzterText()).toContain("Erster Schweißtropfen");
    await bot.handleUpdate(befehl("/sport 30 Joggen"));
    expect(letzterText()).not.toMatch(/⚡|👑/);
    await bot.handleUpdate(befehl("/sport 90 Joggen gestern"));
    expect(letzterText()).toContain("👑");
    expect(letzterText()).toContain("Peter");
  });

  it("Rangaufstieg über alle Seasons, auch ohne Season", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).toContain("Ausdauerbestie");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).not.toContain("🎖");
    expect(letzterText()).not.toContain("Ausdauerbestie");
    await bot.handleUpdate(befehl("/sport 120 Joggen gestern"));
    expect(letzterText()).toContain("🎖");
    expect(letzterText()).toContain("Lauch");
  });

  it("Boss in Woche 2: Ankündigung, Schaden, Sieg, Bonus und Bericht", async () => {
    const { bot, gesendet, lauf, letzterText } = await aufbau();
    await lauf("2026-10-19T06:59:00Z");
    expect(gesendet.some((g) => g.includes("BOSS"))).toBe(false);
    await lauf("2026-10-19T07:00:30Z"); // 9 Uhr Sommerzeit
    const ankuendigung = gesendet.find((g) => g.includes("BOSS-WOCHE"));
    expect(ankuendigung).toContain("650 Lebenspunkte");
    expect(ankuendigung).toContain("+5 Punkte");

    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).toContain("noch 290 von 650 Lebenspunkten");
    await bot.handleUpdate(befehl("/sport 120 Joggen", GRUPPE, PETER));
    expect(letzterText()).toContain("💀");

    await bot.handleUpdate(befehl("/stand", PRIVAT));
    expect(letzterText()).toContain("Boss-Bonus: +5 Punkte");

    await lauf("2026-10-25T19:00:30Z"); // Bericht Woche 2, Winterzeit
    const bericht = gesendet.find((g) => g.includes("Woche 2 von 4"));
    expect(bericht).toContain("besiegt (720 Schaden)! +5 für: Kevin, Peter");

    await lauf("2026-10-26T08:00:30Z");
    const zurueck = gesendet.at(-1)!;
    expect(zurueck).toContain("IST ZURÜCK");
    expect(zurueck).toContain("(aufgepumpt) hat 900 Lebenspunkte");
    expect(zurueck).toContain("+10 Punkte");
  });

  it("Bericht: überlebter Boss und Drückeberger", async () => {
    const { bot, gesendet, lauf } = await aufbau();
    await lauf("2026-10-19T07:00:30Z");
    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 30 Yoga"));
    await lauf("2026-10-25T19:00:30Z");
    const bericht = gesendet.find((g) => g.includes("Woche 2 von 4"))!;
    expect(bericht).toContain("(30 von 650 Schaden)");
    expect(bericht.split("\n").filter((z) => z.includes("Peter")).length).toBeGreaterThan(1);
  });

  it("/erfolge und /ruhmeshalle", async () => {
    const { bot, letzterText } = await aufbau();
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    await bot.handleUpdate(befehl("/erfolge", PRIVAT));
    expect(letzterText()).toContain("✅ Erster Schweißtropfen");
    expect(letzterText()).toContain("🔒 Champion");
    expect(letzterText()).toContain("Rang: 🛋 Couchkartoffel (360 Lastpunkte insgesamt, noch 640 bis 🥬 Lauch)");
    await bot.handleUpdate(befehl("/ruhmeshalle"));
    expect(letzterText()).toContain("Kevin: 360 Lastpunkte");
    expect(letzterText()).toContain("Längste Einheit: Kevin, 120 min Joggen");
  });
});
