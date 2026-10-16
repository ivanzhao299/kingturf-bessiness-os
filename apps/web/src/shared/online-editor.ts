import { el } from '../dom';
import type { OnlineBusinessDocument } from './shell-types';
import type { OnlineEditorPorts, OnlineEditorState } from './online-editor-types';
import { createOnlineEditorHeading } from './online-editor-heading';
import { createOnlineEditorWorkspace } from './online-editor-workspace';
import { bindOnlineEditorPagination } from './online-editor-pagination';
import { createOnlineEditorSave } from './online-editor-save';
import { createOnlineEditorReview } from './online-editor-review';
import { appendOnlineEditorHistory } from './online-editor-history';
import { createOnlineEditorVersionHistory } from './online-editor-version-history';
import { bindOnlineEditorTranslation } from './online-editor-translation';
import { bindOnlineEditorSend } from './online-editor-send';
import { bindOnlineEditorExport } from './online-editor-export';
export function createOnlineDocumentEditor(ports: OnlineEditorPorts) {
  const openOnlineDocumentEditor = (
    documentData: OnlineBusinessDocument,
    permissions: Readonly<{
      manage: boolean;
      approve: boolean;
      send: boolean;
      translate: boolean;
      configure: boolean;
    }>,
    onSaved?: (currentVersion: number) => void,
  ): void => {
    let activeVersion = documentData.currentVersion;
    let documentState = documentData.state;
    let latestContent =
      documentData.versions?.find((item) => item.version === activeVersion)?.content ?? {};
    const state: OnlineEditorState = {
      get activeVersion(): number {
        return activeVersion;
      },
      set activeVersion(value: number) {
        activeVersion = value;
      },
      get documentState(): OnlineBusinessDocument['state'] {
        return documentState;
      },
      set documentState(value: OnlineBusinessDocument['state']) {
        documentState = value;
      },
      get latestContent(): NonNullable<OnlineBusinessDocument['versions']>[number]['content'] {
        return latestContent;
      },
      set latestContent(value: NonNullable<OnlineBusinessDocument['versions']>[number]['content']) {
        latestContent = value;
      },
      get editable(): boolean {
        return editable;
      },
      set editable(value: boolean) {
        editable = value;
      },
      get savedEditorHtml(): string {
        return savedEditorHtml;
      },
      set savedEditorHtml(value: string) {
        savedEditorHtml = value;
      },
    };
    const headingNodes = createOnlineEditorHeading({ documentData, state });
    const { dialog, heading } = headingNodes;
    const versions = [...(documentData.versions ?? [])].sort((a, b) => b.version - a.version);
    const current = versions.find((item) => item.version === state.activeVersion) ?? versions[0];
    state.latestContent = current?.content ?? state.latestContent;
    const workspaceNodes = createOnlineEditorWorkspace({
      ...ports,
      documentData,
      permissions,
      current,
    });
    const {
      workspace,
      layout,
      editor,
      documentScroll,
      actionPanel,
      history,
      bindingSummary,
      title,
      toolbar,
      toggleHistory,
      commandBar,
      body,
    } = workspaceNodes;
    let editable = !state.documentState || ['DRAFT', 'REJECTED'].includes(state.documentState);
    let savedEditorHtml = body.innerHTML;
    body.contentEditable = String(state.editable && permissions.manage);
    const context = {
      ...ports,
      ...headingNodes,
      ...workspaceNodes,
      documentData,
      permissions,
      onSaved,
      state,
      current,
      versions,
    };
    const paginationBindings = bindOnlineEditorPagination(context);
    const { updateDocumentPagination } = paginationBindings;
    const callbacks = {
      get addVersionToHistory() {
        return addVersionToHistory;
      },
    };
    const saveNodes = createOnlineEditorSave({ ...context, callbacks });
    const { summary, status, save } = saveNodes;
    documentScroll.append(title, bindingSummary, toolbar, body);
    actionPanel.append(summary, save, status);
    editor.append(documentScroll, actionPanel);
    toolbar.hidden = !state.editable || !permissions.manage;
    summary.hidden = !state.editable || !permissions.manage;
    const reviewContext = { ...context, ...paginationBindings, ...saveNodes };
    const { reviewReason } = createOnlineEditorReview(reviewContext);
    const comparison = el('section', 'business-document-comparison');
    appendOnlineEditorHistory(context);
    const historyContext = { ...reviewContext, comparison };
    const addVersionToHistory = createOnlineEditorVersionHistory(historyContext);
    for (const item of versions) addVersionToHistory(item);
    toggleHistory.addEventListener('click', () => {
      const collapsed = workspace.classList.toggle('history-collapsed');
      toggleHistory.textContent = collapsed ? '展开版本栏' : '收起版本栏';
      toggleHistory.setAttribute('aria-expanded', String(!collapsed));
    });
    bindOnlineEditorTranslation(historyContext);
    bindOnlineEditorSend({ ...historyContext, reviewReason });
    bindOnlineEditorExport(historyContext);
    layout.append(editor, history);
    workspace.append(commandBar, layout, comparison);
    dialog.append(heading, workspace);
    dialog.addEventListener('close', () => {
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    window.requestAnimationFrame(updateDocumentPagination);
  };
  return openOnlineDocumentEditor;
}
