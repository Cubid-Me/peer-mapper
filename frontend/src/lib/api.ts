const apiUrl = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:4000";

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return (await res.json()) as T;
}

export interface ProfileAttestation {
  issuer: string;
  cubidId: string;
  trustLevel: number;
  human: boolean;
  circle: string | null;
  issuedAt: number;
  expiry: number;
  uid: string;
  freshnessSeconds: number;
}

export interface ProfileResponse {
  cubidId: string;
  inbound: ProfileAttestation[];
  outbound: ProfileAttestation[];
}

export async function getProfile(cubidId: string, options: { issuer?: string } = {}): Promise<ProfileResponse> {
  const url = new URL(`${apiUrl}/profile/${encodeURIComponent(cubidId)}`);
  if (options.issuer) {
    url.searchParams.set("issuer", options.issuer);
  }
  const res = await fetch(url.toString());
  return handleJson<ProfileResponse>(res);
}

export interface PrepareAttestationRequest {
  issuer: string;
  recipient: string;
  cubidId: string;
  trustLevel: number;
  human: boolean;
  circle?: string | null;
  issuedAt?: number;
  expiry?: number;
  refUID?: string;
  revocable?: boolean;
  expirationTime?: number;
}

export interface PrepareAttestationResponse {
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  meta: {
    nonce: string;
    nextCount: string;
    fee: { required: boolean; amount: string };
  };
}

export async function prepareAttestation(payload: PrepareAttestationRequest): Promise<PrepareAttestationResponse> {
  const res = await fetch(`${apiUrl}/attest/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      circle: payload.circle ?? undefined,
    }),
  });
  return handleJson<PrepareAttestationResponse>(res);
}

export interface RelayAttestationRequest {
  issuer: string;
  signature: string;
  value?: string;
  payload: Record<string, unknown>;
}

export interface RelayAttestationResponse {
  txHash: string;
  status: string;
  blockNumber?: string;
  gasUsed?: string;
}

export async function relayAttestation(payload: RelayAttestationRequest): Promise<RelayAttestationResponse> {
  const res = await fetch(`${apiUrl}/attest/relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleJson<RelayAttestationResponse>(res);
}

export interface QrChallengeResponse {
  challengeId: string;
  challenge: string;
  expiresAt: number;
  issuedFor: string;
}

export async function requestQrChallenge(issuedFor: string, accessToken: string): Promise<QrChallengeResponse> {
  const res = await fetch(`${apiUrl}/qr/challenge?issuedFor=${encodeURIComponent(issuedFor)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleJson<QrChallengeResponse>(res);
}

export interface VerifyQrPayload {
  challengeId: string;
  challenge: string;
  viewer: { cubidId: string; address: string; signature: string };
  target: { cubidId: string; address: string; signature: string };
}

export interface VerifyQrResponse {
  challengeId: string;
  expiresAt: number;
  overlaps: Array<{ issuer: string; trustLevel: number; circle: string | null; freshnessSeconds: number }>;
}

export async function verifyQrChallenge(payload: VerifyQrPayload, accessToken: string): Promise<VerifyQrResponse> {
  const res = await fetch(`${apiUrl}/qr/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return handleJson<VerifyQrResponse>(res);
}
