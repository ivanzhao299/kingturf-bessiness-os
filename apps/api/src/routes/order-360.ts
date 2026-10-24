import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import {
  ORDER360_SOURCE_CAPABILITIES,
  fieldReadable,
  projectCollectionLegal,
  type SourceReadGrant,
} from '../aggregate-authorization.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['order360']>, 'get'>;
type Get = Repository['get'];
type ScopeContext = Readonly<Parameters<Get>[1]>;
type Sources = NonNullable<ScopeContext['sources']>;
type ReadGrant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type ValidatedOrder360 = Readonly<{
  repository: Repository;
  get: Get;
  orderId: Parameters<Get>[0];
  scopeContext: ScopeContext;
  sources: Sources;
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;

function collectSourceGrants(context: Context): Sources {
  const sources: Partial<Record<keyof typeof ORDER360_SOURCE_CAPABILITIES, SourceReadGrant>> = {};
  for (const [name, capability] of Object.entries(ORDER360_SOURCE_CAPABILITIES)) {
    if (!context.authorization.permissions.has(capability)) continue;
    const grant = context.authorizeQuery(context.authorization, capability);
    sources[name as keyof typeof ORDER360_SOURCE_CAPABILITIES] = {
      scopes: grant.scopes,
      anchors: grant.anchors,
      fields: context.authorization.permissions.get(capability)?.fields ?? null,
    };
  }
  return sources;
}

function projectSourceSection(
  context: Context,
  section: string,
  value: unknown,
  grant: ReadGrant,
  sources: Sources,
) {
  return Array.isArray(value)
    ? value.map((item) =>
        context.permittedDto(
          section === 'collections'
            ? projectCollectionLegal(item as Record<string, unknown>, sources.legal)
            : (item as Record<string, unknown>),
          grant.fields,
        ),
      )
    : value === null
      ? null
      : context.permittedDto(value as Record<string, unknown>, grant.fields);
}

function timelineCapability(type: string): PermissionKey | null {
  if (type.startsWith('QUOTE_')) return 'quote:read';
  if (type.startsWith('CREDIT_')) return 'credit:read';
  if (type.startsWith('CONTRACT_')) return 'contract:read';
  if (type.startsWith('AR_')) return 'ar:read';
  if (type.startsWith('PAYMENT_')) return 'bank-payment:read';
  if (type.startsWith('COMMISSION_')) return 'commission:read';
  if (type.startsWith('RISK_')) return 'risk:read';
  if (type.startsWith('SHIPMENT_')) return 'shipment:read';
  if (type.startsWith('COLLECTION_LEGAL_')) return 'legal-case:read';
  if (type.startsWith('COLLECTION_')) return 'collection:read';
  if (type.startsWith('LEGAL_HANDOFF_') || type.startsWith('DEBT_EVIDENCE_'))
    return 'legal-case:read';
  if (type.startsWith('OPPORTUNITY_')) return 'opportunity:read';
  return type === 'ORDER_RELEASED' ? 'sales-order:read' : null;
}

function projectTimelineEvent(context: Context, sources: Sources, event: Record<string, unknown>) {
  const type = typeof event.type === 'string' ? event.type : '';
  const capability = timelineCapability(type);
  if (capability === null) return [];
  const read = context.authorization.permissions.get(capability);
  if (!read) return [];
  const legalNested =
    type.startsWith('LEGAL_HANDOFF_') ||
    type.startsWith('DEBT_EVIDENCE_') ||
    type.startsWith('COLLECTION_LEGAL_');
  if (
    legalNested &&
    !fieldReadable(
      sources.collections,
      type.startsWith('COLLECTION_LEGAL_') ? 'events' : 'legalHandoffs',
    )
  )
    return [];
  if (read.fields === null) return [event];
  const stateFields = type.startsWith('COLLECTION_') ? ['event_type', 'state'] : ['state'];
  const carriesState = [
    'LEGAL_HANDOFF_',
    'DEBT_EVIDENCE_',
    'COMMISSION_',
    'RISK_TASK_',
    'SHIPMENT_RELEASE_',
    'SHIPMENT_',
    'COLLECTION_',
  ].some((prefix) => type.startsWith(prefix));
  if (carriesState && !stateFields.some((name) => read.fields?.includes(name))) return [];
  const labelFields: Record<string, readonly string[]> = {
    OPPORTUNITY_CREATED: ['name'],
    QUOTE_ISSUED: ['quoteNumber', 'quote_number'],
    CREDIT_DECIDED: ['effectiveStatus', 'effective_status'],
    CONTRACT_SIGNED: ['contractNumber', 'contract_number'],
    ORDER_RELEASED: ['order_number', 'orderNumber'],
    AR_POSTED: ['documentNumber', 'document_number'],
    PAYMENT_RECEIVED: ['bank_reference', 'bankReference'],
    COLLECTION_FOLLOWUP: ['outcome'],
  };
  const fields =
    labelFields[type] ??
    (type.startsWith('DEBT_EVIDENCE_')
      ? ['package_number']
      : type.startsWith('SHIPMENT_') && !type.startsWith('SHIPMENT_RELEASE_')
        ? ['tracking_number']
        : ['reason']);
  const grant = { scopes: read.scopes, anchors: [], fields: read.fields };
  const labelAllowed =
    type === 'RISK_EVALUATED'
      ? fieldReadable(grant, 'severity') && fieldReadable(grant, 'score')
      : fieldReadable(grant, ...fields);
  // Flat source allowlists cannot safely describe joined/coalesced event timestamps.
  return [context.permittedDto(event, ['type', 'subjectId', ...(labelAllowed ? ['label'] : [])])];
}

function projectAggregate(context: Context, sources: Sources, aggregate: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    order: context.permittedDto(
      aggregate.order as Record<string, unknown>,
      context.authorization.permissions.get('sales-order:read')?.fields ?? null,
    ),
    anomalies: aggregate.anomalies,
  };
  for (const [section, capability] of Object.entries(ORDER360_SOURCE_CAPABILITIES)) {
    const grant = context.authorization.permissions.get(capability);
    if (!grant || section === 'legal') continue;
    const value = aggregate[section];
    body[section] = projectSourceSection(context, section, value, grant, sources);
  }
  body.timeline = (aggregate.timeline as Record<string, unknown>[]).flatMap((event) =>
    projectTimelineEvent(context, sources, event),
  );
  return context.permittedDto(
    body,
    context.authorization.permissions.get('order-360:read')?.fields ?? null,
  );
}

export function order360Routes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/sales-orders\/([0-9a-f-]+)\/360$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match): ValidatedOrder360 => {
        const orderId = match.params[0];
        if (!orderId) throw new DomainError('invalid_request', 'salesOrderId is required');
        const entryGrant = context.authorizeQuery(context.authorization, 'order-360:read');
        const orderGrant = context.authorizeQuery(context.authorization, 'sales-order:read');
        const sources = collectSourceGrants(context);
        const repository = context.repository();
        const get = repository.get;
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: orderGrant.scopes,
          anchors: orderGrant.anchors,
          sources,
          entry: {
            scopes: entryGrant.scopes,
            anchors: entryGrant.anchors,
            fields: context.authorization.permissions.get('order-360:read')?.fields ?? null,
          },
        };
        return { repository, get, orderId, scopeContext, sources };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Get>> = await validated.get.call(
          validated.repository,
          validated.orderId,
          validated.scopeContext,
        );
        return {
          statusCode: 200,
          body: projectAggregate(context, validated.sources, result),
        };
      },
    }),
  ];
}
