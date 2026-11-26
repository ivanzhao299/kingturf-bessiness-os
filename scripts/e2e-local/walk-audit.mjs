// 走查的页内审计（在浏览器里执行）。这些函数经 page.evaluate 序列化后注入页面，因此必须自包含：
// 不得引用模块级标识，也不得闭包 Node 侧变量。检查项都是启发式的 DOM 量测：
// 表格宽于裁剪祖先且不可滚动、中日韩文字被压成每行一两个字、按钮仍是浏览器默认外观、
// 标题或表头被截断、文字被裁切、页面横向溢出。

/**
 * @param {{ kind: 'page', route: string } | { kind: 'drawer' }} target
 *   page：审计当前可见的路由视图；drawer：审计所有可见的 .detail-drawer。
 */
export function audit(target) {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = globalThis.getComputedStyle(element);
    return (
      rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    );
  };
  const text = (element) =>
    (element.innerText || element.textContent || '').replace(/\s+/gu, ' ').trim();
  const clip = (value, max) => (value.length > max ? `${value.slice(0, max)}…` : value);
  // 只取直接文本节点：带图标或排序符号的标签不算「一字一行」。
  const directText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent ?? '')
      .join('')
      .replace(/\s+/gu, ' ')
      .trim();
  const lineCount = (element) => {
    const range = globalThis.document.createRange();
    const tops = new Set();
    for (const node of element.childNodes) {
      if (node.nodeType !== 3 || !(node.textContent ?? '').trim()) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects())
        if (rect.width > 0 && rect.height > 0) tops.add(Math.round(rect.top / 4));
    }
    return tops.size;
  };

  const drawers = [...globalThis.document.querySelectorAll('.detail-drawer')].filter(visible);
  let roots;
  let bodies;
  if (target.kind === 'drawer') {
    roots = drawers;
    bodies = drawers.map((drawer) => drawer.querySelector('.drawer-body') ?? drawer);
  } else {
    const matches = [
      ...globalThis.document.querySelectorAll(`[data-route-view~="${target.route}"]`),
    ].filter(visible);
    roots = matches.filter(
      (element) => !matches.some((other) => other !== element && other.contains(element)),
    );
    if (roots.length === 0) {
      const main = globalThis.document.querySelector('main') ?? globalThis.document.body;
      if (visible(main)) roots = [main];
    }
    bodies = roots;
  }
  const page = target.kind === 'page';
  const prefix = page ? '' : 'drawer-';
  const wrapSelector = page
    ? 'th, td, h1, h2, h3, h4, button, a, label, .status-badge, .console-label, .eyebrow, p, strong, li'
    : 'th, td, button, a, label, .status-badge, .console-label, p, strong, li, div';
  const issues = [];
  let tableCount = 0;
  let clippedSeen = 0;
  roots.forEach((root, index) => {
    const body = bodies[index];
    for (const table of body.querySelectorAll('table')) {
      if (!visible(table)) continue;
      tableCount += 1;
      let node = table.parentElement;
      let clipper = null;
      while (node && node !== (page ? globalThis.document.body : root)) {
        if (globalThis.getComputedStyle(node).overflowX !== 'visible') {
          clipper = node;
          break;
        }
        node = node.parentElement;
      }
      const box = clipper ?? body;
      const over = Math.round(
        table.getBoundingClientRect().width - box.getBoundingClientRect().width,
      );
      const clipperOverflowX = clipper ? globalThis.getComputedStyle(clipper).overflowX : 'visible';
      if (over > 2 && clipperOverflowX !== 'auto' && clipperOverflowX !== 'scroll')
        issues.push({
          kind: `${prefix}table-clipped`,
          px: over,
          clipperOverflowX,
          where: clip(text(table.querySelector('caption, thead') ?? table), 50),
        });
    }
    for (const element of body.querySelectorAll(wrapSelector)) {
      if (!visible(element)) continue;
      const label = directText(element);
      if (label.length < 5 || !/[\u3400-\u9fff]/u.test(label)) continue;
      const lines = lineCount(element);
      if (lines >= 3 && label.length / lines <= 2.5)
        issues.push({
          kind: 'cjk-per-char-wrap',
          lines,
          chars: label.length,
          tag: element.tagName.toLowerCase(),
          text: clip(label, 30),
        });
    }
    for (const button of body.querySelectorAll('button')) {
      if (!visible(button)) continue;
      const style = globalThis.getComputedStyle(button);
      if (
        style.borderStyle === 'outset' ||
        (style.backgroundColor === 'rgb(239, 239, 239)' && style.borderStyle !== 'none')
      )
        issues.push({ kind: 'unstyled-button', text: clip(text(button), 24) });
    }
    if (!page) return;
    for (const element of body.querySelectorAll('h1, h2, h3, th')) {
      if (!visible(element)) continue;
      const style = globalThis.getComputedStyle(element);
      if (
        (style.textOverflow === 'ellipsis' || style.whiteSpace === 'nowrap') &&
        element.scrollWidth > element.clientWidth + 1
      )
        issues.push({
          kind: 'truncated-heading',
          tag: element.tagName.toLowerCase(),
          text: clip(text(element), 40),
        });
    }
    // 文字被裁掉且没有省略号提示。
    for (const element of body.querySelectorAll(
      'th, td, button, a, label, .console-label, .status-badge, .eyebrow',
    )) {
      if (!visible(element) || clippedSeen >= 6 || !directText(element)) continue;
      const style = globalThis.getComputedStyle(element);
      if (
        ['hidden', 'clip'].includes(style.overflowX) &&
        style.textOverflow !== 'ellipsis' &&
        element.scrollWidth > element.clientWidth + 4
      ) {
        clippedSeen += 1;
        issues.push({
          kind: 'clipped-text',
          tag: element.tagName.toLowerCase(),
          text: clip(text(element), 30),
        });
      }
    }
  });
  const badges = roots.flatMap((root) => [
    ...root.querySelectorAll('.status-badge[data-tone="danger"]'),
  ]);
  const visibleBadges = badges.filter(visible);
  const pageHScroll =
    globalThis.document.documentElement.scrollWidth - globalThis.window.innerWidth;
  if (pageHScroll > 2) issues.push({ kind: 'page-h-scroll', px: pageHScroll });
  return {
    roots: roots.length,
    issues,
    tables: tableCount,
    dangerBadgeBg: visibleBadges[0]
      ? globalThis.getComputedStyle(visibleBadges[0]).backgroundColor
      : null,
    dangerBadgeSample: visibleBadges[0] ? clip(text(visibleBadges[0]), 20) : null,
    pageHScroll,
  };
}

/** 记录可见入口的真实身份；重渲染后按 testid/行 ID 重取，不给一次性 DOM 打序号。 */
export function pickTriggers(route) {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const describe = (element) => {
    const testId = element.getAttribute('data-testid') ?? '';
    const label = (element.textContent ?? '').trim();
    return {
      key: testId || `text:${label}`,
      testId,
      label,
      tagName: element.tagName.toLowerCase(),
      rowId: element.closest('[data-row-id]')?.getAttribute('data-row-id') ?? null,
    };
  };
  const matches = [...globalThis.document.querySelectorAll(`[data-route-view~="${route}"]`)].filter(
    visible,
  );
  const roots = matches.filter(
    (element) => !matches.some((other) => other !== element && other.contains(element)),
  );
  const seen = new Set();
  const picked = [];
  for (const root of roots) {
    for (const element of root.querySelectorAll(
      '[data-testid*="-open"], [data-testid*="open-"], button, [role="button"], tbody a',
    )) {
      if (!visible(element)) continue;
      const trigger = describe(element);
      const looksOpener =
        /-open$/u.test(trigger.testId) ||
        /^open-/u.test(trigger.testId) ||
        /^(查看|详情|查看详情|查看版本|查看对比)$/u.test(trigger.label);
      if (!looksOpener || seen.has(trigger.key)) continue;
      seen.add(trigger.key);
      const statusFilter =
        /-filter-open$/u.test(trigger.testId) && element.hasAttribute('aria-pressed');
      const reset = statusFilter
        ? [...element.closest('.fin-filters').querySelectorAll('button')].find(
            (button) => (button.textContent ?? '').trim() === '全部',
          )
        : null;
      picked.push({
        ...trigger,
        kind: statusFilter ? 'status-filter' : 'drawer',
        ...(reset ? { reset: describe(reset) } : {}),
      });
    }
  }
  return picked;
}
