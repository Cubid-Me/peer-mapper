import { describe, expect, it } from "vitest";

import { useScanStore } from "../src/lib/scanStore";

describe("scan store", () => {
  it("stores and resets the latest verification result", () => {
    const { setResult, reset } = useScanStore.getState();

    setResult({
      viewerCubid: "cubid_me",
      targetCubid: "cubid_peer",
      challengeId: "challenge-1",
      verifiedAt: 1700,
      expiresAt: 1800,
      overlaps: [],
    });

    expect(useScanStore.getState().lastResult?.targetCubid).toBe("cubid_peer");

    reset();

    expect(useScanStore.getState().lastResult).toBeNull();
  });
});
