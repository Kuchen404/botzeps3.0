/**
 * Kalendertage als ISO-Datum ("YYYY-MM-DD") in der Zeitzone der Gruppe.
 * Die Wertung rechnet nur mit ganzen Tagen, damit Sommer-/Winterzeit
 * und Uhrzeiten keine Rolle spielen.
 */
export type IsoDatum = string;

const MS_PRO_TAG = 86_400_000;
const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

function zuTagnummer(datum: IsoDatum): number {
  if (!ISO_DATUM.test(datum)) {
    throw new Error(`Ungültiges Datum: ${datum}`);
  }
  return Date.parse(`${datum}T00:00:00Z`) / MS_PRO_TAG;
}

export function plusTage(datum: IsoDatum, tage: number): IsoDatum {
  return new Date((zuTagnummer(datum) + tage) * MS_PRO_TAG).toISOString().slice(0, 10);
}

/** Anzahl Tage von `von` bis `bis` (negativ, wenn `bis` davor liegt). */
export function tageZwischen(von: IsoDatum, bis: IsoDatum): number {
  return zuTagnummer(bis) - zuTagnummer(von);
}

/** Liegt `datum` im geschlossenen Intervall [von, bis]? */
export function imZeitraum(datum: IsoDatum, von: IsoDatum, bis: IsoDatum): boolean {
  return datum >= von && datum <= bis;
}

/** Lokales Datum eines Zeitpunkts in einer Zeitzone, z. B. "Europe/Berlin". */
export function lokalesDatum(zeitpunkt: Date, zeitzone: string): IsoDatum {
  // en-CA formatiert als YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zeitzone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(zeitpunkt);
}

/**
 * UTC-Zeitpunkt für ein lokales Datum und eine Uhrzeit ("HH:MM") in einer Zeitzone,
 * z. B. Sonntag 20:00 in Berlin. Berücksichtigt Sommer- und Winterzeit.
 */
export function zeitpunktIn(datum: IsoDatum, uhrzeit: string, zeitzone: string): Date {
  const [stunde, minute] = uhrzeit.split(":").map(Number) as [number, number];
  const alsUtc = Date.parse(`${datum}T00:00:00Z`) + (stunde * 60 + minute) * 60_000;
  // Versatz der Zeitzone zu diesem Zeitpunkt bestimmen (zweimal, falls er dazwischen wechselt)
  let ergebnis = alsUtc;
  for (let i = 0; i < 2; i++) {
    ergebnis = alsUtc - versatzMs(new Date(ergebnis), zeitzone);
  }
  return new Date(ergebnis);
}

function versatzMs(zeitpunkt: Date, zeitzone: string): number {
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: zeitzone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(zeitpunkt);
  const wert = (typ: string) => Number(teile.find((t) => t.type === typ)?.value);
  const lokal = Date.UTC(wert("year"), wert("month") - 1, wert("day"), wert("hour"), wert("minute"), wert("second"));
  return lokal - Math.floor(zeitpunkt.getTime() / 1000) * 1000;
}
