import { el } from '../dom';
import type { OnlineEditorContext, BusinessDocumentPageSize } from './online-editor-types';

export function bindOnlineEditorPagination(
  context: Pick<
    OnlineEditorContext,
    | 'editor'
    | 'pageSize'
    | 'zoom'
    | 'body'
    | 'documentScroll'
    | 'pageIndicator'
    | 'previousPage'
    | 'nextPage'
    | 'pagination'
    | 'workspace'
    | 'permissions'
    | 'toolbar'
    | 'editMode'
    | 'previewMode'
    | 'state'
  >,
) {
  const {
    editor,
    pageSize,
    zoom,
    body,
    documentScroll,
    pageIndicator,
    previousPage,
    nextPage,
    pagination,
    workspace,
    permissions,
    toolbar,
    editMode,
    previewMode,
    state,
  } = context;
  const documentPageHeight = (): number => {
    const pageHeights: Readonly<Record<BusinessDocumentPageSize, number>> = {
      'a4-portrait': 1123,
      'a4-landscape': 794,
      'a3-portrait': 1587,
      adaptive: Math.max(680, editor.clientHeight),
    };
    return pageHeights[pageSize.value as BusinessDocumentPageSize] * Number(zoom.value);
  };
  const documentPageState = (): Readonly<{ current: number; total: number }> => {
    const pageHeight = Math.max(1, documentPageHeight());
    const total = Math.max(1, Math.ceil(body.scrollHeight / pageHeight));
    const readingOffset = Math.max(0, documentScroll.scrollTop - body.offsetTop + 24);
    const atDocumentEnd =
      documentScroll.scrollTop >= documentScroll.scrollHeight - documentScroll.clientHeight - 8;
    const current = atDocumentEnd
      ? total
      : Math.min(total, Math.max(1, Math.floor(readingOffset / pageHeight) + 1));
    return { current, total };
  };
  const updateDocumentPagination = (): void => {
    const { current, total } = documentPageState();
    pageIndicator.textContent = `第 ${String(current)} / ${String(total)} 页`;
    previousPage.disabled = current <= 1;
    nextPage.disabled = current >= total;
    pagination.hidden = pageSize.value === 'adaptive';
  };
  const goToDocumentPage = (direction: -1 | 1): void => {
    const { current, total } = documentPageState();
    const target = Math.min(total, Math.max(1, current + direction));
    documentScroll.scrollTo({
      top: Math.max(0, body.offsetTop + (target - 1) * documentPageHeight() - 12),
      behavior: 'auto',
    });
    window.requestAnimationFrame(updateDocumentPagination);
  };
  previousPage.addEventListener('click', () => {
    goToDocumentPage(-1);
  });
  nextPage.addEventListener('click', () => {
    goToDocumentPage(1);
  });
  documentScroll.addEventListener('scroll', updateDocumentPagination, { passive: true });
  body.addEventListener('input', updateDocumentPagination);
  documentScroll.addEventListener('keydown', (event) => {
    if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
    event.preventDefault();
    goToDocumentPage(event.key === 'PageUp' ? -1 : 1);
  });
  const setViewMode = (mode: 'edit' | 'preview'): void => {
    workspace.dataset.viewMode = mode;
    const canEdit = mode === 'edit' && state.editable && permissions.manage;
    body.contentEditable = String(canEdit);
    toolbar.hidden = !canEdit;
    editMode.classList.toggle('active', mode === 'edit');
    previewMode.classList.toggle('active', mode === 'preview');
    editMode.setAttribute('aria-pressed', String(mode === 'edit'));
    previewMode.setAttribute('aria-pressed', String(mode === 'preview'));
  };
  editMode.addEventListener('click', () => {
    setViewMode('edit');
  });
  previewMode.addEventListener('click', () => {
    setViewMode('preview');
  });
  pageSize.addEventListener('change', () => {
    workspace.dataset.pageSize = pageSize.value;
    documentScroll.scrollTop = 0;
    updateDocumentPagination();
  });
  zoom.addEventListener('change', () => {
    workspace.style.setProperty('--document-zoom', zoom.value);
    documentScroll.scrollTop = 0;
    updateDocumentPagination();
  });
  for (const [label, command, value] of [
    ['正文', 'formatBlock', 'p'],
    ['一级标题', 'formatBlock', 'h2'],
    ['二级标题', 'formatBlock', 'h3'],
    ['加粗', 'bold', ''],
    ['项目符号', 'insertUnorderedList', ''],
    ['编号', 'insertOrderedList', ''],
  ] as const) {
    const action = el('button', 'secondary compact', label);
    action.type = 'button';
    action.addEventListener('click', () => {
      body.focus();
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- execCommand preserves the active selection in contenteditable across supported enterprise browsers.
      document.execCommand(command, false, value);
    });
    toolbar.append(action);
  }
  return { setViewMode, updateDocumentPagination };
}
