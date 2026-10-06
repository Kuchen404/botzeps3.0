import type { Db } from "../db/index.js";
import { type SeasonZeile, bosseDerSeason, einstellungen, ladeTeilnehmer } from "../db/season-repo.js";
import { type Liniendiagramm, alsPng, liniendiagramm } from "../diagramm/index.js";
import { plusTage } from "../scoring/datum.js";
import { type TeilnehmerStand, seasonEnde, seasonStand } from "../scoring/season.js";

export interface Punkteverlauf {
  /** "Start", "W1", "W2", … */
  x: string[];
  /** Stand je x-Punkt, beim Start leer (alle 0). */
  staende: TeilnehmerStand[][];
  /** Stand am letzten Punkt in Ranglistenfolge. */
  ende: TeilnehmerStand[];
  telegramIds: ReadonlyMap<string, number>;
}

/** Punkte am Ende jeder Season-Woche bis `bisTag`; die laufende Woche zählt mit dem Stand von `bisTag`. */
export function punkteverlauf(db: Db, s: SeasonZeile, bisTag: string): Punkteverlauf | null {
  if (bisTag < s.start) return null;
  const teilnehmer = ladeTeilnehmer(db, s);
  if (teilnehmer.length === 0) return null;
  const e = einstellungen(s, bosseDerSeason(db, s));
  const bis = bisTag < seasonEnde(s) ? bisTag : seasonEnde(s);
  const x = ["Start"];
  const staende: TeilnehmerStand[][] = [[]];
  for (let w = 0; w < s.wochen; w++) {
    const wochenende = plusTage(s.start, w * 7 + 6);
    const stichtag = wochenende < bis ? wochenende : bis;
    x.push(`W${w + 1}`);
    staende.push(seasonStand(e, teilnehmer, stichtag));
    if (stichtag === bis) break;
  }
  return {
    x,
    staende,
    ende: staende.at(-1)!,
    telegramIds: new Map(teilnehmer.map((t) => [t.id, t.telegramId])),
  };
}

function wert(staende: readonly TeilnehmerStand[], id: string, f: (st: TeilnehmerStand) => number): number {
  const st = staende.find((x) => x.id === id);
  return st ? Math.round(f(st) * 10) / 10 : 0;
}

/** Gesamtpunkte aller Teilnehmer, Legende in Ranglistenfolge. */
export function gruppenDiagramm(s: SeasonZeile, v: Punkteverlauf): Liniendiagramm {
  return {
    titel: `Punkteverlauf „${s.name}“`,
    x: v.x,
    reihen: v.ende.map((st) => ({
      name: `${st.platz}. ${st.name}`,
      werte: v.staende.map((staende) => wert(staende, st.id, (x) => x.gesamt)),
    })),
  };
}

/** Eigener Verlauf: Gesamt sowie gewichteter Fleiß- und Fortschrittsanteil (Fleiß + Fortschritt = Gesamt). */
export function eigenesDiagramm(s: SeasonZeile, v: Punkteverlauf, id: string): Liniendiagramm | null {
  const ich = v.ende.find((st) => st.id === id);
  if (!ich) return null;
  const reihe = (name: string, f: (st: TeilnehmerStand) => number) => ({
    name,
    werte: v.staende.map((staende) => wert(staende, id, f)),
  });
  return {
    titel: `${ich.name} in „${s.name}“`,
    x: v.x,
    reihen: [
      reihe("Gesamt", (st) => st.gesamt),
      reihe("Fleiß", (st) => st.fleissGewichtet),
      reihe("Fortschritt", (st) => st.gesamt - st.fleissGewichtet),
    ],
  };
}

export function diagrammPng(d: Liniendiagramm): Buffer {
  return alsPng(liniendiagramm(d));
}
