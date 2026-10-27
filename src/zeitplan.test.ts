import { afterEach, describe, expect, it } from "vitest";
import { aendereSeason } from "./db/season-repo.js";
import { uhr } from "./bot/kontext.js";
import { GRUPPE, PETER, PRIVAT, befehl, knopf, testBot } from "./bot/testhilfe.js";
import { fuehreAus, plane } from "./zeitplan.js";

const TZ = "Europe/Berlin";
const PETER_PRIVAT = { id: PETER.id, type: "private" as const, first_name: "Peter" };
const KEVIN_ID = PRIVAT.id;
const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});

function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T08:00:00Z`);
}

/** Season ab Mo 12.10.2026 mit Kevin und Peter, 3 Wochen. Kevin hat seine Kalibrierung. */
async function aufbau() {
  const t = testBot();
  tag("2026-10-05");
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  aendereSeason(t.db, 1, { wochen: 3 });
  for (const d of ["2026-10-07", "2026-10-08", "2026-10-09"]) {
    tag(d);
    await t.bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
  }
  const gesendet: { chatId: number; text: string; appKnopf?: boolean }[] = [];
  const senden = async (chatId: number, text: string, o?: { appKnopf?: boolean }) => {
    gesendet.push({ chatId, text, ...(o?.appKnopf ? { appKnopf: true } : {}) });
  };
  const fotos: { chatId: number; png: Uint8Array }[] = [];
  const foto = async (chatId: number, png: Uint8Array) => {
    fotos.push({ chatId, png });
  };
  /** Plant und führt aus, als wäre es `iso` (UTC). */
  const lauf = async (iso: string) => {
    const jetzt = new Date(iso);
    plane(t.db, jetzt, TZ);
    return fuehreAus(t.db, senden, jetzt, TZ, foto);
  };
  /** Nur die privaten Nachrichten (Erinnerungen). */
  const privat = () => gesendet.filter((g) => g.chatId !== GRUPPE.id);
  /** Nur die Nachrichten an die Gruppe (Berichte), ohne private Erinnerungen. */
  const berichte = () => gesendet.filter((g) => g.chatId === GRUPPE.id).map((g) => g.text);
  return { ...t, gesendet, privat, berichte, fotos, lauf };
}

describe("Zeitplan", () => {
  it("plant Berichte idempotent, einen pro Woche", async () => {
    const { db, lauf } = await aufbau();
    await lauf("2026-10-10T06:00:00Z");
    await lauf("2026-10-10T06:01:00Z");
    const berichte = db.prepare("SELECT art, faellig_am FROM termin WHERE art NOT IN ('erinnerung', 'countdown') ORDER BY faellig_am").all();
    expect(berichte).toEqual([
      { art: "wochenbericht", faellig_am: "2026-10-18T18:00:00.000Z" },
      { art: "wochenbericht", faellig_am: "2026-10-25T19:00:00.000Z" }, // Winterzeit
      { art: "finale", faellig_am: "2026-11-01T19:00:00.000Z" },
    ]);
  });

  it("Wochenberichte genau einmal, mit Veränderung zur Vorwoche, dann das Finale", async () => {
    const { db, bot, berichte, fotos, gesendet, lauf } = await aufbau();
    tag("2026-10-14");
    await bot.handleUpdate(befehl("/sport 100 Joggen"));
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));

    await lauf("2026-10-18T17:59:00Z");
    expect(berichte()).toEqual([]);
    await lauf("2026-10-18T18:00:30Z");
    await lauf("2026-10-18T18:01:30Z");
    expect(berichte()).toHaveLength(1);
    const woche1 = { text: berichte()[0]! };
    expect(gesendet.find((g) => g.chatId === GRUPPE.id)?.appKnopf).toBe(true);
    expect(woche1.text).toContain("Wochenbericht „Herbst“, Woche 1 von 3");
    expect(woche1.text).toContain("1. Kevin: 10 ✅");
    expect(woche1.text).toContain("2. Peter: 1");
    expect(woche1.text).toContain("Fleiß der Woche: Kevin mit 300 Lastpunkten");
    expect(woche1.text).not.toContain("Nächste Woche ist die letzte");
    // Kurz halten: Erfolge kamen schon beim Trainingspost, Wochenziel steht als ✅ an den Namen
    expect(woche1.text).not.toContain("Erfolge");
    expect(woche1.text).not.toContain("Schweißtropfen");
    expect(woche1.text).not.toContain("Wochenziel (");
    expect(woche1.text).not.toContain("kg");
    expect(db.prepare("SELECT COUNT(*) AS n FROM wochenstand WHERE woche = 0").get()).toEqual({ n: 2 });
    // Punkteverlauf als Bild direkt nach dem Bericht
    expect(fotos).toHaveLength(1);
    expect(fotos[0]!.chatId).toBe(GRUPPE.id);
    expect(Buffer.from(fotos[0]!.png).subarray(1, 4).toString()).toBe("PNG");

    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 120 Fußball", GRUPPE, PETER));
    tag("2026-10-21");
    await bot.handleUpdate(befehl("/sport 30 Fußball", GRUPPE, PETER));
    await lauf("2026-10-25T19:00:30Z");
    expect(berichte().at(-1)!).toContain("1. Peter: 16 ⬆1 ✅");
    expect(berichte().at(-1)!).toContain("2. Kevin: 10 ⬇1");
    expect(berichte().at(-1)!).toContain("Nächste Woche ist die letzte");

    tag("2026-10-30");
    await bot.handleUpdate(befehl("/waage 90 27 41", PRIVAT));
    tag("2026-10-31");
    await bot.handleUpdate(befehl("/waage 90 27 41", PRIVAT));
    await lauf("2026-11-01T19:00:30Z");
    const finale = berichte().at(-1)!;
    expect(finale).toContain("Finale „Herbst“");
    expect(finale).toContain("Mr. Slimfast: Kevin (−10 % Fett)");
    expect(finale).toContain("Der 30er-Bizeps: Kevin (+2,5 % Muskel)");
    expect(finale).toContain("Die Maschine: Peter (480 Lastpunkte)");
    expect(finale).toContain("Der Dauerbrenner: Kevin, Peter (1 Woche)");
    expect(finale).toContain("Der Statistiker: Kevin (5 Messungen)");
    expect(finale).toContain("Rückblick: zusammen 4,7 Stunden Sport");
    expect(db.prepare("SELECT COUNT(*) AS n FROM auszeichnung").get()).toEqual({ n: 7 }); // Dauerbrenner doppelt
    expect(fotos).toHaveLength(3);
  });

  it("Rote Laterne für die niedrigste Wochenlast, mit Zähler, in Rangliste und Stand bis zum nächsten Bericht", async () => {
    const t = await aufbau();
    const { bot, berichte, lauf } = t;
    tag("2026-10-14");
    await bot.handleUpdate(befehl("/sport 100 Joggen"));
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
    await lauf("2026-10-18T18:00:30Z");
    expect(berichte()[0]).toContain("🏮 Rote Laterne: Peter mit 30 Lastpunkten");
    expect(berichte()[0]).toMatch(/🏮 .*Peter/); // Spruch dazu

    tag("2026-10-20");
    await bot.handleUpdate(befehl("/rangliste"));
    expect(t.letzterText()).toMatch(/2\. Peter: .* 🏮/);
    expect(t.letzterText()).toContain("🏮 Rote Laterne: Peter");
    await bot.handleUpdate(befehl("/sport 60 Joggen"));
    await lauf("2026-10-25T19:00:30Z");
    expect(berichte().at(-1)).toContain("🏮 Rote Laterne: Peter (2× diese Season) mit 0 Lastpunkten");
    tag("2026-10-26");
    await bot.handleUpdate(befehl("/stand", PETER_PRIVAT, PETER));
    expect(t.letzterText()).toContain("Du trägst die Rote Laterne (schon 2× diese Season)");

    tag("2026-10-27");
    await bot.handleUpdate(befehl("/sport 30 Joggen"));
    await lauf("2026-11-01T19:00:30Z");
    const finale = berichte().at(-1)!;
    expect(finale).toContain("Letzte Rote Laterne: Peter (3× diese Season)");
    expect(finale).toContain("Laternenkönig der Season: Peter mit 3 Roten Laternen");
  });

  it("keine Rote Laterne, wenn alle gleich faul waren", async () => {
    const { berichte, lauf } = await aufbau();
    await lauf("2026-10-18T18:00:30Z");
    expect(berichte()[0]).not.toContain("Rote Laterne");
  });

  it("mit Teams: Teamwertung, Team-Bonus und Teamsieger", async () => {
    const { bot, berichte, lauf } = await aufbau();
    tag("2026-10-08");
    await bot.handleUpdate(befehl("/team Eisen"));
    await bot.handleUpdate(befehl("/team Couch", GRUPPE, PETER));
    tag("2026-10-14");
    await bot.handleUpdate(befehl("/sport 100 Joggen"));
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
    await lauf("2026-10-18T18:00:30Z");
    const woche1 = berichte()[0]!;
    // Kevin hat Startwert und Ziel: Schnitt 10 + 3 Bonus; Peter ohne Startwert zählt nicht in den Schnitt
    expect(woche1).toContain("👥 Teamwertung:\n1. Eisen: 13 (Schnitt 10 + 3 Bonus)\n2. Couch: 0");
    expect(woche1).toContain("🎯 Team-Bonus +3: Eisen, alle haben ihr Ziel geschafft");
    await lauf("2026-11-01T19:00:30Z");
    expect(berichte().at(-1)).toContain("🏆 Teamsieger: Eisen");
  });

  it("verpasste Berichte werden nachgeholt, wenn der Bot wieder läuft", async () => {
    const { berichte, lauf } = await aufbau();
    await lauf("2026-10-19T07:00:00Z");
    expect(berichte()).toHaveLength(1);
    expect(berichte()[0]).toContain("Woche 1 von 3");
  });

  it("ein Termin aus einem alten Season-Plan verfällt", async () => {
    const { db, berichte, lauf } = await aufbau();
    await lauf("2026-10-10T06:00:00Z");
    aendereSeason(db, 1, { start: "2026-10-19" });
    await lauf("2026-10-18T18:00:30Z");
    expect(berichte().filter((b) => b.includes("Wochenbericht"))).toEqual([]);
  });
});

describe("Countdown der Kalibrierwoche", () => {
  it("erklärt beim ersten Beitrag alles, danach Häppchen, und nennt, wer noch auf die Waage muss", async () => {
    const { bot, berichte, gesendet, lauf } = await aufbau();
    // Mo 05.10. ist Tag −7, der Beitrag kommt um 18 Uhr Berlin
    await lauf("2026-10-05T15:59:00Z");
    expect(berichte()).toEqual([]);
    await lauf("2026-10-05T16:00:30Z");
    await lauf("2026-10-05T16:01:30Z");
    expect(berichte()).toHaveLength(1);
    const erster = berichte()[0]!;
    expect(erster).toContain("Noch 7 Tage bis „Herbst“ (Start 12.10.2026)");
    // Kevins Messungen aus dem Aufbau liegen schon in der Datenbank
    expect(erster).toContain("Kalibrierung: 1 von 2 haben ihre 3 Messungen.");
    expect(erster).toContain("Noch offen: Peter (0/3)");
    expect(erster).toContain("⚖️ DIE WAAGE");
    expect(erster).toContain("1 % mehr Muskel = 30 Punkte");
    expect(gesendet.find((g) => g.chatId === GRUPPE.id)?.appKnopf).toBe(true);

    // Do 08.10.: Peter hat eine Messung, die Erklärung kommt nicht nochmal
    tag("2026-10-08");
    await bot.handleUpdate(befehl("/waage 80 20 40", PETER_PRIVAT, PETER));
    await lauf("2026-10-08T16:00:30Z");
    const donnerstag = berichte().at(-1)!;
    expect(donnerstag).toContain("Noch 4 Tage");
    expect(donnerstag).toContain("Noch offen: Peter (1/3)");
    expect(donnerstag).not.toContain("DIE WAAGE");
    expect(donnerstag).toContain("Schummeln lohnt nicht");

    // So 11.10.: letzter Tag, Peter fehlt noch
    await lauf("2026-10-11T16:00:30Z");
    const sonntag = berichte().at(-1)!;
    expect(sonntag).toContain("MORGEN GEHT'S LOS");
    expect(sonntag).toContain("Kalibrierung: 1 von 2");
    expect(sonntag).toContain("Heute ist der letzte Tag der Kalibrierwoche! Peter:");

    // Mo 12.10., 8 Uhr Berlin: Startschuss
    await lauf("2026-10-12T06:00:30Z");
    const start = berichte().at(-1)!;
    expect(start).toContain("STARTSCHUSS! „Herbst“ läuft.");
    expect(start).toContain("Ohne Startwert und damit ohne Fortschrittspunkte: Peter.");
    expect(berichte()).toHaveLength(4);
  });

  it("mitten in der Woche eingeschaltet: Verpasstes verfällt, der erste Beitrag erklärt alles", async () => {
    const { berichte, lauf } = await aufbau();
    await lauf("2026-10-07T16:00:30Z"); // Mi 18 Uhr Berlin, Mo und Di sind zu lange her
    expect(berichte()).toHaveLength(1);
    expect(berichte()[0]).toContain("Noch 5 Tage");
    expect(berichte()[0]).toContain("⚖️ DIE WAAGE");
    await lauf("2026-10-08T16:00:30Z");
    expect(berichte()).toHaveLength(2);
    expect(berichte()[1]).not.toContain("DIE WAAGE");
  });
});

describe("Erinnerungen", () => {
  it("Kalibrierwoche: erinnert, wer noch Messungen braucht", async () => {
    const { privat, lauf } = await aufbau();
    await lauf("2026-10-08T17:00:30Z"); // 19 Uhr Berlin
    expect(privat()).toEqual([
      { chatId: PETER.id, text: expect.stringContaining("Dir fehlen noch 3 Messungen bis 11.10.2026") },
    ]);
  });

  it("während der Season: ohne Training seit 3 Tagen und ohne Messung seit 4 Tagen", async () => {
    const { bot, gesendet, lauf } = await aufbau();
    tag("2026-10-15");
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
    await bot.handleUpdate(befehl("/waage 80 20 40", PETER_PRIVAT, PETER));
    await bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
    await lauf("2026-10-16T17:00:30Z");
    // Kevin: Season läuft seit 4 Tagen, kein Training
    expect(gesendet).toEqual([{ chatId: KEVIN_ID, text: expect.stringContaining("Noch kein einziges Training") }]);

    await lauf("2026-10-19T18:00:30Z"); // 20 Uhr Berlin, eine Stunde nach der Erinnerungszeit
    const peter = gesendet.filter((g) => g.chatId === PETER.id).at(-1)!;
    expect(peter.text).toContain("Seit 4 Tagen kein Training");
    expect(peter.text).toContain("Seit 4 Tagen nicht auf der Waage");
  });

  it("verfällt nach 2 Stunden und lässt sich abschalten", async () => {
    const { bot, privat, lauf } = await aufbau();
    await lauf("2026-10-08T19:30:00Z"); // 21:30 Berlin, 2,5 h zu spät
    expect(privat()).toEqual([]);

    await bot.handleUpdate(befehl("/erinnerungen aus", PETER_PRIVAT, PETER));
    await lauf("2026-10-09T17:00:30Z");
    expect(privat()).toEqual([]);
  });

  it("/erinnerungen stellt die Uhrzeit", async () => {
    const { db, bot, letzterText, gesendet, lauf } = await aufbau();
    await bot.handleUpdate(befehl("/erinnerungen 7:15", PETER_PRIVAT, PETER));
    expect(letzterText()).toContain("täglich um 07:15");
    expect(db.prepare("SELECT erinnerung_uhrzeit AS u FROM nutzer WHERE telegram_id = ?").get(PETER.id)).toEqual({ u: "07:15" });
    await lauf("2026-10-09T05:15:30Z");
    expect(gesendet.map((g) => g.chatId)).toEqual([PETER.id]);
  });
});

