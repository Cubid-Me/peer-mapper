import type { Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import CameraPage from "../src/app/scan/camera/page";
import { useScanStore } from "../src/lib/scanStore";
import { useUserStore } from "../src/lib/store";

const {
  pushMock,
  requestQrChallengeMock,
  verifyQrChallengeMock,
  ensureWalletMock,
  getUserMediaMock,
  notifyHandshakeCompleteMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  requestQrChallengeMock: vi.fn(),
  verifyQrChallengeMock: vi.fn(),
  ensureWalletMock: vi.fn(),
  getUserMediaMock: vi.fn(),
  notifyHandshakeCompleteMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
  }),
}));

vi.mock("../src/lib/api", () => ({
  requestQrChallenge: requestQrChallengeMock,
  verifyQrChallenge: verifyQrChallengeMock,
}));

vi.mock("../src/lib/wallet", () => ({
  ensureWallet: ensureWalletMock,
}));

vi.mock("../src/lib/handshake", () => ({
  notifyHandshakeComplete: notifyHandshakeCompleteMock,
}));

const originalPlay = HTMLMediaElement.prototype.play;

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterAll(() => {
  HTMLMediaElement.prototype.play = originalPlay;
});

describe("CameraPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    requestQrChallengeMock.mockReset();
    verifyQrChallengeMock.mockReset();
    ensureWalletMock.mockReset();
    getUserMediaMock.mockReset();
    notifyHandshakeCompleteMock.mockReset();
    act(() => {
      useUserStore.getState().reset();
      useScanStore.getState().reset();
    });

    const session = {
      access_token: "supabase-token",
      user: { id: "user-1", email: "user@example.com" },
    } as unknown as Session;

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
          auth_user_id: session.user.id,
          email_address: session.user.email ?? null,
        },
        walletProfiles: [
          {
            id: "wallet-1",
            parent_profile_id: "parent",
            display_name: "Maple",
            photo_url: "https://example.com/avatar.png",
            cubid_id: "cubid_me",
            locked_at: null,
            created_at: "2025-01-02T00:00:00Z",
            wallet_address: "0xViewer",
          },
        ],
        activeWalletProfileId: "wallet-1",
        walletAddress: null,
        initialised: true,
      });
    });

    getUserMediaMock.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream);

    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    const ethereumRequest = vi.fn();
    (window as typeof window & { ethereum?: { request: ReturnType<typeof vi.fn> } }).ethereum = {
      request: ethereumRequest,
    };
  });

  afterEach(() => {
    delete (window as typeof window & { ethereum?: unknown }).ethereum;
    delete (window.navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
  });

  it("completes the QR verification happy path", async () => {
    const user = userEvent.setup();
    const handshakeChannel = "handshake-channel";
    const ethereum = (window as typeof window & {
      ethereum?: { request: ReturnType<typeof vi.fn> };
    }).ethereum;
    const requestMock = ethereum?.request as ReturnType<typeof vi.fn>;

    requestQrChallengeMock.mockResolvedValueOnce({
      challengeId: "challenge-1",
      challenge: "peer-mapper:challenge",
      issuedFor: "cubid_peer",
      expiresAt: 1700001000,
    });

    ensureWalletMock.mockResolvedValue("0xViewer");
    requestMock.mockResolvedValueOnce("0xViewerSignature");

    verifyQrChallengeMock.mockResolvedValueOnce({
      challengeId: "challenge-1",
      expiresAt: 1700001200,
      overlaps: [
        { issuer: "0xIssuer", trustLevel: 4, circle: null, freshnessSeconds: 42 },
      ],
    });

    notifyHandshakeCompleteMock.mockResolvedValueOnce(undefined);

    render(<CameraPage />);

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());
    const devSummary = await screen.findByText(/for devs only/i);
    await user.click(devSummary);

    const payloadTextarea = screen.getByPlaceholderText(/Paste JSON like/);
    const targetAddress = "0x000000000000000000000000000000000000dEaD";
    fireEvent.change(payloadTextarea, {
      target: {
        value: `{"cubidId":"cubid_peer","channel":"${handshakeChannel}","address":"${targetAddress}"}`,
      },
    });

    await user.click(screen.getByRole("button", { name: /parse qr payload/i }));
    await waitFor(() => expect(screen.getByText(/Target Cubid: cubid_peer/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /issue challenge/i }));
    await waitFor(() => expect(requestQrChallengeMock).toHaveBeenCalledWith("cubid_peer", "supabase-token"));
    await waitFor(() => expect(screen.getByText(/Challenge ID/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /sign as viewer/i }));
    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith({
        method: "personal_sign",
        params: ["peer-mapper:challenge", "0xViewer"],
      }),
    );
    await waitFor(() => expect(screen.getByText(/Viewer signature captured/)).toBeInTheDocument());

    const addressInput = screen.getByLabelText(/Target wallet address/i) as HTMLInputElement;
    expect(addressInput.value).toBe(targetAddress);

    const signatureInput = screen.getByLabelText(/Target signature/i);
    await user.type(signatureInput, "0xTargetSignature");

    await user.click(screen.getByRole("button", { name: /verify overlap/i }));

    await waitFor(() =>
      expect(verifyQrChallengeMock).toHaveBeenCalledWith(
        {
          challengeId: "challenge-1",
          challenge: "peer-mapper:challenge",
          viewer: {
            cubidId: "cubid_me",
            address: "0xViewer",
            signature: "0xViewerSignature",
          },
          target: {
            cubidId: "cubid_peer",
            address: targetAddress,
            signature: "0xTargetSignature",
          },
        },
        "supabase-token",
      ),
    );

    await waitFor(() =>
      expect(notifyHandshakeCompleteMock).toHaveBeenCalledWith({
        channel: handshakeChannel,
        challengeId: "challenge-1",
        expiresAt: 1700001200,
        overlaps: [
          { issuer: "0xIssuer", trustLevel: 4, circle: null, freshnessSeconds: 42 },
        ],
        targetCubid: "cubid_peer",
        viewerCubid: "cubid_me",
      }),
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/results"));

    const result = useScanStore.getState().lastResult;
    expect(result?.targetCubid).toBe("cubid_peer");
    expect(result?.overlaps).toHaveLength(1);
  });

  it("surfaces QR payload validation errors", async () => {
    const user = userEvent.setup();

    render(<CameraPage />);

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());
    const devSummary = await screen.findByText(/for devs only/i);
    await user.click(devSummary);

    const payloadTextarea = screen.getByPlaceholderText(/Paste JSON like/);
    fireEvent.change(payloadTextarea, {
      target: { value: '{"address":"0xPeer","channel":"handshake"}' },
    });

    await user.click(screen.getByRole("button", { name: /parse qr payload/i }));

    await waitFor(() => expect(screen.getByText(/QR payload missing cubidId/i)).toBeInTheDocument());
    expect(useScanStore.getState().lastResult).toBeNull();
  });
});
