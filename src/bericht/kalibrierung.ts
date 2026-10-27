import type { SeasonZeile } from "../db/season-repo.js";
import { plusTage, tageZwischen, zeitpunktIn } from "../scoring/datum.js";
import { FORTSCHRITT } from "../scoring/fortschritt.js";
import { kalibrierFenster } from "../scoring/season.js";
import type { Stand } from "./stand.js";

/**
 * Countdown in der Kalibrierwoche: jeden Abend ein Beitrag in der Gruppe mit Stand der Messungen,
 * einem Häppchen Erklärung und etwas Vorfreude, am Starttag morgens der Startschuss.
 * Der erste Beitrag, den die Gruppe bekommt, erklärt Waage und Punkte komplett.
 */
export const COUNTDOWN_UHRZEIT = "18:00";
export const STARTSCHUSS_UHRZEIT = "08:00";
/** War der Bot länger weg, verfällt ein Beitrag, statt verspätet zu kommen. */
export const COUNTDOWN_VERFALL_MS = 6 * 60 * 60 * 1000;

type CountdownSeason = Pick<SeasonZeile, "name" | "start" | "wochen" | "wochenziel_last" | "gewicht_fleiss">;

/** Zeitpunkt des Beitrags an Tag `tag` relativ zum Start (−7 bis −1 abends, 0 morgens). */
export function countdownZeitpunkt(s: Pick<SeasonZeile, "start">, tag: number, zeitzone: string): Date {
  return zeitpunktIn(plusTage(s.start, tag), tag === 0 ? STARTSCHUSS_UHRZEIT : COUNTDOWN_UHRZEIT, zeitzone);
}

/** Alle Termine von 7 Tagen vor dem Start bis zum Starttag. */
export function countdownTermine(s: Pick<SeasonZeile, "start">, zeitzone: string): Date[] {
  return Array.from({ length: FORTSCHRITT.fensterTage + 1 }, (_, i) => countdownZeitpunkt(s, i - FORTSCHRITT.fensterTage, zeitzone));
}

const d = (datum: string) => datum.split("-").reverse().join(".");

/** Wer mit Waage noch keine 3 Messungen in der Kalibrierwoche hat. */
function offen(staende: readonly Stand[]): Stand[] {
  return staende.filter((st) => !st.ohneWaage && st.kalibrierMessungen < FORTSCHRITT.minMessungenKalibrierung);
}

function standZeilen(staende: readonly Stand[]): string[] {
  const mitWaage = staende.filter((st) => !st.ohneWaage);
  const fehlen = offen(staende);
  const ohne = staende.length - mitWaage.length;
  const kopf = `📋 Kalibrierung: ${mitWaage.length - fehlen.length} von ${mitWaage.length} haben ihre ${FORTSCHRITT.minMessungenKalibrierung} Messungen.${ohne ? ` ${ohne} ohne Waage dabei.` : ""}`;
  if (fehlen.length === 0) return [`${kopf} Alle durch, ihr Streber. 🤓`];
  return [kopf, `Noch offen: ${fehlen.map((st) => `${st.name} (${st.kalibrierMessungen}/${FORTSCHRITT.minMessungenKalibrierung})`).join(", ")}`];
}

/** Die komplette Erklärung zu Waage und Punkten, für den ersten Beitrag der Woche. */
export function erklaerung(s: CountdownSeason): string[] {
  const k = kalibrierFenster(s, s.start);
  const gewichtung =
    s.gewicht_fleiss === 50 ? "Fleiß und Fortschritt zählen gleich viel" : `Fleiß zählt ${s.gewicht_fleiss} %, Fortschritt ${100 - s.gewicht_fleiss} %`;
  return [
    "⚖️ DIE WAAGE",
    `Bis ${d(k.bis)} mindestens ${FORTSCHRITT.minMessungenKalibrierung}× wiegen, privat beim Bot: /waage 82,4 18,5 41,2 (Gewicht, Fett %, Muskel %) oder in der Mini App. Der Mittelwert aller Messungen dieser Woche ist euer Startwert. Mehr Messungen, genauerer Startwert.`,
    "Immer gleich wiegen: morgens, nach dem Klo, vor Essen und Trinken, dieselbe Waage.",
    "",
    "🧮 DIE PUNKTE",
    `💪 Fleiß: Minuten × Faktor der Sportart (×1, ×2, ×3). ${s.wochenziel_last} Lastpunkte pro Woche bringen 10 Punkte, mehr als 15 gibt's nicht. Trainings zählen ab ${d(s.start)}, vorher nicht.`,
    "⚖️ Fortschritt: Aus Gewicht und Prozenten rechnet der Bot eure Fett- und Muskelmasse in kg. Gezählt wird, wie viel Prozent davon ihr gegenüber dem Startwert verliert bzw. zulegt:",
    `• 1 % weniger Fett = ${FORTSCHRITT.punkteProProzentFett} Punkte`,
    `• 1 % mehr Muskel = ${FORTSCHRITT.punkteProProzentMuskel} Punkte`,
    `• Wer sich mästet, rutscht ins Minus, höchstens bis −${Math.abs(FORTSCHRITT.untergrenze)}.`,
    "Weil's relativ ist, haben die Dicken keinen Vorteil und die Dünnen keine Ausrede.",
    "",
    `${gewichtung}. Eure Waagenwerte sieht keiner, in der Gruppe stehen nur Punkte. Keine Körperfettwaage? /ohnewaage bis ${d(k.bis)}, dann kriegt ihr den Median der Gruppe.`,
  ];
}

/** Häppchen für die Abende nach der großen Erklärung (Index = Tage seit Beginn der Kalibrierwoche). */
function haeppchen(s: CountdownSeason, tagImFenster: number): string[] {
  switch (tagImFenster) {
    case 1:
      return [
        "🧮 Rechenbeispiel, damit keiner jammert:",
        "Startwert 90 kg bei 25 % Fett = 22,5 kg Fett. Am Ende 21,4 kg, das sind 5 % weniger = 50 Punkte.",
        "Muskel von 36 kg auf 36,4 kg, das ist 1 % mehr = 30 Punkte.",
        "Ein 120-kg-Schrank mit denselben Prozenten kriegt exakt dieselben Punkte. Fair, oder?",
      ];
    case 2:
      return [
        "💪 Fleiß, kurz erklärt: Minuten × Faktor. 45 Minuten Joggen (×3) sind 135 Lastpunkte, 45 Minuten Spazieren (×1) sind 45.",
        `${s.wochenziel_last} Lastpunkte pro Woche sind das Ziel. Welche Sportart wie zählt: /sportarten. Fehlt eure? /sportart Name, die Gruppe stimmt ab.`,
      ];
    case 3:
      return [
        "🕵️ Schummeln lohnt nicht: Euer aktueller Wert ist der Mittelwert der letzten 7 Tage. Einmal hungern vor dem Wiegen bringt nix, einmal Döner auch nicht. Was zählt, ist der Trend.",
        "Und wer sich in der Kalibrierwoche extra fett frisst, um danach zu glänzen: Wir sehen uns beim Wochenbericht. 👀",
      ];
    case 4:
      return [
        "🔒 Eure Waagenwerte sieht keiner. Nicht die Gruppe, nicht die Rangliste. Nur ihr, privat in /stand und in der Mini App.",
        `Keine Körperfettwaage? /ohnewaage, dann kriegt ihr den Median der Gruppe. Geht nur bis ${d(kalibrierFenster(s, s.start).bis)}, danach ist's fest.`,
      ];
    case 5:
      return [
        "🐉 Was euch erwartet: Irgendwann taucht ein Boss auf, den ihr nur mit Training wegprügelt. Dazwischen laufen Minispiele, und jeden Sonntag gibt's den Wochenbericht mit der Roten Laterne für den Faulsten.",
        "Mehr wird nicht verraten. 🤐",
      ];
    default:
      return [];
  }
}

/** Derbe Vorfreude, ein Spruch pro Abend. */
const VORFREUDE: readonly string[] = [
  "Die Couch hat schon Trennungsangst. 🛋️😢",
  "Letzte Tage, um sich das Training schönzureden. Bald zählt jede Minute. ⏱️",
  "Die Waage lügt nicht. Ihr schon, aber nicht mehr lange. ⚖️",
  "Irgendwer hier hält bald die Rote Laterne. Schaut euch in der Gruppe um. 🏮",
  "Kauft schon mal Magnesium. Und Taschentücher für die Verlierer. 🧻",
  "Bald gibt's keine Ausreden mehr. Nur noch Punkte und Schande. 🔥",
  "Heute noch mal ordentlich reinhauen? Ab morgen wird abgerechnet. 😈",
];

/** Text zu Tag `tag` (−7 bis −1 Countdown, 0 Startschuss); `erstmals`: die große Erklärung mitschicken. */
export function countdownText(s: CountdownSeason, staende: readonly Stand[], tag: number, erstmals: boolean): string {
  const fehlen = offen(staende);
  if (tag === 0) {
    return [
      `🔔🔔🔔 STARTSCHUSS! „${s.name}“ läuft. 🔔🔔🔔`,
      "",
      `${s.wochen} Wochen. Ab heute zählt jede Trainingsminute: /sport 45 Joggen oder in der Mini App. Jedes Training wird hier gepostet, also lasst euch nicht lumpen.`,
      "Weiter wiegen, am besten jeden zweiten Tag, sonst stimmt euer Fortschritt nicht. /waage",
      "",
      fehlen.length
        ? `Ohne Startwert und damit ohne Fortschrittspunkte: ${fehlen.map((st) => st.name).join(", ")}. Gratuliere, ihr spielt mit einem Bein. 🦵`
        : "Alle haben ihren Startwert. Keine Ausreden mehr. 💀",
      "",
      "Möge der Fleißigste gewinnen und der Faulste sich schämen. 🏮",
    ].join("\n");
  }
  const k = kalibrierFenster(s, s.start);
  const tageBisStart = -tag;
  const tagImFenster = tageZwischen(k.von, plusTage(s.start, tag));
  const teile = [
    tageBisStart === 1 ? `⏳ MORGEN GEHT'S LOS! „${s.name}“ startet am ${d(s.start)}.` : `⏳ Noch ${tageBisStart} Tage bis „${s.name}“ (Start ${d(s.start)}).`,
    "",
    ...standZeilen(staende),
  ];
  if (tageBisStart === 1 && fehlen.length) {
    teile.push(
      "",
      `🚨 Heute ist der letzte Tag der Kalibrierwoche! ${fehlen.map((st) => st.name).join(", ")}: Ohne ${FORTSCHRITT.minMessungenKalibrierung} Messungen kein Startwert, ohne Startwert die ganze Season keine Fortschrittspunkte. Ab auf die Waage. /waage`,
    );
  }
  if (erstmals) teile.push("", ...erklaerung(s));
  else if (tageBisStart > 1) {
    const h = haeppchen(s, tagImFenster);
    if (h.length) teile.push("", ...h);
    if (fehlen.length) teile.push("", "Morgen früh, vor dem Frühstück: /waage. ⚖️");
  }
  teile.push("", VORFREUDE[Math.min(VORFREUDE.length - 1, Math.max(0, tagImFenster))]!);
  return teile.join("\n");
}
