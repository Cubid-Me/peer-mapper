"use client";

import Link from "next/link";

import { useUserStore } from "../lib/store";

function truncateAddress(address: string | null): string | null {
  if (!address) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function UserSessionSummary() {
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);
  const walletAddress = useUserStore((state) => state.walletAddress ?? profile?.evm_address ?? null);

  if (!session) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-neutral-400 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
        <span>No Supabase session</span>
        <Link className="underline" href="/(routes)/signin">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between">
        <span className="font-medium">Signed in</span>
        <span className="text-neutral-500">{session.user?.email ?? session.user?.id}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-neutral-600 dark:text-neutral-300">
        <span>Cubid ID: {profile?.cubid_id ?? "—"}</span>
        <span>Name: {profile?.display_name ?? "—"}</span>
        <span>Wallet: {truncateAddress(walletAddress) ?? "—"}</span>
      </div>
    </div>
  );
}
