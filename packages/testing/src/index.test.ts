import { describe, expect, it } from 'vitest';
import * as testing from './index.js';
describe('testing package', () => {
  it('loads its public contract', () => {
    expect(testing).toBeDefined();
  });
});
