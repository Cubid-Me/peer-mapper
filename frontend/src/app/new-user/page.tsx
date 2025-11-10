"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { isValidCubidId, requestCubidId } from "../../lib/cubid";
import { useRestrictToIncompleteOnboarding } from "../../lib/onboarding";
import { upsertMyProfile } from "../../lib/profile";
import { useUserStore } from "../../lib/store";
import { ensureWallet } from "../../lib/wallet";

function createRandomCubidId(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `cubid_${globalCrypto.randomUUID().replace(/-/g, "")}`;
  }
  return `cubid_${Math.random().toString(36).slice(2, 34)}`;
}

export default function NewUserPage() {
  const router = useRouter();
  const { session, profile, ready } = useRestrictToIncompleteOnboarding();
  const setUser = useUserStore((state) => state.setUser);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);

  const initialCubidId = useMemo(() => profile?.cubid_id ?? createRandomCubidId(), [profile?.cubid_id]);
  const [form, setForm] = useState({
    displayName: profile?.display_name ?? "",
    photoUrl: profile?.photo_url ?? "",
    cubidId: initialCubidId,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      displayName: profile?.display_name ?? "",
      photoUrl: profile?.photo_url ?? "",
      cubidId: profile?.cubid_id ?? prev.cubidId ?? initialCubidId,
    }));
  }, [initialCubidId, profile?.cubid_id, profile?.display_name, profile?.photo_url]);

  if (!ready) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Loading your onboarding flow…</h1>
        <p className="text-sm text-muted-foreground">Hold tight while we confirm your session.</p>
      </section>
    );
  }

  async function handleGenerateCubid() {
    if (!session?.user?.email) {
      setError("Session missing email address");
      return;
    }
    setError(null);
    try {
      const cubid = await requestCubidId(session.user.email);
      setForm((prev) => ({ ...prev, cubidId: cubid }));
      setStatus("Cubid ID generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate Cubid ID";
      setError(message);
      setStatus(null);
    }
  }

  async function handleConnectWallet() {
    setError(null);
    setStatus("Requesting wallet access…");
    try {
      const address = await ensureWallet();
      const updated = await upsertMyProfile({ evm_address: address });
      setUser(updated);
      setWalletAddress(address);
      setStatus("Wallet linked");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet connection failed";
      setError(message);
      setStatus(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      return;
    }
    setError(null);
    if (!isValidCubidId(form.cubidId)) {
      setError("Cubid ID must match cubid_[a-z0-9]{4,32}");
      return;
    }
    setSaving(true);
    setStatus("Saving profile…");
    try {
      const updated = await upsertMyProfile({
        cubid_id: form.cubidId,
        display_name: form.displayName,
        photo_url: form.photoUrl,
      });
      setUser(updated);
      setStatus("Profile saved");
      router.push("/circle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
      setStatus(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Welcome to Trust Me Bro</h1>
        <p className="text-muted-foreground">
          Confirm your Cubid identity, pick a display name, and connect your Nova/EVM wallet to start vouching and scanning.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <fieldset className="space-y-3" disabled={!session || saving}>
          <legend className="text-lg font-semibold">Profile basics</legend>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Display name
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder="Casey Rivers"
              value={form.displayName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo URL
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setForm((prev) => ({ ...prev, photoUrl: event.target.value }))}
              placeholder="https://example.com/avatar.png"
              value={form.photoUrl}
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3" disabled={!session || saving}>
          <legend className="text-lg font-semibold">Cubid identity</legend>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Cubid ID
                <input
                  className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                  onChange={(event) => setForm((prev) => ({ ...prev, cubidId: event.target.value }))}
                  placeholder="cubid_peer123"
                  value={form.cubidId}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Must match <code>cubid_[a-z0-9]</code> with at least 4 trailing characters.
              </p>
            </div>
            <button
              className="mt-6 rounded border border-neutral-400 px-3 py-2 text-sm font-medium transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-900"
              onClick={handleGenerateCubid}
              type="button"
            >
              Generate from email
            </button>
          </div>
        </fieldset>

        <fieldset className="space-y-3" disabled={!session || saving}>
          <legend className="text-lg font-semibold">Wallet</legend>
          <p className="text-sm text-muted-foreground">
            Link the EVM account you&apos;ll use to sign vouches. We store the address with your profile for reuse.
          </p>
          <button
            className="rounded bg-black px-4 py-2 text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
            onClick={handleConnectWallet}
            type="button"
          >
            Connect wallet
          </button>
        </fieldset>

        <button
          className="rounded bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!session || saving || !form.displayName || !isValidCubidId(form.cubidId)}
          type="submit"
        >
          Save profile
        </button>
      </form>

      {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
