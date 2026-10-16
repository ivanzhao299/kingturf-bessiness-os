import { el } from '../dom';
import { setOperationStatus } from '../dom';
import { openForm } from './forms';
import { requestId } from '../http';
import { documentDispatchStatus } from '../document-send';
import type { OnlineEditorContext, DocumentConnector } from './online-editor-types';
export function openOnlineEditorSendForm(
  context: Pick<
    OnlineEditorContext,
    | 'documentData'
    | 'onlineDocumentApi'
    | 'status'
    | 'history'
    | 'clearSessionReadCache'
    | 'onSaved'
    | 'state'
  >,
  channels: readonly DocumentConnector[],
) {
  const {
    documentData,
    onlineDocumentApi,
    status,
    history,
    clearSessionReadCache,
    onSaved,
    state,
  } = context;
  const sendKeys = new Map<string, string>();
  openForm(
    document.body,
    '发送给客户',
    '仅提交当前已批准锁版内容。进入队列不等于客户已收到，须以发送服务回执为准。收件地址受控保存，日志仅显示脱敏信息。',
    [
      {
        name: 'channel',
        label: '发送渠道',
        type: 'select',
        required: true,
        options: channels.map((item) => ({
          value: item.connector,
          label: `${item.label} · ${item.status === 'READY' ? '已配置' : item.status === 'DISABLED' ? '已停用' : '待管理员配置'}`,
        })),
      },
      { name: 'recipientName', label: '收件人姓名', required: true, maxLength: 200 },
      {
        name: 'recipientAddress',
        label: '邮箱或平台客户标识',
        required: true,
        maxLength: 320,
        hint: '邮件填写邮箱；其他平台填写经客户授权的平台标识。',
      },
      {
        name: 'translationId',
        label: '发送语言版本',
        type: 'select',
        options: [
          { value: '', label: '原文' },
          ...(documentData.translations ?? [])
            .filter((item) => item.status === 'READY' && item.sourceVersion === state.activeVersion)
            .map((item) => ({ value: item.id, label: `${item.targetLocale} 译文` })),
        ],
      },
      {
        name: 'subject',
        label: '主题',
        required: true,
        value: documentData.title,
        maxLength: 200,
      },
      {
        name: 'message',
        label: '给客户的说明',
        type: 'textarea',
        required: true,
        value: '您好，请查收并确认本次业务文档。如有问题，请直接联系对应业务人员。',
        maxLength: 4000,
      },
    ],
    '确认进入发送队列',
    async (values) => {
      const payload = JSON.stringify({
        expectedVersion: state.activeVersion,
        channel: values.channel,
        recipientName: values.recipientName,
        recipientAddress: values.recipientAddress,
        subject: values.subject,
        message: values.message,
        ...(values.translationId ? { translationId: values.translationId } : {}),
      });
      if (!sendKeys.has(payload)) sendKeys.set(payload, requestId());
      const result = await onlineDocumentApi<{ id: string; status: string }>(
        `/api/v1/business-documents/${documentData.id}/send`,
        {
          method: 'POST',
          headers: { 'idempotency-key': sendKeys.get(payload) ?? requestId() },
          body: payload,
        },
      );
      const receipt = `发送任务 ${result.id}：${documentDispatchStatus(result.status)}。可在文档版本栏查看发送记录。`;
      setOperationStatus(status, 'success', receipt);
      history.append(el('p', 'business-document-review-event', receipt));
      clearSessionReadCache();
      onSaved?.(state.activeVersion);
    },
  );
}
