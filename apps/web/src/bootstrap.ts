import { createBootstrapView } from '@kingturf/ui';

export const BOOTSTRAP_TITLE = 'KingTurf Business OS';

export function bootstrap(root: HTMLElement): void {
  root.replaceChildren(createBootstrapView(BOOTSTRAP_TITLE));
}
