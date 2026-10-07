import type { Db } from "../db/index.js";
import { speichereMessung, speichereTraining, sportartNachName } from "../db/repo.js";
import { plusTage, tageZwischen, zeitpunktIn } from "../scoring/datum.js";

/**
 * Demo-Modus: Fake-Teilnehmer mit festem Charakter, deren Trainings und Messungen
 * Tag für Tag erzeugt werden. Gleicher Name und Tag ergeben immer dasselbe Ergebnis.
 */
export interface Profil {
  name: string;
  /** Wahrscheinlichkeit für ein Training an einem Tag (Tag 0 = Beginn der Kalibrierwoche). */
  trainingsQuote: (tag: number) => number;
  minuten: readonly [number, number];
  sportarten: readonly string[];
  start: { gewichtKg: number; fettPct: number; muskelPct: number };
  /** Veränderung pro Tag in Prozentpunkten bzw. kg. */
  proTag: { gewichtKg: number; fettPct: number; muskelPct: number };
}

const fest = (quote: number) => () => quote;

export const FAKE_PROFILE: readonly Profil[] = [
  {
    name: "Hantel-Hans",
    trainingsQuote: fest(0.85),
    minuten: [45, 90],
    sportarten: ["Krafttraining", "Joggen", "HIIT"],
    start: { gewichtKg: 88, fettPct: 22, muskelPct: 38 },
    proTag: { gewichtKg: -0.05, fettPct: -0.06, muskelPct: 0.03 },
  },
  {
    name: "Couch-Carsten",
    trainingsQuote: fest(0.15),
    minuten: [20, 40],
    sportarten: ["Spazierengehen", "Yoga"],
    start: { gewichtKg: 104, fettPct: 31, muskelPct: 33 },
    proTag: { gewichtKg: 0.04, fettPct: 0.02, muskelPct: -0.01 },
  },
  {
    name: "Yoga-Yvonne",
    trainingsQuote: fest(0.6),
    minuten: [45, 75],
    sportarten: ["Yoga", "Pilates", "Schwimmen"],
    start: { gewichtKg: 64, fettPct: 26, muskelPct: 34 },
    proTag: { gewichtKg: -0.02, fettPct: -0.03, muskelPct: 0.01 },
  },
  {
    name: "Pumper-Paul",
    trainingsQuote: fest(0.55),
    minuten: [60, 100],
    sportarten: ["Krafttraining"],
    start: { gewichtKg: 92, fettPct: 18, muskelPct: 42 },
    proTag: { gewichtKg: 0.03, fettPct: 0, muskelPct: 0.05 },
  },
  {
    name: "Wackel-Willi",
    // Eine Woche Vollgas, eine Woche nichts
    trainingsQuote: (tag) => (Math.floor(tag / 7) % 2 === 0 ? 0.85 : 0.1),
    minuten: [30, 90],
    sportarten: ["Fußball", "Radfahren", "Squash"],
    start: { gewichtKg: 81, fettPct: 24, muskelPct: 37 },
    proTag: { gewichtKg: -0.01, fettPct: -0.02, muskelPct: 0.01 },
  },
];

/** Autopilot für echte Tester: solides Mittelfeld, damit der eigene Stand nicht leer ist. */
export function autopilotProfil(name: string): Profil {
  return {
    name,
    trainingsQuote: fest(0.5),
    minuten: [30, 70],
    sportarten: ["Joggen", "Krafttraining", "Radfahren"],
    start: { gewichtKg: 85, fettPct: 24, muskelPct: 37 },
    proTag: { gewichtKg: -0.03, fettPct: -0.04, muskelPct: 0.02 },
  };
}

/** Zufallszahlen aus einem Text (Name + Tag), damit Läufe reproduzierbar sind. */
export function zufallAus(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const runde = (x: number) => Math.round(x * 10) / 10;

export interface TagesErgebnis {
  trainings: number;
  minuten: number;
  messungen: number;
}

/**
 * Erzeugt Training und Messung eines Teilnehmers für einen Tag.
 * In der Kalibrierwoche wird jeden Tag gemessen, danach mindestens jeden zweiten Tag und sonst zufällig.
 * Ohne die feste Messung konnte ein Pechvogel eine Woche lang kaum auf die Waage, dann gibt es
 * keinen aktuellen Wert (mindestens 2 Messungen) und der Fortschritt bleibt leer.
 */
export function simuliereTag(
  db: Db,
  a: { gruppe: number; nutzer: number; profil: Profil; datum: string; kalibrierStart: string; kalibrierung: boolean; zeitzone: string },
): TagesErgebnis {
  const tag = tageZwischen(a.kalibrierStart, a.datum);
  const zufall = zufallAus(`${a.profil.name}|${a.datum}`);
  const ergebnis: TagesErgebnis = { trainings: 0, minuten: 0, messungen: 0 };

  if (!a.kalibrierung && zufall() < a.profil.trainingsQuote(tag)) {
    const [min, max] = a.profil.minuten;
    const minuten = Math.round((min + zufall() * (max - min)) / 5) * 5;
    const name = a.profil.sportarten[Math.floor(zufall() * a.profil.sportarten.length)]!;
    const sportart = sportartNachName(db, a.gruppe, name);
    if (sportart) {
      speichereTraining(db, { nutzer: a.nutzer, datum: a.datum, minuten, sportart });
      ergebnis.trainings++;
      ergebnis.minuten += minuten;
    }
  }

  if (a.kalibrierung || tag % 2 === 0 || zufall() < 0.55) {
    const rauschen = () => (zufall() - 0.5) * 0.6;
    const { start, proTag } = a.profil;
    speichereMessung(db, {
      nutzer: a.nutzer,
      zeitpunkt: zeitpunktIn(a.datum, "07:00", a.zeitzone).toISOString(),
      datum: a.datum,
      gewichtKg: runde(start.gewichtKg + proTag.gewichtKg * tag + rauschen()),
      fettPct: runde(start.fettPct + proTag.fettPct * tag + rauschen()),
      muskelPct: runde(start.muskelPct + proTag.muskelPct * tag + rauschen()),
      markiert: false,
    });
    ergebnis.messungen++;
  }
  return ergebnis;
}

/** Alle Tage von `von` bis `bis` (inklusive). */
export function tage(von: string, bis: string): string[] {
  const n = tageZwischen(von, bis);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => plusTage(von, i));
}
