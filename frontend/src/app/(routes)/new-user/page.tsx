"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

import { isValidCubidId, requestCubidId } from "../../../lib/cubid";
import { saveProfilePhotoFromFile, saveProfilePhotoFromUrl } from "../../../lib/photos";
import { upsertMyProfile } from "../../../lib/profile";
import { useUserStore } from "../../../lib/store";
import { ensureWallet } from "../../../lib/wallet";

type Step = "name" | "photo" | "wallet" | "review";

export default function NewUserPage() {
  const router = useRouter();
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);
  const walletAddress = useUserStore((state) => state.walletAddress);
  const setUser = useUserStore((state) => state.setUser);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? "");
  const [photoInput, setPhotoInput] = useState(profile?.photo_url ?? "");
  const [cubidId, setCubidId] = useState(profile?.cubid_id ?? "");
  const [step, setStep] = useState<Step>("name");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isGeneratingCubid, setIsGeneratingCubid] = useState(false);

  useEffect(() => {
    if (!session) {
      router.replace("/(routes)/signin");
      return;
    }
    if (profile?.cubid_id) {
      router.replace("/(routes)/profile");
    }
  }, [profile?.cubid_id, router, session]);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setPhotoUrl(profile?.photo_url ?? "");
    setPhotoInput(profile?.photo_url ?? "");
    setCubidId(profile?.cubid_id ?? "");
  }, [profile]);

  const sessionEmail = session?.user?.email ?? null;
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!sessionEmail || cubidId) {
      return;
    }

    setIsGeneratingCubid(true);
    setStatus("Generating Cubid ID…");
    setError(null);

    const email = sessionEmail;

    async function generateCubid() {
      try {
        const generated = await requestCubidId(email);
        if (!cancelled) {
          setCubidId(generated);
          setStatus("Cubid ID ready");
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to generate Cubid ID";
          setError(message);
          setStatus(null);
        }
      } finally {
        if (!cancelled) {
          setIsGeneratingCubid(false);
        }
      }
    }

    void generateCubid();

    return () => {
      cancelled = true;
    };
  }, [cubidId, sessionEmail]);

  const canProceedFromName = useMemo(() => displayName.trim().length > 1, [displayName]);
  const canProceedFromPhoto = useMemo(() => Boolean(photoUrl) && !isProcessingPhoto, [isProcessingPhoto, photoUrl]);

  function resetTransientMessages() {
    setStatus(null);
    setError(null);
  }

  function handleDisplayNameSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canProceedFromName) {
      setError("Please tell us your name before continuing");
      return;
    }
    resetTransientMessages();
    setStep("photo");
  }

  async function handlePhotoFromLink() {
    if (!sessionUserId) {
      setError("You need to be signed in to add a photo");
      return;
    }
    if (!photoInput.trim()) {
      setError("Paste a link to your photo first");
      return;
    }

    setIsProcessingPhoto(true);
    setStatus("Fetching and saving your photo…");
    setError(null);
    try {
      const url = await saveProfilePhotoFromUrl(photoInput.trim(), sessionUserId);
      setPhotoUrl(url);
      setPhotoInput(url);
      setStatus("Photo saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "We could not store that photo";
      setError(message);
      setStatus(null);
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!sessionUserId) {
      setError("You need to be signed in to add a photo");
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsProcessingPhoto(true);
    setStatus("Uploading your photo…");
    setError(null);
    try {
      const url = await saveProfilePhotoFromFile(file, sessionUserId);
      setPhotoUrl(url);
      setPhotoInput(url);
      setStatus("Photo saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "We could not upload that file";
      setError(message);
      setStatus(null);
    } finally {
      setIsProcessingPhoto(false);
      event.target.value = "";
    }
  }

  function handlePhotoNext() {
    if (!photoUrl) {
      setError("Please add a photo before moving on");
      return;
    }
    resetTransientMessages();
    setStep("wallet");
  }

  async function handleConnectWallet() {
    setError(null);
    setStatus("Requesting wallet access…");
    try {
      const address = await ensureWallet();
      setWalletAddress(address);
      setStatus("Wallet linked");
      setStep("review");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet connection failed";
      setError(message);
      setStatus(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step !== "review") {
      return;
    }

    if (!sessionUserId || !sessionEmail) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    if (!isValidCubidId(cubidId)) {
      setError("Cubid ID must match cubid_[a-z0-9]{4,32}");
      return;
    }

    if (!walletAddress) {
      setError("Connect a wallet before finishing");
      return;
    }

    setSaving(true);
    setStatus("Saving profile…");
    setError(null);
    try {
      const updated = await upsertMyProfile({
        cubid_id: cubidId,
        display_name: displayName.trim(),
        photo_url: photoUrl,
        evm_address: walletAddress,
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
    <section className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Welcome to Trust Me Bro</h1>
        <p className="text-muted-foreground">
          We will guide you through setting up your Cubid identity in three quick steps.
        </p>
      </header>

      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        {step === "name" ? (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">What&apos;s your name?</h2>
            <p className="text-muted-foreground">This is how your peers will find and vouch for you.</p>
            <label className="flex flex-col gap-3">
              <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Display name</span>
              <input
                aria-label="Display name"
                autoFocus
                className="w-full rounded-lg border border-neutral-300 bg-white px-6 py-4 text-2xl font-medium shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                disabled={!session || saving}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Casey Rivers"
                value={displayName}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
                disabled={!canProceedFromName || !session || saving}
                onClick={handleDisplayNameSubmit}
                type="button"
              >
                Next
              </button>
            </div>
          </section>
        ) : null}

        {step === "photo" ? (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Add a photo</h2>
            <p className="text-muted-foreground">Upload a photo or share a link so your peers can recognise you.</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Paste a link</span>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <input
                      className="flex-1 rounded border border-neutral-300 px-4 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                      disabled={!session || isProcessingPhoto || saving}
                      onChange={(event) => setPhotoInput(event.target.value)}
                      placeholder="https://example.com/avatar.png"
                      value={photoInput}
                    />
                    <button
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!session || isProcessingPhoto || saving}
                      onClick={handlePhotoFromLink}
                      type="button"
                    >
                      Use this link
                    </button>
                  </div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Or upload a file</span>
                  <input
                    accept="image/*"
                    className="cursor-pointer rounded border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-600 hover:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    disabled={!session || isProcessingPhoto || saving}
                    onChange={handlePhotoUpload}
                    type="file"
                  />
                </label>
              </div>

              {photoUrl ? (
                <figure className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <img
                    alt="Profile preview"
                    className="h-20 w-20 rounded-full object-cover"
                    src={photoUrl}
                  />
                  <figcaption className="text-sm text-muted-foreground">This photo will appear on your profile.</figcaption>
                </figure>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-neutral-300 px-6 py-3 text-base font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => {
                  resetTransientMessages();
                  setStep("name");
                }}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
                disabled={!canProceedFromPhoto || !session || saving}
                onClick={handlePhotoNext}
                type="button"
              >
                Next
              </button>
            </div>
          </section>
        ) : null}

        {step === "wallet" ? (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Connect your wallet</h2>
            <p className="text-muted-foreground">
              Link the EVM account you&apos;ll use to sign vouches. We only store the public address.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-neutral-300 px-6 py-3 text-base font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => {
                  resetTransientMessages();
                  setStep("photo");
                }}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-full bg-black px-6 py-3 text-base font-semibold text-white shadow transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
                disabled={!session || saving}
                onClick={handleConnectWallet}
                type="button"
              >
                Connect wallet
              </button>
            </div>
          </section>
        ) : null}

        {step === "review" ? (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">All set! Review your details.</h2>
            <p className="text-muted-foreground">
              Confirm everything looks right before we create your Cubid profile.
            </p>

            <dl className="space-y-4">
              <div className="flex flex-col gap-2">
                <dt className="text-sm font-medium text-muted-foreground">Display name</dt>
                <dd className="rounded border border-neutral-200 bg-white px-4 py-3 text-base shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  {displayName.trim() || "–"}
                </dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm font-medium text-muted-foreground">Wallet public key</dt>
                <dd className="rounded border border-neutral-200 bg-white px-4 py-3 font-mono text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  {walletAddress ?? "Wallet not connected"}
                </dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm font-medium text-muted-foreground">Cubid ID</dt>
                <dd>
                  <input
                    aria-label="Cubid ID"
                    className="w-full cursor-not-allowed rounded border border-neutral-300 bg-neutral-100 px-4 py-3 font-mono text-sm text-neutral-700 shadow-inner dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                    readOnly
                    value={cubidId}
                  />
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-neutral-300 px-6 py-3 text-base font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => {
                  resetTransientMessages();
                  setStep("wallet");
                }}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-full bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!session || saving}
                type="submit"
              >
                Finish setup
              </button>
            </div>
          </section>
        ) : null}
      </form>

      {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
