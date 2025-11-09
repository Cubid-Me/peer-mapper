"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { upsertMyProfile } from "../../../lib/profile";
import { useUserStore } from "../../../lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);

  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/(routes)/signin");
    }
  }, [router, session]);

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

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">My profile</h1>
        <p className="text-muted-foreground">Review your Cubid ID and refresh your display information.</p>
      </header>

      <div className="rounded border border-neutral-300 p-3 text-sm shadow-sm dark:border-neutral-800">
        <p>Cubid ID: {profile?.cubid_id ?? "—"}</p>
        <p>Wallet: {profile?.evm_address ?? "—"}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Display name
          <input
            value={displayName || profile?.display_name || ""}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Casey Mapper"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Photo URL
          <input
            value={photoUrl || profile?.photo_url || ""}
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
      </form>

      {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
