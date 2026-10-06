import { Composer, InlineKeyboard, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { gruppeNachId, gruppenDesNutzers, speichereNutzer, trageMitgliedEin } from "../db/repo.js";
import { type SeasonZeile, aktuelleSeason, letzteSeason, nimmTeil, seasonNachId } from "../db/season-repo.js";
import { loeseTeamsAuf, loseTeamsAus, teamsDerSeason, tritt } from "../db/team-repo.js";
import { berechneStand, berechneTeams } from "../bericht/stand.js";
import { teamZeilen } from "../bericht/texte.js";
import { MAX_TEAMNAME, teamName } from "../domain/teams.js";
import { TEAM_BONUS_PRO_WOCHE } from "../scoring/season.js";
import { anzeigename, argumente, datumDe, gruppenId, gruppenZeitzone, heute, istGruppenAdmin } from "./kontext.js";

const ANZAHLEN = [2, 3, 4];

/** Season, um die es bei /teams geht: die laufende oder bevorstehende, sonst die letzte. */
function teamSeason(db: Db, gruppeId: number, tag: string): SeasonZeile | undefined {
  return aktuelleSeason(db, gruppeId, tag) ?? letzteSeason(db, gruppeId, tag);
}

function teilnehmerZahl(db: Db, seasonId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM teilnahme WHERE season = ?").get(seasonId) as { n: number }).n;
}

function namen(db: Db, ids: readonly string[]): string {
  const name = db.prepare("SELECT name FROM nutzer WHERE id = ?");
  return ids
    .map((id) => (name.get(Number(id)) as { name: string } | undefined)?.name ?? "?")
    .sort((a, b) => a.localeCompare(b, "de"))
    .join(", ");
}

export function teamsText(db: Db, s: SeasonZeile, tag: string): string {
  const teams = teamsDerSeason(db, s.id);
  if (tag >= s.start) {
    if (teams.length === 0) return `„${s.name}“ läuft ohne Teams. Jeder kämpft für sich allein.`;
    const wertung = berechneTeams(db, s, berechneStand(db, s, tag));
    const mitglieder = new Map(teams.map((t) => [String(t.id), t.mitglieder]));
    return [
      ...teamZeilen(wertung),
      "",
      ...wertung.map((t) => `${t.name}: ${namen(db, mitglieder.get(t.id) ?? [])}`),
      "",
      `Teampunkte = Schnitt der Mitglieder mit Startwert, +${TEAM_BONUS_PRO_WOCHE} pro Woche, in der alle ihr Wochenziel schaffen.`,
    ].join("\n");
  }
  const ohne = (
    db.prepare("SELECT nutzer FROM teilnahme WHERE season = ? AND team IS NULL ORDER BY nutzer").all(s.id) as { nutzer: number }[]
  ).map((t) => String(t.nutzer));
  const zeilen = [`👥 Teams für „${s.name}“ (Start ${datumDe(s.start)})`, ""];
  if (teams.length === 0) zeilen.push("Noch keine Teams. Ohne Teams kämpft jeder für sich.");
  for (const t of teams) zeilen.push(`${t.name}: ${namen(db, t.mitglieder)}`);
  if (teams.length && ohne.length) zeilen.push(`Ohne Team: ${namen(db, ohne)}`);
  zeilen.push(
    "",
    `Selbst wählen: /team Name (gibt's das Team nicht, wird es angelegt). Oder auslosen, ausbalanciert nach der letzten Season. Wer später dazukommt, landet im kleinsten Team. Ab Start ist alles fest.`,
  );
  return zeilen.join("\n");
}

function knoepfe(db: Db, s: SeasonZeile): InlineKeyboard | undefined {
  const kb = new InlineKeyboard();
  const n = teilnehmerZahl(db, s.id);
  const moeglich = ANZAHLEN.filter((a) => n >= a * 2);
  for (const a of moeglich) kb.text(`🎲 ${a} Teams auslosen`, `tm:${s.id}:${a}`);
  if (teamsDerSeason(db, s.id).length) kb.row().text("Teams auflösen", `tm:${s.id}:0`);
  return moeglich.length || teamsDerSeason(db, s.id).length ? kb : undefined;
}

async function darfVerwalten(ctx: Context, s: SeasonZeile, nutzerId: number): Promise<boolean> {
  return s.erstellt_von === nutzerId || (await istGruppenAdmin(ctx));
}

export function teamModul(db: Db): Composer<Context> {
  const modul = new Composer<Context>();

  modul.command("teams", async (ctx) => {
    if (!ctx.from) return;
    const tag = heute(gruppenZeitzone());
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const hier = gruppenId(db, ctx);
    if (hier === null) {
      const texte = gruppenDesNutzers(db, nutzer.id)
        .map((g) => teamSeason(db, g.id, tag))
        .filter((s) => s !== undefined)
        .map((s) => teamsText(db, s, tag));
      await ctx.reply(texte.length ? texte.join("\n\n") : "Keine Season, keine Teams.");
      return;
    }
    trageMitgliedEin(db, hier, nutzer.id);
    const s = teamSeason(db, hier, tag);
    if (!s) {
      await ctx.reply("Keine Season, keine Teams. Erst /season Name.");
      return;
    }
    const kb = tag < s.start && (await darfVerwalten(ctx, s, nutzer.id)) ? knoepfe(db, s) : undefined;
    await ctx.reply(teamsText(db, s, tag), kb ? { reply_markup: kb } : {});
  });

  modul.command("team", async (ctx) => {
    if (!ctx.from) return;
    const tag = heute(gruppenZeitzone());
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const hier = gruppenId(db, ctx);
    if (hier !== null) trageMitgliedEin(db, hier, nutzer.id);
    const gruppe = hier ?? gruppenDesNutzers(db, nutzer.id)[0]?.id;
    const s = gruppe === undefined ? undefined : aktuelleSeason(db, gruppe, tag);
    if (!s) {
      await ctx.reply("Keine Season, keine Teams. Erst /season Name.");
      return;
    }
    const eingabe = argumente(ctx).trim();
    if (!eingabe) {
      const meins = teamsDerSeason(db, s.id).find((t) => t.mitglieder.includes(String(nutzer.id)));
      await ctx.reply(
        meins
          ? `Du bist in „${meins.name}“ mit ${namen(db, meins.mitglieder)}.`
          : "Du bist in keinem Team. Beitreten oder anlegen: /team Name, alle Teams: /teams",
      );
      return;
    }
    if (tag >= s.start) {
      await ctx.reply("Die Season läuft schon, die Teams stehen fest.");
      return;
    }
    const name = teamName(eingabe);
    if (!name) {
      await ctx.reply(`Ungültiger Teamname. 2 bis ${MAX_TEAMNAME} Zeichen, Buchstaben, Zahlen und ein paar Satzzeichen.`);
      return;
    }
    nimmTeil(db, s.id, nutzer.id, tag);
    const { team, neu } = tritt(db, s.id, nutzer.id, name);
    await ctx.reply(
      neu
        ? `${nutzer.name} gründet „${team.name}“. Wer mitwill: /team ${team.name}`
        : `${nutzer.name} ist jetzt in „${team.name}“ (${namen(db, team.mitglieder)}).`,
    );
  });

  modul.callbackQuery(/^tm:(\d+):([0234])$/, async (ctx) => {
    const [, id, anzahlText] = ctx.match;
    const anzahl = Number(anzahlText);
    const tag = heute(gruppenZeitzone());
    const s = seasonNachId(db, Number(id));
    const gruppe = s ? gruppeNachId(db, s.gruppe) : undefined;
    if (!s || !gruppe || ctx.chat?.id !== gruppe.telegram_chat_id) {
      await ctx.answerCallbackQuery({ text: "Diese Season gibt's nicht mehr." });
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    if (!(await darfVerwalten(ctx, s, nutzer.id))) {
      await ctx.answerCallbackQuery({ text: "Auslosen dürfen nur der Ersteller und die Gruppenadmins.", show_alert: true });
      return;
    }
    if (tag >= s.start) {
      await ctx.answerCallbackQuery({ text: "Die Season läuft schon, die Teams stehen fest.", show_alert: true });
      return;
    }
    if (anzahl > 0 && teilnehmerZahl(db, s.id) < anzahl * 2) {
      await ctx.answerCallbackQuery({ text: "Zu wenig Leute für so viele Teams." });
      return;
    }
    if (anzahl === 0) loeseTeamsAuf(db, s.id);
    else loseTeamsAus(db, s, anzahl);
    await ctx.answerCallbackQuery({ text: anzahl ? "Ausgelost 🎲" : "Teams aufgelöst" });
    const kb = knoepfe(db, s);
    await ctx.editMessageText(teamsText(db, s, tag), kb ? { reply_markup: kb } : {});
  });

  return modul;
}
