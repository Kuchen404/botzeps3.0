/**
 * Datenbank-Migrationen, in dieser Reihenfolge genau einmal ausgeführt.
 * Bestehende Einträge nie ändern, nur neue anhängen.
 */
export const MIGRATIONEN: readonly { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "grundschema",
    sql: `
      CREATE TABLE nutzer (
        id            INTEGER PRIMARY KEY,
        telegram_id   INTEGER NOT NULL UNIQUE,
        name          TEXT    NOT NULL,
        zeitzone      TEXT    NOT NULL DEFAULT 'Europe/Berlin',
        erinnerungen  INTEGER NOT NULL DEFAULT 1,
        erinnerung_uhrzeit TEXT NOT NULL DEFAULT '19:00',
        erstellt_am   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE gruppe (
        id               INTEGER PRIMARY KEY,
        telegram_chat_id INTEGER NOT NULL UNIQUE,
        name             TEXT    NOT NULL,
        erstellt_am      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE gruppe_mitglied (
        gruppe  INTEGER NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
        nutzer  INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        seit    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (gruppe, nutzer)
      );

      CREATE TABLE season (
        id                  INTEGER PRIMARY KEY,
        gruppe              INTEGER NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
        name                TEXT    NOT NULL,
        start               TEXT    NOT NULL,             -- YYYY-MM-DD, erster Tag
        wochen              INTEGER NOT NULL DEFAULT 10 CHECK (wochen > 0),
        berichtstag         INTEGER NOT NULL DEFAULT 0 CHECK (berichtstag BETWEEN 0 AND 6), -- 0 = Sonntag
        berichtszeit        TEXT    NOT NULL DEFAULT '20:00',
        gewicht_fleiss      INTEGER NOT NULL DEFAULT 50,
        gewicht_fortschritt INTEGER NOT NULL DEFAULT 50,
        wochenziel_last     INTEGER NOT NULL DEFAULT 300,
        teams_aktiv         INTEGER NOT NULL DEFAULT 0,
        foto_pflicht        INTEGER NOT NULL DEFAULT 0,
        erstellt_von        INTEGER REFERENCES nutzer(id),
        erstellt_am         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (gewicht_fleiss + gewicht_fortschritt = 100)
      );

      CREATE TABLE team (
        id      INTEGER PRIMARY KEY,
        season  INTEGER NOT NULL REFERENCES season(id) ON DELETE CASCADE,
        name    TEXT    NOT NULL
      );

      CREATE TABLE teilnahme (
        season    INTEGER NOT NULL REFERENCES season(id) ON DELETE CASCADE,
        nutzer    INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        team      INTEGER REFERENCES team(id) ON DELETE SET NULL,
        beitritt  TEXT    NOT NULL,                       -- YYYY-MM-DD
        PRIMARY KEY (season, nutzer)
      );

      CREATE TABLE sportart (
        id         INTEGER PRIMARY KEY,
        gruppe     INTEGER NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
        name       TEXT    NOT NULL,
        faktor     INTEGER NOT NULL CHECK (faktor IN (1, 2, 3)),
        kriterium  TEXT,
        UNIQUE (gruppe, name COLLATE NOCASE)
      );

      CREATE TABLE messung (
        id          INTEGER PRIMARY KEY,
        nutzer      INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        zeitpunkt   TEXT    NOT NULL,
        datum       TEXT    NOT NULL,                     -- lokales Datum, YYYY-MM-DD
        gewicht_kg  REAL    NOT NULL CHECK (gewicht_kg BETWEEN 35 AND 250),
        fett_pct    REAL    NOT NULL CHECK (fett_pct BETWEEN 3 AND 60),
        muskel_pct  REAL    NOT NULL CHECK (muskel_pct BETWEEN 20 AND 70),
        foto_file_id TEXT,
        markiert    INTEGER NOT NULL DEFAULT 0,
        geloescht_am TEXT
      );
      CREATE INDEX messung_nutzer_datum ON messung (nutzer, datum);

      CREATE TABLE training (
        id          INTEGER PRIMARY KEY,
        nutzer      INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        datum       TEXT    NOT NULL,                     -- lokales Datum, YYYY-MM-DD
        minuten     INTEGER NOT NULL CHECK (minuten BETWEEN 5 AND 240),
        sportart    INTEGER NOT NULL REFERENCES sportart(id),
        faktor      INTEGER NOT NULL CHECK (faktor IN (1, 2, 3)), -- Faktor beim Eintragen, falls die Sportart später geändert wird
        gruppen_nachricht_id INTEGER,
        erstellt_am TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        geloescht_am TEXT
      );
      CREATE INDEX training_nutzer_datum ON training (nutzer, datum);

      -- Protokoll aller Änderungen an Messungen und Trainings (Schutz gegen Schummeln)
      CREATE TABLE aenderung (
        id         INTEGER PRIMARY KEY,
        tabelle    TEXT    NOT NULL,
        datensatz  INTEGER NOT NULL,
        nutzer     INTEGER NOT NULL REFERENCES nutzer(id),
        art        TEXT    NOT NULL CHECK (art IN ('angelegt', 'geaendert', 'geloescht')),
        vorher     TEXT,
        nachher    TEXT,
        zeitpunkt  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- Fällige Berichte und Erinnerungen, genau einmal ausgeführt
      CREATE TABLE termin (
        id          INTEGER PRIMARY KEY,
        art         TEXT    NOT NULL,
        season      INTEGER REFERENCES season(id) ON DELETE CASCADE,
        nutzer      INTEGER REFERENCES nutzer(id) ON DELETE CASCADE,
        faellig_am  TEXT    NOT NULL,
        erledigt_am TEXT,
        UNIQUE (art, season, nutzer, faellig_am)
      );
      CREATE INDEX termin_offen ON termin (faellig_am) WHERE erledigt_am IS NULL;

      CREATE TABLE wochenstand (
        season              INTEGER NOT NULL REFERENCES season(id) ON DELETE CASCADE,
        nutzer              INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        woche               INTEGER NOT NULL,
        last                REAL    NOT NULL,
        fleisspunkte        REAL    NOT NULL,
        fortschrittspunkte  REAL,
        gesamt              REAL    NOT NULL,
        platz               INTEGER NOT NULL,
        spruch              TEXT,
        PRIMARY KEY (season, nutzer, woche)
      );

      CREATE TABLE auszeichnung (
        season  INTEGER NOT NULL REFERENCES season(id) ON DELETE CASCADE,
        nutzer  INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        art     TEXT    NOT NULL,
        PRIMARY KEY (season, nutzer, art)
      );
    `,
  },
  {
    version: 2,
    name: "termin_eindeutig",
    // UNIQUE behandelt NULL als verschieden, deshalb ein Index über COALESCE
    sql: `
      CREATE UNIQUE INDEX termin_eindeutig
        ON termin (art, COALESCE(season, 0), COALESCE(nutzer, 0), faellig_am);
    `,
  },
  {
    version: 3,
    name: "abstimmung_sportart",
    sql: `
      -- Abstimmung über die Stufe einer neuen Sportart (Konzept 3.2)
      CREATE TABLE abstimmung (
        id            INTEGER PRIMARY KEY,
        gruppe        INTEGER NOT NULL REFERENCES gruppe(id) ON DELETE CASCADE,
        name          TEXT    NOT NULL,
        vorschlag     INTEGER CHECK (vorschlag IN (1, 2, 3)),
        antragsteller INTEGER NOT NULL REFERENCES nutzer(id),
        -- Training des Antragstellers, das nach der Entscheidung eingetragen wird
        minuten       INTEGER,
        datum         TEXT,
        nachricht_id  INTEGER,
        erstellt_am   TEXT    NOT NULL,
        beendet_am    TEXT,
        ergebnis      INTEGER CHECK (ergebnis IN (1, 2, 3))
      );
      CREATE UNIQUE INDEX abstimmung_offen ON abstimmung (gruppe, name COLLATE NOCASE) WHERE beendet_am IS NULL;

      CREATE TABLE stimme (
        abstimmung INTEGER NOT NULL REFERENCES abstimmung(id) ON DELETE CASCADE,
        nutzer     INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        faktor     INTEGER NOT NULL CHECK (faktor IN (1, 2, 3)),
        PRIMARY KEY (abstimmung, nutzer)
      );
    `,
  },
  {
    version: 4,
    name: "team_namen",
    sql: `
      -- Teamnamen pro Season eindeutig, damit /team Name beitreten oder anlegen kann
      CREATE UNIQUE INDEX team_name ON team (season, name COLLATE NOCASE);
    `,
  },
  {
    version: 5,
    name: "gamification",
    sql: `
      -- Einmalige Erfolge über alle Seasons
      CREATE TABLE erfolg (
        nutzer      INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
        art         TEXT    NOT NULL,
        erreicht_am TEXT    NOT NULL,                     -- YYYY-MM-DD
        PRIMARY KEY (nutzer, art)
      );

      -- Angekündigte Bosse: Stufe 1 in Woche 2, Stufe 2 (aufgepumpt) in der vorletzten Woche
      CREATE TABLE boss (
        season       INTEGER NOT NULL REFERENCES season(id) ON DELETE CASCADE,
        stufe        INTEGER NOT NULL CHECK (stufe IN (1, 2)),
        name         TEXT    NOT NULL,
        lebenspunkte INTEGER NOT NULL CHECK (lebenspunkte > 0),
        PRIMARY KEY (season, stufe)
      );
    `,
  },
  {
    version: 6,
    name: "boss_pin",
    sql: `
      -- Angepinnte Ankündigung des Bosses, wird mit dem Wochenbericht wieder gelöst
      ALTER TABLE boss ADD COLUMN pin_nachricht INTEGER;
    `,
  },
];
