import { type IsoDatum, plusTage } from "./datum.js";
import { FLEISS, type Faktor, type Wochenwertung } from "./fleiss.js";

interface ErfolgDef {
  titel: string;
  beschreibung: string;
  /** Verrät Bosse oder Minispiele: bis zum Freischalten unkenntlich. */
  geheim?: boolean;
  /** Schand-Erfolg: gibt's für Versagen, mit 💩 statt Pokal. */
  schande?: boolean;
}

/**
 * Einmalige Erfolge über alle Seasons, alle automatisch aus Trainings, Wertung, Bossen und Minispielen geprüft.
 * Die Reihenfolge ist die Anzeige-Reihenfolge in /erfolge und der Mini App.
 */
export const ERFOLGE = {
  erste_einheit: { titel: "Erster Schweißtropfen", beschreibung: "die erste Einheit eingetragen" },
  minuten_1000: { titel: "Tausendsassa", beschreibung: "1.000 Minuten Sport" },
  minuten_6000: { titel: "Hundert-Stunden-Hengst", beschreibung: "100 Stunden Sport" },
  minuten_30000: { titel: "Lebenslänglich", beschreibung: "500 Stunden Sport, das Sofa hat dich vergessen" },
  einheit_120: { titel: "Ausdauerbestie", beschreibung: "eine Einheit von mindestens 2 Stunden" },
  einheit_240: { titel: "Wahnsinn mit Methode", beschreibung: "eine Einheit von mindestens 4 Stunden" },
  sportarten_5: { titel: "Gemischtwarenladen", beschreibung: "5 verschiedene Sportarten" },
  sportarten_10: { titel: "Wühltisch", beschreibung: "10 verschiedene Sportarten, entscheide dich mal" },
  tage_7: { titel: "Durchgezogen", beschreibung: "7 Tage am Stück trainiert" },
  tage_14: { titel: "Besessen", beschreibung: "14 Tage am Stück trainiert" },
  wochenziel: { titel: "Pflicht erfüllt", beschreibung: "zum ersten Mal das Wochenziel geschafft" },
  deckel: { titel: "Übererfüllt", beschreibung: "150 % des Wochenziels in einer Woche" },
  serie_5: { titel: "Eiserne Disziplin", beschreibung: "5 Wochen in Folge das Wochenziel" },
  serie_10: { titel: "Unkaputtbar", beschreibung: "10 Wochen in Folge das Wochenziel" },
  laterne: { titel: "Schlusslicht", beschreibung: "zum ersten Mal die Rote Laterne kassiert", schande: true },
  laterne_3: { titel: "Dauerleuchte", beschreibung: "dreimal die Rote Laterne in einer Season", schande: true },
  podest: { titel: "Treppchen", beschreibung: "eine Season auf Platz 1 bis 3 beendet" },
  champion: { titel: "Champion", beschreibung: "eine Season gewonnen" },

  // Bosse
  bossbezwinger: { titel: "Drachentöter", beschreibung: "beim Sieg gegen einen Boss mitgeprügelt" },
  boss_gnadenstoss: { titel: "Gnadenstoß", beschreibung: "dem Boss den letzten Schlag verpasst" },
  boss_schlachter: { titel: "Schlachter", beschreibung: "beim Fall eines Bosses den meisten Schaden gemacht" },
  boss_volltreffer: { titel: "Wunder Punkt", beschreibung: "mit seiner Schwäche voll in die Fresse des Bosses", geheim: true },
  boss_abgeprallt: { titel: "Wattebausch", beschreibung: "mit der Resistenz-Sportart am Boss abgeprallt", geheim: true, schande: true },
  boss_aufgepumpt: { titel: "Steroid-Schlächter", beschreibung: "den aufgepumpten Boss trotz Spritzenkur umgehauen", geheim: true },
  boss_schweinehund: { titel: "Metzgermeister", beschreibung: "den inneren Schweinehund zu Mett verarbeitet", geheim: true },
  boss_doener: { titel: "Dönerbezwinger", beschreibung: "den Dönerteller XXL weggeprügelt, ohne zu kotzen", geheim: true },
  boss_sofa: { titel: "Sperrmüll", beschreibung: "das Sofa der Verdammnis zu Kleinholz verarbeitet", geheim: true },
  boss_bierbauch: { titel: "Königsmörder", beschreibung: "König Bierbauch vom Thron gekegelt", geheim: true },
  boss_chips: { titel: "Krümelmonster", beschreibung: "die Chipstüte des Grauens zerknüllt", geheim: true },
  boss_lieferdienst: { titel: "Annahme verweigert", beschreibung: "den Lieferdienst-Lord vom Roller getreten", geheim: true },
  boss_gemuetlich: { titel: "Faultierschreck", beschreibung: "Graf Gemütlich aus der Hängematte getreten", geheim: true },
  bossjaeger: { titel: "Bossjäger", beschreibung: "3 verschiedene Bosse erlegt" },

  // Minispiele
  zombie_ueberlebt: { titel: "Unbeißbar", beschreibung: "die Zombie-Woche als Mensch überlebt", geheim: true },
  zombie_gebissen: { titel: "Hirn ab", beschreibung: "in der Zombie-Woche gebissen worden", geheim: true, schande: true },
  bombe_bumm: { titel: "Konfetti", beschreibung: "von der Tickenden Bombe zerfetzt worden", geheim: true, schande: true },
  kopfgeld_jaeger: { titel: "Kopfgeldjäger", beschreibung: "den Gejagten der Woche zur Strecke gebracht", geheim: true },
  kopfgeld_unfassbar: { titel: "Unfassbar", beschreibung: "als Gejagter von keinem eingeholt", geheim: true },
  gipfel_erster: { titel: "Erstbesteiger", beschreibung: "als Erster die Fahne in den Gipfel gerammt", geheim: true },
  gipfel_basislager: { titel: "Teetrinker", beschreibung: "beim Gipfelsturm im Basislager versackt", geheim: true, schande: true },
  tauziehen_sieg: { titel: "Zugpferd", beschreibung: "das Tauziehen gewonnen", geheim: true },
  tauziehen_schlamm: { titel: "Schlammsau", beschreibung: "beim Tauziehen im Schlamm gelandet", geheim: true, schande: true },
  tresor_geknackt: { titel: "Panzerknacker", beschreibung: "den Tresor mitgeknackt", geheim: true },
  tresor_huhn: { titel: "Hühnchen", beschreibung: "beim Tresor keinen Finger gerührt", geheim: true, schande: true },
  duell_sieg: { titel: "Revolverheld", beschreibung: "ein Losduell gewonnen", geheim: true },
  duell_bot: { titel: "Vom Toaster verprügelt", beschreibung: "im Losduell gegen den Bot verloren", geheim: true, schande: true },
  spielkind: { titel: "Spielkind", beschreibung: "bei allen 7 Minispielen mitgemacht" },
} as const satisfies Record<string, ErfolgDef>;

export type ErfolgArt = keyof typeof ERFOLGE;

export const ERFOLG_ARTEN = Object.keys(ERFOLGE) as ErfolgArt[];

const def = (art: ErfolgArt): ErfolgDef => ERFOLGE[art];

/** Platzhalter für geheime Erfolge, die noch keiner freigeschaltet hat. */
export const GEHEIM = { titel: "???", beschreibung: "Geheimer Erfolg, mehr wird nicht verraten" } as const;

export function istGeheim(art: ErfolgArt): boolean {
  return def(art).geheim === true;
}

export function istSchande(art: ErfolgArt): boolean {
  return def(art).schande === true;
}

/** Titel und Beschreibung, wie sie jemand sehen darf: geheime erst nach dem Freischalten. */
export function sichtbar(art: ErfolgArt, erreicht: boolean): { titel: string; beschreibung: string } {
  if (!erreicht && istGeheim(art)) return GEHEIM;
  return { titel: ERFOLGE[art].titel, beschreibung: ERFOLGE[art].beschreibung };
}

/** Erfolg je Boss; unbekannte Namen (z. B. Bosse aus Tests) haben keinen eigenen. */
export const BOSS_ERFOLGE: Readonly<Record<string, ErfolgArt>> = {
  "Der innere Schweinehund": "boss_schweinehund",
  "Der Dönerteller XXL": "boss_doener",
  "Das Sofa der Verdammnis": "boss_sofa",
  "König Bierbauch": "boss_bierbauch",
  "Die Chipstüte des Grauens": "boss_chips",
  "Der Lieferdienst-Lord": "boss_lieferdienst",
  "Graf Gemütlich": "boss_gemuetlich",
};

/** So viele verschiedene Bosse braucht der Bossjäger. */
export const BOSSJAEGER_BOSSE = 3;

/** Erfolge für alle, die beim Sieg über einen Boss Schaden gemacht haben. */
export function bossSiegErfolge(boss: { name: string; stufe: number }): ErfolgArt[] {
  const eigener = BOSS_ERFOLGE[boss.name];
  return ["bossbezwinger", ...(eigener ? [eigener] : []), ...(boss.stufe === 2 ? (["boss_aufgepumpt"] as const) : [])];
}

/** Erfolge, die sich aus anderen Erfolgen ergeben (z. B. der Bossjäger aus den einzelnen Bossen). */
export function folgeErfolge(erreicht: Iterable<ErfolgArt>): ErfolgArt[] {
  const bosse = new Set(Object.values(BOSS_ERFOLGE));
  let anzahl = 0;
  for (const art of new Set(erreicht)) if (bosse.has(art)) anzahl++;
  return anzahl >= BOSSJAEGER_BOSSE ? ["bossjaeger"] : [];
}

/** Erfolge aus der Roten Laterne einer Woche; `anzahl` zählt die Laternen dieser Season samt dieser. */
export function laternenErfolge(anzahl: number): ErfolgArt[] {
  if (anzahl <= 0) return [];
  return anzahl >= 3 ? ["laterne", "laterne_3"] : ["laterne"];
}

export function erfolgText(art: ErfolgArt, nachtraeglich = false): string {
  return `${istSchande(art) ? "💩" : "🏆"} ${ERFOLGE[art].titel} (${ERFOLGE[art].beschreibung})${nachtraeglich ? " – nachträglich" : ""}`;
}

export interface ErfolgTraining {
  datum: IsoDatum;
  minuten: number;
  faktor: Faktor;
  sportart: string;
}

/** Längste Folge aufeinanderfolgender Tage mit mindestens einem Training. */
export function laengsteTagesserie(daten: readonly IsoDatum[]): number {
  const tage = new Set(daten);
  let beste = 0;
  for (const tag of tage) {
    if (tage.has(plusTage(tag, -1))) continue; // nur ab dem ersten Tag einer Folge zählen
    let laenge = 1;
    while (tage.has(plusTage(tag, laenge))) laenge++;
    beste = Math.max(beste, laenge);
  }
  return beste;
}

/** Ab dieser Länge ist eine Tagesserie der Rede wert (Erinnerung, Sonderpreis). */
export const TAGESSERIE_AB = 3;

/**
 * Laufende Tagesserie am Tag `heute`. Ein Tag ohne Training bricht sie, der heutige aber erst
 * um Mitternacht: Wer gestern trainiert hat und heute noch nicht, hat die Serie noch
 * (`heuteOffen`), muss sie aber heute retten.
 */
export function aktuelleTagesserie(daten: readonly IsoDatum[], heute: IsoDatum): { laenge: number; heuteOffen: boolean } {
  const tage = new Set(daten.filter((d) => d <= heute));
  const heuteOffen = !tage.has(heute);
  let tag = heuteOffen ? plusTage(heute, -1) : heute;
  let laenge = 0;
  while (tage.has(tag)) {
    laenge++;
    tag = plusTage(tag, -1);
  }
  return { laenge, heuteOffen: heuteOffen && laenge > 0 };
}

/** Alle Erfolge, die `trainingsErfolge` vergeben kann. Nur diese fallen weg, wenn ihr Eintrag gelöscht oder gekürzt wird. */
export const TRAININGS_ERFOLGE: readonly ErfolgArt[] = [
  "erste_einheit",
  "minuten_1000",
  "minuten_6000",
  "minuten_30000",
  "einheit_120",
  "einheit_240",
  "sportarten_5",
  "sportarten_10",
  "tage_7",
  "tage_14",
];

/** Erfolge, die sich aus allen Trainings eines Nutzers ergeben. */
export function trainingsErfolge(trainings: readonly ErfolgTraining[]): ErfolgArt[] {
  if (trainings.length === 0) return [];
  const erfolge: ErfolgArt[] = ["erste_einheit"];
  const minuten = trainings.reduce((s, t) => s + t.minuten, 0);
  if (minuten >= 1_000) erfolge.push("minuten_1000");
  if (minuten >= 6_000) erfolge.push("minuten_6000");
  if (minuten >= 30_000) erfolge.push("minuten_30000");
  const laengste = Math.max(...trainings.map((t) => t.minuten));
  if (laengste >= 120) erfolge.push("einheit_120");
  if (laengste >= 240) erfolge.push("einheit_240");
  const sportarten = new Set(trainings.map((t) => t.sportart.toLowerCase())).size;
  if (sportarten >= 5) erfolge.push("sportarten_5");
  if (sportarten >= 10) erfolge.push("sportarten_10");
  const serie = laengsteTagesserie(trainings.map((t) => t.datum));
  if (serie >= 7) erfolge.push("tage_7");
  if (serie >= 14) erfolge.push("tage_14");
  return erfolge;
}

/** Erfolge aus den Wochen einer Season. */
export function wochenErfolge(wochen: readonly Wochenwertung[], wochenziel: number): ErfolgArt[] {
  const erfolge: ErfolgArt[] = [];
  if (wochen.some((w) => w.zielErreicht)) erfolge.push("wochenziel");
  if (wochenziel > 0 && wochen.some((w) => w.last >= wochenziel * FLEISS.maxZielAnteil)) erfolge.push("deckel");
  const serie = Math.max(0, ...wochen.map((w) => w.serie));
  if (serie >= 5) erfolge.push("serie_5");
  if (serie >= 10) erfolge.push("serie_10");
  return erfolge;
}

/** Erfolge aus dem Endstand einer Season. */
export function finaleErfolge(platz: number): ErfolgArt[] {
  if (platz === 1) return ["champion", "podest"];
  return platz <= 3 ? ["podest"] : [];
}

/**
 * Meldezeilen für neu freigeschaltete Erfolge. Bei einer Person wie gehabt „X schaltet frei:“,
 * bei mehreren eine Zeile je Erfolg mit allen Namen, damit ein Bosssieg die Gruppe nicht zuspammt.
 */
export function freischaltZeilen(
  neu: readonly { name: string; arten: readonly ErfolgArt[] }[],
  /** Erfolge der ersten Person, die sie schon vor diesem Training verdient hatte (z. B. neu eingeführte) */
  nachtraeglich: ReadonlySet<ErfolgArt> = new Set(),
): string[] {
  const mit = neu.filter((e) => e.arten.length > 0);
  if (mit.length === 0) return [];
  if (mit.length === 1) return [`${mit[0]!.name} schaltet frei:`, ...mit[0]!.arten.map((art) => erfolgText(art, neu[0] === mit[0] && nachtraeglich.has(art)))];
  const proArt = new Map<ErfolgArt, string[]>();
  for (const e of mit) for (const art of e.arten) proArt.set(art, [...(proArt.get(art) ?? []), e.name]);
  return ["Freigeschaltet:", ...[...proArt].map(([art, namen]) => `${erfolgText(art)}: ${namen.join(", ")}`)];
}
