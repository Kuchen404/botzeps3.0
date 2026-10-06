import { describe, expect, it } from "vitest";
import { GRUPPE, befehl, knopf, testBot } from "./testhilfe.js";

describe("Bot", () => {
  it("/start privat meldet an", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/start", { id: 42, type: "private" }));
    expect(db.prepare("SELECT name FROM nutzer WHERE telegram_id = 42").get()).toEqual({ name: "Kevin" });
    expect(letzterText()).toContain("angemeldet");
  });

  it("/start in der Gruppe legt sie an und zeigt den Mitmachen-Knopf", async () => {
    const { db, bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/start", GRUPPE));
    expect(db.prepare("SELECT name FROM gruppe").all()).toEqual([{ name: "Pumper" }]);
    expect(JSON.stringify(aufrufe[0]?.payload.reply_markup)).toContain("mitmachen");
  });

  it("Mitmachen-Knopf meldet einmal an", async () => {
    const { db, bot, aufrufe, gesendet } = testBot();
    await bot.handleUpdate(knopf("mitmachen"));
    await bot.handleUpdate(knopf("mitmachen"));
    expect(db.prepare("SELECT COUNT(*) AS n FROM gruppe_mitglied").get()).toEqual({ n: 1 });
    expect(gesendet().map((a) => a.payload.text)).toEqual(["Kevin ist dabei. Die Couch weint jetzt schon."]);
    expect(aufrufe.at(-1)?.payload.show_alert).toBe(true);
  });

  it("/sportarten listet die Stufen", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sportarten", GRUPPE));
    expect(letzterText()).toContain("intensiv (×3)");
    expect(letzterText()).toContain("• Joggen");
  });
});
