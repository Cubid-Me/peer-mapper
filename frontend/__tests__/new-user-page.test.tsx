import type { Session } from "@supabase/supabase-js";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewUserPage from "../src/app/(routes)/new-user/page";
import { useUserStore } from "../src/lib/store";

const { pushMock, replaceMock, requestCubidIdMock, savePhotoFromUrlMock, savePhotoFromFileMock, ensureWalletMock, upsertMyProfileMock } =
  vi.hoisted(() => ({
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    requestCubidIdMock: vi.fn(),
    savePhotoFromUrlMock: vi.fn(),
    savePhotoFromFileMock: vi.fn(),
    ensureWalletMock: vi.fn(),
    upsertMyProfileMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("../src/lib/cubid", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/cubid")>("../src/lib/cubid");
  return {
    ...actual,
    requestCubidId: requestCubidIdMock,
  };
});

vi.mock("../src/lib/photos", () => ({
  saveProfilePhotoFromUrl: savePhotoFromUrlMock,
  saveProfilePhotoFromFile: savePhotoFromFileMock,
}));

vi.mock("../src/lib/wallet", () => ({
  ensureWallet: ensureWalletMock,
}));

vi.mock("../src/lib/profile", () => ({
  upsertMyProfile: upsertMyProfileMock,
}));

describe("NewUserPage", () => {
  beforeEach(() => {
    requestCubidIdMock.mockResolvedValue("cubid_peerabcd");
    savePhotoFromUrlMock.mockResolvedValue("https://cdn.example.com/avatar.png");
    savePhotoFromFileMock.mockResolvedValue("https://cdn.example.com/avatar.png");
    ensureWalletMock.mockResolvedValue("0xabc123");
    upsertMyProfileMock.mockResolvedValue({
      user_id: "user-1",
      cubid_id: "cubid_peerabcd",
      display_name: "Casey Rivers",
      photo_url: "https://cdn.example.com/avatar.png",
      evm_address: "0xabc123",
    });
    pushMock.mockReset();
    replaceMock.mockReset();

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
        user: { user_id: session.user.id },
      });
    });
  });

  afterEach(() => {
    act(() => {
      useUserStore.getState().reset();
    });
  });

  it("guides the user through the onboarding steps", async () => {
    const user = userEvent.setup();

    render(<NewUserPage />);

    await waitFor(() => expect(requestCubidIdMock).toHaveBeenCalled());

    const nameInput = screen.getByLabelText(/Display name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Casey Rivers");

    await user.click(screen.getByRole("button", { name: /Next/i }));

    const photoInput = screen.getByPlaceholderText(/https:\/\/example.com\/avatar.png/i);
    await user.clear(photoInput);
    await user.type(photoInput, "https://images.example.com/photo.png");
    await user.click(screen.getByRole("button", { name: /Use this link/i }));

    await waitFor(() => expect(savePhotoFromUrlMock).toHaveBeenCalledWith("https://images.example.com/photo.png", "user-1"));
    await waitFor(() => expect(screen.getByAltText(/Profile preview/i)).toBeInTheDocument());

    const nextButtons = screen.getAllByRole("button", { name: /Next/i });
    await user.click(nextButtons[nextButtons.length - 1]);

    await user.click(screen.getByRole("button", { name: /Connect wallet/i }));

    await waitFor(() => expect(ensureWalletMock).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByRole("button", { name: /Finish setup/i })).toBeInTheDocument());

    const cubidField = screen.getByLabelText(/Cubid ID/i) as HTMLInputElement;
    expect(cubidField).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: /Finish setup/i }));

    await waitFor(() => expect(upsertMyProfileMock).toHaveBeenCalledWith({
      cubid_id: "cubid_peerabcd",
      display_name: "Casey Rivers",
      photo_url: "https://cdn.example.com/avatar.png",
      evm_address: "0xabc123",
    }));

    expect(screen.getByLabelText(/Cubid ID/i)).toHaveValue("cubid_peerabcd");

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/circle"));
  });
});
