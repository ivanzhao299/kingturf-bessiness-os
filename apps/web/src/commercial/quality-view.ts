import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { appendComplaints } from './complaints-view';
import { appendQualityPlans } from './quality-plans';
import { appendQualityInspections } from './quality-inspections';
import { appendTraceability } from './quality-traceability';

export function appendQualityView(context: OperationsViewContext): void {
  const { workspace, status, controller } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'quality-workbench');
  panel.setAttribute('data-testid', 'quality-workbench');
  panel.append(
    el('p', 'eyebrow', '质量与仓储'),
    el('h2', '', '质量检验与批次追溯'),
    el('p', 'commercial-help', '检验计划、质量处置与批次放行'),
  );
  const plans = controller.views.get('/api/v1/quality-plans') ?? [];
  const inspections = controller.views.get('/api/v1/quality-inspections') ?? [];
  const lots = controller.views.get('/api/v1/lot-traceability') ?? [];
  const refresh = async () => {
    await controller.load();
    status.textContent = controller.message;
  };
  const qualitySummary = el('div', 'production-summary');
  qualitySummary.append(
    el(
      'div',
      'metric-card',
      `待抽样\n${String(inspections.filter((item) => recordText(item, 'state', 'state') === 'OPEN').length)} 单`,
    ),
    el(
      'div',
      'metric-card',
      `检验进行中\n${String(inspections.filter((item) => recordText(item, 'state', 'state') === 'SAMPLED').length)} 单`,
    ),
    el(
      'div',
      'metric-card',
      `待质量处置\n${String(inspections.filter((item) => recordText(item, 'state', 'state') === 'COMPLETED').length)} 单`,
    ),
    el(
      'div',
      'metric-card',
      `隔离批次\n${String(lots.filter((item) => recordText(item, 'qualityStatus', 'qualityStatus') === 'QUARANTINE').length)} 批`,
    ),
  );
  panel.append(qualitySummary);
  appendComplaints(context, panel, refresh);
  appendQualityPlans(context, panel, plans, refresh);

  appendQualityInspections(context, panel, plans, inspections, lots, refresh);

  appendTraceability(context, panel, lots);
  workspace.append(panel);
}
