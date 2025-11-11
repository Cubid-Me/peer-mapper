"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { getSession, onAuthStateChange } from "../lib/auth";
import { fetchMyProfiles } from "../lib/profile";
import { useUserStore } from "../lib/store";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setSession = useUserStore((state) => state.setSession);
  const setParentProfile = useUserStore((state) => state.setParentProfile);
  const setWalletProfiles = useUserStore((state) => state.setWalletProfiles);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);
  const reset = useUserStore((state) => state.reset);
  const setInitialised = useUserStore((state) => state.setInitialised);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const session = await getSession();
        if (!isMounted) return;
        if (session) {
          const bundle = await fetchMyProfiles();
          if (!isMounted) return;
          setSession(session);
          setParentProfile(bundle.parent);
          setWalletProfiles(bundle.wallets);
        } else {
          setSession(null);
          setParentProfile(null);
          setWalletProfiles([]);
          setWalletAddress(null);
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
      if (session) {
        try {
          const bundle = await fetchMyProfiles();
          setSession(session);
          setParentProfile(bundle.parent);
          setWalletProfiles(bundle.wallets);
        } catch (error) {
          console.error("Failed to fetch Supabase profiles", error);
          reset();
          setInitialised(true);
          return;
        }
      } else {
        setSession(null);
        setParentProfile(null);
        setWalletProfiles([]);
        setWalletAddress(null);
      }
      setInitialised(true);
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [reset, setInitialised, setParentProfile, setSession, setWalletAddress, setWalletProfiles]);

  return <>{children}</>;
}
