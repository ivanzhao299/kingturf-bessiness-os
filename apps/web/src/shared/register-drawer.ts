import { el } from '../dom';
import type { RegisterProfile } from './register-profile';

export function createRegisterDrawer(shell: HTMLElement) {
  let detailDrawer: HTMLElement | undefined;
  const showDrawer = (profile: RegisterProfile, title: string, content: HTMLElement) => {
    if (!detailDrawer) {
      detailDrawer = el('aside', 'record-detail-drawer');
      detailDrawer.setAttribute('aria-label', '业务记录详情');
      detailDrawer.setAttribute('aria-live', 'polite');
      shell.append(detailDrawer);
    }
    const close = el('button', 'record-detail-close', '关闭');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭业务记录详情');
    close.addEventListener('click', () => {
      if (detailDrawer) detailDrawer.hidden = true;
    });
    const head = el('div', 'record-detail-head');
    const identity = el('div');
    identity.append(el('p', 'eyebrow', profile.label), el('h2', '', title));
    head.append(identity, close);
    detailDrawer.replaceChildren(head, content);
    detailDrawer.hidden = false;
    close.focus();
  };
  const openDetailDrawer = (item: HTMLElement, profile: RegisterProfile) => {
    const name =
      item.querySelector<HTMLElement>('strong, h3, h4')?.textContent.trim() ?? '业务记录';
    const statuses = Array.from(
      item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'),
    )
      .map((entry) => entry.textContent.trim())
      .filter(Boolean);
    const status = el('div', 'record-detail-status');
    status.append(
      el('span', 'record-detail-label', '当前状态'),
      el('strong', '', statuses.join('、') || '状态未标记'),
    );
    const summary = el('section', 'record-detail-summary');
    summary.append(el('h3', '', '关键业务字段'));
    const fields = el('dl', 'record-detail-fields');
    const segments = Array.from(item.children)
      .filter(
        (entry): entry is HTMLElement =>
          entry instanceof HTMLElement &&
          !entry.matches('button, .quality-actions, .ctr-actions') &&
          entry.textContent.trim().length > 0,
      )
      .map((entry) => entry.textContent.replace(/\s+/gu, ' ').trim());
    const values = segments.length > 1 ? segments : [item.textContent.replace(/\s+/gu, ' ').trim()];
    for (const [index, value] of values.slice(0, profile.detailLabels.length).entries()) {
      fields.append(
        el('dt', '', profile.detailLabels[index] ?? `业务字段 ${String(index + 1)}`),
        el('dd', '', value),
      );
    }
    summary.append(fields);
    const note = el(
      'p',
      'record-detail-note',
      '此处展示当前权限范围内的只读业务快照；业务操作仍在原记录行中执行。',
    );
    const body = el('div', 'record-detail-body');
    body.append(status, summary, note);
    showDrawer(profile, name, body);
  };
  return { showDrawer, openDetailDrawer };
}
