// PROC-2（TD-PROC-008）：详情抽屉内对比表的「矩阵 / 堆叠卡片」切换。
// 抽屉宽 min(480px, 90vw)，手机视口下抽屉体内容宽不足 420px，行项×供应商的矩阵读不了；
// 容器实测宽度不超过阈值时改按供应商堆叠的卡片，其余情况保持矩阵（可横向滚动）。
import { useCallback, useRef, useState } from 'preact/hooks';

/** 对比表改堆叠卡片的容器宽度阈值（px，含）。 */
export const STACKED_COMPARE_WIDTH = 420;

type ObservedSize = Readonly<{ contentRect: Readonly<{ width: number }> }>;
type ResizeObserverLike = new (callback: (entries: readonly ObservedSize[]) => void) => {
  observe: (target: unknown) => void;
  disconnect: () => void;
};

const resizeObserverOf = (): ResizeObserverLike | undefined => {
  const candidate = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  return typeof candidate === 'function' ? (candidate as ResizeObserverLike) : undefined;
};

// 返回 [ref, stacked]：ref 挂在对比区根节点上，stacked 表示该节点内容宽是否不超过阈值。
// 宽度经 ResizeObserver 实测（observe 后即有首次通知，随容器/视口变化更新）；不可测时
// （单测 mini-DOM、不支持 ResizeObserver 的浏览器）恒为 false——矩阵呈现与此前逐字节一致。
export const useStackedCompare = (): readonly [(node: unknown) => void, boolean] => {
  const [stacked, setStacked] = useState(false);
  const observer = useRef<{ disconnect: () => void } | null>(null);
  const measure = useCallback((node: unknown): void => {
    observer.current?.disconnect();
    observer.current = null;
    const ResizeObserver = resizeObserverOf();
    if (node === null || ResizeObserver === undefined) return;
    const created = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setStacked(width <= STACKED_COMPARE_WIDTH);
    });
    created.observe(node);
    observer.current = created;
  }, []);
  return [measure, stacked];
};
