"use client";

import { useEffect, useMemo, useState } from "react";

import type { ProfileResponse } from "@/lib/api";
import { getProfile } from "@/lib/api";
import { useRequireCompletedOnboarding } from "@/lib/onboarding";
import { useUserStore } from "@/lib/store";

function formatFreshness(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export default function CirclePage() {
  const { activeWalletProfile, ready } = useRequireCompletedOnboarding();
  const connectedWalletAddress = useUserStore((state) => state.walletAddress);
  const walletAddress = connectedWalletAddress ?? activeWalletProfile?.wallet_address ?? null;

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      setData(null);
      return;
    }
    const cubidId = activeWalletProfile?.cubid_id ?? null;
    const issuer = walletAddress ?? null;
    if (!cubidId) {
      setData(null);
      setStatus(null);
      setError("Your profile is missing a Cubid ID.");
      return;
    }
    if (!issuer) {
      setData(null);
      setStatus(null);
      setError("Connect your wallet to view issued credentials.");
      return;
    }
    let cancelled = false;
    async function fetchData(currentCubid: string, currentIssuer: string) {
      setStatus("Loading attestations…");
      setError(null);
      try {
        const result = await getProfile(currentCubid, { issuer: currentIssuer });
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

    void fetchData(cubidId, issuer);
    return () => {
      cancelled = true;
    };
  }, [activeWalletProfile?.cubid_id, ready, walletAddress]);

  const groupedByCircle = useMemo(() => {
    if (!data) {
      return [] as Array<{ circle: string | null; items: ProfileResponse["outbound"] }>;
    }
    const groups = new Map<string | null, ProfileResponse["outbound"]>();
    for (const attn of data.outbound) {
      const key = attn.circle ?? null;
      const list = groups.get(key) ?? [];
      list.push(attn);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .map(([circle, items]) => ({ circle, items: items.sort((a, b) => a.freshnessSeconds - b.freshnessSeconds) }))
      .sort((a, b) => {
        const circleA = a.circle ?? "";
        const circleB = b.circle ?? "";
        return circleA.localeCompare(circleB);
      });
  }, [data]);

  if (!ready) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Checking your circle…</h1>
        <p className="text-sm text-muted-foreground">We’re verifying your onboarding details.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">My Circle</h1>
        <p className="text-muted-foreground">
          Explore every credential you&apos;ve issued and see who&apos;s vouched for you.
        </p>
      </header>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {data ? (
        <div className="space-y-6">
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

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Outbound ({data.outbound.length})</h2>
              <p className="text-sm text-muted-foreground">
                Credentials you&apos;ve issued as {walletAddress ?? "your active wallet"} grouped by circle.
              </p>
            </div>
            {groupedByCircle.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven&apos;t issued any credentials yet.</p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {groupedByCircle.map((group) => (
                <section key={group.circle ?? "uncategorised"} className="space-y-3 rounded border border-neutral-200 p-4 shadow-sm dark:border-neutral-800">
                  <header className="space-y-1">
                    <h3 className="text-lg font-semibold">{group.circle ?? "No circle tag"}</h3>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{group.items.length} credential{group.items.length === 1 ? "" : "s"}</p>
                  </header>
                  <ul className="space-y-3">
                    {group.items.map((attn) => (
                      <li key={`${attn.cubidId}-${attn.uid}`} className="rounded border border-neutral-200 p-3 shadow-sm dark:border-neutral-800">
                        <p className="font-medium">{attn.cubidId}</p>
                        <p className="text-sm text-muted-foreground">
                          Trust level {attn.trustLevel} · {formatFreshness(attn.freshnessSeconds)} · Issued {new Date(attn.issuedAt * 1000).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
