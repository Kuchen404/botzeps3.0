import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { webhookCallback, type Bot } from "grammy";
import type { Db } from "./db/index.js";
import { pruefeInitData } from "./miniapp/auth.js";
import { type Gruppenpost, type Gruppensenden, bearbeiteApi } from "./miniapp/api.js";
import { log } from "./log.js";
import { FIGUREN_MEDIEN_PFAD, figurMedium } from "./figuren/arcade.js";

export const WEBHOOK_PFAD = "/telegram";
export const MINIAPP_PFAD = "/app";

const SPIELE = new URL("./miniapp/spiele/", import.meta.url);
const dateien = readdirSync(SPIELE).sort();
const skripte = ["runtime.js", ...dateien.filter((f) => f.endsWith(".js") && f !== "runtime.js")];
const VORLAGE = readFileSync(new URL("./miniapp/app.html", import.meta.url), "utf8")
  .replace("/* {{MINISPIEL_STILE}} */", () => dateien.filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f, SPIELE), "utf8")).join("\n"))
  .replace("/* {{MINISPIEL_SKRIPTE}} */", () => skripte.map((f) => readFileSync(new URL(f, SPIELE), "utf8")).join("\n"));
/**
 * Fingerabdruck der ausgelieferten Seite. Jede API-Antwort trägt ihn im Kopf; eine noch offene Mini App
 * mit altem Stand (Telegram hält minimierte Apps am Leben) merkt so nach einem Deploy, dass sie neu laden muss.
 */
export const SEITEN_VERSION = createHash("sha256").update(VORLAGE).digest("hex").slice(0, 12);
const SEITE = VORLAGE.replace("{{VERSION}}", SEITEN_VERSION);
const MAX_BODY = 16 * 1024;

export interface MiniAppOptionen {
  db: Db;
  botToken: string;
  gruppenpost: Gruppenpost;
  gruppensenden: Gruppensenden;
}

function json(res: ServerResponse, status: number, daten: unknown, req?: IncomingMessage): void {
  const text = JSON.stringify(daten);
  const kopf: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    vary: "accept-encoding",
    "x-botzeps-version": SEITEN_VERSION,
  };
  // Figuren-SVGs wiederholen sich stark: komprimiert nur ein Bruchteil der Größe
  if (text.length > 4096 && /\bgzip\b/.test(String(req?.headers["accept-encoding"] ?? ""))) {
    res.writeHead(status, { ...kopf, "content-encoding": "gzip" });
    res.end(gzipSync(text));
    return;
  }
  res.writeHead(status, kopf);
  res.end(text);
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
  const antwort = await bearbeiteApi(m.db, { methode: req.method ?? "GET", pfad, nutzer, body }, m.gruppenpost, m.gruppensenden);
  json(res, antwort.status, antwort.json, req);
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
    if (optionen.miniApp && pfad.startsWith(FIGUREN_MEDIEN_PFAD)) {
      // Öffentlich ohne Anmeldung (Bilder lädt der Browser ohne unseren Header), nur GET
      const bild = req.method === "GET" ? figurMedium(pfad.slice(FIGUREN_MEDIEN_PFAD.length)) : null;
      if (!bild) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": "image/png",
        "content-length": bild.length,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      });
      res.end(bild);
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
