import { describe, expect, it } from 'vitest';
import * as ui from './index.js';
describe('ui package', () => {
  it('loads its public contract', () => {
    expect(ui).toBeDefined();
  });
});
