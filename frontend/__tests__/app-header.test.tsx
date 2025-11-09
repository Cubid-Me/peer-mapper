import type { Session } from "@supabase/supabase-js";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppHeader } from "../src/components/AppHeader";
import { useUserStore } from "../src/lib/store";

describe("AppHeader", () => {
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

  it("does not render when no session is present", () => {
    const { container } = render(<AppHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("shows navigation and avatar initials for an authenticated user", () => {
    const session = {
      user: { id: "1", email: "agent@example.com" },
      access_token: "token",
    } as unknown as Session;

    act(() => {
      useUserStore.setState({
        session,
        user: { user_id: "1", display_name: "Sky Trail", cubid_id: "sky", evm_address: "0x123" },
        walletAddress: null,
        initialised: true,
      });
    });

    render(<AppHeader />);

    expect(screen.getByRole("link", { name: /Trust Me Bro/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /My QR code/i })).toHaveAttribute("href", "/scan/my-qr");
    expect(screen.getByRole("link", { name: /Camera/i })).toHaveAttribute("href", "/scan/camera");
    expect(screen.getByRole("link", { name: /My Circle/i })).toHaveAttribute("href", "/circle");
    expect(screen.getByRole("link", { name: /Indexer/i })).toHaveAttribute("href", "/indexer");
    expect(screen.getByText("Sky Trail")).toBeInTheDocument();
    expect(screen.getByText("ST")).toBeInTheDocument();
  });
});
