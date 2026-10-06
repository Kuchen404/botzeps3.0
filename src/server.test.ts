import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { erstelleServer } from "./server.js";

let server: Server | undefined;
afterEach(() => server?.close());

async function starte(): Promise<string> {
  server = erstelleServer({});
  await new Promise<void>((ok) => server!.listen(0, ok));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("Server", () => {
  it("antwortet auf /health", async () => {
    const url = await starte();
    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("ohne Bot gibt es keinen Webhook", async () => {
    const url = await starte();
    expect((await fetch(`${url}/telegram`, { method: "POST" })).status).toBe(404);
  });
});
