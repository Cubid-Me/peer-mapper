"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import QRDisplay from "@/components/QRDisplay";
import QRScanner from "@/components/QRScanner";
import { requestQrChallenge, verifyQrChallenge } from "@/lib/api";
import { useScanStore } from "@/lib/scanStore";
import { useUserStore } from "@/lib/store";
import { ensureWallet } from "@/lib/wallet";

type ParsedQrPayload = {
  cubidId: string;
  address?: string;
};

export default function ScanPage() {
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

  const myQrPayload = useMemo(() => ({ cubidId: profile?.cubid_id ?? "", ts: Date.now() }), [profile?.cubid_id]);

  function parseQrPayload(): ParsedQrPayload {
    if (!rawQr.trim()) {
      throw new Error("Paste a QR payload first");
    }
    const payload = JSON.parse(rawQr) as ParsedQrPayload;
    if (!payload.cubidId) {
      throw new Error("QR payload missing cubidId");
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
    if (!parsed || !challenge || !viewerSignature) {
      setError("Complete the challenge flow first");
      return;
    }
    if (!profile?.cubid_id) {
      setError("Complete onboarding to access scan results");
      return;
    }
    if (!session?.access_token) {
      setError("Supabase session required");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(targetAddress)) {
      setError("Target address must be a 0x-prefixed address");
      return;
    }
    if (!targetSignature) {
      setError("Target signature required");
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

      setResult({
        targetCubid: parsed.cubidId,
        viewerCubid: profile.cubid_id,
        challengeId: result.challengeId,
        expiresAt: result.expiresAt,
        overlaps: result.overlaps,
        verifiedAt: Date.now(),
      });
      setStatus("Overlap ready");
      router.push("/results");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify challenge";
      setError(message);
      setStatus(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Scan & verify</h1>
        <p className="text-muted-foreground">
          Share your Cubid QR with your peer, issue a joint challenge, sign it with both wallets, and reveal shared trust.
        </p>
      </header>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">My QR</h2>
        <QRDisplay payload={myQrPayload} />
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Scan peer QR</h2>
        <QRScanner />
        <textarea
          className="w-full rounded border border-gray-300/70 bg-transparent p-3 text-base"
          rows={3}
          placeholder='Paste JSON like {"cubidId":"friend","address":"0x..."}'
          value={rawQr}
          onChange={(event) => setRawQr(event.target.value)}
        />
        <button
          className="rounded bg-black px-4 py-2 text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-60"
          onClick={handleParse}
          type="button"
        >
          Parse QR payload
        </button>
      </div>

      {parsed ? (
        <div className="space-y-2 rounded border border-neutral-300 p-3 text-sm shadow-sm dark:border-neutral-700">
          <p className="font-medium">Target Cubid: {parsed.cubidId}</p>
          <button
            className="rounded border border-neutral-400 px-3 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            onClick={handleChallenge}
            type="button"
          >
            Issue challenge
          </button>
        </div>
      ) : null}

      {challenge ? (
        <div className="space-y-3 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
          <p className="font-medium">Challenge ID: {challenge.id}</p>
          <p className="break-all text-xs">{challenge.value}</p>
          <button
            className="rounded border border-blue-400 px-3 py-2 text-sm font-medium transition hover:bg-blue-100 dark:border-blue-600 dark:hover:bg-blue-900"
            onClick={handleSignChallenge}
            type="button"
          >
            Sign as viewer
          </button>
        </div>
      ) : null}

      {challenge ? (
        <form className="space-y-3" onSubmit={handleVerify}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Target wallet address
            <input
              value={targetAddress}
              onChange={(event) => setTargetAddress(event.target.value)}
              className="w-full rounded border border-gray-400/40 bg-transparent px-4 py-2 text-base"
              placeholder="0x…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Target signature
            <textarea
              value={targetSignature}
              onChange={(event) => setTargetSignature(event.target.value)}
              className="w-full rounded border border-gray-400/40 bg-transparent p-3 text-base"
              rows={3}
              placeholder="0x…"
            />
          </label>
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
            disabled={!viewerSignature}
            type="submit"
          >
            Verify overlap
          </button>
        </form>
      ) : null}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
