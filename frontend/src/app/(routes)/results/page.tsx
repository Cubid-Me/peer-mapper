"use client";

import Badge from "@/components/Badge";
import { useScanStore } from "@/lib/scanStore";

function formatFreshness(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export default function ResultsPage() {
  const result = useScanStore((state) => state.lastResult);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">Trusted overlaps</h1>
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You ({result.viewerCubid}) and {result.targetCubid} share {result.overlaps.length} trusted {result.overlaps.length === 1 ? "issuer" : "issuers"}.
          </p>
          <div className="space-y-2">
            {result.overlaps.map((item) => (
              <Badge
                key={`${item.issuer}-${item.trustLevel}-${item.circle ?? "none"}`}
                issuer={item.issuer}
                trustLevel={String(item.trustLevel)}
                circle={item.circle ?? null}
                freshness={formatFreshness(item.freshnessSeconds)}
              />
            ))}
            {result.overlaps.length === 0 ? <p className="text-sm text-muted-foreground">No overlaps discovered.</p> : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Complete a QR verification to view overlaps.</p>
      )}
    </section>
  );
}
