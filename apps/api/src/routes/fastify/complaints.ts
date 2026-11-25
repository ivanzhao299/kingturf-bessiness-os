import { DomainError } from '@kingturf/domain';
import { guardRejection } from '../../pg-rejections.ts';
import { complaintsAttempts } from '../dispatch/complaints.ts';
import { legacyRequest, runLegacyAttempts } from './legacy-attempts.ts';
import type { FastifyRouteGroupApp, FastifyRouteScope } from './registry.ts';

const complaints = '/api/v1/complaints';
const sla = '/api/v1/complaint-sla-policies';
const complaintGuardHints = {
  'complaint version conflict': '投诉已更新，请刷新后重试。',
  'complaint reporter cannot close own complaint': '请由投诉登记人以外的人员关闭投诉。',
  'major complaint closure requires verified CAPA': '重大或紧急投诉须完成整改验证方可关闭。',
  'NCR version conflict': '不合格报告已更新，请刷新后重试。',
  'root cause confirmation requires structured analysis': '请填写根因分析方法和结论。',
  'NCR disposition requires approval': '处置方案须经审批。',
  'major NCR investigator cannot approve own disposition': '请由质量调查员以外的人员批准处置。',
  'CAPA verification requires all actions complete and ready state': '请完成所有整改措施后再验证。',
  'CAPA action owner cannot verify own action': '请由措施负责人以外的人员验证。',
};

export function registerComplaintRoutes(app: FastifyRouteGroupApp, scope: FastifyRouteScope) {
  for (const path of [complaints, `${complaints}/:id`, sla]) {
    app.get(path, async (request) => {
      const result = await runLegacyAttempts(scope, legacyRequest(request), complaintsAttempts);
      return result.body;
    });
  }
  for (const path of [
    complaints,
    sla,
    `${complaints}/batch-triage`,
    ...['triage', 'investigate', 'reject', 'close', 'ncrs'].map(
      (action) => `${complaints}/:id/${action}`,
    ),
    ...['contain', 'root-cause', 'disposition', 'close', 'capas'].map(
      (action) => `/api/v1/ncrs/:id/${action}`,
    ),
    ...['actions', 'verify', 'close'].map((action) => `/api/v1/capas/:id/${action}`),
    '/api/v1/capa-actions/:id/complete',
  ]) {
    app.post(path, async (request, reply) => {
      try {
        const result = await runLegacyAttempts(scope, legacyRequest(request), complaintsAttempts);
        void reply.code(result.statusCode);
        return result.body;
      } catch (error: unknown) {
        const hint = guardRejection(error, complaintGuardHints);
        if (hint) throw new DomainError('conflict', hint);
        throw error;
      }
    });
  }
}
