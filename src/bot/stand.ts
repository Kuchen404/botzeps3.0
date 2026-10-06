import { Composer, InputFile, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { gruppenDesNutzers, speichereNutzer } from "../db/repo.js";
import { type SeasonZeile, aktuelleSeason, letzteSeason } from "../db/season-repo.js";
import { type Stand, berechneStand, berechneTeams } from "../bericht/stand.js";
import { teamZeilen } from "../bericht/texte.js";
import { type TeamStand, type TeilnehmerStand, fleissDerWoche, kalibrierFenster, seasonEnde, wocheVon } from "../scoring/season.js";
import { FORTSCHRITT } from "../scoring/fortschritt.js";
import { diagrammPng, eigenesDiagramm, punkteverlauf } from "../bericht/punkteverlauf.js";
import { log } from "../log.js";
import { fuelle, waehleSpruch } from "../texte/sprueche.js";
import { anzeigename, datumDe, gruppenId, gruppenZeitzone, heute, zahlDe } from "./kontext.js";

/** Season, auf die sich /stand und /rangliste beziehen: die laufende, sonst die zuletzt gestartete. */
function relevanteSeason(db: Db, gruppeId: number, tag: string): SeasonZeile | undefined {
  const aktuell = aktuelleSeason(db, gruppeId, tag);
  return aktuell && aktuell.start <= tag ? aktuell : (letzteSeason(db, gruppeId, tag) ?? aktuell);
}

const p = (x: number) => zahlDe(x, 1);

function abzeichen(st: Stand, woche: number | null): string {
  const w = woche === null ? undefined : st.wochen[woche];
  const teile = [];
  if (w?.zielErreicht) teile.push("✅");
  if (w && w.serie >= 2) teile.push(`🔥${w.serie}`);
  return teile.length ? ` ${teile.join(" ")}` : "";
}

export function ranglisteText(s: SeasonZeile, staende: Stand[], tag: string, teams: readonly TeamStand[] = []): string {
  if (tag < s.start) {
    const fertig = staende.filter((st) => st.kalibrierMessungen >= FORTSCHRITT.minMessungenKalibrierung).length;
    return `„${s.name}“ startet am ${datumDe(s.start)}, Punkte gibt's danach.\nKalibrierung: ${fertig} von ${staende.length} haben ihre 3 Messungen.`;
  }
  if (staende.length === 0) return `„${s.name}“ hat noch keine Teilnehmer.`;
  const ende = seasonEnde(s);
  const stichtag = tag < ende ? tag : ende;
  const woche = wocheVon(s, stichtag);
  const kopf = tag > ende ? `🏁 Endstand „${s.name}“` : `🏆 Rangliste „${s.name}“, Woche ${(woche ?? 0) + 1} von ${s.wochen}`;
  const zeilen = staende.map(
    (st) =>
      `${st.platz}. ${st.name}: ${p(st.gesamt)} (Fleiß ${p(st.fleiss)} · Fortschritt ${st.fortschritt ? p(st.fortschritt.punkte) : "–"})${abzeichen(st, woche)}`,
  );
  const fuehrender = staende[0]!;
  const zweiter = staende[1];
  const sprueche = [
    fuelle(waehleSpruch("platz1"), {
      name: fuehrender.name,
      punkte: p(fuehrender.gesamt),
      abstand: p(fuehrender.gesamt - (zweiter?.gesamt ?? 0)),
    }),
  ];
  const letzter = staende.at(-1)!;
  if (staende.length >= 3 && letzter.platz > 1) {
    const vordermann = staende.at(-2)!;
    sprueche.push(
      fuelle(waehleSpruch("letzter"), {
        name: letzter.name,
        platz: letzter.platz,
        punkte: p(letzter.gesamt),
        abstand: p(vordermann.gesamt - letzter.gesamt),
      }),
    );
  }
  const fleissig = woche === null ? [] : fleissDerWoche(staende, woche);
  const titel = fleissig.length ? [`💪 Fleiß der Woche bisher: ${fleissig.map((f) => f.name).join(", ")}`] : [];
  const team = teamZeilen(teams);
  return [kopf, "", ...zeilen, ...(team.length ? ["", ...team] : []), "", ...titel, ...sprueche].join("\n");
}

export function standText(s: SeasonZeile, st: Stand, anzahl: number, tag: string, privat: boolean): string {
  const ende = seasonEnde(s);
  const zeilen = [`📊 ${st.name} in „${s.name}“`];
  if (tag >= s.start) zeilen.push(`Platz ${st.platz} von ${anzahl} mit ${p(st.gesamt)} Punkten`);
  const woche = wocheVon(s, tag < ende ? tag : ende);
  const w = woche === null ? undefined : st.wochen[woche];
  if (w && tag <= ende) {
    zeilen.push(`Diese Woche: ${w.last} von ${s.wochenziel_last} Lastpunkten${w.zielErreicht ? " ✅" : ""}`);
  }
  if (tag >= s.start) {
    const serie = st.wochen.at(-1)?.zielErreicht ? st.wochen.at(-1)!.serie : (st.wochen.at(-2)?.serie ?? 0);
    zeilen.push(`Fleiß: ${p(st.fleiss)} Punkte${serie >= 2 ? `, Serie ${serie} Wochen 🔥` : ""}`);
  }

  if (!st.start) {
    const fenster = kalibrierFenster(s, st.beitritt);
    zeilen.push(
      `Fortschritt: noch kein Startwert, ${st.kalibrierMessungen} von ${FORTSCHRITT.minMessungenKalibrierung} Messungen zwischen ${datumDe(fenster.von)} und ${datumDe(fenster.bis)}.`,
    );
  } else if (!st.fortschritt) {
    zeilen.push("Fortschritt: Startwert steht, Punkte gibt's nach der Kalibrierwoche.");
  } else if (privat && st.aktuell) {
    const f = st.fortschritt;
    zeilen.push(
      `Fortschritt: ${p(f.punkte)} Punkte`,
      `  Fett ${p(st.start.fettKg)} → ${p(st.aktuell.fettKg)} kg (${f.fettAbbauPct >= 0 ? "−" : "+"}${p(Math.abs(f.fettAbbauPct))} %)`,
      `  Muskel ${p(st.start.muskelKg)} → ${p(st.aktuell.muskelKg)} kg (${f.muskelAufbauPct >= 0 ? "+" : "−"}${p(Math.abs(f.muskelAufbauPct))} %)`,
    );
  } else {
    zeilen.push(`Fortschritt: ${p(st.fortschritt.punkte)} Punkte`);
  }
  return zeilen.join("\n");
}

export function standModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  modul.command("rangliste", async (ctx) => {
    const tag = heute(gruppenZeitzone());
    const gruppe = gruppenId(db, ctx) ?? (ctx.from ? gruppenDesNutzers(db, speichereNutzer(db, ctx.from.id, anzeigename(ctx)).id)[0]?.id : undefined);
    const s = gruppe === undefined ? undefined : relevanteSeason(db, gruppe, tag);
    if (!s) {
      await ctx.reply("Keine Season, keine Rangliste. In der Gruppe mit /season Name eine anlegen.");
      return;
    }
    const staende = berechneStand(db, s, tag);
    await ctx.reply(ranglisteText(s, staende, tag, tag >= s.start ? berechneTeams(db, s, staende) : []));
  });

  modul.command("stand", async (ctx) => {
    const von = ctx.from;
    if (!von) return;
    const tag = heute(gruppenZeitzone());
    const nutzer = speichereNutzer(db, von.id, anzeigename(ctx));
    const hier = gruppenId(db, ctx);
    const gruppen = hier !== null ? [hier] : gruppenDesNutzers(db, nutzer.id).map((g) => g.id);
    const texte: string[] = [];
    const diagramme: { s: SeasonZeile; id: string }[] = [];
    for (const g of gruppen) {
      const s = relevanteSeason(db, g, tag);
      if (!s) continue;
      const staende = berechneStand(db, s, tag);
      const ich = staende.find((st) => st.telegramId === von.id);
      if (!ich) continue;
      texte.push(standText(s, ich, staende.length, tag, hier === null));
      if (tag >= s.start) diagramme.push({ s, id: ich.id });
    }
    await ctx.reply(texte.length ? texte.join("\n\n") : "Du bist in keiner Season. In der Gruppe /season tippen oder trainieren, dann bist du dabei.");
    for (const { s, id } of diagramme) {
      try {
        const verlauf = punkteverlauf(db, s, tag);
        const d = verlauf && eigenesDiagramm(s, verlauf, id);
        if (d) await ctx.replyWithPhoto(new InputFile(diagrammPng(d), "stand.png"));
      } catch (err) {
        log.error("Diagramm zu /stand fehlgeschlagen", err);
      }
    }
  });

  return modul;
}

