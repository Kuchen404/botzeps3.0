export const HILFE = `Botzeps 3.0 – Sport in der Gruppe, mit Punkten und ohne Gnade.

So läuft's:
• Fleiß: Jede Einheit zählt als Minuten × Faktor der Sportart (leicht ×1, mittel ×2, intensiv ×3). Wochenziel 300, das gibt 10 Punkte, maximal 15.
• Fortschritt: Fett- und Muskelmasse von der Waage, relativ zum Startwert aus der Kalibrierwoche.
• Jeden Sonntag um 20 Uhr kommt der Wochenbericht, am Ende das Finale mit Sonderpreisen.
• Boss-Wochen: In der 2. und der vorletzten Woche greift ein Boss an. Prügelt ihn mit euren Trainings weg, dann gibt's Bonuspunkte für alle, die mitgemacht haben.
• Ränge und Erfolge zählen über alle Seasons. Wer jemanden überholt, wird sofort gefeiert.

Befehle:
/start – anmelden
/sport 45 Joggen – Training eintragen (wird in der Gruppe gepostet), auch „gestern“ oder „vorgestern“ am Ende
/sport – dasselbe mit Knöpfen
/waage 82,4 18,5 41,2 – Gewicht, Fett %, Muskel % (nur privat)
/stand – dein Punktestand (privat mit Details)
/app – Mini App: Stand, Diagramme, Waage, Einträge, Einstellungen
/verlauf – letzte Einträge ändern oder löschen (bis 2 Tage zurück, nur privat)
/rangliste – wer vorne liegt und wer die Couch wärmt
/erfolge – deine Erfolge und dein Rang
/ruhmeshalle – Sieger, Ränge und Rekorde der Gruppe
/season Name – neue Season anlegen (in der Gruppe), /season zeigt die aktuelle
/teams – Teams anzeigen, vor dem Start auslosen (Ersteller oder Admins)
/team Name – Team beitreten oder gründen (bis zum Start)
/sportarten – welche Sportart wie zählt
/sportart Name – neue Sportart vorschlagen, die Gruppe stimmt über die Stufe ab
/erinnerungen – an, aus oder Uhrzeit (z. B. /erinnerungen 18:30)
/einfuehrung – was Fleiß und Fortschritt sind, kurz erklärt
/hilfe – diese Hilfe`;

export interface EinfuehrungSeason {
  /** Name der Season; ohne Season erklärt der Text die Standardwertung. */
  name?: string;
  gewichtFleiss: number;
  wochenzielLast: number;
  /** Kalibrierwoche der Season, für die konkreten Daten im Text. */
  kalibrierung?: { von: string; bis: string };
}

function gewichtungText(fleiss: number): string {
  if (fleiss === 50) return "Fleiß und Fortschritt zählen gleich viel.";
  return `Diese Season zählt Fleiß ${fleiss} % und Fortschritt ${100 - fleiss} %.`;
}

/** Kurze Einführung in die zwei Säulen, beim Anlegen der Season und per /einfuehrung. */
export function einfuehrung(s: EinfuehrungSeason, datum: (iso: string) => string): string {
  const kalibrierung = s.kalibrierung ? ` (${datum(s.kalibrierung.von)} – ${datum(s.kalibrierung.bis)})` : "";
  return [
    `📖 So läuft ${s.name ? `die Season „${s.name}“` : "Botzeps"}: zwei Säulen, am Ende gewinnt die höchste Summe.`,
    "",
    "💪 Fleiß: was du tust",
    `Jede Einheit zählt Minuten × Faktor der Sportart (leicht ×1, mittel ×2, intensiv ×3). ${s.wochenzielLast} Lastpunkte pro Woche sind das Ziel und bringen 10 Punkte, mehr als 15 gibt's nicht. Das sind z. B. 100 Minuten Joggen. Wer das Ziel 3 Wochen am Stück packt, kriegt Bonus.`,
    "",
    "⚖️ Fortschritt: was dein Körper draus macht",
    `In der Kalibrierwoche${kalibrierung} wiegst du dich mindestens 3× per /waage (privat), das ist dein Startwert. Danach zählt, wie viel Fett du davon verlierst und wie viel Muskel du zulegst, in Prozent deiner eigenen Werte. Wer schwerer ist, hat also keinen Vorteil. 1 % weniger Fett bringt 10 Punkte, 1 % mehr Muskel 30. Wer sich mästet, rutscht ins Minus (höchstens −50).`,
    "",
    `${gewichtungText(s.gewichtFleiss)} Wer nur schwitzt und weiter Döner frisst, verliert. Wer nur hungert und auf der Couch liegt, auch.`,
    "",
    "In der Gruppe stehen nur Punkte, deine Waagenwerte sieht keiner. /hilfe zeigt alle Befehle.",
  ].join("\n");
}

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
