import { describe, expect, it } from "vitest";
import { ladeConfig } from "./config.js";

describe("Konfiguration", () => {
  it("setzt Standardwerte", () => {
    const c = ladeConfig({ BOT_TOKEN: "123:abc" });
    expect(c).toMatchObject({ BOT_MODE: "polling", PORT: 3000, TZ: "Europe/Berlin" });
  });

  it("verlangt ein Token", () => {
    expect(() => ladeConfig({})).toThrow(/BOT_TOKEN/);
  });

  it("verlangt URL und Geheimnis im Webhook-Modus", () => {
    expect(() => ladeConfig({ BOT_TOKEN: "x", BOT_MODE: "webhook", WEBHOOK_URL: "" })).toThrow(/WEBHOOK_URL/);
    const c = ladeConfig({
      BOT_TOKEN: "x",
      BOT_MODE: "webhook",
      WEBHOOK_URL: "https://botzeps.example.de",
      WEBHOOK_SECRET: "geheim",
    });
    expect(c.WEBHOOK_URL).toBe("https://botzeps.example.de");
  });

  it("Demo-Modus nur, wenn ausdrücklich eingeschaltet", () => {
    expect(ladeConfig({ BOT_TOKEN: "x" }).DEMO_MODUS).toBe(false);
    expect(ladeConfig({ BOT_TOKEN: "x", DEMO_MODUS: "1" }).DEMO_MODUS).toBe(true);
    expect(() => ladeConfig({ BOT_TOKEN: "x", DEMO_MODUS: "ja" })).toThrow(/DEMO_MODUS/);
  });

  it("Backup: Standardwerte, leere Einträge zählen nicht", () => {
    const c = ladeConfig({ BOT_TOKEN: "x", BACKUP_BEHALTEN: "", BACKUP_CHAT_ID: "", BACKUP_VERZEICHNIS: "" });
    expect(c).toMatchObject({ BACKUP_UHRZEIT: "04:00", BACKUP_BEHALTEN: 30 });
    expect(c.BACKUP_CHAT_ID).toBeUndefined();
    expect(c.BACKUP_VERZEICHNIS).toBeUndefined();
    expect(ladeConfig({ BOT_TOKEN: "x", BACKUP_BEHALTEN: "0", BACKUP_CHAT_ID: "-100123" })).toMatchObject({
      BACKUP_BEHALTEN: 0,
      BACKUP_CHAT_ID: -100123,
    });
    expect(() => ladeConfig({ BOT_TOKEN: "x", BACKUP_UHRZEIT: "25:00" })).toThrow(/BACKUP_UHRZEIT/);
  });
});
