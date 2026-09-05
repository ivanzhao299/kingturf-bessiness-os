import { afterEach, expect, it, vi } from 'vitest';
import { loadWorkspace } from './workspace-loader';

afterEach(() => vi.useRealTimers());

it('returns the module without mounting it and clears its deadline', async () => {
  vi.useFakeTimers();
  const module = { mountWorkspace: vi.fn() };
  await expect(loadWorkspace(() => Promise.resolve(module))).resolves.toBe(module);
  expect(module.mountWorkspace).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('turns an endless download into a recoverable error without a late workspace mount', async () => {
  vi.useFakeTimers();
  const module = { mountWorkspace: vi.fn() };
  let resolve: ((value: typeof module) => void) | undefined;
  const pending = new Promise<typeof module>((finish) => {
    resolve = finish;
  });
  const assertion = expect(loadWorkspace(() => pending)).rejects.toThrow('业务工作台下载超时');
  await vi.advanceTimersByTimeAsync(45_000);
  await assertion;
  resolve?.(module);
  await Promise.resolve();
  expect(module.mountWorkspace).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('clears deadlines on chunk rejection and supports a subsequent explicit attempt', async () => {
  vi.useFakeTimers();
  await expect(loadWorkspace(() => Promise.reject(new Error('chunk unavailable')))).rejects.toThrow(
    'chunk unavailable',
  );
  expect(vi.getTimerCount()).toBe(0);
  await expect(
    loadWorkspace(() => Promise.resolve({ mountWorkspace: vi.fn() })),
  ).resolves.toHaveProperty('mountWorkspace');
});
