import { describe, expect, it } from 'vitest';

import { computeOverlap } from '../src/services/overlap';

describe('overlap service', () => {
  it('returns an empty list for now', async () => {
    const overlaps = await computeOverlap({ viewerCubid: 'alice', targetCubid: 'bob' });
    expect(overlaps).toEqual([]);
  });
});
