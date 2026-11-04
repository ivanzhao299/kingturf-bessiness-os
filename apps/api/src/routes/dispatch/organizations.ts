import { allow, error, objectBody, string, uuid, version } from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { projectedReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* organizationsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const organizationMatch = /^\/api\/v1\/organizations(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
  if (organizationMatch) {
    const id = organizationMatch[1];
    if (request.method === 'GET' && !id) {
      authorizeQuery(context, 'organization:read');
      yield projectedReply(
        dependencies.organizations.list(context.actor.companyId),
        (resolvedBody) => {
          return {
            statusCode: 200,
            body: resolvedBody,
          };
        },
      );
    }
    if (request.method === 'GET' && id) {
      authorizeQuery(context, 'organization:read');
      yield projectedReply(
        dependencies.organizations.findById(uuid(id, 'organizationId'), context.actor.companyId),
        (found) => {
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Organization not found', correlationId);
        },
      );
    }
    if (request.method === 'POST' && !id) {
      authorizeQuery(context, 'organization:create');
      const b = objectBody(request.body);
      allow(b, ['parentId', 'code', 'name', 'locale', 'currency']);
      yield projectedReply(
        dependencies.organizations.create(
          {
            ownerOrganizationId: context.actor.companyId,
            parentId:
              b.parentId === null || b.parentId === undefined ? null : uuid(b.parentId, 'parentId'),
            code: string(b.code, 'code'),
            name: string(b.name, 'name'),
            locale: typeof b.locale === 'string' ? b.locale : 'zh-CN',
            currency: typeof b.currency === 'string' ? b.currency : 'CNY',
            active: true,
          },
          context.actor,
          correlationId,
        ),
        (created) => {
          return { statusCode: 201, body: created };
        },
      );
    }
    if (request.method === 'PATCH' && id) {
      const b = objectBody(request.body);
      allow(b, ['name', 'parentId', 'active', 'locale', 'currency', 'version']);
      const fields = Object.keys(b).filter((k) => k !== 'version');
      authorizeQuery(context, 'organization:update', fields);
      const patch = {
        ...(typeof b.name === 'string' ? { name: string(b.name, 'name') } : {}),
        ...(Object.hasOwn(b, 'parentId')
          ? { parentId: b.parentId === null ? null : uuid(b.parentId, 'parentId') }
          : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
        ...(typeof b.locale === 'string' ? { locale: string(b.locale, 'locale') } : {}),
        ...(typeof b.currency === 'string' ? { currency: string(b.currency, 'currency') } : {}),
      };
      yield projectedReply(
        dependencies.organizations.update(
          uuid(id, 'organizationId'),
          context.actor.companyId,
          patch,
          version(b.version),
          context.actor,
          correlationId,
        ),
        (updated) => {
          return { statusCode: 200, body: updated };
        },
      );
    }
  }
}
