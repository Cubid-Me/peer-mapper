"use client";

import { useEffect, useMemo, useState } from "react";

import type { ProfileResponse } from "@/lib/api";
import { getProfile } from "@/lib/api";
import { useUserStore } from "@/lib/store";

function formatFreshness(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export default function CirclePage() {
  const profile = useUserStore((state) => state.user);
  const walletAddress = useUserStore((state) => state.walletAddress ?? state.user?.evm_address ?? null);

  const [query, setQuery] = useState(profile?.cubid_id ?? "");
  const [activeCubid, setActiveCubid] = useState(profile?.cubid_id ?? "");
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileReady = useMemo(() => Boolean(profile?.cubid_id), [profile?.cubid_id]);

  useEffect(() => {
    setQuery(profile?.cubid_id ?? "");
    setActiveCubid(profile?.cubid_id ?? "");
  }, [profile?.cubid_id]);

  useEffect(() => {
    if (!activeCubid) {
      setData(null);
      return;
    }
    let cancelled = false;
    async function fetchData() {
      setStatus("Loading attestations…");
      setError(null);
      try {
        const result = await getProfile(activeCubid, { issuer: walletAddress ?? undefined });
        if (!cancelled) {
          setData(result);
          setStatus(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load profile";
          setError(message);
          setStatus(null);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [activeCubid, walletAddress]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">My Circle</h1>
        <p className="text-muted-foreground">
          View the latest inbound attestations for a Cubid ID and track who you&apos;ve vouched for using your connected wallet.
        </p>
      </header>

      <div className="space-y-2">
        <label className="flex flex-col gap-2 text-sm font-medium sm:flex-row sm:items-center">
          <span>Search Cubid ID</span>
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="cubid_peer123"
              value={query}
            />
            <button
              className="rounded bg-black px-4 py-2 text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
              disabled={!query}
              onClick={() => setActiveCubid(query.trim())}
              type="button"
            >
              Load
            </button>
          </div>
        </label>
        {!profileReady ? (
          <p className="text-sm text-red-500">Complete onboarding to view your circle.</p>
        ) : null}
      </div>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {data ? (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Inbound ({data.inbound.length})</h2>
            <p className="text-sm text-muted-foreground">Wallets who vouched for {data.cubidId}.</p>
            <ul className="space-y-3">
              {data.inbound.map((attn) => (
                <li key={`${attn.issuer}-${attn.uid}`} className="rounded border border-neutral-200 p-3 shadow-sm dark:border-neutral-800">
                  <p className="font-medium">Issuer {attn.issuer}</p>
                  <p className="text-sm text-muted-foreground">
                    Trust level {attn.trustLevel} · {attn.circle ?? "no circle"} · {formatFreshness(attn.freshnessSeconds)}
                  </p>
                </li>
              ))}
              {data.inbound.length === 0 ? <li className="text-sm text-muted-foreground">No attestations yet.</li> : null}
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Outbound ({data.outbound.length})</h2>
            <p className="text-sm text-muted-foreground">
              Cubid IDs you&apos;ve vouched for as {walletAddress ?? "your wallet"}.
            </p>
            <ul className="space-y-3">
              {data.outbound.map((attn) => (
                <li key={`${attn.cubidId}-${attn.uid}`} className="rounded border border-neutral-200 p-3 shadow-sm dark:border-neutral-800">
                  <p className="font-medium">{attn.cubidId}</p>
                  <p className="text-sm text-muted-foreground">
                    Trust level {attn.trustLevel} · {attn.circle ?? "no circle"} · {formatFreshness(attn.freshnessSeconds)}
                  </p>
                </li>
              ))}
              {data.outbound.length === 0 ? <li className="text-sm text-muted-foreground">No outbound vouches yet.</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
    </section>
  );
}
