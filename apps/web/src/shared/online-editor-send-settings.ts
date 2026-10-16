import { el } from '../dom';
import type { OnlineEditorContext } from './online-editor-types';

export function createOnlineEditorSendSettings(
  context: Pick<OnlineEditorContext, 'permissions' | 'send' | 'renderDocumentConnectors'>,
) {
  const { permissions, send, renderDocumentConnectors } = context;
  const openSettings = (): void => {
    if (!permissions.configure) return;
    const settings = el('dialog', 'form-dialog document-send-settings');
    settings.setAttribute('aria-label', '发送与翻译连接器');
    const content = el('div', 'entity-form');
    const grid = el('div', 'document-connector-grid');
    const back = el('button', 'secondary', '返回文档');
    back.type = 'button';
    back.addEventListener('click', () => {
      settings.close();
    });
    content.append(
      el('h2', '', '发送与翻译连接器'),
      el(
        'p',
        'muted',
        '当前文档和未保存内容会保留。配置元数据后仍需运维接入实际发送服务；入队不代表送达。保存后返回文档，重新点击发送以检查最新配置。',
      ),
      grid,
      back,
    );
    settings.append(content);
    settings.addEventListener('close', () => {
      settings.remove();
      send.focus();
    });
    document.body.append(settings);
    settings.showModal();
    renderDocumentConnectors(grid);
  };
  return openSettings;
}
