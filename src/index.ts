import { ladeConfig } from "./config.js";
import { oeffneDb } from "./db/index.js";
import { BEFEHLE, erstelleBot } from "./bot/index.js";
import { WEBHOOK_PFAD, erstelleServer } from "./server.js";
import { log, setzeLogStufe } from "./log.js";

async function main(): Promise<void> {
  const config = ladeConfig();
  setzeLogStufe(config.LOG_LEVEL);

  const db = oeffneDb(config.DATABASE_PATH);
  log.info(`Datenbank geöffnet: ${config.DATABASE_PATH}`);

  const bot = erstelleBot(config.BOT_TOKEN, db);
  await bot.init();
  await bot.api.setMyCommands(BEFEHLE);
  log.info(`Angemeldet als @${bot.botInfo.username}`);

  const webhook = config.BOT_MODE === "webhook";
  const server = erstelleServer(webhook ? { bot, webhookSecret: config.WEBHOOK_SECRET } : {});
  server.listen(config.PORT, () => log.info(`HTTP-Server auf Port ${config.PORT}`));

  if (webhook) {
    const url = new URL(WEBHOOK_PFAD, config.WEBHOOK_URL).toString();
    await bot.api.setWebhook(url, { secret_token: config.WEBHOOK_SECRET, drop_pending_updates: false });
    log.info(`Webhook gesetzt: ${url}`);
  } else {
    await bot.api.deleteWebhook();
    void bot.start({ onStart: () => log.info("Polling läuft") });
  }

  let beendet = false;
  const beenden = async (signal: string) => {
    if (beendet) return;
    beendet = true;
    log.info(`${signal} empfangen, fahre herunter`);
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
