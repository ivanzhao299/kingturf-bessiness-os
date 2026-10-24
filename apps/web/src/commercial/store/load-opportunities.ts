import type { CommercialController } from './controller';
import { noteCommercialSourceRead } from './read-owner';
export function startCommercialOpportunityLoad(
  controller: Pick<CommercialController, 'permissions' | 'api' | 'opportunities'>,
  failures: string[],
) {
  return controller.permissions.has('opportunity:read')
    ? controller.api
        .listOpportunities()
        .then((value) => {
          controller.opportunities = value;
          noteCommercialSourceRead(controller, '/api/v1/opportunities');
        })
        .catch(() => {
          controller.opportunities = [];
          failures.push('商机');
        })
    : Promise.resolve();
}
