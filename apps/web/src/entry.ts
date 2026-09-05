import { el, setOperationStatus } from './dom';
import { json, RequestError } from './http';
import { LoginCoordinator, type LoginProgress } from './login-flow';
import type { SessionDto } from './session';
import { loadWorkspace } from './workspace-loader';

async function login(login: string, password: string): Promise<string> {
  const result = await json<{ token: string }>('/api/v1/auth/login', '', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
  return result.token;
}

function startupView(root: HTMLElement, message: string): void {
  const shell = el('main', 'startup-shell');
  shell.setAttribute('aria-busy', 'true');
  shell.setAttribute('aria-live', 'polite');
  const mark = document.createElement('img');
  mark.src = '/kingturf-mark-transparent.png';
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
  const shell = el('main', 'startup-shell startup-failure');
  const mark = document.createElement('img');
  mark.src = '/kingturf-mark-transparent.png';
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
    void bootstrap(root);
  });
  const signOut = el('button', 'secondary', '返回登录');
  signOut.type = 'button';
  signOut.addEventListener('click', () => {
    sessionStorage.removeItem('kingturf.session');
    loginView(root);
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

function loginView(root: HTMLElement, initialMessage = ''): void {
  const shell = el('main', 'login-shell');
  const story = el('section', 'login-story');
  const loginBrand = el('div', 'login-brand');
  const loginLogo = document.createElement('img');
  loginLogo.src = '/kingturf-mark-transparent.png';
  loginLogo.fetchPriority = 'low';
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
  const coordinator = new LoginCoordinator(login, async (token) => {
    sessionStorage.setItem('kingturf.session', token);
    await bootstrap(root);
  });
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
    if (coordinator.busy) return;
    void coordinator
      .submit(identity.value.trim(), password.value, renderProgress)
      .then((success) => {
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

async function bootstrapApplication(root: HTMLElement): Promise<void> {
  const token = sessionStorage.getItem('kingturf.session');
  if (!token) {
    loginView(root);
    return;
  }
  startupView(root, '正在验证登录状态…');
  let session: SessionDto;
  try {
    session = await json<SessionDto>('/api/v1/auth/session', token);
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) {
      sessionStorage.removeItem('kingturf.session');
      loginView(root, '登录状态已失效，请重新登录');
      return;
    }
    throw error;
  }
  updateStartupStatus(root, '登录成功，正在下载业务工作台…');
  const workspace = await loadWorkspace();
  await workspace.mountWorkspace(root, session, token, (message) => {
    updateStartupStatus(root, message);
  });
}

export async function bootstrap(root: HTMLElement): Promise<void> {
  try {
    await bootstrapApplication(root);
  } catch {
    startupFailureView(root);
  }
}
