/** Teams bilden (Konzept 7): ausbalanciert auslosen und Namen prüfen. */

export const TEAMNAMEN = [
  "Bizeps-Brigade",
  "Die Couchkartoffeln",
  "Team Wampe",
  "Die Eisenfresser",
  "Proteinjunkies",
  "Schweißfüße United",
  "Die Hantelhelden",
  "Muskelkater AG",
  "Speckweg-Kommando",
  "Die Pumper",
] as const;

export const MAX_TEAMNAME = 30;

/** Bereinigter Teamname oder null, wenn ungültig. */
export function teamName(eingabe: string): string | null {
  const name = eingabe.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > MAX_TEAMNAME) return null;
  if (!/^[\p{L}\d][\p{L}\d \-!.&']*$/u.test(name)) return null;
  return name;
}

function mische<T>(liste: readonly T[], zufall: () => number): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(zufall() * (i + 1)), i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Verteilt Teilnehmer auf `anzahl` Teams, Größen unterscheiden sich höchstens um 1.
 * Wer eine Stärke hat (z. B. Punkte der letzten Season), wird per Schlangen-Draft verteilt
 * (1-2-3-3-2-1 …), damit die Stärksten nicht im selben Team landen; der Rest zufällig dahinter.
 */
export function verteile<T extends { staerke: number | null }>(
  teilnehmer: readonly T[],
  anzahl: number,
  zufall: () => number = Math.random,
): T[][] {
  const teams: T[][] = Array.from({ length: anzahl }, () => []);
  const bekannt = mische(
    teilnehmer.filter((t) => t.staerke !== null),
    zufall,
  ).sort((a, b) => b.staerke! - a.staerke!);
  const reihenfolge = [...bekannt, ...mische(teilnehmer.filter((t) => t.staerke === null), zufall)];
  reihenfolge.forEach((t, i) => {
    const runde = Math.floor(i / anzahl);
    const pos = i % anzahl;
    teams[runde % 2 === 0 ? pos : anzahl - 1 - pos]!.push(t);
  });
  return teams;
}

/** `anzahl` verschiedene Namen aus der Liste, zufällig. */
export function teamnamen(anzahl: number, zufall: () => number = Math.random): string[] {
  const namen = mische(TEAMNAMEN, zufall);
  return Array.from({ length: anzahl }, (_, i) => namen[i] ?? `Team ${i + 1}`);
}
