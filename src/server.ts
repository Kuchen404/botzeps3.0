import { createServer, type Server } from "node:http";
import { webhookCallback, type Bot } from "grammy";

export const WEBHOOK_PFAD = "/telegram";

/**
 * HTTP-Server für Docker-Healthcheck und, im Webhook-Modus, die Telegram-Updates.
 * Später kommt hier auch die Mini App dazu.
 */
export function erstelleServer(optionen: { bot?: Bot; webhookSecret?: string }): Server {
  const webhook = optionen.bot
    ? webhookCallback(optionen.bot, "http", { secretToken: optionen.webhookSecret })
    : undefined;

  return createServer((req, res) => {
    const pfad = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "GET" && pfad === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (webhook && req.method === "POST" && pfad === WEBHOOK_PFAD) {
      void webhook(req, res);
      return;
    }
    res.writeHead(404).end();
  });
}
