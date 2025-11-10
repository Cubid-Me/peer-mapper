"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { isValidCubidId, requestCubidId } from "../../lib/cubid";
import { useRestrictToIncompleteOnboarding } from "../../lib/onboarding";
import { upsertMyProfile } from "../../lib/profile";
import { useUserStore } from "../../lib/store";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { ensureWallet } from "../../lib/wallet";

function createRandomCubidId(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return `cubid_${globalCrypto.randomUUID().replace(/-/g, "")}`;
  }
  return `cubid_${Math.random().toString(36).slice(2, 34)}`;
}

type OnboardingStep = 0 | 1 | 2;

export default function NewUserPage() {
  const router = useRouter();
  const { session, profile, ready } = useRestrictToIncompleteOnboarding();
  const setUser = useUserStore((state) => state.setUser);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);
  const walletAddress = useUserStore((state) => state.walletAddress);

  const initialCubidId = useMemo(() => profile?.cubid_id ?? createRandomCubidId(), [profile?.cubid_id]);
  const [form, setForm] = useState({
    displayName: profile?.display_name ?? "",
    photoUrl: profile?.photo_url ?? "",
    cubidId: initialCubidId,
  });
  const [step, setStep] = useState<OnboardingStep>(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoLink, setPhotoLink] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.photo_url ?? null);
  const hasRequestedCubidId = useRef(false);
  const latestProfileRef = useRef(profile);
  const previewObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    latestProfileRef.current = profile;
  }, [profile]);

  function updatePhotoPreview(value: string | null, isObjectUrl: boolean) {
    if (previewObjectUrl.current) {
      URL.revokeObjectURL(previewObjectUrl.current);
      previewObjectUrl.current = null;
    }
    if (isObjectUrl && value) {
      previewObjectUrl.current = value;
    }
    setPhotoPreview(value);
  }

  useEffect(() => {
    setForm((prev) => ({
      displayName: profile?.display_name ?? "",
      photoUrl: profile?.photo_url ?? "",
      cubidId: profile?.cubid_id ?? prev.cubidId ?? initialCubidId,
    }));
    if (profile?.photo_url) {
      updatePhotoPreview(profile.photo_url, false);
    }
  }, [initialCubidId, profile?.cubid_id, profile?.display_name, profile?.photo_url]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl.current) {
        URL.revokeObjectURL(previewObjectUrl.current);
        previewObjectUrl.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !session?.user?.email) {
      return;
    }
    if (profile?.cubid_id || hasRequestedCubidId.current) {
      return;
    }

    hasRequestedCubidId.current = true;
    requestCubidId(session.user.email)
      .then((cubid) => {
        if (latestProfileRef.current?.cubid_id) {
          return;
        }
        setForm((prev) => ({ ...prev, cubidId: cubid }));
        setStatus("Cubid ID prepared");
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to generate Cubid ID";
        setError(message);
      });
  }, [profile?.cubid_id, ready, session?.user?.email]);

  if (!ready) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Loading your onboarding flow…</h1>
        <p className="text-sm text-muted-foreground">Hold tight while we confirm your session.</p>
      </section>
    );
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

  function handleNameNext(event: FormEvent) {
    event.preventDefault();
    if (!form.displayName.trim()) {
      setError("Please share your name to continue");
      return;
    }
    setError(null);
    setStatus(null);
    setStep(1);
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPhotoFile(file);
    updatePhotoPreview(URL.createObjectURL(file), true);
    setPhotoLink("");
  }

  async function uploadPhotoFromLinkOrFile() {
    if (!session?.user?.id) {
      throw new Error("Missing session information");
    }
    const supabase = getSupabaseClient();
    let fileToUpload: File;

    if (photoFile) {
      fileToUpload = photoFile;
    } else if (photoLink) {
      const response = await fetch(photoLink);
      if (!response.ok) {
        throw new Error("We couldn't fetch that image link");
      }
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const extension = inferExtensionFromSource(photoLink, contentType);
      const blob = await response.blob();
      fileToUpload = new File([blob], `linked.${extension}`, { type: contentType });
    } else if (form.photoUrl) {
      // Existing profile photo already stored in Supabase.
      setStatus("Photo ready");
      return;
    } else {
      throw new Error("Please add a photo before continuing");
    }

    const extension = fileToUpload.name.split(".").pop() ?? "jpg";
    const sanitizedCubid = form.cubidId.replace(/[^a-z0-9_]/gi, "");
    const storagePath = `${sanitizedCubid || session.user.id}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(storagePath, fileToUpload, {
        upsert: true,
        contentType: fileToUpload.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-pictures").getPublicUrl(storagePath);

    setForm((prev) => ({ ...prev, photoUrl: publicUrl }));
    updatePhotoPreview(publicUrl, false);
    setStatus("Photo uploaded");
  }

  async function handlePhotoNext(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setError(null);
    setStatus("Uploading photo…");
    setUploadingPhoto(true);
    try {
      await uploadPhotoFromLinkOrFile();
      setStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : "We couldn't save your photo";
      setError(message);
      setStatus(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleComplete(event: FormEvent) {
    await handleSubmit(event);
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Welcome to Trust Me Bro</h1>
        <p className="text-muted-foreground">
          We'll gather a few details to build your profile: your name, a photo, and your wallet.
        </p>
      </header>

      <nav aria-label="Onboarding progress">
        <ol className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          {(["Name", "Photo", "Wallet"] as const).map((label, index, array) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={`flex items-center ${
                step === index
                  ? "font-semibold text-blue-600"
                  : index < step
                    ? "text-blue-600"
                    : ""
              }`}
            >
              <span>{label}</span>
              {index < array.length - 1 ? (
                <span aria-hidden="true" className="px-1 text-muted-foreground">
                  ›
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 ? (
        <form className="space-y-6" onSubmit={handleNameNext}>
          <label className="flex flex-col gap-3">
            <span className="text-2xl font-medium">What's your name?</span>
            <input
              autoFocus
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-6 text-2xl shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              placeholder="Casey Rivers"
              value={form.displayName}
            />
          </label>
          <div className="flex justify-end">
            <button
              className="rounded-full bg-black px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
              disabled={!session || !form.displayName.trim()}
              type="submit"
            >
              Next
            </button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <form className="space-y-6" onSubmit={handlePhotoNext}>
          <div className="space-y-3">
            <p className="text-2xl font-medium">Share a photo</p>
            <p className="text-sm text-muted-foreground">
              Upload a file or paste a link to an image. We'll store it securely for your profile.
            </p>
            <div className="flex flex-col gap-4 rounded-lg border border-dashed border-neutral-300 p-6 dark:border-neutral-700">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Upload a photo
                <input
                  accept="image/*"
                  className="rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                  onChange={handleFileSelection}
                  type="file"
                />
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                <label className="flex-1 text-sm font-medium">
                  <span className="sr-only">Photo link</span>
                  <input
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-base shadow-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                    onChange={(event) => {
                      setPhotoLink(event.target.value);
                      setPhotoFile(null);
                    }}
                    placeholder="https://example.com/avatar.png"
                    value={photoLink}
                  />
                </label>
              </div>
              {photoPreview ? (
                <figure className="flex flex-col items-start gap-2">
                  <figcaption className="text-xs uppercase text-muted-foreground">Preview</figcaption>
                  <img alt="Profile preview" className="h-40 w-40 rounded-full object-cover" src={photoPreview} />
                </figure>
              ) : null}
            </div>
          </div>
          <div className="flex justify-between">
            <button
              className="rounded-full border border-neutral-300 px-8 py-3 text-lg font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              onClick={() => {
                setStatus(null);
                setError(null);
                setStep(0);
              }}
              type="button"
            >
              Back
            </button>
            <button
              className="rounded-full bg-black px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
              disabled={!session || uploadingPhoto || (!photoFile && !photoLink && !form.photoUrl)}
              type="submit"
            >
              {uploadingPhoto ? "Saving…" : "Next"}
            </button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form className="space-y-6" onSubmit={handleComplete}>
          <div className="space-y-3">
            <p className="text-2xl font-medium">Connect your wallet</p>
            <p className="text-sm text-muted-foreground">
              Link the wallet you'll use for vouching. Once connected, we'll confirm your Cubid ID.
            </p>
            <div className="rounded-lg border border-neutral-200 p-6 shadow-sm dark:border-neutral-800">
              <button
                className="rounded bg-black px-4 py-2 text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
                disabled={!session || saving}
                onClick={handleConnectWallet}
                type="button"
              >
                {walletAddress ? "Reconnect wallet" : "Connect wallet"}
              </button>
              {walletAddress ? (
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-neutral-600 dark:text-neutral-300">Wallet address</dt>
                    <dd className="break-all font-mono">{walletAddress}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-600 dark:text-neutral-300">Cubid ID</dt>
                    <dd>
                      <input
                        className="w-full cursor-not-allowed rounded border border-neutral-300 bg-neutral-100 px-3 py-2 text-base text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                        readOnly
                        value={form.cubidId}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Generated automatically from your email. Keep this handy for support.
                      </p>
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </div>
          <div className="flex justify-between">
            <button
              className="rounded-full border border-neutral-300 px-8 py-3 text-lg font-semibold transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              onClick={() => {
                setStatus(null);
                setError(null);
                setStep(1);
              }}
              type="button"
            >
              Back
            </button>
            <button
              className="rounded-full bg-blue-600 px-8 py-3 text-lg font-semibold text-white shadow transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!session || saving || !walletAddress || !form.displayName || !form.photoUrl || !isValidCubidId(form.cubidId)}
              type="submit"
            >
              {saving ? "Finishing…" : "Finish"}
            </button>
          </div>
        </form>
      ) : null}

      {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}

function inferExtensionFromSource(source: string, contentType: string): string {
  const urlExtension = source.split("?")[0]?.split(".").pop();
  if (urlExtension && /^[a-z0-9]+$/i.test(urlExtension)) {
    return urlExtension;
  }
  const mimeExtension = contentType.split("/")[1]?.split(";")[0]?.trim();
  if (mimeExtension) {
    return mimeExtension;
  }
  return "jpg";
}
