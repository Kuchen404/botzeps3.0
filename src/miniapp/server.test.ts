import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { erstelleServer } from "../server.js";
import { uhr } from "../bot/kontext.js";
import { GRUPPE, KEVIN, PETER, PRIVAT, befehl, knopf, testBot } from "../bot/testhilfe.js";
import { signiereInitData } from "./auth.js";
import { kuendigeBossAn } from "../db/season-repo.js";

const TOKEN = "test-token";
const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});
function tag(datum: string): void {
  uhr.jetzt = () => new Date(`${datum}T08:00:00Z`);
}

function anmeldung(von: { id: number; first_name: string }): string {
  return `tma ${signiereInitData({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(von) }, TOKEN)}`;
}

/** Season mit Kevin (kalibriert, Fortschritt, ein Training) und Peter, Server auf freiem Port. */
async function aufbau() {
  const t = testBot();
  tag("2026-10-05");
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  for (const d of ["2026-10-07", "2026-10-08", "2026-10-09"]) {
    tag(d);
    await t.bot.handleUpdate(befehl("/waage 90 30 40", PRIVAT));
  }
  tag("2026-10-13");
  await t.bot.handleUpdate(befehl("/waage 90 27 40", PRIVAT));
  tag("2026-10-14");
  await t.bot.handleUpdate(befehl("/waage 90 27 40", PRIVAT));
  await t.bot.handleUpdate(befehl("/sport 100 Joggen"));
  await t.bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));

  const posts: { chat: number; nachricht: number; text: string | null }[] = [];
  const server = erstelleServer({
    miniApp: {
      db: t.db,
      botToken: TOKEN,
      gruppenpost: async (chat, nachricht, text) => void posts.push({ chat, nachricht, text }),
      gruppensenden: async (chat, text) => {
        posts.push({ chat, nachricht: 0, text });
        return 777;
      },
    },
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const holen = async (pfad: string, von: { id: number; first_name: string } | null = KEVIN, body?: unknown) => {
    const r = await fetch(basis + pfad, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(von ? { authorization: anmeldung(von) } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json()) as Record<string, any> };
  };
  return { ...t, server, basis, holen, posts };
}

describe("Mini App", () => {
  it("liefert Figuren ohne Anmeldung als langfristig gecachte PNGs, nur aus der festen Medienliste", async () => {
    const t = await aufbau();
    try {
      const daten = await t.holen("/api/figuren");
      const pfad = daten.json.figuren[0].bild.match(/href="([^"]+)"/)[1];
      const bild = await fetch(t.basis + pfad);
      expect(bild.status).toBe(200);
      expect(bild.headers.get("content-type")).toBe("image/png");
      expect(bild.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(bild.headers.get("x-content-type-options")).toBe("nosniff");
      const bytes = Buffer.from(await bild.arrayBuffer());
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(Number(bild.headers.get("content-length"))).toBe(bytes.length);
      for (const ungueltig of ["prompts.json", "unbekannt.png", "0.png", "..%2F..%2Fpackage.json"]) {
        expect((await fetch(t.basis + "/app/figuren/" + ungueltig)).status).toBe(404);
      }
      expect((await fetch(t.basis + pfad, { method: "POST" })).status).toBe(404);
    } finally {
      t.server.close();
      t.db.close();
    }
  });

  it("liefert die Seite mit CSP-Nonce", async () => {
    const { server, basis } = await aufbau();
    try {
      const r = await fetch(`${basis}/app`);
      const html = await r.text();
      const nonce = /'nonce-([^']+)'/.exec(r.headers.get("content-security-policy") ?? "")?.[1];
      expect(nonce).toBeTruthy();
      expect(html).toContain(`<script nonce="${nonce}">`);
      expect(r.headers.get("content-security-policy")).toContain("frame-ancestors https://web.telegram.org");
    } finally {
      server.close();
    }
  });

  it("ohne gültige Anmeldung: 401", async () => {
    const { server, holen, basis } = await aufbau();
    try {
      expect((await holen("/api/ich", null)).status).toBe(401);
      const r = await fetch(`${basis}/api/ich`, { headers: { authorization: "tma user=%7B%22id%22%3A42%7D&hash=" + "0".repeat(64) } });
      expect(r.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("/api/ich: eigener Stand mit Rohwerten, von anderen nur Punkte", async () => {
    const { server, holen } = await aufbau();
    try {
      const { status, json } = await holen("/api/ich");
      expect(status).toBe(200);
      const s = json.seasons[0];
      expect(s).toMatchObject({ name: "Herbst", gruppe: "Pumper", laeuft: true, woche: 1, anzahl: 2 });
      expect(s.ich).toMatchObject({ platz: 1, gesamt: 110, fleiss: 10, fortschritt: 100, wochenLast: 450, zielErreicht: true });
      expect(s.ich.fettKg).toEqual({ start: 27, aktuell: 24.3 });
      expect(s.rangliste).toEqual([
        { platz: 1, name: "Kevin", gesamt: 110, ich: true, laterne: false, marke: null },
        { platz: 2, name: "Peter", gesamt: 0.7, ich: false, laterne: false, marke: null },
      ]);
      expect(s.verlauf.x).toEqual(["Start", "Mo 12.10.", "Di 13.10.", "Mi 14.10.", "Do 15.10.", "Fr 16.10.", "Sa 17.10.", "So 18.10."]);
      expect(s.verlauf.achse).toEqual(["Start", null, null, null, null, null, null, "W1"]);
      expect(s.verlauf.reihen[0].werte.slice(2)).toEqual([0, 110, null, null, null, null]);
      expect(json.messungen).toHaveLength(5);
      expect(json.einstellungen).toEqual({ erinnerungen: true, uhrzeit: "19:00" });

      const peter = await holen("/api/ich", PETER);
      expect(peter.json.messungen).toEqual([]);
      expect(JSON.stringify(peter.json)).not.toContain("24.3");
    } finally {
      server.close();
    }
  });

  it("/api/ich: Bombe nutzt stabile Spieler-IDs und die gewählten Season-Figuren", async () => {
    const { server, holen, bot, db } = await aufbau();
    try {
      const ids = db.prepare("SELECT id, name FROM nutzer ORDER BY name").all() as { id: number; name: string }[];
      const kevin = ids.find((n) => n.name === "Kevin")!.id;
      const peter = ids.find((n) => n.name === "Peter")!.id;
      db.prepare("UPDATE teilnahme SET figur = 0 WHERE nutzer = ?").run(kevin);
      db.prepare("INSERT INTO minispiel (season, woche, art, daten) VALUES (1, 1, 'bombe', ?)")
        .run(JSON.stringify({ art: "bombe", spieler: [String(kevin), String(peter)] }));
      tag("2026-10-20");
      const b = (await holen("/api/ich")).json.seasons[0].minispiel.bombe;
      expect(b.id).toBe("1:1");
      expect(b.spieler).toEqual([
        { id: String(kevin), name: "Kevin", ich: true, figur: 0 },
        { id: String(peter), name: "Peter", ich: false, figur: null },
      ]);
      expect(Object.keys(b.figuren)).toEqual(["0"]);
      expect(Object.keys(b.figuren[0])).toEqual(["bereit", "schlag", "jubel"]);
      expect(b.figuren[0].bereit).toContain("/app/figuren/");
      expect(b.figuren[0].bereit).toContain("bombe0bereit");
      // Gleicher Trainingstag: Eintragszeit entscheidet, nicht Name oder Reihenfolge.
      db.prepare("UPDATE training SET erstellt_am = '2026-10-14T08:00:00Z' WHERE nutzer = ?").run(kevin);
      db.prepare("UPDATE training SET erstellt_am = '2026-10-14T09:00:00Z' WHERE nutzer = ?").run(peter);
      expect((await holen("/api/ich")).json.seasons[0].minispiel.bombe.traeger).toBe(String(kevin));
      await bot.handleUpdate(befehl("/sport 30 Yoga"));
      const danach = (await holen("/api/ich")).json.seasons[0].minispiel.bombe;
      expect(danach.traeger).toBe(String(peter));
      expect(danach.spieler[0].figur).toBe(0);
      // Gleiche Namen dürfen weder Figuren noch die Träger-ID vermischen.
      db.prepare("UPDATE nutzer SET name = 'Kevin' WHERE id = ?").run(peter);
      const gleich = (await holen("/api/ich")).json.seasons[0].minispiel.bombe;
      expect(gleich.spieler.map((sp: { name: string }) => sp.name)).toEqual(["Kevin", "Kevin"]);
      expect(gleich.traeger).toBe(String(peter));
      expect((await holen("/api/ich", PETER)).json.seasons[0].minispiel.bombe.spieler[1].ich).toBe(true);
    } finally {
      server.close();
      db.close();
    }
  });

  it("/api/ich: Boss mit Lebenspunkten und Kämpfern, stärkste zuerst", async () => {
    const { server, holen, bot, db } = await aufbau();
    try {
      expect((await holen("/api/ich")).json.seasons[0].boss).toBeNull();
      kuendigeBossAn(db, 1, 1, "König Bierbauch", 650);
      tag("2026-10-20");
      await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
      await bot.handleUpdate(befehl("/sport 100 Joggen"));
      expect((await holen("/api/figur", KEVIN, { chat: GRUPPE.id, figur: 3 })).status).toBe(200);
      const boss = (await holen("/api/ich")).json.seasons[0].boss;
      expect(boss).toEqual({
        name: "König Bierbauch",
        emoji: "🍺",
        bild: expect.stringContaining("<svg"),
        stufe: 1,
        woche: 2,
        aktiv: true,
        lebenspunkte: 650,
        schaden: 480,
        besiegt: false,
        bonus: 5,
        schwaeche: null,
        resistenz: null,
        kaempfer: [
          { name: "Kevin", schaden: 450, ich: true, figur: 3 },
          { name: "Peter", schaden: 30, ich: false, figur: null },
        ],
        drueckeberger: [],
        pennen: [],
        figuren: {
          3: { bereit: expect.stringContaining("<svg"), schlag: expect.stringContaining("<svg"), jubel: expect.stringContaining("<svg") },
        },
      });
      // Nach der Boss-Woche bleibt er als Ergebnis sichtbar
      tag("2026-10-27");
      expect((await holen("/api/ich")).json.seasons[0].boss).toMatchObject({ aktiv: false, besiegt: false });
    } finally {
      server.close();
    }
  });

  it("/api/figur: wer in der ersten Boss-Woche zuerst trainiert, wählt zuerst", async () => {
    const { server, holen, bot, db, letzterText } = await aufbau();
    const figur = async (von = KEVIN) => (await holen("/api/ich", von)).json.seasons[0].figur;
    const waehle = async (nr: number, von = KEVIN) => (await holen("/api/figur", von, { chat: GRUPPE.id, figur: nr })).status;
    try {
      const alle = (await holen("/api/figuren")).json.figuren;
      expect(alle).toHaveLength(12);
      expect(alle[0]).toMatchObject({ nr: 0, name: "Der Pumper", bild: expect.stringContaining("<svg") });
      // Noch kein Spiel mit Figuren: keine Wahl
      expect(await figur()).toEqual({ meine: null, darfWaehlen: false, freiAb: null, vergeben: {} });
      kuendigeBossAn(db, 1, 1, "König Bierbauch", 650);
      tag("2026-10-20");
      expect(await figur()).toMatchObject({ darfWaehlen: false, freiAb: "2026-10-19" });
      expect(await waehle(0)).toBe(403);

      // Erstes Training in der Boss-Woche schaltet frei und kündigt es im Post an
      await bot.handleUpdate(befehl("/sport 30 Joggen"));
      expect(letzterText()).toContain("Kämpferfigur");
      expect(await figur()).toMatchObject({ darfWaehlen: true });
      await bot.handleUpdate(befehl("/sport 20 Joggen"));
      expect(letzterText()).not.toContain("Kämpferfigur");

      expect((await holen("/api/figur", KEVIN, { chat: GRUPPE.id, figur: 12 })).status).toBe(400);
      expect((await holen("/api/figur", KEVIN, { chat: 1, figur: 0 })).status).toBe(404);
      expect(await waehle(0)).toBe(200);
      expect(await figur()).toEqual({ meine: 0, darfWaehlen: false, freiAb: "2026-10-19", vergeben: { 0: "Kevin" } });
      // Gewählt ist gewählt
      expect(await waehle(1)).toBe(409);

      // Peter kommt später und bekommt, was übrig ist
      expect(await waehle(5, PETER)).toBe(403);
      await bot.handleUpdate(befehl("/sport 30 Yoga", GRUPPE, PETER));
      expect(await figur(PETER)).toMatchObject({ meine: null, darfWaehlen: true, vergeben: { 0: "Kevin" } });
      expect(await waehle(0, PETER)).toBe(409);
      expect(await waehle(5, PETER)).toBe(200);
    } finally {
      server.close();
    }
  });

  it("Einträge ändern und löschen, nur eigene, mit Gruppenpost", async () => {
    const { server, holen, posts } = await aufbau();
    try {
      const { json } = await holen("/api/eintraege");
      const training = json.eintraege.find((e: { art: string }) => e.art === "t");
      expect(training).toMatchObject({ minuten: 100, sportart: "Joggen", aenderbar: true });
      expect(training.gruppeChat).toBeUndefined();

      expect((await holen("/api/eintrag/dauer", PETER, { id: training.id, minuten: 60 })).status).toBe(403);
      expect((await holen("/api/eintrag/dauer", KEVIN, { id: training.id, minuten: 61 })).status).toBe(400);
      expect((await holen("/api/eintrag/dauer", KEVIN, { id: training.id, minuten: 60 })).status).toBe(200);
      expect(posts.at(-1)).toMatchObject({ chat: GRUPPE.id, text: "Kevin: 60 min Joggen (korrigiert von 100 min)" });

      expect((await holen("/api/eintrag/loeschen", KEVIN, { art: "t", id: training.id })).status).toBe(200);
      expect(posts.at(-1)?.text).toBeNull();
      expect((await holen("/api/eintrag/loeschen", KEVIN, { art: "t", id: training.id })).status).toBe(403);

      // Älter als 2 Tage: nicht mehr änderbar
      tag("2026-10-20");
      const alt = (await holen("/api/eintraege")).json.eintraege.find((e: { art: string }) => e.art === "m");
      expect(alt.aenderbar).toBe(false);
      expect((await holen("/api/eintrag/loeschen", KEVIN, { art: "m", id: alt.id })).status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("Training eintragen: in der eigenen Gruppe gepostet, fremde Sportart abgelehnt", async () => {
    const { server, holen, posts, db } = await aufbau();
    try {
      const e = (await holen("/api/eingabe")).json;
      expect(e.gruppen).toHaveLength(1);
      expect(e.gruppen[0]).toMatchObject({ chat: GRUPPE.id, name: "Pumper" });
      // Zuletzt benutzte Sportart zuerst
      expect(e.gruppen[0].sportarten[0]).toMatchObject({ name: "Joggen", faktor: 4.5 });
      expect(e.gruppen[0].sportarten.find((s: { name: string }) => s.name === "Spazierengehen")).toMatchObject({ faktor: 0.5, nachSchritten: true });
      expect(e.letzteMessung).toEqual({ gewichtKg: 90, fettPct: 27, muskelPct: 40 });
      const yoga = e.gruppen[0].sportarten.find((s: { name: string }) => s.name === "Yoga");

      const r = await holen("/api/training", KEVIN, { chat: GRUPPE.id, sportart: yoga.id, minuten: 40, tage: 1 });
      expect(r.status).toBe(200);
      expect(r.json.text).toBe("Eingetragen: 40 min Yoga (gestern), 40 Lastpunkte. In „Pumper“ gepostet.");
      expect(posts.at(-1)).toMatchObject({ chat: GRUPPE.id, text: expect.stringContaining("(gestern)") });
      const t = db.prepare("SELECT datum, minuten, gruppen_nachricht_id AS post FROM training ORDER BY id DESC LIMIT 1").get();
      expect(t).toEqual({ datum: "2026-10-13", minuten: 40, post: 777 });

      expect((await holen("/api/training", KEVIN, { chat: GRUPPE.id, sportart: yoga.id, minuten: 4, tage: 0 })).status).toBe(400);
      expect((await holen("/api/training", KEVIN, { chat: GRUPPE.id, sportart: yoga.id, minuten: 30, tage: 3 })).status).toBe(400);
      expect((await holen("/api/training", KEVIN, { chat: -1, sportart: yoga.id, minuten: 30, tage: 0 })).status).toBe(403);
      // Spazieren mit Schritten: Faktor aus dem Tempo, unplausible Schritte abgelehnt
      const spazieren = e.gruppen[0].sportarten.find((s: { name: string }) => s.name === "Spazierengehen");
      const flott = await holen("/api/training", KEVIN, { chat: GRUPPE.id, sportart: spazieren.id, minuten: 60, tage: 0, schritte: 7800 });
      expect(flott.json.text).toBe("Eingetragen: 60 min Spazierengehen, 180 Lastpunkte. In „Pumper“ gepostet.");
      expect(posts.at(-1)?.text).toContain("(7.800 Schritte, 130 pro Minute: ×3)");
      expect((await holen("/api/training", KEVIN, { chat: GRUPPE.id, sportart: spazieren.id, minuten: 60, tage: 0, schritte: 99_999 })).status).toBe(400);
      // Schritte bei anderen Sportarten werden ignoriert
      const mitYoga = await holen("/api/training", KEVIN, { chat: GRUPPE.id, sportart: yoga.id, minuten: 60, tage: 0, schritte: 7800 });
      expect(mitYoga.json.text).toContain("60 Lastpunkte");

      // Wer nicht in der Gruppe ist, darf dort nichts eintragen
      const fremd = { id: 99, first_name: "Fremd" };
      expect((await holen("/api/training", fremd, { chat: GRUPPE.id, sportart: yoga.id, minuten: 30, tage: 0 })).status).toBe(403);
      expect((await holen("/api/eingabe", fremd)).json.gruppen).toEqual([]);
    } finally {
      server.close();
    }
  });

  it("Variante umstellen: locker ↔ sportlich, nach 2 Tagen nur bei Einträgen von vor der Teilung", async () => {
    const { server, holen, posts, db, bot } = await aufbau();
    try {
      await bot.handleUpdate(befehl("/sport 60 Radfahren locker"));
      const eintraege = (await holen("/api/eintraege")).json.eintraege;
      const rad = eintraege.find((e: { sportart?: string }) => e.sportart === "Radfahren locker");
      expect(rad).toMatchObject({ variante: "Radfahren sportlich", umstellbar: true });
      expect(eintraege.find((e: { sportart?: string }) => e.sportart === "Joggen").umstellbar).toBe(false);

      expect((await holen("/api/eintrag/variante", PETER, { id: rad.id })).status).toBe(403);
      expect((await holen("/api/eintrag/variante", KEVIN, { id: rad.id })).status).toBe(200);
      expect(posts.at(-1)?.text).toBe("Kevin: 60 min Radfahren sportlich (korrigiert von Radfahren locker)");
      expect(db.prepare("SELECT faktor FROM training WHERE id = ?").get(rad.id)).toEqual({ faktor: 5 });

      // Nach 2 Tagen nicht mehr, außer der Eintrag stammt von vor der Teilung
      tag("2026-10-20");
      expect((await holen("/api/eintrag/variante", KEVIN, { id: rad.id })).status).toBe(403);
      db.prepare("UPDATE training SET variante_offen = 1 WHERE id = ?").run(rad.id);
      const offen = (await holen("/api/eintraege")).json.eintraege.find((e: { id: number; art: string }) => e.art === "t" && e.id === rad.id);
      expect(offen).toMatchObject({ aenderbar: false, umstellbar: true, variante: "Radfahren locker" });
      expect((await holen("/api/eintrag/variante", KEVIN, { id: rad.id })).status).toBe(200);
      expect(db.prepare("SELECT faktor, variante_offen AS offen FROM training WHERE id = ?").get(rad.id)).toEqual({ faktor: 1, offen: 0 });
      expect((await holen("/api/eintrag/variante", KEVIN, { id: rad.id })).status).toBe(403);
    } finally {
      server.close();
    }
  });

  it("Messung eintragen: Grenzen geprüft, großer Sprung erst nach Rückfrage", async () => {
    const { server, holen, db } = await aufbau();
    try {
      const ok = await holen("/api/messung", KEVIN, { gewichtKg: 89.5, fettPct: 26.8, muskelPct: 40.1, tage: 0 });
      expect(ok.json).toEqual({ ok: true, text: "Gespeichert: 89,5 kg\nFett 26,8 % = 24 kg\nMuskel 40,1 % = 35,9 kg" });

      const unsinn = await holen("/api/messung", KEVIN, { gewichtKg: 300, fettPct: 20, muskelPct: 40, tage: 0 });
      expect(unsinn.status).toBe(400);
      expect(unsinn.json.fehler).toContain("Gewicht 300 kg ist unplausibel");

      const sprung = await holen("/api/messung", KEVIN, { gewichtKg: 80, fettPct: 27, muskelPct: 40, tage: 0 });
      expect(sprung.json).toEqual({ ok: false, sprung: { gewichtKg: 89.9, fettPct: 28.2 } });
      const anzahl = () => (db.prepare("SELECT COUNT(*) AS n FROM messung").get() as { n: number }).n;
      expect(anzahl()).toBe(6);

      const trotzdem = await holen("/api/messung", KEVIN, { gewichtKg: 80, fettPct: 27, muskelPct: 40, tage: 0, trotzdem: true });
      expect(trotzdem.json.ok).toBe(true);
      expect(db.prepare("SELECT markiert FROM messung ORDER BY id DESC LIMIT 1").get()).toEqual({ markiert: 1 });
      expect(anzahl()).toBe(7);
    } finally {
      server.close();
    }
  });

  it("Einstellungen speichern, Unsinn abgelehnt", async () => {
    const { server, holen } = await aufbau();
    try {
      expect((await holen("/api/einstellungen", KEVIN, { erinnerungen: false, uhrzeit: "18:30" })).status).toBe(200);
      expect((await holen("/api/ich")).json.einstellungen).toEqual({ erinnerungen: false, uhrzeit: "18:30" });
      expect((await holen("/api/einstellungen", KEVIN, { uhrzeit: "25:00" })).status).toBe(400);
      expect((await holen("/api/gibtsnicht")).status).toBe(404);
    } finally {
      server.close();
    }
  });

  it("/api/ruhm: Rang mit Weg zum nächsten, alle Erfolge, Ruhmeshalle der Gruppe", async () => {
    const { server, holen } = await aufbau();
    try {
      const r = await holen("/api/ruhm");
      expect(r.status).toBe(200);
      expect(r.json.rang).toMatchObject({ name: "Couchkartoffel", ab: 0, naechster: { name: "Lauch", ab: 1500 } });
      expect(r.json.rang.last).toBeGreaterThan(0);
      expect(r.json.rang.naechster.fehlen).toBe(1500 - r.json.rang.last);
      expect(r.json.raenge).toHaveLength(7);
      expect(r.json.erfolge).toHaveLength(14);
      expect(r.json.erfolge.find((e: { art: string }) => e.art === "erste_einheit")).toMatchObject({
        titel: "Erster Schweißtropfen",
        erreichtAm: "2026-10-14",
      });
      expect(r.json.erfolge.find((e: { art: string }) => e.art === "champion").erreichtAm).toBeNull();
      expect(r.json.gruppen).toHaveLength(1);
      expect(r.json.gruppen[0]).toMatchObject({ chat: GRUPPE.id, name: "Pumper" });
      const mitglieder = r.json.gruppen[0].mitglieder as { name: string; ich: boolean; emoji: string }[];
      expect(mitglieder.map((m) => m.name)).toEqual(["Kevin", "Peter"]);
      expect(mitglieder[0]).toMatchObject({ ich: true, emoji: "🛋" });
      expect(r.json.gruppen[0].laengsteEinheit).toMatchObject({ name: "Kevin", minuten: 100 });
      // Keine Waagenwerte anderer Leute
      expect(JSON.stringify(r.json)).not.toContain("fett");
    } finally {
      server.close();
    }
  });
});
