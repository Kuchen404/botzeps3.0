import { Composer, InputFile, type Context } from "grammy";
import type { Db } from "../db/index.js";
import { speichereNutzer, trageMitgliedEin } from "../db/repo.js";
import { type SeasonZeile, legeSeasonAn, seasonNachId } from "../db/season-repo.js";
import { anzeigename, argumente, datumDe, gruppenId, gruppenZeitzone, heute, uhr } from "../bot/kontext.js";
import { montagIn } from "../bot/season.js";
import { lokalesDatum, plusTage } from "../scoring/datum.js";
import { kalibrierFenster, seasonEnde, wocheVon } from "../scoring/season.js";
import { STUFEN } from "../scoring/boss.js";
import { berichtsZeitpunkt, bossSpottZeitpunkt, bossZeitpunkt, zeitplanExtras, zeitplanLauf } from "../zeitplan.js";
import { log } from "../log.js";
import { appKnopf } from "../bot/app-knopf.js";
import { FAKE_PROFILE, type Profil, autopilotProfil, simuliereTag, tage } from "./simulation.js";

/**
 * Demo-Modus (nur mit DEMO_MODUS=1): eine Season mit Fake-Teilnehmern in einer Testgruppe
 * und eine verstellbare Uhr, damit Berichte, Boss-Wochen und Finale in Minuten statt Wochen kommen.
 */

export const DEMO_BEFEHLE = [
  { command: "demo", description: "Demo: Season mit Fake-Leuten starten (Testgruppe)" },
  { command: "vorspulen", description: "Demo: zum nächsten Bericht/Boss springen, oder /vorspulen 3" },
  { command: "autopilot", description: "Demo: eigene Trainings automatisch an/aus" },
];

export const DEMO_STANDARD_WOCHEN = 6;
/** Pause zwischen den Etappen des Boss-Auftritts beim Vorspulen (Tests setzen 0). */
export const DEMO_TAKT = { etappeMs: 2500 };
const MIN_WOCHEN = 4;
const MAX_WOCHEN = 12;
const MAX_TAGE = 100;

const CHARAKTER: Record<string, string> = {
  "Hantel-Hans": "der Streber",
  "Couch-Carsten": "Stammgast auf dem Sofa",
  "Yoga-Yvonne": "zäh und gleichmäßig",
  "Pumper-Paul": "nur Muskeln",
  "Wackel-Willi": "mal Vollgas, mal gar nix",
};

let versatzMs = 0;

/** Legt die Demo-Tabellen an und stellt die Bot-Uhr auf die gespeicherte Demo-Zeit. */
export function aktiviereDemo(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_uhr (id INTEGER PRIMARY KEY CHECK (id = 1), versatz_ms INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS demo_gruppe (
      gruppe        INTEGER PRIMARY KEY REFERENCES gruppe(id) ON DELETE CASCADE,
      simuliert_bis TEXT    NOT NULL,
      autopilot     INTEGER REFERENCES nutzer(id) ON DELETE SET NULL
    );
  `);
  versatzMs = (db.prepare("SELECT versatz_ms FROM demo_uhr WHERE id = 1").get() as { versatz_ms: number } | undefined)?.versatz_ms ?? 0;
  uhr.jetzt = () => new Date(Date.now() + versatzMs);
}

/** Stellt die Bot-Uhr auf `ziel` (bzw. zurück auf die echte Zeit mit `null`). */
export function stelleUhr(db: Db, ziel: Date | null): void {
  versatzMs = ziel ? ziel.getTime() - Date.now() : 0;
  db.prepare("INSERT INTO demo_uhr (id, versatz_ms) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET versatz_ms = excluded.versatz_ms").run(versatzMs);
}

function fakeTelegramId(gruppe: number, i: number): number {
  // Echte Telegram-Nutzer haben positive ids
  return -(gruppe * 100 + i + 1);
}

/** Löscht Seasons, Fake-Teilnehmer und alle Einträge der Gruppenmitglieder. */
export function entferneDemo(db: Db, gruppe: number): void {
  db.transaction(() => {
    const mitglieder = db.prepare("SELECT nutzer FROM gruppe_mitglied WHERE gruppe = ?").pluck().all(gruppe) as number[];
    db.prepare("DELETE FROM season WHERE gruppe = ?").run(gruppe);
    for (const id of mitglieder) {
      for (const tabelle of ["training", "messung", "erfolg", "aenderung"]) db.prepare(`DELETE FROM ${tabelle} WHERE nutzer = ?`).run(id);
    }
    db.prepare("DELETE FROM nutzer WHERE telegram_id < 0 AND id IN (SELECT nutzer FROM gruppe_mitglied WHERE gruppe = ?)").run(gruppe);
    db.prepare("DELETE FROM demo_gruppe WHERE gruppe = ?").run(gruppe);
  })();
}

/** Setzt die Uhr zurück und legt eine neue Demo-Season ab dem nächsten Montag an. */
export function richteDemoEin(
  db: Db,
  a: { gruppe: number; nutzer: number; wochen: number; zeitzone: string },
): SeasonZeile {
  stelleUhr(db, null);
  entferneDemo(db, a.gruppe);
  const tag = heute(a.zeitzone);
  const s = db.transaction(() => {
    trageMitgliedEin(db, a.gruppe, a.nutzer);
    FAKE_PROFILE.forEach((p, i) => trageMitgliedEin(db, a.gruppe, legeFakeAn(db, a.gruppe, i, p.name)));
    const s = legeSeasonAn(db, { gruppe: a.gruppe, name: "Demo-Season", start: montagIn(tag, 1), erstelltVon: a.nutzer, heute: tag });
    db.prepare("UPDATE season SET wochen = ? WHERE id = ?").run(a.wochen, s.id);
    db.prepare("INSERT INTO demo_gruppe (gruppe, simuliert_bis, autopilot) VALUES (?, ?, ?)").run(
      a.gruppe,
      plusTage(kalibrierFenster(s, tag).von, -1),
      a.nutzer,
    );
    return seasonNachId(db, s.id)!;
  })();
  simuliereBis(db, a.gruppe, s, tag, a.zeitzone);
  return s;
}

function legeFakeAn(db: Db, gruppe: number, i: number, name: string): number {
  const id = speichereNutzer(db, fakeTelegramId(gruppe, i), name).id;
  db.prepare("UPDATE nutzer SET erinnerungen = 0 WHERE id = ?").run(id);
  return id;
}

interface DemoGruppe {
  simuliert_bis: string;
  autopilot: number | null;
}

function demoGruppe(db: Db, gruppe: number): DemoGruppe | undefined {
  return db.prepare("SELECT simuliert_bis, autopilot FROM demo_gruppe WHERE gruppe = ?").get(gruppe) as DemoGruppe | undefined;
}

/** Die Season der Demo-Gruppe (es gibt nur eine). */
function demoSeason(db: Db, gruppe: number): SeasonZeile | undefined {
  const z = db.prepare("SELECT id FROM season WHERE gruppe = ? ORDER BY id DESC LIMIT 1").get(gruppe) as { id: number } | undefined;
  return z ? seasonNachId(db, z.id) : undefined;
}

export interface Simuliert {
  name: string;
  trainings: number;
  minuten: number;
  messungen: number;
}

/** Erzeugt die Einträge aller Fake-Teilnehmer (und des Autopiloten) bis `bis`, höchstens bis Season-Ende. */
export function simuliereBis(db: Db, gruppe: number, s: SeasonZeile, bis: string, zeitzone: string): Simuliert[] {
  const dg = demoGruppe(db, gruppe);
  if (!dg) return [];
  const ende = seasonEnde(s);
  const letzter = bis < ende ? bis : ende;
  const teilnehmer = db
    .prepare(
      `SELECT n.id, n.name, n.telegram_id, t.beitritt FROM teilnahme t JOIN nutzer n ON n.id = t.nutzer
       WHERE t.season = ? AND (n.telegram_id < 0 OR n.id = ?) ORDER BY n.telegram_id < 0, n.id`,
    )
    .all(s.id, dg.autopilot) as { id: number; name: string; telegram_id: number; beitritt: string }[];
  const ergebnis = db.transaction(() =>
    teilnehmer.map((t) => {
      const profil: Profil = FAKE_PROFILE.find((p) => p.name === t.name && t.telegram_id < 0) ?? autopilotProfil(t.name);
      const fenster = kalibrierFenster(s, t.beitritt);
      const summe: Simuliert = { name: t.telegram_id < 0 ? t.name : `${t.name} (Autopilot)`, trainings: 0, minuten: 0, messungen: 0 };
      for (const datum of tage(plusTage(dg.simuliert_bis, 1), letzter)) {
        if (datum < fenster.von) continue;
        const r = simuliereTag(db, {
          gruppe,
          nutzer: t.id,
          profil,
          datum,
          kalibrierStart: fenster.von,
          kalibrierung: datum <= fenster.bis,
          zeitzone,
        });
        summe.trainings += r.trainings;
        summe.minuten += r.minuten;
        summe.messungen += r.messungen;
      }
      return summe;
    }),
  )();
  if (letzter > dg.simuliert_bis) db.prepare("UPDATE demo_gruppe SET simuliert_bis = ? WHERE gruppe = ?").run(letzter, gruppe);
  return ergebnis;
}

/** Nächster Bericht, Boss oder Boss-Spott nach `jetzt`, oder null, wenn die Season durch ist. */
export function naechstesEreignis(s: SeasonZeile, jetzt: Date, zeitzone: string): Date | null {
  const zeiten = [
    ...Array.from({ length: s.wochen }, (_, w) => berichtsZeitpunkt(s, w, zeitzone)),
    ...STUFEN.map((stufe) => bossZeitpunkt(s, stufe, zeitzone)).filter((z) => z !== null),
    ...STUFEN.map((stufe) => bossSpottZeitpunkt(s, stufe, zeitzone)).filter((z) => z !== null),
  ].filter((z) => z > jetzt);
  return zeiten.length ? new Date(Math.min(...zeiten.map((z) => z.getTime()))) : null;
}

export type Sprungziel = { art: "ereignis" } | { art: "tage"; tage: number } | { art: "ende" };

export function parseSprung(eingabe: string): Sprungziel | null {
  const e = eingabe.trim().toLowerCase();
  if (e === "") return { art: "ereignis" };
  if (e === "ende" || e === "finale") return { art: "ende" };
  const n = Number(e.replace(/\s*(tage?|d)$/, ""));
  return Number.isInteger(n) && n >= 1 && n <= MAX_TAGE ? { art: "tage", tage: n } : null;
}

/** Zielzeitpunkt eines Sprungs; Berichte und Bosse kommen eine Minute nach ihrer Fälligkeit dran. */
export function sprungZiel(s: SeasonZeile, ziel: Sprungziel, jetzt: Date, zeitzone: string): Date | null {
  const minute = 60_000;
  if (ziel.art === "tage") return new Date(jetzt.getTime() + ziel.tage * 24 * 60 * minute);
  if (ziel.art === "ende") {
    const finale = berichtsZeitpunkt(s, s.wochen - 1, zeitzone);
    return finale > jetzt ? new Date(finale.getTime() + minute) : null;
  }
  const naechstes = naechstesEreignis(s, jetzt, zeitzone);
  return naechstes ? new Date(naechstes.getTime() + minute) : null;
}

function zeitDe(d: Date, zeitzone: string): string {
  return d.toLocaleString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zeitzone,
  });
}

export function sprungText(s: SeasonZeile, ziel: Date, zeitzone: string, simuliert: readonly Simuliert[]): string {
  const datum = lokalesDatum(ziel, zeitzone);
  const woche = wocheVon(s, datum);
  const phase =
    woche !== null ? `Woche ${woche + 1} von ${s.wochen}` : datum < s.start ? "Kalibrierwoche" : "Season vorbei";
  const zeilen = simuliert
    .filter((x) => x.trainings > 0 || x.messungen > 0)
    .map((x) => `• ${x.name}: ${x.trainings} Training${x.trainings === 1 ? "" : "s"}${x.minuten ? ` (${x.minuten} Min.)` : ""}, ${x.messungen}× Waage`);
  return [
    `⏩ Vorgespult auf ${zeitDe(ziel, zeitzone)} Uhr (${phase}).`,
    ...(zeilen.length ? ["", "In der Zwischenzeit:", ...zeilen] : []),
  ].join("\n");
}

export function demoModul(db: Db, miniAppUrl?: string): Composer<Context> {
  const c = new Composer<Context>();

  c.command("demo", async (ctx) => {
    const gruppe = gruppenId(db, ctx);
    if (gruppe === null || !ctx.from) {
      await ctx.reply("Die Demo läuft in einer Testgruppe: Bot in eine Gruppe holen und dort /demo schreiben.");
      return;
    }
    const arg = argumente(ctx).trim();
    const wochen = arg === "" ? DEMO_STANDARD_WOCHEN : Number(arg);
    if (!Number.isInteger(wochen) || wochen < MIN_WOCHEN || wochen > MAX_WOCHEN) {
      await ctx.reply(`Wochen zwischen ${MIN_WOCHEN} und ${MAX_WOCHEN}, z. B. /demo 6`);
      return;
    }
    const zeitzone = gruppenZeitzone();
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    const s = richteDemoEin(db, { gruppe, nutzer: nutzer.id, wochen, zeitzone });
    await ctx.reply(
      [
        `🧪 Demo läuft: „${s.name}“, ${s.wochen} Wochen ab Montag, ${datumDe(s.start)}. Uhr und alle Einträge der Gruppe sind zurückgesetzt.`,
        "",
        `Dabei: ${nutzer.name} (Autopilot) und ${FAKE_PROFILE.length} Fake-Pumper:`,
        ...FAKE_PROFILE.map((p) => `• ${p.name}, ${CHARAKTER[p.name] ?? ""}`),
        "",
        "/vorspulen springt zum nächsten Ereignis (Wochenbericht, Boss, Finale) und löst es sofort aus.",
        "/vorspulen 3 springt 3 Tage, /vorspulen ende bis nach dem Finale.",
        "Die Fake-Leute trainieren und wiegen sich dabei von selbst, du mit Autopilot auch (/autopilot aus).",
        "Zwischendurch geht alles wie im Ernstfall: /sport, /waage (privat), /stand, /rangliste, /erfolge, Mini App.",
        "Vor dem ersten Sprung kannst du noch /teams auslosen oder mit /season die Einstellungen ändern.",
        "/demo fängt von vorne an.",
      ].join("\n"),
    );
  });

  c.command("autopilot", async (ctx) => {
    const gruppe = gruppenId(db, ctx);
    if (gruppe === null || !ctx.from || !demoGruppe(db, gruppe)) {
      await ctx.reply("Erst in der Testgruppe /demo starten.");
      return;
    }
    const arg = argumente(ctx).trim().toLowerCase();
    if (arg !== "an" && arg !== "aus") {
      await ctx.reply("/autopilot an oder /autopilot aus");
      return;
    }
    const nutzer = speichereNutzer(db, ctx.from.id, anzeigename(ctx));
    db.prepare("UPDATE demo_gruppe SET autopilot = ? WHERE gruppe = ?").run(arg === "an" ? nutzer.id : null, gruppe);
    await ctx.reply(
      arg === "an"
        ? `Autopilot an: ${nutzer.name} trainiert und wiegt sich beim Vorspulen von selbst.`
        : `Autopilot aus: ${nutzer.name} trägt ab jetzt selbst ein. Beim Vorspulen passiert für dich nichts mehr.`,
    );
  });

  c.command("vorspulen", async (ctx) => {
    const gruppe = gruppenId(db, ctx);
    const s = gruppe === null ? undefined : demoSeason(db, gruppe);
    if (gruppe === null || !s || !demoGruppe(db, gruppe)) {
      await ctx.reply("Erst in der Testgruppe /demo starten.");
      return;
    }
    const ziel = parseSprung(argumente(ctx));
    if (!ziel) {
      await ctx.reply(`/vorspulen (nächstes Ereignis), /vorspulen 3 (Tage, bis ${MAX_TAGE}) oder /vorspulen ende`);
      return;
    }
    const zeitzone = gruppenZeitzone();
    const zielZeit = sprungZiel(s, ziel, uhr.jetzt(), zeitzone);
    if (!zielZeit) {
      await ctx.reply("Die Season ist durch, da kommt nichts mehr. /demo für eine neue Runde.");
      return;
    }
    // Erst die Einträge erzeugen, dann die Uhr stellen: so findet der Zeitplan alles schon vor
    const simuliert = simuliereBis(db, gruppe, s, lokalesDatum(zielZeit, zeitzone), zeitzone);
    await ctx.reply(sprungText(s, zielZeit, zeitzone, simuliert));
    stelleUhr(db, zielZeit);
    try {
      await zeitplanLauf(
        db,
        async (chatId, text, o) => {
          const app = o?.appKnopf ? appKnopf(ctx.me, { id: chatId, type: "group" }, miniAppUrl) : undefined;
          return (await ctx.api.sendMessage(chatId, text, app ? { reply_markup: app } : {})).message_id;
        },
        async (chatId, png, beschriftung) =>
          (await ctx.api.sendPhoto(chatId, new InputFile(png, beschriftung ? "boss.png" : "punkteverlauf.png"), beschriftung ? { caption: beschriftung } : {})).message_id,
        uhr.jetzt(),
        zeitzone,
        zeitplanExtras(ctx.api, DEMO_TAKT.etappeMs),
      );
    } catch (err) {
      log.error("Zeitplan nach dem Vorspulen fehlgeschlagen", err);
    }
  });

  return c;
}
