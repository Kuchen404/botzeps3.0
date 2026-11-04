import type { Db } from "./index.js";
import { schwesterName } from "../domain/sportarten.js";
import { schrittFaktor } from "../scoring/fleiss.js";

export interface Eintrag {
  art: "t" | "m";
  id: number;
  datum: string;
  /** Training */
  minuten?: number;
  sportart?: string;
  faktor?: number;
  schritte?: number;
  /** Andere Variante (locker ↔ sportlich), auf die umgestellt werden darf */
  variante?: string;
  /** Vor der Teilung eingetragen: darf auch nach 2 Tagen noch einmal umgestellt werden */
  varianteOffen?: boolean;
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
                t.schritte, t.variante_offen AS varianteOffen, s.gruppe,
                NULL AS gewichtKg, NULL AS fettPct, NULL AS muskelPct
         FROM training t JOIN sportart s ON s.id = t.sportart
         WHERE t.nutzer = ? AND t.geloescht_am IS NULL
         UNION ALL
         SELECT 'm', id, datum, zeitpunkt, NULL, NULL, NULL, NULL, NULL, gewicht_kg, fett_pct, muskel_pct
         FROM messung WHERE nutzer = ? AND geloescht_am IS NULL
       ) ORDER BY datum DESC, sortierung DESC LIMIT ?`,
    )
    .all(nutzerId, nutzerId, anzahl)
    .map((z) => {
      const { sortierung: _s, gruppe, varianteOffen, ...rest } = z as Omit<Eintrag, "varianteOffen"> & {
        sortierung: string;
        gruppe: number | null;
        varianteOffen: number | null;
      };
      const e = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null)) as unknown as Eintrag;
      if (e.art === "t" && gruppe !== null) {
        const schwester = schwesterVon(db, gruppe, e.sportart!);
        if (schwester) e.variante = schwester.name;
        if (varianteOffen) e.varianteOffen = true;
      }
      return e;
    });
}

/** Die andere Variante einer Sportart in derselben Gruppe (Radfahren locker ↔ sportlich). */
export function schwesterVon(db: Db, gruppeId: number, name: string): { id: number; name: string; faktor: number } | undefined {
  const schwester = schwesterName(name);
  if (!schwester) return undefined;
  return db.prepare("SELECT id, name, faktor FROM sportart WHERE gruppe = ? AND name = ? COLLATE NOCASE").get(gruppeId, schwester) as
    | { id: number; name: string; faktor: number }
    | undefined;
}

/** Ein Eintrag des Nutzers, oder undefined, wenn er nicht (mehr) existiert oder jemand anderem gehört. */
export function eintrag(db: Db, art: "t" | "m", id: number, nutzerId: number): Eintrag | undefined {
  if (art === "t") {
    const z = db
      .prepare(
        `SELECT t.id, t.datum, t.minuten, t.faktor, t.schritte, t.variante_offen AS varianteOffen, s.name AS sportart,
                t.gruppen_nachricht_id AS gruppenNachricht, g.telegram_chat_id AS gruppeChat, s.gruppe
         FROM training t JOIN sportart s ON s.id = t.sportart JOIN gruppe g ON g.id = s.gruppe
         WHERE t.id = ? AND t.nutzer = ? AND t.geloescht_am IS NULL`,
      )
      .get(id, nutzerId) as (Omit<Eintrag, "art" | "varianteOffen" | "schritte"> & { gruppe: number; varianteOffen: number; schritte: number | null }) | undefined;
    if (!z) return undefined;
    const { gruppe, varianteOffen, schritte, ...rest } = z;
    const schwester = schwesterVon(db, gruppe, rest.sportart!);
    return {
      art,
      ...rest,
      ...(schritte ? { schritte } : {}),
      ...(schwester ? { variante: schwester.name } : {}),
      ...(varianteOffen ? { varianteOffen: true } : {}),
    };
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
    // Mit Schritten hängt der Faktor am Tempo, also an der Dauer
    if (e.schritte) db.prepare("UPDATE training SET faktor = ? WHERE id = ? AND nutzer = ?").run(schrittFaktor(minuten, e.schritte), e.id, nutzerId);
    protokolliere(db, "training", e.id, nutzerId, "geaendert", { minuten: e.minuten }, { minuten });
  })();
}

/** Stellt ein Training auf die andere Variante um (locker ↔ sportlich), mit deren Faktor. */
export function wechsleVariante(db: Db, e: Eintrag, nutzerId: number): { name: string; faktor: number } | undefined {
  return db.transaction(() => {
    const t = db.prepare("SELECT s.gruppe FROM training t JOIN sportart s ON s.id = t.sportart WHERE t.id = ? AND t.nutzer = ?").get(e.id, nutzerId) as
      | { gruppe: number }
      | undefined;
    const schwester = t && schwesterVon(db, t.gruppe, e.sportart!);
    if (!schwester) return undefined;
    db.prepare("UPDATE training SET sportart = ?, faktor = ?, variante_offen = 0 WHERE id = ? AND nutzer = ?").run(schwester.id, schwester.faktor, e.id, nutzerId);
    protokolliere(db, "training", e.id, nutzerId, "geaendert", { sportart: e.sportart }, { sportart: schwester.name });
    return { name: schwester.name, faktor: schwester.faktor };
  })();
}
