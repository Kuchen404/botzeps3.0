import type { Context } from "grammy";
import { lokalesDatum } from "../scoring/datum.js";
import type { Db } from "../db/index.js";
import { speichereGruppe } from "../db/repo.js";

export function anzeigename(ctx: Context): string {
  const u = ctx.from;
  if (!u) return "Unbekannt";
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || String(u.id);
}

export function istGruppe(ctx: Context): boolean {
  return ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
}

/** Legt die aktuelle Gruppe an bzw. aktualisiert sie; null im privaten Chat. */
export function gruppenId(db: Db, ctx: Context): number | null {
  const chat = ctx.chat;
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) return null;
  return speichereGruppe(db, chat.id, chat.title);
}

export function zahlDe(wert: number, nachkommastellen = 1): string {
  return wert.toLocaleString("de-DE", { maximumFractionDigits: nachkommastellen });
}

/** Text nach dem Befehl, z. B. "45 Joggen" bei "/sport@botzeps_bot 45 Joggen". */
export function argumente(ctx: Context): string {
  return typeof ctx.match === "string" ? ctx.match : "";
}

/** Uhr des Bots; Tests stellen sie auf einen festen Zeitpunkt. */
export const uhr = { jetzt: (): Date => new Date() };

/** Heutiges Datum in einer Zeitzone. */
export function heute(zeitzone: string): string {
  return lokalesDatum(uhr.jetzt(), zeitzone);
}

/** "2026-10-12" → "12.10.2026" */
export function datumDe(datum: string): string {
  return datum.split("-").reverse().join(".");
}

/** Zeitzone der Gruppen für Season-Wochen (Konfiguration TZ, Standard Berlin). */
export function gruppenZeitzone(): string {
  return process.env.TZ || "Europe/Berlin";
}

/** Ist der Absender Admin der aktuellen Telegram-Gruppe? */
export async function istGruppenAdmin(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  try {
    const m = await ctx.getChatMember(ctx.from.id);
    return m.status === "creator" || m.status === "administrator";
  } catch {
    return false;
  }
}
