import { el } from '../dom';

// ADR-0014/U1（UI-CP1 视觉验收载体）：#/ui-kit 演示页骨架。渲染体经动态 import 拆独立
// chunk（不进登录入口、不并入 workspace 主块——启动预算守恒），首访即装载。
export const createUiKitSection = (): HTMLElement => {
  const section = el('section', 'ui-kit-view workspace-panel');
  section.setAttribute('data-route-view', 'ui-kit');
  section.setAttribute('aria-label', 'UI 组件基座演示');
  section.hidden = true;
  void import('./render').then(({ mountUiKitDemo }) => {
    // 渲染需要浏览器 DOM；web 的 node 测试环境跳过挂载，原语渲染行为由 @kingturf/ui 行为测试覆盖。
    if (section.isConnected && typeof globalThis.document === 'object') mountUiKitDemo(section);
  });
  return section;
};
