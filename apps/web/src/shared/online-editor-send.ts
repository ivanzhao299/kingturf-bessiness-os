import { setOperationStatus } from '../dom';
import { documentSendBlockReason } from '../document-send';
import { documentSendNotice } from '../document-send';
import type { OnlineEditorContext, DocumentConnector } from './online-editor-types';
import { createOnlineEditorSendSettings } from './online-editor-send-settings';
import { openOnlineEditorSendForm } from './online-editor-send-form';
import { showOnlineEditorBlockedNotice } from './online-editor-send-blocked';

export function bindOnlineEditorSend(
  context: Pick<
    OnlineEditorContext,
    | 'send'
    | 'permissions'
    | 'renderDocumentConnectors'
    | 'documentData'
    | 'body'
    | 'actionPanel'
    | 'summary'
    | 'reviewReason'
    | 'onlineDocumentApi'
    | 'status'
    | 'history'
    | 'clearSessionReadCache'
    | 'onSaved'
    | 'state'
  >,
) {
  const { send, permissions, documentData, onlineDocumentApi, state } = context;
  send.addEventListener('click', () => {
    if (send.disabled) return;
    const openSettings = createOnlineEditorSendSettings(context);
    const blocked = documentSendBlockReason(state.documentState, documentData.customerId);
    if (blocked) {
      showOnlineEditorBlockedNotice(context, blocked, openSettings);
      return;
    }
    const notice = documentSendNotice('正在读取可用发送渠道，请稍候…');
    const abort = new AbortController();
    notice.dialog.addEventListener(
      'close',
      () => {
        abort.abort();
      },
      { once: true },
    );
    send.disabled = true;
    send.textContent = '正在读取渠道…';
    void onlineDocumentApi<{ items: readonly DocumentConnector[] }>('/api/v1/document-connectors', {
      signal: abort.signal,
    })
      .then(({ items }) => {
        if (!notice.dialog.open) return;
        const channels = items.filter(
          (item) => item.connector !== 'TRANSLATION' && item.status === 'READY',
        );
        if (channels.length === 0) {
          notice.message.textContent =
            '尚未配置可用发送渠道。' +
            (permissions.configure
              ? '点击“前往发送配置”设置企业账号和密钥引用；实际发送服务需运维接入。'
              : '您没有发送渠道配置权限，请联系管理员进入“业务文档库 → 发送与翻译连接器”完成企业账号和发送服务接入。') +
            '当前文档已保留，尚未发送给客户。';
          if (permissions.configure) notice.addAction('前往发送配置', openSettings);
          notice.addAction('重新检查配置', () => {
            send.click();
          });
          return;
        }
        notice.dialog.close();
        openOnlineEditorSendForm(context, channels);
      })
      .catch((failure: unknown) => {
        if (!notice.dialog.open) return;
        setOperationStatus(
          notice.message,
          'error',
          `发送渠道读取失败：${failure instanceof Error ? failure.message : '网络异常'}。请返回文档后重试；未发送任何文档。`,
        );
        notice.addAction('重试读取渠道', () => {
          send.click();
        });
      })
      .finally(() => {
        send.disabled = false;
        send.textContent = '发送给客户';
      });
  });
}
