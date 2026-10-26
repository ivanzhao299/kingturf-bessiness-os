import { assertStableCode, DomainError, parseEffectiveTimestamp } from '@kingturf/domain';
import {
  allow,
  effectiveRange,
  error,
  integer,
  objectBody,
  string,
  strings,
  uuid,
  version,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import {
  masterCategoryCreateRoutes,
  masterCategoryDeleteRoutes,
  masterCategoryReadRoutes,
  masterCategoryUpdateRoutes,
} from '../master-data-categories.ts';
import {
  masterEntryCreateRoutes,
  masterEntryDeleteRoutes,
  masterEntryDetailRoutes,
  masterEntryListRoutes,
  masterEntryUpdateRoutes,
} from '../master-data-entries.ts';
import { numberAllocationRoutes } from '../number-allocation.ts';
import {
  numberDefinitionCreateRoutes,
  numberDefinitionListRoutes,
  numberDefinitionPublishRoutes,
  numberDefinitionVersionRoutes,
} from '../number-definitions.ts';
import {
  ruleDefinitionCreateRoutes,
  ruleDefinitionListRoutes,
  ruleDefinitionPublishRoutes,
  ruleDefinitionVersionRoutes,
} from '../rule-definitions.ts';
import { ruleEvaluationRoutes } from '../rule-evaluation.ts';
import { dispatchRoutes } from '../types.ts';
import {
  workflowDefinitionCreateRoutes,
  workflowDefinitionListRoutes,
  workflowDefinitionPublishRoutes,
  workflowDefinitionVersionRoutes,
} from '../workflow-definitions.ts';
import {
  workflowRuntimeDecisionRoutes,
  workflowRuntimeStartRoutes,
  workflowRuntimeTaskListRoutes,
} from '../workflow-runtime.ts';
import {
  directReply,
  routeReply,
  type RouteAttempts,
  type RouteDispatchContext,
} from './context.ts';
function* catalogPart1(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (request.pathname === '/api/v1/master-data/categories' && request.method === 'GET') {
    authorizeQuery(context, 'master-data:read');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterCategoryReadRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          parseEffectiveTimestamp,
        }),
        request,
      ),
      'truthy',
    );
  }
  if (request.pathname === '/api/v1/master-data/categories' && request.method === 'POST') {
    authorizeQuery(context, 'master-data:create');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterCategoryCreateRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, effectiveRange, string, stableCode: assertStableCode },
        }),
        request,
      ),
      'truthy',
    );
  }
  const category = /^\/api\/v1\/master-data\/categories\/([0-9a-f-]+)$/u.exec(request.pathname);
  if (category && request.method === 'PATCH') {
    authorizeQuery(context, 'master-data:update');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterCategoryUpdateRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, effectiveRange, uuid, string, version },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (category && request.method === 'DELETE') {
    authorizeQuery(context, 'master-data:delete');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterCategoryDeleteRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          correlationId,
          uuid,
          version,
        }),
        request,
      ),
      'truthy',
    );
  }
  if (request.pathname === '/api/v1/master-data/entries' && request.method === 'POST') {
    authorizeQuery(context, 'master-data:create');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterEntryCreateRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          correlationId,
          parsers: {
            objectBody,
            allow,
            effectiveRange,
            uuid,
            string,
            stableCode: assertStableCode,
          },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (request.pathname === '/api/v1/number-definitions' && request.method === 'GET') {
    authorizeQuery(context, 'number:read');
    if (!dependencies.numbers) {
      yield directReply(
        error(503, 'internal_error', 'Number repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        numberDefinitionListRoutes({ repository: dependencies.numbers, actor: context.actor }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/number-definitions' && request.method === 'POST') {
    authorizeQuery(context, 'number:create');
    if (!dependencies.numbers) {
      yield directReply(
        error(503, 'internal_error', 'Number repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        numberDefinitionCreateRoutes({
          repository: dependencies.numbers,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, string, integer, stableCode: assertStableCode },
        }),
        request,
      ),
    );
  }
  const publishNumber = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/publish$/u.exec(
    request.pathname,
  );
  if (publishNumber && request.method === 'POST') {
    authorizeQuery(context, 'number:update');
    if (!dependencies.numbers) {
      yield directReply(
        error(503, 'internal_error', 'Number repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        numberDefinitionPublishRoutes({
          repository: dependencies.numbers,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, version },
        }),
        request,
      ),
    );
  }
  const allocate = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/allocate$/u.exec(
    request.pathname,
  );
  if (allocate && request.method === 'POST') {
    authorizeQuery(context, 'number:allocate');
    if (!dependencies.numbers) {
      yield directReply(
        error(503, 'internal_error', 'Number repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        numberAllocationRoutes({
          repository: dependencies.numbers,
          actor: context.actor,
          correlationId,
          uuid,
          keyRequired: () => {
            throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          },
        }),
        request,
      ),
    );
  }
}
function* catalogPart2(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (request.pathname === '/api/v1/rules' && request.method === 'GET') {
    authorizeQuery(context, 'rule:read');
    if (!dependencies.rules) {
      yield directReply(error(503, 'internal_error', 'Rule repository unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        ruleDefinitionListRoutes({ repository: dependencies.rules, actor: context.actor }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/rules' && request.method === 'POST') {
    authorizeQuery(context, 'rule:create');
    if (!dependencies.rules) {
      yield directReply(error(503, 'internal_error', 'Rule repository unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        ruleDefinitionCreateRoutes({
          repository: dependencies.rules,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, string, strings, stableCode: assertStableCode },
        }),
        request,
      ),
    );
  }
  const publishRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
  if (publishRule && request.method === 'POST') {
    authorizeQuery(context, 'rule:update');
    if (!dependencies.rules) {
      yield directReply(error(503, 'internal_error', 'Rule repository unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        ruleDefinitionPublishRoutes({
          repository: dependencies.rules,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, version },
        }),
        request,
      ),
    );
  }
  const evaluateRule = /^\/api\/v1\/rules\/([0-9a-f-]+)\/evaluate$/u.exec(request.pathname);
  if (evaluateRule && request.method === 'POST') {
    authorizeQuery(context, 'rule:evaluate');
    if (!dependencies.rules) {
      yield directReply(error(503, 'internal_error', 'Rule repository unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        ruleEvaluationRoutes({
          repository: dependencies.rules,
          actor: context.actor,
          correlationId,
          objectBody,
          allow,
          uuid,
          keyRequired: () => {
            throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/master-data/entries' && request.method === 'GET') {
    authorizeQuery(context, 'master-data:read');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterEntryListRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          uuid,
          parseEffectiveTimestamp,
        }),
        request,
      ),
      'truthy',
    );
  }
  const entry = /^\/api\/v1\/master-data\/entries\/([0-9a-f-]+)$/u.exec(request.pathname);
  if (entry && request.method === 'GET') {
    authorizeQuery(context, 'master-data:read');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterEntryDetailRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          uuid,
          parseEffectiveTimestamp,
          notFound: () => error(404, 'not_found', 'Master-data entry not found', correlationId),
        }),
        request,
      ),
      'truthy',
    );
  }
  if (entry && request.method === 'PATCH') {
    authorizeQuery(context, 'master-data:update');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterEntryUpdateRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, effectiveRange, uuid, string, version },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (entry && request.method === 'DELETE') {
    authorizeQuery(context, 'master-data:delete');
    if (!dependencies.masterData) {
      yield directReply(
        error(503, 'internal_error', 'Master-data repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        masterEntryDeleteRoutes({
          repository: dependencies.masterData,
          actor: context.actor,
          correlationId,
          uuid,
          version,
        }),
        request,
      ),
      'truthy',
    );
  }
  const numberVersion = /^\/api\/v1\/number-definitions\/([0-9a-f-]+)\/versions$/u.exec(
    request.pathname,
  );
  if (numberVersion && request.method === 'POST') {
    authorizeQuery(context, 'number:update');
    if (!dependencies.numbers) {
      yield directReply(
        error(503, 'internal_error', 'Number repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        numberDefinitionVersionRoutes({
          repository: dependencies.numbers,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, string, integer },
        }),
        request,
      ),
    );
  }
}
function* catalogPart3(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const ruleVersion = /^\/api\/v1\/rules\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
  if (ruleVersion && request.method === 'POST') {
    authorizeQuery(context, 'rule:update');
    if (!dependencies.rules) {
      yield directReply(error(503, 'internal_error', 'Rule repository unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        ruleDefinitionVersionRoutes({
          repository: dependencies.rules,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, strings },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/workflows' && request.method === 'GET') {
    authorizeQuery(context, 'workflow:read');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowDefinitionListRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/workflows' && request.method === 'POST') {
    authorizeQuery(context, 'workflow:create');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowDefinitionCreateRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, string, stableCode: assertStableCode },
        }),
        request,
      ),
    );
  }
  const workflowVersion = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
  if (workflowVersion && request.method === 'POST') {
    authorizeQuery(context, 'workflow:update');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowDefinitionVersionRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid },
        }),
        request,
      ),
    );
  }
  const workflowPublish = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
  if (workflowPublish && request.method === 'POST') {
    authorizeQuery(context, 'workflow:update');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowDefinitionPublishRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, version },
        }),
        request,
      ),
    );
  }
  const workflowStart = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/instances$/u.exec(request.pathname);
  if (workflowStart && request.method === 'POST') {
    authorizeQuery(context, 'workflow:start');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowRuntimeStartRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, string },
          missingKey: (): never => {
            throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          },
        }),
        request,
      ),
    );
  }
  if (request.pathname === '/api/v1/workflow-tasks' && request.method === 'GET') {
    authorizeQuery(context, 'workflow:decide');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowRuntimeTaskListRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
        }),
        request,
      ),
    );
  }
  const decide = /^\/api\/v1\/workflow-tasks\/([0-9a-f-]+)\/decisions$/u.exec(request.pathname);
  if (decide && request.method === 'POST') {
    authorizeQuery(context, 'workflow:decide');
    if (!dependencies.workflows) {
      yield directReply(
        error(503, 'internal_error', 'Workflow repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        workflowRuntimeDecisionRoutes({
          repository: dependencies.workflows,
          actor: context.actor,
          correlationId,
          parsers: { objectBody, allow, uuid, string, version },
          missingKey: (): never => {
            throw new DomainError('invalid_request', 'Idempotency-Key header is required');
          },
        }),
        request,
      ),
    );
  }
}
export function* catalogAttempts(scope: RouteDispatchContext): RouteAttempts {
  yield* catalogPart1(scope);
  yield* catalogPart2(scope);
  yield* catalogPart3(scope);
}
