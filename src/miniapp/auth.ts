import { createHmac, timingSafeEqual } from "node:crypto";

/** Telegram-Nutzer aus den initData der Mini App. */
export interface MiniAppNutzer {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/** initData gelten so lange; danach muss die Mini App neu geöffnet werden. */
export const MAX_ALTER_S = 24 * 60 * 60;

/**
 * Prüft die Signatur der Mini-App-initData nach Telegram-Doku
 * (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * secret = HMAC_SHA256("WebAppData", botToken), hash = HMAC_SHA256(secret, data_check_string).
 * Gibt den Nutzer zurück oder null, wenn etwas nicht stimmt. Ersetzt die alte ID+PIN-Anmeldung.
 */
export function pruefeInitData(initData: string, botToken: string, jetzt: Date = new Date()): MiniAppNutzer | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");
  const pruefString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const geheim = createHmac("sha256", "WebAppData").update(botToken).digest();
  const erwartet = createHmac("sha256", geheim).update(pruefString).digest();
  if (!timingSafeEqual(erwartet, Buffer.from(hash, "hex"))) return null;

  const authDate = Number(params.get("auth_date"));
  const alter = jetzt.getTime() / 1000 - authDate;
  if (!Number.isFinite(authDate) || alter > MAX_ALTER_S || alter < -300) return null;

  try {
    const nutzer = JSON.parse(params.get("user") ?? "") as Partial<MiniAppNutzer>;
    if (typeof nutzer.id !== "number" || typeof nutzer.first_name !== "string") return null;
    return nutzer as MiniAppNutzer;
  } catch {
    return null;
  }
}

/** Erzeugt signierte initData, wie Telegram sie liefert (für Tests). */
export function signiereInitData(felder: Record<string, string>, botToken: string): string {
  const pruefString = Object.entries(felder)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const geheim = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", geheim).update(pruefString).digest("hex");
  return new URLSearchParams({ ...felder, hash }).toString();
}
