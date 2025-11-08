import { randomBytes, randomUUID } from 'node:crypto';

import { Router } from 'express';
import { verifyMessage } from 'viem';
import { z } from 'zod';

import { getDatabase } from '../db';
import { computeOverlap } from '../services/overlap';

const router = Router();

const verifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  challenge: z.string().min(1),
  viewer: z.object({
    cubidId: z.string().min(1),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  }),
  target: z.object({
    cubidId: z.string().min(1),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
  }),
});

router.get('/challenge', (req, res, next) => {
  try {
    const issuedFor = z.string().min(1).parse(req.query.issuedFor ?? req.query.issued_for);

    const challengeId = randomUUID();
    const challenge = `peer-mapper:${randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + 90_000;

    const database = getDatabase();
    database.createQrChallenge({
      id: challengeId,
      issuedFor,
      challenge,
      expiresAt,
      used: false,
    });

    res.json({
      challengeId,
      challenge,
      expiresAt,
      issuedFor,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'invalid_request', details: error.flatten() });
      return;
    }

    next(error as Error);
  }
});

router.post('/verify', async (req, res, next) => {
  try {
    const parsed = verifyRequestSchema.parse(req.body);
    const database = getDatabase();
    const record = database.getQrChallenge(parsed.challengeId);

    if (!record || record.challenge !== parsed.challenge) {
      res.status(404).json({ error: 'challenge_not_found' });
      return;
    }

    if (record.used) {
      res.status(409).json({ error: 'challenge_used' });
      return;
    }

    if (record.expiresAt <= Date.now()) {
      res.status(410).json({ error: 'challenge_expired' });
      return;
    }

    if (record.issuedFor !== parsed.target.cubidId) {
      res.status(400).json({ error: 'challenge_mismatch' });
      return;
    }

    const [viewerValid, targetValid] = await Promise.all([
      verifyMessage({
        address: parsed.viewer.address as `0x${string}`,
        message: parsed.challenge,
        signature: parsed.viewer.signature as `0x${string}`,
      }),
      verifyMessage({
        address: parsed.target.address as `0x${string}`,
        message: parsed.challenge,
        signature: parsed.target.signature as `0x${string}`,
      }),
    ]);

    if (!viewerValid || !targetValid) {
      res.status(400).json({ error: 'invalid_signature' });
      return;
    }

    database.markQrChallengeUsed(record.id);

    const overlaps = await computeOverlap(
      { viewerCubid: parsed.viewer.cubidId, targetCubid: parsed.target.cubidId },
      { database },
    );

    res.json({
      challengeId: record.id,
      expiresAt: record.expiresAt,
      overlaps,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'invalid_request', details: error.flatten() });
      return;
    }

    next(error as Error);
  }
});

export default router;
