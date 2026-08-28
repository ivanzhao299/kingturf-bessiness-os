import { describe, expect, it, vi } from 'vitest';
import { LoginCoordinator, loginFailureMessage, type LoginProgress } from './login-flow';

describe('LoginCoordinator', () => {
  it('authenticates and initializes once while repeated submissions share the same operation', async () => {
    let resolveAuthentication: ((token: string) => void) | undefined;
    const authenticate = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveAuthentication = resolve;
        }),
    );
    const initialize = vi.fn().mockResolvedValue(undefined);
    const progress: LoginProgress[] = [];
    const coordinator = new LoginCoordinator(authenticate, initialize);

    const first = coordinator.submit('employee', 'secret', (state) => progress.push(state));
    const repeated = coordinator.submit('employee', 'secret', (state) => progress.push(state));
    expect(first).toBe(repeated);
    expect(coordinator.busy).toBe(true);
    expect(authenticate).toHaveBeenCalledTimes(1);

    resolveAuthentication?.('session-token');
    await expect(first).resolves.toBe(true);
    expect(initialize).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledWith('session-token');
    expect(progress).toEqual([
      { phase: 'authenticating', message: '正在验证账号…' },
      { phase: 'initializing', message: '登录成功，正在加载工作台…' },
    ]);
    expect(coordinator.busy).toBe(false);
  });

  it('turns authentication failures into one actionable status', async () => {
    const coordinator = new LoginCoordinator(vi.fn().mockRejectedValue({ status: 401 }), vi.fn());
    const progress: LoginProgress[] = [];
    await expect(
      coordinator.submit('employee', 'incorrect', (state) => progress.push(state)),
    ).resolves.toBe(false);
    expect(progress.at(-1)).toEqual({
      phase: 'error',
      message: '账号或密码不正确，请重新输入',
    });
  });
});

it('keeps timeout and rate-limit login guidance specific without exposing server details', () => {
  expect(loginFailureMessage({ status: 429 })).toBe('登录尝试过于频繁，请稍后再试');
  expect(loginFailureMessage(new Error('请求超时，请检查网络后重试'))).toBe(
    '请求超时，请检查网络后重试',
  );
  expect(loginFailureMessage(new Error('database detail'))).toBe('暂时无法登录，请检查网络后重试');
});
