import { Composer, InlineKeyboard, type Context } from "grammy";
import type { Db } from "../db/index.js";
import {
  type AbstimmungZeile,
  type Entscheidung,
  abstimmungNachId,
  beendeAbstimmung,
  istEntschieden,
  legeAbstimmungAn,
  offeneAbstimmung,
  setzeNachricht,
  stimmeAb,
  stimmen,
} from "../db/abstimmung-repo.js";
import {
  type GruppeZeile,
  gruppeNachId,
  gruppenDesNutzers,
  findeSportart,
  setzeGruppenNachricht,
  speichereNutzer,
  trageMitgliedEin,
} from "../db/repo.js";
import { GRENZEN } from "../domain/eingabe.js";
import {
  COMPENDIUM_LINK,
  OHNE_STIMMEN,
  VERGLEICHE,
  compendiumVorschlag,
  erlaubteFaktoren,
  noetigeStimmen,
  sportartName,
} from "../domain/neue-sportart.js";
import { faktorText } from "../domain/sportarten.js";
import { plusTage } from "../scoring/datum.js";
import type { Faktor } from "../scoring/fleiss.js";
import { log } from "../log.js";
import { anzeigename, argumente, gruppenId, gruppenZeitzone, heute, uhr } from "./kontext.js";
import { trainingsPostText } from "./sport.js";
import { meldungenNachTraining, mitMeldungen } from "../bericht/nach-training.js";

export const ABSTIMMUNG_STUNDEN = 24;

function mitglieder(db: Db, gruppeId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM gruppe_mitglied WHERE gruppe = ?").get(gruppeId) as { n: number }).n;
}

/** Alte Knöpfe von vor der Umstellung schicken noch Stufe 1, 2 oder 3. */
const ALTE_KNOEPFE: Record<number, Faktor> = { 1: 1, 2: 2.5, 3: 4.5 };

/** Callback-Wert eines Faktors: ×10 als ganze Zahl (4,5 → 45). */
function knopfWert(f: Faktor): number {
  return Math.round(f * 10);
}

/** Faktor aus dem Callback-Wert, oder null, wenn er in dieser Abstimmung nicht wählbar ist. */
export function faktorAusKnopf(wert: number, vorschlag: Faktor | null): Faktor | null {
  const f = ALTE_KNOEPFE[wert] ?? wert / 10;
  return erlaubteFaktoren(vorschlag).includes(f) ? f : null;
}

export function abstimmungsText(db: Db, a: AbstimmungZeile): string {
  const v = compendiumVorschlag(a.name);
  const zeilen = [`🗳 Neue Sportart „${a.name}“: Wie anstrengend ist das? So wie …`];
  zeilen.push(
    v
      ? `📖 Laut Tabelle: ${faktorText(v.faktor)} (${String(v.met).replace(".", ",")} MET). Bei Gleichstand gilt die Tabelle.`
      : `📖 Steht nicht in der Tabelle. Bei Gleichstand gilt der niedrigere Wert, ohne Stimmen ${faktorText(OHNE_STIMMEN)}.`,
  );
  zeilen.push(`Selbst nachschauen: ${COMPENDIUM_LINK} (englisch, Faktor = MET − 3)`);
  zeilen.push(
    `Entschieden, sobald ${noetigeStimmen(mitglieder(db, a.gruppe))} abgestimmt haben, spätestens nach ${ABSTIMMUNG_STUNDEN} Stunden.`,
  );
  if (a.minuten) zeilen.push(`Danach wird das Training (${a.minuten} min) automatisch eingetragen.`);
  return zeilen.join("\n");
}

function knoepfe(db: Db, a: AbstimmungZeile): InlineKeyboard {
  const s = stimmen(db, a.id);
  const kb = new InlineKeyboard();
  erlaubteFaktoren(a.vorschlag).forEach((f, i) => {
    const vergleich = VERGLEICHE.find((v) => v.faktor === f);
    const tabelle = a.vorschlag === f ? " 📖" : "";
    const titel = vergleich ? `${vergleich.emoji} ${vergleich.wie} ${faktorText(f)}` : `📖 Tabelle ${faktorText(f)}`;
    kb.text(`${titel}${vergleich ? tabelle : ""}: ${s.filter((x) => x === f).length}`, `sv:${a.id}:${knopfWert(f)}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

export function ergebnisText(e: Entscheidung): string {
  return `✅ Entschieden: ${e.sportart.name} zählt ab sofort ${faktorText(e.sportart.faktor)}.`;
}

export function abstimmungsModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  /** Startet die Abstimmung in der Gruppe; gibt eine Antwort für den Aufrufer zurück. */
  async function starte(
    ctx: Context,
    gruppe: GruppeZeile,
    eingabe: string,
    nutzerId: number,
    training?: { minuten: number; tage: number },
  ): Promise<string> {
    const name = sportartName(eingabe);
    if (!name) return "Ungültiger Name. Nur Buchstaben, Zahlen, Leerzeichen und Bindestrich, höchstens 20 Zeichen.";
    const { treffer: vorhanden, varianten } = findeSportart(db, gruppe.id, name);
    if (vorhanden) return `${vorhanden.name} gibt's schon: ${faktorText(vorhanden.faktor)}. /sport ${training?.minuten ?? 45} ${vorhanden.name}`;
    if (varianten.length) return `${name} gibt's schon als ${varianten.map((v) => `${v.name} (${faktorText(v.faktor)})`).join(" und ")}.`;
    if (offeneAbstimmung(db, gruppe.id, name)) return `Über ${name} wird in „${gruppe.name}“ schon abgestimmt.`;
    const zeitzone = (db.prepare("SELECT zeitzone FROM nutzer WHERE id = ?").get(nutzerId) as { zeitzone: string }).zeitzone;
    const a = legeAbstimmungAn(db, {
      gruppe: gruppe.id,
      name,
      vorschlag: compendiumVorschlag(name)?.faktor ?? null,
      antragsteller: nutzerId,
      minuten: training?.minuten ?? null,
      datum: training ? plusTage(heute(zeitzone), -training.tage) : null,
      erstellt_am: uhr.jetzt().toISOString(),
    });
    const nachricht = await ctx.api.sendMessage(gruppe.telegram_chat_id, abstimmungsText(db, a), {
      reply_markup: knoepfe(db, a),
      link_preview_options: { is_disabled: true },
    });
    setzeNachricht(db, a.id, nachricht.message_id);
    const inGruppe = ctx.chat?.id === gruppe.telegram_chat_id;
    const wo = inGruppe ? "" : ` in „${gruppe.name}“`;
    return training
      ? `Abstimmung über ${name} läuft${wo}. Dein Training wird eingetragen, sobald die Stufe feststeht.`
      : `Abstimmung über ${name} läuft${wo}.`;
  }

  /** Nach der Entscheidung: Ergebnis zeigen und das wartende Training posten. */
  async function verkuende(ctx: Context, a: AbstimmungZeile, e: Entscheidung): Promise<void> {
    try {
      if (a.nachricht_id) {
        await ctx.api.editMessageText(e.gruppeChat, a.nachricht_id, `${abstimmungsText(db, a)}\n\n${ergebnisText(e)}`, {
          link_preview_options: { is_disabled: true },
        });
      }
      else await ctx.api.sendMessage(e.gruppeChat, ergebnisText(e));
    } catch (err) {
      log.debug("Abstimmungsnachricht nicht aktualisiert", err);
    }
    if (e.training) {
      const text = trainingsPostText(e.training.nutzerName, e.training.minuten, e.sportart.name);
      const meldungen = meldungenNachTraining(db, e.training.id, heute(gruppenZeitzone()));
      const post = await ctx.api.sendMessage(e.gruppeChat, mitMeldungen(text, meldungen));
      setzeGruppenNachricht(db, e.training.id, post.message_id);
    }
  }

  modul.command("sportart", async (ctx) => {
    if (!ctx.from) return;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const hier = gruppenId(db, ctx);
    if (hier !== null) trageMitgliedEin(db, hier, nutzer.id);
    const gruppe = hier !== null ? gruppeNachId(db, hier) : gruppenDesNutzers(db, nutzer.id)[0];
    if (!gruppe) {
      await ctx.reply("Du bist in keiner Botzeps-Gruppe.");
      return;
    }
    const name = argumente(ctx).trim();
    if (!name) {
      await ctx.reply("Neue Sportart vorschlagen: /sportart Name, z. B. /sportart Handball. Die Gruppe stimmt dann ab, wie anstrengend sie ist.");
      return;
    }
    const antwort = await starte(ctx, gruppe, name, nutzer.id);
    if (hier === null || !antwort.startsWith("Abstimmung")) await ctx.reply(antwort);
  });

  modul.callbackQuery(/^sn:(\d+):(\d):(\d+):(.+)$/, async (ctx) => {
    const [, telegramId, tage, minuten, name] = ctx.match;
    if (Number(telegramId) !== ctx.from.id) {
      await ctx.answerCallbackQuery({ text: "Finger weg, das sind nicht deine Knöpfe.", show_alert: true });
      return;
    }
    const min = Number(minuten);
    if (Number(tage) > GRENZEN.maxTageZurueck || (min !== 0 && (min < GRENZEN.minuten.min || min > GRENZEN.minuten.max))) {
      await ctx.answerCallbackQuery({ text: "Ungültig." });
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const hier = gruppenId(db, ctx);
    const gruppe = hier !== null ? gruppeNachId(db, hier) : gruppenDesNutzers(db, nutzer.id)[0];
    if (!gruppe) {
      await ctx.answerCallbackQuery({ text: "Du bist in keiner Botzeps-Gruppe." });
      return;
    }
    const antwort = await starte(ctx, gruppe, name!, nutzer.id, min ? { minuten: min, tage: Number(tage) } : undefined);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(antwort);
  });

  modul.callbackQuery(/^sv:(\d+):(\d{1,3})$/, async (ctx) => {
    const [, id, wert] = ctx.match;
    const a = abstimmungNachId(db, Number(id));
    const gruppe = a ? gruppeNachId(db, a.gruppe) : undefined;
    if (!a || !gruppe || a.beendet_am || ctx.chat?.id !== gruppe.telegram_chat_id) {
      await ctx.answerCallbackQuery({ text: "Die Abstimmung ist vorbei." });
      return;
    }
    const faktor = faktorAusKnopf(Number(wert), a.vorschlag);
    if (faktor === null) {
      await ctx.answerCallbackQuery({ text: "Ungültiger Knopf." });
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    trageMitgliedEin(db, gruppe.id, nutzer.id);
    stimmeAb(db, a.id, nutzer.id, faktor);
    await ctx.answerCallbackQuery({ text: `Stimme gezählt: ${faktorText(faktor)}` });
    if (istEntschieden(db, a)) {
      const e = beendeAbstimmung(db, a.id, uhr.jetzt().toISOString());
      if (e) await verkuende(ctx, a, e);
      return;
    }
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: knoepfe(db, a) });
    } catch (err) {
      if (!String(err).includes("not modified")) throw err;
    }
  });

  return modul;
}
