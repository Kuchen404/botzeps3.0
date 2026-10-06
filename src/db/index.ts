import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONEN } from "./migrationen.js";

export type Db = Database.Database;

export function oeffneDb(pfad: string): Db {
  if (pfad !== ":memory:") mkdirSync(dirname(pfad), { recursive: true });
  const db = new Database(pfad);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migriere(db);
  return db;
}

/** Führt alle noch fehlenden Migrationen in je einer Transaktion aus. Gibt die neuen Versionen zurück. */
export function migriere(db: Db): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    ausgefuehrt_am TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const vorhanden = new Set(
    db.prepare("SELECT version FROM schema_version").all().map((z) => (z as { version: number }).version),
  );
  const neu: number[] = [];
  for (const m of MIGRATIONEN) {
    if (vorhanden.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(m.version, m.name);
    })();
    neu.push(m.version);
  }
  return neu;
}
