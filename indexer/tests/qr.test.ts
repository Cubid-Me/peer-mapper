import request from 'supertest';
import { privateKeyToAccount } from 'viem/accounts';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/api';
import { AttestationRecord, getDatabase, resetSingleton } from '../src/db';
import { clearOverlapCache } from '../src/services/overlap';

const viewerAccount = privateKeyToAccount('0x1111111111111111111111111111111111111111111111111111111111111111');
const targetAccount = privateKeyToAccount('0x2222222222222222222222222222222222222222222222222222222222222222');

function seedAttestation(record: Partial<AttestationRecord>) {
  const db = getDatabase();
  db.upsertAttestation({
    issuer: '0xIssuerShared',
    cubidId: 'viewer',
    trustLevel: 3,
    human: true,
    circle: null,
    issuedAt: 1_700_000_000,
    expiry: 0,
    uid: `0x${Math.random().toString(16).slice(2, 10)}`,
    blockTime: 1_700_000_000,
    ...record,
  });
}

describe('QR routes', () => {
  beforeEach(() => {
    resetSingleton();
    clearOverlapCache();
  });

  it('issues a challenge and verifies overlap while preventing replays', async () => {
    const app = buildApp({ rateLimit: { perSecond: 100, perDay: 1000 } });

    seedAttestation({ issuer: '0xIssuerShared', cubidId: 'viewer', uid: '0x01' });
    seedAttestation({ issuer: '0xIssuerShared', cubidId: 'target', blockTime: 1_700_000_100, uid: '0x02' });
    seedAttestation({ issuer: '0xIssuerOther', cubidId: 'target', uid: '0x03' });

    const challengeRes = await request(app).get('/qr/challenge').query({ issuedFor: 'target' }).expect(200);
    const { challengeId, challenge } = challengeRes.body as { challengeId: string; challenge: string };

    const payload = {
      challengeId,
      challenge,
      viewer: {
        cubidId: 'viewer',
        address: viewerAccount.address,
        signature: await viewerAccount.signMessage({ message: challenge }),
      },
      target: {
        cubidId: 'target',
        address: targetAccount.address,
        signature: await targetAccount.signMessage({ message: challenge }),
      },
    };

    const verifyRes = await request(app).post('/qr/verify').send(payload).expect(200);
    expect(verifyRes.body.overlaps).toEqual([
      {
        issuer: '0xIssuerShared',
        trustLevel: 3,
        circle: null,
        freshnessSeconds: expect.any(Number),
      },
    ]);

    await request(app).post('/qr/verify').send(payload).expect(409);
  });

  it('rejects expired challenges', async () => {
    const app = buildApp({ rateLimit: { perSecond: 100, perDay: 1000 } });
    const db = getDatabase();

    db.createQrChallenge({
      id: 'expired',
      issuedFor: 'target',
      challenge: 'peer-mapper:expired',
      expiresAt: Date.now() - 1,
      used: false,
    });

    const payload = {
      challengeId: 'expired',
      challenge: 'peer-mapper:expired',
      viewer: {
        cubidId: 'viewer',
        address: viewerAccount.address,
        signature: await viewerAccount.signMessage({ message: 'peer-mapper:expired' }),
      },
      target: {
        cubidId: 'target',
        address: targetAccount.address,
        signature: await targetAccount.signMessage({ message: 'peer-mapper:expired' }),
      },
    };

    await request(app).post('/qr/verify').send(payload).expect(410);
  });
});
