import { Router } from 'express';

import { computeOverlap } from '../services/overlap';

const router = Router();

router.post('/intersection', async (req, res, next) => {
  try {
    const result = await computeOverlap({
      viewerCubid: req.body.viewerCubid,
      targetCubid: req.body.targetCubid,
    });
    res.json({ overlaps: result });
  } catch (error) {
    next(error);
  }
});

export default router;
