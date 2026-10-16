import { el } from '../dom';
import { buildBusinessDocumentTemplateHtml } from '../business-document-content';
import { isLegacyBusinessDocumentOutline } from '../business-document-content';
import type { OnlineEditorPorts, OnlineEditorPermissions } from './online-editor-types';
import type { OnlineBusinessDocument } from './shell-types';

export function createOnlineEditorWorkspace(
  context: Pick<
    OnlineEditorPorts,
    'businessDocumentOption' | 'businessDocumentText' | 'sanitizeBusinessDocumentHtml'
  > &
    Readonly<{
      documentData: OnlineBusinessDocument;
      permissions: OnlineEditorPermissions;
      current: NonNullable<OnlineBusinessDocument['versions']>[number] | undefined;
    }>,
) {
  const {
    documentData,
    businessDocumentOption,
    permissions,
    current,
    businessDocumentText,
    sanitizeBusinessDocumentHtml,
  } = context;
  const workspace = el('div', 'business-document-workspace');
  workspace.dataset.pageSize = 'a4-portrait';
  workspace.dataset.viewMode = 'edit';
  if (window.innerWidth < 1200) workspace.classList.add('history-collapsed');
  const layout = el('div', 'business-document-layout');
  const editor = el('section', 'business-document-editor');
  const documentScroll = el('div', 'business-document-scroll');
  documentScroll.setAttribute('data-document-scroll', 'true');
  documentScroll.tabIndex = 0;
  documentScroll.setAttribute('aria-label', '文档页面');
  const actionPanel = el('section', 'business-document-action-panel');
  actionPanel.setAttribute('aria-label', '版本保存与审核');
  const history = el('aside', 'business-document-history');
  history.append(el('h3', '', '版本记录'));
  const bindingSummary = el(
    'p',
    'business-document-binding-summary',
    [
      documentData.customerName ? `客户：${documentData.customerName}` : '',
      documentData.salesOrderNumber ? `订单：${documentData.salesOrderNumber}` : '',
      documentData.operatorName ? `经办人：${documentData.operatorName}` : '',
      documentData.salespersonName ? `业务员：${documentData.salespersonName}` : '',
      documentData.assigneeName ? `下一处理人：${documentData.assigneeName}` : '',
    ]
      .filter(Boolean)
      .join('　') || '尚未绑定客户、订单或处理人',
  );
  const title = el('input');
  title.value = documentData.title;
  title.readOnly = true;
  title.setAttribute('aria-label', '文档标题');
  const toolbar = el('div', 'business-document-toolbar');
  const commandBar = el('div', 'business-document-commandbar');
  const viewGroup = el('div', 'business-document-command-group');
  const editMode = el('button', 'secondary compact active', '编辑');
  const previewMode = el('button', 'secondary compact', '阅读预览');
  editMode.type = previewMode.type = 'button';
  editMode.setAttribute('aria-pressed', 'true');
  previewMode.setAttribute('aria-pressed', 'false');
  viewGroup.append(editMode, previewMode);
  const pageSize = el('select', 'business-document-page-select');
  pageSize.setAttribute('aria-label', '页面规格');
  pageSize.append(
    businessDocumentOption('A4 纵向', 'a4-portrait'),
    businessDocumentOption('A4 横向', 'a4-landscape'),
    businessDocumentOption('A3 纵向', 'a3-portrait'),
    businessDocumentOption('自适应阅读', 'adaptive'),
  );
  const zoom = el('select', 'business-document-zoom-select');
  zoom.setAttribute('aria-label', '文档缩放');
  zoom.append(
    businessDocumentOption('75%', '0.75'),
    businessDocumentOption('90%', '0.9'),
    businessDocumentOption('100%', '1'),
    businessDocumentOption('110%', '1.1'),
    businessDocumentOption('125%', '1.25'),
  );
  zoom.value = '0.9';
  const toggleHistory = el('button', 'secondary compact', '收起版本栏');
  toggleHistory.type = 'button';
  if (workspace.classList.contains('history-collapsed')) toggleHistory.textContent = '版本记录';
  toggleHistory.setAttribute(
    'aria-expanded',
    String(!workspace.classList.contains('history-collapsed')),
  );
  const pagination = el('div', 'business-document-pagination');
  pagination.setAttribute('data-document-pagination', 'true');
  const previousPage = el('button', 'secondary compact', '上一页');
  const pageIndicator = el('span', 'business-document-page-indicator', '第 1 / 1 页');
  const nextPage = el('button', 'secondary compact', '下一页');
  previousPage.type = nextPage.type = 'button';
  previousPage.setAttribute('aria-label', '上一页');
  nextPage.setAttribute('aria-label', '下一页');
  pageIndicator.setAttribute('aria-live', 'polite');
  pagination.append(previousPage, pageIndicator, nextPage);
  const print = el('button', 'secondary compact', '打印 / 导出 PDF');
  print.type = 'button';
  print.setAttribute('aria-label', '打印或导出 PDF');
  const downloadOnline = el('button', 'secondary compact', '下载 HTML');
  downloadOnline.type = 'button';
  downloadOnline.setAttribute('aria-label', '下载当前文档内容');
  const translate = el('button', 'secondary compact', '翻译文档');
  translate.type = 'button';
  translate.hidden = !permissions.translate;
  const send = el('button', 'primary compact', '发送给客户');
  send.type = 'button';
  send.hidden = !permissions.send;
  send.title = '查看发送条件并选择客户沟通渠道';
  commandBar.append(
    viewGroup,
    pageSize,
    zoom,
    pagination,
    toggleHistory,
    translate,
    print,
    downloadOnline,
    send,
  );
  const body = el('div');
  body.className = 'business-document-body';
  body.contentEditable = 'true';
  const storedBody = current?.content.body ?? businessDocumentText(current?.content ?? {});
  const upgradedLegacyOutline = isLegacyBusinessDocumentOutline(storedBody);
  body.innerHTML = sanitizeBusinessDocumentHtml(
    upgradedLegacyOutline
      ? buildBusinessDocumentTemplateHtml(
          `${documentData.templateKey.slice(0, 2)}-历史在线文档.docx`,
          documentData.title.split(' · ')[0] ?? documentData.title,
          '',
          '',
          new Date().toLocaleDateString('zh-CN'),
        )
      : (current?.content.html ??
          `<p>${storedBody.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>')}</p>`),
  );
  body.setAttribute('aria-label', '文档正文');
  body.setAttribute('role', 'textbox');
  return {
    workspace,
    layout,
    editor,
    documentScroll,
    actionPanel,
    history,
    bindingSummary,
    title,
    toolbar,
    commandBar,
    editMode,
    previewMode,
    pageSize,
    zoom,
    toggleHistory,
    pagination,
    previousPage,
    pageIndicator,
    nextPage,
    print,
    downloadOnline,
    translate,
    send,
    body,
    upgradedLegacyOutline,
  };
}
