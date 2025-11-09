import type { Session } from "@supabase/supabase-js";

import { supabase } from "./supabaseClient";

export async function signInWithOtp(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin },
  });
  if (error) {
    throw error;
  }
  return data;
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): ReturnType<typeof supabase.auth.onAuthStateChange> {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session;
}
