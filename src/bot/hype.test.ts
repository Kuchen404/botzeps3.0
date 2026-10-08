import { afterEach, describe, expect, it } from "vitest";
import { uhr } from "./kontext.js";
import { GRUPPE, PRIVAT, befehl, testBot } from "./testhilfe.js";

const echteUhr = uhr.jetzt;
afterEach(() => {
  uhr.jetzt = echteUhr;
});

/** Test-Bot, bei dem getChatMember den gewünschten Status liefert. */
function botMitStatus(status: "administrator" | "member") {
  const t = testBot();
  t.bot.api.config.use(async (prev, methode, payload, signal) =>
    methode === "getChatMember" ? ({ ok: true, result: { status, user: { id: 42 } } } as never) : prev(methode, payload, signal),
  );
  return t;
}

describe("/hype", () => {
  it("Admin startet: Trailer sofort, nochmal /hype zeigt den nächsten Tag, /hype stop bricht ab", async () => {
    uhr.jetzt = () => new Date("2026-10-08T09:00:00Z");
    const { bot, aufrufe, letzterText } = botMitStatus("administrator");
    await bot.handleUpdate(befehl("/hype"));
    const video = aufrufe.find((a) => a.methode === "sendVideo");
    expect(video?.payload.chat_id).toBe(GRUPPE.id);
    expect(String(video?.payload.caption)).toContain("Botzeps ist zurück");

    await bot.handleUpdate(befehl("/hype"));
    expect(letzterText()).toBe("Der Hype läuft schon: Tag 2 von 7 kommt Freitag um 19:00 Uhr. Abbrechen mit /hype stop.");
    expect(aufrufe.filter((a) => a.methode === "sendVideo")).toHaveLength(1);

    await bot.handleUpdate(befehl("/hype stop"));
    expect(letzterText()).toBe("Hype abgebrochen. Das Sofa atmet auf.");
  });

  it("nur für Admins und nur in der Gruppe", async () => {
    const { bot, aufrufe, letzterText } = botMitStatus("member");
    await bot.handleUpdate(befehl("/hype"));
    expect(letzterText()).toContain("nur Gruppenadmins");
    await bot.handleUpdate(befehl("/hype", PRIVAT));
    expect(letzterText()).toContain("nur in der Gruppe");
    expect(aufrufe.some((a) => a.methode === "sendVideo")).toBe(false);
  });
});
