import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { webhookCallback, type Bot } from "grammy";
import type { Db } from "./db/index.js";
import { pruefeInitData } from "./miniapp/auth.js";
import { type Gruppenpost, bearbeiteApi } from "./miniapp/api.js";
import { log } from "./log.js";

export const WEBHOOK_PFAD = "/telegram";
export const MINIAPP_PFAD = "/app";

const SEITE = readFileSync(new URL("./miniapp/app.html", import.meta.url), "utf8");
const MAX_BODY = 16 * 1024;

export interface MiniAppOptionen {
  db: Db;
  botToken: string;
  gruppenpost: Gruppenpost;
}

function json(res: ServerResponse, status: number, daten: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(daten));
}

function seite(res: ServerResponse): void {
  const nonce = randomBytes(16).toString("base64");
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' https://telegram.org`,
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors https://web.telegram.org https://*.telegram.org",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; "),
  });
  res.end(SEITE.replace("{{NONCE}}", nonce));
}

async function leseBody(req: IncomingMessage): Promise<unknown> {
  const teile: Buffer[] = [];
  let laenge = 0;
  for await (const teil of req) {
    laenge += (teil as Buffer).length;
    if (laenge > MAX_BODY) throw new Error("zu groß");
    teile.push(teil as Buffer);
  }
  return laenge ? JSON.parse(Buffer.concat(teile).toString("utf8")) : undefined;
}

async function api(req: IncomingMessage, res: ServerResponse, pfad: string, m: MiniAppOptionen): Promise<void> {
  const kopf = req.headers.authorization ?? "";
  const nutzer = kopf.startsWith("tma ") ? pruefeInitData(kopf.slice(4), m.botToken) : null;
  if (!nutzer) {
    json(res, 401, { fehler: "Nicht angemeldet. Mini App bitte neu öffnen." });
    return;
  }
  let body: unknown;
  try {
    body = req.method === "POST" ? await leseBody(req) : undefined;
  } catch {
    json(res, 400, { fehler: "Ungültige Anfrage" });
    return;
  }
  const antwort = await bearbeiteApi(m.db, { methode: req.method ?? "GET", pfad, nutzer, body }, m.gruppenpost);
  json(res, antwort.status, antwort.json);
}

/** HTTP-Server für Docker-Healthcheck, Telegram-Webhook und die Mini App. */
export function erstelleServer(optionen: { bot?: Bot; webhookSecret?: string; miniApp?: MiniAppOptionen }): Server {
  const webhook = optionen.bot
    ? webhookCallback(optionen.bot, "http", { secretToken: optionen.webhookSecret })
    : undefined;

  return createServer((req, res) => {
    const pfad = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "GET" && pfad === "/health") {
      json(res, 200, { ok: true });
      return;
    }
    if (webhook && req.method === "POST" && pfad === WEBHOOK_PFAD) {
      void webhook(req, res);
      return;
    }
    if (optionen.miniApp && req.method === "GET" && (pfad === MINIAPP_PFAD || pfad === `${MINIAPP_PFAD}/`)) {
      seite(res);
      return;
    }
    if (optionen.miniApp && pfad.startsWith("/api/")) {
      api(req, res, pfad, optionen.miniApp).catch((err: unknown) => {
        log.error("Mini-App-API fehlgeschlagen", err);
        if (!res.headersSent) json(res, 500, { fehler: "Interner Fehler" });
      });
      return;
    }
    res.writeHead(404).end();
  });
}
