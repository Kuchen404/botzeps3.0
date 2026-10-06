import { describe, expect, it } from "vitest";
import { pruefeInitData, signiereInitData } from "./auth.js";

const TOKEN = "123:abc";
const jetzt = new Date("2026-10-06T12:00:00Z");
const auth = String(jetzt.getTime() / 1000 - 60);
const user = JSON.stringify({ id: 42, first_name: "Kevin" });

describe("Mini-App-Anmeldung", () => {
  it("echte initData werden akzeptiert", () => {
    const daten = signiereInitData({ auth_date: auth, query_id: "x", user }, TOKEN);
    expect(pruefeInitData(daten, TOKEN, jetzt)).toEqual({ id: 42, first_name: "Kevin" });
  });

  it("gefälscht, falscher Token, zu alt oder ohne Nutzer: abgelehnt", () => {
    const daten = signiereInitData({ auth_date: auth, user }, TOKEN);
    const gefaelscht = daten.replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":43'));
    expect(gefaelscht).not.toBe(daten);
    expect(pruefeInitData(gefaelscht, TOKEN, jetzt)).toBeNull();
    expect(pruefeInitData(daten, "123:anders", jetzt)).toBeNull();
    expect(pruefeInitData(daten, TOKEN, new Date(jetzt.getTime() + 25 * 3600 * 1000))).toBeNull();
    expect(pruefeInitData(signiereInitData({ auth_date: auth }, TOKEN), TOKEN, jetzt)).toBeNull();
    expect(pruefeInitData("hash=abc", TOKEN, jetzt)).toBeNull();
    expect(pruefeInitData("", TOKEN, jetzt)).toBeNull();
  });
});
