import { Bot, InlineKeyboard } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import type { Db } from "../db/index.js";
import { speichereNutzer, sportartenDerGruppe, trageMitgliedEin } from "../db/repo.js";
import { STANDARD_SPORTARTEN, sportartenText } from "../domain/sportarten.js";
import { log } from "../log.js";
import { anzeigename, argumente, gruppenId, gruppenZeitzone, heute, istGruppe } from "./kontext.js";
import { nimmAnAktuellerSeasonTeil } from "../db/season-repo.js";
import { seasonModul } from "./season.js";
import { standModul } from "./stand.js";
import { erinnerungsModul } from "./erinnerungen.js";
import { verlaufModul } from "./verlauf.js";
import { abstimmungsModul } from "./abstimmung.js";
import { teamModul } from "./teams.js";
import { ruhmModul } from "./ruhm.js";
import { hypeModul } from "./hype.js";
import { demoModul } from "../demo/index.js";
import { sportModul } from "./sport.js";
import { WAAGE_ANLEITUNG, waageModul } from "./waage.js";
import { appKnopf } from "./app-knopf.js";
import { HILFE, MITMACHEN_KNOPF, gruppenBegruessung, mitgliedNeu, mitgliedSchonDabei, willkommenPrivat } from "./texte.js";

const MITMACHEN = "mitmachen";

export const BEFEHLE = [
  { command: "start", description: "Anmelden" },
  { command: "sport", description: "Training eintragen, z. B. /sport 45 Joggen" },
  { command: "waage", description: "Messung eintragen (nur privat)" },
  { command: "ohnewaage", description: "Ohne Körperfettwaage mitmachen (aus: /ohnewaage aus)" },
  { command: "stand", description: "Dein Punktestand" },
  { command: "app", description: "Mini App mit Diagrammen und Einstellungen" },
  { command: "verlauf", description: "Einträge korrigieren oder löschen (privat)" },
  { command: "rangliste", description: "Rangliste der Season" },
  { command: "erfolge", description: "Deine Erfolge und dein Rang" },
  { command: "ruhmeshalle", description: "Sieger, Ränge und Rekorde der Gruppe" },
  { command: "season", description: "Season anzeigen oder anlegen" },
  { command: "teams", description: "Teams anzeigen oder auslosen" },
  { command: "team", description: "Team beitreten oder gründen, z. B. /team Bizeps-Brigade" },
  { command: "sportarten", description: "Welche Sportart wie zählt" },
  { command: "sportart", description: "Neue Sportart zur Abstimmung stellen" },
  { command: "erinnerungen", description: "Erinnerungen an/aus, Uhrzeit" },
  { command: "einfuehrung", description: "Fleiß und Fortschritt kurz erklärt" },
  { command: "hype", description: "Eine Woche Vorfreude vor dem Start (Admins)" },
  { command: "hilfe", description: "So funktioniert Botzeps" },
];

export function erstelleBot(token: string, db: Db, botInfo?: UserFromGetMe, optionen: { miniAppUrl?: string; demo?: boolean } = {}): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  bot.command("app", async (ctx) => {
    if (!optionen.miniAppUrl) {
      await ctx.reply("Die Mini App ist auf diesem Server noch nicht eingerichtet (MINIAPP_URL bzw. Webhook fehlt).");
      return;
    }
    await ctx.reply("Stand, Diagramme, Waage, Einträge und Einstellungen:", {
      reply_markup: appKnopf(ctx.me, ctx.chat, optionen.miniAppUrl),
    });
  });

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const gruppe = gruppenId(db, ctx);
    if (gruppe === null) {
      const app = appKnopf(ctx.me, ctx.chat, optionen.miniAppUrl);
      if (argumente(ctx) === "app" && app) {
        await ctx.reply("Hier ist die Mini App:", { reply_markup: app });
        return;
      }
      if (argumente(ctx) === "verlauf") {
        await ctx.reply("Hier ist dein Verlauf: /verlauf");
        return;
      }
      if (argumente(ctx) === "waage") await ctx.reply(WAAGE_ANLEITUNG);
      else await ctx.reply(willkommenPrivat(nutzer.name), app ? { reply_markup: app } : {});
      return;
    }
    const knoepfe = new InlineKeyboard().text(MITMACHEN_KNOPF, MITMACHEN);
    const app = appKnopf(ctx.me, ctx.chat, optionen.miniAppUrl);
    await ctx.reply(gruppenBegruessung(ctx.chat.title ?? "die Gruppe"), {
      reply_markup: app ? knoepfe.row().append(app) : knoepfe,
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
    nimmAnAktuellerSeasonTeil(db, gruppe, nutzer.id, heute(gruppenZeitzone()));
    if (neu) {
      await ctx.answerCallbackQuery({ text: "Angemeldet 💪" });
      await ctx.reply(mitgliedNeu(nutzer.name));
    } else {
      await ctx.answerCallbackQuery({ text: mitgliedSchonDabei(), show_alert: true });
    }
  });

  bot.use(sportModul(db));
  bot.use(waageModul(db));
  bot.use(seasonModul(db));
  bot.use(standModul(db, optionen.miniAppUrl));
  bot.use(erinnerungsModul(db));
  bot.use(verlaufModul(db));
  bot.use(abstimmungsModul(db));
  bot.use(teamModul(db));
  bot.use(ruhmModul(db));
  bot.use(hypeModul(db));
  if (optionen.demo) bot.use(demoModul(db, optionen.miniAppUrl));

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
