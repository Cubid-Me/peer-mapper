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

export async function computeOverlap(_req: OverlapRequest): Promise<OverlapResult[]> {
  // Placeholder implementation; will hook into DB + PSI result set later.
  return [];
}
