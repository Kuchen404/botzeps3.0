import { afterEach, describe, expect, it } from "vitest";
import { teamsDerSeason } from "../db/team-repo.js";
import { uhr } from "./kontext.js";
import { GRUPPE, KEVIN, PETER, PRIVAT, befehl, knoepfe, knopf, testBot } from "./testhilfe.js";

const MARIA = { id: 44, is_bot: false, first_name: "Maria" };
const JONAS = { id: 45, is_bot: false, first_name: "Jonas" };
const FRANZ = { id: 46, is_bot: false, first_name: "Franz" };

const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});
function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T08:00:00Z`);
}

/** Season „Herbst“ ab Mo 12.10.2026, angelegt von Kevin, mit vier Leuten. */
async function aufbau() {
  const t = testBot();
  tag("2026-10-05");
  for (const wer of [PETER, MARIA, JONAS]) await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, wer));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  const groessen = () => teamsDerSeason(t.db, 1).map((x) => x.mitglieder.length);
  return { ...t, groessen };
}

describe("Teams", () => {
  it("auslosen: nur Ersteller, gleich große Teams, Nachzügler ins kleinste", async () => {
    const { bot, aufrufe, letzterText, groessen } = await aufbau();
    await bot.handleUpdate(befehl("/teams"));
    expect(letzterText()).toContain("Noch keine Teams");
    const kn = knoepfe(aufrufe);
    expect(kn.map((k) => k.text)).toEqual(["🎲 2 Teams auslosen"]);

    await bot.handleUpdate(knopf(kn[0]!.daten, GRUPPE, PETER));
    expect(aufrufe.at(-1)?.payload.show_alert).toBe(true);
    expect(groessen()).toEqual([]);

    await bot.handleUpdate(knopf(kn[0]!.daten));
    expect(groessen()).toEqual([2, 2]);
    expect(aufrufe.at(-1)?.methode).toBe("editMessageText");
    expect(knoepfe(aufrufe).map((k) => k.text)).toContain("Teams auflösen");

    await bot.handleUpdate(knopf("mitmachen", GRUPPE, FRANZ));
    expect(groessen().sort()).toEqual([2, 3]);

    await bot.handleUpdate(knopf(`tm:1:0`));
    expect(groessen()).toEqual([]);
  });

  it("/team Name: gründen, beitreten, wechseln; leere Teams verschwinden", async () => {
    const { db, bot, letzterText } = await aufbau();
    await bot.handleUpdate(befehl("/team Bizeps-Brigade"));
    expect(letzterText()).toBe("Kevin gründet „Bizeps-Brigade“. Wer mitwill: /team Bizeps-Brigade");
    await bot.handleUpdate(befehl("/team bizeps-brigade", GRUPPE, PETER));
    expect(letzterText()).toBe("Peter ist jetzt in „Bizeps-Brigade“ (Kevin, Peter).");
    await bot.handleUpdate(befehl("/team Couch", PRIVAT));
    expect(teamsDerSeason(db, 1).map((t) => [t.name, t.mitglieder.length])).toEqual([
      ["Bizeps-Brigade", 1],
      ["Couch", 1],
    ]);
    await bot.handleUpdate(befehl("/team Bizeps-Brigade"));
    expect(teamsDerSeason(db, 1).map((t) => t.name)).toEqual(["Bizeps-Brigade"]);
    await bot.handleUpdate(befehl("/team", PRIVAT));
    expect(letzterText()).toBe("Du bist in „Bizeps-Brigade“ mit Kevin, Peter.");
    await bot.handleUpdate(befehl("/team <b>"));
    expect(letzterText()).toContain("Ungültiger Teamname");
  });

  it("ab Start fest, Teamwertung in /teams und /rangliste", async () => {
    const { bot, aufrufe, letzterText } = await aufbau();
    await bot.handleUpdate(befehl("/team Eisen"));
    await bot.handleUpdate(befehl("/team Eisen", GRUPPE, PETER));
    await bot.handleUpdate(befehl("/team Couch", GRUPPE, MARIA));
    await bot.handleUpdate(befehl("/team Couch", GRUPPE, JONAS));

    tag("2026-10-13");
    await bot.handleUpdate(befehl("/team Couch"));
    expect(letzterText()).toBe("Die Season läuft schon, die Teams stehen fest.");
    await bot.handleUpdate(befehl("/sport 100 Joggen"));
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, MARIA));

    await bot.handleUpdate(befehl("/rangliste"));
    expect(letzterText()).toContain("👥 Teamwertung:");

    const n = aufrufe.length;
    await bot.handleUpdate(befehl("/teams"));
    expect(letzterText()).toContain("Eisen: Kevin, Peter");
    expect(letzterText()).toContain("Couch: Jonas, Maria");
    expect(aufrufe.slice(n).some((a) => a.payload.reply_markup)).toBe(false);
  });
});
