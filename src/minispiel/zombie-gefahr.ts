import { plusTage, zeitpunktIn, type IsoDatum } from '../scoring/datum.js';
import { trainingsDerWoche, type DatenVon, type Spieler, type SpielWoche } from './spiele.js';

export interface ZombieFrist { warnAb: string; frist: string }
export interface ZombieZeit { tag: IsoDatum; zeitzone: string; berichtszeit: string; abgeschlossen: boolean }

/** Dieselben Trainingstage wie die Infektionsregel; keine rollierenden 48 Stunden. */
export function zombieGefahr(d: DatenVon<'zombie'>, spieler: readonly Spieler[], w: SpielWoche, zeit: ZombieZeit, infiziert: ReadonlySet<string>): Record<string, ZombieFrist> {
  const gefahr: Record<string, ZombieFrist> = {};
  if (zeit.abgeschlossen) return gefahr;
  const sonntag = plusTage(w.start, 6), teilnehmer = new Set(d.spieler);
  for (const sp of spieler) {
    if (!teilnehmer.has(sp.id) || infiziert.has(sp.id)) continue;
    const letzter = trainingsDerWoche(sp, w).filter(t => t.datum <= zeit.tag).map(t => t.datum).sort().at(-1) ?? plusTage(w.start, -1);
    const risikotag = plusTage(letzter, 2);
    // Nach einem Training am Samstag/Sonntag passt kein Zweitagesausfall mehr in die Woche.
    if (risikotag > sonntag) continue;
    gefahr[sp.id] = {
      warnAb: zeitpunktIn(risikotag, '00:00', zeit.zeitzone).toISOString(),
      frist: zeitpunktIn(risikotag === sonntag ? sonntag : plusTage(risikotag, 1), risikotag === sonntag ? zeit.berichtszeit : '00:00', zeit.zeitzone).toISOString(),
    };
  }
  return gefahr;
}
