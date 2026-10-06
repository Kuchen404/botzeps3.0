import { describe, expect, it } from "vitest";
import { lokalesDatum } from "../scoring/datum.js";
import { beendeAbgelaufeneAbstimmungen } from "../zeitplan.js";
import { uhr } from "./kontext.js";
import { GRUPPE, KEVIN, PETER, PRIVAT, befehl, knoepfe, knopf, testBot } from "./testhilfe.js";

const MARIA = { id: 44, is_bot: false, first_name: "Maria" };
const heute = () => lokalesDatum(new Date(), "Europe/Berlin");

function sportart(db: ReturnType<typeof testBot>["db"], name: string) {
  return db.prepare("SELECT name, faktor FROM sportart WHERE name = ?").get(name) as { name: string; faktor: number } | undefined;
}

function trainings(db: ReturnType<typeof testBot>["db"]) {
  return db
    .prepare(
      `SELECT t.datum, t.minuten, t.faktor, s.name AS sportart, t.gruppen_nachricht_id AS post
       FROM training t JOIN sportart s ON s.id = t.sportart ORDER BY t.id`,
    )
    .all();
}

/** Drei Mitglieder, damit zwei Stimmen nötig sind. */
async function dreierGruppe(bot: ReturnType<typeof testBot>["bot"]) {
  for (const wer of [KEVIN, PETER, MARIA]) await bot.handleUpdate(knopf("mitmachen", GRUPPE, wer));
}

describe("Abstimmung über neue Sportarten", () => {
  it("unbekannte Sportart → Abstimmung → Mehrheit entscheidet, Training wird nachgetragen", async () => {
    const { db, bot, aufrufe, letzterText } = testBot();
    await dreierGruppe(bot);
    await bot.handleUpdate(befehl("/sport 45 Quidditch"));
    const vorschlag = knoepfe(aufrufe).find((k) => k.daten.startsWith("sn:"))!;
    expect(vorschlag.text).toContain("Quidditch");
    await bot.handleUpdate(knopf(vorschlag.daten));

    const abstimmung = aufrufe.filter((a) => a.methode === "sendMessage").at(-1)!;
    expect(abstimmung.payload.chat_id).toBe(GRUPPE.id);
    expect(String(abstimmung.payload.text)).toContain("Entschieden, sobald 2 abgestimmt haben");
    expect(String(abstimmung.payload.text)).toContain("(45 min)");
    expect(letzterText()).toContain("Abstimmung über Quidditch läuft");

    const stimmen = knoepfe([abstimmung]);
    await bot.handleUpdate(knopf(stimmen[2]!.daten, GRUPPE, KEVIN));
    expect(sportart(db, "Quidditch")).toBeUndefined();
    await bot.handleUpdate(knopf(stimmen[2]!.daten, GRUPPE, PETER));

    expect(sportart(db, "Quidditch")).toEqual({ name: "Quidditch", faktor: 3 });
    expect(trainings(db)).toMatchObject([{ datum: heute(), minuten: 45, faktor: 3, sportart: "Quidditch" }]);
    expect((trainings(db)[0] as { post: number }).post).toBeGreaterThan(1000);
    const bearbeitet = aufrufe.filter((a) => a.methode === "editMessageText").at(-1)!;
    expect(String(bearbeitet.payload.text)).toContain("✅ Entschieden: Quidditch zählt ab sofort als");
    expect(letzterText()).toContain("Kevin");

    // Danach ist die Abstimmung zu.
    await bot.handleUpdate(knopf(stimmen[0]!.daten, GRUPPE, MARIA));
    expect(aufrufe.at(-1)?.payload.text).toBe("Die Abstimmung ist vorbei.");
    expect(sportart(db, "Quidditch")?.faktor).toBe(3);
  });

  it("umgestimmt zählt nur die letzte Stimme", async () => {
    const { db, bot, aufrufe } = testBot();
    await dreierGruppe(bot);
    await bot.handleUpdate(befehl("/sportart Bouldern"));
    const stimmen = knoepfe(aufrufe);
    await bot.handleUpdate(knopf(stimmen[0]!.daten, GRUPPE, KEVIN));
    await bot.handleUpdate(knopf(stimmen[0]!.daten, GRUPPE, KEVIN));
    expect(sportart(db, "Bouldern")).toBeUndefined();
    await bot.handleUpdate(knopf(stimmen[1]!.daten, GRUPPE, PETER));
    // 1:1 → Compendium-Vorschlag oder mittel
    expect(sportart(db, "Bouldern")).toBeDefined();
  });

  it("/sportart: vorhandene Sportart und doppelte Abstimmung", async () => {
    const { bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sportart joggen"));
    expect(letzterText()).toContain("Joggen gibt's schon");
    await dreierGruppe(bot);
    await bot.handleUpdate(befehl("/sportart Handball"));
    const n = aufrufe.length;
    await bot.handleUpdate(befehl("/sportart handball", GRUPPE, PETER));
    expect(letzterText()).toContain("Über Handball wird in „Pumper“ schon abgestimmt.");
    expect(aufrufe.slice(n).filter((a) => a.methode === "sendMessage")).toHaveLength(1);
  });

  it("/sportart privat startet die Abstimmung in der Gruppe", async () => {
    const { bot, gesendet, letzterText } = testBot();
    await bot.handleUpdate(knopf("mitmachen"));
    await bot.handleUpdate(befehl("/sportart Handball", PRIVAT));
    expect(gesendet().at(-2)?.payload.chat_id).toBe(GRUPPE.id);
    expect(letzterText()).toBe("Abstimmung über Handball läuft in „Pumper“.");
  });

  it("ungültiger Name wird abgelehnt", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sportart <script>"));
    expect(letzterText()).toContain("Ungültiger Name");
  });

  it("fremde Vorschlagsknöpfe sind tabu", async () => {
    const { db, bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/sport 45 Quidditch"));
    const vorschlag = knoepfe(aufrufe).find((k) => k.daten.startsWith("sn:"))!;
    await bot.handleUpdate(knopf(vorschlag.daten, GRUPPE, PETER));
    expect(aufrufe.at(-1)?.payload.show_alert).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM abstimmung").get()).toEqual({ n: 0 });
  });

  it("manipulierte Minuten werden abgelehnt", async () => {
    const { db, bot } = testBot();
    await bot.handleUpdate(knopf(`sn:${KEVIN.id}:0:9999:Quidditch`));
    expect(db.prepare("SELECT COUNT(*) AS n FROM abstimmung").get()).toEqual({ n: 0 });
  });

  it("nach 24 Stunden entscheidet der Zeitplan mit den bisherigen Stimmen", async () => {
    const { db, bot, aufrufe } = testBot();
    const start = new Date("2026-10-06T10:00:00Z");
    uhr.jetzt = () => start;
    try {
      await dreierGruppe(bot);
      await bot.handleUpdate(befehl("/sport 30 Quidditch"));
      await bot.handleUpdate(knopf(knoepfe(aufrufe).find((k) => k.daten.startsWith("sn:"))!.daten));
      await bot.handleUpdate(knopf(knoepfe(aufrufe)[0]!.daten, GRUPPE, PETER));

      const gesendet: { chat: number; text: string }[] = [];
      const senden = async (chat: number, text: string) => {
        gesendet.push({ chat, text });
        return 7000 + gesendet.length;
      };
      await beendeAbgelaufeneAbstimmungen(db, senden, new Date("2026-10-07T09:59:00Z"));
      expect(gesendet).toEqual([]);
      await beendeAbgelaufeneAbstimmungen(db, senden, new Date("2026-10-07T10:00:00Z"));
      expect(gesendet[0]).toEqual({
        chat: GRUPPE.id,
        text: "✅ Entschieden: Quidditch zählt ab sofort als leicht (×1). (Abstimmung nach 24 Stunden beendet)",
      });
      expect(gesendet[1]?.text).toContain("Kevin");
      expect(trainings(db)).toMatchObject([{ minuten: 30, faktor: 1, sportart: "Quidditch", post: 7002 }]);
      await beendeAbgelaufeneAbstimmungen(db, senden, new Date("2026-10-08T10:00:00Z"));
      expect(gesendet).toHaveLength(2);
    } finally {
      uhr.jetzt = () => new Date();
    }
  });
});
