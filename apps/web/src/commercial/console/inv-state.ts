import { signal, type Signal } from '@preact/signals';
import { failureMessage } from '../../shared/api-error-message';
import { confirmFormWrite, createConfirm } from './console-confirm';
import type { Choice } from './console-choices';
import { createFinList, type FinPage, type FinQuery, type FinRow } from './fin-kit';
import {
  balanceId,
  LOCATIONS,
  locationPayload,
  MOVEMENTS,
  movementOptions,
  movementPayload,
  optionLabel,
} from './inv-data';
import { reloadSelectedDetail, syncSelected } from './selected-sync';

const PAGE_SIZE = 20;
export type InventoryPorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialBalances: readonly FinRow[];
  initialLocations: readonly FinRow[];
  initialStatus: string;
  orders: () => readonly Choice[];
  actors: ReadonlyMap<string, string>;
  fetchPage: (query: FinQuery) => Promise<FinPage>;
  loadDetail: (key: string) => Promise<FinRow | null>;
  refresh: () => Promise<Readonly<{ balances: readonly FinRow[]; locations: readonly FinRow[] }>>;
  submit: (path: string, payload: Record<string, unknown>) => Promise<unknown>;
  attached?: () => boolean;
  now?: () => Date;
}>;

export function createInventoryState(ports: InventoryPorts) {
  const all = signal(ports.initialBalances);
  const locations = signal(ports.initialLocations);
  const initial =
    ports.initialStatus === ''
      ? all.value
      : all.value.filter((row) => row.qualityStatus === ports.initialStatus);
  const rows = signal<readonly FinRow[]>(initial.slice(0, PAGE_SIZE));
  const last = rows.value.at(-1);
  const nextCursor = signal(last && initial.length > PAGE_SIZE ? balanceId(last) : null);
  const loading = signal(false);
  const loadingMore = signal(false);
  const loadError = signal('');
  const selected: Signal<FinRow | null> = signal(null);
  const moving = signal(false);
  const locationForm = signal(false);
  const error = signal('');
  const notice = signal('');
  const pending = createConfirm();
  const status = signal(ports.initialStatus);
  const location = signal('');
  const search = signal('');
  const appliedSearch = signal('');
  const sort = signal('sku');
  const direction = signal('asc');
  const query = () => ({
    limit: PAGE_SIZE,
    status: status.value,
    location: location.value,
    query: appliedSearch.value,
    sort: sort.value,
    direction: direction.value,
  });
  const { reload, loadMore } = createFinList(ports.fetchPage, {
    rows,
    nextCursor,
    loading,
    loadingMore,
    loadError,
  });
  const selection = () => ({
    selected,
    rows: all.value,
    idOf: balanceId,
    loadDetail: ports.loadDetail,
  });
  const select = (row: FinRow | null) => {
    selected.value = row;
    moving.value = false;
    error.value = '';
    notice.value = '';
    if (row) void reloadSelectedDetail(selection());
  };
  const refresh = async (saved = false) => {
    try {
      const snapshot = await ports.refresh();
      all.value = snapshot.balances;
      locations.value = snapshot.locations;
      if (syncSelected(selection())) await reloadSelectedDetail(selection());
      await reload(query());
    } catch (failure: unknown) {
      loadError.value = failureMessage(failure, saved ? '已保存，库存刷新失败' : '库存刷新失败');
    }
  };
  const move = async (
    values: Readonly<Record<string, string>>,
    sourceType: string,
    sourceId: string,
  ) => {
    const balance = selected.peek();
    if (!balance) return;
    error.value = '';
    if (sourceId === '') {
      error.value = '请选择业务来源';
      return;
    }
    const label = optionLabel(movementOptions, values.movementType ?? '');
    const confirmed = await confirmFormWrite(pending, {
      title: '确认库存移动',
      confirmLabel: '确认登记',
      destructive: true,
      message: `${label} ${values.quantity ?? ''}，记录入账后不可修改。`,
    });
    if (!confirmed) return;
    try {
      await ports.submit(
        MOVEMENTS,
        movementPayload(balance, values, sourceType, sourceId, ports.now?.() ?? new Date()),
      );
    } catch (failure: unknown) {
      error.value = failureMessage(failure, '登记库存移动失败');
      return;
    }
    moving.value = false;
    notice.value = `已登记${label}`;
    await refresh(true);
  };
  const createLocation = async (values: Readonly<Record<string, string>>) => {
    error.value = '';
    try {
      await ports.submit(LOCATIONS, locationPayload(values));
    } catch (failure: unknown) {
      error.value = failureMessage(failure, '新建库位失败');
      return;
    }
    locationForm.value = false;
    notice.value = `已建立库位 ${values.code?.trim() ?? ''}`;
    await refresh(true);
  };
  const selectStatus = (value: string) => {
    status.value = value;
    void reload(query());
  };
  return {
    ports,
    all,
    locations,
    rows,
    nextCursor,
    loading,
    loadingMore,
    loadError,
    selected,
    moving,
    locationForm,
    error,
    notice,
    pending,
    status,
    location,
    search,
    appliedSearch,
    sort,
    direction,
    query,
    reload,
    loadMore,
    select,
    refresh,
    move,
    createLocation,
    selectStatus,
  };
}
