import type { CommercialController } from './controller';
import type { readableCommercialSources } from './readable-sources';
import { noteCommercialSourceRead } from './read-owner';
export function startCommercialViewLoad(
  controller: Pick<CommercialController, 'api' | 'views' | 'loadCostMatrixPage'>,
  readableViews: readonly ReturnType<typeof readableCommercialSources>[number][],
  failures: string[],
) {
  return Promise.allSettled(
    readableViews.map(async ([, path]) => {
      if (path !== '/api/v1/cost-matrices') return [path, await controller.api.list(path)] as const;
      await controller.loadCostMatrixPage();
      return [path, controller.views.get(path) ?? []] as const;
    }),
  ).then((results) => {
    results.forEach((result, index) => {
      const source = readableViews[index];
      if (!source) return;
      if (result.status === 'fulfilled') {
        if (result.value[0] !== '/api/v1/cost-matrices') {
          controller.views.set(result.value[0], result.value[1]);
          noteCommercialSourceRead(controller, result.value[0]);
        }
      } else failures.push(source[1]);
    });
  });
}
