import { options } from 'preact';
import { installGlobalTestDom } from './dom';

// 每份测试文件安装一次零依赖测试 DOM（ADR-0014/U1）。
installGlobalTestDom();

// preact/hooks 的被动 effect 默认经 requestAnimationFrame/35ms 延迟调度（Node 无 rAF）；
// 测试以微任务接管（与 jsdom 生态同法），使 flush() 一个宏任务即可覆盖 effect 提交。
options.requestAnimationFrame = (callback: () => void): number => {
  queueMicrotask(callback);
  return 0;
};
