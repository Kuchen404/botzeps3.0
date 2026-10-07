import { Composer, InlineKeyboard, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { type NutzerZeile, messMittel, speichereMessung, speichereNutzer } from "../db/repo.js";
import { type WaageEingabe, istSprung, parseWaage } from "../domain/eingabe.js";
import { plusTage } from "../scoring/datum.js";
import { anzeigename, argumente, datumDe, heute, istGruppe, uhr, zahlDe } from "./kontext.js";

export const MESSPROTOKOLL = "Messprotokoll: morgens, nach dem Klo, vor Essen und Trinken, immer dieselbe Waage.";

export const WAAGE_ANLEITUNG = `Messung eintragen: Gewicht, Fett %, Muskel % in einer Zeile.
Beispiel: /waage 82,4 18,5 41,2
Vergessen? /waage 82,4 18,5 41,2 gestern

${MESSPROTOKOLL}
Deine Werte sieht außer dir keiner, in der Gruppe stehen nur Punkte.`;

/** Callback-Daten für „Sprung bestätigen“: `wj:<tage>:<gewicht>:<fett>:<muskel>`. */
function bestaetigenDaten(e: WaageEingabe): string {
  return ["wj", e.tageZurueck, e.gewichtKg, e.fettPct, e.muskelPct].join(":");
}

/** Speichert eine Messung und gibt die Bestätigung mit Fett- und Muskelmasse zurück. */
export function speichereWaage(db: Db, nutzer: NutzerZeile, e: WaageEingabe, markiert: boolean): string {
  const datum = plusTage(heute(nutzer.zeitzone), -e.tageZurueck);
  speichereMessung(db, {
    nutzer: nutzer.id,
    zeitpunkt: uhr.jetzt().toISOString(),
    datum,
    gewichtKg: e.gewichtKg,
    fettPct: e.fettPct,
    muskelPct: e.muskelPct,
    markiert,
  });
  const fettKg = (e.gewichtKg * e.fettPct) / 100;
  const muskelKg = (e.gewichtKg * e.muskelPct) / 100;
  return [
    `Gespeichert${e.tageZurueck ? ` für ${datumDe(datum)}` : ""}: ${zahlDe(e.gewichtKg)} kg`,
    `Fett ${zahlDe(e.fettPct)} % = ${zahlDe(fettKg)} kg`,
    `Muskel ${zahlDe(e.muskelPct)} % = ${zahlDe(muskelKg)} kg`,
  ].join("\n");
}

export function waageModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  function speichere(ctx: Context, e: WaageEingabe, markiert: boolean): string {
    return speichereWaage(db, speichereNutzer(db, ctx.from!.id, anzeigename(ctx)), e, markiert);
  }

  modul.command("waage", async (ctx) => {
    if (!ctx.from) return;
    if (istGruppe(ctx)) {
      const link = `https://t.me/${ctx.me.username}?start=waage`;
      await ctx.reply("Waagenwerte gibt's nur privat. Keiner will deine Speckrollen in der Gruppe sehen.", {
        reply_markup: new InlineKeyboard().url("Privat eintragen", link),
      });
      return;
    }
    const eingabe = parseWaage(argumente(ctx));
    if (eingabe === null) {
      await ctx.reply(WAAGE_ANLEITUNG);
      return;
    }
    if (!eingabe.ok) {
      await ctx.reply(eingabe.fehler);
      return;
    }
    const e = eingabe.wert;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const datum = plusTage(heute(nutzer.zeitzone), -e.tageZurueck);
    const mittel = messMittel(db, nutzer.id, plusTage(datum, -6), datum);
    if (istSprung(e, mittel)) {
      await ctx.reply(
        `Moment: Das weicht stark von deinem Schnitt der letzten 7 Tage ab (${zahlDe(mittel!.gewichtKg)} kg, Fett ${zahlDe(mittel!.fettPct)} %). Vertippt oder stimmt das?`,
        {
          reply_markup: new InlineKeyboard().text("Stimmt so", bestaetigenDaten(e)).text("Verwerfen", "wn"),
        },
      );
      return;
    }
    await ctx.reply(`${speichere(ctx, e, false)}\n\n${MESSPROTOKOLL}`);
  });

  modul.callbackQuery(/^wj:(\d):([\d.]+):([\d.]+):([\d.]+)$/, async (ctx) => {
    const [, tage, gewicht, fett, muskel] = ctx.match;
    const e: WaageEingabe = {
      tageZurueck: Number(tage),
      gewichtKg: Number(gewicht),
      fettPct: Number(fett),
      muskelPct: Number(muskel),
    };
    // Erneut prüfen, Callback-Daten kommen vom Client
    const geprueft = parseWaage(`${e.gewichtKg} ${e.fettPct} ${e.muskelPct}`);
    if (!geprueft?.ok || e.tageZurueck > 2) {
      await ctx.answerCallbackQuery({ text: "Ungültig, bitte neu eintragen." });
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`${speichere(ctx, e, true)}\n\nIst als auffällig markiert.`);
  });

  modul.callbackQuery("wn", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Verworfen. Nochmal mit /waage.");
  });

  return modul;
}
