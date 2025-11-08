import { Router } from 'express';

const router = Router();

router.post('/prepare', (_req, res) => {
  res.json({ typedData: 'todo' });
});

router.post('/relay', (_req, res) => {
  res.status(202).json({ status: 'queued' });
});

export default router;
