import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { asSelfApproval } from '../write-rejection-mapping.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type ApproveCredit = Qtc['approveCredit'];
type ScopeContext = Readonly<Parameters<ApproveCredit>[4]>;
type ValidatedApproval = Readonly<{
  repository: Pick<Qtc, 'approveCredit'>;
  approveCredit: ApproveCredit;
  id: Parameters<ApproveCredit>[0];
  decision: Parameters<ApproveCredit>[1];
  reason: Parameters<ApproveCredit>[2];
  key: Parameters<ApproveCredit>[3];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Pick<Qtc, 'approveCredit'>;
  rawId: string | undefined;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<ApproveCredit>[5];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcCreditApprovalRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) =>
        /^\/api\/v1\/credit-decisions\/([0-9a-f-]+)\/approve$/u.test(pathname)
          ? { params: [] }
          : null,
      validate: (request): ValidatedApproval => {
        context.parsers.allow(context.body, ['decision', 'reason']);
        const d = context.parsers.string(context.body.decision, 'decision');
        if (!['APPROVED', 'REJECTED'].includes(d))
          throw new DomainError('invalid_request', 'decision is unsupported');
        const repository = context.repository();
        const approveCredit = repository.approveCredit;
        const id = context.parsers.uuid(context.rawId, 'creditDecisionId');
        const decision = d as Parameters<ApproveCredit>[1];
        const reason = context.parsers.string(context.body.reason, 'reason');
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('credit:approve');
        return { repository, approveCredit, id, decision, reason, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        // TD-WF-013（WF-A，主协调裁定）：评估人自批由职责分离触发器拒绝（迁移 0026），
        // 这里映射成 403 + 中文说明，与桥轨 PUT /state 的提示一致（此前两条轨都是 500）。
        // 映射落在本路由自己的处理链上：仓储方法 approveCredit 是两条轨共用的，不动它；
        // 也不改桥的认领清单。只包住这一次调用，不新增对依赖/授权/仓储的任何访问。
        let result: Awaited<ReturnType<ApproveCredit>>;
        try {
          result = await validated.approveCredit.call(
            validated.repository,
            validated.id,
            validated.decision,
            validated.reason,
            validated.key,
            validated.scopeContext,
            context.correlationId,
          );
        } catch (error) {
          throw asSelfApproval(error);
        }
        return {
          statusCode: 200,
          body: context.mutationDto(result, context.authorization, 'credit:read'),
        };
      },
    }),
  ];
}
