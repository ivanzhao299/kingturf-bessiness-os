import { DomainError } from '@kingturf/domain';
import type { JsonObject, PermissionKey } from '@kingturf/types';
import { z } from 'zod';
import type { ApiRequest } from '../../app.ts';
import {
  allow,
  currency,
  decimal,
  idempotency,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import type { PaymentPageFilter } from '../../payment-read-repositories.ts';
import { canReadFinField, type FinancialRelatedRead } from '../../qtc-read-repositories.ts';
import { asAllocationGuard } from '../../write-rejection-mapping.ts';
import { qtcBankPaymentIntakeRoutes } from '../qtc-bank-payment-intake.ts';
import { qtcReconciliationRunRoutes } from '../qtc-reconciliation-run.ts';
import { dispatchRoutes } from '../types.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const PAYMENT = '/api/v1/bank-payments';
const RUN = '/api/v1/reconciliation-runs';
const row = z.looseObject({ id: z.string().optional() });
const page = z.object({
  items: z.array(row),
  nextCursor: z.string().nullable().optional(),
  summary: z.array(z.record(z.string(), z.unknown())).optional(),
});
const paymentStates = ['OPEN', 'CLEARED', 'OVERDUE'];
const runStates = ['COMPLETED', 'NO_MATCH'];
type Query = Readonly<Record<string, string | undefined>>;

function paymentQuery(query: Query): PaymentPageFilter {
  const state = query.state;
  if (state && !paymentStates.includes(state))
    throw new DomainError('invalid_request', 'state is unsupported');
  const minAmount = query.minAmount ? decimal(query.minAmount, 'minAmount') : undefined;
  const maxAmount = query.maxAmount ? decimal(query.maxAmount, 'maxAmount') : undefined;
  if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount)) {
    throw new DomainError('invalid_request', 'minAmount must not exceed maxAmount');
  }
  return {
    limit: query.limit ? integer(Number(query.limit), 'limit', 1, 100) : 50,
    ...(query.cursor ? { cursor: uuid(query.cursor, 'cursor') } : {}),
    ...(query.query ? { query: string(query.query, 'query') } : {}),
    ...(query.from ? { from: timestamp(query.from, 'from') } : {}),
    ...(query.to ? { to: timestamp(query.to, 'to') } : {}),
    ...(minAmount ? { minAmount } : {}),
    ...(maxAmount ? { maxAmount } : {}),
    ...(state ? { state: state as PaymentPageFilter['state'] & string } : {}),
  };
}

function related(scope: FastifyRouteScope, capability: PermissionKey): FinancialRelatedRead | null {
  const grant = scope.authorization.permissions.get(capability);
  return grant
    ? {
        actor: scope.authorization.actor,
        scopes: grant.scopes,
        anchors: scope.authorization.scopeAnchors?.get(capability) ?? [],
        fields: grant.fields,
      }
    : null;
}

const readContext = (
  scope: FastifyRouteScope,
  capability: PermissionKey,
  keys?: readonly string[],
) => {
  const grant = authorizeQuery(scope.authorization, capability, keys);
  return { actor: scope.authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
};
const repository = (scope: FastifyRouteScope) => {
  const repo = scope.dependencies.quoteToCash;
  if (!repo)
    throw Object.assign(new Error('QuoteToCash dependency unavailable'), { statusCode: 503 });
  return repo;
};
const listDto = (items: readonly JsonObject[], fields: readonly string[] | null) =>
  items.map((item) => permittedDto(item, fields));
const searchOf = (query: Query): string => {
  const search = query.search?.trim() ?? '';
  if (search.length > 100)
    throw new DomainError('invalid_request', 'search exceeds 100 characters');
  return search;
};

export function registerBankPaymentRoutes(
  app: FastifyRouteGroupApp,
  scope: FastifyRouteScope,
): void {
  const paymentFields = scope.authorization.permissions.get('bank-payment:read')?.fields ?? null;
  const runFields = scope.authorization.permissions.get('reconciliation:read')?.fields ?? null;
  app.get(PAYMENT, { schema: { response: { 200: page } } }, async (request) => {
    const context = readContext(scope, 'bank-payment:read');
    const query = request.query as Query;
    const filter = paymentQuery(query);
    const search = searchOf(query);
    const rawSummary = query.summary;
    if (rawSummary && rawSummary !== '1' && rawSummary !== 'true') {
      throw new DomainError('invalid_request', 'summary is unsupported');
    }
    const repo = repository(scope);
    if (search === '' && !rawSummary) {
      const result = await repo.listOperationalPage('payments', filter, context);
      return { items: listDto(result.items, paymentFields), nextCursor: result.nextCursor };
    }
    const canSummarize =
      canReadFinField(paymentFields, 'currency') &&
      canReadFinField(paymentFields, 'amount') &&
      canReadFinField(paymentFields, 'remaining_amount', 'remainingAmount');
    const [result, summary] = await Promise.all([
      repo.listPaymentPage(
        { ...context, fields: paymentFields },
        { ...filter, ...(search === '' ? {} : { search }) },
      ),
      rawSummary && canSummarize ? repo.summarizePayments(context) : Promise.resolve(null),
    ]);
    return {
      items: listDto(result.items, paymentFields),
      nextCursor: result.nextCursor,
      ...(summary === null ? {} : { summary: [...summary] }),
    };
  });
  app.get(`${PAYMENT}/:id`, { schema: { response: { 200: row } } }, async (request) => {
    const context = readContext(scope, 'bank-payment:read');
    const id = uuid((request.params as { id: string }).id, 'paymentId');
    const result = await repository(scope).findPayment(id, context, related(scope, 'ar:read'));
    if (!result) throw new DomainError('not_found', 'Payment not found');
    return permittedDto(result, paymentFields);
  });
  app.get(RUN, { schema: { response: { 200: page } } }, async (request) => {
    const context = readContext(scope, 'reconciliation:read');
    const { limit, cursor, state, search: rawSearch } = request.query as Query;
    const repo = repository(scope);
    if (!(limit || cursor || state || rawSearch?.trim())) {
      return { items: listDto(await repo.list('reconciliation', context), runFields) };
    }
    if (state && !runStates.includes(state))
      throw new DomainError('invalid_request', 'state is unsupported');
    const search = searchOf({ search: rawSearch });
    if (search && !canReadFinField(runFields, 'result_hash', 'resultHash')) {
      throw new DomainError('forbidden', 'Field permission denied');
    }
    if (state && !canReadFinField(runFields, 'status'))
      throw new DomainError('forbidden', 'Field permission denied');
    const result = await repo.listReconciliationPage(context, {
      limit: limit ? integer(Number(limit), 'limit', 1, 100) : 50,
      ...(cursor ? { cursor: uuid(cursor, 'cursor') } : {}),
      ...(state ? { state } : {}),
      ...(search ? { search } : {}),
    });
    return { items: listDto(result.items, runFields), nextCursor: result.nextCursor };
  });
  app.get(`${RUN}/:id`, { schema: { response: { 200: row } } }, async (request) => {
    const context = readContext(scope, 'reconciliation:read');
    const id = uuid((request.params as { id: string }).id, 'reconciliationRunId');
    const result = await repository(scope).findReconciliation(
      id,
      context,
      related(scope, 'ar:read'),
      related(scope, 'bank-payment:read'),
    );
    if (!result) throw new DomainError('not_found', 'Reconciliation run not found');
    return permittedDto(result, runFields);
  });
  registerPaymentWrites(app, scope);
}

// Reuse the legacy validators, command dispatch and write DTO at both entry points.
function registerPaymentWrites(app: FastifyRouteGroupApp, scope: FastifyRouteScope): void {
  for (const pathname of [PAYMENT, RUN]) {
    app.post(pathname, async (request, reply) => {
      const body = objectBody(request.body);
      const context = {
        repository: () => repository(scope),
        body,
        authorization: scope.authorization,
        authorizeScope: (permission: PermissionKey) =>
          readContext(scope, permission, Object.keys(body)),
        correlationId: scope.correlationId,
        mutationDto,
      };
      const routes =
        pathname === PAYMENT
          ? qtcBankPaymentIntakeRoutes({
              ...context,
              parsers: {
                allow,
                uuid,
                currency,
                decimal,
                timestamp,
                string,
                jsonObject,
                idempotency,
              },
            })
          : qtcReconciliationRunRoutes({ ...context, parsers: { allow, uuid, idempotency } });
      // idempotency reads headers only. The original parsed request body goes to the legacy validator.
      const input = { method: 'POST', pathname, headers: request.headers } as ApiRequest;
      try {
        const result = await dispatchRoutes(routes, input);
        if (!result) throw new Error('Missing quote-to-cash write route');
        void reply.code(result.statusCode);
        return result.body;
      } catch (error: unknown) {
        throw pathname === RUN ? asAllocationGuard(error) : error;
      }
    });
  }
}
