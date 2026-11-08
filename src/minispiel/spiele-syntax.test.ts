import { readdirSync, readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

// Die Szenen werden ins Hauptskript der Mini App eingefügt: Ein Syntaxfehler legte die ganze App lahm.
const ordner = new URL("../miniapp/spiele/", import.meta.url);
const dateien = readdirSync(ordner).filter((f) => f.endsWith(".js"));

describe("Minispiel-Skripte", () => {
  it.each(dateien)("%s ist gültiges JavaScript", (datei) => {
    expect(() => new Script(readFileSync(new URL(datei, ordner), "utf8"), { filename: datei })).not.toThrow();
  });
});
