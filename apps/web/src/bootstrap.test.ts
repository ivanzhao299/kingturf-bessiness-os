import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_TITLE } from './bootstrap';

describe('web bootstrap', () => {
  it('provides the neutral application shell title', () => {
    expect(BOOTSTRAP_TITLE).toBe('KingTurf Business OS');
  });
});
