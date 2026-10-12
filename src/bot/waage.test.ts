import { afterEach, describe, expect, it } from "vitest";
import { teilnahme } from "../db/season-repo.js";
import { uhr } from "./kontext.js";
import { GRUPPE, PETER, PRIVAT, befehl, knoepfe, knopf, testBot } from "./testhilfe.js";

function messungen(db: ReturnType<typeof testBot>["db"]) {
  return db.prepare("SELECT gewicht_kg AS g, fett_pct AS f, muskel_pct AS m, markiert FROM messung ORDER BY id").all();
}

describe("/waage", () => {
  it("speichert privat und zeigt die Massen", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/waage 80 25 40", PRIVAT));
    expect(messungen(db)).toEqual([{ g: 80, f: 25, m: 40, markiert: 0 }]);
    expect(letzterText()).toContain("Fett 25 % = 20 kg");
    expect(letzterText()).toContain("Muskel 40 % = 32 kg");
  });

  it("verweigert Werte in der Gruppe und verlinkt den privaten Chat", async () => {
    const { db, bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(befehl("/waage 80 25 40", GRUPPE));
    expect(letzterText()).toContain("nur privat");
    expect(JSON.stringify(aufrufe.at(-1)?.payload.reply_markup)).toContain("t.me/botzeps_test_bot?start=waage");
    expect(messungen(db)).toEqual([]);
  });

  it("ohne Werte gibt es die Anleitung, auch über den Link aus der Gruppe", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/waage", PRIVAT));
    expect(letzterText()).toContain("Beispiel: /waage 82,4 18,5 41,2");
    await bot.handleUpdate(befehl("/start waage", PRIVAT));
    expect(letzterText()).toContain("Beispiel: /waage 82,4 18,5 41,2");
  });

  it("unplausible Werte werden abgelehnt", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/waage 80 2 40", PRIVAT));
    expect(letzterText()).toContain("unplausibel");
    expect(messungen(db)).toEqual([]);
  });

  it("große Sprünge müssen bestätigt werden und werden markiert", async () => {
    const { db, bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(befehl("/waage 80 25 40", PRIVAT));
    await bot.handleUpdate(befehl("/waage 80 29,5 40", PRIVAT));
    expect(letzterText()).toContain("weicht stark");
    expect(messungen(db)).toHaveLength(1);
    const [stimmt, verwerfen] = knoepfe(aufrufe);
    expect(verwerfen?.daten).toBe("wn");
    await bot.handleUpdate(knopf(stimmt!.daten, PRIVAT));
    expect(messungen(db)).toEqual([
      { g: 80, f: 25, m: 40, markiert: 0 },
      { g: 80, f: 29.5, m: 40, markiert: 1 },
    ]);
  });

  it("verworfene Sprünge werden nicht gespeichert", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/waage 80 25 40", PRIVAT));
    await bot.handleUpdate(befehl("/waage 90 25 40", PRIVAT));
    await bot.handleUpdate(knopf("wn", PRIVAT));
    expect(letzterText()).toContain("Verworfen");
    expect(messungen(db)).toHaveLength(1);
  });

  it("manipulierte Bestätigungen werden geprüft", async () => {
    const { db, bot } = testBot();
    await bot.handleUpdate(knopf("wj:0:80:1:40", PRIVAT));
    await bot.handleUpdate(knopf("wj:9:80:25:40", PRIVAT));
    expect(messungen(db)).toEqual([]);
  });
});

describe("/ohnewaage", () => {
  const echteUhr = uhr.jetzt;
  afterEach(() => {
    uhr.jetzt = echteUhr;
  });
  const tag = (datum: string) => (uhr.jetzt = () => new Date(`${datum}T08:00:00Z`));

  it("an und aus bis zum Ende der Kalibrierwoche, danach fest", async () => {
    const { db, bot, letzterText } = testBot();
    tag("2026-10-05");
    await bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
    await bot.handleUpdate(befehl("/season Herbst"));
    const peter = (db.prepare("SELECT id FROM nutzer WHERE telegram_id = ?").get(PETER.id) as { id: number }).id;
    await bot.handleUpdate(befehl("/ohnewaage", GRUPPE, PETER));
    expect(letzterText()).toContain("ohne Waage dabei");
    expect(teilnahme(db, 1, peter)?.ohneWaage).toBe(true);

    await bot.handleUpdate(befehl("/ohnewaage aus", { ...PRIVAT, id: PETER.id, first_name: "Peter" }, PETER));
    expect(letzterText()).toContain("Waage ist zurück");
    expect(teilnahme(db, 1, peter)?.ohneWaage).toBe(false);
    await bot.handleUpdate(befehl("/ohnewaage", GRUPPE, PETER));

    tag("2026-10-12");
    await bot.handleUpdate(befehl("/ohnewaage aus", GRUPPE, PETER));
    expect(letzterText()).toContain("fest");
    expect(teilnahme(db, 1, peter)?.ohneWaage).toBe(true);
    await bot.handleUpdate(befehl("/stand", GRUPPE, PETER));
    expect(letzterText()).toContain("ohne Waage");
  });

  it("ohne Season gibt's nichts umzustellen", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/ohnewaage", PRIVAT));
    expect(letzterText()).toContain("keiner laufenden oder kommenden Season");
  });
});
