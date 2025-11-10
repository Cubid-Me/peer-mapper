import type { Session } from "@supabase/supabase-js";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewUserPage from "../src/app/new-user/page";
import { useUserStore } from "../src/lib/store";

const {
  pushMock,
  requestCubidIdMock,
  ensureWalletMock,
  upsertMyProfileMock,
  uploadMock,
  getPublicUrlMock,
  createObjectURLMock,
  revokeObjectURLMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  requestCubidIdMock: vi.fn<[], Promise<string>>(),
  ensureWalletMock: vi.fn<[], Promise<string>>(),
  upsertMyProfileMock: vi.fn(),
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  createObjectURLMock: vi.fn(() => "blob:preview"),
  revokeObjectURLMock: vi.fn(),
}));
let originalFetch: typeof globalThis.fetch;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("../src/lib/cubid", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/cubid")>("../src/lib/cubid");
  return {
    ...actual,
    requestCubidId: requestCubidIdMock,
  };
});

vi.mock("../src/lib/onboarding", () => ({
  useRestrictToIncompleteOnboarding: () => ({
    ready: true,
    session: {
      user: { id: "user-1", email: "user@example.com" },
    } as unknown as Session,
    profile: { user_id: "user-1" },
  }),
}));

vi.mock("../src/lib/profile", () => ({
  upsertMyProfile: (...args: unknown[]) => upsertMyProfileMock(...args),
}));

vi.mock("../src/lib/wallet", () => ({
  ensureWallet: (...args: unknown[]) => ensureWalletMock(...args),
}));

vi.mock("../src/lib/supabaseClient", () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  }),
}));

describe("NewUserPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    requestCubidIdMock.mockResolvedValue("cubid_testabcd");
    ensureWalletMock.mockResolvedValue("0xwallet");
    upsertMyProfileMock.mockImplementation(async (payload) => ({
      user_id: "user-1",
      ...payload,
    }));
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockImplementation((path: string) => ({
      data: { publicUrl: `https://supabase.test/${path}` },
    }));

    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;

    createObjectURLMock.mockReset();
    createObjectURLMock.mockReturnValue("blob:preview");
    revokeObjectURLMock.mockReset();
    const globalUrl = globalThis.URL as unknown as Record<string, unknown>;
    globalUrl.createObjectURL = createObjectURLMock;
    globalUrl.revokeObjectURL = revokeObjectURLMock;

    act(() => {
      useUserStore.getState().reset();
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    const globalUrl = globalThis.URL as unknown as Record<string, unknown>;
    globalUrl.createObjectURL = createObjectURLMock;
    globalUrl.revokeObjectURL = revokeObjectURLMock;
    upsertMyProfileMock.mockReset();
    requestCubidIdMock.mockReset();
    ensureWalletMock.mockReset();
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();
    pushMock.mockReset();
    act(() => {
      useUserStore.getState().reset();
    });
  });

  it("guides the user through the onboarding steps", async () => {
    const user = userEvent.setup();

    render(<NewUserPage />);

    await waitFor(() => expect(requestCubidIdMock).toHaveBeenCalled());

    const nameInput = screen.getByPlaceholderText("Casey Rivers");
    await user.type(nameInput, "Maple Leaf");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/share a photo/i);

    const fileInput = screen.getByLabelText(/upload a photo/i) as HTMLInputElement;
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    expect(uploadMock.mock.calls[0][0]).toMatch(/cubid_testabcd/);

    await screen.findByText(/connect your wallet/i);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    await waitFor(() => expect(ensureWalletMock).toHaveBeenCalled());
    await waitFor(() => expect(upsertMyProfileMock).toHaveBeenCalledWith({ evm_address: "0xwallet" }));

    const cubidInput = await screen.findByDisplayValue("cubid_testabcd");
    expect(cubidInput).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() =>
      expect(upsertMyProfileMock).toHaveBeenCalledWith({
        cubid_id: "cubid_testabcd",
        display_name: "Maple Leaf",
        photo_url: expect.stringContaining("https://supabase.test/"),
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/circle"));
  });
});
