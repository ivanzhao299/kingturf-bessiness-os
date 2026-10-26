import { DomainError } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';

export function assertQuotePolicyEvaluation(
  policyEvaluation:
    | {
        sales_policy_version_id: string;
        cost_decision_id: string;
        canonical_input: JsonObject;
        passed: boolean;
        minimum_margin_basis_points: number | null;
        maximum_discount_basis_points: number | null;
      }
    | undefined,
  input: { policyVersionId: string; costDecisionId: string },
  serverMarginBasisPoints: number,
  serverDiscountBasisPoints: number,
) {
  if (!policyEvaluation)
    throw new DomainError('invalid_request', 'Policy evaluation was not found');
  if (
    policyEvaluation.sales_policy_version_id !== input.policyVersionId ||
    policyEvaluation.cost_decision_id !== input.costDecisionId ||
    policyEvaluation.canonical_input.marginBasisPoints !== serverMarginBasisPoints ||
    policyEvaluation.canonical_input.discountBasisPoints !== serverDiscountBasisPoints ||
    !policyEvaluation.passed ||
    (policyEvaluation.minimum_margin_basis_points !== null &&
      serverMarginBasisPoints < policyEvaluation.minimum_margin_basis_points) ||
    (policyEvaluation.maximum_discount_basis_points !== null &&
      serverDiscountBasisPoints > policyEvaluation.maximum_discount_basis_points)
  )
    throw new DomainError(
      'invalid_request',
      'Policy evaluation does not match the actual quote economics',
    );
}
