import { describe, expect, it } from "vitest";
import { lokalesDatum, plusTage } from "../scoring/datum.js";
import { GRUPPE, PETER, PRIVAT, befehl, knoepfe, knopf, testBot } from "./testhilfe.js";

const heute = () => lokalesDatum(new Date(), "Europe/Berlin");

function trainings(db: ReturnType<typeof testBot>["db"]) {
  return db
    .prepare(
      `SELECT t.datum, t.minuten, t.faktor, s.name AS sportart, t.gruppen_nachricht_id AS post
       FROM training t JOIN sportart s ON s.id = t.sportart ORDER BY t.id`,
    )
    .all() as { datum: string; minuten: number; faktor: number; sportart: string; post: number | null }[];
}

describe("/sport", () => {
  it("in der Gruppe: trägt ein, postet dort und meldet automatisch an", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport 45 joggen"));
    expect(trainings(db)).toEqual([{ datum: heute(), minuten: 45, faktor: 3, sportart: "Joggen", post: 1001 }]);
    expect(letzterText()).toContain("Kevin");
    expect(db.prepare("SELECT COUNT(*) AS n FROM gruppe_mitglied").get()).toEqual({ n: 1 });
  });

  it("privat: trägt ein, postet in der Gruppe und bestätigt privat", async () => {
    const { db, bot, gesendet } = testBot();
    await bot.handleUpdate(knopf("mitmachen"));
    await bot.handleUpdate(befehl("/sport 60 Krafttraining gestern", PRIVAT));
    const [, post, bestaetigung] = gesendet();
    expect(post?.payload.chat_id).toBe(GRUPPE.id);
    expect(String(post?.payload.text)).toContain("(gestern)");
    expect(bestaetigung?.payload.chat_id).toBe(PRIVAT.id);
    expect(bestaetigung?.payload.text).toBe("Eingetragen: 60 min Krafttraining (gestern), 120 Lastpunkte. In „Pumper“ gepostet.");
    expect(trainings(db)[0]).toMatchObject({ datum: plusTage(heute(), -1), post: post ? 1002 : null });
  });

  it("privat ohne Gruppe: Hinweis, nichts gespeichert", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport 45 Joggen", PRIVAT));
    expect(letzterText()).toContain("keiner Botzeps-Gruppe");
    expect(trainings(db)).toEqual([]);
  });

  it("mit Knöpfen: erst Sportart, dann Dauer", async () => {
    const { db, bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport"));
    expect(letzterText()).toBe("Was hast du gemacht?");
    const yoga = knoepfe(aufrufe).find((k) => k.text === "Yoga")!;
    await bot.handleUpdate(knopf(yoga.daten));
    expect(letzterText()).toBe("Yoga: wie lange?");
    const dreissig = knoepfe(aufrufe).find((k) => k.text === "30 min")!;
    await bot.handleUpdate(knopf(dreissig.daten));
    expect(trainings(db)).toEqual([{ datum: heute(), minuten: 30, faktor: 1, sportart: "Yoga", post: 1 }]);
    expect(aufrufe.at(-1)?.methode).toBe("editMessageText");
  });

  it("zuletzt genutzte Sportarten stehen vorne", async () => {
    const { bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/sport 30 Squash"));
    await bot.handleUpdate(befehl("/sport 45"));
    expect(knoepfe(aufrufe)[0]?.text).toBe("Squash");
  });

  it("unbekannte Sportart: Auswahl statt Fehler, Minuten bleiben erhalten", async () => {
    const { db, bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport 45 Quidditch"));
    expect(letzterText()).toContain("„Quidditch“ kenne ich nicht");
    const fussball = knoepfe(aufrufe).find((k) => k.text === "Fußball")!;
    await bot.handleUpdate(knopf(fussball.daten));
    expect(trainings(db)).toMatchObject([{ minuten: 45, sportart: "Fußball" }]);
  });

  it("fremde Knöpfe sind tabu", async () => {
    const { db, bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/sport 45"));
    const knopfDaten = knoepfe(aufrufe)[0]!.daten;
    await bot.handleUpdate(knopf(knopfDaten, GRUPPE, PETER));
    expect(aufrufe.at(-1)?.payload.show_alert).toBe(true);
    expect(trainings(db)).toEqual([]);
  });

  it("manipulierte Knöpfe werden geprüft", async () => {
    const { db, bot } = testBot();
    await bot.handleUpdate(befehl("/sport 45 Joggen")); // Gruppe anlegen
    const joggen = db.prepare("SELECT id FROM sportart WHERE name = 'Joggen'").get() as { id: number };
    await bot.handleUpdate(knopf(`sp:42:9:45:${joggen.id}`));
    await bot.handleUpdate(knopf(`sp:42:0:999:${joggen.id}`));
    expect(trainings(db)).toHaveLength(1);
  });

  it("lehnt unplausible Dauer ab", async () => {
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport 500 Joggen"));
    expect(letzterText()).toContain("zwischen 5 und 240");
    expect(trainings(db)).toEqual([]);
  });
});
