import { randomUUID } from 'crypto';
import { Router } from 'express';

const router = Router();

router.get('/challenge', (_req, res) => {
  res.json({
    challenge: randomUUID(),
    expiresAt: Date.now() + 90_000,
  });
});

router.post('/verify', (_req, res) => {
  res.json({ ok: true });
});

export default router;
