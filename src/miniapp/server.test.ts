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
  tag("2026-10-06");
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
    miniApp: { db: t.db, botToken: TOKEN, gruppenpost: async (chat, nachricht, text) => void posts.push({ chat, nachricht, text }) },
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
      expect(s.ich).toMatchObject({ platz: 1, gesamt: 110, fleiss: 10, fortschritt: 100, wochenLast: 300, zielErreicht: true });
      expect(s.ich.fettKg).toEqual({ start: 27, aktuell: 24.3 });
      expect(s.rangliste).toEqual([
        { platz: 1, name: "Kevin", gesamt: 110, ich: true, laterne: false },
        { platz: 2, name: "Peter", gesamt: 1, ich: false, laterne: false },
      ]);
      expect(s.verlauf.x).toEqual(["Start", "W1"]);
      expect(json.messungen).toHaveLength(5);
      expect(json.einstellungen).toEqual({ erinnerungen: true, uhrzeit: "19:00" });

      const peter = await holen("/api/ich", PETER);
      expect(peter.json.messungen).toEqual([]);
      expect(JSON.stringify(peter.json)).not.toContain("24.3");
    } finally {
      server.close();
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
      const boss = (await holen("/api/ich")).json.seasons[0].boss;
      expect(boss).toEqual({
        name: "König Bierbauch",
        emoji: "🍺",
        bild: expect.stringContaining("<svg"),
        stufe: 1,
        woche: 2,
        aktiv: true,
        lebenspunkte: 650,
        schaden: 330,
        besiegt: false,
        bonus: 5,
        kaempfer: [
          { name: "Kevin", schaden: 300, ich: true },
          { name: "Peter", schaden: 30, ich: false },
        ],
        drueckeberger: [],
      });
      // Nach der Boss-Woche bleibt er als Ergebnis sichtbar
      tag("2026-10-27");
      expect((await holen("/api/ich")).json.seasons[0].boss).toMatchObject({ aktiv: false, besiegt: false });
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
      expect(r.json.rang).toMatchObject({ name: "Couchkartoffel", ab: 0, naechster: { name: "Lauch", ab: 1000 } });
      expect(r.json.rang.last).toBeGreaterThan(0);
      expect(r.json.rang.naechster.fehlen).toBe(1000 - r.json.rang.last);
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
