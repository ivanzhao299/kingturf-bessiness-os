import type { GovernanceActionContext } from './workspace-types';
export function createGovernanceOrdering(
  context: Pick<GovernanceActionContext, 'visible' | 'views'>,
) {
  const { visible, views } = context;
  const surfacePriority: Readonly<Record<string, number>> = {
    workflow: 0,
    notifications: 1,
    'event-operations': 2,
    'identity-access': 3,
    audit: 4,
  };
  const prioritizedSurfaces = [...visible].sort((left, right) => {
    const leftFailures = views.filter(
      (view) => left.paths.includes(view.path) && view.error !== undefined,
    ).length;
    const rightFailures = views.filter(
      (view) => right.paths.includes(view.path) && view.error !== undefined,
    ).length;
    if (leftFailures !== rightFailures) return rightFailures - leftFailures;
    return (surfacePriority[left.id] ?? 20) - (surfacePriority[right.id] ?? 20);
  });
  return { prioritizedSurfaces };
}
