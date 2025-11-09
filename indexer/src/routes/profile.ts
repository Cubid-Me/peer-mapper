import { Router } from 'express';

import type { AttestationRecord } from '../db';
import { getDatabase } from '../db';

const router = Router();

function toCircleHex(circle: AttestationRecord['circle']): string | null {
  if (!circle || circle.length === 0) {
    return null;
  }

  return `0x${circle.toString('hex')}`;
}

function mapAttestation(record: AttestationRecord, nowSeconds: number) {
  const freshnessSeconds = Math.max(0, nowSeconds - record.blockTime);
  return {
    issuer: record.issuer,
    cubidId: record.cubidId,
    trustLevel: record.trustLevel,
    human: record.human,
    circle: toCircleHex(record.circle),
    issuedAt: record.issuedAt,
    expiry: record.expiry,
    uid: record.uid,
    freshnessSeconds,
  };
}

router.get('/:cubidId', (req, res) => {
  const { cubidId } = req.params;
  const issuer = typeof req.query.issuer === 'string' ? (req.query.issuer as string).toLowerCase() : undefined;
  const nowSeconds = Math.floor(Date.now() / 1000);

  const database = getDatabase();
  const inbound = database
    .listAttestationsForCubid(cubidId)
    .filter((attn) => attn.expiry === 0 || nowSeconds <= attn.expiry)
    .map((record) => mapAttestation(record, nowSeconds))
    .sort((a, b) => a.freshnessSeconds - b.freshnessSeconds);

  const outbound = issuer
    ? database
        .listAttestationsByIssuer(issuer)
        .filter((attn) => attn.expiry === 0 || nowSeconds <= attn.expiry)
        .map((record) => mapAttestation(record, nowSeconds))
        .sort((a, b) => a.freshnessSeconds - b.freshnessSeconds)
    : [];

  res.json({ cubidId, inbound, outbound });
});

export default router;
