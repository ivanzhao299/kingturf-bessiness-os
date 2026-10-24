import { el } from '../dom';
import type { OnlineEditorState } from './online-editor-types';
import type { OnlineBusinessDocument } from './shell-types';

export function createOnlineEditorHeading(
  context: Readonly<{ documentData: OnlineBusinessDocument; state: OnlineEditorState }>,
) {
  const { documentData, state } = context;
  const dialog = document.createElement('dialog');
  dialog.className = 'form-dialog business-document-dialog';
  const heading = el('div', 'dialog-heading');
  const headingCopy = el('div');
  const versionStatus = el(
    'p',
    'muted',
    `当前版本 V${String(state.activeVersion)} · ${documentData.state === 'APPROVED' ? '已批准锁版' : '保存不会覆盖历史版本'}`,
  );
  headingCopy.append(
    el('p', 'eyebrow', '在线业务文档'),
    el('h2', '', documentData.title),
    versionStatus,
  );
  const close = el('button', 'icon-button', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭在线文档');
  close.addEventListener('click', () => {
    dialog.close();
  });
  heading.append(headingCopy, close);
  return { dialog, heading, versionStatus };
}
