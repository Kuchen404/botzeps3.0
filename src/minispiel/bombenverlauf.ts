import type { Db } from "../db/index.js";
import { bombentraeger, type DatenVon, type Spieler, type SpielTraining } from "./spiele.js";

export interface BombenTraining extends SpielTraining {
  spieler: string;
  geloescht: string | null;
}
export interface BombenStation {
  traeger: string;
  zeitpunkt: string;
  art: "start" | "training" | "korrektur";
}

/**
 * Historische Träger nach Eintragszeit, nicht nach dem (ggf. nachgetragenen) Sportdatum.
 * Softgelöschte Trainings zählen bis zu ihrer Löschung. Minuten-/Sportartkorrekturen
 * ändern den für die Bombe maßgeblichen letzten Trainingstag nicht.
 */
export function bombenVerlauf(
  d: DatenVon<"bombe">,
  spieler: readonly Pick<Spieler, "id" | "name">[],
  trainings: readonly BombenTraining[],
  start: string,
  bis: string,
): BombenStation[] {
  const anfang = Date.parse(start), ende = Date.parse(bis);
  if (ende < anfang) return [];
  const bekannte = new Set(d.spieler);
  const liste = trainings.filter((t) => bekannte.has(t.spieler));
  const aktiv = new Map(liste.filter((t) => Date.parse(t.erstellt) < anfang && (!t.geloescht || Date.parse(t.geloescht) >= anfang)).map((t) => [t.id, t]));
  const traeger = () => bombentraeger(d, spieler.map((sp) => ({ ...sp, trainings: [...aktiv.values()].filter((t) => t.spieler === sp.id) })));
  const erster = traeger();
  const verlauf: BombenStation[] = erster ? [{ traeger: erster, zeitpunkt: start, art: "start" }] : [];
  const ereignisse = liste.flatMap((t) => [
    { training: t, zeitpunkt: t.erstellt, loeschen: false },
    ...(t.geloescht ? [{ training: t, zeitpunkt: t.geloescht, loeschen: true }] : []),
  ]).filter((e) => Date.parse(e.zeitpunkt) >= anfang && Date.parse(e.zeitpunkt) <= ende)
    .sort((a, b) => Date.parse(a.zeitpunkt) - Date.parse(b.zeitpunkt) || Number(a.loeschen) - Number(b.loeschen) || a.training.id - b.training.id);
  for (const e of ereignisse) {
    if (e.loeschen) aktiv.delete(e.training.id);
    else aktiv.set(e.training.id, e.training);
    const neu = traeger();
    if (neu && neu !== verlauf.at(-1)?.traeger) verlauf.push({ traeger: neu, zeitpunkt: e.zeitpunkt, art: e.loeschen ? "korrektur" : "training" });
  }
  return verlauf;
}

/** Gleiche Season-/Beitrittsgrenzen wie spielerDerSeason, inklusive Softlöschungen. */
export function bombenTrainings(db: Db, season: number, bis: string): BombenTraining[] {
  return db.prepare(`SELECT tr.id, CAST(tr.nutzer AS TEXT) AS spieler, tr.datum, tr.minuten, tr.faktor,
      tr.erstellt_am AS erstellt, tr.geloescht_am AS geloescht
    FROM training tr JOIN teilnahme tn ON tn.nutzer = tr.nutzer
    JOIN season s ON s.id = tn.season
    WHERE tn.season = ? AND tr.datum >= MAX(s.start, tn.beitritt) AND tr.datum <= ?`).all(season, bis) as BombenTraining[];
}
