// PROC-2（TD-PROC-008）：详情抽屉内对比表的「矩阵 / 堆叠卡片」切换。
// 手机视口下抽屉体内容宽不足 420px，行项×供应商的矩阵读不了；
// 容器实测宽度不超过阈值时改按供应商堆叠的卡片，其余情况保持矩阵（可横向滚动）。
// PROC-3：另提供对比表里「日期 / 编码 / 金额」短 token 的切分（不折行的最小语义单元）。
import type { ComponentChildren } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';
import { h } from 'preact';

/** 对比表改堆叠卡片的容器宽度阈值（px，含）。 */
export const STACKED_COMPARE_WIDTH = 420;

/** 整段不折行的编码长度上限（字符）。与 DataTable 对字符串单元格的 NOWRAP_MAX_LENGTH 同值：
 *  更长的编码不包 token、照常可折——否则一个 40 字符的报价单号在手机上比卡片还宽，
 *  nowrap 会压过卡片原有的 overflow-wrap，反而溢出。 */
export const COMPARE_TOKEN_MAX_CODE_LENGTH = 20;

/** 不折行的最小语义单元：日期、编码、金额 / 数量，以及紧贴其前的单词标签（MOQ 1000、
 *  单价 12.5、交期 2026-12-10、行 1）。断在它们内部会读错（2026-12- / 10），把标签与值拆到
 *  两行同样读错（行尾一个孤零零的「MOQ」）。标签后的空格不再是换行点；单元之间在「 · 」处折行。
 *  单元不得紧贴字母、数字或连字符（左边界）：长编码内部不会被截出一段后缀当成 token，
 *  形如日期的片段（SQ-KT-2026-11-25-001 里的 2026-11-25）也不会被单独切出来。 */
const TOKEN_PATTERN = new RegExp(
  `(?<![\\w-])(?:[\\u4e00-\\u9fffA-Z]{1,4} )?(?:` +
    `\\d{4}-\\d{2}-\\d{2}` +
    `|(?=[A-Z][A-Z0-9-]{0,${String(COMPARE_TOKEN_MAX_CODE_LENGTH - 1)}}(?![A-Z0-9-]))[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+` +
    `|\\d+(?:\\.\\d+)?(?![\\w-])` +
    `)`,
  'gu',
);

export type CompareTextPart = Readonly<{ text: string; token: boolean }>;

// 把一段文字切成「token / 其余」交替的片段；拼接回来与原文逐字相同。其余片段（分隔符、
// 空白、名称、超长编码）保留原有的换行点。
export const splitCompareTokens = (text: string): readonly CompareTextPart[] => {
  const parts: CompareTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const at = match.index;
    if (at > cursor) parts.push({ text: text.slice(cursor, at), token: false });
    parts.push({ text: match[0], token: true });
    cursor = at + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), token: false });
  return parts;
};

// 渲染一段带 token 的文字：token 落成 <span class="proc-token">（样式表里不折行），其余为裸
// 文本节点，token 之间在分隔符的空格处照常折行。textContent 与入参逐字相同。
// 注意：返回的是片段序列，调用方若把它放进 flex 容器，需自己再包一层行内容器——否则相邻
// 文本会被并成一个匿名 flex 子项，与 token 之间失去换行点。
export const TokenText = ({ text }: Readonly<{ text: string }>): ComponentChildren =>
  splitCompareTokens(text).map((part, index) =>
    part.token ? h('span', { key: String(index), class: 'proc-token' }, part.text) : part.text,
  );

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
