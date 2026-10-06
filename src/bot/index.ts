import { Bot, InlineKeyboard, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import type { Db } from "../db/index.js";
import { speichereGruppe, speichereNutzer, sportartenDerGruppe, trageMitgliedEin } from "../db/repo.js";
import { STANDARD_SPORTARTEN, sportartenText } from "../domain/sportarten.js";
import { log } from "../log.js";
import { HILFE, MITMACHEN_KNOPF, gruppenBegruessung, mitgliedNeu, mitgliedSchonDabei, willkommenPrivat } from "./texte.js";

const MITMACHEN = "mitmachen";

export const BEFEHLE = [
  { command: "start", description: "Anmelden" },
  { command: "sportarten", description: "Welche Sportart wie zählt" },
  { command: "hilfe", description: "So funktioniert Botzeps" },
];

function anzeigename(ctx: Context): string {
  const u = ctx.from;
  if (!u) return "Unbekannt";
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || String(u.id);
}

function istGruppe(ctx: Context): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

function gruppenId(db: Db, ctx: Context): number | null {
  const chat = ctx.chat;
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) return null;
  return speichereGruppe(db, chat.id, chat.title);
}

export function erstelleBot(token: string, db: Db, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const gruppe = gruppenId(db, ctx);
    if (gruppe === null) {
      await ctx.reply(willkommenPrivat(nutzer.name));
      return;
    }
    await ctx.reply(gruppenBegruessung(ctx.chat.title ?? "die Gruppe"), {
      reply_markup: new InlineKeyboard().text(MITMACHEN_KNOPF, MITMACHEN),
    });
  });

  bot.callbackQuery(MITMACHEN, async (ctx) => {
    const gruppe = gruppenId(db, ctx);
    if (gruppe === null) {
      await ctx.answerCallbackQuery();
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const neu = trageMitgliedEin(db, gruppe, nutzer.id);
    if (neu) {
      await ctx.answerCallbackQuery({ text: "Angemeldet 💪" });
      await ctx.reply(mitgliedNeu(nutzer.name));
    } else {
      await ctx.answerCallbackQuery({ text: mitgliedSchonDabei(), show_alert: true });
    }
  });

  bot.command(["hilfe", "help"], (ctx) => ctx.reply(HILFE));

  bot.command("sportarten", async (ctx) => {
    const gruppe = istGruppe(ctx) ? gruppenId(db, ctx) : null;
    const liste = gruppe === null ? STANDARD_SPORTARTEN : sportartenDerGruppe(db, gruppe);
    await ctx.reply(`So zählt jede Sportart (Minuten × Faktor):\n\n${sportartenText(liste)}`);
  });

  bot.catch((err) => {
    log.error(`Fehler bei Update ${err.ctx.update.update_id}`, err.error);
  });

  return bot;
}
