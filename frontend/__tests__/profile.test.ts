import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMyProfile, upsertMyProfile } from "../src/lib/profile";
import type { UserProfile } from "../src/lib/store";

const {
  getUserMock,
  fromMock,
  upsertMock,
  upsertSelectMock,
  upsertSingleMock,
  selectMock,
  selectEqMock,
  maybeSingleMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  upsertMock: vi.fn(),
  upsertSelectMock: vi.fn(),
  upsertSingleMock: vi.fn(),
  selectMock: vi.fn(),
  selectEqMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("../src/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  },
}));

describe("profile service", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    upsertMock.mockReset();
    upsertSelectMock.mockReset();
    upsertSingleMock.mockReset();
    selectMock.mockReset();
    selectEqMock.mockReset();
    maybeSingleMock.mockReset();

    fromMock.mockReturnValue({
      upsert: upsertMock,
      select: selectMock,
    });

    upsertMock.mockReturnValue({
      select: upsertSelectMock,
    });

    upsertSelectMock.mockReturnValue({
      single: upsertSingleMock,
    });

    selectMock.mockReturnValue({
      eq: selectEqMock,
    });

    selectEqMock.mockReturnValue({
      maybeSingle: maybeSingleMock,
    });
  });

  it("upserts the current user profile", async () => {
    const profile: UserProfile = {
      user_id: "user-1",
      display_name: "Casey",
    };

    getUserMock.mockResolvedValue({ data: { user: { id: profile.user_id } }, error: null });
    upsertSingleMock.mockResolvedValue({ data: profile, error: null });

    const result = await upsertMyProfile({ display_name: "Casey" });

    expect(fromMock).toHaveBeenCalledWith("users");
    expect(upsertMock).toHaveBeenCalledWith({ user_id: profile.user_id, display_name: "Casey" }, { onConflict: "user_id" });
    expect(result).toEqual(profile);
  });

  it("throws when no Supabase session is present", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(upsertMyProfile({ display_name: "Casey" })).rejects.toThrow("No Supabase session");
  });

  it("returns the profile when it exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    maybeSingleMock.mockResolvedValue({ data: { user_id: "user-1", cubid_id: "cubid" }, error: null });

    const result = await fetchMyProfile();

    expect(fromMock).toHaveBeenCalledWith("users");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(selectEqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toEqual({ user_id: "user-1", cubid_id: "cubid" });
  });

  it("returns null when no profile row exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const result = await fetchMyProfile();

    expect(result).toBeNull();
  });
});
