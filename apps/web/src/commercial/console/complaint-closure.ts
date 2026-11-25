import type { OperationsViewContext } from '../operations-view-ports';
import { finText, finRecord, finRows, type FinRow } from './fin-kit';
import { opsForm } from './ops-form';

type ComplaintContext = Pick<OperationsViewContext, 'controller' | 'ports' | 'permissions'>;

import type { FormSectionField } from '@kingturf/ui';
import { complaintTransition } from './complaint-forms';
import {
  capaCreate,
  capaAction,
  capaComplete,
  capaVerify,
  capaClose,
} from './complaint-capa-forms';

export function complaintClosure(context: ComplaintContext, complaint: FinRow, detail: FinRow) {
  const {
    permissions,
    ports: { requestId },
  } = context;
  const ncr = finRecord(detail.ncr);
  const capa = finRecord(ncr.capa);
  const ncrId = finText(ncr, 'id');
  const ncrState = finText(ncr, 'state');
  const ncrVersion = Number(ncr.version ?? 0);
  const capaId = finText(capa, 'id');
  const capaState = finText(capa, 'state');
  const capaVersion = Number(capa.version ?? 0);
  const evidenceFields = [
    { name: 'reason', label: '处理说明', type: 'textarea' as const, required: true },
    { name: 'evidenceReference', label: '证据编号', required: true },
  ];
  const transitionNcr = (
    action: 'contain' | 'root-cause' | 'disposition' | 'close',
    title: string,
    extra: readonly FormSectionField[] = [],
  ) => {
    return opsForm(
      title,
      '填写业务结论和可追溯证据后提交。',
      [...extra, ...evidenceFields],
      `确认${title}`,
      (values) => [
        `/api/v1/ncrs/${ncrId}/${action}`,
        {
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
        },
      ],
      action === 'disposition' || action === 'close'
        ? '确认后将追加不可撤回的质量处理记录。'
        : undefined,
    );
  };
  if (ncrState === 'OPEN' && permissions.has('ncr:manage')) {
    return transitionNcr('contain', '确认临时遏制');
  }
  if (ncrState === 'CONTAINED' && permissions.has('ncr:manage')) {
    return transitionNcr('root-cause', '确认根本原因', [
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
  }
  if (ncrState === 'ROOT_CAUSE_CONFIRMED' && permissions.has('ncr:disposition')) {
    return transitionNcr('disposition', '批准处置方案', [
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
  }
  if (ncrState === 'DISPOSITIONED' && !capaId && permissions.has('capa:manage')) {
    return capaCreate(context, complaint, ncrId);
  }
  const actions = finRows(capa.actions);
  const incomplete = actions.find((item) => !item.completion);
  if (
    capaId &&
    ['OPEN', 'ACTIONS_IN_PROGRESS'].includes(capaState) &&
    permissions.has('capa:manage') &&
    !actions.length
  ) {
    return capaAction(context, capaId, capaVersion);
  }
  if (incomplete && permissions.has('capa:manage')) {
    return capaComplete(context, incomplete, capaVersion);
  }
  if (capaState === 'READY_FOR_VERIFICATION' && permissions.has('capa:verify')) {
    return capaVerify(context, complaint, capaId, capaVersion);
  }
  if (capaState === 'VERIFIED' && permissions.has('capa:manage')) {
    return capaClose(context, capaId, capaVersion, evidenceFields);
  }
  if (capaState === 'CLOSED' && ncrState === 'DISPOSITIONED' && permissions.has('ncr:close')) {
    return transitionNcr('close', '关闭不合格报告');
  }
  if (ncrState === 'CLOSED' && capaState === 'CLOSED' && permissions.has('complaint:close'))
    return complaintTransition(
      context,
      complaint,
      finText(complaint, 'id'),
      'close',
      '关闭投诉',
      '确认整改单和不合格报告均已归档。',
    );
  return null;
}
