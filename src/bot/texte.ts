export const HILFE = `Botzeps 3.0 – Sport in der Gruppe, mit Punkten und ohne Gnade.

So läuft's:
• Fleiß: Jede Einheit zählt als Minuten × Faktor der Sportart (leicht ×1, mittel ×2, intensiv ×3). Wochenziel 300, das gibt 10 Punkte, maximal 15.
• Fortschritt: Fett- und Muskelmasse von der Waage, relativ zum Startwert aus der Kalibrierwoche.

Befehle:
/start – anmelden
/sport 45 Joggen – Training eintragen (wird in der Gruppe gepostet), auch „gestern“ oder „vorgestern“ am Ende
/sport – dasselbe mit Knöpfen
/waage 82,4 18,5 41,2 – Gewicht, Fett %, Muskel % (nur privat)
/sportarten – welche Sportart wie zählt
/hilfe – diese Hilfe

Bald: /stand, /rangliste, /season`;

export const MITMACHEN_KNOPF = "Ich bin dabei 💪";

export function gruppenBegruessung(gruppe: string): string {
  return `Botzeps ist in „${gruppe}“ angekommen. Wer mitmachen will, drückt den Knopf. Wer nicht drückt, ist raus und wird trotzdem ausgelacht.`;
}

export function willkommenPrivat(name: string): string {
  return `Servus ${name}, du bist angemeldet. Hier im privaten Chat trägst du später Messungen ein, die sieht außer dir keiner.\n\n/hilfe zeigt, wie alles funktioniert.`;
}

export function mitgliedNeu(name: string): string {
  return `${name} ist dabei. Die Couch weint jetzt schon.`;
}

export function mitgliedSchonDabei(): string {
  return "Du bist schon dabei. Zweimal anmelden gibt keine doppelten Punkte.";
}
