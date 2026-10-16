import { el } from '../dom';
import { setOperationStatus } from '../dom';
import type { OnlineEditorContext } from './online-editor-types';

export function createOnlineEditorSave(
  context: Pick<
    OnlineEditorContext,
    | 'upgradedLegacyOutline'
    | 'permissions'
    | 'body'
    | 'sanitizeBusinessDocumentHtml'
    | 'businessDocumentText'
    | 'onlineDocumentApi'
    | 'documentData'
    | 'versions'
    | 'versionStatus'
    | 'clearSessionReadCache'
    | 'onSaved'
    | 'state'
    | 'callbacks'
  >,
) {
  const {
    upgradedLegacyOutline,
    permissions,
    body,
    sanitizeBusinessDocumentHtml,
    businessDocumentText,
    onlineDocumentApi,
    documentData,
    versions,
    versionStatus,
    clearSessionReadCache,
    onSaved,
    state,
    callbacks,
  } = context;
  const summary = el('input');
  summary.placeholder = '本版修改说明，例如：调整数量、价格和交期';
  summary.setAttribute('aria-label', '本版修改说明');
  const status = el(
    'p',
    'operation-status',
    upgradedLegacyOutline
      ? '已将旧提纲升级为完整正文，请核对业务信息后保存为新版本'
      : '编辑完成后保存为新版本',
  );
  if (upgradedLegacyOutline) status.dataset.state = 'warning';
  status.setAttribute('aria-live', 'polite');
  const save = el('button', 'primary', '保存为新版本');
  save.type = 'button';
  save.hidden = !state.editable || !permissions.manage;
  save.addEventListener('click', () => {
    if (save.disabled) return;
    const editingSnapshot = body.innerHTML;
    const cleanHtml = sanitizeBusinessDocumentHtml(body.innerHTML);
    const plainText = businessDocumentText({ html: cleanHtml });
    if (!plainText.trim()) {
      setOperationStatus(status, 'error', '文档正文不能为空');
      return;
    }
    if (!summary.value.trim()) {
      setOperationStatus(status, 'error', '请填写本版修改说明');
      return;
    }
    save.disabled = true;
    setOperationStatus(status, 'loading', '正在保存新版本…');
    void onlineDocumentApi<{ currentVersion: number }>(
      `/api/v1/business-documents/${documentData.id}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: state.activeVersion,
          content: { body: plainText, html: cleanHtml },
          changeSummary: summary.value,
        }),
      },
    )
      .then((saved) => {
        state.activeVersion = saved.currentVersion;
        state.latestContent = { body: plainText, html: cleanHtml };
        state.savedEditorHtml = cleanHtml;
        if (body.innerHTML === editingSnapshot) body.innerHTML = cleanHtml;
        const savedVersion = {
          version: state.activeVersion,
          content: state.latestContent,
          changeSummary: summary.value.trim(),
          createdAt: new Date().toISOString(),
        };
        versions.unshift(savedVersion);
        const addVersionToHistory = callbacks.addVersionToHistory;
        addVersionToHistory(savedVersion, true);
        versionStatus.textContent = `当前版本 V${String(state.activeVersion)} · 保存不会覆盖历史版本`;
        setOperationStatus(
          status,
          'success',
          `已保存到当前业务页的“已保存在线文档”及右侧“版本记录”：V${String(state.activeVersion)}。编辑窗口保持打开，可继续修改。`,
        );
        summary.value = '';
        save.disabled = false;
        save.textContent = '继续保存为新版本';
        clearSessionReadCache();
        onSaved?.(state.activeVersion);
      })
      .catch((failure: unknown) => {
        save.disabled = false;
        setOperationStatus(
          status,
          'error',
          failure instanceof Error ? failure.message : '在线文档保存失败',
        );
      });
  });
  return { summary, status, save };
}
