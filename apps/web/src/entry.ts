import { el, setOperationStatus } from './dom';
import { brandMark } from './brand';
import { RequestError } from './http-core';
import type { LoginProgress } from './login-flow';
import type { SessionState, SessionContext } from './session';
import { clearLegacySession } from './legacy-session';
import { loadWorkspace, loadModule } from './workspace-loader';
import { restoreBrowserSession } from './browser-session';
import {
  sessionInvalidationMessage,
  SessionSignals,
  restoreCurrentSession,
} from './session-signals';

let sessions: SessionState | null = null;
let startupEpoch = 0;
let migrationChecked = false;
let notifications: BroadcastChannel | null = null;
let listenersInstalled = false;
let watch: Readonly<{ check: () => Promise<void> }> | null = null;
const signals = new SessionSignals();
function notifySessionChange(): void {
  signals.notify();
  notifications?.postMessage('invalidate');
}
function reloadApplication(): void {
  globalThis.location.reload();
}
function notifyAndReload(): void {
  notifySessionChange();
  reloadApplication();
}

function installSessionListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  const check = () => {
    signals.notify();
    if (sessions?.current) {
      sessions.current.owner.pause();
      void watch?.check();
    }
  };
  globalThis.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  if (typeof BroadcastChannel !== 'undefined') {
    notifications = new BroadcastChannel('kingturf.session');
    notifications.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (sessionInvalidationMessage(event.data)) check();
    });
  }
}

function startupView(root: HTMLElement, message: string): void {
  const shell = el('main', 'startup-shell');
  shell.setAttribute('aria-busy', 'true');
  shell.setAttribute('aria-live', 'polite');
  const mark = document.createElement('img');
  mark.src = brandMark;
  mark.alt = '';
  mark.width = 512;
  mark.height = 512;
  const progress = el('span', 'startup-progress');
  progress.setAttribute('aria-hidden', 'true');
  const status = el('p', 'startup-status', message);
  shell.append(
    mark,
    el('p', 'eyebrow', '金特夫企业经营管理系统'),
    el('h1', '', '正在准备工作台'),
    status,
    progress,
  );
  root.replaceChildren(shell);
}

function updateStartupStatus(root: HTMLElement, message: string): void {
  const status = root.querySelector<HTMLElement>('.startup-status');
  if (status) status.textContent = message;
}

function startupFailureView(root: HTMLElement): void {
  const epoch = startupEpoch;
  const captured = sessions?.current ?? null;
  startupView(root, '工作台加载失败，请重新加载或返回登录。');
  const retry = el('button', 'primary', '重新加载工作台');
  retry.addEventListener('click', reloadApplication);
  root.append(retry);
  if (!captured) {
    const signOut = el('button', 'secondary', '返回登录');
    signOut.addEventListener('click', () => {
      startupEpoch += 1;
      loginView(root);
    });
    root.append(signOut);
  }
  void import('./session-actions')
    .then((view) => {
      if (startupEpoch !== epoch) return;
      view.renderStartupFailure(root, captured, sessions, notifyAndReload, () => {
        startupEpoch += 1;
        sessions?.begin();
        loginView(root);
      });
    })
    .catch(() => {
      /* The immediate fallback remains usable if the failure-only chunk is unavailable. */
    });
}

function loginView(root: HTMLElement, initialMessage = ''): void {
  const shell = el('main', 'login-shell');
  const story = el('section', 'login-story');
  const loginBrand = el('div', 'login-brand');
  const loginLogo = document.createElement('img');
  loginLogo.src = brandMark;
  loginLogo.decoding = 'async';
  loginLogo.alt = '';
  loginLogo.width = 512;
  loginLogo.height = 512;
  const loginIdentity = el('span', 'login-brand-identity');
  loginIdentity.append(el('strong', '', '金特夫'), el('small', '', 'KING TURF'));
  loginBrand.setAttribute('aria-label', '金特夫 King Turf');
  loginBrand.append(loginLogo, loginIdentity);
  story.append(
    loginBrand,
    el('p', 'eyebrow', '企业经营管理系统'),
    el('h1', '', '业务一体化管理'),
    el('p', 'login-intro', '销售、采购、生产、质量与财务协同'),
  );
  const form = el('form', 'login-card');
  form.setAttribute('autocomplete', 'on');
  form.append(
    el('p', 'eyebrow', '企业账号登录'),
    el('h2', '', '登录金特夫'),
    el('p', 'muted', '请输入企业账号和密码'),
  );
  const identity = el('input');
  identity.name = 'login';
  identity.setAttribute('aria-label', '账号');
  identity.placeholder = '账号';
  identity.required = true;
  identity.autocomplete = 'username';
  identity.autocapitalize = 'none';
  identity.spellcheck = false;
  const password = el('input');
  password.name = 'password';
  password.setAttribute('aria-label', '密码');
  password.type = 'password';
  password.placeholder = '密码';
  password.required = true;
  password.autocomplete = 'current-password';
  const submit = el('button', 'primary', '登录');
  submit.type = 'submit';
  const status = el('p', 'login-status', initialMessage);
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('role', 'status');
  if (initialMessage) status.dataset.state = 'error';
  form.append(identity, password, submit, status);
  let submitting = false;
  const initialize = async () => {
    if (root.contains(form)) await bootstrap(root);
    else await watch?.check();
  };
  const renderProgress = (progress: LoginProgress): void => {
    const busy = progress.phase !== 'error';
    identity.disabled = busy;
    password.disabled = busy;
    submit.disabled = busy;
    submit.textContent = progress.phase === 'authenticating' ? '正在登录…' : '登录';
    form.setAttribute('aria-busy', String(busy));
    setOperationStatus(status, progress.phase === 'error' ? 'error' : 'loading', progress.message);
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    renderProgress({ phase: 'authenticating', message: '正在验证账号…' });
    const login = identity.value.trim();
    const credential = password.value;
    void loadModule(() => import('./session-actions'))
      .then((auth) =>
        auth.submitBrowserLogin(login, credential, notifySessionChange, initialize, renderProgress),
      )
      .catch(() => {
        renderProgress({ phase: 'error', message: '暂时无法登录，请检查网络后重试' });
        return false;
      })
      .then((success) => {
        submitting = false;
        if (!success && root.contains(form)) {
          identity.disabled = false;
          password.disabled = false;
          submit.disabled = false;
          submit.textContent = '登录';
          form.setAttribute('aria-busy', 'false');
          password.value = '';
          password.focus();
        }
      });
  });
  shell.append(story, form);
  root.replaceChildren(shell);
  if ((globalThis.innerWidth || 1280) > 820) identity.focus();
}

async function bootstrapApplication(root: HTMLElement, epoch: number): Promise<void> {
  if (!migrationChecked) {
    migrationChecked = true;
    if (clearLegacySession(sessionStorage)) {
      loginView(root, '登录方式已更新，请重新登录');
      return;
    }
  }
  if (startupEpoch !== epoch) return;
  startupView(root, '正在验证登录状态…');
  let context: SessionContext | null;
  let runtime: typeof import('./session-watch');
  let restorationRevision: number;
  try {
    const restored = await restoreCurrentSession(signals, restoreBrowserSession);
    const value = restored.value;
    restorationRevision = restored.revision;
    runtime = await loadModule(() => import('./session-watch'));
    if (startupEpoch !== epoch) return;
    if (!(signals.revision === restored.revision)) throw new Error('Session changed');
    sessions ??= new runtime.SessionState();
    context = sessions.install(value, sessions.begin());
    if (!context) return;
  } catch (error) {
    if (startupEpoch !== epoch) return;
    if (error instanceof RequestError && error.status === 401) {
      loginView(root, '登录状态已失效，请重新登录');
      return;
    }
    throw error;
  }
  const captured = context;
  const state = sessions;
  const current = () =>
    runtime.sessionMountIsCurrent(state, captured, signals, restorationRevision);
  const verify = () => {
    if (current()) return;
    captured.owner.pause();
    throw new Error('Session changed');
  };
  watch ??= runtime.createSessionWatch(root, sessions, signals, reloadApplication, notifyAndReload);
  updateStartupStatus(root, '登录成功，正在下载业务工作台…');
  const workspace = await loadWorkspace();
  if (!sessions.isCurrent(captured)) return;
  verify();
  await workspace.mountWorkspace(
    root,
    captured.session,
    captured,
    (message) => {
      if (current()) updateStartupStatus(root, message);
    },
    current,
  );
  if (sessions.isCurrent(captured)) verify();
}

export async function bootstrap(root: HTMLElement): Promise<void> {
  installSessionListeners();
  sessions?.begin();
  const epoch = ++startupEpoch;
  try {
    await bootstrapApplication(root, epoch);
  } catch {
    if (startupEpoch === epoch) startupFailureView(root);
  }
}
