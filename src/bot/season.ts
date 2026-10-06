import { Composer, InlineKeyboard, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { gruppeNachId, gruppenDesNutzers, speichereNutzer, trageMitgliedEin } from "../db/repo.js";
import {
  type SeasonZeile,
  aendereSeason,
  aktuelleSeason,
  legeSeasonAn,
  nimmTeil,
  seasonNachId,
} from "../db/season-repo.js";
import { plusTage, tageZwischen } from "../scoring/datum.js";
import { kalibrierFenster, seasonEnde, wocheVon } from "../scoring/season.js";
import { MESSPROTOKOLL } from "./waage.js";
import { anzeigename, argumente, datumDe, gruppenId, gruppenZeitzone, heute, istGruppenAdmin } from "./kontext.js";

const STARTS = [1, 2, 3];
const WOCHEN = [6, 8, 10, 12];
const GEWICHTE = [50, 70, 30];

/** Montag in `n` Wochen: n = 1 ist der nächste Montag nach heute. */
export function montagIn(heuteDatum: string, n: number): string {
  const wochentag = new Date(`${heuteDatum}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
  const bisMontag = (8 - wochentag) % 7 || 7;
  return plusTage(heuteDatum, bisMontag + (n - 1) * 7);
}

function teilnehmerZahl(db: Db, seasonId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM teilnahme WHERE season = ?").get(seasonId) as { n: number }).n;
}

export function seasonText(db: Db, s: SeasonZeile, tag: string): string {
  const ende = seasonEnde(s);
  const kalibrierung = kalibrierFenster(s, s.start);
  let status: string;
  if (tag < kalibrierung.von) status = `Startet in ${tageZwischen(tag, s.start)} Tagen.`;
  else if (tag < s.start) status = `Kalibrierwoche läuft: bis Sonntag mindestens 3 Messungen per /waage (privat).`;
  else if (tag <= ende) status = `Woche ${(wocheVon(s, tag) ?? 0) + 1} von ${s.wochen} läuft.`;
  else status = "Vorbei.";
  return [
    `🏋️ Season „${s.name}“`,
    `${datumDe(s.start)} – ${datumDe(ende)} (${s.wochen} Wochen)`,
    `Kalibrierwoche: ${datumDe(kalibrierung.von)} – ${datumDe(kalibrierung.bis)}`,
    `Gewichtung Fleiß/Fortschritt: ${s.gewicht_fleiss}/${s.gewicht_fortschritt}`,
    `Wochenziel: ${s.wochenziel_last} Lastpunkte`,
    `Teilnehmer: ${teilnehmerZahl(db, s.id)}`,
    "",
    status,
  ].join("\n");
}

function formular(s: SeasonZeile, tag: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const haken = (aktiv: boolean, text: string) => (aktiv ? `✓ ${text}` : text);
  for (const n of STARTS) {
    const start = montagIn(tag, n);
    kb.text(haken(s.start === start, `Start ${datumDe(start).slice(0, 6)}`), `se:${s.id}:s:${n}`);
  }
  kb.row();
  for (const w of WOCHEN) kb.text(haken(s.wochen === w, `${w} Wo.`), `se:${s.id}:w:${w}`);
  kb.row();
  for (const g of GEWICHTE) kb.text(haken(s.gewicht_fleiss === g, `${g}/${100 - g}`), `se:${s.id}:g:${g}`);
  return kb;
}

export function seasonModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  modul.command("season", async (ctx) => {
    if (!ctx.from) return;
    const tag = heute(gruppenZeitzone());
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const gruppe = gruppenId(db, ctx);

    if (gruppe === null) {
      const seasons = gruppenDesNutzers(db, nutzer.id)
        .map((g) => aktuelleSeason(db, g.id, tag))
        .filter((s) => s !== undefined);
      await ctx.reply(
        seasons.length
          ? seasons.map((s) => seasonText(db, s, tag)).join("\n\n")
          : "Gerade läuft keine Season. Anlegen geht in der Gruppe mit /season Name.",
      );
      return;
    }

    trageMitgliedEin(db, gruppe, nutzer.id);
    const name = argumente(ctx).trim();
    const vorhanden = aktuelleSeason(db, gruppe, tag);
    if (vorhanden) {
      nimmTeil(db, vorhanden.id, nutzer.id, tag);
      const darfAendern = tag < vorhanden.start && (vorhanden.erstellt_von === nutzer.id || (await istGruppenAdmin(ctx)));
      const hinweis = name ? "Es gibt schon eine Season. Erst die durchziehen, dann die nächste.\n\n" : "";
      await ctx.reply(hinweis + seasonText(db, vorhanden, tag), darfAendern ? { reply_markup: formular(vorhanden, tag) } : {});
      return;
    }
    if (!name) {
      await ctx.reply("Keine Season aktiv. Anlegen mit /season Name, z. B. /season Winterspeck 2026");
      return;
    }
    if (name.length > 60) {
      await ctx.reply("Der Name ist zu lang, maximal 60 Zeichen.");
      return;
    }
    const s = legeSeasonAn(db, { gruppe, name, start: montagIn(tag, 1), erstelltVon: nutzer.id, heute: tag });
    await ctx.reply(
      `${seasonText(db, s, tag)}\n\nAlle Mitglieder sind dabei, wer später „Ich bin dabei“ drückt oder trainiert, kommt dazu. Start, Dauer und Gewichtung lassen sich bis zum Start mit den Knöpfen ändern.\n\n${MESSPROTOKOLL}`,
      { reply_markup: formular(s, tag) },
    );
  });

  modul.callbackQuery(/^se:(\d+):([swg]):(\d+)$/, async (ctx) => {
    const [, id, feld, wertText] = ctx.match;
    const wert = Number(wertText);
    const tag = heute(gruppenZeitzone());
    const s = seasonNachId(db, Number(id));
    const gruppe = s ? gruppeNachId(db, s.gruppe) : undefined;
    if (!s || !gruppe || ctx.chat?.id !== gruppe.telegram_chat_id) {
      await ctx.answerCallbackQuery({ text: "Diese Season gibt's nicht mehr." });
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    if (s.erstellt_von !== nutzer.id && !(await istGruppenAdmin(ctx))) {
      await ctx.answerCallbackQuery({ text: "Ändern dürfen nur der Ersteller und die Gruppenadmins.", show_alert: true });
      return;
    }
    if (tag >= s.start) {
      await ctx.answerCallbackQuery({ text: "Die Season läuft schon, da wird nichts mehr geändert.", show_alert: true });
      return;
    }
    const gueltig =
      (feld === "s" && STARTS.includes(wert)) || (feld === "w" && WOCHEN.includes(wert)) || (feld === "g" && GEWICHTE.includes(wert));
    if (!gueltig) {
      await ctx.answerCallbackQuery({ text: "Ungültig." });
      return;
    }
    const neu = aendereSeason(
      db,
      s.id,
      feld === "s" ? { start: montagIn(tag, wert) } : feld === "w" ? { wochen: wert } : { gewicht_fleiss: wert },
    );
    await ctx.answerCallbackQuery({ text: "Geändert" });
    try {
      await ctx.editMessageText(seasonText(db, neu, tag), { reply_markup: formular(neu, tag) });
    } catch (err) {
      // Gleicher Knopf zweimal: Telegram meldet „message is not modified“
      if (!String(err).includes("not modified")) throw err;
    }
  });

  return modul;
}
