import { openForm } from '../shared/forms';
import type { OperationsViewContext } from './operations-view-ports';
import {
  openCapaCreate,
  openCapaAction,
  openCapaComplete,
  openCapaVerify,
  openCapaClose,
} from './capa-forms';

export async function runComplaintWorkflow(
  context: OperationsViewContext,
  complaint: Record<string, unknown>,
  id: string,
  command: (action: 'investigate' | 'close', label: string, description: string) => void,
  refresh: () => Promise<void>,
): Promise<void> {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, requestId } = context.ports;
  const detail = await controller.api.get?.(`/api/v1/complaints/${id}`);
  if (!detail) return;
  const ncr = recordValue(detail.ncr);
  const capa = recordValue(ncr.capa);
  const ncrId = recordText(ncr, 'id', 'id');
  const ncrState = recordText(ncr, 'state', 'state');
  const ncrVersion = Number(ncr.version ?? 0);
  const capaId = recordText(capa, 'id', 'id');
  const capaState = recordText(capa, 'state', 'state');
  const capaVersion = Number(capa.version ?? 0);
  const evidenceFields = [
    { name: 'reason', label: '处理说明', type: 'textarea' as const, required: true },
    { name: 'evidenceReference', label: '证据编号', required: true },
  ];
  const transitionNcr = (
    action: 'contain' | 'root-cause' | 'disposition' | 'close',
    title: string,
    extra: Parameters<typeof openForm>[3] = [],
  ) => {
    openForm(
      workspace,
      title,
      '填写业务结论和可追溯证据后提交。',
      [...extra, ...evidenceFields],
      `确认${title}`,
      async (values) => {
        await controller.submit(`/api/v1/ncrs/${ncrId}/${action}`, {
          expectedVersion: ncrVersion,
          reason: values.reason,
          evidence: { reference: values.evidenceReference },
          ...(action === 'root-cause'
            ? {
                rootCauseMethod: values.rootCauseMethod,
                rootCause: { conclusion: values.rootCause },
              }
            : {}),
          ...(action === 'disposition' ? { disposition: values.disposition } : {}),
          idempotencyKey: requestId(),
        });
        await refresh();
      },
    );
  };
  if (ncrState === 'OPEN' && permissions.has('ncr:manage')) {
    transitionNcr('contain', '确认临时遏制');
    return;
  }
  if (ncrState === 'CONTAINED' && permissions.has('ncr:manage')) {
    transitionNcr('root-cause', '确认根本原因', [
      {
        name: 'rootCauseMethod',
        label: '分析方法',
        type: 'select',
        required: true,
        options: [
          { value: 'FIVE_WHY', label: '五个为什么' },
          { value: 'FISHBONE', label: '鱼骨图' },
          { value: 'FAULT_TREE', label: '故障树' },
          { value: 'OTHER', label: '其他方法' },
        ],
      },
      { name: 'rootCause', label: '根本原因结论', type: 'textarea', required: true },
    ]);
    return;
  }
  if (ncrState === 'ROOT_CAUSE_CONFIRMED' && permissions.has('ncr:disposition')) {
    transitionNcr('disposition', '批准处置方案', [
      {
        name: 'disposition',
        label: '处置方式',
        type: 'select',
        required: true,
        options: [
          { value: 'REWORK', label: '返工' },
          { value: 'REPAIR', label: '修复' },
          { value: 'CONCESSION', label: '让步接收' },
          { value: 'RETURN', label: '退货' },
          { value: 'SCRAP', label: '报废' },
          { value: 'SUPPLIER_CLAIM', label: '供应商索赔' },
        ],
      },
    ]);
    return;
  }
  if (ncrState === 'DISPOSITIONED' && !capaId && permissions.has('capa:manage')) {
    openCapaCreate(context, complaint, ncrId, refresh);
    return;
  }
  const actions = Array.isArray(capa.actions) ? capa.actions.map(recordValue) : [];
  const incomplete = actions.find((item) => !item.completion);
  if (
    capaId &&
    ['OPEN', 'ACTIONS_IN_PROGRESS'].includes(capaState) &&
    permissions.has('capa:manage') &&
    !actions.length
  ) {
    openCapaAction(context, capaId, capaVersion, refresh);
    return;
  }
  if (incomplete && permissions.has('capa:manage')) {
    openCapaComplete(context, incomplete, capaVersion, refresh);
    return;
  }
  if (capaState === 'READY_FOR_VERIFICATION' && permissions.has('capa:verify')) {
    openCapaVerify(context, complaint, capaId, capaVersion, refresh);
    return;
  }
  if (capaState === 'VERIFIED' && permissions.has('capa:manage')) {
    openCapaClose(context, capaId, capaVersion, evidenceFields, refresh);
    return;
  }
  if (capaState === 'CLOSED' && ncrState === 'DISPOSITIONED' && permissions.has('ncr:close')) {
    transitionNcr('close', '关闭不合格报告');
    return;
  }
  if (ncrState === 'CLOSED' && capaState === 'CLOSED' && permissions.has('complaint:close'))
    command('close', '关闭投诉', '确认整改单和不合格报告均已归档。');
}
