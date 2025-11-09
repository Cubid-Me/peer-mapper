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

  it('honours canonical anchors when provided', () => {
    const db = new IndexerDatabase(':memory:');
    db.migrate();

    const initial = createRecord({ uid: '0xaaa', blockTime: 200 });
    expect(db.upsertAttestation(initial)).toBe(true);

    const canonicalUid = `0x${'11'.repeat(32)}`;
    const anchored = createRecord({ uid: canonicalUid, blockTime: 150 });
    expect(db.upsertAttestation(anchored, canonicalUid)).toBe(true);

    const competing = createRecord({ uid: `0x${'22'.repeat(32)}`, blockTime: 250 });
    expect(db.upsertAttestation(competing, canonicalUid)).toBe(false);

    const stored = db.getAttestation(anchored.issuer, anchored.cubidId);
    expect(stored?.uid).toBe(canonicalUid.toLowerCase());
    expect(stored?.blockTime).toBe(150);

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
