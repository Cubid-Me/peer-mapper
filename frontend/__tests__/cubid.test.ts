import { describe, expect, it, vi } from "vitest";

import { isValidCubidId, requestCubidId } from "../src/lib/cubid";

describe("cubid helpers", () => {
  it("validates cubid identifiers", () => {
    expect(isValidCubidId("cubid_demo123")).toBe(true);
    expect(isValidCubidId("invalid")).toBe(false);
  });

  it("derives a cubid id from email", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.123456);
    const cubid = await requestCubidId("Casey@example.com");
    expect(cubid.startsWith("cubid_casey")).toBe(true);
    expect(isValidCubidId(cubid)).toBe(true);
    randomSpy.mockRestore();
  });
});
