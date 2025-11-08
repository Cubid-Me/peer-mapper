"use client";

import { useMemo, useState } from "react";

import QRDisplay from "@/components/QRDisplay";
import { isValidCubidId } from "@/lib/cubid";

export default function VouchPage() {
  const [cubid, setCubid] = useState("");
  const valid = isValidCubidId(cubid);
  const payload = useMemo(() => ({ cubidId: cubid || "cubid_demo", ts: Date.now() }), [cubid]);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Vouch for a peer</h1>
      <input
        value={cubid}
        onChange={(event) => setCubid(event.target.value)}
        className="w-full rounded border border-gray-400/40 bg-transparent px-4 py-2 text-base"
        placeholder="cubid_demo"
      />
      <button disabled={!valid} className="rounded bg-primary/90 px-4 py-2 text-white disabled:opacity-50">
        Prepare attestation
      </button>
      <QRDisplay payload={payload} />
    </section>
  );
}
