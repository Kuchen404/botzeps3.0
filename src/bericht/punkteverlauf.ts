import type { Db } from "../db/index.js";
import { type SeasonZeile, bosseDerSeason, einstellungen, ladeTeilnehmer } from "../db/season-repo.js";
import { type Liniendiagramm, alsPng, liniendiagramm } from "../diagramm/index.js";
import { plusTage } from "../scoring/datum.js";
import { type TeilnehmerStand, seasonEnde, seasonStand } from "../scoring/season.js";

export interface Punkteverlauf {
  /** "Start", "W1", "W2", … (täglich: "Start", "Mo 12.10.", …) */
  x: string[];
  /** Täglich: Achsenbeschriftung je x-Punkt, nur am Start und an Wochenenden gesetzt. */
  achse?: (string | null)[];
  /** Stand je x-Punkt, beim Start leer (alle 0). Täglich fehlen die Tage nach `bisTag`. */
  staende: TeilnehmerStand[][];
  /** Stand am letzten Punkt in Ranglistenfolge. */
  ende: TeilnehmerStand[];
  telegramIds: ReadonlyMap<string, number>;
}

/** Punkte am Ende jeder Season-Woche bis `bisTag`; die laufende Woche zählt mit dem Stand von `bisTag`. */
export function punkteverlauf(db: Db, s: SeasonZeile, bisTag: string, taeglich = false): Punkteverlauf | null {
  if (bisTag < s.start) return null;
  const teilnehmer = ladeTeilnehmer(db, s);
  if (teilnehmer.length === 0) return null;
  const e = einstellungen(s, bosseDerSeason(db, s));
  const bis = bisTag < seasonEnde(s) ? bisTag : seasonEnde(s);
  if (taeglich) return tagesverlauf(s, bis, teilnehmer, e);
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

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tagLabel(tag: string): string {
  const [, m, d] = tag.split("-");
  return `${WOCHENTAGE[new Date(`${tag}T00:00:00Z`).getUTCDay()]} ${d}.${m}.`;
}

/** Stand an jedem Tag bis `bis`; die laufende Woche reicht auf der Achse bis zu ihrem Ende. */
function tagesverlauf(
  s: SeasonZeile,
  bis: string,
  teilnehmer: ReturnType<typeof ladeTeilnehmer>,
  e: ReturnType<typeof einstellungen>,
): Punkteverlauf {
  const x = ["Start"];
  const achse: (string | null)[] = ["Start"];
  const staende: TeilnehmerStand[][] = [[]];
  for (let w = 0; w < s.wochen; w++) {
    for (let d = 0; d < 7; d++) {
      const tag = plusTage(s.start, w * 7 + d);
      x.push(tagLabel(tag));
      achse.push(d === 6 ? `W${w + 1}` : null);
      if (tag <= bis) staende.push(seasonStand(e, teilnehmer, tag));
    }
    if (plusTage(s.start, w * 7 + 6) >= bis) break;
  }
  return {
    x,
    achse,
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
    achse: v.achse,
    reihen: v.ende.map((st) => ({
      name: `${st.platz}. ${st.name}`,
      werte: v.x.map((_, i) => (i < v.staende.length ? wert(v.staende[i]!, st.id, (x) => x.gesamt) : null)),
    })),
  };
}

/** Eigener Verlauf: Gesamt sowie gewichteter Fleiß- und Fortschrittsanteil (Fleiß + Fortschritt = Gesamt). */
export function eigenesDiagramm(s: SeasonZeile, v: Punkteverlauf, id: string): Liniendiagramm | null {
  const ich = v.ende.find((st) => st.id === id);
  if (!ich) return null;
  const reihe = (name: string, f: (st: TeilnehmerStand) => number) => ({
    name,
    werte: v.x.map((_, i) => (i < v.staende.length ? wert(v.staende[i]!, id, f) : null)),
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
