// 测试夹具：不可逆动作的确认框（TD-WF-014②）。控制台测试里单击发布 / 取消 / 关闭 / 签发之后，
// 先出确认框；这里断言标题与按钮文字、初焦位置，然后点确认。
import { expect } from 'vitest';
import { TestDocument, type TestElement } from './preact-dom';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

/** 页面上当前开着的确认框；没有即抛错。 */
export const confirmDialogOf = (host: TestElement): TestElement =>
  element(host.querySelector('[role="alertdialog"]'));

/** 点确认框里的「确认」：先断言标题、按钮文字（取消 / 确认）与初焦位置。destructive 时初焦在「取消」上。 */
export const confirmAction = async (
  host: TestElement,
  title: string,
  confirmLabel: string,
  { destructive = false }: Readonly<{ destructive?: boolean }> = {},
): Promise<void> => {
  // 触发按钮点下去之后确认框在下一拍渲染出来。
  await flush();
  const dialog = confirmDialogOf(host);
  expect(dialog.textContent).toContain(title);
  const buttons = dialog.querySelectorAll('button');
  expect(buttons.map((button) => button.textContent.trim())).toEqual(['取消', confirmLabel]);
  expect(TestDocument.current.activeElement).toBe(destructive ? buttons[0] : buttons[1]);
  element(buttons[1]).click();
  await flush();
  expect(host.querySelector('[role="alertdialog"]')).toBe(null);
};

/** 不确认：点确认框里的「取消」。 */
export const dismissConfirm = async (host: TestElement): Promise<void> => {
  await flush();
  element(confirmDialogOf(host).querySelectorAll('button')[0]).click();
  await flush();
  expect(host.querySelector('[role="alertdialog"]')).toBe(null);
};
