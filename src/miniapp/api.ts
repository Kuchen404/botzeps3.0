import { z } from "zod";
import type { Db } from "../db/index.js";
import { gruppeNachId, gruppenDesNutzers, speichereNutzer } from "../db/repo.js";
import { type Eintrag, aendereTrainingsdauer, eintrag, letzteEintraege, loescheEintrag } from "../db/verlauf-repo.js";
import { berechneStand, berechneTeams } from "../bericht/stand.js";
import { eigenesDiagramm, punkteverlauf } from "../bericht/punkteverlauf.js";
import { DAUERN, aenderbar, korrekturText } from "../bot/verlauf.js";
import { relevanteSeason } from "../bot/stand.js";
import { gruppenZeitzone, heute, uhr } from "../bot/kontext.js";
import { plusTage } from "../scoring/datum.js";
import { seasonEnde, wocheVon } from "../scoring/season.js";
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

const runde = (x: number) => Math.round(x * 10) / 10;

function name(n: MiniAppNutzer): string {
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || n.username || String(n.id);
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
    seasons.push({
      gruppe: gruppeNachId(db, s.gruppe)?.name ?? "",
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
        kalibrierMessungen: st.kalibrierMessungen,
        fettKg: st.start && st.aktuell ? { start: runde(st.start.fettKg), aktuell: runde(st.aktuell.fettKg) } : null,
        muskelKg: st.start && st.aktuell ? { start: runde(st.start.muskelKg), aktuell: runde(st.aktuell.muskelKg) } : null,
      },
      rangliste: tag >= s.start ? staende.map((x) => ({ platz: x.platz, name: x.name, gesamt: runde(x.gesamt), ich: x.id === st.id })) : [],
      teams: tag >= s.start ? berechneTeams(db, s, staende).map((t) => ({ platz: t.platz, name: t.name, gesamt: runde(t.gesamt), bonus: t.bonus })) : [],
      verlauf: eigen ? { x: eigen.x, reihen: eigen.reihen } : null,
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

function eintragJson(e: Eintrag, tag: string) {
  const { gruppenNachricht: _g, gruppeChat: _c, ...rest } = e;
  return { ...rest, aenderbar: aenderbar(e, tag) };
}

const LoeschenSchema = z.object({ art: z.enum(["t", "m"]), id: z.number().int().positive() });
const DauerSchema = z.object({ id: z.number().int().positive(), minuten: z.number().int() });
const EinstellungenSchema = z.object({
  erinnerungen: z.boolean().optional(),
  uhrzeit: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
});

export async function bearbeiteApi(db: Db, a: Anfrage, gruppenpost: Gruppenpost): Promise<Antwort> {
  const nutzer = speichereNutzer(db, a.nutzer.id, name(a.nutzer));
  const tag = heute(nutzer.zeitzone);
  const fehler = (status: number, text: string): Antwort => ({ status, json: { fehler: text } });

  if (a.methode === "GET" && a.pfad === "/api/ich") {
    return { status: 200, json: { name: nutzer.name, ...ich(db, nutzer.id, a.nutzer.id) } };
  }
  if (a.methode === "GET" && a.pfad === "/api/eintraege") {
    return { status: 200, json: { eintraege: letzteEintraege(db, nutzer.id, 30).map((e) => eintragJson(e, tag)), dauern: DAUERN } };
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
