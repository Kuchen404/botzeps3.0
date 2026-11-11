import { afterEach, describe, expect, it } from "vitest";
import { aendereSeason, seasonNachId } from "./db/season-repo.js";
import { berechneStand } from "./bericht/stand.js";
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
    await bot.handleUpdate(befehl("/sport 100 Joggen")); // 100 × 4,5 = 450, genau das Wochenziel
    await bot.handleUpdate(befehl("/sport 45 Yoga", GRUPPE, PETER));

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
    expect(woche1.text).toContain("Fleiß der Woche: Kevin mit 450 Lastpunkten");
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
    await bot.handleUpdate(befehl("/sport 60 Fußball", GRUPPE, PETER)); // 180 × 4 = 720, gedeckelt bei 675
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
    expect(finale).toContain("Die Maschine: Peter (765 Lastpunkte)");
    expect(finale).toContain("Der Dauerbrenner: Kevin, Peter (1 Woche)");
    expect(finale).toContain("Der Statistiker: Kevin (5 Messungen)");
    expect(finale).toContain("Rückblick: zusammen 5,4 Stunden Sport");
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
    // Schand-Erfolge: still beim ersten Mal, im Finale mit gemeldet
    expect(finale).toContain("Peter: 💩 Dauerleuchte (dreimal die Rote Laterne in einer Season)");
    const peter = t.db.prepare("SELECT art, erreicht_am FROM erfolg WHERE nutzer = (SELECT id FROM nutzer WHERE name = 'Peter') AND art LIKE 'laterne%' ORDER BY art").all();
    expect(peter).toEqual([
      { art: "laterne", erreicht_am: "2026-10-18" },
      { art: "laterne_3", erreicht_am: "2026-11-01" },
    ]);
  });

  it("Faktor-Minimalisten: Spruch beim 3. Kuschel-Eintrag der Woche und im Wochenbericht", async () => {
    const t = await aufbau();
    const { bot, berichte, lauf } = t;
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/sport 100 Joggen"));
    await bot.handleUpdate(befehl("/sport 40 Yoga", GRUPPE, PETER));
    expect(t.letzterText()).not.toContain("🐌");
    await bot.handleUpdate(befehl("/sport 30 Dehnen", GRUPPE, PETER));
    expect(t.letzterText()).not.toContain("🐌");
    tag("2026-10-14");
    await bot.handleUpdate(befehl("/sport 50 Spazierengehen", GRUPPE, PETER));
    expect(t.letzterText()).toMatch(/🐌 .*Peter/);
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
    expect(t.letzterText()).not.toContain("🐌");
    await lauf("2026-10-18T18:00:30Z");
    expect(berichte()[0]).toMatch(/🐌 .*Peter/);
    expect(berichte()[0]).toContain("150 Minuten");
    expect(berichte()[0]).not.toMatch(/🐌 .*Kevin/);
  });

  it("kein Kuschel-Spruch bei gemischtem Training", async () => {
    const t = await aufbau();
    const { bot, berichte, lauf } = t;
    tag("2026-10-13");
    for (const sport of ["40 Yoga", "60 Joggen", "30 Dehnen", "45 Krafttraining", "50 Spazierengehen"]) {
      await bot.handleUpdate(befehl(`/sport ${sport}`, GRUPPE, PETER));
      expect(t.letzterText()).not.toContain("🐌");
    }
    await lauf("2026-10-18T18:00:30Z");
    expect(berichte()[0]).not.toContain("🐌");
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

  it("kündigt die neue Wertung einmal in der Gruppe an, mit Stunden fürs Wochenziel", async () => {
    const { db, berichte, gesendet, lauf } = await aufbau();
    db.prepare("INSERT INTO termin (art, season, nutzer, faellig_am) VALUES ('faktoren_neu', 1, NULL, '2026-10-13T10:00:00.000Z')").run();
    await lauf("2026-10-13T10:00:30Z");
    await lauf("2026-10-13T10:01:30Z");
    const ankuendigung = berichte().filter((b) => b.startsWith("📢 Neue Wertung"));
    expect(ankuendigung).toHaveLength(1);
    expect(ankuendigung[0]).toContain("Wochenziel (jetzt 450 Lastpunkte)");
    expect(ankuendigung[0]).toContain("×6 Spinning: 1¼ Std.");
    expect(ankuendigung[0]).toContain("×4,5 Joggen, Squash, Tanzen sportlich: 1¾ Std.");
    expect(ankuendigung[0]).toContain("×0,5 Spazierengehen: 15 Std.");
    expect(gesendet.find((g) => g.text.startsWith("📢"))?.appKnopf).toBe(true);
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
    expect(erster).toContain("Kalibrierung: 1 von 2 haben ihre 3 Messtage.");
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
      { chatId: PETER.id, text: expect.stringContaining("Dir fehlen noch 3 Messtage bis 11.10.2026") },
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

  it("warnt, wenn eine Tagesserie ab 3 Tagen heute reißt", async () => {
    const { bot, gesendet, lauf } = await aufbau();
    for (const d of ["2026-10-13", "2026-10-14", "2026-10-15"]) {
      tag(d);
      await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
    }
    const peter = () => gesendet.filter((g) => g.chatId === PETER.id).map((g) => g.text);
    await lauf("2026-10-15T17:00:30Z"); // heute schon trainiert: nichts zu retten
    expect(peter().join("\n")).not.toContain("Serie");
    await lauf("2026-10-16T17:00:30Z");
    expect(peter().at(-1)).toContain("Deine 3-Tage-Serie ⚡ reißt heute um Mitternacht");
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


describe("Zeitplan bei Fehlern", () => {
  it("versucht einen fehlgeschlagenen Bericht später noch einmal", async () => {
    const { db, lauf } = await aufbau();
    const gesendet: string[] = [];
    let kaputt = true;
    const senden = async (_chat: number, text: string) => {
      if (kaputt) throw new Error("Telegram nicht erreichbar");
      gesendet.push(text);
      return gesendet.length;
    };
    await lauf("2026-10-18T17:00:00Z"); // plant alles, Bericht noch nicht fällig
    const bericht = () =>
      db.prepare("SELECT erledigt_am, versuche, naechster_versuch FROM termin WHERE art = 'wochenbericht' ORDER BY faellig_am LIMIT 1").get();

    await fuehreAus(db, senden, new Date("2026-10-18T18:00:30Z"), TZ);
    expect(gesendet).toEqual([]);
    expect(bericht()).toEqual({ erledigt_am: null, versuche: 1, naechster_versuch: "2026-10-18T18:01:30.000Z" });

    kaputt = false;
    await fuehreAus(db, senden, new Date("2026-10-18T18:01:00Z"), TZ); // noch zu früh
    expect(gesendet).toEqual([]);
    await fuehreAus(db, senden, new Date("2026-10-18T18:01:30Z"), TZ);
    expect(gesendet.filter((t) => t.includes("Woche 1"))).toHaveLength(1);
    expect(bericht()).toMatchObject({ erledigt_am: "2026-10-18T18:01:30.000Z" });
  });

  it("schickt beim neuen Versuch nur, was noch fehlte", async () => {
    const { db, lauf } = await aufbau();
    aendereSeason(db, 1, { wochen: 8 }); // Bosse gibt es erst in längeren Seasons
    await lauf("2026-10-19T06:00:00Z"); // plant den Boss für 9 Uhr
    const gesendet: string[] = [];
    let aufrufe = 0;
    const senden = async (_chat: number, text: string) => {
      // Beben geht raus, beim Vorzeichen bricht die Verbindung ab
      if (++aufrufe === 2) throw new Error("Verbindung weg");
      gesendet.push(text);
      return 100 + gesendet.length;
    };
    await fuehreAus(db, senden, new Date("2026-10-19T07:00:30Z"), TZ);
    expect(gesendet).toHaveLength(1);
    const boss = db.prepare("SELECT name, lebenspunkte FROM boss").all();
    expect(boss).toHaveLength(1);

    await fuehreAus(db, senden, new Date("2026-10-19T07:01:30Z"), TZ);
    expect(gesendet).toHaveLength(3); // Beben einmal, dann Vorzeichen und Steckbrief
    expect(new Set(gesendet).size).toBe(3);
    expect(gesendet.at(-1)).toContain((boss[0] as { name: string }).name);
    expect(db.prepare("SELECT name, lebenspunkte FROM boss").all()).toEqual(boss);

    await fuehreAus(db, senden, new Date("2026-10-19T08:00:00Z"), TZ);
    expect(gesendet).toHaveLength(3);
  });

  it("gibt nach mehreren Fehlschlägen auf", async () => {
    const { db, lauf } = await aufbau();
    await lauf("2026-10-18T17:00:00Z");
    const senden = async () => {
      throw new Error("Telegram nicht erreichbar");
    };
    let jetzt = new Date("2026-10-18T18:00:30Z").getTime();
    for (let i = 0; i < 10; i++) {
      await fuehreAus(db, senden, new Date(jetzt), TZ);
      jetzt += 4 * 60 * 60 * 1000;
    }
    expect(
      db.prepare("SELECT versuche, erledigt_am IS NOT NULL AS fertig FROM termin WHERE art = 'wochenbericht' ORDER BY faellig_am LIMIT 1").get(),
    ).toEqual({ versuche: 5, fertig: 1 });
  });
});

describe("Endstand nach dem Finale", () => {
  it("ein Nachtrag für Sonntag ändert den Sieger nicht mehr", async () => {
    const { db, bot, berichte, lauf, letzterText } = await aufbau();
    tag("2026-11-01");
    await bot.handleUpdate(befehl("/sport 30 Joggen", PETER_PRIVAT, PETER));
    await lauf("2026-11-01T19:00:30Z");
    expect(berichte().at(-1)).toContain("Finale");
    const s = seasonNachId(db, 1)!;
    const vorher = berechneStand(db, s, "2026-11-02").map((st) => ({ name: st.name, gesamt: st.gesamt, platz: st.platz }));
    expect(vorher[0]?.name).toBe("Peter");

    // Montag: Kevin trägt für Sonntag ordentlich nach, erlaubt bis 2 Tage zurück
    tag("2026-11-02");
    await bot.handleUpdate(befehl("/sport 240 Joggen gestern", PRIVAT));
    const nachher = berechneStand(db, s, "2026-11-02").map((st) => ({ name: st.name, gesamt: st.gesamt, platz: st.platz }));
    expect(nachher).toEqual(vorher);
    await bot.handleUpdate(befehl("/rangliste"));
    expect(letzterText().indexOf("Peter")).toBeLessThan(letzterText().indexOf("Kevin"));
  });
});
