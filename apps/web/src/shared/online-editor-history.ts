import { el } from '../dom';
import { documentDispatchStatus } from '../document-send';
import type { OnlineEditorContext } from './online-editor-types';

export function appendOnlineEditorHistory(
  context: Pick<
    OnlineEditorContext,
    'documentData' | 'history' | 'sanitizeBusinessDocumentHtml' | 'versions'
  >,
) {
  const { documentData, history, sanitizeBusinessDocumentHtml, versions } = context;
  for (const item of documentData.dispatches ?? [])
    history.append(
      el(
        'p',
        'business-document-review-event',
        `${documentDispatchStatus(item.status)} · ${item.channel} · ${item.recipientName}（${item.recipientMasked}）`,
      ),
    );
  for (const item of documentData.translations ?? []) {
    const translationEntry = el('div', 'business-document-review-event');
    translationEntry.append(
      el(
        'span',
        '',
        `译文 · ${item.targetLocale} · V${String(item.sourceVersion)} · ${item.status === 'READY' ? '可发送' : '处理中'}`,
      ),
    );
    if (item.status === 'READY' && item.content) {
      const preview = el('button', 'secondary compact', '查看译文');
      preview.type = 'button';
      preview.addEventListener('click', () => {
        const previewDialog = document.createElement('dialog');
        previewDialog.className = 'business-document-dialog translation-preview-dialog';
        const closePreview = el('button', 'secondary compact', '关闭');
        closePreview.type = 'button';
        closePreview.addEventListener('click', () => {
          previewDialog.close();
        });
        const translatedBody = el('article', 'business-document-body translation-preview');
        if (item.content?.html)
          translatedBody.innerHTML = sanitizeBusinessDocumentHtml(item.content.html);
        else translatedBody.textContent = item.content?.body ?? '';
        previewDialog.append(
          el('h2', '', `${item.targetLocale} 译文 · 版本 ${String(item.sourceVersion)}`),
          translatedBody,
          closePreview,
        );
        previewDialog.addEventListener('close', () => {
          previewDialog.remove();
        });
        document.body.append(previewDialog);
        previewDialog.showModal();
      });
      translationEntry.append(preview);
    }
    history.append(translationEntry);
  }
  if (versions.length === 0) history.append(el('p', 'empty', '暂无版本记录'));
  for (const event of documentData.reviewEvents ?? [])
    history.append(
      el(
        'p',
        'business-document-review-event',
        `${event.action === 'SUBMITTED' ? '已提交' : event.action === 'APPROVED' ? '已批准' : '已驳回'} · ${event.reason}`,
      ),
    );
}
