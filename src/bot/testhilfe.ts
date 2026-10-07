import type { Update, UserFromGetMe } from "grammy/types";
import { oeffneDb } from "../db/index.js";
import { erstelleBot } from "./index.js";

export const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: "Botzeps",
  username: "botzeps_test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as UserFromGetMe;

export const KEVIN = { id: 42, is_bot: false, first_name: "Kevin" };
export const PETER = { id: 43, is_bot: false, first_name: "Peter" };
export const GRUPPE = { id: -100123, type: "supergroup" as const, title: "Pumper" };
export const PRIVAT = { id: 42, type: "private" as const, first_name: "Kevin" };

type Chat = { id: number; type: "private" | "supergroup"; title?: string };

/** Bot mit abgefangenen API-Aufrufen statt echter Telegram-Verbindung. */
export function testBot(optionen: Parameters<typeof erstelleBot>[3] = {}) {
  const db = oeffneDb(":memory:");
  const bot = erstelleBot("test-token", db, BOT_INFO, optionen);
  const aufrufe: { methode: string; payload: Record<string, unknown> }[] = [];
  let nachrichtId = 1000;
  bot.api.config.use(async (_prev, methode, payload) => {
    const p = payload as Record<string, unknown>;
    aufrufe.push({ methode, payload: p });
    if (methode === "sendMessage" || methode === "sendPhoto") {
      return { ok: true, result: { message_id: ++nachrichtId, date: 0, chat: { id: p.chat_id }, text: p.text, caption: p.caption } } as never;
    }
    return { ok: true, result: true } as never;
  });
  const gesendet = () => aufrufe.filter((a) => a.methode === "sendMessage" || a.methode === "editMessageText");
  return { db, bot, aufrufe, gesendet, letzterText: () => String(gesendet().at(-1)?.payload.text) };
}

let updateId = 0;

export function befehl(text: string, chat: Chat = GRUPPE, from = KEVIN): Update {
  const name = text.split(" ")[0] ?? text;
  return {
    update_id: ++updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: chat as never,
      from,
      text,
      entities: [{ type: "bot_command", offset: 0, length: name.length }],
    },
  };
}

export function knopf(daten: string, chat: Chat = GRUPPE, from = KEVIN): Update {
  return {
    update_id: ++updateId,
    callback_query: {
      id: String(updateId),
      from,
      chat_instance: "x",
      data: daten,
      message: { message_id: 1, date: 0, chat, from: { ...BOT_INFO } } as never,
    },
  };
}

/** Callback-Daten aller Knöpfe der letzten Nachricht mit Tastatur. */
export function knoepfe(aufrufe: { payload: Record<string, unknown> }[]): { text: string; daten: string }[] {
  const mit = aufrufe.filter((a) => a.payload.reply_markup).at(-1);
  const markup = mit?.payload.reply_markup as { inline_keyboard: { text: string; callback_data?: string }[][] } | undefined;
  return (markup?.inline_keyboard.flat() ?? []).map((k) => ({ text: k.text, daten: k.callback_data ?? "" }));
}
