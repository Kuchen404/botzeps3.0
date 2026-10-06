import type { Faktor } from "../scoring/fleiss.js";

/**
 * Vorschläge für Sportarten, die nicht in der Startliste stehen, nach dem
 * Compendium of Physical Activities (gerundete MET-Werte, typische Ausführung).
 * Stufen wie in der Startliste: leicht bis 4 MET, mittel 4,5–7, intensiv ab 7,5.
 */
const COMPENDIUM: Record<string, number> = {
  "angeln": 3.5,
  "aerobic": 7.3,
  "badminton": 5.5,
  "basketball": 8,
  "billard": 2.5,
  "bouldern": 8,
  "bowling": 3.8,
  "boxen": 7.8,
  "crossfit": 8,
  "eishockey": 8,
  "eislaufen": 7,
  "golf": 4.8,
  "handball": 12,
  "hockey": 7.8,
  "inlineskaten": 7.5,
  "inliner": 7.5,
  "judo": 10.3,
  "kajak": 5,
  "kanu": 5,
  "karate": 10.3,
  "kampfsport": 10.3,
  "kickboxen": 10.3,
  "langlauf": 9,
  "nordic walking": 4.8,
  "padel": 7,
  "reiten": 5.5,
  "rudern": 7,
  "rugby": 8.3,
  "seilspringen": 11.8,
  "skifahren": 5.3,
  "snowboarden": 5.3,
  "stand up paddling": 6,
  "sup": 6,
  "surfen": 3,
  "tai chi": 3,
  "tennis": 7.3,
  "trampolin": 3.5,
  "treppensteigen": 8.8,
  "volleyball": 4,
  "beachvolleyball": 8,
  "walken": 4.3,
  "wasserball": 10,
  "zumba": 6.5,
};

export function faktorAusMet(met: number): Faktor {
  if (met >= 7.5) return 3;
  if (met >= 4.5) return 2;
  return 1;
}

export function compendiumVorschlag(name: string): { faktor: Faktor; met: number } | undefined {
  const met = COMPENDIUM[name.trim().toLocaleLowerCase("de")];
  return met === undefined ? undefined : { faktor: faktorAusMet(met), met };
}

export const MAX_NAME = 20;

/** Bereinigt einen Sportart-Namen („stand up  paddling“ → „Stand up paddling“), oder null wenn ungültig. */
export function sportartName(eingabe: string): string | null {
  const name = eingabe.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > MAX_NAME) return null;
  if (!/^[\p{L}][\p{L}\d \-]*$/u.test(name)) return null;
  return name.charAt(0).toLocaleUpperCase("de") + name.slice(1);
}

/**
 * Ergebnis einer Abstimmung: die Stufe mit den meisten Stimmen. Bei Gleichstand
 * gewinnt der Compendium-Vorschlag, sonst die mittlere bzw. niedrigere Stufe.
 * Ohne Stimmen gilt der Vorschlag oder „mittel“ (wie im Konzept ohne Angabe).
 */
export function entscheide(stimmen: readonly Faktor[], vorschlag?: Faktor): Faktor {
  const anzahl = new Map<Faktor, number>([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  for (const s of stimmen) anzahl.set(s, anzahl.get(s)! + 1);
  const max = Math.max(...anzahl.values());
  if (max === 0) return vorschlag ?? 2;
  const vorne = ([1, 2, 3] as const).filter((f) => anzahl.get(f) === max);
  if (vorne.length === 1) return vorne[0]!;
  if (vorschlag && vorne.includes(vorschlag)) return vorschlag;
  if (vorne.includes(2)) return 2;
  return vorne[0]!;
}

/** Nötige Stimmen, damit eine Abstimmung sofort entschieden ist: die Hälfte der Gruppe, aufgerundet. */
export function noetigeStimmen(mitglieder: number): number {
  return Math.max(1, Math.ceil(mitglieder / 2));
}
