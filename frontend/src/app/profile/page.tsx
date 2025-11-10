"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { isValidCubidId, requestCubidId } from "../../lib/cubid";
import { useRequireCompletedOnboarding } from "../../lib/onboarding";
import { createWalletProfile, fetchMyProfiles } from "../../lib/profile";
import { useUserStore } from "../../lib/store";
import { ensureWallet } from "../../lib/wallet";

export default function ProfilePage() {
  const { session, parentProfile, walletProfiles, activeWalletProfile, ready } = useRequireCompletedOnboarding();
  const setParentProfile = useUserStore((state) => state.setParentProfile);
  const setWalletProfiles = useUserStore((state) => state.setWalletProfiles);
  const setActiveWalletProfile = useUserStore((state) => state.setActiveWalletProfile);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newCubidId, setNewCubidId] = useState("");
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [newPhotoUrl]);

  useEffect(() => {
    let active = true;
    const seed = session?.user?.email ?? "wallet";

    requestCubidId(seed)
      .then((cubid) => {
        if (!active) {
          return;
        }
        setNewCubidId(cubid);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to generate Cubid ID";
        setError((prev) => prev ?? message);
      });

    return () => {
      active = false;
    };
  }, [session?.user?.email]);

  const sortedWallets = useMemo(
    () => walletProfiles.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [walletProfiles],
  );

  const activeWalletId = activeWalletProfile?.id ?? sortedWallets[0]?.id ?? null;

  if (!ready || !session) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Loading your profiles…</h1>
        <p className="text-sm text-muted-foreground">One moment while we confirm your onboarding status.</p>
      </section>
    );
  }

  async function refreshProfiles() {
    try {
      const bundle = await fetchMyProfiles();
      setParentProfile(bundle.parent);
      setWalletProfiles(bundle.wallets);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh profiles";
      setError(message);
    }
  }

  async function handleCreateWalletProfile(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }
    if (!newPhotoUrl.trim()) {
      setError("Photo URL is required");
      return;
    }
    if (!isValidCubidId(newCubidId)) {
      setError("Cubid ID must match cubid_[a-z0-9]{4,32}");
      return;
    }

    setBusy(true);
    setStatus("Requesting wallet access…");

    try {
      const address = await ensureWallet();
      const lower = address.toLowerCase();
      const duplicate = walletProfiles.find(
        (profile) => profile.wallet_address && profile.wallet_address.toLowerCase() === lower,
      );
      if (duplicate) {
        setActiveWalletProfile(duplicate.id);
        setWalletAddress(address);
        setStatus("Wallet already linked");
        return;
      }

      const bundle = await createWalletProfile({
        address,
        displayName: newName,
        photoUrl: newPhotoUrl,
        cubidId: newCubidId,
      });
      setParentProfile(bundle.parent);
      setWalletProfiles(bundle.wallets);
      const created =
        bundle.wallets.find((profile) => profile.wallet_address && profile.wallet_address.toLowerCase() === lower) ??
        bundle.wallets[bundle.wallets.length - 1] ??
        null;
      if (created) {
        setActiveWalletProfile(created.id);
      }
      setWalletAddress(address);
      setStatus("Wallet profile created");
      setNewName("");
      setNewPhotoUrl("");
      try {
        const cubid = await requestCubidId(address);
        setNewCubidId(cubid);
      } catch (cubidError) {
        const message = cubidError instanceof Error ? cubidError.message : "Failed to generate Cubid ID";
        setError(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create wallet profile";
      setError(message);
      setStatus(null);
    } finally {
      setBusy(false);
      await refreshProfiles();
    }
  }

  function handleSelectWallet(profileId: string) {
    setActiveWalletProfile(profileId);
    const selected = walletProfiles.find((profile) => profile.id === profileId);
    if (selected?.wallet_address) {
      setWalletAddress(selected.wallet_address);
    }
    setStatus("Active wallet updated");
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Wallet profiles</h1>
        <p className="text-muted-foreground">
          Link additional wallets to your email-based parent profile. Each wallet gets its own immutable identity card.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded border border-neutral-300 p-4 text-sm shadow-sm dark:border-neutral-800">
            <p className="font-medium">Signed in as</p>
            <p className="text-neutral-600 dark:text-neutral-300">{session.user?.email ?? parentProfile?.email_address}</p>
            <p className="text-neutral-500">Parent profile ID: {parentProfile?.id ?? "—"}</p>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Linked wallets</h2>
              <button
                className="text-sm font-medium text-blue-600 underline-offset-2 transition hover:underline"
                onClick={() => void refreshProfiles()}
                type="button"
              >
                Refresh
              </button>
            </div>
            {sortedWallets.length ? (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedWallets.map((profile) => {
                  const isActive = profile.id === activeWalletId;
                  return (
                    <li
                      key={profile.id}
                      className={`rounded border p-4 text-sm shadow-sm transition dark:border-neutral-800 ${
                        isActive ? "border-blue-500 shadow-blue-200/30 dark:shadow-blue-900/40" : "border-neutral-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {profile.photo_url ? (
                          <span className="inline-flex h-14 w-14 overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700">
                            <img alt={`${profile.display_name ?? "Wallet"} avatar`} className="h-full w-full object-cover" src={profile.photo_url} />
                          </span>
                        ) : (
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-neutral-300 text-sm font-semibold text-neutral-500 dark:border-neutral-700 dark:text-neutral-300">
                            No photo
                          </span>
                        )}
                        <div className="space-y-1">
                          <p className="text-base font-semibold">{profile.display_name ?? "Unnamed wallet"}</p>
                          <p className="text-xs text-neutral-500">Cubid ID: {profile.cubid_id ?? "—"}</p>
                        </div>
                      </div>
                      <dl className="mt-4 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                        <div>
                          <dt className="font-medium uppercase tracking-wide text-neutral-500">Wallet address</dt>
                          <dd className="break-all font-mono text-[11px]">{profile.wallet_address ?? "—"}</dd>
                        </div>
                        {profile.locked_at ? (
                          <div>
                            <dt className="font-medium uppercase tracking-wide text-neutral-500">Locked</dt>
                            <dd>Profile locked at {new Date(profile.locked_at).toLocaleString()}</dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span className={isActive ? "font-semibold text-blue-600" : "text-neutral-500"}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                        <button
                          className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                          disabled={isActive}
                          onClick={() => handleSelectWallet(profile.id)}
                          type="button"
                        >
                          Use this wallet
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">No wallets linked yet. Add one below to get started.</p>
            )}
          </section>
        </div>

        <form className="space-y-4 rounded border border-neutral-300 p-4 text-sm shadow-sm dark:border-neutral-800" onSubmit={handleCreateWalletProfile}>
          <div>
            <h2 className="text-lg font-semibold">Add a wallet profile</h2>
            <p className="text-neutral-500">
              Set the display name and photo you want peers to see, then connect the wallet for this profile.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Display name
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Casey Rivers"
              value={newName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo URL
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setNewPhotoUrl(event.target.value)}
              placeholder="https://example.com/avatar.png"
              value={newPhotoUrl}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cubid ID
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setNewCubidId(event.target.value)}
              value={newCubidId}
            />
          </label>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <button
              className="rounded border border-neutral-300 px-2 py-1 font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              onClick={async (event) => {
                event.preventDefault();
                try {
                  const cubid = await requestCubidId(newName || session.user?.email || "wallet");
                  setNewCubidId(cubid);
                } catch (cubidError) {
                  const message = cubidError instanceof Error ? cubidError.message : "Failed to generate Cubid ID";
                  setError(message);
                }
              }}
              type="button"
            >
              Regenerate
            </button>
            <span>Keep the generated Cubid ID handy for support.</span>
          </div>
          <div className="flex items-center gap-3">
            {newPhotoUrl && !previewError ? (
              <span className="inline-flex h-16 w-16 overflow-hidden rounded-full border border-neutral-300 dark:border-neutral-700">
                <img alt="Wallet preview" className="h-full w-full object-cover" src={newPhotoUrl} onError={() => setPreviewError(true)} />
              </span>
            ) : (
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-neutral-300 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                {newPhotoUrl && previewError ? "Image error" : "No preview"}
              </span>
            )}
            <p className="text-xs text-neutral-500">
              Paste a direct image URL. To upload, head to onboarding or use your own storage for now.
            </p>
          </div>
          <button
            className="w-full rounded bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? "Saving…" : "Connect wallet"}
          </button>
          {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
