import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

export type UserProfile = {
  user_id: string;
  cubid_id?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  evm_address?: string | null;
};

type UserState = {
  session: Session | null;
  user: UserProfile | null;
  walletAddress: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: UserProfile | null) => void;
  setWalletAddress: (address: string | null) => void;
  reset: () => void;
};

export const useUserStore = create<UserState>((set) => ({
  session: null,
  user: null,
  walletAddress: null,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  reset: () => set({ session: null, user: null, walletAddress: null }),
}));
