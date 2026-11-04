import type { Faktor } from "../scoring/fleiss.js";
import { faktorAusMet } from "./sportarten.js";

/** Eine Zeile aus dem 2024 Adult Compendium of Physical Activities. */
interface Eintrag {
  met: number;
  code: string;
  alltag?: boolean;
}

const e = (met: number, code: string, alltag?: true): Eintrag => ({ met, code, ...(alltag ? { alltag } : {}) });

/**
 * Vorschläge für Sportarten, die nicht in der Startliste stehen, mit deutschen Namen und
 * Synonymen. Werte und Codes aus dem 2024 Adult Compendium (pacompendium.com), jeweils
 * die typische Ausführung. Alltag (Garten, Putzen, Gassi …) zählt mindestens ×0,5 statt ×1.
 */
const COMPENDIUM: Record<string, Eintrag> = {
  // Ballsport
  badminton: e(5.5, "15030"),
  basketball: e(7.5, "15055"),
  beachvolleyball: e(8.0, "15725"),
  volleyball: e(4.0, "15710"),
  handball: e(12.0, "15320"),
  hockey: e(7.8, "15350"),
  feldhockey: e(7.8, "15350"),
  eishockey: e(8.0, "15360"),
  rugby: e(8.3, "15560"),
  tennis: e(6.8, "15675"),
  padel: e(6.0, "15680"),
  frisbee: e(3.0, "15240"),
  "ultimate frisbee": e(8.0, "15250"),
  golf: e(4.5, "15255"),
  minigolf: e(3.0, "15240"),
  wasserball: e(10.0, "18360"),
  // Kampfsport
  boxen: e(7.8, "15120"),
  boxsack: e(5.8, "15110"),
  kickboxen: e(7.3, "15457"),
  judo: e(11.3, "15433"),
  karate: e(10.3, "15430"),
  taekwondo: e(10.3, "15430"),
  "jiu jitsu": e(10.3, "15430"),
  kampfsport: e(10.3, "15430"),
  ringen: e(6.0, "15730"),
  fechten: e(6.0, "15200"),
  // Fitness
  aerobic: e(7.3, "03029"),
  zumba: e(7.3, "03029"),
  crossfit: e(7.5, "02040"),
  zirkeltraining: e(5.0, "02035"),
  kettlebell: e(9.8, "02058"),
  calisthenics: e(7.5, "02020"),
  rudergerät: e(7.3, "02070"),
  ergometer: e(7.3, "02070"),
  crosstrainer: e(5.0, "02048"),
  seilspringen: e(11.8, "15551"),
  trampolin: e(6.3, "15700"),
  treppensteigen: e(6.8, "17131"),
  "power yoga": e(4.0, "02160"),
  // Gehen, Laufen, Rad
  walken: e(4.8, "17200"),
  "nordic walking": e(5.3, "17304"),
  schneeschuhwandern: e(5.3, "19190"),
  mountainbike: e(8.5, "01009"),
  mtb: e(8.5, "01009"),
  "e-bike": e(6.0, "01084"),
  inlineskaten: e(7.5, "15591"),
  inliner: e(7.5, "15591"),
  rollschuh: e(7.0, "15590"),
  skateboard: e(5.0, "15580"),
  skaten: e(5.0, "15580"),
  // Wasser
  kanu: e(5.0, "18100"),
  kajak: e(5.0, "18100"),
  rudern: e(5.8, "18050"),
  sup: e(6.5, "18224"),
  "stand up paddling": e(6.5, "18224"),
  surfen: e(3.0, "18220"),
  aquafitness: e(5.5, "18355"),
  wassergymnastik: e(5.5, "18355"),
  schnorcheln: e(5.0, "18210"),
  tauchen: e(7.0, "18200"),
  wakeboard: e(6.0, "18150"),
  wasserski: e(6.0, "18150"),
  // Winter
  skifahren: e(6.3, "19160"),
  ski: e(6.3, "19160"),
  snowboarden: e(7.5, "19201"),
  snowboard: e(7.5, "19201"),
  langlauf: e(8.5, "19090"),
  eislaufen: e(7.0, "19030"),
  schlittschuh: e(7.0, "19030"),
  rodeln: e(7.0, "19180"),
  schlitten: e(7.0, "19180"),
  // Sonstiges
  bouldern: e(8.8, "15534"),
  reiten: e(5.5, "15370"),
  "tai chi": e(3.3, "15670"),
  qigong: e(3.3, "15670"),
  bogenschießen: e(4.3, "15010"),
  billard: e(2.5, "15080", true),
  darts: e(2.5, "15180", true),
  bowling: e(3.0, "15090", true),
  kegeln: e(3.0, "15090", true),
  // Alltag
  gartenarbeit: e(2.0, "08066", true),
  garten: e(2.0, "08066", true),
  "unkraut jäten": e(3.8, "08239", true),
  rasenmähen: e(5.5, "08095", true),
  "rasen mähen": e(5.5, "08095", true),
  "schnee schippen": e(5.3, "08195", true),
  schneeschippen: e(5.3, "08195", true),
  "gassi gehen": e(3.0, "17165", true),
  gassi: e(3.0, "17165", true),
  "hund ausführen": e(3.0, "17165", true),
  putzen: e(3.3, "05030", true),
  hausarbeit: e(3.3, "05030", true),
  staubsaugen: e(3.0, "05043", true),
  umzug: e(5.8, "05120", true),
  "möbel tragen": e(5.8, "05120", true),
  "schwer tragen": e(5.8, "05120", true),
  "platten tragen": e(5.8, "05120", true),
  "kisten tragen": e(5.8, "05120", true),
  "mit kindern spielen": e(3.5, "05175", true),
};

/** Link zum Selbst-Nachschauen; Faktor = MET − 3. */
export const COMPENDIUM_LINK = "https://pacompendium.com";

export interface Vorschlag {
  faktor: Faktor;
  met: number;
  code: string;
}

export function compendiumVorschlag(name: string): Vorschlag | undefined {
  const eintrag = COMPENDIUM[name.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")];
  return eintrag && { faktor: faktorAusMet(eintrag.met, eintrag.alltag), met: eintrag.met, code: eintrag.code };
}

export const MAX_NAME = 20;

/** Bereinigt einen Sportart-Namen („stand up  paddling“ → „Stand up paddling“), oder null wenn ungültig. */
export function sportartName(eingabe: string): string | null {
  const name = eingabe.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > MAX_NAME) return null;
  if (!/^[\p{L}][\p{L}\d \-]*$/u.test(name)) return null;
  return name.charAt(0).toLocaleUpperCase("de") + name.slice(1);
}

/** Abstimmungsknöpfe: „So anstrengend wie …“ mit Sportarten, die jeder kennt. */
export const VERGLEICHE: readonly { faktor: Faktor; wie: string; emoji: string }[] = [
  { faktor: 1, wie: "Yoga", emoji: "🧘" },
  { faktor: 2.5, wie: "Wandern", emoji: "🥾" },
  { faktor: 3, wie: "Kraft", emoji: "🏋️" },
  { faktor: 4.5, wie: "Joggen", emoji: "🏃" },
  { faktor: 6, wie: "Spinning", emoji: "🚴" },
];

/** Ohne Stimmen und ohne Vorschlag gilt der vorsichtigste Wert. */
export const OHNE_STIMMEN = 1;

/** Faktoren, für die in einer Abstimmung gestimmt werden darf: die Vergleiche und der Vorschlag. */
export function erlaubteFaktoren(vorschlag?: Faktor | null): Faktor[] {
  const liste = VERGLEICHE.map((v) => v.faktor);
  if (vorschlag != null && !liste.includes(vorschlag)) liste.push(vorschlag);
  return liste.sort((a, b) => a - b);
}

/**
 * Ergebnis einer Abstimmung: der Faktor mit den meisten Stimmen. Bei Gleichstand gewinnt
 * der Vorschlag aus der Tabelle, sonst der niedrigere Wert. Ohne Stimmen gilt der Vorschlag,
 * ohne Vorschlag ×1, damit nichts unbemerkt hoch einsteigt.
 */
export function entscheide(stimmen: readonly Faktor[], vorschlag?: Faktor): Faktor {
  if (stimmen.length === 0) return vorschlag ?? OHNE_STIMMEN;
  const anzahl = new Map<Faktor, number>();
  for (const s of stimmen) anzahl.set(s, (anzahl.get(s) ?? 0) + 1);
  const max = Math.max(...anzahl.values());
  const vorne = [...anzahl.entries()].filter(([, n]) => n === max).map(([f]) => f);
  if (vorne.length === 1) return vorne[0]!;
  if (vorschlag !== undefined && vorne.includes(vorschlag)) return vorschlag;
  return Math.min(...vorne);
}

/** Nötige Stimmen, damit eine Abstimmung sofort entschieden ist: die Hälfte der Gruppe, aufgerundet. */
export function noetigeStimmen(mitglieder: number): number {
  return Math.max(1, Math.ceil(mitglieder / 2));
}
