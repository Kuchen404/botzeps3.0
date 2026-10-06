import type { Db } from "./index.js";

export interface Eintrag {
  art: "t" | "m";
  id: number;
  datum: string;
  /** Training */
  minuten?: number;
  sportart?: string;
  faktor?: number;
  gruppenNachricht?: number | null;
  gruppeChat?: number | null;
  /** Messung */
  gewichtKg?: number;
  fettPct?: number;
  muskelPct?: number;
}

/** Die letzten Trainings und Messungen eines Nutzers, neueste zuerst. */
export function letzteEintraege(db: Db, nutzerId: number, anzahl = 10): Eintrag[] {
  return db
    .prepare(
      `SELECT * FROM (
         SELECT 't' AS art, t.id, t.datum, t.erstellt_am AS sortierung, t.minuten, s.name AS sportart,
                NULL AS gewichtKg, NULL AS fettPct, NULL AS muskelPct
         FROM training t JOIN sportart s ON s.id = t.sportart
         WHERE t.nutzer = ? AND t.geloescht_am IS NULL
         UNION ALL
         SELECT 'm', id, datum, zeitpunkt, NULL, NULL, gewicht_kg, fett_pct, muskel_pct
         FROM messung WHERE nutzer = ? AND geloescht_am IS NULL
       ) ORDER BY datum DESC, sortierung DESC LIMIT ?`,
    )
    .all(nutzerId, nutzerId, anzahl)
    .map((z) => {
      const { sortierung: _s, ...rest } = z as Eintrag & { sortierung: string };
      return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null)) as unknown as Eintrag;
    });
}

/** Ein Eintrag des Nutzers, oder undefined, wenn er nicht (mehr) existiert oder jemand anderem gehört. */
export function eintrag(db: Db, art: "t" | "m", id: number, nutzerId: number): Eintrag | undefined {
  if (art === "t") {
    const z = db
      .prepare(
        `SELECT t.id, t.datum, t.minuten, t.faktor, s.name AS sportart, t.gruppen_nachricht_id AS gruppenNachricht,
                g.telegram_chat_id AS gruppeChat
         FROM training t JOIN sportart s ON s.id = t.sportart JOIN gruppe g ON g.id = s.gruppe
         WHERE t.id = ? AND t.nutzer = ? AND t.geloescht_am IS NULL`,
      )
      .get(id, nutzerId) as Omit<Eintrag, "art"> | undefined;
    return z && { art, ...z };
  }
  const z = db
    .prepare(
      `SELECT id, datum, gewicht_kg AS gewichtKg, fett_pct AS fettPct, muskel_pct AS muskelPct
       FROM messung WHERE id = ? AND nutzer = ? AND geloescht_am IS NULL`,
    )
    .get(id, nutzerId) as Omit<Eintrag, "art"> | undefined;
  return z && { art, ...z };
}

function protokolliere(db: Db, tabelle: string, id: number, nutzer: number, art: string, vorher: unknown, nachher: unknown) {
  db.prepare("INSERT INTO aenderung (tabelle, datensatz, nutzer, art, vorher, nachher) VALUES (?, ?, ?, ?, ?, ?)").run(
    tabelle,
    id,
    nutzer,
    art,
    JSON.stringify(vorher),
    nachher === null ? null : JSON.stringify(nachher),
  );
}

export function loescheEintrag(db: Db, e: Eintrag, nutzerId: number, zeitpunkt: string): void {
  const tabelle = e.art === "t" ? "training" : "messung";
  db.transaction(() => {
    db.prepare(`UPDATE ${tabelle} SET geloescht_am = ? WHERE id = ? AND nutzer = ?`).run(zeitpunkt, e.id, nutzerId);
    protokolliere(db, tabelle, e.id, nutzerId, "geloescht", e, null);
  })();
}

export function aendereTrainingsdauer(db: Db, e: Eintrag, nutzerId: number, minuten: number): void {
  db.transaction(() => {
    db.prepare("UPDATE training SET minuten = ? WHERE id = ? AND nutzer = ?").run(minuten, e.id, nutzerId);
    protokolliere(db, "training", e.id, nutzerId, "geaendert", { minuten: e.minuten }, { minuten });
  })();
}
