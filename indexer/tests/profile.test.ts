import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/api';
import { getDatabase, resetSingleton } from '../src/db';

const TEST_NOW = 1_700_000_000_000;

function seedAttestation(options: {
  issuer: string;
  cubidId: string;
  trustLevel: number;
  blockTime: number;
  expiry?: number;
  circle?: Buffer | null;
}) {
  const db = getDatabase();
  db.upsertAttestation({
    issuer: options.issuer,
    cubidId: options.cubidId,
    trustLevel: options.trustLevel,
    human: true,
    circle: options.circle ?? null,
    issuedAt: options.blockTime,
    expiry: options.expiry ?? 0,
    uid: `0x${Math.random().toString(16).slice(2, 10)}`,
    blockTime: options.blockTime,
  });
}

describe('profile routes', () => {
  beforeEach(() => {
    resetSingleton();
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns inbound and outbound attestations with freshness', async () => {
    const app = buildApp({ rateLimit: { perSecond: 100, perDay: 1000 } });

    seedAttestation({
      issuer: '0xissuerinbound',
      cubidId: 'viewer',
      trustLevel: 3,
      blockTime: Math.floor(TEST_NOW / 1000) - 120,
      circle: Buffer.from('1234', 'hex'),
    });

    seedAttestation({
      issuer: '0xissuerviewer',
      cubidId: 'friend-1',
      trustLevel: 5,
      blockTime: Math.floor(TEST_NOW / 1000) - 45,
      circle: null,
    });

    const res = await request(app)
      .get('/profile/viewer')
      .query({ issuer: '0xIssuerViewer' })
      .expect(200);

    expect(res.body.cubidId).toBe('viewer');
    expect(res.body.inbound).toEqual([
      expect.objectContaining({
        issuer: '0xissuerinbound',
        cubidId: 'viewer',
        trustLevel: 3,
        circle: '0x1234',
        freshnessSeconds: 120,
      }),
    ]);
    expect(res.body.outbound).toEqual([
      expect.objectContaining({
        issuer: '0xissuerviewer',
        cubidId: 'friend-1',
        trustLevel: 5,
        circle: null,
        freshnessSeconds: 45,
      }),
    ]);
  });

  it('filters out expired attestations', async () => {
    const app = buildApp({ rateLimit: { perSecond: 100, perDay: 1000 } });

    seedAttestation({
      issuer: '0xissuerexpired',
      cubidId: 'viewer',
      trustLevel: 1,
      blockTime: Math.floor(TEST_NOW / 1000) - 30,
      expiry: Math.floor(TEST_NOW / 1000) - 5,
    });

    const res = await request(app).get('/profile/viewer').expect(200);

    expect(res.body.inbound).toEqual([]);
    expect(res.body.outbound).toEqual([]);
  });
});
