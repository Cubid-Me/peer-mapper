import type { Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "../src/app/profile/page";
import { useUserStore } from "../src/lib/store";

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
        user: {
          user_id: session.user.id,
          cubid_id: "cubid_me",
          display_name: "Maple Leaf",
          photo_url: "https://example.com/photo.png",
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

  it("shows an on-page preview of the profile", () => {
    render(<ProfilePage />);

    expect(screen.getByText(/This name can be a nickname/i)).toBeInTheDocument();
    expect(screen.getByText(/Maple Leaf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();

    const previewHeading = screen.getByRole("heading", { name: /Preview for peers/i });
    const previewAside = previewHeading.closest("aside");
    expect(previewAside).not.toBeNull();
    if (previewAside) {
      expect(within(previewAside).getByText(/Cubid ID: cubid_me/)).toBeInTheDocument();
    }

    const previewImage = screen.getByAltText(/Profile photo preview/i) as HTMLImageElement;
    expect(previewImage.src).toContain("https://example.com/photo.png");
  });

  it("surfaces a warning when the photo URL cannot load", async () => {
    const user = userEvent.setup();

    render(<ProfilePage />);

    const photoInput = screen.getByLabelText(/Photo URL/i);
    await user.clear(photoInput);
    await user.type(photoInput, "https://example.com/broken.png");

    const previewImage = screen.getByAltText(/Profile photo preview/i);
    fireEvent.error(previewImage);

    expect(screen.getByText(/We couldn’t load this image/i)).toBeInTheDocument();
    expect(screen.getByText("!")).toBeInTheDocument();
  });
});
