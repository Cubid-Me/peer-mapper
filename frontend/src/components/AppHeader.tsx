"use client";
 

import Link from "next/link";
import { useMemo } from "react";

import { useUserStore } from "../lib/store";

function getInitials(value: string | null | undefined): string {
  if (!value) return "TM";
  const trimmed = value.trim();
  if (!trimmed) return "TM";
  const segments = trimmed.split(/\s+/).slice(0, 2);
  if (segments.length === 1) {
    return segments[0]!.slice(0, 2).toUpperCase();
  }
  return segments
    .map((segment) => segment[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppHeader() {
  const session = useUserStore((state) => state.session);
  const parentProfile = useUserStore((state) => state.parentProfile);
  const walletProfiles = useUserStore((state) => state.walletProfiles);
  const activeWalletProfileId = useUserStore((state) => state.activeWalletProfileId);

  const activeWalletProfile = useMemo(() => {
    if (!walletProfiles.length) {
      return null;
    }
    if (!activeWalletProfileId) {
      return walletProfiles[0] ?? null;
    }
    return walletProfiles.find((profile) => profile.id === activeWalletProfileId) ?? walletProfiles[0] ?? null;
  }, [activeWalletProfileId, walletProfiles]);

  const displayName = activeWalletProfile?.display_name ?? session?.user?.email ?? parentProfile?.email_address ?? "Trust Me Bro";
  const avatarInitials = useMemo(
    () => getInitials(activeWalletProfile?.display_name ?? activeWalletProfile?.cubid_id ?? session?.user?.email),
    [activeWalletProfile?.cubid_id, activeWalletProfile?.display_name, session?.user?.email],
  );

  if (!session) {
    return null;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-sm text-slate-200">
        <Link className="font-semibold tracking-wide text-slate-100 transition hover:text-sky-300" href="/">
          Trust Me Bro
        </Link>

        <nav className="flex items-center gap-6 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          <Link className="transition hover:text-sky-300" href="/scan/my-qr">
            My QR code
          </Link>
          <Link className="transition hover:text-sky-300" href="/scan/camera">
            Camera
          </Link>
          <Link className="transition hover:text-sky-300" href="/circle">
            My Circle
          </Link>
          <Link className="transition hover:text-sky-300" href="/indexer">
            Indexer
          </Link>
        </nav>

        <Link className="group flex items-center gap-3" href="/profile">
          <div className="flex flex-col text-right">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Signed in</span>
            <span className="text-sm font-medium text-slate-100">{displayName}</span>
          </div>
          {activeWalletProfile?.photo_url ? (
            <span className="inline-flex h-12 w-12 overflow-hidden rounded-full border border-sky-400/60 shadow-lg shadow-sky-500/20">
              <img alt={displayName ?? "Profile"} className="h-full w-full object-cover" src={activeWalletProfile.photo_url} />
            </span>
          ) : (
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-sky-500/40 bg-gradient-to-br from-sky-500/80 via-slate-800 to-indigo-800 text-base font-bold uppercase text-slate-50 shadow-lg shadow-sky-500/20">
              {avatarInitials}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
