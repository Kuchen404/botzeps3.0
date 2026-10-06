import { z } from "zod";

/** Leere Einträge in .env zählen wie nicht gesetzt (sonst würde "" zu 0). */
const leerIstNichts = (v: unknown) => (v === "" ? undefined : v);

const schema = z
  .object({
    BOT_TOKEN: z.string().min(1, "BOT_TOKEN fehlt (siehe .env.example)"),
    BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
    WEBHOOK_URL: z.url().optional().or(z.literal("").transform(() => undefined)),
    WEBHOOK_SECRET: z.string().optional().or(z.literal("").transform(() => undefined)),
    MINIAPP_URL: z.url().startsWith("https://", "Mini App braucht HTTPS").optional().or(z.literal("").transform(() => undefined)),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_PATH: z.string().min(1).default("./data/botzeps.db"),
    TZ: z.string().default("Europe/Berlin"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    // Tägliches Backup: Verzeichnis (leer = "backups" neben der Datenbank), Uhrzeit, Anzahl (0 = aus)
    BACKUP_VERZEICHNIS: z.preprocess(leerIstNichts, z.string().optional()),
    BACKUP_UHRZEIT: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM")
      .default("04:00"),
    BACKUP_BEHALTEN: z.preprocess(leerIstNichts, z.coerce.number().int().min(0).default(30)),
    // Optional: Telegram-Chat (z. B. deine eigene ID), an den jede Sicherung als Datei geht
    BACKUP_CHAT_ID: z.preprocess(leerIstNichts, z.coerce.number().int().optional()),
    // Nur für einen Test-Bot: Fake-Teilnehmer und Zeitsprünge (/demo, /vorspulen)
    DEMO_MODUS: z
      .enum(["0", "1", "true", "false", ""])
      .default("0")
      .transform((v) => v === "1" || v === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.BOT_MODE === "webhook") {
      if (!env.WEBHOOK_URL) ctx.addIssue({ code: "custom", path: ["WEBHOOK_URL"], message: "Pflicht bei BOT_MODE=webhook" });
      if (!env.WEBHOOK_SECRET)
        ctx.addIssue({ code: "custom", path: ["WEBHOOK_SECRET"], message: "Pflicht bei BOT_MODE=webhook" });
    }
  });

export type Config = z.infer<typeof schema>;

export function ladeConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const ergebnis = schema.safeParse(env);
  if (!ergebnis.success) {
    const fehler = ergebnis.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Ungültige Konfiguration:\n${fehler}`);
  }
  return ergebnis.data;
}
