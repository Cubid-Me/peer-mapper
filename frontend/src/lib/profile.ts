import type { UserProfile } from "./store";
import { supabase } from "./supabaseClient";

export async function upsertMyProfile(profile: {
  cubid_id?: string;
  display_name?: string;
  photo_url?: string;
  evm_address?: string;
}): Promise<UserProfile> {
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();
  if (sessionError) {
    throw sessionError;
  }
  if (!user) {
    throw new Error("No Supabase session");
  }

  const { data, error } = await supabase
    .from("users")
    .upsert({ user_id: user.id, ...profile }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as UserProfile;
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();
  if (sessionError) {
    throw sessionError;
  }
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as UserProfile | null) ?? null;
}
