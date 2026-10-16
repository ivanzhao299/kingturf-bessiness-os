import { el } from '../dom';
export const businessDocumentOption = (label: string, value: string): HTMLOptionElement => {
  const option = document.createElement('option');
  option.textContent = label;
  option.value = value;
  return option;
};

export const sanitizeBusinessDocumentHtml = (value: string): string => {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const allowed = new Set([
    'B',
    'BR',
    'DIV',
    'EM',
    'H2',
    'H3',
    'I',
    'LI',
    'OL',
    'P',
    'STRONG',
    'U',
    'UL',
  ]);
  for (const node of Array.from(parsed.body.querySelectorAll('*'))) {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent));
      continue;
    }
    for (const attribute of Array.from(node.attributes)) node.removeAttribute(attribute.name);
  }
  return parsed.body.innerHTML;
};

export const businessDocumentText = (
  content: Readonly<{ body?: string; html?: string }>,
): string => {
  if (!content.html) return content.body ?? '';
  const parsed = new DOMParser().parseFromString(content.html, 'text/html');
  return parsed.body.textContent;
};

export const renderBusinessDocumentComparison = (
  target: HTMLElement,
  earlier: string,
  latest: string,
  earlierVersion: number,
  latestVersion: number,
): void => {
  const left = earlier.split('\n');
  const right = latest.split('\n');
  const rows = Math.max(left.length, right.length);
  target.replaceChildren(
    el('h3', '', `V${String(earlierVersion)} 与 V${String(latestVersion)} 对比`),
  );
  const grid = el('div', 'business-document-diff-grid');
  for (let index = 0; index < rows; index += 1) {
    const changed = (left[index] ?? '') !== (right[index] ?? '');
    grid.append(
      el('pre', changed ? 'changed' : '', left[index] ?? ''),
      el('pre', changed ? 'changed' : '', right[index] ?? ''),
    );
  }
  target.append(grid);
};
