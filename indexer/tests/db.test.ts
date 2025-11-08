import { describe, expect, it } from 'vitest';

import { AttestationRecord, IndexerDatabase } from '../src/db';

function createRecord(overrides: Partial<AttestationRecord> = {}): AttestationRecord {
  return {
    issuer: '0xattester',
    cubidId: 'cubid:alice',
    trustLevel: 3,
    human: true,
    circle: Buffer.alloc(32, 1),
    issuedAt: 1_700_000_000,
    expiry: 0,
    uid: '0x01',
    blockTime: 1_700_000_100,
    ...overrides,
  };
}

describe('IndexerDatabase', () => {
  it('creates tables during migration', () => {
    const db = new IndexerDatabase(':memory:');
    db.migrate();

    const tables = db.listTables();

    expect(tables).toContain('attestations_latest');
    expect(tables).toContain('issuers');
    expect(tables).toContain('qr_challenges');

    db.close();
  });

  it('applies latest-wins semantics when upserting attestations', () => {
    const db = new IndexerDatabase(':memory:');
    db.migrate();

    const first = createRecord({ uid: '0x01', blockTime: 100 });
    const second = createRecord({ uid: '0x02', blockTime: 90 });
    const tieLower = createRecord({ uid: '0x00', blockTime: 100 });
    const tieHigher = createRecord({ uid: '0x03', blockTime: 100 });

    expect(db.upsertAttestation(first)).toBe(true);
    expect(db.upsertAttestation(second)).toBe(false);
    expect(db.upsertAttestation(tieLower)).toBe(false);
    expect(db.upsertAttestation(tieHigher)).toBe(true);

    const latest = db.getAttestation(first.issuer, first.cubidId);
    expect(latest?.uid).toBe('0x03');
    expect(latest?.blockTime).toBe(100);

    db.close();
  });

  it('removes rows by UID', () => {
    const db = new IndexerDatabase(':memory:');
    db.migrate();

    const record = createRecord({ uid: '0xdeadbeef' });
    db.upsertAttestation(record);

    expect(db.deleteByUid('0xdeadbeef')).toBe(true);
    expect(db.deleteByUid('0xdeadbeef')).toBe(false);

    db.close();
  });

  it('stores and retrieves QR challenges', () => {
    const db = new IndexerDatabase(':memory:');
    db.migrate();

    db.createQrChallenge({
      id: 'challenge-1',
      issuedFor: 'cubid:alice',
      challenge: 'peer-mapper:abc',
      expiresAt: 1234,
      used: false,
    });

    const fetched = db.getQrChallenge('challenge-1');
    expect(fetched).toEqual({
      id: 'challenge-1',
      issuedFor: 'cubid:alice',
      challenge: 'peer-mapper:abc',
      expiresAt: 1234,
      used: false,
    });

    expect(db.markQrChallengeUsed('challenge-1')).toBe(true);
    expect(db.markQrChallengeUsed('challenge-1')).toBe(false);

    const updated = db.getQrChallenge('challenge-1');
    expect(updated?.used).toBe(true);

    db.close();
  });
});
