import { InputFile } from "grammy";
import { ladeConfig } from "./config.js";
import { oeffneDb } from "./db/index.js";
import { BEFEHLE, erstelleBot } from "./bot/index.js";
import { MINIAPP_PFAD, WEBHOOK_PFAD, erstelleServer } from "./server.js";
import { log, setzeLogStufe } from "./log.js";
import { starteZeitplan } from "./zeitplan.js";
import { uhr } from "./bot/kontext.js";
import { DEMO_BEFEHLE, aktiviereDemo } from "./demo/index.js";
import { starteBackups } from "./backup.js";
import { dirname, join } from "node:path";

async function main(): Promise<void> {
  const config = ladeConfig();
  setzeLogStufe(config.LOG_LEVEL);

  const db = oeffneDb(config.DATABASE_PATH);
  log.info(`Datenbank geöffnet: ${config.DATABASE_PATH}`);

  // Mini App: eigene Adresse oder dieselbe wie der Webhook, Pfad /app
  const miniAppUrl =
    config.MINIAPP_URL ?? (config.BOT_MODE === "webhook" && config.WEBHOOK_URL ? new URL(MINIAPP_PFAD, config.WEBHOOK_URL).toString() : undefined);
  if (config.DEMO_MODUS) {
    aktiviereDemo(db);
    log.warn(`DEMO-MODUS: /demo löscht Einträge der Testgruppe, /vorspulen verstellt die Uhr (Bot-Zeit ${uhr.jetzt().toISOString()}). Nur mit einem Test-Bot benutzen!`);
  }
  const bot = erstelleBot(config.BOT_TOKEN, db, undefined, { miniAppUrl, demo: config.DEMO_MODUS });
  await bot.init();
  await bot.api.setMyCommands(config.DEMO_MODUS ? [...DEMO_BEFEHLE, ...BEFEHLE] : BEFEHLE);
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
    60_000,
    () => uhr.jetzt(),
  );

  // Tägliches Backup nach echter Uhrzeit (nicht nach der verstellbaren Demo-Uhr)
  const backupVerzeichnis = config.BACKUP_VERZEICHNIS ?? join(dirname(config.DATABASE_PATH), "backups");
  const backupChat = config.BACKUP_CHAT_ID;
  const stoppeBackups =
    config.BACKUP_BEHALTEN > 0 && config.DATABASE_PATH !== ":memory:"
      ? starteBackups(
          db,
          { verzeichnis: backupVerzeichnis, uhrzeit: config.BACKUP_UHRZEIT, behalten: config.BACKUP_BEHALTEN, zeitzone: config.TZ },
          backupChat === undefined
            ? undefined
            : (datei, name) => bot.api.sendDocument(backupChat, new InputFile(datei, name), { caption: `Botzeps-Backup ${name}`, disable_notification: true }),
        )
      : () => {};
  if (config.BACKUP_BEHALTEN > 0) {
    log.info(`Backup täglich ab ${config.BACKUP_UHRZEIT} nach ${backupVerzeichnis}, ${config.BACKUP_BEHALTEN} Stück${backupChat === undefined ? "" : `, Kopie an Chat ${backupChat}`}`);
  } else log.warn("Tägliches Backup ist aus (BACKUP_BEHALTEN=0)");

  let beendet = false;
  const beenden = async (signal: string) => {
    if (beendet) return;
    beendet = true;
    log.info(`${signal} empfangen, fahre herunter`);
    stoppeZeitplan();
    stoppeBackups();
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
