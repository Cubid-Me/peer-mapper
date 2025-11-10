"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { getSession, onAuthStateChange } from "../lib/auth";
import { fetchMyProfile } from "../lib/profile";
import { useUserStore } from "../lib/store";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setSession = useUserStore((state) => state.setSession);
  const setUser = useUserStore((state) => state.setUser);
  const reset = useUserStore((state) => state.reset);
  const setInitialised = useUserStore((state) => state.setInitialised);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const session = await getSession();
        if (!isMounted) return;
        setSession(session);
        if (session) {
          const profile = await fetchMyProfile();
          if (!isMounted) return;
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Failed to bootstrap Supabase session", error);
        reset();
      } finally {
        if (isMounted) {
          setInitialised(true);
        }
      }
    }

    bootstrap();

    const { data: listener } = onAuthStateChange(async (session) => {
      setSession(session);
      if (session) {
        try {
          const profile = await fetchMyProfile();
          setUser(profile);
        } catch (error) {
          console.error("Failed to fetch Supabase profile", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setInitialised(true);
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [reset, setInitialised, setSession, setUser]);

  return <>{children}</>;
}
