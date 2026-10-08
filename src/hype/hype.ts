import { fileURLToPath } from "node:url";
import type { Db } from "../db/index.js";
import { gruppeNachId } from "../db/repo.js";
import { aktuelleSeason } from "../db/season-repo.js";
import { lokalesDatum, plusTage, zeitpunktIn } from "../scoring/datum.js";
import { kalibrierFenster, seasonEnde } from "../scoring/season.js";
import { log } from "../log.js";

/**
 * Hype-Woche vor dem Start (/hype): sieben Beiträge, einer pro Tag, ohne Datum und ohne
 * die Bosse oder Minispiele zu verraten. Der erste kommt sofort, die anderen jeweils abends.
 */
export const HYPE_TAGE = 7;
export const HYPE_UHRZEIT = "19:00";
/** War der Bot länger weg, verfallen alte Beiträge, statt alle auf einmal zu kommen. */
const VERFALL_MS = 12 * 60 * 60 * 1000;
/** Telegram erlaubt höchstens 10 Antworten pro Umfrage, zwei davon sind fest. */
const MAX_NAMEN = 8;

export type Medium = "trailer.mp4" | "plakat.png" | "gesucht.png";

export interface Beitrag {
  text: string;
  /** Bild oder Video, `text` ist dann die Bildunterschrift */
  medium?: Medium;
  /** Umfrage vor dem Text */
  umfrage?: { frage: string; antworten: string[] };
}

/** Wie die Beiträge in die Gruppe kommen; im Bot über die Telegram-API, in Tests abgefangen. */
export interface HypeKanal {
  text: (chatId: number, text: string) => Promise<unknown>;
  medium: (chatId: number, datei: string, medium: Medium, beschriftung: string) => Promise<unknown>;
  umfrage: (chatId: number, frage: string, antworten: string[]) => Promise<unknown>;
}

export function medienPfad(medium: Medium): string {
  return fileURLToPath(new URL(`./medien/${medium}`, import.meta.url));
}

const d = (datum: string) => datum.split("-").reverse().join(".");

/** Text und Anhang eines Hype-Tages (1 bis 7). */
export function hypeBeitrag(db: Db, gruppeId: number, tag: number, heute: string, zufall: () => number = Math.random): Beitrag {
  switch (tag) {
    case 1:
      return {
        medium: "trailer.mp4",
        text: [
          "Leute. Botzeps ist zurück. Und diesmal hat er Muskeln. 💪",
          "",
          "Neue Season, neue Regeln, neue Wege, euch öffentlich zu demütigen. Wann's losgeht? Bald. Bis dahin melde ich mich jeden Abend, ob ihr wollt oder nicht.",
          "",
          "Ton an. 🔊",
        ].join("\n"),
      };
    case 2:
      return {
        medium: "plakat.png",
        text: [
          "So läuft's. Einmal lesen, dann keine Ausreden mehr. 📌",
          "",
          "💪 Fleiß: Jede Trainingsminute zählt. Eintragen mit /sport 45 Joggen oder in der Mini App.",
          "⚖️ Fortschritt: Fett runter, Muskeln rauf, in Prozent eurer eigenen Werte. Die Dicken haben keinen Vorteil, die Dünnen keine Ausrede.",
          "🗓 Vor dem Start kommt die Kalibrierwoche: mindestens 3× wiegen, privat mit /waage. Das ist euer Startwert.",
          "👹 Bosse und 🔒 Minispiele: Mehr wird nicht verraten.",
          "🏮 Wer in der Woche am wenigsten reißt, kriegt die Rote Laterne.",
          "🏛 Sieger und Rekorde landen in der Ruhmeshalle. Für immer.",
          "",
          "Wer noch nicht dabei ist: /start",
        ].join("\n"),
      };
    case 3:
      return {
        medium: "gesucht.png",
        text: [
          "🚨 FAHNDUNG 🚨",
          "",
          "Irgendwas lauert da draußen. Es hat Lebenspunkte, eine Schwäche und keinerlei Respekt vor euch. Wann es auftaucht, sagt euch keiner.",
          "",
          "Prügeln könnt ihr es nur mit Training, jede Minute ist Schaden. Wer dann noch vom Treppensteigen außer Puste ist, wird Boss-Futter.",
        ].join("\n"),
      };
    case 4:
      return {
        umfrage: { frage: "Wer kriegt die erste Rote Laterne? 🏮", antworten: [...laternenKandidaten(db, gruppeId, zufall), "Ich selbst, ich kenn mich", "Der Bot, aus Mitleid"] },
        text: "Abgestimmt wird öffentlich. Wer hier gewählt wird und dann wirklich die Laterne kriegt, darf sich die Häme abholen. Wer gewählt wird und es allen zeigt, darf sich die Entschuldigungen abholen.",
      };
    case 5:
      return {
        text: [
          "🔒 In meinem Tresor liegen sieben versiegelte Umschläge. In jedem steckt ein Minispiel.",
          "",
          "Was drin ist, verrate ich nicht. Nur so viel:",
          "• Bei einem rennt ihr um euer Leben.",
          "• Bei einem werdet ihr gejagt.",
          "• Bei einem tickt was.",
          "• Bei einem müsst ihr zusammenhalten. Oder wenigstens so tun.",
          "",
          "Punkte gibt's dafür keine. Nur Ruhm und Schande, also das, was wirklich zählt.",
        ].join("\n"),
      };
    case 6:
      return {
        text: [
          "Hausaufgabe bis zum Start: ⚖️",
          "",
          "• Waage aus dem Keller holen und abstauben",
          "• Batterien checken",
          "• Merken: morgens wiegen, nach dem Klo, vor Essen und Trinken, immer dieselbe Waage",
          "",
          "Wer sich nach dem Döner wiegt, betrügt nur sich selbst. Und alle anderen ein bisschen.",
          "",
          "Wer dem Bot noch nie privat /start geschrieben hat: jetzt. Sonst gibt's keine Erinnerungen und ihr verpennt die Kalibrierwoche.",
        ].join("\n"),
      };
    default:
      return { text: schluss(db, gruppeId, heute) };
  }
}

/** Letzter Tag: mit Daten, wenn schon eine Season ansteht, sonst die Aufforderung, eine anzulegen. */
function schluss(db: Db, gruppeId: number, heute: string): string {
  const s = aktuelleSeason(db, gruppeId, heute);
  if (s && s.start > heute) {
    const k = kalibrierFenster(s, s.start);
    const kalibrierung = k.von > heute ? `Kalibrierwoche ab ${d(k.von)}` : "Die Kalibrierwoche läuft schon";
    return [
      "Der Hype ist vorbei. Jetzt wird's ernst. 🔥",
      "",
      `Season „${s.name}“: ${kalibrierung}, Start am ${d(s.start)}, ${s.wochen} Wochen.`,
      "",
      "Letzte Tage auf dem Sofa. Genießt sie. 🛋️💀",
    ].join("\n");
  }
  if (s && s.start <= heute && seasonEnde(s) >= heute) {
    return ["Der Hype ist vorbei, die Season „" + s.name + "“ läuft längst. 🔥", "", "Wer heute nicht trainiert, liest Sonntag seinen Namen neben einer Laterne. 🏮"].join("\n");
  }
  return [
    "Der Hype ist vorbei. Jetzt fehlt nur noch eins: einer, der /season tippt. 👀",
    "",
    "Also, wer traut sich? Wer kneift, kriegt die Laterne. 🏮",
  ].join("\n");
}

/** Bis zu acht Namen aus der Gruppe für die Laternen-Umfrage, zufällig gewählt, alphabetisch sortiert. */
function laternenKandidaten(db: Db, gruppeId: number, zufall: () => number): string[] {
  const namen = (
    db.prepare("SELECT n.name FROM gruppe_mitglied m JOIN nutzer n ON n.id = m.nutzer WHERE m.gruppe = ?").all(gruppeId) as { name: string }[]
  ).map((z) => z.name.slice(0, 100));
  const auswahl: string[] = [];
  const rest = [...new Set(namen)];
  while (auswahl.length < MAX_NAMEN && rest.length) auswahl.push(rest.splice(Math.floor(zufall() * rest.length), 1)[0]!);
  return auswahl.sort((a, b) => a.localeCompare(b, "de"));
}

/** Nächster offener Tag der Hype-Woche dieser Gruppe, oder null, wenn keine läuft. */
export function offenerHypeTag(db: Db, gruppeId: number): { tag: number; faellig_am: string } | null {
  return (
    (db
      .prepare("SELECT tag, faellig_am FROM hype_post WHERE gruppe = ? AND erledigt_am IS NULL ORDER BY tag LIMIT 1")
      .get(gruppeId) as { tag: number; faellig_am: string } | undefined) ?? null
  );
}

/** Plant die Hype-Woche: Tag 1 sofort, die anderen an den Folgetagen abends. False, wenn schon eine läuft. */
export function starteHype(db: Db, gruppeId: number, jetzt: Date, zeitzone: string): boolean {
  if (offenerHypeTag(db, gruppeId)) return false;
  const heute = lokalesDatum(jetzt, zeitzone);
  db.transaction(() => {
    db.prepare("DELETE FROM hype_post WHERE gruppe = ?").run(gruppeId);
    const neu = db.prepare("INSERT INTO hype_post (gruppe, tag, faellig_am) VALUES (?, ?, ?)");
    neu.run(gruppeId, 1, jetzt.toISOString());
    for (let tag = 2; tag <= HYPE_TAGE; tag++) neu.run(gruppeId, tag, zeitpunktIn(plusTage(heute, tag - 1), HYPE_UHRZEIT, zeitzone).toISOString());
  })();
  return true;
}

/** Bricht die laufende Hype-Woche ab; gibt zurück, wie viele Beiträge damit ausfallen. */
export function stoppeHype(db: Db, gruppeId: number): number {
  return db.prepare("DELETE FROM hype_post WHERE gruppe = ? AND erledigt_am IS NULL").run(gruppeId).changes;
}

/** Sendet fällige Hype-Beiträge aller Gruppen, jeden genau einmal. */
export async function fuehreHypeAus(db: Db, kanal: HypeKanal, jetzt: Date, zeitzone: string): Promise<number> {
  const faellig = db
    .prepare("SELECT gruppe, tag, faellig_am FROM hype_post WHERE erledigt_am IS NULL AND faellig_am <= ? ORDER BY faellig_am, tag")
    .all(jetzt.toISOString()) as { gruppe: number; tag: number; faellig_am: string }[];
  const erledige = db.prepare("UPDATE hype_post SET erledigt_am = ? WHERE gruppe = ? AND tag = ? AND erledigt_am IS NULL");
  let gesendet = 0;
  for (const p of faellig) {
    // Erst als erledigt markieren: lieber einmal verpasst als doppelt gesendet
    if (erledige.run(jetzt.toISOString(), p.gruppe, p.tag).changes === 0) continue;
    if (jetzt.getTime() - new Date(p.faellig_am).getTime() > VERFALL_MS) continue;
    const gruppe = gruppeNachId(db, p.gruppe);
    if (!gruppe) continue;
    try {
      await sende(kanal, gruppe.telegram_chat_id, hypeBeitrag(db, p.gruppe, p.tag, lokalesDatum(jetzt, zeitzone)));
      gesendet++;
    } catch (err) {
      log.error(`Hype-Tag ${p.tag} für Gruppe ${p.gruppe} fehlgeschlagen`, err);
    }
  }
  return gesendet;
}

async function sende(kanal: HypeKanal, chat: number, b: Beitrag): Promise<void> {
  if (b.umfrage) await kanal.umfrage(chat, b.umfrage.frage, b.umfrage.antworten);
  if (!b.medium) {
    await kanal.text(chat, b.text);
    return;
  }
  try {
    await kanal.medium(chat, medienPfad(b.medium), b.medium, b.text);
  } catch (err) {
    // Ohne Bild oder Video soll wenigstens der Text ankommen
    log.error(`Hype-Medium ${b.medium} nicht gesendet`, err);
    await kanal.text(chat, b.text);
  }
}
