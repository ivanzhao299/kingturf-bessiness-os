import { el } from './dom';
import { brandMark } from './brand';
import { expireSession, type SessionContext, type SessionState } from './session';
import { logoutBrowserSession } from './browser-logout';

/** Failure-only UI; normal login and authenticated startup do not download it. */
export function renderStartupFailure(
  root: HTMLElement,
  captured: SessionContext | null,
  state: SessionState | null,
  invalidated: () => void,
  login: () => void,
): void {
  const shell = el('main', 'startup-shell startup-failure');
  const mark = document.createElement('img');
  mark.src = brandMark;
  mark.alt = '';
  mark.width = 512;
  mark.height = 512;
  const status = el(
    'p',
    'startup-status error',
    '工作台暂时未能完整加载。登录状态仍已保留，可以安全重试。',
  );
  status.setAttribute('role', 'alert');
  const actions = el('div', 'startup-actions');
  const retry = el('button', 'primary', '重新加载工作台');
  retry.type = 'button';
  retry.addEventListener('click', () => {
    retry.disabled = true;
    globalThis.location.reload();
  });
  const signOut = el('button', 'secondary', '返回登录');
  signOut.type = 'button';
  signOut.addEventListener('click', () => {
    if (!captured) {
      login();
      return;
    }
    signOut.disabled = true;
    void logoutBrowserSession(captured)
      .then(() => {
        if (state) expireSession(captured, state, invalidated);
      })
      .catch(() => {
        if (!state?.isCurrent(captured)) return;
        signOut.disabled = false;
        status.textContent = '退出未完成，请重试；当前登录状态未被清除。';
      });
  });
  const reload = el('button', 'secondary', '刷新页面获取最新版本');
  reload.type = 'button';
  reload.addEventListener('click', () => {
    globalThis.location.reload();
  });
  actions.append(retry, reload, signOut);
  shell.append(mark, el('h1', '', '加载遇到问题'), status, actions);
  root.replaceChildren(shell);
}
