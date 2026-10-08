import { Composer, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { HYPE_TAGE, HYPE_UHRZEIT, fuehreHypeAus, offenerHypeTag, starteHype, stoppeHype } from "../hype/hype.js";
import { hypeKanal } from "../hype/kanal.js";
import { lokalesDatum } from "../scoring/datum.js";
import { argumente, gruppenId, gruppenZeitzone, istGruppenAdmin, uhr } from "./kontext.js";

const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** /hype startet eine Woche mit täglichen Beiträgen vor dem Start, /hype stop bricht sie ab. Nur für Gruppenadmins. */
export function hypeModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  modul.command("hype", async (ctx) => {
    const gruppe = gruppenId(db, ctx);
    if (gruppe === null) {
      await ctx.reply("/hype geht nur in der Gruppe. Da, wo's wehtut.");
      return;
    }
    if (!(await istGruppenAdmin(ctx))) {
      await ctx.reply("Den Hype zünden nur Gruppenadmins. Du darfst dich trotzdem schon mal warm machen.");
      return;
    }
    const zeitzone = gruppenZeitzone();
    if (argumente(ctx).trim().toLowerCase() === "stop") {
      const weg = stoppeHype(db, gruppe);
      await ctx.reply(weg ? "Hype abgebrochen. Das Sofa atmet auf." : "Es läuft gerade kein Hype.");
      return;
    }
    const offen = offenerHypeTag(db, gruppe);
    if (offen) {
      const wann = new Date(offen.faellig_am);
      const tag = WOCHENTAGE[new Date(`${lokalesDatum(wann, zeitzone)}T12:00:00Z`).getUTCDay()];
      await ctx.reply(`Der Hype läuft schon: Tag ${offen.tag} von ${HYPE_TAGE} kommt ${tag} um ${HYPE_UHRZEIT} Uhr. Abbrechen mit /hype stop.`);
      return;
    }
    const jetzt = uhr.jetzt();
    starteHype(db, gruppe, jetzt, zeitzone);
    await fuehreHypeAus(db, hypeKanal(ctx.api), jetzt, zeitzone);
  });

  return modul;
}
