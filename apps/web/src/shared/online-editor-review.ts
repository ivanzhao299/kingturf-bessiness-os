import { el } from '../dom';
import { setOperationStatus } from '../dom';
import type { OnlineEditorContext } from './online-editor-types';
import { completeOnlineEditorReview } from './online-editor-review-completion';

export function createOnlineEditorReview(
  context: Pick<
    OnlineEditorContext,
    | 'body'
    | 'status'
    | 'onlineDocumentApi'
    | 'documentData'
    | 'setViewMode'
    | 'save'
    | 'permissions'
    | 'summary'
    | 'versionStatus'
    | 'clearSessionReadCache'
    | 'onSaved'
    | 'actionPanel'
    | 'state'
  >,
) {
  const { body, status, onlineDocumentApi, documentData, permissions, actionPanel, state } =
    context;
  const reviewActions = el('div', 'business-document-review-actions');
  const reviewReason = el('input');
  reviewReason.placeholder = '填写提交说明或审批意见';
  reviewReason.setAttribute('aria-label', '文档审核意见');
  const addReviewAction = (
    label: string,
    action: 'submit' | 'approve' | 'reject',
    primary: boolean,
  ) => {
    const button = el('button', primary ? 'primary' : 'secondary', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (button.disabled) return;
      if (action === 'submit' && body.innerHTML !== state.savedEditorHtml) {
        setOperationStatus(status, 'error', '正文有未保存的修改，请先保存为新版本，再提交审核');
        return;
      }
      if (reviewReason.value.trim().length < 2) {
        setOperationStatus(status, 'error', '请填写至少 2 个字的审核意见');
        return;
      }
      button.disabled = true;
      void onlineDocumentApi(`/api/v1/business-documents/${documentData.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: state.activeVersion,
          reason: reviewReason.value.trim(),
        }),
      })
        .then(() => {
          completeOnlineEditorReview(context, label, action, reviewReason, renderReviewActions);
        })
        .catch((failure: unknown) => {
          button.disabled = false;
          setOperationStatus(
            status,
            'error',
            failure instanceof Error ? failure.message : `${label}失败`,
          );
        });
    });
    reviewActions.append(button);
  };
  const renderReviewActions = (): void => {
    reviewActions.replaceChildren();
    if (state.editable && permissions.manage) addReviewAction('提交审核', 'submit', true);
    if (state.documentState === 'IN_REVIEW' && permissions.approve) {
      addReviewAction('批准并锁版', 'approve', true);
      addReviewAction('驳回修改', 'reject', false);
    }
    reviewReason.hidden = reviewActions.childElementCount === 0;
    reviewActions.hidden = reviewReason.hidden;
  };
  renderReviewActions();
  actionPanel.append(reviewReason, reviewActions);
  return { reviewReason };
}
