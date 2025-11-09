import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabaseClient";

export async function signInWithOtp(email: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin },
  });
  if (error) {
    throw error;
  }
  return data;
}

type AuthSubscription = ReturnType<SupabaseClient["auth"]["onAuthStateChange"]>;

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): AuthSubscription {
  const supabase = getSupabaseClient();
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function getSession() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session;
}
