import type { Db } from "./index.js";
import { STANDARD_SPORTARTEN, type Sportart } from "../domain/sportarten.js";
import type { Faktor } from "../scoring/fleiss.js";

export interface NutzerZeile {
  id: number;
  telegram_id: number;
  name: string;
  zeitzone: string;
}

/** Legt einen Nutzer an oder aktualisiert seinen Namen. */
export function speichereNutzer(db: Db, telegramId: number, name: string): NutzerZeile {
  return db
    .prepare(
      `INSERT INTO nutzer (telegram_id, name) VALUES (?, ?)
       ON CONFLICT (telegram_id) DO UPDATE SET name = excluded.name
       RETURNING id, telegram_id, name, zeitzone`,
    )
    .get(telegramId, name) as NutzerZeile;
}

/** Legt eine Gruppe samt Standard-Sportarten an (beim ersten Mal) und gibt ihre id zurück. */
export function speichereGruppe(db: Db, chatId: number, name: string): number {
  return db.transaction(() => {
    const bestehend = db.prepare("SELECT id FROM gruppe WHERE telegram_chat_id = ?").get(chatId) as
      | { id: number }
      | undefined;
    if (bestehend) {
      db.prepare("UPDATE gruppe SET name = ? WHERE id = ?").run(name, bestehend.id);
      return bestehend.id;
    }
    const { id } = db
      .prepare("INSERT INTO gruppe (telegram_chat_id, name) VALUES (?, ?) RETURNING id")
      .get(chatId, name) as { id: number };
    const neueSportart = db.prepare("INSERT INTO sportart (gruppe, name, faktor, kriterium) VALUES (?, ?, ?, ?)");
    for (const s of STANDARD_SPORTARTEN) neueSportart.run(id, s.name, s.faktor, s.kriterium ?? null);
    return id;
  })();
}

/** Trägt einen Nutzer als Mitglied der Gruppe ein. Gibt false zurück, wenn er schon drin war. */
export function trageMitgliedEin(db: Db, gruppeId: number, nutzerId: number): boolean {
  const r = db.prepare("INSERT OR IGNORE INTO gruppe_mitglied (gruppe, nutzer) VALUES (?, ?)").run(gruppeId, nutzerId);
  return r.changes > 0;
}

export function sportartenDerGruppe(db: Db, gruppeId: number): Sportart[] {
  const zeilen = db
    .prepare("SELECT name, faktor, kriterium FROM sportart WHERE gruppe = ? ORDER BY name")
    .all(gruppeId) as { name: string; faktor: Faktor; kriterium: string | null }[];
  return zeilen.map((z) => ({ name: z.name, faktor: z.faktor, ...(z.kriterium ? { kriterium: z.kriterium } : {}) }));
}

export interface SportartZeile {
  id: number;
  gruppe: number;
  name: string;
  faktor: Faktor;
  kriterium: string | null;
}

export interface GruppeZeile {
  id: number;
  telegram_chat_id: number;
  name: string;
}

/** Gruppen eines Nutzers, zuletzt beigetretene zuerst. */
export function gruppenDesNutzers(db: Db, nutzerId: number): GruppeZeile[] {
  return db
    .prepare(
      `SELECT g.id, g.telegram_chat_id, g.name FROM gruppe g
       JOIN gruppe_mitglied m ON m.gruppe = g.id
       WHERE m.nutzer = ? ORDER BY m.seit DESC, g.id DESC`,
    )
    .all(nutzerId) as GruppeZeile[];
}

export function istMitglied(db: Db, gruppeId: number, nutzerId: number): boolean {
  return db.prepare("SELECT 1 FROM gruppe_mitglied WHERE gruppe = ? AND nutzer = ?").get(gruppeId, nutzerId) !== undefined;
}

export function nutzerNachTelegramId(db: Db, telegramId: number): NutzerZeile | undefined {
  return db.prepare("SELECT id, telegram_id, name, zeitzone FROM nutzer WHERE telegram_id = ?").get(telegramId) as
    | NutzerZeile
    | undefined;
}

export function gruppeNachId(db: Db, id: number): GruppeZeile | undefined {
  return db.prepare("SELECT id, telegram_chat_id, name FROM gruppe WHERE id = ?").get(id) as GruppeZeile | undefined;
}

export function sportartNachId(db: Db, id: number): SportartZeile | undefined {
  return db.prepare("SELECT id, gruppe, name, faktor, kriterium FROM sportart WHERE id = ?").get(id) as
    | SportartZeile
    | undefined;
}

export function sportartNachName(db: Db, gruppeId: number, name: string): SportartZeile | undefined {
  return db
    .prepare("SELECT id, gruppe, name, faktor, kriterium FROM sportart WHERE gruppe = ? AND name = ? COLLATE NOCASE")
    .get(gruppeId, name.trim()) as SportartZeile | undefined;
}

/** Sportarten der Gruppe, die eigenen zuletzt genutzten zuerst, danach alphabetisch. */
export function sportartenFuerAuswahl(db: Db, gruppeId: number, nutzerId: number): SportartZeile[] {
  return db
    .prepare(
      `SELECT s.id, s.gruppe, s.name, s.faktor, s.kriterium FROM sportart s
       LEFT JOIN (
         SELECT sportart, MAX(erstellt_am) AS zuletzt FROM training
         WHERE nutzer = ? AND geloescht_am IS NULL GROUP BY sportart
       ) t ON t.sportart = s.id
       WHERE s.gruppe = ?
       ORDER BY t.zuletzt IS NULL, t.zuletzt DESC, s.name`,
    )
    .all(nutzerId, gruppeId) as SportartZeile[];
}

function protokolliere(db: Db, tabelle: string, datensatz: number, nutzer: number, nachher: unknown): void {
  db.prepare("INSERT INTO aenderung (tabelle, datensatz, nutzer, art, nachher) VALUES (?, ?, ?, 'angelegt', ?)").run(
    tabelle,
    datensatz,
    nutzer,
    JSON.stringify(nachher),
  );
}

export interface NeuesTraining {
  nutzer: number;
  datum: string;
  minuten: number;
  sportart: SportartZeile;
}

/** Speichert ein Training mit dem aktuellen Faktor der Sportart. Gibt die id zurück. */
export function speichereTraining(db: Db, t: NeuesTraining): number {
  return db.transaction(() => {
    const { id } = db
      .prepare("INSERT INTO training (nutzer, datum, minuten, sportart, faktor) VALUES (?, ?, ?, ?, ?) RETURNING id")
      .get(t.nutzer, t.datum, t.minuten, t.sportart.id, t.sportart.faktor) as { id: number };
    protokolliere(db, "training", id, t.nutzer, { datum: t.datum, minuten: t.minuten, sportart: t.sportart.name });
    return id;
  })();
}

export function setzeGruppenNachricht(db: Db, trainingId: number, nachrichtId: number): void {
  db.prepare("UPDATE training SET gruppen_nachricht_id = ? WHERE id = ?").run(nachrichtId, trainingId);
}

export interface NeueMessung {
  nutzer: number;
  zeitpunkt: string;
  datum: string;
  gewichtKg: number;
  fettPct: number;
  muskelPct: number;
  markiert: boolean;
}

export function speichereMessung(db: Db, m: NeueMessung): number {
  return db.transaction(() => {
    const { id } = db
      .prepare(
        `INSERT INTO messung (nutzer, zeitpunkt, datum, gewicht_kg, fett_pct, muskel_pct, markiert)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(m.nutzer, m.zeitpunkt, m.datum, m.gewichtKg, m.fettPct, m.muskelPct, m.markiert ? 1 : 0) as { id: number };
    protokolliere(db, "messung", id, m.nutzer, {
      datum: m.datum,
      gewichtKg: m.gewichtKg,
      fettPct: m.fettPct,
      muskelPct: m.muskelPct,
      markiert: m.markiert,
    });
    return id;
  })();
}

/** Mittel aus Gewicht und Fett % der Messungen im Zeitraum [von, bis], oder null ohne Messungen. */
export function messMittel(
  db: Db,
  nutzerId: number,
  von: string,
  bis: string,
): { gewichtKg: number; fettPct: number; anzahl: number } | null {
  const z = db
    .prepare(
      `SELECT AVG(gewicht_kg) AS gewichtKg, AVG(fett_pct) AS fettPct, COUNT(*) AS anzahl FROM messung
       WHERE nutzer = ? AND datum BETWEEN ? AND ? AND geloescht_am IS NULL`,
    )
    .get(nutzerId, von, bis) as { gewichtKg: number | null; fettPct: number | null; anzahl: number };
  return z.anzahl > 0 ? { gewichtKg: z.gewichtKg!, fettPct: z.fettPct!, anzahl: z.anzahl } : null;
}
