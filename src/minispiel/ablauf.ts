import type { Db } from "../db/index.js";
import { type SeasonZeile, seasonNachId } from "../db/season-repo.js";
import { gruppeNachId } from "../db/repo.js";
import { legeMinispielFest, minispielZeile, setzeMinispielDaten, setzeMinispielPin, spielWoche, spielerDerSeason } from "../db/minispiel-repo.js";
import { berechneStand } from "../bericht/stand.js";
import { lokalesDatum, plusTage, tageZwischen, zeitpunktIn } from "../scoring/datum.js";
import { wocheVon } from "../scoring/season.js";
import { log } from "../log.js";
import {
  BASISLAGER_ANTEIL,
  BOT_ID,
  MINISPIELE,
  MINISPIEL_UHRZEIT,
  type MinispielDaten,
  type SpielWoche,
  type Spieler,
  bombentraeger,
  codeText,
  duellFuehrender,
  duelle,
  gipfel,
  kopfgeld,
  lasten,
  minispielWochen,
  seil,
  stelleAuf,
  tresor,
  zombies,
} from "./spiele.js";
import {
  fertigeTage,
  minispielAnkuendigung,
  minispielErgebnis,
  minispielLage,
  minispielMarken,
  minispielNachTraining,
  minispielTeaser,
  namenVon,
} from "./meldungen.js";

/** Was der Ablauf zum Senden braucht; dieselben Signaturen wie im Zeitplan. */
type Senden = (chatId: number, text: string) => Promise<number | void>;
interface Pinnen {
  anpinnen?: (chatId: number, nachrichtId: number) => Promise<unknown>;
  loesen?: (chatId: number, nachrichtId: number) => Promise<unknown>;
}

/** Ankündigung (Tag 0) oder Lagemeldung (Tag 1 bis 6) eines Minispiels. */
export function minispielZeitpunkt(s: Pick<SeasonZeile, "start">, woche: number, tag: number, zeitzone: string): Date {
  return zeitpunktIn(plusTage(s.start, woche * 7 + tag), MINISPIEL_UHRZEIT, zeitzone);
}

/** Alle Termine der Minispiele einer Season mit Art. */
export function minispielTermine(s: Pick<SeasonZeile, "start" | "wochen">, zeitzone: string): { art: "minispiel" | "minispiel_lage"; zeitpunkt: Date }[] {
  return minispielWochen(s.wochen).flatMap((w) =>
    Array.from({ length: 7 }, (_, tag) => ({ art: tag === 0 ? ("minispiel" as const) : ("minispiel_lage" as const), zeitpunkt: minispielZeitpunkt(s, w, tag, zeitzone) })),
  );
}

/** Woche und Tag eines Termins, oder null, wenn er nicht mehr zur Season passt (Start oder Dauer geändert). */
function terminTag(s: SeasonZeile, faelligAm: string, zeitzone: string): { woche: number; tag: number; datum: string } | null {
  const datum = lokalesDatum(new Date(faelligAm), zeitzone);
  const tage = tageZwischen(s.start, datum);
  const woche = Math.floor(tage / 7);
  const tag = tage - woche * 7;
  if (tage < 0 || !minispielWochen(s.wochen).includes(woche)) return null;
  return minispielZeitpunkt(s, woche, tag, zeitzone).toISOString() === faelligAm ? { woche, tag, datum } : null;
}

/** Teaser am Abend vor einer Minispiel-Woche; legt dabei fest, welches Spiel kommt. */
export function minispielTeaserFuer(db: Db, s: SeasonZeile, woche: number): string | null {
  return minispielWochen(s.wochen).includes(woche) ? minispielTeaser(legeMinispielFest(db, s, woche)) : null;
}

/**
 * Ankündigung am ersten Tag der Woche: legt Patient Null, Gejagten, Teams usw. fest,
 * postet die Regeln und pinnt sie bis zum Wochenbericht an. Verpasste Ankündigungen
 * (z. B. nach längerem Ausfall) verfallen, sobald die Woche vorbei ist.
 */
export async function kuendigeMinispielAn(
  db: Db,
  senden: Senden,
  termin: { season: number | null; faellig_am: string },
  jetzt: Date,
  zeitzone: string,
  pinnen: Pinnen = {},
): Promise<boolean> {
  const s = termin.season === null ? undefined : seasonNachId(db, termin.season);
  const gruppe = s ? gruppeNachId(db, s.gruppe) : undefined;
  const t = s ? terminTag(s, termin.faellig_am, zeitzone) : null;
  if (!s || !gruppe || !t || t.tag !== 0 || lokalesDatum(jetzt, zeitzone) > plusTage(t.datum, 6)) return false;
  const art = legeMinispielFest(db, s, t.woche);
  if (minispielZeile(db, s.id, t.woche)?.daten) return false;
  const spieler = spielerDerSeason(db, s, t.datum);
  if (spieler.length < MINISPIELE[art].minSpieler) return false;
  const fuehrender = berechneStand(db, s, plusTage(t.datum, -1))[0]?.id ?? null;
  const w = spielWoche(s, t.woche);
  const daten = stelleAuf(art, spieler, { ziel: w.ziel, fuehrender });
  setzeMinispielDaten(db, s.id, t.woche, daten);
  const nachricht = await senden(gruppe.telegram_chat_id, minispielAnkuendigung(daten, spieler, w, s.berichtszeit));
  if (nachricht && pinnen.anpinnen) {
    try {
      await pinnen.anpinnen(gruppe.telegram_chat_id, nachricht);
      setzeMinispielPin(db, s.id, t.woche, nachricht);
    } catch (err) {
      log.warn("Minispiel-Ankündigung nicht angepinnt (Bot braucht Adminrechte zum Anpinnen)", err);
    }
  }
  return true;
}

/** Lagemeldung am Morgen, nur am Tag selbst (nachgeholt wird sie nicht). */
export async function meldeMinispielLage(
  db: Db,
  senden: Senden,
  termin: { season: number | null; faellig_am: string },
  jetzt: Date,
  zeitzone: string,
): Promise<boolean> {
  const s = termin.season === null ? undefined : seasonNachId(db, termin.season);
  const gruppe = s ? gruppeNachId(db, s.gruppe) : undefined;
  const t = s ? terminTag(s, termin.faellig_am, zeitzone) : null;
  if (!s || !gruppe || !t || t.tag === 0 || lokalesDatum(jetzt, zeitzone) !== t.datum) return false;
  const daten = minispielZeile(db, s.id, t.woche)?.daten;
  if (!daten) return false;
  const lage = minispielLage(daten, spielerDerSeason(db, s, t.datum), spielWoche(s, t.woche), t.tag);
  if (!lage) return false;
  if (daten.art === "zombie" && lage.gemeldet) setzeMinispielDaten(db, s.id, t.woche, { ...daten, gemeldet: lage.gemeldet });
  await senden(gruppe.telegram_chat_id, lage.text);
  return true;
}

/** Auflösung nach dem Wochenbericht; löst auch die angepinnte Ankündigung. */
export async function loeseMinispielAuf(db: Db, senden: Senden, s: SeasonZeile, woche: number, chatId: number, pinnen: Pinnen = {}): Promise<void> {
  const zeile = minispielZeile(db, s.id, woche);
  if (!zeile?.daten) return;
  const w = spielWoche(s, woche);
  await senden(chatId, minispielErgebnis(zeile.daten, spielerDerSeason(db, s, plusTage(w.start, 6)), w));
  if (zeile.pin === null) return;
  setzeMinispielPin(db, s.id, woche, null);
  try {
    await pinnen.loesen?.(chatId, zeile.pin);
  } catch (err) {
    log.warn(`Minispiel-Ankündigung ${zeile.pin} nicht abgepinnt`, err);
  }
}

/** Das laufende Minispiel am Tag `tag`, mit Spielern und Woche, oder null. */
function laufendesSpiel(db: Db, s: SeasonZeile, tag: string): { daten: MinispielDaten; spieler: Spieler[]; w: SpielWoche; woche: number } | null {
  const woche = wocheVon(s, tag);
  if (woche === null) return null;
  const daten = minispielZeile(db, s.id, woche)?.daten;
  return daten ? { daten, spieler: spielerDerSeason(db, s, tag), w: spielWoche(s, woche), woche } : null;
}

/** Meldungen für den Gruppenpost eines Trainings, nur für Trainings der laufenden Woche. */
export function minispielMeldungen(db: Db, s: SeasonZeile, trainingId: number, nutzer: number, datum: string, tag: string): string[] {
  const spiel = laufendesSpiel(db, s, tag);
  if (!spiel || wocheVon(s, datum) !== spiel.woche) return [];
  const vorher = spiel.spieler.map((sp) => ({ ...sp, trainings: sp.trainings.filter((t) => t.id !== trainingId) }));
  return minispielNachTraining(spiel.daten, vorher, spiel.spieler, spiel.w, String(nutzer));
}

/** Zeichen hinter den Namen in der Rangliste (🧟, 💣, 🎯, 🚩), solange das Spiel läuft. */
export function aktuelleMarken(db: Db, s: SeasonZeile, tag: string): Map<string, string> {
  const spiel = laufendesSpiel(db, s, tag);
  return spiel ? minispielMarken(spiel.daten, spiel.spieler, spiel.w, fertigeTage(spiel.w, tag)) : new Map();
}

const z = (x: number) => Math.round(x).toLocaleString("de-DE");

/** Das laufende Minispiel für die Mini App, oder null. */
export function minispielFuerApp(db: Db, s: SeasonZeile, tag: string, ich: string) {
  const spiel = laufendesSpiel(db, s, tag);
  if (!spiel) return null;
  const { daten: d, spieler, w } = spiel;
  const namen = namenVon(spieler);
  const nm = (id: string) => namen.get(id) ?? "?";
  const l = lasten(d, spieler, w);
  const marken = minispielMarken(d, spieler, w, fertigeTage(w, tag));
  const basis = { art: d.art, name: MINISPIELE[d.art].name, emoji: MINISPIELE[d.art].emoji, woche: spiel.woche + 1 };
  const eintrag = (id: string, text: string) => ({ name: nm(id) + (marken.has(id) ? ` ${marken.get(id)}` : ""), text, ich: id === ich });
  switch (d.art) {
    case "zombie": {
      const zz = zombies(d, spieler, w, fertigeTage(w, tag));
      const menschen = d.spieler.filter((id) => !zz.has(id)).length;
      return {
        ...basis,
        regel: "Zwei Tage am Stück ohne Training, und du wirst gebissen. Sonntag zählen die Überlebenden.",
        status: `🧍 ${menschen} Mensch${menschen === 1 ? "" : "en"} · 🧟 ${zz.size} Zombie${zz.size === 1 ? "" : "s"}`,
        liste: d.spieler.map((id) =>
          eintrag(id, id === d.patientNull ? "Patient Null" : zz.has(id) ? `gebissen am ${plusTage(w.start, zz.get(id)!).split("-").reverse().slice(0, 2).join(".")}.` : "Mensch"),
        ),
      };
    }
    case "bombe": {
      const traeger = bombentraeger(d, spieler);
      const letztes = (id: string) => spieler.find((sp) => sp.id === id)?.trainings.map((t) => t.datum).sort().at(-1);
      return {
        ...basis,
        regel: "Die Bombe hängt an dem, dessen letztes Training am längsten her ist. Wer sie Sonntagabend hat, fliegt in die Luft.",
        status: traeger ? `💣 Tickt gerade bei ${nm(traeger)}` : "",
        liste: [...d.spieler]
          .sort((a, b) => (letztes(a) ?? "").localeCompare(letztes(b) ?? ""))
          .map((id) => eintrag(id, letztes(id) ? `zuletzt ${letztes(id)!.split("-").reverse().slice(0, 2).join(".")}.` : "noch nie")),
      };
    }
    case "kopfgeld": {
      const k = kopfgeld(d, l);
      return {
        ...basis,
        regel: `Wer bis Sonntag mehr Wochenlast hat als ${nm(d.gejagter)}, kassiert das Kopfgeld.`,
        status: `🎯 Gesucht: ${nm(d.gejagter)} mit ${z(k.gejagterLast)} Lastpunkten`,
        liste: d.spieler
          .filter((id) => id !== d.gejagter)
          .sort((a, b) => (l.get(b) ?? 0) - (l.get(a) ?? 0))
          .map((id) => eintrag(id, `${z(l.get(id) ?? 0)}${k.jaeger.includes(id) ? " ✅ geschnappt" : ""}`)),
      };
    }
    case "gipfel": {
      const k = gipfel(d, spieler, w);
      return {
        ...basis,
        regel: `Der Gipfel ist das Wochenziel (${z(w.ziel)} Lastpunkte). Wer zuerst oben ist, wird gefeiert, wer im Basislager bleibt, ausgelacht.`,
        status: `${k.filter((x) => x.oben).length} von ${k.length} oben`,
        gipfel: k.map((x) => ({ name: nm(x.id), anteil: x.anteil, hoehe: x.hoehe, oben: x.oben !== null, ich: x.id === ich })),
        liste: k.map((x) => eintrag(x.id, x.oben ? "oben 🚩" : x.anteil < BASISLAGER_ANTEIL ? "Basislager ⛺" : `${z(x.hoehe)} m`)),
      };
    }
    case "tauziehen": {
      const s2 = seil(d, l);
      return {
        ...basis,
        regel: "Losteams, es zählt die durchschnittliche Wochenlast. Die Verlierer landen im Schlamm.",
        status: s2.zug === 0 ? "Gleichstand" : `${d.teams[s2.zug > 0 ? 0 : 1].name} zieht`,
        seil: { links: d.teams[0].name, rechts: d.teams[1].name, schnitt: s2.schnitt.map((x) => Math.round(x)), zug: s2.zug },
        liste: d.teams.flatMap((t) => t.mitglieder.map((id) => eintrag(id, `${t.name} · ${z(l.get(id) ?? 0)}`))),
      };
    }
    case "tresor": {
      const t = tresor(d, l);
      return {
        ...basis,
        regel: `Jedes Viertel von ${z(d.ziel)} Lastpunkten der ganzen Gruppe verrät eine Ziffer.`,
        status: `${z(Math.min(t.summe, d.ziel))} von ${z(d.ziel)} Lastpunkten`,
        code: codeText(d, t.ziffern),
        liste: [...d.spieler].sort((a, b) => (l.get(b) ?? 0) - (l.get(a) ?? 0)).map((id) => eintrag(id, z(l.get(id) ?? 0))),
      };
    }
    case "duell":
      return {
        ...basis,
        regel: "Jeder hat einen gelosten Gegner. Mehr Wochenlast bis Sonntag gewinnt.",
        status: "",
        liste: duelle(d, l).map((du) => {
          const f = duellFuehrender(du);
          const krone = (id: string) => (f === id ? " 👑" : "");
          return {
            name: `${nm(du.a)}${krone(du.a)} gegen ${nm(du.b)}${krone(du.b)}`,
            text: `${z(du.lastA)}:${z(du.lastB)}`,
            ich: du.a === ich || (du.b === ich && du.b !== BOT_ID),
          };
        }),
      };
  }
}
