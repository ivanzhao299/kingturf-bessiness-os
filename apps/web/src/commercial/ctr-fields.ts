export const ctrRequirementFields = [
  ['application', '应用场景'],
  ['projectRegion', '项目地区'],
  ['performanceStandard', '执行标准'],
  ['pileHeightMm', '草高（mm）'],
  ['quantitySquareMeters', '预计面积（㎡）'],
  ['color', '颜色要求'],
  ['baseCondition', '场地基础'],
  ['drainageRequirement', '排水要求'],
  ['fireRating', '阻燃要求'],
  ['warrantyYears', '质保年限'],
  ['delivery', '交付要求'],
] as const;

export function technicalSolutionOpportunityId(
  ctrs: readonly Record<string, unknown>[],
  ctrVersionId: string,
): string {
  const ctr = ctrs.find((item) => item.id === ctrVersionId && item.status === 'APPROVED');
  if (!ctr || typeof ctr.opportunityId !== 'string' || ctr.opportunityId.length === 0)
    throw new Error('所选技术需求单不可用或缺少关联商机');
  return ctr.opportunityId;
}
