import { Composer, InlineKeyboard, type Context } from "grammy";
import type { Db } from "../db/index.js";
import {
  type GruppeZeile,
  type SportartZeile,
  gruppeNachId,
  gruppenDesNutzers,
  setzeGruppenNachricht,
  speichereNutzer,
  speichereTraining,
  sportartNachId,
  sportartNachName,
  sportartenFuerAuswahl,
  trageMitgliedEin,
} from "../db/repo.js";
import { GRENZEN, parseSport } from "../domain/eingabe.js";
import { lokalesDatum, plusTage } from "../scoring/datum.js";
import { einheitsLast } from "../scoring/fleiss.js";
import { fuelle, waehleSpruch } from "../texte/sprueche.js";
import { log } from "../log.js";
import { anzeigename, argumente, gruppenId } from "./kontext.js";

const DAUERN = [15, 30, 45, 60, 90, 120];
const TAG_TEXT = ["", " (gestern)", " (vorgestern)"];

let letzterSpruch: string | undefined;

interface Auswahl {
  telegramId: number;
  tage: number;
  minuten?: number;
}

/** Callback-Daten: `sp:<telegramId>:<tage>:<minuten|0>[:<sportartId>]`, höchstens 64 Byte. */
function knopfDaten(a: Auswahl, sportartId?: number): string {
  return ["sp", a.telegramId, a.tage, a.minuten ?? 0, ...(sportartId ? [sportartId] : [])].join(":");
}

function sportKnoepfe(sportarten: SportartZeile[], a: Auswahl): InlineKeyboard {
  const kb = new InlineKeyboard();
  sportarten.forEach((s, i) => {
    kb.text(s.name, knopfDaten(a, s.id));
    if (i % 3 === 2) kb.row();
  });
  return kb;
}

function dauerKnoepfe(sportart: SportartZeile, a: Auswahl): InlineKeyboard {
  const kb = new InlineKeyboard();
  DAUERN.forEach((min, i) => {
    kb.text(`${min} min`, knopfDaten({ ...a, minuten: min }, sportart.id));
    if (i % 3 === 2) kb.row();
  });
  return kb;
}

/** `postFuer`: Training, dessen Gruppenpost diese Antwort selbst ist. */
type Antwort = { text: string; tastatur?: InlineKeyboard; postFuer?: number };

export function sportModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  /** Gruppe, in der das Training zählt und gepostet wird. */
  function zielGruppe(ctx: Context, nutzerId: number): GruppeZeile | undefined {
    const hier = gruppenId(db, ctx);
    if (hier !== null) {
      trageMitgliedEin(db, hier, nutzerId);
      return gruppeNachId(db, hier);
    }
    return gruppenDesNutzers(db, nutzerId)[0];
  }

  /** Nächster Schritt: Sportart wählen, Dauer wählen oder speichern und posten. */
  async function weiter(ctx: Context, a: Auswahl, sportart: SportartZeile | undefined, gruppe: GruppeZeile): Promise<Antwort> {
    const nutzer = speichereNutzer(db, ctx.from!.id, anzeigename(ctx));
    if (!sportart) {
      const liste = sportartenFuerAuswahl(db, gruppe.id, nutzer.id);
      const dauer = a.minuten ? `${a.minuten} min ` : "";
      return { text: `Was hast du ${dauer}gemacht${TAG_TEXT[a.tage]}?`, tastatur: sportKnoepfe(liste, a) };
    }
    if (!a.minuten) {
      return { text: `${sportart.name}${TAG_TEXT[a.tage]}: wie lange?`, tastatur: dauerKnoepfe(sportart, a) };
    }

    const datum = plusTage(lokalesDatum(new Date(), nutzer.zeitzone), -a.tage);
    const trainingId = speichereTraining(db, { nutzer: nutzer.id, datum, minuten: a.minuten, sportart });
    letzterSpruch = waehleSpruch("training_gepostet", letzterSpruch);
    const post = fuelle(letzterSpruch, { name: nutzer.name, minuten: a.minuten, sportart: sportart.name });
    const last = einheitsLast({ minuten: a.minuten, faktor: sportart.faktor });

    if (ctx.chat?.id === gruppe.telegram_chat_id) {
      return { text: `${post}${TAG_TEXT[a.tage]}`, postFuer: trainingId };
    }
    try {
      const gesendet = await ctx.api.sendMessage(gruppe.telegram_chat_id, `${post}${TAG_TEXT[a.tage]}`);
      setzeGruppenNachricht(db, trainingId, gesendet.message_id);
      return { text: `Eingetragen: ${a.minuten} min ${sportart.name}${TAG_TEXT[a.tage]}, ${last} Lastpunkte. In „${gruppe.name}“ gepostet.` };
    } catch (err) {
      log.warn(`Training ${trainingId} konnte nicht in Gruppe ${gruppe.id} gepostet werden`, err);
      return {
        text: `Eingetragen: ${a.minuten} min ${sportart.name}, ${last} Lastpunkte. Posten in „${gruppe.name}“ hat nicht geklappt, bin ich da noch drin?`,
      };
    }
  }

  modul.command("sport", async (ctx) => {
    if (!ctx.from) return;
    const eingabe = parseSport(argumente(ctx));
    if (!eingabe.ok) {
      await ctx.reply(`${eingabe.fehler} Beispiel: /sport 45 Joggen`);
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const gruppe = zielGruppe(ctx, nutzer.id);
    if (!gruppe) {
      await ctx.reply("Du bist in keiner Botzeps-Gruppe. Erst in der Gruppe /start und auf „Ich bin dabei“ drücken.");
      return;
    }
    const a: Auswahl = { telegramId: ctx.from.id, tage: eingabe.wert.tageZurueck, ...(eingabe.wert.minuten ? { minuten: eingabe.wert.minuten } : {}) };
    let sportart: SportartZeile | undefined;
    if (eingabe.wert.sportart) {
      sportart = sportartNachName(db, gruppe.id, eingabe.wert.sportart);
      if (!sportart) {
        const liste = sportartenFuerAuswahl(db, gruppe.id, nutzer.id);
        await ctx.reply(`„${eingabe.wert.sportart}“ kenne ich nicht. Such dir was aus der Liste aus (/sportarten zeigt alle):`, {
          reply_markup: sportKnoepfe(liste, a),
        });
        return;
      }
    }
    const antwort = await weiter(ctx, a, sportart, gruppe);
    const gesendet = await ctx.reply(antwort.text, antwort.tastatur ? { reply_markup: antwort.tastatur } : {});
    if (antwort.postFuer) setzeGruppenNachricht(db, antwort.postFuer, gesendet.message_id);
  });

  modul.callbackQuery(/^sp:(\d+):(\d):(\d+)(?::(\d+))?$/, async (ctx) => {
    const [, telegramId, tage, minuten, sportartId] = ctx.match;
    if (Number(telegramId) !== ctx.from.id) {
      await ctx.answerCallbackQuery({ text: "Finger weg, das sind nicht deine Knöpfe.", show_alert: true });
      return;
    }
    // Callback-Daten kommen vom Client, also dieselben Grenzen wie bei der Texteingabe
    const min = Number(minuten);
    if (Number(tage) > GRENZEN.maxTageZurueck || (min !== 0 && (min < GRENZEN.minuten.min || min > GRENZEN.minuten.max))) {
      await ctx.answerCallbackQuery({ text: "Ungültig, bitte /sport neu starten." });
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const sportart = sportartId ? sportartNachId(db, Number(sportartId)) : undefined;
    const gruppe = sportart ? gruppeNachId(db, sportart.gruppe) : zielGruppe(ctx, nutzer.id);
    if (!gruppe || (sportartId && !sportart)) {
      await ctx.answerCallbackQuery({ text: "Das hat sich erledigt, bitte /sport neu starten." });
      return;
    }
    const a: Auswahl = { telegramId: ctx.from.id, tage: Number(tage), ...(Number(minuten) ? { minuten: Number(minuten) } : {}) };
    const antwort = await weiter(ctx, a, sportart, gruppe);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(antwort.text, antwort.tastatur ? { reply_markup: antwort.tastatur } : {});
    const nachricht = ctx.callbackQuery.message;
    if (antwort.postFuer && nachricht) setzeGruppenNachricht(db, antwort.postFuer, nachricht.message_id);
  });

  return modul;
}
