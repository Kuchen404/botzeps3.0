import { Composer, InlineKeyboard, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { speichereNutzer } from "../db/repo.js";
import { type Eintrag, aendereTrainingsdauer, eintrag, letzteEintraege, loescheEintrag } from "../db/verlauf-repo.js";
import { GRENZEN } from "../domain/eingabe.js";
import { plusTage } from "../scoring/datum.js";
import { log } from "../log.js";
import { anzeigename, datumDe, heute, istGruppe, uhr, zahlDe } from "./kontext.js";

export const DAUERN = [15, 30, 45, 60, 90, 120];

function kurz(e: Eintrag): string {
  const tag = datumDe(e.datum).slice(0, 6);
  return e.art === "t"
    ? `🏃 ${tag} ${e.minuten} min ${e.sportart}`
    : `⚖️ ${tag} ${zahlDe(e.gewichtKg!)} kg · ${zahlDe(e.fettPct!)} % · ${zahlDe(e.muskelPct!)} %`;
}

/** Ändern und Löschen nur innerhalb des Rückdatier-Fensters (Konzept 4: kein Schummeln im Nachhinein). */
export function aenderbar(e: Eintrag, tag: string): boolean {
  return e.datum >= plusTage(tag, -GRENZEN.maxTageZurueck);
}

/** Neuer Text des Gruppenposts nach geänderter Dauer. */
export function korrekturText(name: string, e: Eintrag, minuten: number): string {
  return `${name}: ${minuten} min ${e.sportart} (korrigiert von ${e.minuten} min)`;
}

export function verlaufModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  function liste(nutzerId: number): { text: string; tastatur?: InlineKeyboard } {
    const eintraege = letzteEintraege(db, nutzerId);
    if (eintraege.length === 0) return { text: "Noch nichts eingetragen. /sport oder /waage" };
    const kb = new InlineKeyboard();
    for (const e of eintraege) kb.text(kurz(e), `vl:${e.art}:${e.id}`).row();
    return {
      text: `Deine letzten Einträge. Antippen zum Ändern oder Löschen (geht bis ${GRENZEN.maxTageZurueck} Tage zurück):`,
      tastatur: kb,
    };
  }

  modul.command("verlauf", async (ctx) => {
    if (!ctx.from) return;
    if (istGruppe(ctx)) {
      await ctx.reply("Deinen Verlauf gibt's nur privat.", {
        reply_markup: new InlineKeyboard().url("Privat öffnen", `https://t.me/${ctx.me.username}?start=verlauf`),
      });
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const l = liste(nutzer.id);
    await ctx.reply(l.text, l.tastatur ? { reply_markup: l.tastatur } : {});
  });

  modul.callbackQuery("vl", async (ctx) => {
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const l = liste(nutzer.id);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(l.text, l.tastatur ? { reply_markup: l.tastatur } : {});
  });

  /** Ein Eintrag mit Knöpfen; `vl:<art>:<id>` */
  modul.callbackQuery(/^vl:([tm]):(\d+)$/, async (ctx) => {
    const [, art, id] = ctx.match;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const e = eintrag(db, art as "t" | "m", Number(id), nutzer.id);
    await ctx.answerCallbackQuery();
    if (!e) {
      await ctx.editMessageText("Den Eintrag gibt's nicht mehr.", { reply_markup: new InlineKeyboard().text("Zurück", "vl") });
      return;
    }
    const kb = new InlineKeyboard();
    let text = kurz(e);
    if (aenderbar(e, heute(nutzer.zeitzone))) {
      if (e.art === "t") {
        DAUERN.filter((d) => d !== e.minuten).forEach((d, i) => {
          kb.text(`${d} min`, `vt:${e.id}:${d}`);
          if (i % 3 === 2) kb.row();
        });
        kb.row();
        text += "\n\nNeue Dauer wählen oder löschen. Falsche Sportart: löschen und neu eintragen.";
      } else {
        text += "\n\nVertippt? Löschen und mit /waage neu eintragen.";
      }
      kb.text("🗑 Löschen", `vd:${e.art}:${e.id}`).row();
    } else {
      text += `\n\nÄlter als ${GRENZEN.maxTageZurueck} Tage, das bleibt so. Sonst könnte man ja schummeln.`;
    }
    kb.text("Zurück", "vl");
    await ctx.editMessageText(text, { reply_markup: kb });
  });

  async function pruefe(ctx: Context, art: "t" | "m", id: number) {
    const nutzer = speichereNutzer(db, ctx.from!.id, anzeigename(ctx));
    const e = eintrag(db, art, id, nutzer.id);
    if (!e || !aenderbar(e, heute(nutzer.zeitzone))) {
      await ctx.answerCallbackQuery({ text: "Geht nicht (mehr).", show_alert: true });
      return undefined;
    }
    return { nutzer, e };
  }

  /** Gruppenpost eines Trainings anpassen oder löschen; Fehler (z. B. zu alt für Telegram) sind egal. */
  async function gruppenpost(ctx: Context, e: Eintrag, neuerText: string | null): Promise<void> {
    if (!e.gruppenNachricht || !e.gruppeChat) return;
    try {
      if (neuerText === null) await ctx.api.deleteMessage(e.gruppeChat, e.gruppenNachricht);
      else await ctx.api.editMessageText(e.gruppeChat, e.gruppenNachricht, neuerText);
    } catch (err) {
      log.debug(`Gruppenpost ${e.gruppenNachricht} nicht angepasst`, err);
    }
  }

  modul.callbackQuery(/^vd:([tm]):(\d+)$/, async (ctx) => {
    const [, art, id] = ctx.match;
    const ok = await pruefe(ctx, art as "t" | "m", Number(id));
    if (!ok) return;
    loescheEintrag(db, ok.e, ok.nutzer.id, uhr.jetzt().toISOString());
    if (ok.e.art === "t") await gruppenpost(ctx, ok.e, null);
    await ctx.answerCallbackQuery({ text: "Gelöscht" });
    await ctx.editMessageText(`Gelöscht: ${kurz(ok.e)}`, { reply_markup: new InlineKeyboard().text("Zurück zum Verlauf", "vl") });
  });

  modul.callbackQuery(/^vt:(\d+):(\d+)$/, async (ctx) => {
    const [, id, minutenText] = ctx.match;
    const minuten = Number(minutenText);
    if (!DAUERN.includes(minuten)) {
      await ctx.answerCallbackQuery({ text: "Ungültig." });
      return;
    }
    const ok = await pruefe(ctx, "t", Number(id));
    if (!ok) return;
    aendereTrainingsdauer(db, ok.e, ok.nutzer.id, minuten);
    const neu = { ...ok.e, minuten };
    await gruppenpost(ctx, ok.e, korrekturText(ok.nutzer.name, ok.e, minuten));
    await ctx.answerCallbackQuery({ text: "Geändert" });
    await ctx.editMessageText(`Geändert: ${kurz(neu)}`, { reply_markup: new InlineKeyboard().text("Zurück zum Verlauf", "vl") });
  });

  return modul;
}
