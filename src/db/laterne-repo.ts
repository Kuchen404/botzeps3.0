import type { Db } from "./index.js";
import type { SeasonZeile } from "./season-repo.js";
import { roteLaterne } from "../scoring/season.js";

export interface Laternen {
  /** Wer die Laterne gerade trägt (aus dem letzten Bericht), als Nutzer-IDs wie im Stand. */
  traeger: string[];
  /** Wie oft jemand sie in der Season schon hatte. */
  anzahl: Map<string, number>;
}

/**
 * Rote Laternen aus den gespeicherten Wochenständen, also genau so, wie sie in den Berichten verkündet wurden.
 * `vorWoche` begrenzt auf frühere Wochen (für den Bericht, der gerade entsteht).
 */
export function laternen(db: Db, s: SeasonZeile, vorWoche = Infinity): Laternen {
  const zeilen = db
    .prepare(
      `SELECT w.woche, w.nutzer, w.last, t.beitritt FROM wochenstand w
       JOIN teilnahme t ON t.season = w.season AND t.nutzer = w.nutzer
       WHERE w.season = ? AND w.woche < ? ORDER BY w.woche`,
    )
    .all(s.id, Number.isFinite(vorWoche) ? vorWoche : s.wochen) as { woche: number; nutzer: number; last: number; beitritt: string }[];
  const proWoche = new Map<number, { id: string; beitritt: string; last: number }[]>();
  for (const z of zeilen) {
    const liste = proWoche.get(z.woche) ?? [];
    liste.push({ id: String(z.nutzer), beitritt: z.beitritt, last: z.last });
    proWoche.set(z.woche, liste);
  }
  const anzahl = new Map<string, number>();
  let traeger: string[] = [];
  for (const [woche, liste] of [...proWoche].sort((a, b) => a[0] - b[0])) {
    traeger = roteLaterne(s.start, woche, liste);
    for (const id of traeger) anzahl.set(id, (anzahl.get(id) ?? 0) + 1);
  }
  return { traeger, anzahl };
}
