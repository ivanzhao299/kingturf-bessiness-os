import { documentSendNotice } from '../document-send';
import type { OnlineEditorContext } from './online-editor-types';

export function showOnlineEditorBlockedNotice(
  context: Pick<
    OnlineEditorContext,
    'state' | 'body' | 'permissions' | 'actionPanel' | 'summary' | 'reviewReason'
  >,
  blocked: string,
  openSettings: () => void,
) {
  const { state, body, permissions, actionPanel, summary, reviewReason } = context;
  const notice = documentSendNotice(
    (state.editable && body.innerHTML !== state.savedEditorHtml ? '正文有未保存的修改。' : '') +
      blocked,
  );
  if (state.editable && permissions.manage) {
    notice.addAction('去保存 / 提交审核', () => {
      actionPanel.scrollIntoView({ block: 'nearest' });
      if (body.innerHTML !== state.savedEditorHtml) summary.focus();
      else reviewReason.focus();
    });
  } else if (state.documentState === 'IN_REVIEW' && permissions.approve) {
    notice.addAction('去审批', () => {
      actionPanel.scrollIntoView({ block: 'nearest' });
      reviewReason.focus();
    });
  }
  if (permissions.configure) notice.addAction('发送渠道配置', openSettings);
}
