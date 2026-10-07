import { describe, expect, it } from "vitest";
import { appKnopf, appLink } from "./app-knopf.js";
import { BOT_INFO, GRUPPE, PRIVAT, befehl, testBot } from "./testhilfe.js";

const URL = "https://botzeps.example/app";
const MIT_APP = { ...BOT_INFO, has_main_web_app: true };

describe("Knopf zur Mini App", () => {
  it("privat als Web-App-Knopf", () => {
    expect(appKnopf(BOT_INFO, PRIVAT, URL)?.inline_keyboard[0]?.[0]).toMatchObject({ web_app: { url: URL } });
  });

  it("in der Gruppe als Link, mit Haupt-Mini-App direkt in die App samt Gruppe", () => {
    expect(appKnopf(MIT_APP, GRUPPE, URL)?.inline_keyboard[0]?.[0]).toMatchObject({
      url: "https://t.me/botzeps_test_bot?startapp=g-100123",
    });
    expect(appLink(BOT_INFO, GRUPPE.id)).toBe("https://t.me/botzeps_test_bot?start=app");
  });

  it("ohne Mini App kein Knopf", () => {
    expect(appKnopf(MIT_APP, GRUPPE, undefined)).toBeUndefined();
  });

  it("/app, /rangliste und die Begrüßung zeigen ihn in der Gruppe", async () => {
    const { bot, aufrufe } = testBot({ miniAppUrl: URL });
    await bot.handleUpdate(befehl("/start", GRUPPE));
    await bot.handleUpdate(befehl("/app", GRUPPE));
    const knoepfe = aufrufe.filter((a) => a.methode === "sendMessage").map((a) => JSON.stringify(a.payload.reply_markup));
    expect(knoepfe[0]).toContain("mitmachen");
    expect(knoepfe[0]).toContain("start=app");
    expect(knoepfe[1]).toContain("start=app");
    expect(knoepfe.join()).not.toContain("web_app");
  });

  it("/start privat bringt den Web-App-Knopf gleich mit", async () => {
    const { bot, aufrufe } = testBot({ miniAppUrl: URL });
    await bot.handleUpdate(befehl("/start", PRIVAT));
    expect(JSON.stringify(aufrufe.at(-1)?.payload.reply_markup)).toContain(URL);
  });
});
