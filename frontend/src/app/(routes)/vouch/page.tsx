"use client";

import { useMemo, useState } from "react";

import QRDisplay from "@/components/QRDisplay";
import { prepareAttestation, relayAttestation } from "@/lib/api";
import { isValidCubidId } from "@/lib/cubid";
import { useRequireCompletedOnboarding } from "@/lib/onboarding";
import { useUserStore } from "@/lib/store";
import { ensureWallet } from "@/lib/wallet";

export default function VouchPage() {
  const { ready } = useRequireCompletedOnboarding();
  const [cubid, setCubid] = useState("");
  const [recipient, setRecipient] = useState("");
  const [trustLevel, setTrustLevel] = useState(3);
  const [human, setHuman] = useState(true);
  const [circle, setCircle] = useState("");
  const [expiry, setExpiry] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareAttestation>> | null>(null);
  const [relayResult, setRelayResult] = useState<Awaited<ReturnType<typeof relayAttestation>> | null>(null);

  const setWalletAddress = useUserStore((state) => state.setWalletAddress);
  const walletAddress = useUserStore((state) => state.walletAddress ?? state.user?.evm_address ?? null);

  const valid = isValidCubidId(cubid);
  const payload = useMemo(() => ({ cubidId: cubid || "cubid_demo", ts: Date.now() }), [cubid]);

  if (!ready) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Preparing attestation tools…</h1>
        <p className="text-sm text-muted-foreground">Confirming your onboarding status.</p>
      </section>
    );
  }

  function normaliseCircle(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      return trimmed;
    }
    throw new Error("Circle must be a 0x-prefixed 32-byte hex string");
  }

  async function handlePrepare() {
    setError(null);
    setStatus("Preparing attestation…");
    setRelayResult(null);
    try {
      const issuer = await ensureWallet();
      setWalletAddress(issuer);
      if (!isValidCubidId(cubid)) {
        throw new Error("Enter a valid Cubid ID");
      }
      if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
        throw new Error("Recipient wallet must be a 0x-prefixed address");
      }

      const expiryValue = (() => {
        if (!expiry) return 0;
        const expiryNum = Number(expiry);
        if (isNaN(expiryNum) || expiryNum < 0) {
          throw new Error("Expiry must be a non-negative number");
        }
        return expiryNum;
      })();

      const response = await prepareAttestation({
        issuer,
        recipient,
        cubidId: cubid,
        trustLevel,
        human,
        circle: normaliseCircle(circle),
        issuedAt: Math.floor(Date.now() / 1000),
        expiry: expiryValue,
      });

      setPrepared(response);
      setStatus(response.meta.fee.required ? "Signature ready — lifetime fee required" : "Signature ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to prepare attestation";
      setError(message);
      setStatus(null);
      setPrepared(null);
    }
  }

  async function handleRelay() {
    if (!prepared) {
      setError("Prepare the attestation first");
      return;
    }
    setStatus("Awaiting wallet signature…");
    setError(null);
    try {
      const issuer = walletAddress ?? (await ensureWallet());
      if (!issuer) {
        throw new Error("Wallet unavailable");
      }

      const ethereum = (window as typeof window & {
        ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<string> };
      }).ethereum;
      if (!ethereum) {
        throw new Error("Wallet provider missing");
      }

      const signature = await ethereum.request({
        method: "eth_signTypedData_v4",
        params: [issuer, JSON.stringify(prepared.typedData)],
      });

      const result = await relayAttestation({
        issuer,
        signature,
        value: prepared.meta.fee.required ? prepared.meta.fee.amount : "0",
        payload: prepared.typedData.message,
      });

      setRelayResult(result);
      setStatus("Attestation relayed to FeeGate");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to relay attestation";
      setError(message);
      setStatus(null);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Vouch for a peer</h1>
      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Cubid ID
          <input
            value={cubid}
            onChange={(event) => setCubid(event.target.value)}
            className="w-full rounded border border-gray-400/40 bg-transparent px-4 py-2 text-base"
            placeholder="cubid_demo"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Recipient wallet
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="w-full rounded border border-gray-400/40 bg-transparent px-4 py-2 text-base"
            placeholder="0x…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Trust level ({trustLevel})
          <input type="range" min={0} max={7} value={trustLevel} onChange={(event) => setTrustLevel(Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input checked={human} onChange={(event) => setHuman(event.target.checked)} type="checkbox" /> Human verified
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Circle (bytes32 hex)
          <input
            value={circle}
            onChange={(event) => setCircle(event.target.value)}
            className="w-full rounded border border-gray-400/40 bg-transparent px-4 py-2 text-base"
            placeholder="0x0000…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Expiry (unix seconds, optional)
          <input
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            className="w-full rounded border border-gray-400/40 bg-transparent px-4 py-2 text-base"
            placeholder="0"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          disabled={!valid || !recipient}
          onClick={handlePrepare}
          className="rounded bg-primary/90 px-4 py-2 text-white disabled:opacity-50"
          type="button"
        >
          Prepare attestation
        </button>
        <button
          disabled={!prepared}
          onClick={handleRelay}
          className="rounded border border-gray-400/40 px-4 py-2 text-sm font-medium disabled:opacity-50"
          type="button"
        >
          Sign & relay
        </button>
      </div>

      {prepared ? (
        <div className="space-y-2 rounded border border-gray-300/60 p-3 text-sm shadow-sm dark:border-gray-700/60">
          <p className="font-medium">Signature payload ready</p>
          <p>Nonce: {prepared.meta.nonce}</p>
          <p>Lifetime fee: {prepared.meta.fee.required ? `${prepared.meta.fee.amount} wei required` : "not required"}</p>
        </div>
      ) : null}

      {relayResult ? (
        <div className="space-y-1 rounded border border-emerald-400/60 bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="font-medium">Relay accepted</p>
          <p>Tx hash: {relayResult.txHash}</p>
          <p>Status: {relayResult.status}</p>
        </div>
      ) : null}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <QRDisplay payload={payload} />
    </section>
  );
}
