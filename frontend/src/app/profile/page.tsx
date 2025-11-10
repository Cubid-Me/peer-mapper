"use client";
 

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useRequireCompletedOnboarding } from "../../lib/onboarding";
import { upsertMyProfile } from "../../lib/profile";
import { useUserStore } from "../../lib/store";
import { ensureWallet } from "../../lib/wallet";

export default function ProfilePage() {
  const { session, profile, ready } = useRequireCompletedOnboarding();
  const setUser = useUserStore((state) => state.setUser);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const photoPreviewUrl = useMemo(() => photoUrl || profile?.photo_url || "", [photoUrl, profile?.photo_url]);
  const previewName = displayName || profile?.display_name || "Your chosen name";

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setPhotoUrl(profile?.photo_url ?? "");
  }, [profile?.display_name, profile?.photo_url]);

  useEffect(() => {
    setImageError(false);
  }, [photoPreviewUrl]);

  if (!ready || !session || !profile) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Loading your profile…</h1>
        <p className="text-sm text-muted-foreground">One moment while we confirm your onboarding status.</p>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setError("Supabase session required");
      return;
    }
    setStatus("Saving profile…");
    setError(null);
    try {
      const updated = await upsertMyProfile({
        display_name: displayName,
        photo_url: photoUrl,
      });
      setUser(updated);
      setDisplayName(updated.display_name ?? "");
      setPhotoUrl(updated.photo_url ?? "");
      setStatus("Profile updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
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

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">My profile</h1>
        <p className="text-muted-foreground">
          This name can be a nickname. Your name, picture, and Cubid ID are what you share with anyone you invite to connect.
        </p>
      </header>

      <div className="rounded border border-neutral-300 p-3 text-sm shadow-sm dark:border-neutral-800">
        <p>Cubid ID: {profile?.cubid_id ?? "—"}</p>
        <p>Wallet: {profile?.evm_address ?? "—"}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="Casey Rivers"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo URL
            <input
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="https://example.com/avatar.png"
            />
          </label>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60"
            disabled={!session}
            type="submit"
          >
            Save changes
          </button>
          <button
            className="rounded border border-neutral-400 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            onClick={handleConnectWallet}
            type="button"
          >
            Connect wallet
          </button>
          {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>

        <aside className="space-y-4 rounded border border-neutral-300 p-4 text-sm shadow-sm dark:border-neutral-800">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Preview for peers</h2>
            <p className="text-muted-foreground">
              Here’s how your profile appears to someone you invite. Double-check the image link below before you share it.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {photoPreviewUrl && !imageError ? (
              <span className="inline-flex h-24 w-24 overflow-hidden rounded-full border border-neutral-300 shadow-sm dark:border-neutral-700">
                <img
                  alt="Profile photo preview"
                  className="h-full w-full object-cover"
                  src={photoPreviewUrl}
                  onError={() => setImageError(true)}
                />
              </span>
            ) : (
              <span className="inline-flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-neutral-300 bg-neutral-100 text-base font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                {photoPreviewUrl && imageError ? "!" : "No photo"}
              </span>
            )}
            <div className="space-y-1">
              <p className="text-base font-semibold">{previewName}</p>
              <p className="text-sm text-muted-foreground">Cubid ID: {profile?.cubid_id ?? "Pending from onboarding"}</p>
            </div>
          </div>
          {photoPreviewUrl && imageError ? (
            <p className="rounded border border-amber-400/70 bg-amber-50/70 p-2 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
              We couldn’t load this image. Confirm the URL works in a new tab, then paste it here again.
            </p>
          ) : null}
          {!photoPreviewUrl && !imageError ? (
            <p className="text-xs text-muted-foreground">Add a photo URL above to see it rendered here.</p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
