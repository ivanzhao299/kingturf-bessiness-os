import { el } from './dom';

export function documentSendBlockReason(state: string | undefined, customerId?: string): string {
  if (state === 'ARCHIVED') return '文档已归档，不能发送。请新建业务文档并完成审核。';
  const missing: string[] = [];
  if (!customerId) missing.push('先在业务页选择客户并创建关联文档（当前文档尚未绑定客户）');
  if (state !== 'APPROVED') {
    missing.push(
      state === 'IN_REVIEW'
        ? '当前文档正在审核，请等待审批人批准并锁版'
        : state === 'REJECTED'
          ? '当前文档已被驳回，请按审核意见修改，保存当前内容并提交审核，由审批人批准并锁版'
          : '当前文档为草稿，请保存当前内容并提交审核，由审批人批准并锁版',
    );
  }
  return missing.length ? `暂不能发送：${missing.join('；')}。审批前不会向客户发送草稿。` : '';
}

export function documentDispatchStatus(status: string): string {
  return (
    (
      {
        QUEUED: '待发送（尚未确认送达）',
        DELIVERED: '已送达',
        RETRY: '等待重试',
        FAILED: '发送失败',
      } as Record<string, string>
    )[status] ?? '状态待确认'
  );
}

export function documentSendNotice(message: string): {
  dialog: HTMLDialogElement;
  message: HTMLParagraphElement;
  addAction: (label: string, action: () => void) => void;
} {
  const dialog = el('dialog', 'form-dialog document-send-notice');
  dialog.setAttribute('aria-label', '发送给客户');
  const content = el('div', 'entity-form');
  const text = el('p', 'operation-status', message);
  text.setAttribute('role', 'status');
  text.setAttribute('aria-live', 'polite');
  text.tabIndex = -1;
  const close = el('button', 'secondary', '返回文档');
  close.type = 'button';
  close.addEventListener('click', () => {
    dialog.close();
  });
  content.append(el('h2', '', '发送给客户'), text, close);
  dialog.append(content);
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
  text.focus();
  const addAction = (label: string, action: () => void): void => {
    const button = el('button', 'primary', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      dialog.close();
      action();
    });
    content.insertBefore(button, close);
  };
  return { dialog, message: text, addAction };
}
