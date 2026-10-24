import { el } from './dom';
import { RequestError, onSessionExpired } from './http';
import { expireSession, type SessionState, type SessionContext } from './session';
import type { SessionSignals } from './session-signals';
import { revalidateSession } from './session-revalidation';
import { restoreBrowserSession } from './browser-session';
export { SessionState } from './session';

export function sessionMountIsCurrent(
  state: SessionState,
  context: SessionContext,
  signals: SessionSignals,
  revision: number,
): boolean {
  return state.isCurrent(context) && signals.revision === revision;
}

/** Loaded only after an authenticated restore, not needed by the login form. */
export function createSessionWatch(
  root: HTMLElement,
  state: SessionState,
  signals: SessionSignals,
  reload: () => void,
  login: () => void,
) {
  onSessionExpired((context) => {
    expireSession(context, state, login);
  });
  let busy = false;
  const manual = () => {
    if (root.querySelector('[data-session-retry]')) return;
    const notice = el(
      'div',
      'operation-status error',
      '登录安全状态待重新核验，未提交内容已保留。请重新加载后再操作。',
    );
    notice.dataset.sessionRetry = 'true';
    notice.setAttribute('role', 'alert');
    const retry = el('button', 'secondary', '重新加载工作台');
    retry.type = 'button';
    retry.addEventListener('click', () => {
      reload();
    });
    notice.append(retry);
    root.prepend(notice);
  };
  const checkOnce = async () => {
    const captured = state.current;
    if (!captured) return 'done';
    const revision = signals.revision;
    try {
      const result = await revalidateSession(
        state,
        captured,
        restoreBrowserSession,
        () => signals.revision === revision,
      );
      if (!state.isCurrent(captured)) return 'done';
      if (result === 'stale') return 'again';
      if (result === 'changed') {
        state.begin();
        reload();
      } else if (result === 'manual') manual();
    } catch (error) {
      if (!state.isCurrent(captured)) return 'done';
      if (!(signals.revision === revision)) return 'again';
      if (error instanceof RequestError && error.status === 401)
        expireSession(captured, state, login);
      else manual();
    }
    return 'done';
  };
  const check = async () => {
    if (busy || !state.current) return;
    busy = true;
    try {
      if ((await checkOnce()) === 'again' && (await checkOnce()) === 'again') manual();
    } finally {
      busy = false;
    }
  };
  return { check };
}
