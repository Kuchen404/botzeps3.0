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
