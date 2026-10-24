import type { Opportunity } from './types';
import { recordText } from '../shared/business-format';

export type ContractOrderReadinessStep = Readonly<{
  key: 'quote' | 'credit' | 'contract' | 'order';
  label: string;
  count: number;
  state: 'complete' | 'current' | 'blocked';
}>;

export function contractOrderReadiness(
  quotes: readonly Record<string, unknown>[],
  decisions: readonly Record<string, unknown>[],
  contracts: readonly Record<string, unknown>[],
  orders: readonly Record<string, unknown>[],
): readonly ContractOrderReadinessStep[] {
  const counts = [
    quotes.filter((item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string')
      .length,
    decisions.filter(
      (item) => recordText(item, 'effectiveStatus', 'effective_status') === 'APPROVED',
    ).length,
    contracts.filter(
      (item) =>
        recordText(item, 'effectiveStatus', 'effectiveStatus') === 'SIGNED' &&
        Boolean(recordText(item, 'signatureEvidenceId', 'signature_evidence_id')),
    ).length,
    orders.length,
  ] as const;
  const firstMissing = counts.findIndex((count) => count === 0);
  return (['quote', 'credit', 'contract', 'order'] as const).map((key, index) => {
    const count = counts[index] ?? 0;
    return {
      key,
      label: ['已签发报价', '有效信用', '已签合同', '已释放订单'][index] ?? key,
      count,
      state:
        count > 0
          ? 'complete'
          : index === (firstMissing === -1 ? counts.length - 1 : firstMissing)
            ? 'current'
            : 'blocked',
    };
  });
}

export type OpportunityPipelineSummary = Readonly<{
  active: number;
  overdue: number;
  closingSoon: number;
  customerMissing: number;
}>;

export function opportunityPipelineSummary(
  opportunities: readonly Opportunity[],
  today = new Date().toISOString().slice(0, 10),
): OpportunityPipelineSummary {
  const active = opportunities.filter((item) => !['WON', 'LOST'].includes(item.status ?? 'OPEN'));
  const horizon = new Date(`${today}T00:00:00.000Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const horizonDate = horizon.toISOString().slice(0, 10);
  return {
    active: active.length,
    overdue: active.filter(
      (item) =>
        Boolean(item.expectedCloseDate) && String(item.expectedCloseDate).slice(0, 10) < today,
    ).length,
    closingSoon: active.filter((item) => {
      const date = item.expectedCloseDate?.slice(0, 10);
      return Boolean(date && date >= today && date <= horizonDate);
    }).length,
    customerMissing: active.filter((item) => !item.customerId).length,
  };
}

export type QuoteWorkflowReadinessStep = Readonly<{
  key: 'ctr' | 'solution' | 'cost' | 'policy' | 'quote';
  label: string;
  count: number;
  state: 'complete' | 'current' | 'blocked';
}>;

export function quoteWorkflowReadiness(
  ctrs: readonly Record<string, unknown>[],
  solutions: readonly Record<string, unknown>[],
  costs: readonly Record<string, unknown>[],
  policies: readonly Record<string, unknown>[],
  quotes: readonly Record<string, unknown>[],
): readonly QuoteWorkflowReadinessStep[] {
  const counts = [
    ctrs.filter((item) => item.status === 'APPROVED').length,
    solutions.filter((item) => item.status === 'FINAL').length,
    costs.length,
    policies.filter((item) => item.status === 'PUBLISHED').length,
    quotes.length,
  ] as const;
  const firstMissing = counts.findIndex((count) => count === 0);
  return (['ctr', 'solution', 'cost', 'policy', 'quote'] as const).map((key, index) => {
    const count = counts[index] ?? 0;
    return {
      key,
      label: ['已批准技术需求', '定稿方案', '成本决策', '已发布政策', '报价版本'][index] ?? key,
      count,
      state:
        count > 0
          ? 'complete'
          : index === (firstMissing === -1 ? counts.length - 1 : firstMissing)
            ? 'current'
            : 'blocked',
    };
  });
}

export type CashRiskSummary = Readonly<{
  overdueReceivables: number;
  unappliedPayments: number;
  brokenPromises: number;
  legalPending: number;
}>;

export function cashRiskSummary(
  receivables: readonly Record<string, unknown>[],
  payments: readonly Record<string, unknown>[],
  collectionCases: readonly Record<string, unknown>[],
  today = new Date().toISOString().slice(0, 10),
): CashRiskSummary {
  const handoffs = collectionCases.flatMap((item) =>
    Array.isArray(item.legalHandoffs)
      ? item.legalHandoffs.filter(
          (handoff): handoff is Record<string, unknown> =>
            typeof handoff === 'object' && handoff !== null,
        )
      : [],
  );
  return {
    overdueReceivables: receivables.filter(
      (item) =>
        Number(recordText(item, 'remainingAmount', 'remaining_amount', '0')) > 0 &&
        recordText(item, 'dueAt', 'due_at').slice(0, 10) < today,
    ).length,
    unappliedPayments: payments.filter(
      (item) => Number(recordText(item, 'remainingAmount', 'remaining_amount', '0')) > 0,
    ).length,
    brokenPromises: collectionCases.filter(
      (item) => recordText(item, 'state', 'state') === 'PROMISE_BROKEN',
    ).length,
    legalPending: handoffs.filter((item) => recordText(item, 'state', 'state') === 'REQUESTED')
      .length,
  };
}
