import type { Session } from "@supabase/supabase-js";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Home from "../src/app/page";
import { useUserStore } from "../src/lib/store";

describe("Home page", () => {
  beforeEach(() => {
    act(() => {
      useUserStore.getState().reset();
    });
  });

  afterEach(() => {
    act(() => {
      useUserStore.getState().reset();
    });
  });

  it("welcomes unauthenticated visitors with CTAs", () => {
    render(<Home />);

    const heroHeading = screen.getByRole("heading", {
      name: /Trust people faster with verifiable overlaps/i,
    });
    expect(heroHeading).toBeInTheDocument();

    const ctas = screen.getAllByRole("link", { name: /Start verifying now/i });
    expect(ctas).toHaveLength(2);
    ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "/signin"));

    const indexerLink = screen.getByRole("link", { name: /Visit Moonbeam indexer/i });
    expect(indexerLink).toHaveAttribute("href", "/indexer");
  });

  it("shows quick actions when the user is signed in", () => {
    const session = {
      user: { id: "1", email: "user@example.com" },
      access_token: "token",
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
          auth_user_id: "1",
          email_address: "user@example.com",
        },
        walletProfiles: [
          {
            id: "wallet-1",
            parent_profile_id: "parent",
            display_name: "Agent Maple",
            photo_url: null,
            cubid_id: "maple",
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

    render(<Home />);

    expect(screen.getByText(/let’s keep building trusted links/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Share your QR/i })).toHaveAttribute("href", "/scan/my-qr");
    expect(screen.getByRole("link", { name: /Open camera/i })).toHaveAttribute("href", "/scan/camera");
    expect(screen.getByRole("link", { name: /Open Moonbeam indexer/i })).toHaveAttribute("href", "/indexer");
  });
});
