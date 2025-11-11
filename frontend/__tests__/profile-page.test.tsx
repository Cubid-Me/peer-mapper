import type { Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "../src/app/profile/page";
import { useUserStore } from "../src/lib/store";

const { requestCubidIdMock } = vi.hoisted(() => ({
  requestCubidIdMock: vi.fn(() => new Promise<string>(() => {})),
}));

vi.mock("../src/lib/cubid", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/cubid")>("../src/lib/cubid");
  return {
    ...actual,
    requestCubidId: requestCubidIdMock,
  };
});

const { replaceMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    requestCubidIdMock.mockClear();
    act(() => {
      useUserStore.getState().reset();
    });

    const session = {
      access_token: "token",
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
            display_name: "Maple Leaf",
            photo_url: "https://example.com/photo.png",
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
    act(() => {
      useUserStore.getState().reset();
    });
  });

  it("shows linked wallet profiles and account summary", async () => {
    await act(async () => {
      render(<ProfilePage />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByRole("heading", { name: /Wallet profiles/i })).toBeInTheDocument();
    expect(screen.getByText(/Linked wallets/i)).toBeInTheDocument();

    const walletCard = screen.getByText("Maple Leaf").closest("li");
    expect(walletCard).not.toBeNull();
    if (walletCard) {
      expect(within(walletCard).getByText(/Cubid ID: cubid_me/i)).toBeInTheDocument();
      expect(within(walletCard).getByText(/Active/i)).toBeInTheDocument();
    }

    expect(screen.getByText(/Signed in as/i)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it("surfaces a warning when the photo URL cannot load", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<ProfilePage />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const photoInput = screen.getByLabelText(/Photo URL/i);
    await user.clear(photoInput);
    await user.type(photoInput, "https://example.com/broken.png");

    const previewImage = screen.getByAltText(/Wallet preview/i);
    act(() => {
      fireEvent.error(previewImage);
    });

    expect(screen.getByText(/Image error/i)).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
