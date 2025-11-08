"use client";

import { useMemo } from "react";

export default function QRDisplay({ payload }: { payload?: Record<string, unknown> }) {
  const text = useMemo(() => JSON.stringify(payload ?? { cubidId: "demo", ts: Date.now() }), [payload]);
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-gray-300 p-4">
      <span className="text-sm uppercase tracking-widest text-gray-500">QR payload</span>
      <code className="text-sm">{text}</code>
    </div>
  );
}
