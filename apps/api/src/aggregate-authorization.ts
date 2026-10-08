import type { ScopeAnchor } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';

export type SourceReadGrant = Readonly<{
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
  fields: readonly string[] | null;
}>;
export const ORDER360_SOURCE_CAPABILITIES = {
  customer: 'customer:read',
  opportunity: 'opportunity:read',
  technical: 'technical-solution:read',
  cost: 'cost:read',
  policy: 'sales-policy:read',
  quote: 'quote:read',
  credit: 'credit:read',
  contract: 'contract:read',
  receivables: 'ar:read',
  payments: 'bank-payment:read',
  reconciliations: 'reconciliation:read',
  commissions: 'commission:read',
  risks: 'risk:read',
  shipments: 'shipment:read',
  collections: 'collection:read',
  legal: 'legal-case:read',
} as const satisfies Record<string, PermissionKey>;
export type Order360Source = keyof typeof ORDER360_SOURCE_CAPABILITIES;
export const companyReadAllowed = (grant: SourceReadGrant | undefined): boolean =>
  Boolean(grant?.scopes.some((scope) => scope === 'COMPANY' || scope === 'GROUP'));
export const fieldReadable = (grant: SourceReadGrant | undefined, ...names: string[]): boolean =>
  Boolean(grant && (grant.fields === null || names.some((name) => grant.fields?.includes(name))));

function legalRecord(
  value: Record<string, unknown>,
  fields: readonly string[] | null,
): Record<string, unknown> {
  if (fields === null) return value;
  const visible = new Set(['id', ...fields]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => visible.has(key))
      .map(([key, item]) => [
        key,
        (key === 'events' || key === 'packages') && Array.isArray(item)
          ? item.map((child) => legalRecord(child as Record<string, unknown>, fields))
          : item,
      ]),
  );
}
/** Collection permission never grants independent legal evidence or package visibility. */
export function projectCollectionLegal(
  value: Record<string, unknown>,
  grant: SourceReadGrant | undefined,
): Record<string, unknown> {
  const result = { ...value };
  const legalAllowed = companyReadAllowed(grant);
  if (Array.isArray(result.events))
    result.events = result.events.flatMap((item) => {
      const event = item as Record<string, unknown>;
      const type = typeof event.event_type === 'string' ? event.event_type : '';
      if (!type.startsWith('LEGAL_')) return [event];
      return legalAllowed ? [legalRecord(event, grant ? grant.fields : [])] : [];
    });
  if (!legalAllowed) delete result.legalHandoffs;
  else if (Array.isArray(result.legalHandoffs))
    result.legalHandoffs = result.legalHandoffs.map((item) =>
      legalRecord(item as Record<string, unknown>, grant ? grant.fields : []),
    );
  return result;
}
