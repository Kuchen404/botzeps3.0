import { Composer, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { gruppeNachId, gruppenDesNutzers, speichereNutzer } from "../db/repo.js";
import { type Ruhmeshalle, erfolgeDesNutzers, lebenslangeLast, ruhmeshalle } from "../db/erfolg-repo.js";
import { ERFOLGE, ERFOLG_ARTEN } from "../scoring/erfolge.js";
import { naechsterRang, rangFuer, rangText } from "../scoring/raenge.js";
import { anzeigename, datumDe, gruppenId, zahlDe } from "./kontext.js";

const z = (x: number) => zahlDe(x, 0);

/** Rang mit lebenslanger Last und dem Weg zum nächsten Rang. */
export function rangZeile(last: number): string {
  const naechster = naechsterRang(last);
  const weiter = naechster ? `, noch ${z(naechster.fehlen)} bis ${rangText(naechster.rang)}` : ", höher geht's nicht";
  return `Rang: ${rangText(rangFuer(last))} (${z(last)} Lastpunkte insgesamt${weiter})`;
}

export function erfolgeText(name: string, last: number, erreicht: readonly { art: string; erreicht_am: string }[]): string {
  const am = new Map(erreicht.map((e) => [e.art, e.erreicht_am]));
  const zeilen = ERFOLG_ARTEN.map((art) => {
    const datum = am.get(art);
    const { titel, beschreibung } = ERFOLGE[art];
    return datum ? `✅ ${titel}: ${beschreibung} (${datumDe(datum)})` : `🔒 ${titel}: ${beschreibung}`;
  });
  return [`🏆 Erfolge von ${name}: ${am.size} von ${ERFOLG_ARTEN.length}`, rangZeile(last), "", ...zeilen].join("\n");
}

export function ruhmeshalleText(gruppe: string, r: Ruhmeshalle): string {
  const zeilen = [`🏛 Ruhmeshalle „${gruppe}“`];
  if (r.sieger.length) {
    zeilen.push("", "Season-Sieger:", ...r.sieger.map((s) => `👑 ${s.season}: ${s.namen.join(" und ")}`));
  }
  if (r.mitglieder.length) {
    zeilen.push(
      "",
      "Ränge:",
      ...r.mitglieder.map((m) => `${rangText(rangFuer(m.last))} ${m.name}: ${z(m.last)} Lastpunkte, ${m.erfolge} Erfolg${m.erfolge === 1 ? "" : "e"}`),
    );
  }
  const rekorde: string[] = [];
  if (r.hoechsteWochenlast) {
    const w = r.hoechsteWochenlast;
    rekorde.push(`Höchste Wochenlast: ${w.name}, ${z(w.last)} (${w.season}, Woche ${w.woche})`);
  }
  if (r.laengsteEinheit) {
    const e = r.laengsteEinheit;
    rekorde.push(`Längste Einheit: ${e.name}, ${e.minuten} min ${e.sportart}`);
  }
  if (rekorde.length) zeilen.push("", "Rekorde:", ...rekorde);
  if (zeilen.length === 1) zeilen.push("", "Noch leer. Trainiert halt mal was.");
  return zeilen.join("\n");
}

export function ruhmModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  modul.command("erfolge", async (ctx) => {
    if (!ctx.from) return;
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    await ctx.reply(erfolgeText(nutzer.name, lebenslangeLast(db, nutzer.id), erfolgeDesNutzers(db, nutzer.id)));
  });

  modul.command("ruhmeshalle", async (ctx) => {
    const hier = gruppenId(db, ctx);
    const gruppe =
      hier !== null
        ? gruppeNachId(db, hier)
        : ctx.from
          ? gruppenDesNutzers(db, speichereNutzer(db, ctx.from.id, anzeigename(ctx)).id)[0]
          : undefined;
    if (!gruppe) {
      await ctx.reply("Du bist in keiner Botzeps-Gruppe, also auch in keiner Ruhmeshalle.");
      return;
    }
    await ctx.reply(ruhmeshalleText(gruppe.name, ruhmeshalle(db, gruppe.id)));
  });

  return modul;
}
