import { describe, expect, it } from 'vitest';
import { DATA_SCOPES } from './index.js';
describe('types package', () => {
  it('keeps the six DataScopes', () => {
    expect(DATA_SCOPES).toHaveLength(6);
  });
});
