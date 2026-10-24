import type { PricingViewContext } from './pricing-view-ports';

export function createCostMatrixBindings(context: PricingViewContext, matrixSection: HTMLElement) {
  const { workspace, status, controller } = context;
  const { textValue, replaceRouteView, rebuildWorkspace } = context.ports;
  const costDialogHost = () =>
    matrixSection.closest<HTMLElement>('.commercial-workspace') ?? workspace;
  const setCostStatus = (message: string) => {
    const liveStatus = costDialogHost().querySelector<HTMLElement>('.commercial-status');
    (liveStatus ?? status).textContent = message;
  };
  const replaceCostMatrixSection = (accepted = true) => {
    if (!accepted) return;
    const host = costDialogHost();
    const focused = document.activeElement;
    const input =
      typeof HTMLInputElement !== 'undefined' &&
      focused instanceof HTMLInputElement &&
      matrixSection.contains(focused)
        ? focused
        : null;
    const label = input?.getAttribute('aria-label');
    const selection = input ? ([input.selectionStart, input.selectionEnd] as const) : null;
    const refreshedSection = rebuildWorkspace().querySelector<HTMLElement>('.cost-matrix-section');
    const liveSection = host.querySelector<HTMLElement>('.cost-matrix-section');
    if (refreshedSection && liveSection) {
      replaceRouteView(liveSection, refreshedSection);
      restoreCostInput(input, label, selection, refreshedSection);
    }
  };
  const refreshCostWorkspace = async (message: string) => {
    await controller.loadCostMatrixPage();
    await controller.refreshSelectedCostMatrix();
    controller.message = message;
    setCostStatus(message);
    replaceCostMatrixSection();
  };
  const openMatrix = (matrix: Record<string, unknown>, trigger: HTMLButtonElement) => {
    void (async () => {
      trigger.disabled = true;
      trigger.textContent = '加载中…';
      trigger.setAttribute('aria-busy', 'true');
      try {
        await controller.openCostMatrix(textValue(matrix.id, ''));
        replaceCostMatrixSection();
      } catch (failure) {
        setCostStatus(
          failure instanceof Error ? `模型详情加载失败：${failure.message}` : '模型详情加载失败',
        );
        trigger.disabled = false;
        trigger.textContent = '查看模型';
        trigger.setAttribute('aria-busy', 'false');
      }
    })();
  };
  return {
    costDialogHost,
    setCostStatus,
    replaceCostMatrixSection,
    refreshCostWorkspace,
    openMatrix,
  };
}

function restoreCostInput(
  input: HTMLInputElement | null,
  label: string | null | undefined,
  selection: readonly [number | null, number | null] | null,
  refreshedSection: HTMLElement,
): void {
  if (input && label) {
    const replacement = Array.from(refreshedSection.querySelectorAll('input')).find(
      (item) => item.getAttribute('aria-label') === label,
    );
    if (replacement) {
      replacement.value = input.value;
      replacement.focus();
      if (selection) replacement.setSelectionRange(...selection);
    }
  }
}
