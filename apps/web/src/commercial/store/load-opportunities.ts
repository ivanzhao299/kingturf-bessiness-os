import type { CommercialController } from './controller';
export function startCommercialOpportunityLoad(
  controller: Pick<CommercialController, 'permissions' | 'api' | 'opportunities'>,
  failures: string[],
) {
  return controller.permissions.has('opportunity:read')
    ? controller.api
        .listOpportunities()
        .then((value) => {
          controller.opportunities = value;
        })
        .catch(() => {
          controller.opportunities = [];
          failures.push('商机');
        })
    : Promise.resolve();
}
