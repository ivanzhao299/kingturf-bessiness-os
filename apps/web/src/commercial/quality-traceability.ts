import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';

export function appendTraceability(
  context: OperationsViewContext,
  panel: HTMLElement,
  lots: readonly Record<string, unknown>[],
): void {
  const { permissions } = context;
  const { recordText, businessStateLabel } = context.ports;
  if (permissions.has('traceability:read')) {
    const traceability = el('article', 'quality-section traceability-section');
    traceability.append(el('h3', '', '批次追溯与库存状态'));
    for (const lot of lots) {
      const used = Array.isArray(lot.usedByOrders) ? lot.usedByOrders.length : 0;
      const produced = Array.isArray(lot.producedRolls) ? lot.producedRolls.length : 0;
      traceability.append(
        el(
          'article',
          'traceability-card',
          `${recordText(lot, 'lotNumber', 'lotNumber')} · ${recordText(lot, 'sku', 'sku')} · ${businessStateLabel(recordText(lot, 'qualityStatus', 'qualityStatus'))}\n使用工单 ${String(used)} · 成品卷 ${String(produced)} · 移动 ${String(Array.isArray(lot.movements) ? lot.movements.length : 0)} 笔`,
        ),
      );
    }
    if (!lots.length) traceability.append(el('p', 'pipeline-empty', '暂无批次追溯记录。'));
    panel.append(traceability);
  }
}
