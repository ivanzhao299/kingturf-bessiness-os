import { el } from '../../dom';
import type { OperationsViewContext } from '../operations-view-ports';

export function appendQualityConsole(context: OperationsViewContext): void {
  const section = el('section', 'commercial-console quality-workbench');
  section.setAttribute('data-testid', 'kt-qi-console');
  section.setAttribute('data-route-view', 'quality-inspection');
  context.workspace.append(section);
  void import('./quality-console').then(({ mountQualityConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountQualityConsole(section, context);
  });
}
