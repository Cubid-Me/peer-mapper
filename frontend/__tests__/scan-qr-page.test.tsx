import type { Session } from "@supabase/supabase-js";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MyQrPage from "../src/app/scan/my-qr/page";
import type { HandshakeCompletion } from "../src/lib/handshake";
import { useScanStore } from "../src/lib/scanStore";
import { useUserStore } from "../src/lib/store";

const { pushMock, subscribeToHandshakeMock, randomUuidMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  subscribeToHandshakeMock: vi.fn(),
  randomUuidMock: vi.fn(() => "handshake-channel"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
  }),
}));

vi.mock("../src/lib/handshake", () => ({
  subscribeToHandshake: subscribeToHandshakeMock,
}));

describe("MyQrPage", () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    pushMock.mockReset();
    subscribeToHandshakeMock.mockReset();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        ...originalCrypto,
        randomUUID: randomUuidMock,
      },
    });
    act(() => {
      useUserStore.getState().reset();
      useScanStore.getState().reset();
    });

    const session = { access_token: "token", user: { id: "user-1", email: "user@example.com" } } as unknown as Session;
    act(() => {
      useUserStore.setState({
        session,
        parentProfile: {
          id: "parent",
          parent_profile_id: null,
          display_name: null,
          photo_url: null,
          cubid_id: null,
          locked_at: null,
          created_at: "2025-01-01T00:00:00Z",
          auth_user_id: "user-1",
          email_address: "user@example.com",
        },
        walletProfiles: [
          {
            id: "wallet-1",
            parent_profile_id: "parent",
            display_name: "Casey Rivers",
            photo_url: "https://example.com/avatar.png",
            cubid_id: "cubid_me",
            locked_at: null,
            created_at: "2025-01-02T00:00:00Z",
            wallet_address: "0x123",
          },
        ],
        activeWalletProfileId: "wallet-1",
        walletAddress: null,
        initialised: true,
      });
    });
  });

  afterEach(() => {
    subscribeToHandshakeMock.mockReset();
    randomUuidMock.mockClear();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("renders the QR code and profile name", async () => {
    subscribeToHandshakeMock.mockResolvedValue(() => undefined);

    render(<MyQrPage />);

    await waitFor(() => expect(subscribeToHandshakeMock).toHaveBeenCalledWith("handshake-channel", expect.any(Function)));

    expect(screen.getByRole("img", { name: /scan this within ninety seconds/i })).toBeInTheDocument();
    expect(screen.getByText("Casey Rivers")).toBeInTheDocument();
    expect(screen.getByText(/Cubid ID: cubid_me/i)).toBeInTheDocument();
  });

  it("redirects to results when a handshake completes", async () => {
    let handler: ((payload: HandshakeCompletion) => void) | null = null;
    subscribeToHandshakeMock.mockImplementation(async (_channel, callback) => {
      handler = callback;
      return vi.fn();
    });

    render(<MyQrPage />);

    await waitFor(() => expect(handler).toBeInstanceOf(Function));

    const payload: HandshakeCompletion = {
      channel: "handshake-channel",
      challengeId: "challenge-1",
      expiresAt: 1700001200,
      overlaps: [],
      targetCubid: "cubid_me",
      viewerCubid: "cubid_peer",
    };

    await act(async () => {
      handler?.(payload);
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/results"));

    expect(screen.getByText(/Handshake completed/i)).toBeInTheDocument();
    const result = useScanStore.getState().lastResult;
    expect(result?.challengeId).toBe("challenge-1");
    expect(result?.viewerCubid).toBe("cubid_peer");
    expect(result?.targetCubid).toBe("cubid_me");
  });
});
