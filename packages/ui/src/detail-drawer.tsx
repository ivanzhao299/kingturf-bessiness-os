import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChild } from 'preact';

export type DetailDrawerProps = Readonly<{
  title: string;
  onClose: () => void;
  footer?: ComponentChild;
  children?: ComponentChild;
}>;

const FOCUSABLE_SELECTOR = 'button, input, select, textarea, a, [tabindex]';

let drawerTitleSeq = 0;

// 结构化可聚焦判定（浏览器 HTMLElement 与测试 DOM double 通用，不用 instanceof）。
type Focusable = Readonly<{ focus: () => void; disabled?: boolean; tabIndex?: number }>;

// 结构化宿主接口：浏览器 HTMLElement 与测试 DOM double 通用，并避开 lib.dom 弃用重载。
type QueryHost = Readonly<{ querySelectorAll: (selector: string) => readonly unknown[] }>;

const focusableIn = (root: HTMLElement | null): readonly Focusable[] => {
  if (!root) return [];
  const finder = root as unknown as QueryHost;
  if (typeof finder.querySelectorAll !== 'function') return [];
  const nodes = finder.querySelectorAll(FOCUSABLE_SELECTOR) as readonly Focusable[];
  return nodes.filter(
    (node) => typeof node.focus === 'function' && node.disabled !== true && node.tabIndex !== -1,
  );
};

// 详情抽屉（主从/抽屉解剖模板）：aria 模态对话、初焦进入、Esc 关闭、Tab 焦点环绕、关闭还焦。
export const DetailDrawer = (props: DetailDrawerProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [titleId] = useState(() => `drawer-title-${String(++drawerTitleSeq)}`);

  useEffect(() => {
    const doc = globalThis.document;
    const previous = doc.activeElement as unknown as Focusable | null;
    const focusables = focusableIn(dialogRef.current);
    const first = focusables[0];
    if (first !== undefined) first.focus();
    else dialogRef.current?.focus();
    return () => {
      if (previous !== null && typeof previous.focus === 'function') previous.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = focusableIn(dialogRef.current);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) return;
    const doc = globalThis.document;
    const active = doc.activeElement as unknown as Focusable | null;
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  };

  return (
    <div class="drawer-root">
      <div class="drawer-overlay" data-drawer-overlay="true" />
      <div
        ref={(node) => {
          dialogRef.current = node;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        class="detail-drawer"
        onKeyDown={onKeyDown}
      >
        <header class="drawer-header">
          <h2 id={titleId}>{props.title}</h2>
          <button type="button" class="drawer-close" aria-label="关闭详情" onClick={props.onClose}>
            ×
          </button>
        </header>
        <div class="drawer-body">{props.children}</div>
        {props.footer !== undefined && props.footer !== null ? (
          <footer class="drawer-footer">{props.footer}</footer>
        ) : null}
      </div>
    </div>
  );
};
