import { allow, error, objectBody, string, uuid, version } from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { projectedReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* employeesAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const employeeMatch = /^\/api\/v1\/employees(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
  if (employeeMatch) {
    const id = employeeMatch[1];
    if (request.method === 'GET' && !id) {
      const grant = authorizeQuery(context, 'employee:read');
      yield projectedReply(
        dependencies.employees.list(
          context.actor.companyId,
          grant.scopes,
          context.actor.employeeId,
          grant.anchors,
        ),
        (resolvedBody) => {
          return {
            statusCode: 200,
            body: resolvedBody,
          };
        },
      );
    }
    if (request.method === 'GET' && id) {
      const grant = authorizeQuery(context, 'employee:read');
      yield projectedReply(
        dependencies.employees.findById(
          uuid(id, 'employeeId'),
          context.actor.companyId,
          grant.scopes,
          context.actor.employeeId,
          grant.anchors,
        ),
        (found) => {
          return found
            ? { statusCode: 200, body: found }
            : error(404, 'not_found', 'Employee not found', correlationId);
        },
      );
    }
    if (request.method === 'POST' && !id) {
      authorizeQuery(context, 'employee:create');
      const b = objectBody(request.body);
      allow(b, ['organizationId', 'employeeNumber', 'displayName', 'email']);
      yield projectedReply(
        dependencies.employees.create(
          {
            companyId: context.actor.companyId,
            organizationId: uuid(b.organizationId, 'organizationId'),
            employeeNumber: string(b.employeeNumber, 'employeeNumber'),
            displayName: string(b.displayName, 'displayName'),
            email: string(b.email, 'email'),
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
      allow(b, ['displayName', 'email', 'organizationId', 'active', 'version']);
      const fields = Object.keys(b).filter((k) => k !== 'version');
      const grant = authorizeQuery(context, 'employee:update', fields);
      const patch = {
        ...(typeof b.displayName === 'string'
          ? { displayName: string(b.displayName, 'displayName') }
          : {}),
        ...(typeof b.email === 'string' ? { email: string(b.email, 'email') } : {}),
        ...(typeof b.organizationId === 'string'
          ? { organizationId: uuid(b.organizationId, 'organizationId') }
          : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
      };
      yield projectedReply(
        dependencies.employees.update(
          uuid(id, 'employeeId'),
          context.actor.companyId,
          patch,
          version(b.version),
          context.actor,
          grant.scopes,
          grant.anchors,
          correlationId,
        ),
        (updated) => {
          return { statusCode: 200, body: updated };
        },
      );
    }
  }
}
