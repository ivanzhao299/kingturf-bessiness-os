import { signal } from '@preact/signals';
import {
  diffSnapshots,
  pairFromRow,
  snapshotOf,
  type DiffRow,
  type VersionPair,
  type VersionSpec,
} from './version-model';
import { textOf, type ConsolePorts, type ConsoleRow } from './ports';

// GOV-UX ④ 版本对比状态机（配置页通用）：选中行即解析 上一版本/当前版本 快照对；
// 需要异步读取上一版本（主数据）时先呈现当前快照 + 加载态，迟到/过期响应按行 key 丢弃。
export type CompareView = Readonly<{
  key: string;
  pair: VersionPair;
  rows: readonly DiffRow[];
  loading: boolean;
  error: string;
}>;

export type VersionCompareController = Readonly<{
  current: () => CompareView | null;
  open: (row: ConsoleRow) => void;
  clear: () => void;
}>;

const CURRENT_LABEL = '当前生效版本';

const settled = (key: string, pair: VersionPair, spec: VersionSpec): CompareView => ({
  key,
  pair,
  rows: diffSnapshots(pair.previous, pair.current, spec.fields),
  loading: false,
  error: '',
});

// 过期判定：已切到别的行、已关闭，或已不再处于加载态（含已呈现错误）。
const isStale = (view: CompareView | null, key: string): boolean =>
  view?.key !== key || !view.loading;

const FAILED = '上一版本读取失败';

export const createVersionCompare = (
  spec: VersionSpec | undefined,
  ports: ConsolePorts,
): VersionCompareController => {
  const view = signal<CompareView | null>(null);
  if (!spec) return { current: () => null, open: () => undefined, clear: () => undefined };
  const load = spec.loadPrevious;
  const open = (row: ConsoleRow): void => {
    const key = textOf(row.id, 'row');
    const pair = spec.fromRow
      ? { current: snapshotOf(CURRENT_LABEL, row, spec.fields), previous: null }
      : pairFromRow(row, spec.fields);
    if (pair === null) {
      view.value = null;
      return;
    }
    if (pair.previous !== null || load === undefined) {
      view.value = settled(key, pair, spec);
      return;
    }
    view.value = { ...settled(key, pair, spec), loading: true };
    void load(row, ports)
      .then((previous) => {
        if (isStale(view.value, key)) return;
        view.value = settled(key, { current: pair.current, previous }, spec);
      })
      .catch((error: unknown) => {
        if (isStale(view.value, key) || view.value === null) return;
        const reason = error instanceof Error ? error.message : '请稍后重试';
        view.value = { ...view.value, loading: false, error: `${FAILED}：${reason}` };
      });
  };
  return {
    current: () => view.value,
    open,
    clear: () => {
      view.value = null;
    },
  };
};
