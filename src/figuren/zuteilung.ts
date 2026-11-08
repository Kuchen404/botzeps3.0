import type { Db } from "../db/index.js";
import { FIGUREN } from "./figuren.js";

export const ANZAHL_FIGUREN = FIGUREN.length;

/**
 * Figur je Mitglied einer Gruppe. Selbst gewählte Figuren bleiben, alle anderen bekommen
 * in Beitrittsreihenfolge (Nutzer-id) die erste noch freie. Sind alle vergeben, wird
 * reihum doppelt vergeben.
 */
export function teileFigurenZu(mitglieder: readonly { id: number; figur: number | null }[]): Map<number, number> {
  const ergebnis = new Map<number, number>();
  const belegt = new Set<number>();
  for (const m of mitglieder) {
    if (m.figur !== null && m.figur >= 0 && m.figur < ANZAHL_FIGUREN) {
      ergebnis.set(m.id, m.figur);
      belegt.add(m.figur);
    }
  }
  const offen = mitglieder.filter((m) => !ergebnis.has(m.id)).sort((a, b) => a.id - b.id);
  let naechste = 0;
  for (const m of offen) {
    while (naechste < ANZAHL_FIGUREN && belegt.has(naechste)) naechste++;
    const nr = naechste < ANZAHL_FIGUREN ? naechste : m.id % ANZAHL_FIGUREN;
    ergebnis.set(m.id, nr);
    belegt.add(nr);
  }
  return ergebnis;
}

export function figurenDerGruppe(db: Db, gruppeId: number): Map<number, number> {
  const zeilen = db
    .prepare("SELECT n.id, n.figur FROM gruppe_mitglied m JOIN nutzer n ON n.id = m.nutzer WHERE m.gruppe = ?")
    .all(gruppeId) as { id: number; figur: number | null }[];
  return teileFigurenZu(zeilen);
}

/**
 * Figuren, die andere Mitglieder in einer der Gruppen des Nutzers schon haben
 * (gewählt oder zugeteilt), mit dem Namen der Person.
 */
export function vergebeneFiguren(db: Db, nutzerId: number): Map<number, string> {
  const gruppen = db.prepare("SELECT gruppe FROM gruppe_mitglied WHERE nutzer = ?").all(nutzerId) as { gruppe: number }[];
  const vergeben = new Map<number, string>();
  for (const { gruppe } of gruppen) {
    const zeilen = db
      .prepare("SELECT n.id, n.name, n.figur FROM gruppe_mitglied m JOIN nutzer n ON n.id = m.nutzer WHERE m.gruppe = ?")
      .all(gruppe) as { id: number; name: string; figur: number | null }[];
    // Ohne den Nutzer selbst zuteilen: seine bisherige Figur gilt als frei
    const andere = zeilen.filter((z) => z.id !== nutzerId);
    for (const [id, nr] of teileFigurenZu(andere)) {
      if (!vergeben.has(nr)) vergeben.set(nr, andere.find((z) => z.id === id)!.name);
    }
  }
  return vergeben;
}

/** Eigene Figur: gewählt, sonst die Zuteilung in der zuletzt beigetretenen Gruppe. */
export function eigeneFigur(db: Db, nutzerId: number): { nr: number; gewaehlt: boolean } {
  const z = db.prepare("SELECT figur FROM nutzer WHERE id = ?").get(nutzerId) as { figur: number | null } | undefined;
  if (z?.figur !== null && z?.figur !== undefined) return { nr: z.figur, gewaehlt: true };
  const g = db.prepare("SELECT gruppe FROM gruppe_mitglied WHERE nutzer = ? ORDER BY seit DESC, gruppe DESC LIMIT 1").get(nutzerId) as
    | { gruppe: number }
    | undefined;
  return { nr: g ? (figurenDerGruppe(db, g.gruppe).get(nutzerId) ?? 0) : 0, gewaehlt: false };
}

export function setzeFigur(db: Db, nutzerId: number, nr: number | null): void {
  db.prepare("UPDATE nutzer SET figur = ? WHERE id = ?").run(nr, nutzerId);
}
