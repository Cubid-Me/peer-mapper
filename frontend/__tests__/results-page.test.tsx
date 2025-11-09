import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import ResultsPage from "../src/app/(routes)/results/page";
import { useScanStore } from "../src/lib/scanStore";

describe("ResultsPage", () => {
  beforeEach(() => {
    useScanStore.getState().reset();
  });

  it("prompts for verification when no result is cached", () => {
    render(<ResultsPage />);
    expect(screen.getByText(/Complete a QR verification/)).toBeInTheDocument();
  });

  it("renders overlap badges when verification data exists", () => {
    useScanStore
      .getState()
      .setResult({
        viewerCubid: "cubid_me",
        targetCubid: "cubid_peer",
        challengeId: "challenge-1",
        verifiedAt: 1700000000,
        expiresAt: 1700000600,
        overlaps: [
          { issuer: "0xIssuerInbound", trustLevel: 4, circle: "0x1234", freshnessSeconds: 75 },
        ],
      });

    render(<ResultsPage />);

    expect(screen.getByText(/share 1 trusted issuer/)).toBeInTheDocument();
    expect(screen.getByText("0xIssuerInbound")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("0x1234")).toBeInTheDocument();
  });
});
