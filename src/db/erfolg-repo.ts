import type { Db } from "./index.js";
import { type ErfolgArt, type ErfolgTraining, ERFOLGE } from "../scoring/erfolge.js";
import { type Faktor, gesamtLast } from "../scoring/fleiss.js";

/** Alle Trainings eines Nutzers über alle Gruppen, optional ohne ein bestimmtes. */
export function alleTrainings(db: Db, nutzerId: number, ohneTraining?: number): ErfolgTraining[] {
  return db
    .prepare(
      `SELECT t.datum, t.minuten, t.faktor, s.name AS sportart FROM training t
       JOIN sportart s ON s.id = t.sportart
       WHERE t.nutzer = ? AND t.geloescht_am IS NULL AND t.id != ?`,
    )
    .all(nutzerId, ohneTraining ?? 0) as { datum: string; minuten: number; faktor: Faktor; sportart: string }[];
}

/** Lebenslange Last über alle Seasons (mit denselben Deckeln wie in der Wertung). */
export function lebenslangeLast(db: Db, nutzerId: number, ohneTraining?: number): number {
  return gesamtLast(alleTrainings(db, nutzerId, ohneTraining));
}

/** Vergibt Erfolge und gibt die zurück, die der Nutzer bisher noch nicht hatte. */
export function vergebeErfolge(db: Db, nutzerId: number, arten: readonly ErfolgArt[], datum: string): ErfolgArt[] {
  const neu = db.prepare("INSERT OR IGNORE INTO erfolg (nutzer, art, erreicht_am) VALUES (?, ?, ?)");
  return db.transaction(() => arten.filter((art) => neu.run(nutzerId, art, datum).changes > 0))();
}

export function erfolgeDesNutzers(db: Db, nutzerId: number): { art: ErfolgArt; erreicht_am: string }[] {
  const zeilen = db.prepare("SELECT art, erreicht_am FROM erfolg WHERE nutzer = ? ORDER BY erreicht_am, rowid").all(nutzerId) as {
    art: string;
    erreicht_am: string;
  }[];
  // Unbekannte Arten (z. B. nach dem Umbenennen) fallen still heraus
  return zeilen.filter((z): z is { art: ErfolgArt; erreicht_am: string } => z.art in ERFOLGE);
}

export interface Ruhmeshalle {
  sieger: { season: string; namen: string[] }[];
  mitglieder: { nutzerId: number; name: string; last: number; erfolge: number }[];
  hoechsteWochenlast: { name: string; last: number; season: string; woche: number } | null;
  laengsteEinheit: { name: string; minuten: number; sportart: string } | null;
}

export function ruhmeshalle(db: Db, gruppeId: number): Ruhmeshalle {
  // Sieger stehen im Wochenstand der letzten Woche (vom Finale gespeichert)
  const siegerZeilen = db
    .prepare(
      `SELECT s.id, s.name AS season, n.name FROM wochenstand w
       JOIN season s ON s.id = w.season JOIN nutzer n ON n.id = w.nutzer
       WHERE s.gruppe = ? AND w.woche = s.wochen - 1 AND w.platz = 1
       ORDER BY s.start, n.name`,
    )
    .all(gruppeId) as { id: number; season: string; name: string }[];
  const proSeason = new Map<number, { season: string; namen: string[] }>();
  for (const z of siegerZeilen) {
    const eintrag = proSeason.get(z.id) ?? { season: z.season, namen: [] };
    eintrag.namen.push(z.name);
    proSeason.set(z.id, eintrag);
  }
  const sieger = [...proSeason.values()];

  const mitglieder = (
    db
      .prepare(
        `SELECT n.id, n.name, (SELECT COUNT(*) FROM erfolg e WHERE e.nutzer = n.id) AS erfolge
         FROM gruppe_mitglied m JOIN nutzer n ON n.id = m.nutzer WHERE m.gruppe = ?`,
      )
      .all(gruppeId) as { id: number; name: string; erfolge: number }[]
  )
    .map((m) => ({ nutzerId: m.id, name: m.name, last: lebenslangeLast(db, m.id), erfolge: m.erfolge }))
    .sort((a, b) => b.last - a.last || a.name.localeCompare(b.name));

  const woche = db
    .prepare(
      `SELECT n.name, w.last, s.name AS season, w.woche FROM wochenstand w
       JOIN season s ON s.id = w.season JOIN nutzer n ON n.id = w.nutzer
       WHERE s.gruppe = ? AND w.last > 0 ORDER BY w.last DESC, s.start LIMIT 1`,
    )
    .get(gruppeId) as { name: string; last: number; season: string; woche: number } | undefined;

  const einheit = db
    .prepare(
      `SELECT n.name, t.minuten, s.name AS sportart FROM training t
       JOIN sportart s ON s.id = t.sportart JOIN nutzer n ON n.id = t.nutzer
       WHERE s.gruppe = ? AND t.geloescht_am IS NULL ORDER BY t.minuten DESC, t.datum LIMIT 1`,
    )
    .get(gruppeId) as { name: string; minuten: number; sportart: string } | undefined;

  return {
    sieger,
    mitglieder,
    hoechsteWochenlast: woche ? { ...woche, woche: woche.woche + 1 } : null,
    laengsteEinheit: einheit ?? null,
  };
}
