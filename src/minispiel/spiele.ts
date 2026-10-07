import { type IsoDatum, plusTage } from "../scoring/datum.js";
import { type Faktor, gesamtLast } from "../scoring/fleiss.js";
import { bossWoche, STUFEN } from "../scoring/boss.js";

/**
 * Minispiele für die Wochen ohne Boss. Alles wird aus den Trainings der Woche berechnet,
 * nichts muss jemand selbst einschätzen. Es gibt Ruhm und Schande, aber keine Punkte,
 * damit die Wertung fair bleibt.
 */
export const MINISPIELE = {
  zombie: { name: "Zombie-Woche", emoji: "🧟", minSpieler: 2 },
  bombe: { name: "Tickende Bombe", emoji: "💣", minSpieler: 2 },
  kopfgeld: { name: "Kopfgeldjagd", emoji: "🎯", minSpieler: 2 },
  gipfel: { name: "Gipfelsturm", emoji: "🏔", minSpieler: 1 },
  tauziehen: { name: "Tauziehen", emoji: "🪢", minSpieler: 2 },
  tresor: { name: "Tresor knacken", emoji: "🔐", minSpieler: 1 },
  duell: { name: "Losduell", emoji: "⚔️", minSpieler: 2 },
} as const;

export type MinispielArt = keyof typeof MINISPIELE;
export const MINISPIEL_ARTEN = Object.keys(MINISPIELE) as MinispielArt[];

/** Minispiele gibt es wie Bosse erst ab dieser Season-Länge. */
export const MINISPIEL_MIN_WOCHEN = 4;
/** Ankündigung am ersten Tag der Woche, Lagemeldungen an den Tagen danach, jeweils um diese Uhrzeit. */
export const MINISPIEL_UHRZEIT = "09:00";
/** Höhe des Gipfels, den man mit genau dem Wochenziel erreicht. */
export const GIPFEL_M = 8848;
/** Unter diesem Anteil am Wochenziel hockt man noch im Basislager. */
export const BASISLAGER_ANTEIL = 0.25;
/** Der Tresor braucht so viel Last wie dieser Anteil am Wochenziel aller Spieler. */
export const TRESOR_FAKTOR = 0.8;
/** Wer keinen Gegner abbekommt, duelliert sich mit dem Bot, der genau das Wochenziel schafft. */
export const BOT_ID = "bot";
export const BOT_NAME = "Botzeps";

/**
 * 0-basierte Wochen mit Minispiel: alle außer der ersten (da geht's erst los) und den Boss-Wochen.
 * Bei 10 Wochen sind das genau sieben, also jedes Spiel einmal.
 */
export function minispielWochen(wochen: number): number[] {
  if (wochen < MINISPIEL_MIN_WOCHEN) return [];
  const boss = new Set(STUFEN.map((st) => bossWoche(st, wochen)));
  return Array.from({ length: wochen }, (_, w) => w).filter((w) => w > 0 && !boss.has(w));
}

/**
 * Welches Spiel als nächstes dran ist: eins, das es in der Season noch nicht gab,
 * sonst irgendeins außer dem von letzter Woche. Spiele, für die zu wenige mitmachen, fallen raus.
 */
export function waehleArt(bisher: readonly MinispielArt[], spieler: number, zufall: () => number = Math.random): MinispielArt {
  const moeglich = MINISPIEL_ARTEN.filter((a) => MINISPIELE[a].minSpieler <= spieler);
  const neu = moeglich.filter((a) => !bisher.includes(a));
  const auswahl = neu.length ? neu : moeglich.filter((a) => a !== bisher.at(-1));
  const liste = auswahl.length ? auswahl : moeglich;
  return liste[Math.floor(zufall() * liste.length)] ?? "gipfel";
}

export interface SpielTeam {
  name: string;
  mitglieder: string[];
}

interface Basis {
  /** ids der Spieler, festgelegt bei der Ankündigung; wer später einsteigt, schaut zu */
  spieler: string[];
}

export type MinispielDaten = Basis &
  (
    | { art: "zombie"; patientNull: string; gemeldet: string[] }
    | { art: "bombe" }
    | { art: "kopfgeld"; gejagter: string }
    | { art: "gipfel" }
    | { art: "tauziehen"; teams: [SpielTeam, SpielTeam] }
    | { art: "tresor"; code: number[]; ziel: number }
    | { art: "duell"; paare: [string, string][] }
  );

export type DatenVon<A extends MinispielArt> = Extract<MinispielDaten, { art: A }>;

export interface SpielTraining {
  id: number;
  datum: IsoDatum;
  minuten: number;
  faktor: Faktor;
  /** Zeitpunkt des Eintrags, entscheidet bei Gleichstand am selben Tag */
  erstellt: string;
}

export interface Spieler {
  id: string;
  name: string;
  /** Trainings der Season bis jetzt; die Woche filtern die Spiele selbst */
  trainings: readonly SpielTraining[];
}

/** Die Woche, um die es geht: erster Tag und Wochenziel pro Kopf. */
export interface SpielWoche {
  start: IsoDatum;
  ziel: number;
}

const TEAMNAMEN: readonly [string, string][] = [
  ["Team Eisen", "Team Speck"],
  ["Die Hantelhelden", "Die Couchpotatoes"],
  ["Die Muckibuden-Mafia", "Der Döner-Clan"],
  ["Team Protein", "Team Pizza"],
];

function mische<T>(liste: readonly T[], zufall: () => number): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Legt bei der Ankündigung alles fest, was das Spiel braucht: Patient Null, den Gejagten,
 * Losteams, den Code des Tresors oder die Duellpaare.
 */
export function stelleAuf(
  art: MinispielArt,
  spieler: readonly { id: string }[],
  kontext: { ziel: number; fuehrender?: string | null },
  zufall: () => number = Math.random,
): MinispielDaten {
  const ids = spieler.map((sp) => sp.id);
  const gemischt = mische(ids, zufall);
  switch (art) {
    case "zombie":
      return { art, spieler: ids, patientNull: gemischt[0]!, gemeldet: [] };
    case "bombe":
      return { art, spieler: ids };
    case "kopfgeld": {
      const gejagter = kontext.fuehrender && ids.includes(kontext.fuehrender) ? kontext.fuehrender : gemischt[0]!;
      return { art, spieler: ids, gejagter };
    }
    case "gipfel":
      return { art, spieler: ids };
    case "tauziehen": {
      const [a, b] = TEAMNAMEN[Math.floor(zufall() * TEAMNAMEN.length)]!;
      const haelfte = Math.ceil(gemischt.length / 2);
      return {
        art,
        spieler: ids,
        teams: [
          { name: a, mitglieder: gemischt.slice(0, haelfte) },
          { name: b, mitglieder: gemischt.slice(haelfte) },
        ],
      };
    }
    case "tresor": {
      const roh = ids.length * kontext.ziel * TRESOR_FAKTOR;
      const code = Array.from({ length: 4 }, () => Math.floor(zufall() * 10));
      return { art, spieler: ids, code, ziel: Math.max(50, Math.round(roh / 50) * 50) };
    }
    case "duell": {
      const paare: [string, string][] = [];
      for (let i = 0; i < gemischt.length; i += 2) paare.push([gemischt[i]!, gemischt[i + 1] ?? BOT_ID]);
      return { art, spieler: ids, paare };
    }
  }
}

/** Trainings eines Spielers in der Woche. */
export function trainingsDerWoche(sp: Spieler, w: SpielWoche): SpielTraining[] {
  const ende = plusTage(w.start, 6);
  return sp.trainings.filter((t) => t.datum >= w.start && t.datum <= ende);
}

/** Wochenlast aller, die mitspielen; der Bot schafft im Duell genau das Wochenziel. */
export function lasten(d: MinispielDaten, spieler: readonly Spieler[], w: SpielWoche): Map<string, number> {
  const m = new Map<string, number>(d.spieler.map((id) => [id, 0]));
  for (const sp of spieler) if (m.has(sp.id)) m.set(sp.id, gesamtLast(trainingsDerWoche(sp, w)));
  m.set(BOT_ID, w.ziel);
  return m;
}

// ---------- Zombie-Woche ----------

/**
 * Wer zwei Tage am Stück nicht trainiert, wird gebissen und bleibt Zombie. Patient Null ist es von Anfang an.
 * `fertigeTage` sind die Tage der Woche, die schon vorbei sind (0 bis 7). Ergebnis: id → Tag des Bisses.
 */
export function zombies(d: DatenVon<"zombie">, spieler: readonly Spieler[], w: SpielWoche, fertigeTage: number): Map<string, number> {
  const ergebnis = new Map<string, number>([[d.patientNull, 0]]);
  for (const sp of spieler) {
    if (!d.spieler.includes(sp.id) || sp.id === d.patientNull) continue;
    const tage = new Set(trainingsDerWoche(sp, w).map((t) => t.datum));
    for (let k = 1; k < fertigeTage; k++) {
      if (!tage.has(plusTage(w.start, k - 1)) && !tage.has(plusTage(w.start, k))) {
        ergebnis.set(sp.id, k);
        break;
      }
    }
  }
  return ergebnis;
}

// ---------- Tickende Bombe ----------

/**
 * Die Bombe hängt an dem, dessen letztes Training am längsten her ist; bei gleichem Tag an dem,
 * der früher eingetragen hat. Wer noch nie trainiert hat, hat sie sowieso.
 */
export function bombentraeger(d: DatenVon<"bombe">, spieler: readonly Spieler[]): string | null {
  const kandidaten = spieler
    .filter((sp) => d.spieler.includes(sp.id))
    .map((sp) => {
      const letztes = [...sp.trainings].sort((a, b) => b.datum.localeCompare(a.datum) || b.erstellt.localeCompare(a.erstellt))[0];
      return { id: sp.id, name: sp.name, schluessel: letztes ? `${letztes.datum} ${letztes.erstellt}` : "" };
    })
    .sort((a, b) => a.schluessel.localeCompare(b.schluessel) || a.name.localeCompare(b.name));
  return kandidaten[0]?.id ?? null;
}

// ---------- Kopfgeldjagd ----------

/** Alle, die mehr Wochenlast haben als der Gejagte, haben ihn geschnappt. */
export function kopfgeld(d: DatenVon<"kopfgeld">, l: ReadonlyMap<string, number>): { gejagterLast: number; jaeger: string[] } {
  const gejagterLast = l.get(d.gejagter) ?? 0;
  return { gejagterLast, jaeger: d.spieler.filter((id) => id !== d.gejagter && (l.get(id) ?? 0) > gejagterLast) };
}

// ---------- Gipfelsturm ----------

export interface Kletterer {
  id: string;
  last: number;
  /** 0 bis 1, 1 heißt oben */
  anteil: number;
  hoehe: number;
  /** Zeitpunkt des Eintrags, mit dem er oben ankam */
  oben: string | null;
}

/** Wie hoch jeder ist; wer oben ist, zuerst, in der Reihenfolge der Ankunft. */
export function gipfel(d: DatenVon<"gipfel">, spieler: readonly Spieler[], w: SpielWoche): Kletterer[] {
  const ziel = Math.max(1, w.ziel);
  return spieler
    .filter((sp) => d.spieler.includes(sp.id))
    .map((sp): Kletterer => {
      const liste = trainingsDerWoche(sp, w).sort((a, b) => a.erstellt.localeCompare(b.erstellt));
      let oben: string | null = null;
      for (let i = 0; i < liste.length && oben === null; i++) {
        if (gesamtLast(liste.slice(0, i + 1)) >= ziel) oben = liste[i]!.erstellt;
      }
      const last = gesamtLast(liste);
      const anteil = Math.min(1, last / ziel);
      return { id: sp.id, last, anteil, hoehe: Math.round((anteil * GIPFEL_M) / 10) * 10, oben };
    })
    .sort((a, b) => (a.oben && b.oben ? a.oben.localeCompare(b.oben) : a.oben ? -1 : b.oben ? 1 : b.anteil - a.anteil));
}

// ---------- Tauziehen ----------

/** Durchschnittliche Wochenlast je Team; `zug` von −1 (Team 2 gewinnt klar) bis +1 (Team 1). */
export function seil(d: DatenVon<"tauziehen">, l: ReadonlyMap<string, number>): { schnitt: [number, number]; zug: number } {
  const schnitt = d.teams.map((t) => (t.mitglieder.length ? t.mitglieder.reduce((s, id) => s + (l.get(id) ?? 0), 0) / t.mitglieder.length : 0)) as [
    number,
    number,
  ];
  const summe = schnitt[0] + schnitt[1];
  return { schnitt, zug: summe > 0 ? (schnitt[0] - schnitt[1]) / summe : 0 };
}

/** Das Seil als Textzeile, der Knoten wandert zum stärkeren Team. */
export function seilZeile(d: DatenVon<"tauziehen">, zug: number, breite = 11): string {
  const mitte = Math.floor(breite / 2);
  const pos = Math.max(0, Math.min(breite - 1, Math.round(mitte - zug * mitte)));
  const seilText = Array.from({ length: breite }, (_, i) => (i === pos ? "🔴" : "━")).join("");
  return `${d.teams[0].name} ${seilText} ${d.teams[1].name}`;
}

// ---------- Tresor ----------

/** Wie viel die Gruppe schon draufhat und wie viele der vier Ziffern geknackt sind. */
export function tresor(d: DatenVon<"tresor">, l: ReadonlyMap<string, number>): { summe: number; ziffern: number; offen: boolean } {
  const summe = d.spieler.reduce((s, id) => s + (l.get(id) ?? 0), 0);
  const ziffern = Math.min(d.code.length, Math.floor((summe / d.ziel) * d.code.length));
  return { summe, ziffern, offen: ziffern >= d.code.length };
}

/** Der Code, soweit geknackt, z. B. "7 3 _ _". */
export function codeText(d: DatenVon<"tresor">, ziffern: number): string {
  return d.code.map((c, i) => (i < ziffern ? String(c) : "_")).join(" ");
}

// ---------- Losduell ----------

export interface Duell {
  a: string;
  b: string;
  lastA: number;
  lastB: number;
}

export function duelle(d: DatenVon<"duell">, l: ReadonlyMap<string, number>): Duell[] {
  return d.paare.map(([a, b]) => ({ a, b, lastA: l.get(a) ?? 0, lastB: l.get(b) ?? 0 }));
}

/** Wer im Duell vorne liegt, oder null bei Gleichstand. */
export function duellFuehrender(du: Duell): string | null {
  return du.lastA === du.lastB ? null : du.lastA > du.lastB ? du.a : du.b;
}
