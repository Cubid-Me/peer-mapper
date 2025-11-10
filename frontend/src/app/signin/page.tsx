"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { signInWithOtp } from "../../lib/auth";
import { hasCompletedOnboarding } from "../../lib/onboarding";
import { useUserStore } from "../../lib/store";

export default function SignInPage() {
  const router = useRouter();
  const session = useUserStore((state) => state.session);
  const walletProfiles = useUserStore((state) => state.walletProfiles);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    const destination = hasCompletedOnboarding(walletProfiles) ? "/circle" : "/new-user";
    router.push(destination);
  }, [router, session, walletProfiles]);

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

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Supabase session + Cubid linkage</h1>
        <p className="text-muted-foreground">
          Use a Supabase magic link to establish your session. Once signed in you&apos;ll be redirected to finish onboarding or to
          your circle.
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

      {status ? <p className="text-sm text-green-600 dark:text-green-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
