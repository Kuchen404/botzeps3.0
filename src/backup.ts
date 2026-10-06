import Database from "better-sqlite3";
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db/index.js";
import { lokalesDatum, zeitpunktIn } from "./scoring/datum.js";
import { log } from "./log.js";

/**
 * Tägliches Backup der SQLite-Datenbank: eine Datei pro Tag (`botzeps-JJJJ-MM-TT.db`),
 * die ältesten werden gelöscht, optional geht jede Sicherung per Telegram an einen Chat
 * (damit eine Kopie auch außerhalb des Servers liegt).
 */

export interface BackupEinstellungen {
  verzeichnis: string;
  /** Lokale Uhrzeit HH:MM, ab der das Backup des Tages fällig ist. */
  uhrzeit: string;
  /** Wie viele Tagessicherungen aufgehoben werden. */
  behalten: number;
  zeitzone: string;
}

/** Schickt die fertige Sicherung irgendwohin (z. B. als Telegram-Dokument). */
export type BackupVersand = (datei: string, name: string) => Promise<unknown>;

const DATEI = /^botzeps-(\d{4}-\d{2}-\d{2})\.db$/;

export function backupName(datum: string): string {
  return `botzeps-${datum}.db`;
}

/** Vorhandene Tagessicherungen, älteste zuerst. */
export function sicherungen(verzeichnis: string): string[] {
  let namen: string[];
  try {
    namen = readdirSync(verzeichnis);
  } catch {
    return [];
  }
  return namen.filter((n) => DATEI.test(n)).sort();
}

/**
 * Schreibt eine konsistente Kopie nach `ziel` (auch während der Bot schreibt) und prüft sie.
 * Erst eine geprüfte Kopie bekommt ihren endgültigen Namen.
 */
export async function sichere(db: Db, ziel: string): Promise<void> {
  const tmp = `${ziel}.tmp`;
  rmSync(tmp, { force: true });
  try {
    await db.backup(tmp);
    const kopie = new Database(tmp);
    try {
      // Eine einzelne Datei ohne -wal/-shm daneben, die man einfach kopieren kann
      kopie.pragma("journal_mode = DELETE");
      const ergebnis = kopie.pragma("integrity_check", { simple: true });
      if (ergebnis !== "ok") throw new Error(`Integritätsprüfung fehlgeschlagen: ${String(ergebnis)}`);
    } finally {
      kopie.close();
    }
    renameSync(tmp, ziel);
  } finally {
    for (const rest of ["", "-wal", "-shm", "-journal"]) rmSync(tmp + rest, { force: true });
  }
}

/** Löscht alles außer den `behalten` neuesten Tagessicherungen. Gibt die gelöschten Namen zurück. */
export function raeumeAuf(verzeichnis: string, behalten: number): string[] {
  const alle = sicherungen(verzeichnis);
  const weg = alle.slice(0, Math.max(0, alle.length - behalten));
  for (const n of weg) rmSync(join(verzeichnis, n), { force: true });
  return weg;
}

/**
 * Macht das Backup des Tages, wenn es fällig ist und noch fehlt.
 * Gibt den Dateipfad zurück, oder null, wenn nichts zu tun war.
 */
export async function backupLauf(db: Db, e: BackupEinstellungen, jetzt: Date, versand?: BackupVersand): Promise<string | null> {
  const heute = lokalesDatum(jetzt, e.zeitzone);
  if (jetzt < zeitpunktIn(heute, e.uhrzeit, e.zeitzone)) return null;
  const name = backupName(heute);
  const ziel = join(e.verzeichnis, name);
  if (sicherungen(e.verzeichnis).includes(name)) return null;

  mkdirSync(e.verzeichnis, { recursive: true });
  await sichere(db, ziel);
  const groesse = statSync(ziel).size;
  log.info(`Backup geschrieben: ${ziel} (${Math.round(groesse / 1024)} KB)`);
  const geloescht = raeumeAuf(e.verzeichnis, e.behalten);
  if (geloescht.length > 0) log.info(`Alte Backups gelöscht: ${geloescht.join(", ")}`);
  if (versand) {
    // Ein fehlgeschlagener Versand macht die lokale Sicherung nicht ungültig
    try {
      await versand(ziel, name);
    } catch (err) {
      log.error(`Backup ${name} nicht verschickt`, err);
    }
  }
  return ziel;
}

/** Prüft regelmäßig, ob das Backup des Tages fällig ist; gibt eine Funktion zum Anhalten zurück. */
export function starteBackups(
  db: Db,
  e: BackupEinstellungen,
  versand?: BackupVersand,
  intervallMs = 10 * 60_000,
  uhr: () => Date = () => new Date(),
): () => void {
  let laeuft = false;
  const tick = async () => {
    if (laeuft) return;
    laeuft = true;
    try {
      await backupLauf(db, e, uhr(), versand);
    } catch (err) {
      log.error("Backup fehlgeschlagen", err);
    } finally {
      laeuft = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervallMs);
  return () => clearInterval(timer);
}
