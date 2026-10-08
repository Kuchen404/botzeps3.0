import { afterEach, describe, expect, it } from "vitest";
import { aendereSeason } from "../db/season-repo.js";
import { uhr } from "../bot/kontext.js";
import { GRUPPE, PETER, befehl, knopf, testBot } from "../bot/testhilfe.js";
import { fuehreAus, plane } from "../zeitplan.js";
import { seasonNachId } from "../db/season-repo.js";
import { minispielFuerApp } from "./ablauf.js";

const TZ = "Europe/Berlin";
const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});

function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T10:00:00Z`);
}

/** Season ab Mo 12.10.2026 mit Kevin und Peter, 4 Wochen: Bosse in Woche 2 und 3, Minispiel in Woche 4 (02.11. bis 08.11.). */
async function aufbau() {
  const t = testBot();
  tag("2026-10-05");
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  aendereSeason(t.db, 1, { wochen: 4 });
  const gesendet: { chatId: number; text: string }[] = [];
  let id = 500;
  const senden = async (chatId: number, text: string) => {
    gesendet.push({ chatId, text });
    return ++id;
  };
  const gepinnt: number[] = [];
  const geloest: number[] = [];
  const extras = {
    anpinnen: async (_c: number, n: number) => gepinnt.push(n),
    loesen: async (_c: number, n: number) => geloest.push(n),
  };
  const lauf = async (iso: string) => {
    const jetzt = new Date(iso);
    plane(t.db, jetzt, TZ);
    return fuehreAus(t.db, senden, jetzt, TZ, undefined, extras);
  };
  const gruppe = () => gesendet.filter((g) => g.chatId === GRUPPE.id).map((g) => g.text);
  return { ...t, gruppe, lauf, gepinnt, geloest };
}

describe("Minispiel im Zeitplan", () => {
  it("Teaser, Ankündigung mit Pin, Meldung beim Training, Halbzeit, Rangliste und Auflösung nach dem Finale", async () => {
    const { db, bot, gruppe, lauf, letzterText, gepinnt, geloest } = await aufbau();
    // Die Bombe soll es werden; Peter hat schon mal trainiert, Kevin noch nie
    db.prepare("INSERT INTO minispiel (season, woche, art) VALUES (1, 3, 'bombe')").run();
    tag("2026-10-14");
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));

    await lauf("2026-11-01T19:00:30Z");
    expect(gruppe().at(-1)).toContain("💣 Hört ihr das? Tick. Tack.");

    const pinsVorher = gepinnt.length; // die Bosse wurden auch angepinnt
    await lauf("2026-11-02T08:00:30Z");
    const ankuendigung = gruppe().at(-1)!;
    expect(ankuendigung).toContain("💣 TICKENDE BOMBE!");
    expect(ankuendigung).toContain("Sonntag um 20:00 geht sie hoch.");
    expect(ankuendigung).toContain("Gerade tickt sie bei Kevin.");
    expect(gepinnt).toHaveLength(pinsVorher + 1);
    // Kein zweites Mal
    await lauf("2026-11-02T08:05:00Z");
    expect(gruppe().filter((x) => x.includes("TICKENDE BOMBE"))).toHaveLength(1);

    tag("2026-11-02");
    await bot.handleUpdate(befehl("/sport 45 Joggen"));
    expect(letzterText()).toContain("💣 Kevin wirft die Bombe weiter! Jetzt tickt sie bei Peter.");

    await lauf("2026-11-05T08:00:30Z");
    expect(gruppe().at(-1)).toBe("💣 Tick, tack. Halbzeit, und die Bombe liegt bei Peter. Beweg deinen Arsch.");
    tag("2026-11-05");
    await bot.handleUpdate(befehl("/rangliste"));
    expect(letzterText()).toMatch(/Peter: .* 💣/);

    await lauf("2026-11-08T19:00:30Z");
    expect(gruppe().at(-2)).toContain("Finale „Herbst“");
    expect(gruppe().at(-1)).toBe(
      "💥 BUMM! Die Bombe ist bei Peter hochgegangen, letztes Training am 14.10. Wir kratzen die Reste mit dem Spachtel von der Wand.",
    );
    expect(geloest.at(-1)).toBe(gepinnt.at(-1));
  });

  it("verpasste Ankündigungen und Lagemeldungen werden nicht nachgeholt, wenn ihre Zeit vorbei ist", async () => {
    const { db, gruppe, lauf } = await aufbau();
    db.prepare("INSERT INTO minispiel (season, woche, art) VALUES (1, 3, 'tresor')").run();
    await lauf("2026-11-09T08:00:00Z");
    expect(gruppe().some((x) => x.includes("TRESOR"))).toBe(false);
    expect(db.prepare("SELECT daten FROM minispiel").pluck().get()).toBeNull();
  });

  it("ohne festgelegtes Spiel wird beim Teaser eins gelost", async () => {
    const { db, gruppe, lauf } = await aufbau();
    await lauf("2026-11-01T19:00:30Z");
    const art = db.prepare("SELECT art FROM minispiel WHERE season = 1 AND woche = 3").pluck().get();
    expect(["zombie", "bombe", "kopfgeld", "gipfel", "tauziehen", "tresor", "duell"]).toContain(art);
    await lauf("2026-11-02T08:00:30Z");
    expect(gruppe().at(-1)).toMatch(/^\S+ [A-ZÄÖÜ -]+!\n/);
  });

  it("Mini App zeigt das laufende Spiel, hier den Berg mit allen Kletterern", async () => {
    const { db, bot, lauf } = await aufbau();
    db.prepare("INSERT INTO minispiel (season, woche, art) VALUES (1, 3, 'gipfel')").run();
    await lauf("2026-11-02T08:00:30Z");
    tag("2026-11-03");
    await bot.handleUpdate(befehl("/sport 50 Joggen"));
    const s = seasonNachId(db, 1)!;
    const kevin = String(db.prepare("SELECT id FROM nutzer WHERE name = 'Kevin'").pluck().get());
    const m = minispielFuerApp(db, s, "2026-11-03", kevin)!;
    expect(m).toMatchObject({ art: "gipfel", name: "Gipfelsturm", woche: 4, status: "0 von 2 oben" });
    expect("gipfel" in m && m.gipfel).toEqual([
      { name: "Kevin", anteil: 0.5, hoehe: 4420, oben: false, ich: true },
      { name: "Peter", anteil: 0, hoehe: 0, oben: false, ich: false },
    ]);
    expect(minispielFuerApp(db, s, "2026-11-09", kevin)).toBeNull();
  });
});
