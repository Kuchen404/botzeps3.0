import { Composer, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { speichereNutzer } from "../db/repo.js";
import { ERINNERUNG } from "../zeitplan.js";
import { anzeigename, argumente } from "./kontext.js";

export function erinnerungsModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  modul.command("erinnerungen", async (ctx) => {
    if (!ctx.from) return;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const eingabe = argumente(ctx).trim().toLowerCase();
    const setze = db.prepare("UPDATE nutzer SET erinnerungen = ?, erinnerung_uhrzeit = COALESCE(?, erinnerung_uhrzeit) WHERE id = ?");
    const uhrzeit = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.exec(eingabe);
    if (eingabe === "aus") setze.run(0, null, nutzer.id);
    else if (eingabe === "an") setze.run(1, null, nutzer.id);
    else if (uhrzeit) setze.run(1, `${uhrzeit[1]!.padStart(2, "0")}:${uhrzeit[2]}`, nutzer.id);
    else if (eingabe) {
      await ctx.reply("Versteh ich nicht. /erinnerungen an, /erinnerungen aus oder /erinnerungen 18:30");
      return;
    }
    const z = db.prepare("SELECT erinnerungen, erinnerung_uhrzeit FROM nutzer WHERE id = ?").get(nutzer.id) as {
      erinnerungen: number;
      erinnerung_uhrzeit: string;
    };
    await ctx.reply(
      z.erinnerungen
        ? `Erinnerungen sind an, täglich um ${z.erinnerung_uhrzeit} privat, wenn du ${ERINNERUNG.tageOhneTraining} Tage nicht trainiert oder ${ERINNERUNG.tageOhneMessung} Tage nicht gemessen hast, und in der Kalibrierwoche.\nÄndern: /erinnerungen 18:30 oder /erinnerungen aus`
        : "Erinnerungen sind aus. Selber schuld. Wieder an mit /erinnerungen an",
    );
  });

  return modul;
}
