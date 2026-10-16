import { setOperationStatus } from '../dom';
import type { OnlineEditorContext, BusinessDocumentPageSize } from './online-editor-types';

export function bindOnlineEditorExport(
  context: Pick<
    OnlineEditorContext,
    | 'print'
    | 'printOnlineBusinessDocument'
    | 'documentData'
    | 'body'
    | 'pageSize'
    | 'onlineDocumentApi'
    | 'status'
    | 'downloadOnline'
    | 'sanitizeBusinessDocumentHtml'
    | 'state'
  >,
) {
  const {
    print,
    printOnlineBusinessDocument,
    documentData,
    body,
    pageSize,
    onlineDocumentApi,
    status,
    downloadOnline,
    sanitizeBusinessDocumentHtml,
    state,
  } = context;
  print.addEventListener('click', () => {
    try {
      printOnlineBusinessDocument(
        documentData.title,
        body.innerHTML,
        pageSize.value as BusinessDocumentPageSize,
      );
      void onlineDocumentApi(`/api/v1/business-documents/${documentData.id}/activity`, {
        method: 'POST',
        body: JSON.stringify({ action: 'PRINTED', version: state.activeVersion }),
      }).catch(() => {
        setOperationStatus(status, 'error', '打印已打开，但审计记录暂时写入失败');
      });
    } catch (failure) {
      setOperationStatus(
        status,
        'error',
        failure instanceof Error ? failure.message : '无法打开打印预览',
      );
    }
  });
  downloadOnline.addEventListener('click', () => {
    const safeTitle = documentData.title
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${safeTitle}</title></head><body><h1>${safeTitle}</h1>${sanitizeBusinessDocumentHtml(body.innerHTML)}</body></html>`;
    const href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `${documentData.title.replaceAll(/[\\/:*?"<>|]/gu, '-')}-V${String(state.activeVersion)}.html`;
    link.click();
    URL.revokeObjectURL(href);
    void onlineDocumentApi(`/api/v1/business-documents/${documentData.id}/activity`, {
      method: 'POST',
      body: JSON.stringify({ action: 'DOWNLOADED', version: state.activeVersion }),
    }).catch(() => {
      setOperationStatus(status, 'error', '文件已下载，但审计记录暂时写入失败');
    });
  });
}
