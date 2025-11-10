import type { Session } from "@supabase/supabase-js";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../src/components/AuthProvider";
import { useUserStore } from "../src/lib/store";

const { getSessionMock, onAuthStateChangeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn<[], Promise<Session | null>>(),
  onAuthStateChangeMock: vi.fn(),
}));

const { fetchMyProfilesMock } = vi.hoisted(() => ({
  fetchMyProfilesMock: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  getSession: getSessionMock,
  onAuthStateChange: onAuthStateChangeMock,
}));

vi.mock("../src/lib/profile", () => ({
  fetchMyProfiles: fetchMyProfilesMock,
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    useUserStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    useUserStore.getState().reset();
  });

  it("bootstraps the session and profile on mount", async () => {
    const session = { user: { id: "user-123", email: "user@example.com" } } as unknown as Session;
    const bundle = {
      parent: {
        id: "parent-profile",
        parent_profile_id: null,
        display_name: null,
        photo_url: null,
        cubid_id: null,
        locked_at: null,
        created_at: "2025-01-01T00:00:00Z",
        auth_user_id: "user-123",
        email_address: "user@example.com",
      },
      wallets: [
        {
          id: "wallet-profile",
          parent_profile_id: "parent-profile",
          display_name: "Sky Trail",
          photo_url: null,
          cubid_id: "cubid_sky",
          locked_at: null,
          created_at: "2025-01-02T00:00:00Z",
          wallet_address: "0x1234",
        },
      ],
    };

    getSessionMock.mockResolvedValueOnce(session);
    fetchMyProfilesMock.mockResolvedValueOnce(bundle);

    let authCallback: (nextSession: Session | null) => void = () => undefined;
    onAuthStateChangeMock.mockImplementation((callback: typeof authCallback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { unmount } = render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(useUserStore.getState().session).toBe(session);
    });
    expect(useUserStore.getState().parentProfile).toEqual(bundle.parent);
    expect(useUserStore.getState().walletProfiles).toEqual(bundle.wallets);
    expect(useUserStore.getState().activeWalletProfileId).toBe(bundle.wallets[0]?.id ?? null);
    expect(useUserStore.getState().initialised).toBe(true);
    expect(fetchMyProfilesMock).toHaveBeenCalledTimes(1);

    fetchMyProfilesMock.mockResolvedValueOnce({ parent: null, wallets: [] });
    authCallback(null);

    await waitFor(() => {
      expect(useUserStore.getState().session).toBeNull();
    });
    expect(useUserStore.getState().parentProfile).toBeNull();
    expect(useUserStore.getState().walletProfiles).toEqual([]);
    expect(useUserStore.getState().activeWalletProfileId).toBeNull();

    unmount();
  });

  it("resets the store when bootstrapping fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    getSessionMock.mockRejectedValueOnce(new Error("boom"));
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    render(
      <AuthProvider>
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getSessionMock).toHaveBeenCalledTimes(1);
    });

    expect(useUserStore.getState().session).toBeNull();
    expect(useUserStore.getState().parentProfile).toBeNull();
    expect(useUserStore.getState().walletProfiles).toEqual([]);
    expect(useUserStore.getState().initialised).toBe(true);
    expect(fetchMyProfilesMock).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
