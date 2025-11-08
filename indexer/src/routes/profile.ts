import { Router } from 'express';

const router = Router();

router.get('/:cubidId', (_req, res) => {
  res.json({ attestations: [] });
});

export default router;
