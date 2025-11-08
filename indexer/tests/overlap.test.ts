import { beforeEach, describe, expect, it } from 'vitest';

import { AttestationRecord, getDatabase, resetSingleton } from '../src/db';
import { clearOverlapCache, computeOverlap } from '../src/services/overlap';

function createAttestation(overrides: Partial<AttestationRecord> = {}): AttestationRecord {
  return {
    issuer: '0xIssuer1',
    cubidId: 'cubid:alice',
    trustLevel: 3,
    human: true,
    circle: Buffer.from(''.padStart(64, '1'), 'hex'),
    issuedAt: 1_700_000_000,
    expiry: 0,
    uid: '0x01',
    blockTime: 1_700_000_100,
    ...overrides,
  };
}

describe('overlap service', () => {
  beforeEach(() => {
    resetSingleton();
    clearOverlapCache();
  });

  it('returns trusted overlaps filtered by expiry', async () => {
    const db = getDatabase();
    db.upsertAttestation(
      createAttestation({ issuer: '0xIssuerShared', cubidId: 'viewer', blockTime: 1_700_000_150, uid: '0x02' }),
    );
    db.upsertAttestation(createAttestation({ issuer: '0xIssuerShared', cubidId: 'target', blockTime: 1_700_000_200 }));
    db.upsertAttestation(createAttestation({ issuer: '0xIssuerOther', cubidId: 'target', uid: '0x03' }));
    db.upsertAttestation(
      createAttestation({
        issuer: '0xIssuerExpired',
        cubidId: 'target',
        expiry: 1_600_000_000,
        uid: '0x04',
      }),
    );

    const overlaps = await computeOverlap(
      { viewerCubid: 'viewer', targetCubid: 'target' },
      { database: db, now: 1_700_000_250 },
    );

    expect(overlaps).toEqual([
      {
        issuer: '0xIssuerShared',
        trustLevel: 3,
        circle: '0x'.padEnd(66, '1'),
        freshnessSeconds: 50,
      },
    ]);
  });

  it('returns cached results on repeated calls', async () => {
    const db = getDatabase();
    db.upsertAttestation(
      createAttestation({ issuer: '0xIssuerShared', cubidId: 'viewer', blockTime: 1_700_000_150, uid: '0x02' }),
    );
    db.upsertAttestation(createAttestation({ issuer: '0xIssuerShared', cubidId: 'target', blockTime: 1_700_000_200 }));

    const first = await computeOverlap(
      { viewerCubid: 'viewer', targetCubid: 'target' },
      { database: db, now: 1_700_000_250 },
    );
    const second = await computeOverlap({ viewerCubid: 'viewer', targetCubid: 'target' }, { now: 1_700_000_250 });

    expect(first).toEqual(second);
  });
});
