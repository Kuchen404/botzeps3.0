import type { BossStufe } from "../scoring/boss.js";

/**
 * Was jeder Boss sagt und was auf seinem Steckbrief steht. Platzhalter:
 * {opfer} (der, den er sich vornimmt), {namen} (Drückeberger bisher), {boss}.
 */
export interface BossTexte {
  /** Vorzeichen, kurz bevor er auftaucht */
  vorzeichen: string;
  /** Steckbrief */
  schwaeche: string;
  zuletztGesehen: string;
  /** Drohung zum Auftritt, in Ich-Form */
  drohung: string;
  /** Spott am Donnerstag, wenn noch zu wenig Schaden drin ist */
  spott: string;
}

const TEXTE: Record<string, BossTexte> = {
  "Der innere Schweinehund": {
    vorzeichen: "Irgendwo grunzt etwas. Es klingt nach „Ach, morgen reicht auch“.",
    schwaeche: "Wecker ohne Schlummertaste",
    zuletztGesehen: "in eurem Kopf, jeden Morgen um 6",
    drohung: "Ich bin in jedem von euch. {opfer}, bei dir wohn ich schon mietfrei. Diese Woche gewinn ich, wie immer.",
    spott: "Grunz. Donnerstag und ihr habt kaum gekratzt. {namen}, ihr seid mein Lieblingsteam.",
  },
  "Der Dönerteller XXL": {
    vorzeichen: "Es riecht nach Knoblauchsoße. Viel zu viel Knoblauchsoße.",
    schwaeche: "Treppen",
    zuletztGesehen: "nachts um 3 an der Dönerbude",
    drohung: "Mit alles und scharf, und gleich auch mit euch. {opfer}, dich hab ich am liebsten, du kommst eh jeden Abend vorbei.",
    spott: "Donnerstag, und ich bin immer noch warm und knusprig. {namen}, soll ich euch noch Pommes dazu machen?",
  },
  "Das Sofa der Verdammnis": {
    vorzeichen: "Ein tiefes Knarzen. Die Polster atmen. Die Fernbedienung ist verschwunden.",
    schwaeche: "Laufschuhe im Flur",
    zuletztGesehen: "im Wohnzimmer, mit einer Delle in Form von {opfer}",
    drohung: "Setz dich doch. Nur fünf Minuten. {opfer}, deine Delle ist noch warm, ich hab sie für dich freigehalten.",
    spott: "Donnerstag. Ihr liegt schon halb auf mir drauf. {namen}, macht's euch bequem, ihr bleibt eh hier.",
  },
  "König Bierbauch": {
    vorzeichen: "Ein Fass rollt durch den Gruppenchat. Jemand rülpst die Nationalhymne.",
    schwaeche: "alkoholfreies Weizen",
    zuletztGesehen: "auf dem Thron am Kühlschrank",
    drohung: "Kniet nieder vor eurem König! {opfer}, du darfst mir den Bauch einölen, mehr Training kriegst du diese Woche eh nicht hin.",
    spott: "Prost! Halbzeit vorbei und mein Bauch ist unversehrt. {namen}, ihr seid ab jetzt meine Mundschenke.",
  },
  "Die Chipstüte des Grauens": {
    vorzeichen: "Es raschelt. Im Dunkeln. Und es hört nicht auf zu rascheln.",
    schwaeche: "Gemüsesticks",
    zuletztGesehen: "neben der Couch, halb leer und voller Krümel",
    drohung: "Einmal aufgerissen, kein Zurück. {opfer}, deine Finger sind schon fettig, ich seh's von hier.",
    spott: "Knusper knusper, Donnerstag. Ihr habt mich kaum angeknabbert. {namen}, nehmt doch noch eine Handvoll.",
  },
  "Der Lieferdienst-Lord": {
    vorzeichen: "Es klingelt. Draußen steht niemand. Nur ein Pizzakarton und ein Zettel: „Bin gleich da.“",
    schwaeche: "selbst kochen",
    zuletztGesehen: "in der Liefer-App von {opfer}, Bestellung Nummer 412",
    drohung: "Euer Lord hat geliefert! {opfer}, du bist mein bester Kunde. Bleib ruhig sitzen, ich bring dir alles an die Couch.",
    spott: "Donnerstag, und meine Lieferung ist noch voll. {namen}, ich hab euch extra Käse auf den Rand gemacht.",
  },
  "Graf Gemütlich": {
    vorzeichen: "Die Zeit wird langsamer. Alle gähnen. Ein Faultier im Frack betritt den Raum. Sehr. Langsam.",
    schwaeche: "Koffein",
    zuletztGesehen: "in der Hängematte, seit drei Wochen",
    drohung: "Guten Abend, meine Herrschaften. Ich habe Zeit. Sehr viel Zeit. {opfer}, wir zwei haben viel gemeinsam. Vor allem die Geschwindigkeit.",
    spott: "Ahh, Donnerstag. Ich habe kaum einen Kratzer, und ich bin nicht mal wach. {namen}, ihr seid ja langsamer als ich.",
  },
};

export function bossTexte(name: string): BossTexte {
  return TEXTE[name] ?? TEXTE["Der innere Schweinehund"]!;
}

/** Die erste Etappe des Auftritts. */
export function bossBeben(stufe: BossStufe, kamSchonMal: boolean): string {
  if (stufe === 1) return "⚠️ Achtung. Der Boden bebt. Irgendwas kommt auf euch zu.";
  return kamSchonMal
    ? "⚠️ Aus dem Keller kommen Geräusche. Hantelklirren. Stöhnen. Das Klicken einer Spritze."
    : "⚠️ Achtung. Der Boden bebt, und diesmal ist es was Großes.";
}

/** Teaser am Abend vor der Boss-Woche. */
export function bossTeaser(stufe: BossStufe, kamSchonMal: boolean): string {
  return stufe === 1
    ? "👀 Morgen früh um 9 kommt was. Esst heute nochmal ordentlich, ihr werdet die Kraft brauchen."
    : kamSchonMal
      ? "💉 Morgen früh kommt jemand zurück. Er war die ganze Zeit im Keller und hat gepumpt. Er ist nicht mehr der Alte."
      : "💉 Morgen früh kommt was Aufgepumptes. Schlaft gut. Solange ihr noch könnt.";
}

/** Meldung, wenn der Boss unter die Hälfte fällt. */
export const BOSS_BLUTET = "🩸 {boss} blutet! Nur noch die Hälfte übrig. Drauf da, jetzt nicht nachlassen!";
/** Donnerstag, wenn schon mehr als die Hälfte geschafft ist. */
export const BOSS_NERVOES = "😰 {boss} wird nervös. Donnerstag und schon über die Hälfte weg. Noch ein paar Einheiten und er liegt.";
