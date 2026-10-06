import sammlung from "./sprueche.json" with { type: "json" };

export type Kategorie = Exclude<keyof typeof sammlung, "_info">;

export type Platzhalter = Partial<
  Record<"name" | "platz" | "punkte" | "abstand" | "minuten" | "sportart" | "serie" | "opfer" | "rang" | "boss", string | number>
>;

export const SPRUECHE: Readonly<Record<Kategorie, readonly string[]>> = sammlung;

/** Setzt `{name}`, `{platz}` usw. ein; unbekannte Platzhalter bleiben stehen. */
export function fuelle(vorlage: string, werte: Platzhalter): string {
  return vorlage.replace(/\{(\w+)\}/g, (roh, schluessel: string) => {
    const wert = werte[schluessel as keyof Platzhalter];
    return wert === undefined ? roh : String(wert);
  });
}

/** Kategorie für die Rangliste nach Platz: Erster, Letzter, oberes/unteres Drittel, Mitte. */
export function platzKategorie(platz: number, anzahl: number): Kategorie {
  if (platz === 1) return "platz1";
  if (platz === anzahl) return "letzter";
  const anteil = platz / anzahl;
  if (anteil <= 1 / 3) return "oben";
  if (anteil > 2 / 3) return "unten";
  return "mitte";
}

/**
 * Wählt zufällig einen Spruch der Kategorie, aber nicht `vorheriger`
 * (damit niemand zweimal hintereinander denselben bekommt).
 */
export function waehleSpruch(
  kategorie: Kategorie,
  vorheriger?: string,
  zufall: () => number = Math.random,
): string {
  const alle = SPRUECHE[kategorie];
  const auswahl = alle.length > 1 ? alle.filter((s) => s !== vorheriger) : alle;
  const index = Math.min(Math.floor(zufall() * auswahl.length), auswahl.length - 1);
  const spruch = auswahl[index];
  if (spruch === undefined) throw new Error(`Keine Sprüche in Kategorie ${kategorie}`);
  return spruch;
}
