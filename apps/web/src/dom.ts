export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export type OperationState = 'idle' | 'loading' | 'success' | 'error';
export function setOperationStatus(target: HTMLElement, state: OperationState, message = ''): void {
  target.textContent = message;
  target.dataset.state = state;
  if (state === 'loading') target.setAttribute('aria-busy', 'true');
  else target.removeAttribute('aria-busy');
}
