"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import QRDisplay from "@/components/QRDisplay";
import { subscribeToHandshake } from "@/lib/handshake";
import { useScanStore } from "@/lib/scanStore";
import { useUserStore } from "@/lib/store";

function createHandshakeChannel(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function MyQrPage() {
  const router = useRouter();
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);
  const setResult = useScanStore((state) => state.setResult);

  const [timestamp, setTimestamp] = useState(() => Date.now());
  const [handshakeChannel, setHandshakeChannel] = useState(createHandshakeChannel);
  const [handshakeMessage, setHandshakeMessage] = useState<string | null>(null);

  useEffect(() => {
    setTimestamp(Date.now());
  }, [profile?.cubid_id]);

  useEffect(() => {
    setHandshakeMessage(null);
    setHandshakeChannel(createHandshakeChannel());
  }, [timestamp]);

  const payload = useMemo(
    () => ({ cubidId: profile?.cubid_id ?? "", ts: timestamp, channel: handshakeChannel }),
    [profile?.cubid_id, timestamp, handshakeChannel],
  );

  useEffect(() => {
    if (!profile?.cubid_id) {
      return undefined;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        unsubscribe = await subscribeToHandshake(handshakeChannel, (payload) => {
          if (!active) {
            return;
          }
          if (payload.targetCubid !== profile.cubid_id) {
            return;
          }
          setResult({
            targetCubid: payload.targetCubid,
            viewerCubid: payload.viewerCubid,
            challengeId: payload.challengeId,
            expiresAt: payload.expiresAt,
            overlaps: payload.overlaps,
            verifiedAt: Date.now(),
          });
          setHandshakeMessage("Handshake completed—opening shared overlaps…");
          router.push("/results");
        });
      } catch {
        if (!active) return;
        setHandshakeMessage("We couldn’t watch for handshake updates. Refresh and try again.");
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [handshakeChannel, profile?.cubid_id, router, setResult]);

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

  const displayName = profile?.display_name?.trim() || "Your chosen name";

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-slate-700/50 bg-slate-900/60 p-8 text-center text-slate-100 shadow-lg shadow-black/40">
          <QRDisplay
            caption="Scan this within ninety seconds to stay in sync."
            payload={payload}
            size={320}
          />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-50">{displayName}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Trust Me Bro</p>
            <p className="text-sm text-slate-300">Cubid ID: {profile?.cubid_id ?? "—"}</p>
          </div>
          {handshakeMessage ? (
            <p className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100">
              {handshakeMessage}
            </p>
          ) : null}
        </div>
        <div className="max-w-xl space-y-4 text-left text-sm text-slate-200">
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
