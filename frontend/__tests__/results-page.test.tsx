import type { Session } from "@supabase/supabase-js";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResultsPage from "../src/app/results/page";
import { useScanStore } from "../src/lib/scanStore";
import { useUserStore } from "../src/lib/store";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

describe("ResultsPage", () => {
  beforeEach(() => {
    useScanStore.getState().reset();
    replaceMock.mockReset();
    act(() => {
      useUserStore.getState().reset();
    });

    const session = { access_token: "token", user: { id: "user-1" } } as unknown as Session;
    act(() => {
      useUserStore.setState({
        session,
        user: {
          user_id: "user-1",
          cubid_id: "cubid_me",
          display_name: "Maple",
          evm_address: "0x123",
        },
        walletAddress: null,
        initialised: true,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useUserStore.getState().reset();
    });
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
