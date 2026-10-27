/** Zerlegt Eingaben wie `/sport 45 Joggen gestern` und `/waage 82,4 18,5 41,2`. */

export const GRENZEN = {
  minuten: { min: 5, max: 240 },
  gewichtKg: { min: 35, max: 250 },
  fettPct: { min: 3, max: 60 },
  muskelPct: { min: 20, max: 90 },
  /** Kein Rückdatieren über 2 Tage hinaus (Konzept 4). */
  maxTageZurueck: 2,
} as const;

const TAGE_ZURUECK: Record<string, number> = { heute: 0, gestern: 1, vorgestern: 2 };

export type Ergebnis<T> = { ok: true; wert: T } | { ok: false; fehler: string };

export interface SportEingabe {
  minuten?: number;
  sportart?: string;
  tageZurueck: number;
}

function zahl(text: string): number | null {
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  return Number(text.replace(",", "."));
}

function tageZurueck(woerter: string[]): number {
  const letztes = woerter.at(-1)?.toLocaleLowerCase("de");
  if (letztes !== undefined && letztes in TAGE_ZURUECK) {
    woerter.pop();
    return TAGE_ZURUECK[letztes]!;
  }
  return 0;
}

/** `45 Joggen`, `Joggen 45`, `45`, `Joggen`, jeweils optional mit `gestern`/`vorgestern` am Ende. */
export function parseSport(text: string): Ergebnis<SportEingabe> {
  const woerter = text.trim().split(/\s+/).filter(Boolean);
  const tage = tageZurueck(woerter);
  let minuten: number | undefined;
  const rest: string[] = [];
  for (const wort of woerter) {
    const z = zahl(wort.replace(/min$/i, ""));
    if (z !== null && minuten === undefined) minuten = z;
    else if (/^min(uten)?$/i.test(wort) && minuten !== undefined) continue;
    else rest.push(wort);
  }
  if (minuten !== undefined) {
    if (!Number.isInteger(minuten)) return { ok: false, fehler: "Minuten bitte als ganze Zahl." };
    if (minuten < GRENZEN.minuten.min || minuten > GRENZEN.minuten.max) {
      return { ok: false, fehler: `Dauer muss zwischen ${GRENZEN.minuten.min} und ${GRENZEN.minuten.max} Minuten liegen.` };
    }
  }
  const sportart = rest.join(" ") || undefined;
  return {
    ok: true,
    wert: { tageZurueck: tage, ...(minuten !== undefined ? { minuten } : {}), ...(sportart ? { sportart } : {}) },
  };
}

export interface WaageEingabe {
  gewichtKg: number;
  fettPct: number;
  muskelPct: number;
  tageZurueck: number;
}

/** Muskelmasse in kg als Anteil am Gewicht, auf zwei Stellen gerundet (entspricht der Muskelrate). */
export function muskelKgInProzent(muskelKg: number, gewichtKg: number): number {
  return Math.round((muskelKg / gewichtKg) * 10000) / 100;
}

/**
 * Drei Zahlen in fester Reihenfolge: Gewicht (kg), Fett %, Muskel %. Komma oder Punkt.
 * Steht hinter dem Muskelwert „kg“, ist es Muskelmasse und wird in Prozent vom Gewicht umgerechnet.
 */
export function parseWaage(text: string): Ergebnis<WaageEingabe> | null {
  // Einheiten an die Zahl davor hängen, dann sind sie Teil desselben Worts
  const woerter = text.trim().replace(/(\d)\s+(%|kg)/gi, "$1$2").split(/\s+/).filter(Boolean);
  if (woerter.length === 0) return null;
  const tage = tageZurueck(woerter);
  const zahlen = woerter.map((w) => zahl(w.replace(/(%|kg)$/i, "")));
  if (zahlen.length !== 3 || zahlen.some((z) => z === null)) {
    return { ok: false, fehler: "Bitte genau drei Zahlen: Gewicht, Fett %, Muskel %. Beispiel: /waage 82,4 18,5 41,2" };
  }
  const [gewichtKg, fettPct, muskel] = zahlen as [number, number, number];
  const muskelPct = /kg$/i.test(woerter[2]!) ? muskelKgInProzent(muskel, gewichtKg) : muskel;
  const fehler = pruefeWaage({ gewichtKg, fettPct, muskelPct });
  if (fehler) return { ok: false, fehler };
  return { ok: true, wert: { gewichtKg, fettPct, muskelPct, tageZurueck: tage } };
}

/** Plausibilität einer Messung, `null` wenn alles passt, sonst der Fehlertext. */
export function pruefeWaage(m: { gewichtKg: number; fettPct: number; muskelPct: number }): string | null {
  const pruefe = (wert: number, g: { min: number; max: number }, was: string, einheit: string) =>
    !Number.isFinite(wert) || wert < g.min || wert > g.max ? `${was} ${wert} ${einheit} ist unplausibel (erlaubt ${g.min}–${g.max}).` : null;
  return (
    pruefe(m.gewichtKg, GRENZEN.gewichtKg, "Gewicht", "kg") ??
    pruefe(m.fettPct, GRENZEN.fettPct, "Fett", "%") ??
    pruefe(m.muskelPct, GRENZEN.muskelPct, "Muskel", "%") ??
    (m.fettPct + m.muskelPct > 100 ? "Fett und Muskel zusammen über 100 %? Da stimmt was nicht." : null)
  );
}

/** Ab diesen Sprüngen gegenüber dem 7-Tage-Mittel muss eine Messung bestätigt werden. */
export const SPRUNG = { fettProzentpunkte: 3, gewichtKg: 3 } as const;

export function istSprung(
  neu: { gewichtKg: number; fettPct: number },
  mittel: { gewichtKg: number; fettPct: number } | null,
): boolean {
  if (!mittel) return false;
  return (
    Math.abs(neu.fettPct - mittel.fettPct) > SPRUNG.fettProzentpunkte ||
    Math.abs(neu.gewichtKg - mittel.gewichtKg) > SPRUNG.gewichtKg
  );
}
