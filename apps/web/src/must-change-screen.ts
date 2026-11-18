// A1（TD-SEC-011）：首登强制改密屏。MUST_CHANGE 会话登录后渲染本屏，
// 复用登录壳样式；提交走 PUT /auth/credential（幂等键），成功后引导重新登录
// （改密事务撤销全部旧会话，含当前会话）。
import { el, setOperationStatus } from './dom';
import { json, requestId } from './http';
import type { SessionContext } from './session';

// bootstrap 懒加载块入口：MUST_CHANGE 会话直接渲染改密屏，不进入工作台；
// 改密成功后整页刷新——旧会话已被服务端全部撤销，重走 401→登录的既有语义。
export async function mustChangeGate(root: HTMLElement, context: SessionContext): Promise<void> {
  await Promise.resolve();
  renderMustChangeScreen(root, context, () => {
    globalThis.location.reload();
  });
}

export const mustChangeRequired = (session: Readonly<{ credentialState?: string }>): boolean =>
  session.credentialState === 'MUST_CHANGE';

export function renderMustChangeScreen(
  root: HTMLElement,
  context: SessionContext,
  done: () => void,
): void {
  const shell = el('main', 'login-shell');
  const card = el('form', 'login-card');
  card.setAttribute('autocomplete', 'on');
  card.append(
    el('p', 'eyebrow', '账号安全'),
    el('h2', '', '首次登录请修改密码'),
    el('p', 'muted', '管理员下发的临时密码必须更换后才能进入系统'),
  );
  const current = el('input');
  current.type = 'password';
  current.setAttribute('name', 'currentPassword');
  current.setAttribute('aria-label', '临时密码');
  current.placeholder = '临时密码';
  current.required = true;
  current.autocomplete = 'current-password';
  const next = el('input');
  next.type = 'password';
  next.setAttribute('name', 'password');
  next.setAttribute('aria-label', '新密码');
  next.placeholder = '新密码（至少 12 位）';
  next.required = true;
  next.minLength = 12;
  next.autocomplete = 'new-password';
  const confirm = el('input');
  confirm.type = 'password';
  confirm.setAttribute('name', 'passwordConfirm');
  confirm.setAttribute('aria-label', '确认新密码');
  confirm.placeholder = '再次输入新密码';
  confirm.required = true;
  const submit = el('button', 'primary', '修改密码并重新登录');
  submit.type = 'submit';
  const status = el('p', 'login-status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('role', 'status');
  card.append(current, next, confirm, submit, status);
  card.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (next.value !== confirm.value) {
      setOperationStatus(status, 'error', '两次输入的新密码不一致');
      return;
    }
    if (next.value.length < 12) {
      setOperationStatus(status, 'error', '新密码至少需要 12 位');
      return;
    }
    submit.disabled = true;
    setOperationStatus(status, 'loading', '正在提交…');
    void json('/api/v1/auth/credential', context, {
      method: 'PUT',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify({ currentPassword: current.value, password: next.value }),
    })
      .then(() => {
        setOperationStatus(status, 'success', '密码已更新，请重新登录');
        done();
      })
      .catch((failure: unknown) => {
        setOperationStatus(
          status,
          'error',
          failure instanceof Error ? failure.message : '修改失败，请重试',
        );
        submit.disabled = false;
      });
  });
  const story = el('section', 'login-story');
  story.append(el('p', 'eyebrow', '金特夫企业经营管理系统'));
  shell.append(story, card);
  root.replaceChildren(shell);
  current.focus();
}
