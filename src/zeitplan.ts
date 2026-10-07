import type { Db } from "./db/index.js";
import { type SeasonZeile, bosseDerSeason, einstellungen, kuendigeBossAn, seasonNachId } from "./db/season-repo.js";
import { alleTrainings, vergebeErfolge } from "./db/erfolg-repo.js";
import { BOSS_ANKUENDIGUNG, BOSS_NAMEN, BOSS_STUFEN, type BossStufe, STUFEN, bossAnzeigename, bossKampf, bossLebenspunkte, bossWoche } from "./scoring/boss.js";
import { type ErfolgArt, finaleErfolge, trainingsErfolge, wochenErfolge } from "./scoring/erfolge.js";
import { fuelle, waehleSpruch } from "./texte/sprueche.js";
import { gruppeNachId } from "./db/repo.js";
import { berechneStand, berechneTeams } from "./bericht/stand.js";
import { diagrammPng, gruppenDiagramm, punkteverlauf } from "./bericht/punkteverlauf.js";
import { type Extras, type Vorwoche, finale, wochenbericht } from "./bericht/texte.js";
import { lokalesDatum, plusTage, tageZwischen, zeitpunktIn } from "./scoring/datum.js";
import { FORTSCHRITT } from "./scoring/fortschritt.js";
import { kalibrierFenster, roteLaterne, seasonEnde } from "./scoring/season.js";
import { laternen } from "./db/laterne-repo.js";
import type { LaterneTraeger } from "./bericht/texte.js";
import { log } from "./log.js";
import { abgelaufeneAbstimmungen, beendeAbstimmung } from "./db/abstimmung-repo.js";
import { setzeGruppenNachricht } from "./db/repo.js";
import { ABSTIMMUNG_STUNDEN, ergebnisText } from "./bot/abstimmung.js";
import { trainingsPostText } from "./bot/sport.js";
import { meldungenNachTraining, mitMeldungen } from "./bericht/nach-training.js";

/**
 * Berichte und Erinnerungen als fällige Termine in der Datenbank (Konzept 9):
 * `plane` legt sie idempotent an, `fuehreAus` erledigt fällige genau einmal.
 * Nach einem Neustart wird Verpasstes nachgeholt, Erinnerungen aber nur bis 2 Stunden zu spät.
 */

/** Sendet eine Nachricht (auf Wunsch mit Knopf zur Mini App) und gibt, wenn bekannt, ihre message_id zurück. */
export type Sender = (chatId: number, text: string, optionen?: { appKnopf?: boolean }) => Promise<number | void>;
/** Sendet ein PNG als Foto. */
export type FotoSender = (chatId: number, png: Uint8Array) => Promise<unknown>;

const ERINNERUNG_VERFALL_MS = 2 * 60 * 60 * 1000;
export const ERINNERUNG = { tageOhneTraining: 3, tageOhneMessung: 4 } as const;

interface TerminZeile {
  id: number;
  art: "wochenbericht" | "finale" | "erinnerung" | "boss1" | "boss2";
  season: number | null;
  nutzer: number | null;
  faellig_am: string;
}

/** Fälligkeit des Berichts zu Woche `woche` (letzter Tag der Woche, Berichtszeit). */
export function berichtsZeitpunkt(s: SeasonZeile, woche: number, zeitzone: string): Date {
  return zeitpunktIn(plusTage(s.start, woche * 7 + 6), s.berichtszeit, zeitzone);
}

/** Ankündigung des Bosses einer Stufe am ersten Tag seiner Woche, oder null ohne Boss. */
export function bossZeitpunkt(s: SeasonZeile, stufe: BossStufe, zeitzone: string): Date | null {
  const woche = bossWoche(stufe, s.wochen);
  return woche === null ? null : zeitpunktIn(plusTage(s.start, woche * 7), BOSS_ANKUENDIGUNG, zeitzone);
}

export function plane(db: Db, jetzt: Date, zeitzone: string): void {
  const heute = lokalesDatum(jetzt, zeitzone);
  const neu = db.prepare("INSERT OR IGNORE INTO termin (art, season, nutzer, faellig_am) VALUES (?, ?, ?, ?)");
  const seasons = db.prepare("SELECT id FROM season").all() as { id: number }[];
  db.transaction(() => {
    for (const { id } of seasons) {
      const s = seasonNachId(db, id)!;
      const ende = seasonEnde(s);
      if (ende < plusTage(heute, -7)) continue;
      for (let w = 0; w < s.wochen; w++) {
        const art = w === s.wochen - 1 ? "finale" : "wochenbericht";
        neu.run(art, s.id, null, berichtsZeitpunkt(s, w, zeitzone).toISOString());
      }
      for (const stufe of STUFEN) {
        const zeitpunkt = bossZeitpunkt(s, stufe, zeitzone);
        if (zeitpunkt) neu.run(`boss${stufe}`, s.id, null, zeitpunkt.toISOString());
      }
      if (heute < plusTage(s.start, -7) || heute > ende) continue;
      const teilnehmer = db
        .prepare(
          `SELECT n.id, n.zeitzone, n.erinnerung_uhrzeit FROM teilnahme t JOIN nutzer n ON n.id = t.nutzer
           WHERE t.season = ? AND n.erinnerungen = 1`,
        )
        .all(s.id) as { id: number; zeitzone: string; erinnerung_uhrzeit: string }[];
      for (const t of teilnehmer) {
        const tag = lokalesDatum(jetzt, t.zeitzone);
        neu.run("erinnerung", s.id, t.id, zeitpunktIn(tag, t.erinnerung_uhrzeit, t.zeitzone).toISOString());
      }
    }
  })();
}

export async function fuehreAus(db: Db, senden: Sender, jetzt: Date, zeitzone: string, foto?: FotoSender): Promise<number> {
  const faellig = db
    .prepare("SELECT id, art, season, nutzer, faellig_am FROM termin WHERE erledigt_am IS NULL AND faellig_am <= ? ORDER BY faellig_am, id")
    .all(jetzt.toISOString()) as TerminZeile[];
  const erledige = db.prepare("UPDATE termin SET erledigt_am = ? WHERE id = ? AND erledigt_am IS NULL");
  let ausgefuehrt = 0;
  for (const t of faellig) {
    // Erst als erledigt markieren: lieber einmal verpasst als doppelt gesendet
    if (erledige.run(jetzt.toISOString(), t.id).changes === 0) continue;
    try {
      const gesendet =
        t.art === "erinnerung"
          ? await erinnere(db, senden, t, jetzt)
          : t.art === "boss1" || t.art === "boss2"
            ? await kuendigeAn(db, senden, t, t.art === "boss1" ? 1 : 2, zeitzone)
            : await berichte(db, senden, t, zeitzone, foto);
      if (gesendet) ausgefuehrt++;
    } catch (err) {
      log.error(`Termin ${t.id} (${t.art}) fehlgeschlagen`, err);
    }
  }
  return ausgefuehrt;
}

async function berichte(db: Db, senden: Sender, t: TerminZeile, zeitzone: string, foto?: FotoSender): Promise<boolean> {
  const s = t.season === null ? undefined : seasonNachId(db, t.season);
  const gruppe = s ? gruppeNachId(db, s.gruppe) : undefined;
  if (!s || !gruppe) return false;
  // Woche aus dem Termin ableiten; passt er nicht mehr zur Season (Start oder Dauer geändert), verfällt er
  const woche = Math.floor(tageZwischen(s.start, lokalesDatum(new Date(t.faellig_am), zeitzone)) / 7);
  const art = woche === s.wochen - 1 ? "finale" : "wochenbericht";
  if (woche < 0 || woche >= s.wochen || art !== t.art || berichtsZeitpunkt(s, woche, zeitzone).toISOString() !== t.faellig_am) {
    return false;
  }
  const stichtag = plusTage(s.start, woche * 7 + 6);
  const staende = berechneStand(db, s, stichtag);
  const teams = berechneTeams(db, s, staende);
  const vorwoche = new Map(
    (
      db.prepare("SELECT nutzer, platz, spruch FROM wochenstand WHERE season = ? AND woche = ?").all(s.id, woche - 1) as {
        nutzer: number;
        platz: number;
        spruch: string | null;
      }[]
    ).map((z): [string, Vorwoche] => [String(z.nutzer), { platz: z.platz, vorlage: z.spruch }]),
  );

  const kaempfe = bosseDerSeason(db, s)
    .filter((b) => b.woche <= woche)
    .map((b) => ({ name: bossAnzeigename(b.name, b.stufe), kampf: bossKampf(b, staende) }));
  const bossSieger = new Set(kaempfe.filter((k) => k.kampf.besiegt).flatMap((k) => k.kampf.beteiligte));
  // Erfolge werden hier nur noch nachgetragen (z. B. nach geänderten Trainings);
  // gemeldet werden sie beim Trainingspost, im Bericht nur noch im Finale
  const erfolge = neueErfolge(db, s, staende, bossSieger, stichtag, art === "finale");

  // Rote Laterne dieser Woche; der Zähler kommt aus den früheren Berichten
  const bisher = laternen(db, s, woche);
  const wochenLast = (st: (typeof staende)[number]) => st.wochen[woche]?.last ?? 0;
  const laterne: LaterneTraeger[] = roteLaterne(
    s.start,
    woche,
    staende.map((st) => ({ id: st.id, beitritt: st.beitritt, last: wochenLast(st) })),
  ).map((id) => {
    const st = staende.find((x) => x.id === id)!;
    return { id, name: st.name, last: wochenLast(st), anzahl: (bisher.anzahl.get(id) ?? 0) + 1 };
  });

  let text: string;
  const vorlagen = new Map<string, string>();
  if (art === "finale") {
    const anzahl = new Map(bisher.anzahl);
    for (const t of laterne) anzahl.set(t.id, t.anzahl);
    const meiste = Math.max(0, ...anzahl.values());
    const koenig = { namen: staende.filter((st) => anzahl.get(st.id) === meiste).map((st) => st.name), anzahl: meiste };
    const ergebnis = finale(s, staende, extras(db, s), teams, Math.random, erfolge, { woche: laterne, koenig });
    text = ergebnis.text;
    const preis = db.prepare("INSERT OR IGNORE INTO auszeichnung (season, nutzer, art) VALUES (?, ?, ?)");
    for (const p of ergebnis.preise) for (const id of p.gewinner) preis.run(s.id, Number(id), p.art);
  } else {
    const bericht = wochenbericht({ name: s.name, wochen: s.wochen, wochenzielLast: s.wochenziel_last }, woche, staende, vorwoche, teams, Math.random, {
      bosse: kaempfe.filter((k) => k.kampf.woche === woche),
      laterne,
    });
    text = bericht.text;
    for (const z of bericht.sprueche) vorlagen.set(z.id, z.vorlage);
  }

  const speichere = db.prepare(
    `INSERT OR REPLACE INTO wochenstand (season, nutzer, woche, last, fleisspunkte, fortschrittspunkte, gesamt, platz, spruch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const st of staende) {
    speichere.run(
      s.id,
      Number(st.id),
      woche,
      st.wochen[woche]?.last ?? 0,
      st.fleiss,
      st.fortschritt?.punkte ?? null,
      st.gesamt,
      st.platz,
      vorlagen.get(st.id) ?? null,
    );
  }
  await senden(gruppe.telegram_chat_id, text, { appKnopf: true });
  if (foto) {
    // Ein fehlendes Diagramm soll den Bericht nicht als fehlgeschlagen markieren
    try {
      const verlauf = punkteverlauf(db, s, stichtag);
      if (verlauf) await foto(gruppe.telegram_chat_id, diagrammPng(gruppenDiagramm(s, verlauf)));
    } catch (err) {
      log.error(`Diagramm zum Bericht ${t.id} fehlgeschlagen`, err);
    }
  }
  return true;
}

/** Boss-Ankündigung in der Gruppe; legt Name und Lebenspunkte fest. */
async function kuendigeAn(db: Db, senden: Sender, t: TerminZeile, stufe: BossStufe, zeitzone: string): Promise<boolean> {
  const s = t.season === null ? undefined : seasonNachId(db, t.season);
  const gruppe = s ? gruppeNachId(db, s.gruppe) : undefined;
  // Termin verfällt, wenn Start oder Dauer der Season inzwischen geändert wurden
  if (!s || !gruppe || bossZeitpunkt(s, stufe, zeitzone)?.toISOString() !== t.faellig_am) return false;
  const teilnehmer = (db.prepare("SELECT COUNT(*) AS n FROM teilnahme WHERE season = ?").get(s.id) as { n: number }).n;
  if (teilnehmer === 0) return false;
  const frueher = bosseDerSeason(db, s).find((b) => b.stufe === 1);
  const name = frueher?.name ?? BOSS_NAMEN[Math.floor(Math.random() * BOSS_NAMEN.length)]!;
  const lebenspunkte = bossLebenspunkte(stufe, teilnehmer, s.wochenziel_last);
  if (!kuendigeBossAn(db, s.id, stufe, name, lebenspunkte)) return false;
  await senden(gruppe.telegram_chat_id, bossAnkuendigung(stufe, name, lebenspunkte, frueher !== undefined));
  return true;
}

export function bossAnkuendigung(stufe: BossStufe, name: string, lebenspunkte: number, kamSchonMal: boolean): string {
  const anzeige = bossAnzeigename(name, stufe);
  const kopf =
    stufe === 1
      ? "🐉 BOSS-WOCHE!"
      : kamSchonMal
        ? `🐉💉 ${name.toUpperCase()} IST ZURÜCK, UND ER HAT GEPUMPT!`
        : "🐉💉 BOSS-WOCHE, AUFGEPUMPT!";
  return [
    kopf,
    fuelle(waehleSpruch("boss_start"), { boss: anzeige }),
    "",
    `${anzeige} hat ${lebenspunkte.toLocaleString("de-DE")} Lebenspunkte. Jeder Lastpunkt, den ihr bis Sonntag trainiert, ist ein Schlag in die Fresse.`,
    `Fällt er, kassiert jeder, der mitgeprügelt hat, +${BOSS_STUFEN[stufe].bonus} Punkte. Wer nichts tut, wird namentlich erwähnt.`,
  ].join("\n");
}

/** Prüft Erfolge aller Teilnehmer und gibt die neuen als Zeilen für den Bericht zurück. */
function neueErfolge(
  db: Db,
  s: SeasonZeile,
  staende: readonly { id: string; name: string; wochen: Parameters<typeof wochenErfolge>[0]; platz: number }[],
  bossSieger: ReadonlySet<string>,
  tag: string,
  istFinale: boolean,
): { name: string; arten: ErfolgArt[] }[] {
  return staende
    .map((st) => {
      const arten: ErfolgArt[] = [
        ...trainingsErfolge(alleTrainings(db, Number(st.id))),
        ...wochenErfolge(st.wochen, s.wochenziel_last),
        ...(bossSieger.has(st.id) ? (["bossbezwinger"] as const) : []),
        ...(istFinale ? finaleErfolge(st.platz) : []),
      ];
      return { name: st.name, arten: vergebeErfolge(db, Number(st.id), arten, tag) };
    })
    .filter((e) => e.arten.length > 0);
}

function extras(db: Db, s: SeasonZeile): Map<string, Extras> {
  const ende = seasonEnde(s);
  const zeilen = db
    .prepare(
      `SELECT t.nutzer, t.beitritt,
         (SELECT COALESCE(SUM(minuten), 0) FROM training WHERE nutzer = t.nutzer AND geloescht_am IS NULL
            AND datum BETWEEN ? AND ? AND datum >= t.beitritt) AS minuten,
         (SELECT COUNT(DISTINCT sportart) FROM training WHERE nutzer = t.nutzer AND geloescht_am IS NULL
            AND datum BETWEEN ? AND ? AND datum >= t.beitritt) AS sportarten
       FROM teilnahme t WHERE t.season = ?`,
    )
    .all(s.start, ende, s.start, ende, s.id) as { nutzer: number; beitritt: string; minuten: number; sportarten: number }[];
  const messungen = db.prepare(
    "SELECT COUNT(*) AS n FROM messung WHERE nutzer = ? AND geloescht_am IS NULL AND datum BETWEEN ? AND ?",
  );
  return new Map(
    zeilen.map((z) => {
      const fenster = kalibrierFenster(s, z.beitritt);
      return [
        String(z.nutzer),
        {
          minuten: z.minuten,
          sportarten: z.sportarten,
          messungen: (messungen.get(z.nutzer, fenster.von, ende) as { n: number }).n,
        },
      ];
    }),
  );
}

async function erinnere(db: Db, senden: Sender, t: TerminZeile, jetzt: Date): Promise<boolean> {
  if (jetzt.getTime() - Date.parse(t.faellig_am) > ERINNERUNG_VERFALL_MS) return false;
  const s = t.season === null ? undefined : seasonNachId(db, t.season);
  const nutzer = db
    .prepare(
      `SELECT n.telegram_id, n.name, n.zeitzone, n.erinnerungen, tn.beitritt FROM nutzer n
       JOIN teilnahme tn ON tn.nutzer = n.id AND tn.season = ? WHERE n.id = ?`,
    )
    .get(t.season, t.nutzer) as
    | { telegram_id: number; name: string; zeitzone: string; erinnerungen: number; beitritt: string }
    | undefined;
  if (!s || !nutzer || !nutzer.erinnerungen) return false;
  const text = erinnerungsText(db, s, t.nutzer!, nutzer, lokalesDatum(jetzt, nutzer.zeitzone));
  if (!text) return false;
  await senden(nutzer.telegram_id, text);
  return true;
}

/** Text der täglichen Erinnerung, oder null, wenn es nichts zu meckern gibt. */
export function erinnerungsText(
  db: Db,
  s: SeasonZeile,
  nutzerId: number,
  nutzer: { name: string; beitritt: string },
  heute: string,
): string | null {
  const fenster = kalibrierFenster(s, nutzer.beitritt);
  const zaehle = (von: string, bis: string) =>
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM messung WHERE nutzer = ? AND geloescht_am IS NULL AND datum BETWEEN ? AND ?")
        .get(nutzerId, von, bis) as { n: number }
    ).n;
  const letztes = (tabelle: "training" | "messung") =>
    (
      db.prepare(`SELECT MAX(datum) AS d FROM ${tabelle} WHERE nutzer = ? AND geloescht_am IS NULL AND datum <= ?`).get(nutzerId, heute) as {
        d: string | null;
      }
    ).d;

  if (heute >= fenster.von && heute <= fenster.bis) {
    const fehlen = FORTSCHRITT.minMessungenKalibrierung - zaehle(fenster.von, fenster.bis);
    if (fehlen <= 0) return null;
    return `${nutzer.name}, Kalibrierwoche! Dir fehlen noch ${fehlen} Messung${fehlen === 1 ? "" : "en"} bis ${fenster.bis.split("-").reverse().join(".")}. Ohne Startwert keine Fortschrittspunkte. /waage`;
  }
  if (heute < s.start || heute > seasonEnde(s)) return null;

  const meckern: string[] = [];
  const training = letztes("training");
  const seitTraining = training ? tageZwischen(training, heute) : Infinity;
  if (seitTraining >= ERINNERUNG.tageOhneTraining && tageZwischen(nutzer.beitritt > s.start ? nutzer.beitritt : s.start, heute) >= ERINNERUNG.tageOhneTraining) {
    meckern.push(
      training
        ? `Seit ${seitTraining} Tagen kein Training. Die Couch hat schon deine Körperform angenommen. /sport`
        : "Noch kein einziges Training in dieser Season. Wird Zeit. /sport",
    );
  }
  const messung = letztes("messung");
  const seitMessung = messung ? tageZwischen(messung, heute) : Infinity;
  if (heute > fenster.bis && seitMessung >= ERINNERUNG.tageOhneMessung) {
    meckern.push(`Seit ${messung ? `${seitMessung} Tagen` : "Ewigkeiten"} nicht auf der Waage. Angst vor der Wahrheit? /waage`);
  }
  if (meckern.length === 0) return null;
  return `${nutzer.name}, kurze Ansage:\n${meckern.map((m) => `• ${m}`).join("\n")}\n\nKeine Lust auf Erinnerungen? /erinnerungen aus`;
}

/** Beendet Abstimmungen über neue Sportarten, die länger als 24 Stunden offen sind. */
export async function beendeAbgelaufeneAbstimmungen(db: Db, senden: Sender, jetzt: Date, zeitzone = "Europe/Berlin"): Promise<void> {
  const grenze = new Date(jetzt.getTime() - ABSTIMMUNG_STUNDEN * 60 * 60 * 1000).toISOString();
  for (const a of abgelaufeneAbstimmungen(db, grenze)) {
    const e = beendeAbstimmung(db, a.id, jetzt.toISOString());
    if (!e) continue;
    try {
      await senden(e.gruppeChat, `${ergebnisText(e)} (Abstimmung nach ${ABSTIMMUNG_STUNDEN} Stunden beendet)`);
      if (e.training) {
        const text = trainingsPostText(e.training.nutzerName, e.training.minuten, e.sportart.name);
        const meldungen = meldungenNachTraining(db, e.training.id, lokalesDatum(jetzt, zeitzone));
        const id = await senden(e.gruppeChat, mitMeldungen(text, meldungen));
        if (id) setzeGruppenNachricht(db, e.training.id, id);
      }
    } catch (err) {
      log.error(`Ergebnis der Abstimmung ${a.id} nicht gesendet`, err);
    }
  }
}

/** Ein Durchlauf: Termine planen, Fälliges ausführen, abgelaufene Abstimmungen beenden. */
export async function zeitplanLauf(db: Db, senden: Sender, foto: FotoSender, jetzt: Date, zeitzone: string): Promise<void> {
  plane(db, jetzt, zeitzone);
  await fuehreAus(db, senden, jetzt, zeitzone, foto);
  await beendeAbgelaufeneAbstimmungen(db, senden, jetzt, zeitzone);
}

/** Startet die Zeitplanung; gibt eine Funktion zum Anhalten zurück. */
export function starteZeitplan(
  db: Db,
  senden: Sender,
  foto: FotoSender,
  zeitzone: string,
  intervallMs = 60_000,
  uhr: () => Date = () => new Date(),
): () => void {
  let laeuft = false;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      await zeitplanLauf(db, senden, foto, uhr(), zeitzone);
    } catch (err) {
      log.error("Zeitplan-Durchlauf fehlgeschlagen", err);
    } finally {
      laeuft = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervallMs);
  return () => clearInterval(timer);
}
