import type { Session } from "@supabase/supabase-js";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../src/components/AuthProvider";
import { useUserStore } from "../src/lib/store";

const { getSessionMock, onAuthStateChangeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn<[], Promise<Session | null>>(),
  onAuthStateChangeMock: vi.fn(),
}));

const { fetchMyProfileMock } = vi.hoisted(() => ({
  fetchMyProfileMock: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  getSession: getSessionMock,
  onAuthStateChange: onAuthStateChangeMock,
}));

vi.mock("../src/lib/profile", () => ({
  fetchMyProfile: fetchMyProfileMock,
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
    const profile = { user_id: "user-123", display_name: "Test User" };

    getSessionMock.mockResolvedValueOnce(session);
    fetchMyProfileMock.mockResolvedValueOnce(profile);

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
    expect(useUserStore.getState().user).toEqual(profile);
    expect(fetchMyProfileMock).toHaveBeenCalledTimes(1);

    fetchMyProfileMock.mockResolvedValueOnce(null);
    authCallback(null);

    await waitFor(() => {
      expect(useUserStore.getState().session).toBeNull();
    });
    expect(useUserStore.getState().user).toBeNull();

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
    expect(useUserStore.getState().user).toBeNull();
    expect(fetchMyProfileMock).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
