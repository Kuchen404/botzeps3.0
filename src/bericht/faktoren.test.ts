import { describe, expect, it } from "vitest";
import { stundenText } from "./faktoren.js";

describe("stundenText", () => {
  it("rundet auf Viertelstunden", () => {
    expect(stundenText(450)).toBe("7½ Std.");
    expect(stundenText(75)).toBe("1¼ Std.");
    expect(stundenText(100)).toBe("1¾ Std.");
    expect(stundenText(15)).toBe("¼ Std.");
    expect(stundenText(900)).toBe("15 Std.");
    expect(stundenText(5)).toBe("0 Std.");
  });
});
