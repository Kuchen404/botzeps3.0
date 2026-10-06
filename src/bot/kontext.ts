import type { Context } from "grammy";
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
