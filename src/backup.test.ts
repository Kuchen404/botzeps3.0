import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { oeffneDb, type Db } from "./db/index.js";
import { backupLauf, raeumeAuf, sicherungen, type BackupEinstellungen } from "./backup.js";

let ordner: string;
let db: Db;
let e: BackupEinstellungen;

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), "botzeps-backup-"));
  db = oeffneDb(join(ordner, "botzeps.db"));
  db.prepare("INSERT INTO gruppe (telegram_chat_id, name) VALUES (?, ?)").run(-1001, "Pumper");
  e = { verzeichnis: join(ordner, "backups"), uhrzeit: "04:00", behalten: 3, zeitzone: "Europe/Berlin" };
});

afterEach(() => {
  db.close();
  rmSync(ordner, { recursive: true, force: true });
});

describe("Tägliches Backup", () => {
  it("wartet bis zur Uhrzeit (Ortszeit) und sichert dann genau einmal am Tag", async () => {
    // 01:30 UTC = 03:30 Berlin (Sommerzeit): noch nicht fällig
    expect(await backupLauf(db, e, new Date("2026-10-06T01:30:00Z"))).toBeNull();
    const pfad = await backupLauf(db, e, new Date("2026-10-06T02:05:00Z"));
    expect(pfad).toBe(join(e.verzeichnis, "botzeps-2026-10-06.db"));
    expect(await backupLauf(db, e, new Date("2026-10-06T15:00:00Z"))).toBeNull();
    expect(sicherungen(e.verzeichnis)).toEqual(["botzeps-2026-10-06.db"]);

    const kopie = new Database(pfad!, { readonly: true });
    expect(kopie.prepare("SELECT name FROM gruppe").get()).toEqual({ name: "Pumper" });
    kopie.close();
  });

  it("holt ein verpasstes Backup nach dem Start nach", async () => {
    expect(await backupLauf(db, e, new Date("2026-10-06T21:59:00Z"))).not.toBeNull();
  });

  it("behält nur die neuesten Sicherungen und rührt fremde Dateien nicht an", async () => {
    for (const tag of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]) {
      await backupLauf(db, e, new Date(`${tag}T10:00:00Z`));
    }
    writeFileSync(join(e.verzeichnis, "notiz.txt"), "bleibt");
    expect(sicherungen(e.verzeichnis)).toEqual(["botzeps-2026-10-02.db", "botzeps-2026-10-03.db", "botzeps-2026-10-04.db"]);
    expect(raeumeAuf(e.verzeichnis, 1)).toEqual(["botzeps-2026-10-02.db", "botzeps-2026-10-03.db"]);
    expect(readdirSync(e.verzeichnis).sort()).toEqual(["botzeps-2026-10-04.db", "notiz.txt"]);
  });

  it("verschickt die Sicherung; ein Fehler beim Versand bricht das Backup nicht ab", async () => {
    const verschickt: string[] = [];
    await backupLauf(db, e, new Date("2026-10-06T10:00:00Z"), async (_datei, name) => {
      verschickt.push(name);
    });
    expect(verschickt).toEqual(["botzeps-2026-10-06.db"]);

    const pfad = await backupLauf(db, e, new Date("2026-10-07T10:00:00Z"), async () => {
      throw new Error("Telegram weg");
    });
    expect(pfad).not.toBeNull();
    expect(sicherungen(e.verzeichnis)).toHaveLength(2);
  });

  it("lässt keine halbfertige Datei liegen", async () => {
    await backupLauf(db, e, new Date("2026-10-06T10:00:00Z"));
    expect(readdirSync(e.verzeichnis)).toEqual(["botzeps-2026-10-06.db"]);
  });
});
