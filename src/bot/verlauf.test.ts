import { afterEach, describe, expect, it } from "vitest";
import { uhr } from "./kontext.js";
import { GRUPPE, PETER, PRIVAT, befehl, knoepfe, knopf, testBot } from "./testhilfe.js";

const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});
function tag(datum: string, uhrzeit = "08:00"): void {
  uhr.jetzt = () => new Date(`${datum}T${uhrzeit}:00Z`);
}

async function mitEintraegen() {
  const t = testBot();
  tag("2026-10-10");
  await t.bot.handleUpdate(befehl("/sport 45 Joggen"));
  tag("2026-10-10", "08:05");
  await t.bot.handleUpdate(befehl("/waage 80 25 40", PRIVAT));
  tag("2026-10-14");
  await t.bot.handleUpdate(befehl("/sport 60 Krafttraining"));
  tag("2026-10-14", "08:05");
  await t.bot.handleUpdate(befehl("/waage 80,5 24,5 40", PRIVAT));
  await t.bot.handleUpdate(befehl("/verlauf", PRIVAT));
  return t;
}

const aktiv = (db: ReturnType<typeof testBot>["db"], tabelle: "training" | "messung") =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${tabelle} WHERE geloescht_am IS NULL`).get() as { n: number }).n;

describe("/verlauf", () => {
  it("listet die letzten Einträge, neueste zuerst", async () => {
    const { aufrufe } = await mitEintraegen();
    expect(knoepfe(aufrufe).map((k) => k.text)).toEqual([
      "⚖️ 14.10. 80,5 kg · 24,5 % · 40 %",
      "🏃 14.10. 60 min Krafttraining",
      "⚖️ 10.10. 80 kg · 25 % · 40 %",
      "🏃 10.10. 45 min Joggen",
    ]);
  });

  it("löscht ein Training samt Gruppenpost und protokolliert es", async () => {
    const { db, bot, aufrufe, letzterText } = await mitEintraegen();
    const kraft = knoepfe(aufrufe).find((k) => k.text.includes("Krafttraining"))!;
    await bot.handleUpdate(knopf(kraft.daten, PRIVAT));
    await bot.handleUpdate(knopf(knoepfe(aufrufe).find((k) => k.text === "🗑 Löschen")!.daten, PRIVAT));
    expect(letzterText()).toContain("Gelöscht: 🏃 14.10. 60 min Krafttraining");
    expect(aktiv(db, "training")).toBe(1);
    expect(aufrufe.some((a) => a.methode === "deleteMessage" && a.payload.chat_id === GRUPPE.id)).toBe(true);
    expect(db.prepare("SELECT tabelle, art FROM aenderung WHERE art = 'geloescht'").all()).toEqual([
      { tabelle: "training", art: "geloescht" },
    ]);
  });

  it("ändert die Dauer und korrigiert den Gruppenpost", async () => {
    const { db, bot, aufrufe, letzterText } = await mitEintraegen();
    await bot.handleUpdate(knopf(knoepfe(aufrufe).find((k) => k.text.includes("Krafttraining"))!.daten, PRIVAT));
    await bot.handleUpdate(knopf(knoepfe(aufrufe).find((k) => k.text === "30 min")!.daten, PRIVAT));
    expect(letzterText()).toContain("Geändert: 🏃 14.10. 30 min Krafttraining");
    expect(db.prepare("SELECT minuten FROM training WHERE geloescht_am IS NULL ORDER BY id DESC LIMIT 1").get()).toEqual({ minuten: 30 });
    const post = aufrufe.find((a) => a.methode === "editMessageText" && a.payload.chat_id === GRUPPE.id);
    expect(post?.payload.text).toBe("Kevin: 30 min Krafttraining (korrigiert von 60 min)");
  });

  it("löscht eine Messung", async () => {
    const { db, bot, aufrufe } = await mitEintraegen();
    await bot.handleUpdate(knopf(knoepfe(aufrufe)[0]!.daten, PRIVAT));
    await bot.handleUpdate(knopf(knoepfe(aufrufe).find((k) => k.text === "🗑 Löschen")!.daten, PRIVAT));
    expect(aktiv(db, "messung")).toBe(1);
  });

  it("ältere Einträge bleiben, wie sie sind", async () => {
    const { db, bot, aufrufe, letzterText } = await mitEintraegen();
    const joggen = knoepfe(aufrufe).find((k) => k.text.includes("Joggen"))!;
    await bot.handleUpdate(knopf(joggen.daten, PRIVAT));
    expect(letzterText()).toContain("das bleibt so");
    expect(knoepfe(aufrufe).map((k) => k.text)).toEqual(["Zurück"]);
    // auch nicht über gebastelte Knöpfe
    await bot.handleUpdate(knopf(joggen.daten.replace("vl:", "vd:"), PRIVAT));
    expect(aktiv(db, "training")).toBe(2);
  });

  it("fremde Einträge sind tabu", async () => {
    const { db, bot } = await mitEintraegen();
    const id = (db.prepare("SELECT id FROM training ORDER BY id DESC LIMIT 1").get() as { id: number }).id;
    const PETER_PRIVAT = { id: PETER.id, type: "private" as const, first_name: "Peter" };
    await bot.handleUpdate(knopf(`vd:t:${id}`, PETER_PRIVAT, PETER));
    await bot.handleUpdate(knopf(`vt:${id}:15`, PETER_PRIVAT, PETER));
    expect(aktiv(db, "training")).toBe(2);
    expect(db.prepare("SELECT minuten FROM training WHERE id = ?").get(id)).toEqual({ minuten: 60 });
  });

  it("in der Gruppe nur ein Link in den privaten Chat", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/verlauf", GRUPPE));
    expect(letzterText()).toContain("nur privat");
  });
});
