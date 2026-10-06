import { describe, expect, it } from "vitest";
import type { Update, UserFromGetMe } from "grammy/types";
import { oeffneDb } from "../db/index.js";
import { erstelleBot } from "./index.js";

const BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: "Botzeps",
  username: "botzeps_test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
} as UserFromGetMe;

const KEVIN = { id: 42, is_bot: false, first_name: "Kevin" };
const GRUPPE = { id: -100123, type: "supergroup" as const, title: "Pumper" };

/** Bot mit abgefangenen API-Aufrufen statt echter Telegram-Verbindung. */
function testBot() {
  const db = oeffneDb(":memory:");
  const bot = erstelleBot("test-token", db, BOT_INFO);
  const aufrufe: { methode: string; payload: Record<string, unknown> }[] = [];
  bot.api.config.use(async (_prev, methode, payload) => {
    aufrufe.push({ methode, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
  return { db, bot, aufrufe };
}

let updateId = 0;
function befehl(text: string, chat: { id: number; type: "private" | "supergroup"; title?: string }): Update {
  const name = text.split(" ")[0] ?? text;
  return {
    update_id: ++updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: chat as never,
      from: KEVIN,
      text,
      entities: [{ type: "bot_command", offset: 0, length: name.length }],
    },
  };
}

function knopf(daten: string): Update {
  return {
    update_id: ++updateId,
    callback_query: {
      id: String(updateId),
      from: KEVIN,
      chat_instance: "x",
      data: daten,
      message: { message_id: 1, date: 0, chat: GRUPPE, from: { ...BOT_INFO } } as never,
    },
  };
}

describe("Bot", () => {
  it("/start privat meldet an", async () => {
    const { db, bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/start", { id: 42, type: "private" }));
    expect(db.prepare("SELECT name FROM nutzer WHERE telegram_id = 42").get()).toEqual({ name: "Kevin" });
    expect(aufrufe[0]?.methode).toBe("sendMessage");
    expect(String(aufrufe[0]?.payload.text)).toContain("angemeldet");
  });

  it("/start in der Gruppe legt sie an und zeigt den Mitmachen-Knopf", async () => {
    const { db, bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/start", GRUPPE));
    expect(db.prepare("SELECT name FROM gruppe").all()).toEqual([{ name: "Pumper" }]);
    expect(JSON.stringify(aufrufe[0]?.payload.reply_markup)).toContain("mitmachen");
  });

  it("Mitmachen-Knopf meldet einmal an", async () => {
    const { db, bot, aufrufe } = testBot();
    await bot.handleUpdate(knopf("mitmachen"));
    await bot.handleUpdate(knopf("mitmachen"));
    expect(db.prepare("SELECT COUNT(*) AS n FROM gruppe_mitglied").get()).toEqual({ n: 1 });
    const texte = aufrufe.filter((a) => a.methode === "sendMessage").map((a) => a.payload.text);
    expect(texte).toEqual(["Kevin ist dabei. Die Couch weint jetzt schon."]);
    expect(aufrufe.at(-1)?.payload.show_alert).toBe(true);
  });

  it("/sportarten listet die Stufen", async () => {
    const { bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/sportarten", GRUPPE));
    const text = String(aufrufe[0]?.payload.text);
    expect(text).toContain("intensiv (×3)");
    expect(text).toContain("• Joggen");
  });
});
