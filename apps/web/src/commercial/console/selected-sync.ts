import type { Signal } from '@preact/signals';

// TD-WF-008（写流程冒烟 WS-P2-05）：详情抽屉在写操作后不刷新。各控制台写完都重新读取了列表，却没有人
// 用刷新后的行替换抽屉里选中的那一行：准入审核后抽屉仍写「尚无物料准入记录」，取消订单后仍显示「已签发」
// 且「取消订单」按钮还在——再点一次就是 404。
//
// 做法：写操作与刷新之后调用 syncSelected，把抽屉里的记录换成列表里的最新行；记录已不在列表里则关闭
// 抽屉（同线索控制台的做法，避免停在过期对象上继续操作）。抽屉内容取自详情接口的控制台再传 loadDetail，
// 刷新后重读一次详情——行项收货状态、收货记录这些只有详情才有。
type Row = Readonly<Record<string, unknown>>;

export type SelectedSync<T extends Row> = Readonly<{
  // 抽屉里选中的记录；null 表示抽屉关着。
  selected: Signal<T | null>;
  // 刷新后的权威列表（客户端筛选之前的全量）。
  rows: readonly T[];
  idOf: (row: T) => string;
  // 详情读取（可选）。读到就用详情替换抽屉里的记录；读不到或失败则保持列表行。
  loadDetail?: (id: string) => Promise<T | null>;
}>;

// 只有「抽屉仍开着、且还是这一条」时才改写选中记录：期间用户可能已经关掉抽屉或点开了另一条，
// 迟到的详情响应不能把抽屉换成别的记录，也不能把关掉的抽屉重新打开。
const replaceIfCurrent = <T extends Row>(input: SelectedSync<T>, id: string, row: T): boolean => {
  const opened = input.selected.value;
  if (opened === null || input.idOf(opened) !== id) return false;
  input.selected.value = row;
  return true;
};

/** 写操作或刷新之后，让开着的抽屉跟上最新数据。返回抽屉是否仍开着。 */
export function syncSelected<T extends Row>(input: SelectedSync<T>): boolean {
  const current = input.selected.value;
  if (current === null) return false;
  const id = input.idOf(current);
  const fresh = id === '' ? undefined : input.rows.find((row) => input.idOf(row) === id);
  // 记录已不在列表里：关闭抽屉。
  if (fresh === undefined) {
    input.selected.value = null;
    return false;
  }
  // 抽屉里的记录来自详情接口时（键比列表行多），先用最新行盖住同名键——状态、按钮立刻是对的——
  // 只有详情才有的那些键暂留旧值，等 reloadSelectedDetail 的详情到了整条替换；不然这些区块会先消失再出现。
  input.selected.value = input.loadDetail === undefined ? fresh : { ...current, ...fresh };
  return true;
}

/** 重读打开着的这条记录的详情（刷新之后调用；详情读取失败静默保持列表行）。 */
export function reloadSelectedDetail<T extends Row>(input: SelectedSync<T>): Promise<void> {
  const opened = input.selected.value;
  if (opened === null || input.loadDetail === undefined) return Promise.resolve();
  const id = input.idOf(opened);
  return input
    .loadDetail(id)
    .then((detail) => {
      if (detail) replaceIfCurrent(input, id, detail);
    })
    .catch(() => undefined);
}
