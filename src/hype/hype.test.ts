import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { oeffneDb } from "../db/index.js";
import { speichereGruppe, speichereNutzer, trageMitgliedEin } from "../db/repo.js";
import { legeSeasonAn } from "../db/season-repo.js";
import { BOSS_NAMEN } from "../scoring/boss.js";
import { MINISPIELE } from "../minispiel/spiele.js";
import { HYPE_TAGE, type HypeKanal, fuehreHypeAus, hypeBeitrag, medienPfad, offenerHypeTag, starteHype, stoppeHype } from "./hype.js";

const TZ = "Europe/Berlin";

function aufbau(namen = ["Kevin", "Peter", "Maria"]) {
  const db = oeffneDb(":memory:");
  const gruppe = speichereGruppe(db, -100123, "Pumper");
  namen.forEach((n, i) => trageMitgliedEin(db, gruppe, speichereNutzer(db, 42 + i, n).id));
  const gesendet: { art: string; chat: number; inhalt: string; extra?: unknown }[] = [];
  const kanal: HypeKanal = {
    text: async (chat, text) => gesendet.push({ art: "text", chat, inhalt: text }),
    medium: async (chat, datei, medium, text) => gesendet.push({ art: medium, chat, inhalt: text, extra: datei }),
    umfrage: async (chat, frage, antworten) => gesendet.push({ art: "umfrage", chat, inhalt: frage, extra: antworten }),
  };
  return { db, gruppe, gesendet, kanal };
}

describe("Hype-Woche", () => {
  it("Tag 1 sofort, dann jeden Abend um 19 Uhr bis Tag 7, danach ist Schluss", async () => {
    const { db, gruppe, gesendet, kanal } = aufbau();
    const start = new Date("2026-10-08T09:00:00Z");
    expect(starteHype(db, gruppe, start, TZ)).toBe(true);
    expect(starteHype(db, gruppe, start, TZ)).toBe(false);

    expect(await fuehreHypeAus(db, kanal, start, TZ)).toBe(1);
    expect(gesendet[0]).toMatchObject({ art: "trailer.mp4", chat: -100123 });
    expect(offenerHypeTag(db, gruppe)).toEqual({ tag: 2, faellig_am: "2026-10-09T17:00:00.000Z" });

    // Noch vor 19 Uhr am nächsten Tag passiert nichts, auch nicht doppelt
    expect(await fuehreHypeAus(db, kanal, new Date("2026-10-09T16:59:00Z"), TZ)).toBe(0);
    for (let tag = 2; tag <= HYPE_TAGE; tag++) {
      expect(await fuehreHypeAus(db, kanal, new Date(`2026-10-${String(7 + tag).padStart(2, "0")}T17:01:00Z`), TZ)).toBe(1);
    }
    expect(gesendet.map((g) => g.art)).toEqual(["trailer.mp4", "plakat.png", "gesucht.png", "umfrage", "text", "text", "text", "text"]);
    expect(offenerHypeTag(db, gruppe)).toBeNull();
    // Danach darf man wieder neu starten
    expect(starteHype(db, gruppe, new Date("2026-10-20T09:00:00Z"), TZ)).toBe(true);
  });

  it("verrät keine Bosse, keine Minispiele und kein Datum", () => {
    const { db, gruppe } = aufbau();
    for (let tag = 1; tag <= HYPE_TAGE; tag++) {
      const b = hypeBeitrag(db, gruppe, tag, "2026-10-08");
      const alles = [b.text, b.umfrage?.frage, ...(b.umfrage?.antworten ?? [])].join("\n");
      for (const boss of BOSS_NAMEN) expect(alles).not.toContain(boss);
      for (const spiel of Object.values(MINISPIELE)) expect(alles).not.toContain(spiel.name);
      expect(alles).not.toMatch(/\d{1,2}\.\d{1,2}\./);
      // Bildunterschriften dürfen bei Telegram höchstens 1024 Zeichen haben
      if (b.medium) expect(b.text.length).toBeLessThanOrEqual(1024);
    }
  });

  it("die Medien liegen bereit", () => {
    for (const m of ["trailer.mp4", "plakat.png", "gesucht.png"] as const) expect(existsSync(medienPfad(m))).toBe(true);
  });

  it("Laternen-Umfrage mit höchstens acht Namen plus zwei festen Antworten", () => {
    const { db, gruppe } = aufbau(["Kevin", "Peter", "Maria", "Anna", "Bert", "Carla", "Dieter", "Emil", "Frieda", "Gustav"]);
    const u = hypeBeitrag(db, gruppe, 4, "2026-10-08").umfrage!;
    expect(u.antworten).toHaveLength(10);
    expect(u.antworten.slice(-2)).toEqual(["Ich selbst, ich kenn mich", "Der Bot, aus Mitleid"]);
    expect(new Set(u.antworten).size).toBe(10);
  });

  it("letzter Tag nennt die Daten, sobald eine Season ansteht, sonst ruft er nach /season", () => {
    const { db, gruppe } = aufbau();
    expect(hypeBeitrag(db, gruppe, 7, "2026-10-14").text).toContain("/season");
    legeSeasonAn(db, { gruppe, name: "Herbst", start: "2026-10-26", erstelltVon: 1, heute: "2026-10-14" });
    const text = hypeBeitrag(db, gruppe, 7, "2026-10-14").text;
    expect(text).toContain("Kalibrierwoche ab 19.10.2026");
    expect(text).toContain("Start am 26.10.2026");
  });

  it("/hype stop bricht ab, verpasste Abende verfallen statt gesammelt zu kommen", async () => {
    const { db, gruppe, gesendet, kanal } = aufbau();
    starteHype(db, gruppe, new Date("2026-10-08T09:00:00Z"), TZ);
    await fuehreHypeAus(db, kanal, new Date("2026-10-08T09:00:00Z"), TZ);
    // Bot war drei Tage weg: Tag 2 und 3 verfallen, Tag 4 kommt
    expect(await fuehreHypeAus(db, kanal, new Date("2026-10-11T17:05:00Z"), TZ)).toBe(1);
    expect(gesendet.slice(-2).map((g) => g.art)).toEqual(["umfrage", "text"]);
    expect(stoppeHype(db, gruppe)).toBe(3);
    expect(offenerHypeTag(db, gruppe)).toBeNull();
  });
});
