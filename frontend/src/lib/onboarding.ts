import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { UserProfile } from "./store";
import { useUserStore } from "./store";

export function hasCompletedOnboarding(user: UserProfile | null): boolean {
  return Boolean(user?.cubid_id && user?.display_name && user?.evm_address);
}

export function useRequireCompletedOnboarding() {
  const router = useRouter();
  const initialised = useUserStore((state) => state.initialised);
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);

  useEffect(() => {
    if (!initialised) {
      return;
    }
    if (!session) {
      router.replace("/(routes)/signin");
      return;
    }
    if (!hasCompletedOnboarding(profile)) {
      router.replace("/(routes)/new-user");
    }
  }, [initialised, profile, router, session]);

  const ready = Boolean(initialised && session && hasCompletedOnboarding(profile));

  return { session, profile, ready } as const;
}

export function useRestrictToIncompleteOnboarding() {
  const router = useRouter();
  const initialised = useUserStore((state) => state.initialised);
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);

  useEffect(() => {
    if (!initialised) {
      return;
    }
    if (!session) {
      router.replace("/(routes)/signin");
      return;
    }
    if (hasCompletedOnboarding(profile)) {
      router.replace("/(routes)/circle");
    }
  }, [initialised, profile, router, session]);

  const ready = Boolean(initialised && session && !hasCompletedOnboarding(profile));

  return { session, profile, ready } as const;
}
