import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWalletProfile, fetchMyProfiles } from "../src/lib/profile";

const { getUserMock, fromMock, rpcMock, updateMock, updateEqMock, insertMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("../src/lib/supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
    rpc: rpcMock,
  }),
}));

describe("profile service", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    rpcMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    insertMock.mockReset();
  });

  it("fetches parent and wallet profiles", async () => {
    const userId = "user-1";
    const parentRow = {
      id: "parent-profile",
      auth_user_id: userId,
      parent_profile_id: null,
      display_name: null,
      photo_url: null,
      locked_at: null,
      created_at: "2025-01-01T00:00:00Z",
      cubid_id: null,
      email_address: "user@example.com",
      wallet_address: null,
    };
    const walletRow = {
      id: "wallet-profile",
      auth_user_id: null,
      parent_profile_id: "parent-profile",
      display_name: "Casey",
      photo_url: "https://example.com/avatar.png",
      locked_at: null,
      created_at: "2025-01-02T00:00:00Z",
      cubid_id: "cubid_casey",
      email_address: null,
      wallet_address: "0x1234",
    };

    getUserMock.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    let call = 0;
    fromMock.mockImplementation((table: string) => {
      if (table !== "profiles_enriched") {
        throw new Error(`Unexpected table ${table}`);
      }
      if (call === 0) {
        call++;
        return {
          select: () => ({
            eq: () => ({
              is: () => ({ maybeSingle: () => Promise.resolve({ data: parentRow, error: null }) }),
            }),
          }),
        };
      }
      if (call === 1) {
        call++;
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [walletRow], error: null }),
            }),
          }),
        };
      }
      throw new Error("Unexpected call count");
    });

    const result = await fetchMyProfiles();

    expect(result.parent).toEqual({
      id: parentRow.id,
      parent_profile_id: null,
      display_name: null,
      photo_url: null,
      cubid_id: null,
      locked_at: null,
      created_at: parentRow.created_at,
      auth_user_id: userId,
      email_address: parentRow.email_address,
    });
    expect(result.wallets).toEqual([
      {
        id: walletRow.id,
        parent_profile_id: walletRow.parent_profile_id,
        display_name: walletRow.display_name,
        photo_url: walletRow.photo_url,
        cubid_id: walletRow.cubid_id,
        locked_at: walletRow.locked_at,
        created_at: walletRow.created_at,
        wallet_address: walletRow.wallet_address,
      },
    ]);
  });

  it("creates a wallet profile and returns the refreshed bundle", async () => {
    const userId = "user-1";
    const parentRow = {
      id: "parent-profile",
      auth_user_id: userId,
      parent_profile_id: null,
      display_name: null,
      photo_url: null,
      locked_at: null,
      created_at: "2025-01-01T00:00:00Z",
      cubid_id: null,
      email_address: "user@example.com",
      wallet_address: null,
    };
    const walletRow = {
      id: "wallet-profile",
      auth_user_id: null,
      parent_profile_id: "parent-profile",
      display_name: "Casey",
      photo_url: "https://example.com/avatar.png",
      locked_at: null,
      created_at: "2025-01-02T00:00:00Z",
      cubid_id: "cubid_casey",
      email_address: null,
      wallet_address: "0x1234",
    };

    getUserMock.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    rpcMock.mockResolvedValue({ data: { id: walletRow.id }, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: updateMock.mockReturnValue({ eq: updateEqMock.mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "profiles_cubid") {
        return {
          insert: insertMock.mockResolvedValue({ error: null }),
        };
      }
      if (table === "profiles_enriched") {
        return {
          select: () => ({
            eq: (column: string) => {
              if (column === "auth_user_id") {
                return {
                  is: () => ({ maybeSingle: () => Promise.resolve({ data: parentRow, error: null }) }),
                };
              }
              if (column === "parent_profile_id") {
                return {
                  order: () => Promise.resolve({ data: [walletRow], error: null }),
                };
              }
              throw new Error(`Unexpected column ${column}`);
            },
            is: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const bundle = await createWalletProfile({
      address: walletRow.wallet_address!,
      displayName: walletRow.display_name!,
      photoUrl: walletRow.photo_url!,
      cubidId: walletRow.cubid_id!,
    });

    expect(rpcMock).toHaveBeenCalledWith("create_profile_with_credential", {
      auth_user: userId,
      kind: "wallet",
      value: walletRow.wallet_address,
    });
    expect(updateMock).toHaveBeenCalledWith({ display_name: walletRow.display_name, photo_url: walletRow.photo_url });
    expect(insertMock).toHaveBeenCalledWith({
      cubid_id: walletRow.cubid_id,
      profile_id: walletRow.id,
    });
    expect(bundle.wallets[0]?.wallet_address).toBe(walletRow.wallet_address);
  });
});
