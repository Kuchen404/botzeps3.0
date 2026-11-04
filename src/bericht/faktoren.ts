import { type Sportart, faktorText } from "../domain/sportarten.js";

/** Wochenziel in Stunden, auf Viertel gerundet: „2½ Std.“, „1¼ Std.“, „15 Std.“ */
export function stundenText(minuten: number): string {
  const viertel = Math.round(minuten / 15);
  const ganz = Math.floor(viertel / 4);
  const rest = ["", "¼", "½", "¾"][viertel % 4]!;
  return `${ganz === 0 && rest ? "" : ganz}${rest} Std.`;
}

/**
 * Ankündigung der neuen Wertung in einer laufenden Season (Migration 12): wie lange man
 * je Faktor fürs Wochenziel braucht, was neu gerechnet wurde und wie man Varianten umstellt.
 */
export function faktorenAnkuendigung(sportarten: readonly Sportart[], wochenziel: number): string {
  const faktoren = [...new Set(sportarten.map((s) => s.faktor))].sort((a, b) => b - a);
  const zeilen = faktoren.map((f) => {
    const namen = sportarten
      .filter((s) => s.faktor === f)
      .map((s) => s.name)
      .sort((a, b) => a.localeCompare(b, "de"));
    return `${faktorText(f)} ${namen.join(", ")}: ${stundenText(wochenziel / f)}`;
  });
  return [
    "📢 Neue Wertung, die Gruppe hat entschieden: Mehr Schweiß, mehr Punkte. Spazierengehen lohnt sich kaum noch.",
    "",
    `So lange müsst ihr pro Woche ran, um das Wochenziel (jetzt ${wochenziel.toLocaleString("de-DE")} Lastpunkte) zu schaffen:`,
    ...zeilen,
    "",
    "✅ Alles seit Season-Start ist schon neu gerechnet, die erste Woche zählt für alle gleich.",
    "🚲 Radfahren, Tanzen und Schwimmen gibt's jetzt locker und sportlich. Alte Einträge zählen als locker. Wer sportlich war: in der App unter „Eintragen“ auf „War sportlich“ tippen.",
    "🚶 Spazieren mit Schritten zählt das Tempo, flott gehen bringt bis ×3: /sport 60 Spazierengehen 7200",
  ].join("\n");
}
