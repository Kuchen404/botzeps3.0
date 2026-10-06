import { z } from "zod";

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
