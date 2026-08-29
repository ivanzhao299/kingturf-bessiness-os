export type LoginProgress = Readonly<{
  phase: 'authenticating' | 'initializing' | 'error';
  message: string;
}>;

type StatusError = Readonly<{ status?: unknown; message?: unknown }>;

export function loginFailureMessage(error: unknown): string {
  const candidate =
    typeof error === 'object' && error !== null ? (error as StatusError) : undefined;
  if (candidate?.status === 401) return '账号或密码不正确，请重新输入';
  if (candidate?.status === 429) return '登录尝试过于频繁，请稍后再试';
  if (candidate?.message === '请求超时，请检查网络后重试') return candidate.message;
  return '暂时无法登录，请检查网络后重试';
}

/**
 * Owns login single-flight behavior independently from the DOM. A form can render progress however it
 * needs while authentication and application initialization remain one deterministic operation.
 */
export class LoginCoordinator {
  private pending: Promise<boolean> | null = null;

  public constructor(
    private readonly authenticate: (login: string, password: string) => Promise<string>,
    private readonly initialize: (token: string) => Promise<void>,
  ) {}

  public get busy(): boolean {
    return this.pending !== null;
  }

  public submit(
    login: string,
    password: string,
    onProgress: (progress: LoginProgress) => void,
  ): Promise<boolean> {
    if (this.pending) return this.pending;
    const operation = this.run(login, password, onProgress);
    this.pending = operation;
    void operation.finally(() => {
      if (this.pending === operation) this.pending = null;
    });
    return operation;
  }

  private async run(
    login: string,
    password: string,
    onProgress: (progress: LoginProgress) => void,
  ): Promise<boolean> {
    onProgress({ phase: 'authenticating', message: '正在验证账号…' });
    try {
      const token = await this.authenticate(login, password);
      onProgress({ phase: 'initializing', message: '登录成功，正在加载工作台…' });
      await this.initialize(token);
      return true;
    } catch (error) {
      onProgress({ phase: 'error', message: loginFailureMessage(error) });
      return false;
    }
  }
}
