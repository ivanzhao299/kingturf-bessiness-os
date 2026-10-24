import type { BusinessDocumentPageSize } from './online-editor-types';
import { formatBusinessDateTime } from './business-date';
import { sanitizeBusinessDocumentHtml } from './document-html';
export const printOnlineBusinessDocument = (
  title: string,
  html: string,
  pageSize: BusinessDocumentPageSize,
): void => {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('浏览器阻止了打印窗口，请允许本站打开新窗口');
  const page = pageSize === 'adaptive' ? 'A4 portrait' : pageSize.replace('-', ' ');
  popup.document.title = title;
  const style = popup.document.createElement('style');
  style.textContent = `
    @page { size: ${page}; margin: 18mm 17mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; background: #fff; font-family: "Songti SC", SimSun, serif; font-size: 11pt; line-height: 1.8; }
    h1 { margin: 0 0 12mm; text-align: center; font: 700 20pt/1.35 "PingFang SC", sans-serif; }
    h2 { margin: 8mm 0 3mm; font-size: 15pt; break-after: avoid; }
    h3 { margin: 6mm 0 2mm; font-size: 12.5pt; break-after: avoid; }
    p { margin: 0 0 3mm; orphans: 3; widows: 3; }
    li { break-inside: avoid; }
    .document-meta { margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 1px solid #bbb; color: #555; font-family: "PingFang SC", sans-serif; font-size: 9pt; }
    @media screen { body { max-width: 210mm; margin: 20px auto; padding: 18mm 17mm; box-shadow: 0 8px 28px #0002; } }
  `;
  popup.document.head.append(style);
  const meta = popup.document.createElement('div');
  meta.className = 'document-meta';
  meta.textContent = `金特夫企业经营管理系统 · 打印时间 ${formatBusinessDateTime(new Date())}`;
  const heading = popup.document.createElement('h1');
  heading.textContent = title;
  const content = popup.document.createElement('main');
  content.innerHTML = sanitizeBusinessDocumentHtml(html);
  popup.document.body.append(meta, heading, content);
  window.setTimeout(() => {
    popup.focus();
    popup.print();
  }, 200);
};
