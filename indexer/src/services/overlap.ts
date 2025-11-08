import { LRUCache } from 'lru-cache';

import { AttestationRecord, getDatabase, IndexerDatabase } from '../db';

export interface OverlapRequest {
  viewerCubid: string;
  targetCubid: string;
}

export interface OverlapResult {
  issuer: string;
  trustLevel: number;
  circle: string | null;
  freshnessSeconds: number;
}

export interface ComputeOverlapOptions {
  database?: IndexerDatabase;
  now?: number;
}

const overlapCache = new LRUCache<string, OverlapResult[]>({ max: 1_000, ttl: 120_000 });

function toHexCircle(circle: AttestationRecord['circle']): string | null {
  if (!circle) {
    return null;
  }

  const hex = circle.toString('hex');
  if (!hex) {
    return null;
  }

  return `0x${hex}`;
}

export function clearOverlapCache(): void {
  overlapCache.clear();
}

export async function computeOverlap(
  req: OverlapRequest,
  options: ComputeOverlapOptions = {},
): Promise<OverlapResult[]> {
  const cacheKey = `${req.viewerCubid}|${req.targetCubid}`;

  if (!options.database) {
    const cached = overlapCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const database = options.database ?? getDatabase();
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);

  const viewerAttestations = database.listAttestationsForCubid(req.viewerCubid);
  const trustedIssuers = new Set(viewerAttestations.map((attn) => attn.issuer.toLowerCase()));

  const targetAttestations = database.listAttestationsForCubid(req.targetCubid);

  const overlaps = targetAttestations
    .filter((attn) => trustedIssuers.has(attn.issuer.toLowerCase()))
    .filter((attn) => attn.expiry === 0 || nowSeconds <= attn.expiry)
    .map<OverlapResult>((attn) => ({
      issuer: attn.issuer,
      trustLevel: attn.trustLevel,
      circle: toHexCircle(attn.circle),
      freshnessSeconds: Math.max(0, nowSeconds - attn.blockTime),
    }))
    .sort((a, b) => a.freshnessSeconds - b.freshnessSeconds);

  if (!options.database) {
    overlapCache.set(cacheKey, overlaps);
  }

  return overlaps;
}
