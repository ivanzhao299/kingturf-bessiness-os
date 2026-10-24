import { el } from '../dom';
import { formatBusinessDateTime } from './business-date';
import { setOperationStatus } from '../dom';
import type { OnlineBusinessDocument } from './shell-types';
import type { OnlineEditorContext } from './online-editor-types';

export function createOnlineEditorVersionHistory(
  context: Pick<
    OnlineEditorContext,
    | 'body'
    | 'sanitizeBusinessDocumentHtml'
    | 'renderBusinessDocumentComparison'
    | 'comparison'
    | 'businessDocumentText'
    | 'status'
    | 'history'
    | 'state'
  >,
) {
  const {
    body,
    sanitizeBusinessDocumentHtml,
    renderBusinessDocumentComparison,
    comparison,
    businessDocumentText,
    status,
    history,
    state,
  } = context;
  const addVersionToHistory = (
    item: NonNullable<OnlineBusinessDocument['versions']>[number],
    newest = false,
  ): void => {
    const versionItem = el('button', 'business-document-version');
    versionItem.type = 'button';
    versionItem.append(
      el('strong', '', `V${String(item.version)}`),
      el('span', '', item.changeSummary),
      el('small', '', item.createdAt ? formatBusinessDateTime(new Date(item.createdAt)) : ''),
    );
    versionItem.addEventListener('click', () => {
      body.innerHTML = sanitizeBusinessDocumentHtml(
        item.content.html ??
          `<p>${(item.content.body ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>')}</p>`,
      );
      renderBusinessDocumentComparison(
        comparison,
        businessDocumentText(item.content),
        businessDocumentText(state.latestContent),
        item.version,
        state.activeVersion,
      );
      setOperationStatus(
        status,
        'idle',
        `正在查看 V${String(item.version)}；继续保存将基于当前最新版生成新版本`,
      );
    });
    if (newest) history.insertBefore(versionItem, history.children[1] ?? null);
    else history.append(versionItem);
  };
  return addVersionToHistory;
}
