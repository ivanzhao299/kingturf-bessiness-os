import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiResponse } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Customer360Repository = Pick<
  NonNullable<ApiDependencies['crm']>,
  'findCustomer' | 'customer360'
>;
type FindArgs = Parameters<Customer360Repository['findCustomer']>;
type ViewArgs = Parameters<Customer360Repository['customer360']>;
type Customer360 = NonNullable<Awaited<ReturnType<Customer360Repository['customer360']>>>;
type Sections = NonNullable<ViewArgs[5]>;
type ViewFields = readonly string[] | null | undefined;
type ValidatedCustomer360 = Readonly<{
  id: FindArgs[0];
  readGrant: AuthorizedQuery;
  viewGrant: AuthorizedQuery;
}>;
type Customer360Context = Readonly<{
  repository: Customer360Repository;
  authorization: AuthorizationContext;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  uuid: (value: unknown, name: string) => string;
  customerNotFound: () => ApiResponse;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;

function readCustomer360SectionGrant(
  context: Customer360Context,
  capability: PermissionKey,
): Sections['ownership'] {
  if (!context.authorization.permissions.has(capability)) return undefined;
  const grant = context.authorize(capability);
  return { scopes: grant.scopes, anchors: grant.anchors };
}

function projectCustomer360Item<T extends Record<string, unknown>>(
  context: Customer360Context,
  fields: ViewFields,
  prefix: string,
  item: T,
  sectionCapability?: PermissionKey,
): Partial<T> {
  const viewFields =
    fields === null
      ? null
      : (fields ?? [])
          .filter((field) => field.startsWith(`${prefix}.`))
          .map((field) => field.slice(prefix.length + 1));
  const sectionFields = sectionCapability
    ? (context.authorization.permissions.get(sectionCapability)?.fields ?? null)
    : null;
  const effectiveFields =
    viewFields === null
      ? sectionFields
      : sectionFields === null
        ? viewFields
        : viewFields.filter((field) => sectionFields.includes(field));
  return context.permittedDto(item, effectiveFields);
}

function projectCustomer360Result(
  context: Customer360Context,
  fields: ViewFields,
  found: Customer360,
) {
  return {
    customer: projectCustomer360Item(context, fields, 'customer', found.customer, 'customer:read'),
    contacts: found.contacts.map((item) =>
      projectCustomer360Item(context, fields, 'contacts', item),
    ),
    ownership: found.ownership.map((item) =>
      projectCustomer360Item(context, fields, 'ownership', item, 'customer-ownership:read'),
    ),
    leads: found.leads.map((item) =>
      projectCustomer360Item(context, fields, 'leads', item, 'lead:read'),
    ),
    opportunities: found.opportunities.map((item) =>
      projectCustomer360Item(context, fields, 'opportunities', item, 'opportunity:read'),
    ),
    activities: found.activities.map((item) =>
      projectCustomer360Item(context, fields, 'activities', item, 'customer-activity:read'),
    ),
    unavailableSections: found.unavailableSections,
  };
}

export function customer360Routes(context: Customer360Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/customers\/([0-9a-f-]+)\/360$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match): ValidatedCustomer360 => {
        const readGrant = context.authorize('customer:read');
        const viewGrant = context.authorize('customer-360:read');
        return { id: context.uuid(match.params[0], 'customerId'), readGrant, viewGrant };
      },
      handler: async (_request, _match, input) => {
        const readable = await context.repository.findCustomer(
          input.id,
          context.authorization.actor,
          input.readGrant.scopes,
          input.readGrant.anchors,
        );
        if (!readable) return context.customerNotFound();
        const fields = context.authorization.permissions.get('customer-360:read')?.fields;
        const ownership = readCustomer360SectionGrant(context, 'customer-ownership:read');
        const leads = readCustomer360SectionGrant(context, 'lead:read');
        const opportunities = readCustomer360SectionGrant(context, 'opportunity:read');
        const activities = readCustomer360SectionGrant(context, 'customer-activity:read');
        const found = await context.repository.customer360(
          input.id,
          context.authorization.actor,
          input.viewGrant.scopes,
          input.viewGrant.anchors,
          {
            email: fields === null || fields?.includes('contacts.email') === true,
            phone: fields === null || fields?.includes('contacts.phone') === true,
          },
          {
            ...(ownership ? { ownership } : {}),
            ...(leads ? { leads } : {}),
            ...(opportunities ? { opportunities } : {}),
            ...(activities ? { activities } : {}),
          },
        );
        return found
          ? { statusCode: 200, body: projectCustomer360Result(context, fields, found) }
          : context.customerNotFound();
      },
    }),
  ];
}
