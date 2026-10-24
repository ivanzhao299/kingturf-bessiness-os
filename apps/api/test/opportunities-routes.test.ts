import { describe, expect, it, vi } from 'vitest';
import { dispatchOpportunityRoutes } from '../src/routes/opportunities.js';

function fixture() {
  const authorization = {
    actor: { companyId: 'company', employeeId: 'employee' },
    permissions: new Map(),
  };
  const createOpportunity = vi.fn(async (input: Record<string, unknown>) => {
    await Promise.resolve(); // Let another request enter while this handler is pending.
    return input;
  });
  const authorize = vi.fn(() => ({
    context: authorization,
    scopes: ['SELF'] as const,
    anchors: [],
  }));
  const objectBody = vi.fn((body: unknown) => body as Record<string, unknown>);
  const unavailable = vi.fn(() => ({ statusCode: 503, body: {} }));
  const context: Parameters<typeof dispatchOpportunityRoutes>[0] = {
    repository: { createOpportunity } as unknown as NonNullable<
      Parameters<typeof dispatchOpportunityRoutes>[0]['repository']
    >,
    authorization,
    correlationId: 'first-correlation',
    authorize,
    unavailable,
    notFound: vi.fn(() => ({ statusCode: 404, body: {} })),
    permittedDto: (value) => value,
    mutationDto: (value) => value,
    parsers: {
      objectBody,
      allow: vi.fn(),
      uuid: (value) => String(value),
      string: (value) => String(value),
      decimal: (value) => String(value),
      currency: (value) => String(value),
      integer: (value) => Number(value),
      expectedVersion: (value) => Number(value),
    },
  };
  return { context, createOpportunity, authorize, objectBody, unavailable };
}
const body = (name: string) => ({
  customerId: null,
  leadId: null,
  name,
  value: '1',
  currency: 'CNY',
  probabilityBasisPoints: 0,
  expectedCloseDate: 'date',
});

describe('basic opportunity wrapper boundaries', () => {
  it('ignores nested and unmatched paths without checking dependency, parsing or authorizing', async () => {
    const f = fixture();
    for (const pathname of [
      '/api/v1/opportunities/abc/ctrs',
      '/api/v1/opportunities/abc/technical-solutions',
      '/api/v1/opportunities/NOT-HEX',
      '/api/v1/opportunities/',
    ]) {
      expect(
        await dispatchOpportunityRoutes(
          { ...f.context, repository: undefined },
          { method: 'POST', pathname, body: null },
        ),
      ).toBeNull();
    }
    expect(f.unavailable).not.toHaveBeenCalled();
    expect(f.objectBody).not.toHaveBeenCalled();
    expect(f.authorize).not.toHaveBeenCalled();
    expect(f.createOpportunity).not.toHaveBeenCalled();
  });
  it('keeps concurrent create body, actor and correlation inputs local', async () => {
    const f = fixture();
    const otherActor = { employeeId: 'other-employee', companyId: 'other-company' };
    const results = await Promise.all([
      dispatchOpportunityRoutes(f.context, {
        method: 'POST',
        pathname: '/api/v1/opportunities',
        body: body('first'),
      }),
      dispatchOpportunityRoutes(
        {
          ...f.context,
          authorization: { ...f.context.authorization, actor: otherActor },
          correlationId: 'second-correlation',
        },
        { method: 'POST', pathname: '/api/v1/opportunities', body: body('second') },
      ),
    ]);
    expect(results).toEqual([
      { statusCode: 201, body: body('first') },
      { statusCode: 201, body: body('second') },
    ]);
    expect(f.createOpportunity).toHaveBeenNthCalledWith(
      1,
      body('first'),
      f.context.authorization.actor,
      'first-correlation',
    );
    expect(f.createOpportunity).toHaveBeenNthCalledWith(
      2,
      body('second'),
      otherActor,
      'second-correlation',
    );
  });
});
