"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import QRDisplay from "@/components/QRDisplay";
import { useUserStore } from "@/lib/store";

export default function MyQrPage() {
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);

  const [timestamp, setTimestamp] = useState(() => Date.now());

  useEffect(() => {
    setTimestamp(Date.now());
  }, [profile?.cubid_id]);

  const payload = useMemo(
    () => ({ cubidId: profile?.cubid_id ?? "", ts: timestamp }),
    [profile?.cubid_id, timestamp],
  );

  if (!session) {
    return (
      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-200 shadow-lg shadow-sky-900/30">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-50">Share your QR once you’re signed in</h1>
          <p className="text-sm text-slate-300/80">
            Generate a Cubid QR only after authenticating. That way, every handshake originates from a trusted session.
          </p>
        </header>
        <Link
          className="inline-flex items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-sky-100 shadow-lg shadow-sky-500/20 transition hover:border-sky-300 hover:bg-sky-500/30"
          href="/signin"
        >
          Sign in to continue
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/80">My QR</span>
        <h1 className="text-3xl font-semibold text-slate-50">Let your peer scan this Cubid handshake</h1>
        <p className="max-w-2xl text-sm text-slate-300/90">
          Every payload embeds your Cubid ID and a fresh timestamp. Share it face to face, or send it through a trusted channel
          and ask your peer to scan it before it expires.
        </p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12">
        <div className="flex-1 rounded-3xl border border-slate-700/50 bg-slate-900/50 p-6 shadow-lg shadow-black/40">
          <QRDisplay payload={payload} />
        </div>
        <div className="max-w-sm space-y-4 text-sm text-slate-200">
          <p>
            <strong className="text-slate-50">Need onboarding?</strong> Make sure your profile carries a Cubid ID so peers can
            locate you instantly.
          </p>
          <ul className="space-y-2 text-slate-300/90">
            <li>• Confirm the face in front of you matches the profile before sharing.</li>
            <li>• Remind them the challenge expires after ninety seconds to keep the loop private.</li>
            <li>• If your Cubid ID updates, refresh this page to issue a brand-new QR.</li>
          </ul>
          <Link className="text-sm font-semibold text-sky-200 underline-offset-4 hover:underline" href="/profile">
            Update my profile details
          </Link>
        </div>
      </div>
    </section>
  );
}
