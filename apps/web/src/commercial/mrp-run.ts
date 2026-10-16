import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { createMrpProposalCard } from './mrp-proposals';

export function appendMrpRun(
  context: OperationsViewContext,
  panel: HTMLElement,
  latestRun: Record<string, unknown>,
  refresh: () => Promise<void>,
): void {
  const { recordValue, recordText, businessStateLabel } = context.ports;
  const runPanel = el('article', 'mrp-run-card');
  runPanel.append(
    el(
      'h3',
      '',
      `${recordText(latestRun, 'runNumber', 'run_number')} · ${businessStateLabel(recordText(latestRun, 'status', 'status'))}`,
    ),
    el(
      'p',
      'muted',
      `基准 ${recordText(latestRun, 'asOf', 'as_of').slice(0, 10)} · 冻结至 ${recordText(latestRun, 'freezeUntil', 'freeze_until')} · 输入哈希 ${recordText(latestRun, 'inputHash', 'input_hash').slice(0, 16)}…`,
    ),
  );
  const proposals = Array.isArray(latestRun.proposals) ? latestRun.proposals.map(recordValue) : [];
  const proposalPriority: Readonly<Record<string, number>> = {
    PROPOSED: 0,
    APPROVED: 1,
    RELEASED: 2,
    REJECTED: 3,
  };
  const proposalGrid = el('div', 'mrp-proposal-grid');
  for (const proposal of [...proposals].sort((left, right) => {
    const leftState = recordText(left, 'effectiveState', 'effectiveState');
    const rightState = recordText(right, 'effectiveState', 'effectiveState');
    return (proposalPriority[leftState] ?? 9) - (proposalPriority[rightState] ?? 9);
  })) {
    const card = createMrpProposalCard(context, proposal, refresh);
    proposalGrid.append(card);
  }
  runPanel.append(proposalGrid);
  panel.append(runPanel);
}
