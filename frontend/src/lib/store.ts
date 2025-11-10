import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

export type BaseProfile = {
  id: string;
  parent_profile_id: string | null;
  display_name: string | null;
  photo_url: string | null;
  cubid_id: string | null;
  locked_at: string | null;
  created_at: string;
};

export type ParentProfile = BaseProfile & {
  auth_user_id: string;
  email_address: string | null;
};

export type WalletProfile = BaseProfile & {
  wallet_address: string | null;
};

type UserState = {
  session: Session | null;
  parentProfile: ParentProfile | null;
  walletProfiles: WalletProfile[];
  activeWalletProfileId: string | null;
  walletAddress: string | null;
  initialised: boolean;
  setSession: (session: Session | null) => void;
  setParentProfile: (profile: ParentProfile | null) => void;
  setWalletProfiles: (profiles: WalletProfile[]) => void;
  setActiveWalletProfile: (profileId: string | null) => void;
  setWalletAddress: (address: string | null) => void;
  setInitialised: (value: boolean) => void;
  reset: () => void;
};

function normaliseAddress(address: string | null): string | null {
  return address?.toLowerCase() ?? null;
}

export const useUserStore = create<UserState>((set) => ({
  session: null,
  parentProfile: null,
  walletProfiles: [],
  activeWalletProfileId: null,
  walletAddress: null,
  initialised: false,
  setSession: (session) => set({ session }),
  setParentProfile: (profile) =>
    set((state) => ({
      parentProfile: profile,
      // Preserve active wallet when clearing parent profile
      activeWalletProfileId: profile ? state.activeWalletProfileId : null,
    })),
  setWalletProfiles: (profiles) =>
    set((state) => {
      const activeExists = state.activeWalletProfileId
        ? profiles.some((profile) => profile.id === state.activeWalletProfileId)
        : false;
      const derivedActiveId = activeExists ? state.activeWalletProfileId : profiles[0]?.id ?? null;
      const currentWalletAddress = state.walletAddress;
      const matchedActiveId = currentWalletAddress
        ? profiles.find(
            (profile) => normaliseAddress(profile.wallet_address) === normaliseAddress(currentWalletAddress),
          )?.id ?? derivedActiveId
        : derivedActiveId;
      return {
        walletProfiles: profiles,
        activeWalletProfileId: matchedActiveId,
      };
    }),
  setActiveWalletProfile: (profileId) => set({ activeWalletProfileId: profileId }),
  setWalletAddress: (walletAddress) =>
    set((state) => {
      const match = walletAddress
        ? state.walletProfiles.find(
            (profile) => normaliseAddress(profile.wallet_address) === normaliseAddress(walletAddress),
          )
        : null;
      return {
        walletAddress,
        activeWalletProfileId: match?.id ?? state.activeWalletProfileId,
      };
    }),
  setInitialised: (value) => set({ initialised: value }),
  reset: () =>
    set({
      session: null,
      parentProfile: null,
      walletProfiles: [],
      activeWalletProfileId: null,
      walletAddress: null,
      initialised: false,
    }),
}));
