"use client";

import { type FormEvent, useEffect, useState } from "react";

import { signInWithOtp } from "../../../lib/auth";
import { upsertMyProfile } from "../../../lib/profile";
import { useUserStore } from "../../../lib/store";
import { ensureWallet } from "../../../lib/wallet";

export default function SignInPage() {
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    cubid_id: profile?.cubid_id ?? "",
    display_name: profile?.display_name ?? "",
    photo_url: profile?.photo_url ?? "",
  });

  useEffect(() => {
    setProfileForm({
      cubid_id: profile?.cubid_id ?? "",
      display_name: profile?.display_name ?? "",
      photo_url: profile?.photo_url ?? "",
    });
  }, [profile]);

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("Sending magic link…");
    try {
      await signInWithOtp(email);
      setStatus("Check your inbox for the magic link.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send magic link";
      setError(message);
      setStatus(null);
    }
  }

  async function handleProfileSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("Saving profile…");
    try {
      const updated = await upsertMyProfile(profileForm);
      setUser(updated);
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
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Supabase session + Cubid linkage</h1>
        <p className="text-muted-foreground">
          Use a Supabase magic link to establish your session, then attach the Cubid ID, display name, and wallet address that
          power Peer Mapper.
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSendOtp}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email for magic link
          <input
            className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>
        <button
          className="rounded bg-black px-4 py-2 text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-black"
          type="submit"
        >
          Send magic link
        </button>
      </form>

      <form className="space-y-3" onSubmit={handleProfileSave}>
        <fieldset className="space-y-3" disabled={!session}>
          <legend className="text-lg font-semibold">Profile (requires active session)</legend>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cubid ID
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  cubid_id: event.target.value,
                }))
              }
              placeholder="cubid_demo123"
              value={profileForm.cubid_id}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Display name
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  display_name: event.target.value,
                }))
              }
              placeholder="Casey Mapper"
              value={profileForm.display_name}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo URL
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  photo_url: event.target.value,
                }))
              }
              placeholder="https://example.com/avatar.png"
              value={profileForm.photo_url}
            />
          </label>
          <div className="flex gap-3">
            <button
              className="rounded bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={!session}
              type="submit"
            >
              Save profile
            </button>
            <button
              className="rounded border border-neutral-400 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:hover:bg-neutral-900"
              disabled={!session}
              onClick={handleConnectWallet}
              type="button"
            >
              Link wallet & store address
            </button>
          </div>
        </fieldset>
      </form>

      {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
