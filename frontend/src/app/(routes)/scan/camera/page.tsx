"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import QRScanner from "@/components/QRScanner";
import { requestQrChallenge, verifyQrChallenge } from "@/lib/api";
import { type HandshakeCompletion, notifyHandshakeComplete } from "@/lib/handshake";
import { useScanStore } from "@/lib/scanStore";
import { useUserStore } from "@/lib/store";
import { ensureWallet } from "@/lib/wallet";

type ParsedQrPayload = {
  cubidId: string;
  channel: string;
  address?: string;
};

export default function CameraPage() {
  const router = useRouter();
  const session = useUserStore((state) => state.session);
  const profile = useUserStore((state) => state.user);
  const walletAddress = useUserStore((state) => state.walletAddress ?? state.user?.evm_address ?? null);
  const setWalletAddress = useUserStore((state) => state.setWalletAddress);
  const setResult = useScanStore((state) => state.setResult);

  const [rawQr, setRawQr] = useState("");
  const [parsed, setParsed] = useState<ParsedQrPayload | null>(null);
  const [challenge, setChallenge] = useState<{ id: string; value: string } | null>(null);
  const [viewerSignature, setViewerSignature] = useState<string | null>(null);
  const [targetAddress, setTargetAddress] = useState("");
  const [targetSignature, setTargetSignature] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parseQrPayload(): ParsedQrPayload {
    if (!rawQr.trim()) {
      throw new Error("Paste a QR payload first");
    }
    const payload = JSON.parse(rawQr) as ParsedQrPayload;
    if (!payload.cubidId) {
      throw new Error("QR payload missing cubidId");
    }
    if (!payload.channel) {
      throw new Error("QR payload missing channel");
    }
    return payload;
  }

  async function handleParse() {
    try {
      const payload = parseQrPayload();
      setParsed(payload);
      setTargetAddress(payload.address ?? "");
      setStatus("QR payload parsed");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid QR payload";
      setError(message);
      setStatus(null);
      setParsed(null);
    }
  }

  async function handleChallenge() {
    if (!parsed) {
      setError("Parse a QR payload first");
      return;
    }
    if (!session?.access_token) {
      setError("Supabase session required");
      return;
    }
    setStatus("Requesting challenge…");
    setError(null);
    try {
      const result = await requestQrChallenge(parsed.cubidId, session.access_token);
      setChallenge({ id: result.challengeId, value: result.challenge });
      setStatus("Challenge issued. Share it with your peer to sign.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to request challenge";
      setError(message);
      setStatus(null);
      setChallenge(null);
    }
  }

  async function handleSignChallenge() {
    if (!challenge) {
      setError("Issue a challenge first");
      return;
    }
    setStatus("Requesting wallet signature…");
    setError(null);
    try {
      const address = walletAddress ?? (await ensureWallet());
      if (!address) {
        throw new Error("Wallet unavailable");
      }
      setWalletAddress(address);

      const ethereum = (window as typeof window & {
        ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<string> };
      }).ethereum;
      if (!ethereum) {
        throw new Error("Wallet provider missing");
      }

      const signature = await ethereum.request({
        method: "personal_sign",
        params: [challenge.value, address],
      });

      setViewerSignature(signature);
      setStatus("Viewer signature captured");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign challenge";
      setError(message);
      setStatus(null);
      setViewerSignature(null);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();

    if (!session?.access_token) {
      setError("Supabase session required");
      return;
    }
    if (!profile?.cubid_id) {
      setError("Viewer Cubid ID missing");
      return;
    }
    if (!challenge || !parsed) {
      setError("Challenge not ready");
      return;
    }
    if (!viewerSignature) {
      setError("Viewer signature missing");
      return;
    }

    setStatus("Verifying overlap…");
    setError(null);

    try {
      const viewerAddr = walletAddress ?? (await ensureWallet());
      if (!viewerAddr) {
        throw new Error("Wallet unavailable");
      }
      setWalletAddress(viewerAddr);

      const result = await verifyQrChallenge(
        {
          challengeId: challenge.id,
          challenge: challenge.value,
          viewer: { cubidId: profile.cubid_id, address: viewerAddr, signature: viewerSignature },
          target: { cubidId: parsed.cubidId, address: targetAddress, signature: targetSignature },
        },
        session.access_token,
      );

      const completion: HandshakeCompletion = {
        channel: parsed.channel,
        targetCubid: parsed.cubidId,
        viewerCubid: profile.cubid_id,
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
        overlaps: result.overlaps,
      };

      setResult({
        targetCubid: completion.targetCubid,
        viewerCubid: completion.viewerCubid,
        challengeId: completion.challengeId,
        expiresAt: completion.expiresAt,
        overlaps: completion.overlaps,
        verifiedAt: Date.now(),
      });
      setStatus("Sharing overlaps with your peer…");

      try {
        await notifyHandshakeComplete(completion);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to notify peer of handshake";
        setError(message);
        setStatus(null);
        return;
      }

      router.push("/results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify challenge";
      setError(message);
      setStatus(null);
    }
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400/80">Camera mode</span>
        <h1 className="text-3xl font-semibold text-slate-50">Scan a peer and finish the handshake</h1>
        <p className="max-w-2xl text-sm text-slate-300/90">
          Point your camera at their Cubid QR or paste the JSON payload directly. Once both sides sign the temporary challenge,
          we’ll surface the overlap from EAS.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4 rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-lg shadow-black/40">
          <QRScanner />
          <p className="text-sm text-slate-300/90">
            Allow camera access so we can scan Cubid QR codes directly. We prioritise the rear camera on mobile to keep codes in focus.
          </p>
          <p className="text-xs text-slate-400">
            If the scan struggles, use the developer tools to paste a payload manually.
          </p>
        </div>

        <details className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-6 text-slate-200 shadow-lg shadow-black/40">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
            For devs only
          </summary>
          <div className="mt-5 space-y-6">
            <p className="text-sm text-slate-300/90">
              Manual challenge flow helpers live here so the production scan stays clean.
            </p>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4 rounded-3xl border border-slate-700/50 bg-slate-900/50 p-6 shadow-inner shadow-black/40">
                <textarea
                  className="w-full rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/70 focus:outline-none"
                  rows={3}
                  placeholder='Paste JSON like {"cubidId":"friend","channel":"uuid","address":"0x..."}'
                  value={rawQr}
                  onChange={(event) => setRawQr(event.target.value)}
                />
                <button
                  className="w-full rounded-full border border-sky-400/50 bg-sky-500/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-sky-100 shadow-lg shadow-sky-900/40 transition hover:border-sky-300 hover:bg-sky-500/30"
                  onClick={handleParse}
                  type="button"
                >
                  Parse QR payload
                </button>
              </div>

              <div className="space-y-5">
                {parsed ? (
                  <div className="space-y-3 rounded-3xl border border-slate-700/60 bg-slate-900/60 p-5 text-sm text-slate-200 shadow-inner shadow-black/40">
                    <p className="font-medium text-slate-50">Target Cubid: {parsed.cubidId}</p>
                    <button
                      className="rounded-full border border-slate-600/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-sky-400/60 hover:text-sky-200"
                      onClick={handleChallenge}
                      type="button"
                    >
                      Issue challenge
                    </button>
                  </div>
                ) : null}

                {challenge ? (
                  <div className="space-y-3 rounded-3xl border border-sky-500/40 bg-sky-500/10 p-5 text-sm text-sky-100 shadow-lg shadow-sky-900/40">
                    <p className="font-medium">Challenge ID: {challenge.id}</p>
                    <p className="break-all text-xs text-sky-200/80">{challenge.value}</p>
                    <button
                      className="rounded-full border border-sky-400/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-100 transition hover:border-sky-300 hover:text-sky-50"
                      onClick={handleSignChallenge}
                      type="button"
                    >
                      Sign as viewer
                    </button>
                  </div>
                ) : null}

                {challenge ? (
                  <form className="space-y-4 rounded-3xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-inner shadow-black/40" onSubmit={handleVerify}>
                    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Target wallet address
                      <input
                        value={targetAddress}
                        onChange={(event) => setTargetAddress(event.target.value)}
                        className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                        placeholder="0x…"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Target signature
                      <textarea
                        value={targetSignature}
                        onChange={(event) => setTargetSignature(event.target.value)}
                        className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 p-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                        rows={3}
                        placeholder="0x…"
                      />
                    </label>
                    <button
                      className="w-full rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow-lg shadow-emerald-900/30 transition hover:border-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60"
                      disabled={!viewerSignature}
                      type="submit"
                    >
                      Verify overlap
                    </button>
                  </form>
                ) : null}

                {status ? <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{status}</p> : null}
                {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
