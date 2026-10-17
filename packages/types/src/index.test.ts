import { describe, expect, it } from 'vitest';
import { DATA_SCOPES } from './index.js';
describe('types package', () => {
  it('keeps the six DataScopes', () => {
    expect(DATA_SCOPES).toHaveLength(6);
    expect(DATA_SCOPES).toEqual(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP']);
  });
});
