import { signal, type Signal } from '@preact/signals';
import { failureMessage } from '../../shared/api-error-message';
import { syncSelected } from './selected-sync';

type Row = Readonly<Record<string, unknown>>;
export const versionRecords = (value: unknown): readonly Row[] =>
  Array.isArray(value)
    ? (value.filter((row) => row !== null && typeof row === 'object') as Row[])
    : [];
export const versionText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
export const publishedVersionId = (versions: readonly Row[]): string => {
  const published = versions.filter((row) => row.status === 'PUBLISHED');
  const highest = published.reduce<Row | undefined>(
    (current, next) =>
      current && Number(versionText(current.version)) >= Number(versionText(next.version))
        ? current
        : next,
    undefined,
  );
  return versionText(highest?.id);
};
export const versionDay = (source: Row | null): string =>
  versionText(source?.effective_at ?? source?.effectiveAt).slice(0, 10);
export const effectiveDatePatch = (source: Row, date: string): Row =>
  date === versionDay(source) ? {} : { effectiveAt: `${date}T00:00:00.000Z` };

export const VersionSourceHint = ({ source }: Readonly<{ source: Row }>) => (
  <p class="console-hint">{`以第 ${versionText(source.version, '—')} 版为底稿。可先编辑再保存，保存后的草稿如需修改，可从该草稿再起一版。`}</p>
);

export const VersionHistoryAction = ({
  testId,
  row,
  currentId,
  start,
  enabled,
}: Readonly<{
  testId: string;
  row: Row;
  currentId: string;
  start: (row: Row) => void;
  enabled: boolean;
}>) => (
  <>
    {currentId !== '' && row.id === currentId ? (
      <span class="console-chip" data-testid={`${testId}-current-published`}>
        当前已发布（本页）
      </span>
    ) : null}
    {enabled && versionText(row.id) !== '' ? (
      <button
        type="button"
        class="secondary compact"
        data-testid={`${testId}-new-version`}
        aria-label={`从第 ${versionText(row.version, '—')} 版新建版本`}
        onClick={() => {
          start(row);
        }}
      >
        新建版本
      </button>
    ) : null}
  </>
);

export const newVersionSource = () => signal<Row | null>(null);

export const sameVersionContent = (first: unknown, second: unknown): boolean =>
  JSON.stringify(first) === JSON.stringify(second);

export const versionOptions = (
  choices: readonly Readonly<{ value: string; label: string }>[],
  sourceId: string,
  sourceLabel = '来源版本',
) =>
  sourceId === '' || choices.some((choice) => choice.value === sourceId)
    ? choices
    : [{ value: sourceId, label: sourceLabel }, ...choices];

export const productVersionOptions = (
  choices: readonly Readonly<{ value: string; label: string; itemId: string }>[],
  source: Row | null,
  productId: unknown,
) =>
  source
    ? versionOptions(
        choices.filter((choice) => choice.itemId === productId),
        versionText(source.product_item_version_id ?? source.productItemVersionId),
      )
    : choices;

type DraftFlow = Readonly<{
  path: string;
  rootKey: string;
  label: string;
  selected: Signal<Row | null>;
  snapshot: Signal<readonly Row[]>;
  detail: Signal<Row | null>;
  notice: Signal<string>;
  error: Signal<string>;
  submit: (path: string, body: Record<string, unknown>) => Promise<Row | null>;
  closeForm: () => void;
  versionSource: Signal<Row | null>;
  sync: () => Promise<void>;
  reloadDetail: () => Promise<void>;
}>;

export async function saveManufacturingVersion(
  flow: DraftFlow,
  source: Row,
  payload: Row,
): Promise<void> {
  const original = flow.selected.value;
  if (!original) return;
  const rootId = versionText(original[flow.rootKey]);
  if (!rootId) return;
  let created: Row | null;
  try {
    created = await flow.submit(`${flow.path}/${encodeURIComponent(rootId)}/versions`, {
      copyFromVersionId: source.id,
      ...payload,
    });
  } catch (error: unknown) {
    if (flow.versionSource.value === source)
      flow.error.value = failureMessage(error, '新建版本失败');
    return;
  }
  if (flow.selected.value !== original || flow.versionSource.value !== source) {
    await flow.sync();
    return;
  }
  const picked = created ? { ...original, ...created } : original;
  flow.closeForm();
  flow.notice.value = `已保存${flow.label}第 ${versionText(created?.version, '—')} 版草稿`;
  flow.selected.value = picked;
  flow.detail.value = null;
  await flow.sync();
  if (flow.selected.value !== picked) return;
  syncSelected({
    selected: flow.selected,
    rows: [...flow.snapshot.value, picked],
    idOf: (row) => versionText(row.id),
  });
  await flow.reloadDetail();
}
