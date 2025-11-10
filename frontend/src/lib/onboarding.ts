import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import type { WalletProfile } from "./store";
import { useUserStore } from "./store";

export function hasCompletedOnboarding(walletProfiles: WalletProfile[]): boolean {
  return walletProfiles.some(
    (profile) => profile.cubid_id && profile.display_name && profile.photo_url && profile.wallet_address,
  );
}

export function useRequireCompletedOnboarding() {
  const router = useRouter();
  const initialised = useUserStore((state) => state.initialised);
  const session = useUserStore((state) => state.session);
  const parentProfile = useUserStore((state) => state.parentProfile);
  const walletProfiles = useUserStore((state) => state.walletProfiles);
  const activeWalletProfileId = useUserStore((state) => state.activeWalletProfileId);

  const activeWalletProfile = useMemo(() => {
    if (walletProfiles.length === 0) {
      return null;
    }
    if (!activeWalletProfileId) {
      return walletProfiles[0] ?? null;
    }
    return walletProfiles.find((profile) => profile.id === activeWalletProfileId) ?? walletProfiles[0] ?? null;
  }, [activeWalletProfileId, walletProfiles]);

  useEffect(() => {
    if (!initialised) {
      return;
    }
    if (!session) {
      router.replace("/signin");
      return;
    }
    if (!hasCompletedOnboarding(walletProfiles)) {
      router.replace("/new-user");
    }
  }, [initialised, router, session, walletProfiles]);

  const ready = Boolean(initialised && session && hasCompletedOnboarding(walletProfiles) && activeWalletProfile);

  return { session, parentProfile, walletProfiles, activeWalletProfile, ready } as const;
}

export function useRestrictToIncompleteOnboarding() {
  const router = useRouter();
  const initialised = useUserStore((state) => state.initialised);
  const session = useUserStore((state) => state.session);
  const parentProfile = useUserStore((state) => state.parentProfile);
  const walletProfiles = useUserStore((state) => state.walletProfiles);

  useEffect(() => {
    if (!initialised) {
      return;
    }
    if (!session) {
      router.replace("/signin");
      return;
    }
    if (hasCompletedOnboarding(walletProfiles)) {
      router.replace("/circle");
    }
  }, [initialised, router, session, walletProfiles]);

  const ready = Boolean(initialised && session && !hasCompletedOnboarding(walletProfiles));

  return { session, parentProfile, walletProfiles, ready } as const;
}
