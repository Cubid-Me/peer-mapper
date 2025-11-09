"use client";

import Link from "next/link";

import { useUserStore } from "../lib/store";

const HIGHLIGHTS = [
  {
    title: "Prove people are known, not anonymous",
    description:
      "Trust Me Bro connects Supabase auth, Cubid IDs, and Ethereum attestations so you can verify that the human in front of you is vouched for by people you already trust.",
  },
  {
    title: "QR handshakes in under a minute",
    description:
      "Trade a time-limited QR code, exchange wallet-backed challenges, and reveal only the mutual contacts you both rely on—nothing more.",
  },
  {
    title: "Built on Moonbeam for real-world intros",
    description:
      "Attestations flow through FeeGate and EAS, letting you issue two complimentary proofs before paying a lifetime fee for heavier use.",
  },
];

const JOURNEY_STEPS = [
  {
    label: "1. Sign in",
    description: "Request a Supabase magic link and create your trusted profile in moments.",
  },
  {
    label: "2. Vouch",
    description: "Record who you trust, the strength of that trust, and why the relationship matters.",
  },
  {
    label: "3. Verify",
    description: "Scan a peer’s code, co-sign a challenge, and see overlaps without leaking your full contact list.",
  },
];

const QUICK_ACTIONS = [
  {
    href: "/scan/my-qr",
    title: "Share your QR",
    description: "Let a peer scan your Cubid ID. Handshakes expire fast, so they stay private by design.",
  },
  {
    href: "/scan/camera",
    title: "Open camera",
    description: "Capture their QR, collect wallet signatures, and verify your mutual trusted contacts.",
  },
  {
    href: "/circle",
    title: "Review my circle",
    description: "See who vouched for you, who you vouched for, and whether trust needs refreshing.",
  },
  {
    href: "/vouch",
    title: "Issue a new attestation",
    description: "Record a fresh connection with trust level, circle tag, and expiry in one flow.",
  },
];

const ctaClassName =
  "inline-flex items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-sky-100 shadow-lg shadow-sky-500/20 transition hover:border-sky-300 hover:bg-sky-500/30";

export default function Home() {
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-10 shadow-xl shadow-sky-900/20 backdrop-blur">
          <div className="mb-6 flex flex-col gap-3 text-sky-200">
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-400/90">Trust Me Bro</span>
            <h1 className="text-4xl font-bold leading-tight text-slate-50 sm:text-5xl">
              Trust people faster with verifiable overlaps
            </h1>
            <p className="max-w-3xl text-lg text-slate-200/90">
              We help communities prove they truly know one another. Cubid IDs, wallet signatures, and Moonbeam attestations combine to reveal mutual trusted contacts—only when both sides agree.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link className={ctaClassName} href="/signin">
              Start verifying now
            </Link>
            <p className="text-sm text-slate-300/80">
              No passwords. Just a magic link and your trusted network.
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {HIGHLIGHTS.map((highlight) => (
            <article
              key={highlight.title}
              className="rounded-3xl border border-slate-700/50 bg-slate-900/40 p-6 shadow-lg shadow-black/40 transition hover:border-sky-400/50 hover:shadow-sky-900/40"
            >
              <h2 className="text-lg font-semibold text-slate-50">{highlight.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300/90">{highlight.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-700/40 bg-slate-950/60 p-8 shadow-inner shadow-black/50">
          <h2 className="text-xl font-semibold text-slate-50">How a verification unfolds</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {JOURNEY_STEPS.map((step) => (
              <li className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 text-slate-200" key={step.label}>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/80">{step.label}</span>
                <p className="mt-3 text-sm leading-relaxed text-slate-300/90">{step.description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex justify-center">
            <Link className={ctaClassName} href="/signin">
              Start verifying now
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <section className="rounded-3xl border border-sky-500/30 bg-slate-950/70 p-10 shadow-lg shadow-sky-900/40">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/80">Welcome back</span>
        <h1 className="mt-3 text-4xl font-bold text-slate-50">
          {profile?.display_name ?? profile?.cubid_id ?? session.user?.email ?? "Peer"}, let’s keep building trusted links
        </h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300/90">
          Your Supabase session stays warm so you can bounce between flows without friction. Dive straight into a QR handshake or update your circle whenever you need.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            className="group rounded-3xl border border-slate-700/50 bg-slate-900/50 p-6 shadow-lg shadow-black/40 transition hover:border-sky-400/60 hover:shadow-sky-900/40"
            href={action.href}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/70">{action.title}</span>
            <p className="mt-3 text-lg font-semibold text-slate-50">{action.description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-200 opacity-0 transition group-hover:opacity-100">
              Jump in
              <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
