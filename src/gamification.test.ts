import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aendereSeason } from "./db/season-repo.js";
import { uhr } from "./bot/kontext.js";
import { GRUPPE, PETER, PRIVAT, befehl, knopf, testBot } from "./bot/testhilfe.js";
import { fuehreAus, plane } from "./zeitplan.js";

const TZ = "Europe/Berlin";
const echteUhr = uhr.jetzt;
beforeEach(() => {
  // Feste Zufälle: erster Boss-Name, erste harte Sportart als Schwäche (Krafttraining), erster Spruch
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  uhr.jetzt = echteUhr;
  vi.restoreAllMocks();
});

function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T08:00:00Z`);
}

/** Season ab Mo 12.10.2026 mit Kevin und Peter, 4 Wochen: Boss in Woche 2, aufgepumpt in Woche 3. */
async function aufbau() {
  const t = testBot();
  tag("2026-10-05");
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  aendereSeason(t.db, 1, { wochen: 4 });
  const gesendet: string[] = [];
  const lauf = async (iso: string) => {
    const jetzt = new Date(iso);
    plane(t.db, jetzt, TZ);
    return fuehreAus(t.db, async (_chat, text) => void gesendet.push(text), jetzt, TZ);
  };
  return { ...t, gesendet, lauf };
}

describe("Gamification", () => {
  it("meldet Überholmanöver und neue Spitze direkt im Trainingspost", async () => {
    const { bot, letzterText } = await aufbau();
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/sport 60 Joggen", GRUPPE, PETER));
    expect(letzterText()).toContain("Erster Schweißtropfen");
    await bot.handleUpdate(befehl("/sport 30 Joggen"));
    expect(letzterText()).not.toMatch(/⚡|👑/);
    await bot.handleUpdate(befehl("/sport 90 Joggen gestern"));
    expect(letzterText()).toContain("👑");
    expect(letzterText()).toContain("Peter");
  });

  it("Rangaufstieg über alle Seasons, auch ohne Season", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).toContain("Ausdauerbestie");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).not.toContain("🎖");
    expect(letzterText()).not.toContain("Ausdauerbestie");
    await bot.handleUpdate(befehl("/sport 120 Joggen gestern"));
    expect(letzterText()).toContain("🎖");
    expect(letzterText()).toContain("Lauch");
  });

  it("Boss in Woche 2: Ankündigung, Schaden, Sieg, Bonus und Bericht", async () => {
    const { bot, gesendet, lauf, letzterText } = await aufbau();
    await lauf("2026-10-19T06:59:00Z");
    expect(gesendet.some((g) => g.includes("BOSS"))).toBe(false);
    await lauf("2026-10-19T07:00:30Z"); // 9 Uhr Sommerzeit
    const ankuendigung = gesendet.find((g) => g.includes("BOSS-WOCHE"));
    expect(ankuendigung).toContain("1.000 Lebenspunkte"); // 2 × 450 × 1,1, auf 50 gerundet
    expect(ankuendigung).toContain("+5 Punkte");

    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).toContain("noch 460 von 1.000 Lebenspunkten"); // 120 min × 4,5
    await bot.handleUpdate(befehl("/sport 120 Joggen", GRUPPE, PETER));
    expect(letzterText()).toContain("💀");
    // Beide prügeln mit, Peter setzt den Gnadenstoß; gleich viel Schaden, also sind beide Schlachter
    expect(letzterText()).toContain("Freigeschaltet:");
    expect(letzterText()).toContain("🏆 Drachentöter (beim Sieg gegen einen Boss mitgeprügelt): Peter, Kevin");
    expect(letzterText()).toContain("🏆 Metzgermeister (den inneren Schweinehund zu Mett verarbeitet): Peter, Kevin");
    expect(letzterText()).toContain("🏆 Gnadenstoß (dem Boss den letzten Schlag verpasst): Peter");
    expect(letzterText()).toContain("🏆 Schlachter (beim Fall eines Bosses den meisten Schaden gemacht): Peter, Kevin");
    expect(letzterText()).not.toContain("Steroid");

    await bot.handleUpdate(befehl("/stand", PRIVAT));
    expect(letzterText()).toContain("Boss-Bonus: +5 Punkte");

    await lauf("2026-10-25T19:00:30Z"); // Bericht Woche 2, Winterzeit
    const bericht = gesendet.find((g) => g.includes("Woche 2 von 4"));
    expect(bericht).toContain("besiegt (1.080 Schaden)! +5 für: Kevin, Peter");

    await lauf("2026-10-26T08:00:30Z");
    const zurueck = gesendet.at(-1)!;
    expect(zurueck).toContain("IST ZURÜCK");
    expect(zurueck).toContain("(aufgepumpt) hat 1.350 Lebenspunkte");
    expect(zurueck).toContain("+10 Punkte");
  });

  it("Bericht: überlebter Boss und Drückeberger", async () => {
    const { bot, gesendet, lauf } = await aufbau();
    await lauf("2026-10-19T07:00:30Z");
    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 30 Yoga"));
    await lauf("2026-10-25T19:00:30Z");
    const bericht = gesendet.find((g) => g.includes("Woche 2 von 4"))!;
    expect(bericht).toContain("(30 von 1.000 Schaden)");
    expect(bericht.split("\n").filter((z) => z.includes("Peter")).length).toBeGreaterThan(1);
  });

  it("/erfolge und /ruhmeshalle", async () => {
    const { bot, letzterText } = await aufbau();
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    await bot.handleUpdate(befehl("/erfolge", PRIVAT));
    expect(letzterText()).toContain("✅ Erster Schweißtropfen");
    expect(letzterText()).toContain("🔒 Champion");
    // Geheime Erfolge tauchen nur als Anzahl auf
    expect(letzterText()).toMatch(/❓ Dazu \d+ geheime Erfolge rund um Bosse und Minispiele/);
    expect(letzterText()).not.toMatch(/Unbeißbar|Metzgermeister|Zombie|\?\?\?/);
    expect(letzterText()).toContain("Rang: 🛋 Couchkartoffel (540 Lastpunkte insgesamt, noch 960 bis 🥬 Lauch)");
    await bot.handleUpdate(befehl("/ruhmeshalle"));
    expect(letzterText()).toContain("Kevin: 540 Lastpunkte");
    expect(letzterText()).toContain("Längste Einheit: Kevin, 120 min Joggen");
  });
  it("epischer Auftritt: Teaser, Beben, Vorzeichen, Steckbrief mit Drohung, angepinnt bis zum Bericht", async () => {
    const { bot, db } = await aufbau();
    const log: string[] = [];
    let id = 500;
    const senden = async (_chat: number, text: string) => {
      log.push(text);
      return ++id;
    };
    const foto = async (_chat: number, png: Uint8Array, beschriftung?: string) => {
      log.push(`FOTO ${Buffer.from(png).subarray(1, 4).toString()} ${beschriftung ?? ""}`);
      return ++id;
    };
    const pins: string[] = [];
    const extras = {
      anpinnen: async (_c: number, n: number) => void pins.push(`an ${n}`),
      loesen: async (_c: number, n: number) => void pins.push(`los ${n}`),
    };
    const lauf = async (iso: string) => {
      plane(db, new Date(iso), TZ);
      await fuehreAus(db, senden, new Date(iso), TZ, foto, extras);
    };
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/sport 60 Joggen"));
    await lauf("2026-10-18T18:00:30Z"); // Bericht Woche 1
    expect(log.at(-1)).toContain("Morgen früh um 9 kommt was");

    await lauf("2026-10-19T07:00:30Z");
    const auftritt = log.slice(-3);
    expect(auftritt[0]).toContain("Der Boden bebt");
    expect(auftritt[2]).toMatch(/^FOTO PNG 🐉 BOSS-WOCHE: .* IST DA!/);
    expect(auftritt[2]).toContain("🗣 „");
    expect(auftritt[2]).toContain("Peter"); // Letzter der Rangliste wird angepöbelt
    expect(pins).toEqual([`an ${id}`]);

    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    await lauf("2026-10-22T16:00:30Z"); // Donnerstag 18 Uhr: 540 von 1.000, er wird nervös
    expect(log.at(-1)).toContain("wird nervös");

    await lauf("2026-10-25T19:00:30Z"); // Bericht Woche 2 löst den Pin
    expect(pins.at(-1)).toBe(pins[0]!.replace("an", "los"));
  });

  it("Boss blutet bei der Hälfte, Spott am Donnerstag bei zu wenig Schaden", async () => {
    const { bot, gesendet, lauf, letzterText } = await aufbau();
    await lauf("2026-10-19T07:00:30Z");
    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 30 Yoga"));
    expect(letzterText()).not.toContain("blutet");
    await lauf("2026-10-22T16:00:30Z");
    const spott = gesendet.at(-1)!;
    expect(spott).toMatch(/^🗣 .*: „/);
    expect(spott).toContain("Peter");
    expect(spott).toContain("noch 970 von 1.000 Lebenspunkten");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).toContain("blutet");
  });
  it("Schwäche des Bosses: nur harte Sportarten ab Krafttraining, nie Spazieren, Yoga & Co.", async () => {
    for (const zufall of [0, 0.3, 0.6, 0.99]) {
      vi.spyOn(Math, "random").mockReturnValue(zufall);
      const { db, lauf } = await aufbau();
      await lauf("2026-10-19T07:00:30Z");
      const boss = db
        .prepare("SELECT sp.name, sp.faktor FROM boss b JOIN sportart sp ON sp.id = b.schwaeche WHERE b.stufe = 1")
        .get() as { name: string; faktor: number };
      expect(boss.faktor).toBeGreaterThanOrEqual(3);
      expect(["Spazierengehen", "Yoga", "Dehnen", "Pilates", "Wandern", "Radfahren locker"]).not.toContain(boss.name);
      const resistenz = db
        .prepare("SELECT sp.faktor FROM boss b JOIN sportart sp ON sp.id = b.resistenz WHERE b.stufe = 1")
        .get() as { faktor: number };
      expect(resistenz.faktor).toBeLessThan(3);
    }
  });
  it("Resistenz des Bosses: eine lockere Sportart macht nur halben Schaden", async () => {
    const { bot, gesendet, lauf, letzterText } = await aufbau();
    await lauf("2026-10-19T07:00:30Z");
    expect(gesendet.at(-1)).toContain("🛡 Dagegen ist er abgehärtet: Spazierengehen");
    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 120 Yoga"));
    expect(letzterText()).not.toContain("Abgeprallt");
    expect(letzterText()).toContain("noch 880 von 1.000 Lebenspunkten"); // Yoga ×1: 120 Schaden
    await bot.handleUpdate(befehl("/sport 120 Spazierengehen"));
    expect(letzterText()).toContain("🛡 Abgeprallt! Spazierengehen kitzelt");
    expect(letzterText()).toContain("💩 Wattebausch");
    expect(letzterText()).toContain("noch 850 von 1.000 Lebenspunkten"); // ×0,5 halbiert: 30 statt 60
  });
  it("Schwäche des Bosses: eine zufällige Sportart macht doppelten Schaden", async () => {
    const { bot, db, gesendet, lauf, letzterText } = await aufbau();
    await lauf("2026-10-19T07:00:30Z");
    expect(gesendet.at(-1)).toContain("💥 Seine Schwäche: Krafttraining!");
    db.prepare("UPDATE boss SET schwaeche = (SELECT id FROM sportart WHERE name = 'Joggen')").run();
    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 120 Joggen"));
    expect(letzterText()).toContain("💥 Volltreffer! Joggen ist die Schwäche");
    expect(letzterText()).toContain("🏆 Wunder Punkt");
    expect(letzterText()).toContain("💀"); // 2 × 540 Schaden reicht für 1.000 Lebenspunkte
    await bot.handleUpdate(befehl("/stand", PRIVAT));
    expect(letzterText()).toContain("Boss-Bonus: +5 Punkte");
  });
});
