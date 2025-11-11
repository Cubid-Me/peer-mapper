import type { ParentProfile, WalletProfile } from "./store";
import { getSupabaseClient } from "./supabaseClient";

type ProfilesEnrichedRow = {
  id: string;
  auth_user_id: string | null;
  parent_profile_id: string | null;
  display_name: string | null;
  photo_url: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  cubid_id: string | null;
  email_address: string | null;
  wallet_address: string | null;
};

export type ProfileBundle = {
  parent: ParentProfile | null;
  wallets: WalletProfile[];
};

function mapToParentProfile(row: ProfilesEnrichedRow): ParentProfile {
  if (!row.auth_user_id) {
    throw new Error("Parent profile missing auth_user_id");
  }
  return {
    id: row.id,
    parent_profile_id: row.parent_profile_id,
    display_name: row.display_name,
    photo_url: row.photo_url,
    cubid_id: row.cubid_id,
    locked_at: row.locked_at,
    created_at: row.created_at,
    auth_user_id: row.auth_user_id!,
    email_address: row.email_address,
  };
}

function mapToWalletProfile(row: ProfilesEnrichedRow): WalletProfile {
  return {
    id: row.id,
    parent_profile_id: row.parent_profile_id,
    display_name: row.display_name,
    photo_url: row.photo_url,
    cubid_id: row.cubid_id,
    locked_at: row.locked_at,
    created_at: row.created_at,
    wallet_address: row.wallet_address,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  if (!user) {
    throw new Error("No Supabase session");
  }
  return user.id;
}

export async function fetchMyProfiles(): Promise<ProfileBundle> {
  const supabase = getSupabaseClient();
  const userId = await getAuthenticatedUserId();

  const { data: parentRow, error: parentError } = await supabase
    .from("profiles_enriched")
    .select("*")
    .eq("auth_user_id", userId)
    .is("parent_profile_id", null)
    .maybeSingle();

  if (parentError && parentError.code !== "PGRST116") {
    throw parentError;
  }

  let parent: ParentProfile | null = null;
  let walletRows: ProfilesEnrichedRow[] = [];

  if (parentRow) {
    const typedParentRow = parentRow as ProfilesEnrichedRow;
    parent = mapToParentProfile(typedParentRow);

    const { data: childRows, error: childError } = await supabase
      .from("profiles_enriched")
      .select("*")
      .eq("parent_profile_id", typedParentRow.id)
      .order("created_at", { ascending: true });

    if (childError) {
      throw childError;
    }
    walletRows = (childRows as ProfilesEnrichedRow[]) ?? [];
  }

  return {
    parent,
    wallets: walletRows.map(mapToWalletProfile),
  };
}

export async function fetchWalletProfile(profileId: string): Promise<WalletProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles_enriched")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapToWalletProfile(data as ProfilesEnrichedRow);
}

export interface CreateWalletProfileInput {
  address: string;
  displayName: string;
  photoUrl: string;
  cubidId: string;
}

export async function createWalletProfile(input: CreateWalletProfileInput): Promise<ProfileBundle> {
  const supabase = getSupabaseClient();
  const userId = await getAuthenticatedUserId();

  const { data: created, error: createError } = await supabase.rpc("create_profile_with_credential", {
    kind: "wallet",
    value: input.address,
    auth_user: userId,
  });

  if (createError) {
    throw createError;
  }

  const createdRow = Array.isArray(created) ? created[0] : created;
  const profileId: string | undefined = createdRow?.id;

  if (!profileId) {
    throw new Error("create_profile_with_credential did not return a profile id");
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ display_name: input.displayName, photo_url: input.photoUrl })
    .eq("id", profileId);

  if (updateError) {
    throw updateError;
  }

  const { error: cubidError } = await supabase.from("profiles_cubid").insert({
    profile_id: profileId,
    cubid_id: input.cubidId,
  });

  if (cubidError) {
    throw cubidError;
  }

  return fetchMyProfiles();
}

export async function updateWalletProfileDetails(profileId: string, details: {
  displayName?: string;
  photoUrl?: string;
}): Promise<WalletProfile> {
  const supabase = getSupabaseClient();
  const payload: Record<string, string | null | undefined> = {};
  if (typeof details.displayName !== "undefined") {
    payload.display_name = details.displayName;
  }
  if (typeof details.photoUrl !== "undefined") {
    payload.photo_url = details.photoUrl;
  }

  if (Object.keys(payload).length === 0) {
    const profile = await fetchWalletProfile(profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }
    return profile;
  }

  const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
  if (error) {
    throw error;
  }

  const profile = await fetchWalletProfile(profileId);
  if (!profile) {
    throw new Error("Profile not found after update");
  }
  return profile;
}
