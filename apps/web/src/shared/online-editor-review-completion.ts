import { setOperationStatus } from '../dom';
import type { OnlineEditorContext } from './online-editor-types';
export function completeOnlineEditorReview(
  context: Pick<
    OnlineEditorContext,
    | 'setViewMode'
    | 'save'
    | 'permissions'
    | 'summary'
    | 'versionStatus'
    | 'status'
    | 'clearSessionReadCache'
    | 'onSaved'
    | 'state'
  >,
  label: string,
  action: 'submit' | 'approve' | 'reject',
  reviewReason: HTMLInputElement,
  renderReviewActions: () => void,
) {
  const {
    setViewMode,
    save,
    permissions,
    summary,
    versionStatus,
    status,
    clearSessionReadCache,
    onSaved,
    state,
  } = context;

  state.documentState =
    action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'IN_REVIEW';
  state.editable = ['DRAFT', 'REJECTED'].includes(state.documentState);
  setViewMode(state.editable ? 'edit' : 'preview');
  save.hidden = !state.editable || !permissions.manage;
  summary.hidden = !state.editable || !permissions.manage;
  versionStatus.textContent = `当前版本 V${String(state.activeVersion)} · ${state.documentState === 'APPROVED' ? '已批准锁版' : state.documentState === 'IN_REVIEW' ? '等待审批' : '可修改后重新提审'}`;
  renderReviewActions();
  reviewReason.value = '';
  setOperationStatus(status, 'success', `${label}成功`);
  clearSessionReadCache();
  onSaved?.(state.activeVersion);
}
