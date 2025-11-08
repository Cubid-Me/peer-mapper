"use client";

import { useState } from "react";

export default function QRScanner() {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded border border-gray-300/70 bg-transparent p-3 text-base"
        rows={4}
        placeholder="Paste QR payload"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        disabled={!value}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        Verify
      </button>
    </div>
  );
}
