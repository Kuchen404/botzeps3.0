import { afterEach, describe, expect, it } from "vitest";
import { eigenesDiagramm, gruppenDiagramm, punkteverlauf } from "../bericht/punkteverlauf.js";
import { seasonNachId } from "../db/season-repo.js";
import { uhr } from "./kontext.js";
import { montagIn, startIn } from "./season.js";
import { GRUPPE, PETER, PRIVAT, befehl, knoepfe, knopf, testBot } from "./testhilfe.js";

const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});

/** Stellt die Uhr auf einen Tag (10 Uhr Berlin). */
function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T08:00:00Z`);
}

const PETER_PRIVAT = { id: PETER.id, type: "private" as const, first_name: "Peter" };

describe("montagIn", () => {
  it("findet den nächsten Montag, nie heute", () => {
    expect(montagIn("2026-10-06", 1)).toBe("2026-10-12"); // Dienstag
    expect(montagIn("2026-10-12", 1)).toBe("2026-10-19"); // Montag
    expect(montagIn("2026-10-11", 1)).toBe("2026-10-12"); // Sonntag
    expect(montagIn("2026-10-06", 3)).toBe("2026-10-26");
  });
});

describe("startIn", () => {
  it("lässt immer eine volle Kalibrierwoche vor dem Start", () => {
    expect(startIn("2026-10-05", 1)).toBe("2026-10-12"); // Montag: in 7 Tagen
    expect(startIn("2026-10-06", 1)).toBe("2026-10-19"); // Dienstag: übernächster Montag
    expect(startIn("2026-10-11", 1)).toBe("2026-10-19"); // Sonntag: übernächster Montag
    expect(startIn("2026-10-06", 3)).toBe("2026-11-02");
  });
});

describe("/season", () => {
  it("ohne Season und ohne Namen: Anleitung", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/season"));
    expect(letzterText()).toContain("/season Name");
  });

  it("legt eine Season an, nimmt alle Mitglieder auf und lässt sie bis zum Start ändern", async () => {
    tag("2026-10-05");
    const { db, bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
    await bot.handleUpdate(befehl("/season Winterspeck 2026"));
    expect(letzterText()).toContain("Season „Winterspeck 2026“");
    expect(letzterText()).toContain("12.10.2026 – 20.12.2026 (10 Wochen)");
    expect(letzterText()).toContain("Kalibrierwoche: 05.10.2026 – 11.10.2026");
    expect(letzterText()).toContain("Teilnehmer: 2");

    const acht = knoepfe(aufrufe).find((k) => k.text === "8 Wo.")!;
    await bot.handleUpdate(knopf(acht.daten));
    expect(letzterText()).toContain("(8 Wochen)");

    const siebzig = knoepfe(aufrufe).find((k) => k.text === "70/30")!;
    await bot.handleUpdate(knopf(siebzig.daten, GRUPPE, PETER));
    expect(aufrufe.at(-1)?.payload.show_alert).toBe(true);
    expect(db.prepare("SELECT gewicht_fleiss FROM season").get()).toEqual({ gewicht_fleiss: 50 });

    tag("2026-10-12");
    await bot.handleUpdate(knopf(siebzig.daten));
    expect(String(aufrufe.at(-1)?.payload.text)).toContain("läuft schon");
  });

  it("kurze Kalibrierung: Start am nächsten Montag per Knopf, Messungen von vorher zählen", async () => {
    tag("2026-10-05");
    const t = testBot();
    await t.bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
    tag("2026-10-07");
    await t.bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
    await t.bot.handleUpdate(befehl("/season Kurz"));
    expect(t.letzterText()).toContain("19.10.2026");
    const kurz = knoepfe(t.aufrufe).find((k) => k.text === "Start 12.10. (kurz)")!;
    await t.bot.handleUpdate(knopf(kurz.daten));
    expect(t.letzterText()).toContain("12.10.2026 – 20.12.2026 (10 Wochen)");
    expect(t.letzterText()).toContain("Kalibrierwoche: 05.10.2026 – 11.10.2026");
    tag("2026-10-08");
    await t.bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
    await t.bot.handleUpdate(befehl("/rangliste"));
    expect(t.letzterText()).toContain("1 von 1 haben ihre 3 Messungen");
  });

  it("am Montag gibt es keinen kurzen Start, der nächste Montag hat schon die volle Woche", async () => {
    tag("2026-10-05");
    const { bot, aufrufe } = testBot();
    await bot.handleUpdate(befehl("/season Eins"));
    expect(knoepfe(aufrufe).some((k) => k.text.includes("(kurz)"))).toBe(false);
  });

  it("nur eine Season gleichzeitig", async () => {
    tag("2026-10-06");
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/season Eins"));
    await bot.handleUpdate(befehl("/season Zwei"));
    expect(letzterText()).toContain("Es gibt schon eine Season");
    expect(db.prepare("SELECT COUNT(*) AS n FROM season").get()).toEqual({ n: 1 });
  });

  it("nach dem Finale am letzten Sonntag geht schon die nächste", async () => {
    tag("2026-10-06");
    const { db, bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/season Eins"));
    tag("2026-12-20"); // letzter Tag von Eins (12.10. + 10 Wochen)
    await bot.handleUpdate(befehl("/season Zwei"));
    expect(letzterText()).toContain("Es gibt schon eine Season");

    db.prepare("INSERT INTO termin (art, season, faellig_am, erledigt_am) VALUES ('finale', 1, '2026-12-20T18:00:00Z', '2026-12-20T18:00:05Z')").run();
    await bot.handleUpdate(befehl("/season Zwei"));
    expect(letzterText()).toContain("Season „Zwei“");
    expect(letzterText()).toContain("21.12.2026");
    expect(db.prepare("SELECT COUNT(*) AS n FROM season").get()).toEqual({ n: 2 });
  });

  it("wer später dazukommt, ist automatisch dabei", async () => {
    tag("2026-10-06");
    const { db, bot } = testBot();
    await bot.handleUpdate(befehl("/season Eins"));
    tag("2026-10-20");
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
    expect(db.prepare("SELECT n.name, t.beitritt FROM teilnahme t JOIN nutzer n ON n.id = t.nutzer ORDER BY n.name").all()).toEqual([
      { name: "Kevin", beitritt: "2026-10-06" },
      { name: "Peter", beitritt: "2026-10-20" },
    ]);
  });
});

describe("/rangliste und /stand", () => {
  async function seasonMitDaten() {
    const t = testBot();
    tag("2026-10-05");
    await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
    await t.bot.handleUpdate(befehl("/season Winterspeck"));
    for (const d of ["2026-10-07", "2026-10-08", "2026-10-09"]) {
      tag(d);
      await t.bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
    }
    return t;
  }

  it("vor dem Start: Kalibrierungsstand", async () => {
    const { bot, aufrufe, letzterText } = await seasonMitDaten();
    await bot.handleUpdate(befehl("/rangliste"));
    expect(letzterText()).toContain("startet am 12.10.2026");
    expect(letzterText()).toContain("1 von 2 haben ihre 3 Messungen");

    await bot.handleUpdate(befehl("/stand", PETER_PRIVAT, PETER));
    expect(letzterText()).toContain("0 von 3 Messungen zwischen 05.10.2026 und 11.10.2026");
    expect(aufrufe.some((a) => a.methode === "sendPhoto")).toBe(false);
  });

  it("während der Season: Rangliste mit Punkten, Stand privat mit Details", async () => {
    const { db, bot, aufrufe, letzterText } = await seasonMitDaten();
    tag("2026-10-13");
    await bot.handleUpdate(befehl("/waage 90 27 40", PRIVAT));
    tag("2026-10-14");
    await bot.handleUpdate(befehl("/waage 90 27 40", PRIVAT));
    await bot.handleUpdate(befehl("/sport 100 Joggen"));
    await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));

    await bot.handleUpdate(befehl("/rangliste"));
    const rangliste = letzterText();
    expect(rangliste).toContain("Woche 1 von 10");
    // Kevin: Fleiß 10 + Fortschritt 10 × 10 % Fettabbau = 100
    expect(rangliste).toContain("1. Kevin: 110 (Fleiß 10 · Fortschritt 100) ✅");
    expect(rangliste).toContain("2. Peter: 1 (Fleiß 1 · Fortschritt –)");
    expect(rangliste).toContain("Fleiß der Woche bisher: Kevin");
    expect(rangliste).not.toContain("kg");

    await bot.handleUpdate(befehl("/stand", PRIVAT));
    const privat = letzterText();
    expect(privat).toContain("Platz 1 von 2 mit 110 Punkten");
    expect(privat).toContain("Diese Woche: 300 von 300 Lastpunkten ✅");
    expect(privat).toContain("Fett 27 → 24,3 kg (−10 %)");

    await bot.handleUpdate(befehl("/stand"));
    expect(letzterText()).toContain("Fortschritt: 100 Punkte");
    expect(letzterText()).not.toContain("kg");
    // Nach jedem /stand der eigene Verlauf als Bild
    expect(aufrufe.filter((a) => a.methode === "sendPhoto").map((a) => a.payload.chat_id)).toEqual([PRIVAT.id, GRUPPE.id]);

    const s = seasonNachId(db, 1)!;
    const verlauf = punkteverlauf(db, s, "2026-10-14")!;
    expect(verlauf.x).toEqual(["Start", "W1"]);
    expect(eigenesDiagramm(s, verlauf, verlauf.ende[0]!.id)?.reihen).toEqual([
      { name: "Gesamt", werte: [0, 110] },
      { name: "Fleiß", werte: [0, 10] },
      { name: "Fortschritt", werte: [0, 100] },
    ]);
    expect(gruppenDiagramm(s, verlauf).reihen.map((r) => r.name)).toEqual(["1. Kevin", "2. Peter"]);
    expect(punkteverlauf(db, s, "2026-10-21")!.x).toEqual(["Start", "W1", "W2"]);
    expect(punkteverlauf(db, s, "2026-10-11")).toBeNull();
  });

  it("ohne Season: Hinweis", async () => {
    const { bot, letzterText } = testBot();
    await bot.handleUpdate(befehl("/rangliste"));
    expect(letzterText()).toContain("Keine Season");
    await bot.handleUpdate(befehl("/stand", PRIVAT));
    expect(letzterText()).toContain("in keiner Season");
  });
});

describe("/einfuehrung", () => {
  it("kommt beim Anlegen der Season vor dem Formular, mit Kalibrierwoche und Gewichtung", async () => {
    tag("2026-10-05");
    const { bot, gesendet } = testBot();
    await bot.handleUpdate(befehl("/season Herbst"));
    const texte = gesendet().map((g) => String(g.payload.text));
    expect(texte).toHaveLength(2);
    expect(texte[0]).toContain("So läuft die Season „Herbst“");
    expect(texte[0]).toContain("💪 Fleiß");
    expect(texte[0]).toContain("⚖️ Fortschritt");
    expect(texte[0]).toContain("Kalibrierwoche (05.10.2026 – 11.10.2026)");
    expect(texte[0]).toContain("Fleiß und Fortschritt zählen gleich viel.");
    expect(texte[1]).toContain("Season „Herbst“");
  });

  it("zeigt die aktuelle Gewichtung, auch privat und ohne Season", async () => {
    tag("2026-10-06");
    const { bot, aufrufe, letzterText } = testBot();
    await bot.handleUpdate(befehl("/einfuehrung", PRIVAT));
    expect(letzterText()).toContain("So läuft Botzeps");
    expect(letzterText()).not.toContain("Kalibrierwoche (");

    await bot.handleUpdate(befehl("/season Herbst"));
    const siebzig = knoepfe(aufrufe).find((k) => k.text === "70/30")!;
    await bot.handleUpdate(knopf(siebzig.daten));
    await bot.handleUpdate(befehl("/einfuehrung"));
    expect(letzterText()).toContain("Fleiß 70 % und Fortschritt 30 %");
    await bot.handleUpdate(befehl("/einfuehrung", PRIVAT));
    expect(letzterText()).toContain("So läuft die Season „Herbst“");
  });
});
