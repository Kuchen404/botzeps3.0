import { z } from "zod";
import { bossSvg } from "../boss/figur.js";
import type { Db } from "../db/index.js";
import { type NutzerZeile, gruppenDesNutzers, messMittel, setzeGruppenNachricht, speichereNutzer, sportartNachId, sportartenFuerAuswahl } from "../db/repo.js";
import { type Eintrag, aendereTrainingsdauer, eintrag, letzteEintraege, loescheEintrag } from "../db/verlauf-repo.js";
import { berechneStand, berechneTeams } from "../bericht/stand.js";
import { eigenesDiagramm, punkteverlauf } from "../bericht/punkteverlauf.js";
import { DAUERN, aenderbar, korrekturText } from "../bot/verlauf.js";
import { relevanteSeason } from "../bot/stand.js";
import { gruppenZeitzone, heute, uhr } from "../bot/kontext.js";
import { TAG_TEXT, trageTrainingEin } from "../bot/sport.js";
import { speichereWaage } from "../bot/waage.js";
import { GRENZEN, istSprung, pruefeWaage } from "../domain/eingabe.js";
import { nimmAnAktuellerSeasonTeil } from "../db/season-repo.js";
import { log } from "../log.js";
import { plusTage } from "../scoring/datum.js";
import { type TeilnehmerStand, seasonEnde, wocheVon } from "../scoring/season.js";
import { type Boss, bosseDerSeason } from "../db/season-repo.js";
import { bossAnzeigename, bossEmoji, bossKampf, bossSchadenVon } from "../scoring/boss.js";
import { erfolgeDesNutzers, lebenslangeLast, ruhmeshalle } from "../db/erfolg-repo.js";
import { ERFOLGE, ERFOLG_ARTEN } from "../scoring/erfolge.js";
import { RAENGE, naechsterRang, rangFuer } from "../scoring/raenge.js";
import { laternen } from "../db/laterne-repo.js";
import { aktuelleMarken, minispielFuerApp } from "../minispiel/ablauf.js";
import type { MiniAppNutzer } from "./auth.js";

/**
 * JSON-API der Mini App. Jeder Aufruf gilt nur für den angemeldeten Nutzer selbst:
 * Rohwerte (Waage) nur die eigenen, von den anderen nur Punkte wie in der Gruppe.
 */

export interface Anfrage {
  methode: string;
  pfad: string;
  nutzer: MiniAppNutzer;
  body?: unknown;
}

export interface Antwort {
  status: number;
  json: unknown;
}

/** Gruppenpost eines Trainings anpassen (Text) oder löschen (null). */
export type Gruppenpost = (chatId: number, nachrichtId: number, text: string | null) => Promise<void>;

/** Neuen Post in die Gruppe schicken, gibt die Nachricht-id zurück. */
export type Gruppensenden = (chatId: number, text: string) => Promise<number>;

const runde = (x: number) => Math.round(x * 10) / 10;

function name(n: MiniAppNutzer): string {
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || n.username || String(n.id);
}

/**
 * Der Boss der laufenden Woche, sonst der zuletzt besiegte oder überlebende.
 * Kämpfer sind alle mit Schaden in der Boss-Woche, stärkste zuerst.
 */
function bossJson(bosse: readonly Boss[], staende: readonly TeilnehmerStand[], ich: string, woche: number | null, laeuft: boolean) {
  const boss = bosse.filter((b) => woche !== null && b.woche <= woche).at(-1);
  if (!boss) return null;
  const k = bossKampf(boss, staende);
  const last = (st: TeilnehmerStand) => bossSchadenVon(boss, st);
  return {
    name: bossAnzeigename(boss.name, boss.stufe),
    emoji: bossEmoji(boss.name),
    bild: bossSvg(boss.name, boss.stufe),
    stufe: boss.stufe,
    woche: boss.woche + 1,
    aktiv: laeuft && boss.woche === woche,
    lebenspunkte: k.lebenspunkte,
    schaden: k.schaden,
    besiegt: k.besiegt,
    bonus: k.bonus,
    schwaeche: boss.schwaecheName ?? null,
    kaempfer: staende
      .filter((st) => last(st) > 0)
      .sort((a, b) => last(b) - last(a) || a.name.localeCompare(b.name))
      .map((st) => ({ name: st.name, schaden: last(st), ich: st.id === ich })),
    drueckeberger: staende.filter((st) => last(st) === 0).map((st) => st.name),
  };
}

function ich(db: Db, nutzerId: number, telegramId: number) {
  const tag = heute(gruppenZeitzone());
  const seasons = [];
  for (const g of gruppenDesNutzers(db, nutzerId)) {
    const s = relevanteSeason(db, g.id, tag);
    if (!s) continue;
    const staende = berechneStand(db, s, tag);
    const st = staende.find((x) => x.telegramId === telegramId);
    if (!st) continue;
    const ende = seasonEnde(s);
    const laeuft = tag >= s.start && tag <= ende;
    const woche = wocheVon(s, tag < ende ? tag : ende);
    const w = woche === null || tag < s.start ? undefined : st.wochen[woche];
    const verlauf = punkteverlauf(db, s, tag);
    const eigen = verlauf && eigenesDiagramm(s, verlauf, st.id);
    const laterne = laternen(db, s);
    const marken = laeuft ? aktuelleMarken(db, s, tag) : new Map<string, string>();
    seasons.push({
      gruppe: g.name,
      chat: g.telegram_chat_id,
      name: s.name,
      start: s.start,
      ende,
      wochen: s.wochen,
      laeuft,
      gestartet: tag >= s.start,
      woche: woche === null ? null : woche + 1,
      anzahl: staende.length,
      ich: {
        platz: st.platz,
        gesamt: runde(st.gesamt),
        fleiss: runde(st.fleiss),
        fortschritt: st.fortschritt ? runde(st.fortschritt.punkte) : null,
        wochenLast: w?.last ?? 0,
        wochenziel: s.wochenziel_last,
        zielErreicht: w?.zielErreicht ?? false,
        serie: w?.serie ?? 0,
        // Wie oft in dieser Season, wenn man die Rote Laterne gerade trägt
        laterne: laterne.traeger.includes(st.id) ? (laterne.anzahl.get(st.id) ?? 1) : null,
        kalibrierMessungen: st.kalibrierMessungen,
        fettKg: st.start && st.aktuell ? { start: runde(st.start.fettKg), aktuell: runde(st.aktuell.fettKg) } : null,
        muskelKg: st.start && st.aktuell ? { start: runde(st.start.muskelKg), aktuell: runde(st.aktuell.muskelKg) } : null,
      },
      rangliste: tag >= s.start ? staende.map((x) => ({
              platz: x.platz,
              name: x.name,
              gesamt: runde(x.gesamt),
              ich: x.id === st.id,
              laterne: laterne.traeger.includes(x.id),
              marke: marken.get(x.id) ?? null,
            })) : [],
      teams: tag >= s.start ? berechneTeams(db, s, staende).map((t) => ({ platz: t.platz, name: t.name, gesamt: runde(t.gesamt), bonus: t.bonus })) : [],
      verlauf: eigen ? { x: eigen.x, reihen: eigen.reihen } : null,
      boss: tag >= s.start ? bossJson(bosseDerSeason(db, s), staende, st.id, woche, laeuft) : null,
      minispiel: laeuft ? minispielFuerApp(db, s, tag, st.id) : null,
    });
  }
  const n = db.prepare("SELECT erinnerungen, erinnerung_uhrzeit, zeitzone FROM nutzer WHERE id = ?").get(nutzerId) as {
    erinnerungen: number;
    erinnerung_uhrzeit: string;
    zeitzone: string;
  };
  const messungen = db
    .prepare(
      `SELECT datum, gewicht_kg AS gewichtKg, fett_pct AS fettPct, muskel_pct AS muskelPct FROM messung
       WHERE nutzer = ? AND geloescht_am IS NULL AND datum >= ? ORDER BY datum, zeitpunkt`,
    )
    .all(nutzerId, plusTage(heute(n.zeitzone), -180));
  return {
    seasons,
    messungen,
    einstellungen: { erinnerungen: n.erinnerungen === 1, uhrzeit: n.erinnerung_uhrzeit },
  };
}

/** Eigener Rang und Erfolge über alle Seasons, dazu die Ruhmeshalle jeder eigenen Gruppe (für den Reiter „Halle“). */
function ruhm(db: Db, nutzerId: number) {
  const last = lebenslangeLast(db, nutzerId);
  const rang = rangFuer(last);
  const naechster = naechsterRang(last);
  const am = new Map(erfolgeDesNutzers(db, nutzerId).map((e) => [e.art, e.erreicht_am]));
  return {
    rang: {
      name: rang.name,
      emoji: rang.emoji,
      ab: rang.ab,
      last,
      naechster: naechster ? { name: naechster.rang.name, emoji: naechster.rang.emoji, ab: naechster.rang.ab, fehlen: naechster.fehlen } : null,
    },
    raenge: RAENGE,
    erfolge: ERFOLG_ARTEN.map((art) => ({ art, ...ERFOLGE[art], erreichtAm: am.get(art) ?? null })),
    gruppen: gruppenDesNutzers(db, nutzerId).map((g) => {
      const r = ruhmeshalle(db, g.id);
      return {
        chat: g.telegram_chat_id,
        name: g.name,
        sieger: r.sieger,
        mitglieder: r.mitglieder.map((m) => {
          const mr = rangFuer(m.last);
          return { name: m.name, rang: mr.name, emoji: mr.emoji, last: m.last, erfolge: m.erfolge, ich: m.nutzerId === nutzerId };
        }),
        hoechsteWochenlast: r.hoechsteWochenlast,
        laengsteEinheit: r.laengsteEinheit,
      };
    }),
  };
}

function eintragJson(e: Eintrag, tag: string) {
  const { gruppenNachricht: _g, gruppeChat: _c, ...rest } = e;
  return { ...rest, aenderbar: aenderbar(e, tag) };
}

/** Was das Eintragen-Formular braucht: Gruppen mit Sportarten (zuletzt benutzte zuerst) und die letzte Messung. */
function eingabe(db: Db, nutzer: NutzerZeile) {
  const letzte = db
    .prepare(
      `SELECT gewicht_kg AS gewichtKg, fett_pct AS fettPct, muskel_pct AS muskelPct FROM messung
       WHERE nutzer = ? AND geloescht_am IS NULL ORDER BY datum DESC, zeitpunkt DESC LIMIT 1`,
    )
    .get(nutzer.id);
  return {
    gruppen: gruppenDesNutzers(db, nutzer.id).map((g) => ({
      chat: g.telegram_chat_id,
      name: g.name,
      sportarten: sportartenFuerAuswahl(db, g.id, nutzer.id).map((s) => ({ id: s.id, name: s.name, faktor: s.faktor })),
    })),
    dauern: DAUERN,
    minuten: GRENZEN.minuten,
    letzteMessung: letzte ?? null,
  };
}

const TageSchema = z.number().int().min(0).max(GRENZEN.maxTageZurueck);
const TrainingSchema = z.object({
  chat: z.number().int(),
  sportart: z.number().int().positive(),
  minuten: z.number().int().min(GRENZEN.minuten.min).max(GRENZEN.minuten.max),
  tage: TageSchema,
});
const MessungSchema = z.object({
  gewichtKg: z.number(),
  fettPct: z.number(),
  muskelPct: z.number(),
  tage: TageSchema,
  /** Nach der Rückfrage bei großem Sprung: trotzdem speichern, als auffällig markiert. */
  trotzdem: z.boolean().optional(),
});

const LoeschenSchema = z.object({ art: z.enum(["t", "m"]), id: z.number().int().positive() });
const DauerSchema = z.object({ id: z.number().int().positive(), minuten: z.number().int() });
const EinstellungenSchema = z.object({
  erinnerungen: z.boolean().optional(),
  uhrzeit: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
});

export async function bearbeiteApi(db: Db, a: Anfrage, gruppenpost: Gruppenpost, gruppensenden: Gruppensenden): Promise<Antwort> {
  const nutzer = speichereNutzer(db, a.nutzer.id, name(a.nutzer));
  const tag = heute(nutzer.zeitzone);
  const fehler = (status: number, text: string): Antwort => ({ status, json: { fehler: text } });

  if (a.methode === "GET" && a.pfad === "/api/ich") {
    return { status: 200, json: { name: nutzer.name, ...ich(db, nutzer.id, a.nutzer.id) } };
  }
  if (a.methode === "GET" && a.pfad === "/api/ruhm") {
    return { status: 200, json: ruhm(db, nutzer.id) };
  }
  if (a.methode === "GET" && a.pfad === "/api/eintraege") {
    return { status: 200, json: { eintraege: letzteEintraege(db, nutzer.id, 30).map((e) => eintragJson(e, tag)), dauern: DAUERN } };
  }
  if (a.methode === "GET" && a.pfad === "/api/eingabe") {
    return { status: 200, json: eingabe(db, nutzer) };
  }
  if (a.methode === "POST" && a.pfad === "/api/training") {
    const b = TrainingSchema.safeParse(a.body);
    if (!b.success) return fehler(400, `Dauer bitte zwischen ${GRENZEN.minuten.min} und ${GRENZEN.minuten.max} Minuten.`);
    const gruppe = gruppenDesNutzers(db, nutzer.id).find((g) => g.telegram_chat_id === b.data.chat);
    const sportart = sportartNachId(db, b.data.sportart);
    if (!gruppe || !sportart || sportart.gruppe !== gruppe.id) return fehler(403, "Gruppe oder Sportart passt nicht.");
    nimmAnAktuellerSeasonTeil(db, gruppe.id, nutzer.id, heute(gruppenZeitzone()));
    const { trainingId, post, last } = trageTrainingEin(db, nutzer, sportart, b.data.minuten, b.data.tage);
    const was = `${b.data.minuten} min ${sportart.name}${TAG_TEXT[b.data.tage]}, ${last} Lastpunkte`;
    try {
      setzeGruppenNachricht(db, trainingId, await gruppensenden(gruppe.telegram_chat_id, post));
      return { status: 200, json: { ok: true, text: `Eingetragen: ${was}. In „${gruppe.name}“ gepostet.` } };
    } catch (err) {
      log.warn(`Training ${trainingId} aus der Mini App nicht in Gruppe ${gruppe.id} gepostet`, err);
      return { status: 200, json: { ok: true, text: `Eingetragen: ${was}. Posten in „${gruppe.name}“ hat nicht geklappt.` } };
    }
  }
  if (a.methode === "POST" && a.pfad === "/api/messung") {
    const b = MessungSchema.safeParse(a.body);
    if (!b.success) return fehler(400, "Ungültige Anfrage");
    const e = { gewichtKg: b.data.gewichtKg, fettPct: b.data.fettPct, muskelPct: b.data.muskelPct, tageZurueck: b.data.tage };
    const falsch = pruefeWaage(e);
    if (falsch) return fehler(400, falsch);
    const datum = plusTage(tag, -e.tageZurueck);
    const mittel = messMittel(db, nutzer.id, plusTage(datum, -6), datum);
    if (!b.data.trotzdem && istSprung(e, mittel)) {
      return {
        status: 200,
        json: { ok: false, sprung: { gewichtKg: runde(mittel!.gewichtKg), fettPct: runde(mittel!.fettPct) } },
      };
    }
    return { status: 200, json: { ok: true, text: speichereWaage(db, nutzer, e, Boolean(b.data.trotzdem) && istSprung(e, mittel)) } };
  }
  if (a.methode === "POST" && a.pfad === "/api/eintrag/loeschen") {
    const b = LoeschenSchema.safeParse(a.body);
    if (!b.success) return fehler(400, "Ungültige Anfrage");
    const e = eintrag(db, b.data.art, b.data.id, nutzer.id);
    if (!e || !aenderbar(e, tag)) return fehler(403, "Geht nicht (mehr).");
    loescheEintrag(db, e, nutzer.id, uhr.jetzt().toISOString());
    if (e.art === "t" && e.gruppeChat && e.gruppenNachricht) await gruppenpost(e.gruppeChat, e.gruppenNachricht, null);
    return { status: 200, json: { ok: true } };
  }
  if (a.methode === "POST" && a.pfad === "/api/eintrag/dauer") {
    const b = DauerSchema.safeParse(a.body);
    if (!b.success || !DAUERN.includes(b.data.minuten)) return fehler(400, "Ungültige Anfrage");
    const e = eintrag(db, "t", b.data.id, nutzer.id);
    if (!e || !aenderbar(e, tag)) return fehler(403, "Geht nicht (mehr).");
    aendereTrainingsdauer(db, e, nutzer.id, b.data.minuten);
    if (e.gruppeChat && e.gruppenNachricht) await gruppenpost(e.gruppeChat, e.gruppenNachricht, korrekturText(nutzer.name, e, b.data.minuten));
    return { status: 200, json: { ok: true } };
  }
  if (a.methode === "POST" && a.pfad === "/api/einstellungen") {
    const b = EinstellungenSchema.safeParse(a.body);
    if (!b.success) return fehler(400, "Ungültige Anfrage");
    db.prepare(
      "UPDATE nutzer SET erinnerungen = COALESCE(?, erinnerungen), erinnerung_uhrzeit = COALESCE(?, erinnerung_uhrzeit) WHERE id = ?",
    ).run(b.data.erinnerungen === undefined ? null : Number(b.data.erinnerungen), b.data.uhrzeit ?? null, nutzer.id);
    return { status: 200, json: { ok: true } };
  }
  return fehler(404, "Gibt's nicht");
}
