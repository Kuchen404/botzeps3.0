import type { Db } from "./index.js";
import type { Faktor } from "../scoring/fleiss.js";
import { entscheide, noetigeStimmen } from "../domain/neue-sportart.js";
import { type SportartZeile, gruppeNachId, speichereTraining, sportartNachName } from "./repo.js";

export interface AbstimmungZeile {
  id: number;
  gruppe: number;
  name: string;
  vorschlag: Faktor | null;
  antragsteller: number;
  minuten: number | null;
  datum: string | null;
  nachricht_id: number | null;
  erstellt_am: string;
  beendet_am: string | null;
  ergebnis: Faktor | null;
}

export function abstimmungNachId(db: Db, id: number): AbstimmungZeile | undefined {
  return db.prepare("SELECT * FROM abstimmung WHERE id = ?").get(id) as AbstimmungZeile | undefined;
}

export function offeneAbstimmung(db: Db, gruppeId: number, name: string): AbstimmungZeile | undefined {
  return db
    .prepare("SELECT * FROM abstimmung WHERE gruppe = ? AND name = ? COLLATE NOCASE AND beendet_am IS NULL")
    .get(gruppeId, name) as AbstimmungZeile | undefined;
}

export function legeAbstimmungAn(
  db: Db,
  a: Pick<AbstimmungZeile, "gruppe" | "name" | "vorschlag" | "antragsteller" | "minuten" | "datum" | "erstellt_am">,
): AbstimmungZeile {
  const { id } = db
    .prepare(
      `INSERT INTO abstimmung (gruppe, name, vorschlag, antragsteller, minuten, datum, erstellt_am)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(a.gruppe, a.name, a.vorschlag, a.antragsteller, a.minuten, a.datum, a.erstellt_am) as { id: number };
  return abstimmungNachId(db, id)!;
}

export function setzeNachricht(db: Db, id: number, nachrichtId: number): void {
  db.prepare("UPDATE abstimmung SET nachricht_id = ? WHERE id = ?").run(nachrichtId, id);
}

export function stimmeAb(db: Db, abstimmungId: number, nutzerId: number, faktor: Faktor): void {
  db.prepare(
    "INSERT INTO stimme (abstimmung, nutzer, faktor) VALUES (?, ?, ?) ON CONFLICT (abstimmung, nutzer) DO UPDATE SET faktor = excluded.faktor",
  ).run(abstimmungId, nutzerId, faktor);
}

export function stimmen(db: Db, abstimmungId: number): Faktor[] {
  return (db.prepare("SELECT faktor FROM stimme WHERE abstimmung = ?").all(abstimmungId) as { faktor: Faktor }[]).map(
    (s) => s.faktor,
  );
}

export function istEntschieden(db: Db, a: AbstimmungZeile): boolean {
  const mitglieder = (db.prepare("SELECT COUNT(*) AS n FROM gruppe_mitglied WHERE gruppe = ?").get(a.gruppe) as { n: number }).n;
  return stimmen(db, a.id).length >= noetigeStimmen(mitglieder);
}

export interface Entscheidung {
  sportart: SportartZeile;
  gruppeChat: number;
  /** Eingetragenes Training des Antragstellers, falls er eins angehängt hatte. */
  training?: { id: number; nutzerName: string; minuten: number; datum: string };
}

/** Beendet die Abstimmung, legt die Sportart an und trägt das wartende Training ein. Idempotent. */
export function beendeAbstimmung(db: Db, id: number, zeitpunkt: string): Entscheidung | undefined {
  return db.transaction(() => {
    const a = abstimmungNachId(db, id);
    const gruppe = a ? gruppeNachId(db, a.gruppe) : undefined;
    if (!a || a.beendet_am || !gruppe) return undefined;
    const faktor = entscheide(stimmen(db, id), a.vorschlag ?? undefined);
    db.prepare("UPDATE abstimmung SET beendet_am = ?, ergebnis = ? WHERE id = ?").run(zeitpunkt, faktor, id);
    // Wurde die Sportart inzwischen anderweitig angelegt, gilt die bestehende
    const vorhanden = sportartNachName(db, a.gruppe, a.name);
    if (!vorhanden) db.prepare("INSERT INTO sportart (gruppe, name, faktor) VALUES (?, ?, ?)").run(a.gruppe, a.name, faktor);
    const sportart = vorhanden ?? sportartNachName(db, a.gruppe, a.name)!;
    const ergebnis: Entscheidung = { sportart, gruppeChat: gruppe.telegram_chat_id };
    if (a.minuten && a.datum) {
      const trainingId = speichereTraining(db, { nutzer: a.antragsteller, datum: a.datum, minuten: a.minuten, sportart });
      const { name } = db.prepare("SELECT name FROM nutzer WHERE id = ?").get(a.antragsteller) as { name: string };
      ergebnis.training = { id: trainingId, nutzerName: name, minuten: a.minuten, datum: a.datum };
    }
    return ergebnis;
  })();
}

/** Offene Abstimmungen, die älter als `bis` sind. */
export function abgelaufeneAbstimmungen(db: Db, bis: string): AbstimmungZeile[] {
  return db.prepare("SELECT * FROM abstimmung WHERE beendet_am IS NULL AND erstellt_am <= ?").all(bis) as AbstimmungZeile[];
}
