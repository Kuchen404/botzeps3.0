import { InputFile } from "grammy";
import { ladeConfig } from "./config.js";
import { oeffneDb } from "./db/index.js";
import { BEFEHLE, erstelleBot } from "./bot/index.js";
import { MINIAPP_PFAD, WEBHOOK_PFAD, erstelleServer } from "./server.js";
import { log, setzeLogStufe } from "./log.js";
import { starteZeitplan } from "./zeitplan.js";

async function main(): Promise<void> {
  const config = ladeConfig();
  setzeLogStufe(config.LOG_LEVEL);

  const db = oeffneDb(config.DATABASE_PATH);
  log.info(`Datenbank geöffnet: ${config.DATABASE_PATH}`);

  // Mini App: eigene Adresse oder dieselbe wie der Webhook, Pfad /app
  const miniAppUrl =
    config.MINIAPP_URL ?? (config.BOT_MODE === "webhook" && config.WEBHOOK_URL ? new URL(MINIAPP_PFAD, config.WEBHOOK_URL).toString() : undefined);
  const bot = erstelleBot(config.BOT_TOKEN, db, undefined, { miniAppUrl });
  await bot.init();
  await bot.api.setMyCommands(BEFEHLE);
  log.info(`Angemeldet als @${bot.botInfo.username}`);
  if (miniAppUrl) {
    try {
      await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Botzeps", web_app: { url: miniAppUrl } } });
      log.info(`Mini App: ${miniAppUrl}`);
    } catch (err) {
      log.warn(`Menüknopf für die Mini App nicht gesetzt (${miniAppUrl})`, err);
    }
  }

  const webhook = config.BOT_MODE === "webhook";
  const miniApp = {
    db,
    botToken: config.BOT_TOKEN,
    gruppenpost: async (chatId: number, nachrichtId: number, text: string | null) => {
      try {
        if (text === null) await bot.api.deleteMessage(chatId, nachrichtId);
        else await bot.api.editMessageText(chatId, nachrichtId, text);
      } catch (err) {
        log.debug(`Gruppenpost ${nachrichtId} nicht angepasst`, err);
      }
    },
  };
  const server = erstelleServer(webhook ? { bot, webhookSecret: config.WEBHOOK_SECRET, miniApp } : { miniApp });
  server.listen(config.PORT, () => log.info(`HTTP-Server auf Port ${config.PORT}`));

  if (webhook) {
    const url = new URL(WEBHOOK_PFAD, config.WEBHOOK_URL).toString();
    await bot.api.setWebhook(url, { secret_token: config.WEBHOOK_SECRET, drop_pending_updates: false });
    log.info(`Webhook gesetzt: ${url}`);
  } else {
    await bot.api.deleteWebhook();
    void bot.start({ onStart: () => log.info("Polling läuft") });
  }

  const stoppeZeitplan = starteZeitplan(
    db,
    async (chatId, text) => (await bot.api.sendMessage(chatId, text)).message_id,
    (chatId, png) => bot.api.sendPhoto(chatId, new InputFile(png, "punkteverlauf.png")),
    config.TZ,
  );

  let beendet = false;
  const beenden = async (signal: string) => {
    if (beendet) return;
    beendet = true;
    log.info(`${signal} empfangen, fahre herunter`);
    stoppeZeitplan();
    if (!webhook) await bot.stop();
    server.close();
    db.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void beenden("SIGINT"));
  process.once("SIGTERM", () => void beenden("SIGTERM"));
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : "Start fehlgeschlagen", err instanceof Error ? undefined : err);
  process.exit(1);
});
