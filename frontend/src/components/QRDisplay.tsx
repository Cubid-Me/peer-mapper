"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";

type QRDisplayProps = {
  payload?: Record<string, unknown>;
  caption?: string;
  size?: number;
};

export default function QRDisplay({ payload, caption, size = 288 }: QRDisplayProps) {
  const text = useMemo(
    () => JSON.stringify(payload ?? { cubidId: "demo", ts: Date.now() }),
    [payload],
  );

  return (
    <figure className="flex flex-col items-center gap-4 text-center">
      <span className="inline-flex rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/40">
        <QRCodeSVG
          aria-label={caption ?? "QR code"}
          role="img"
          includeMargin
          size={size}
          value={text}
          className="h-auto w-auto max-w-full"
        />
      </span>
      {caption ? (
        <figcaption className="text-sm font-medium text-slate-200">
          {caption}
        </figcaption>
      ) : null}
      <code className="max-w-full break-words rounded-2xl border border-dashed border-slate-600/60 bg-slate-900/40 px-4 py-2 text-xs text-slate-300">
        {text}
      </code>
    </figure>
  );
}
