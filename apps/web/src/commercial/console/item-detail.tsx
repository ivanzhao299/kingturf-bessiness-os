// U3-MFG-1（ADR-0014 分域重写）：物料详情抽屉——聚合物料根信息/规格参数/版本历史
// （含草稿行级发布）与关联 BOM、被引用位置、工艺路线、最近工单。关联聚合由服务端
// 按读权限门控（bom:read/routing:read/production:read），响应中不存在的聚合键不渲染
// ——不以「暂无」冒充「无权限」。详情读取失败时回退列表行数据。
import type { ComponentChild } from 'preact';
import { DetailDrawer, StatusBadge } from '@kingturf/ui';
import type { ItemRow } from './item-ports';
import {
  categoryLabel,
  specEntries,
  statusTone,
  STATUS_LABELS,
  type ItemViewState,
} from './item-state';

type DetailProps = Readonly<{ state: ItemViewState }>;

const recordOf = (value: unknown): ItemRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as ItemRow) : {};

const recordsOf = (value: unknown): readonly ItemRow[] =>
  Array.isArray(value) ? value.map(recordOf) : [];

const text = (
  state: ItemViewState,
  record: ItemRow,
  camel: string,
  snake: string,
  fallback = '',
): string => state.ports.recordText(record, camel, snake, fallback);

const statusLabel = (state: ItemViewState, status: unknown): string =>
  STATUS_LABELS[String(status)] ?? state.ports.businessStateLabel(status);

const versionText = (state: ItemViewState, row: ItemRow): string =>
  `${statusLabel(state, text(state, row, 'status', 'status'))} · 第 ${text(state, row, 'version', 'version', '1')} 版`;

const day = (value: string): string => (value === '' ? '—' : value.slice(0, 10));

export const SpecChips = ({
  specification,
  limit = 3,
}: Readonly<{ specification: unknown; limit?: number }>) => {
  const entries = specEntries(specification);
  if (entries.length === 0) return <span class="mfg-muted">未填写</span>;
  const shown = entries.slice(0, limit);
  const rest = entries.length - shown.length;
  return (
    <span class="console-chips mfg-spec-chips">
      {shown.map(([key, value], index) => (
        <span key={`${key}-${String(index)}`} class="console-chip">
          {`${key} ${value}`}
        </span>
      ))}
      {rest > 0 ? <span class="console-chip mfg-muted">{`+${String(rest)}`}</span> : null}
    </span>
  );
};

const VersionChips = ({ state, versions }: DetailProps & Readonly<{ versions: unknown }>) => (
  <span class="console-chips">
    {recordsOf(versions).map((version, index) => (
      <span key={text(state, version, 'id', 'id', String(index))} class="console-chip">
        {`v${text(state, version, 'version', 'version', '?')} ${statusLabel(state, version.status)}`}
      </span>
    ))}
  </span>
);

const VersionHistory = ({ state }: DetailProps) => {
  const selected = state.selected;
  if (!selected) return null;
  const source = state.detail?.versions;
  const versions = Array.isArray(source) && source.length > 0 ? recordsOf(source) : [selected];
  return (
    <section data-testid="kt-item-versions">
      <p class="console-label">版本历史</p>
      <ul class="console-summary">
        {versions.map((version, index) => {
          const status = text(state, version, 'status', 'status');
          return (
            <li key={text(state, version, 'id', 'id', String(index))} data-testid="kt-item-version">
              <StatusBadge tone={statusTone(status)}>{versionText(state, version)}</StatusBadge>
              {` 生效 ${day(text(state, version, 'effectiveAt', 'effective_at', ''))} · 发布 ${day(text(state, version, 'publishedAt', 'published_at', ''))}`}
              {state.mayManage && status === 'DRAFT' ? (
                <button
                  type="button"
                  class="secondary compact"
                  data-testid="kt-item-publish-version"
                  disabled={state.loading}
                  onClick={() => {
                    void state.runPublish(version);
                  }}
                >
                  发布版本
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

type RelatedProps = DetailProps &
  Readonly<{
    field: string;
    testId: string;
    title: string;
    line: (row: ItemRow) => ComponentChild;
  }>;

const Related = ({ state, field, testId, title, line }: RelatedProps) => {
  const detail = state.detail;
  // 聚合键缺失 = 调用方无对应读权限（服务端未查询），不渲染。
  if (!detail || !Object.hasOwn(detail, field)) return null;
  const rows = recordsOf(detail[field]);
  return (
    <section data-testid={testId}>
      <p class="console-label">{title}</p>
      {rows.length === 0 ? (
        <p class="mfg-muted" data-testid={`${testId}-empty`}>
          暂无记录
        </p>
      ) : (
        <ul class="console-summary">
          {rows.map((row, index) => (
            <li key={text(state, row, 'id', 'id', text(state, row, 'code', 'code', String(index)))}>
              {line(row)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const UsedInLine = ({ state, row }: DetailProps & Readonly<{ row: ItemRow }>) => {
  const role = text(state, row, 'role', 'role');
  const quantity = text(state, row, 'quantity', 'quantity');
  return (
    <span>
      {`${text(state, row, 'code', 'code', '—')} · v${text(state, row, 'version', 'version', '?')} · ${role === 'SUBSTITUTE' ? '替代料' : '主料'} · 第 ${text(state, row, 'lineNumber', 'lineNumber', '—')} 行`}
      {quantity !== '' && role !== 'SUBSTITUTE' ? ` · 用量 ${quantity}` : ''}
    </span>
  );
};

const OrderLine = ({ state, row }: DetailProps & Readonly<{ row: ItemRow }>) => (
  <span>
    {`${text(state, row, 'orderNumber', 'orderNumber', '—')} · ${state.ports.businessStateLabel(row.state)} · 计划 ${text(state, row, 'plannedQuantity', 'plannedQuantity', '—')} · 交期 ${text(state, row, 'plannedDueAt', 'plannedDueAt', '—')}`}
  </span>
);

export const ItemDetailDrawer = ({ state }: DetailProps) => {
  const row = state.selected;
  if (!row) return null;
  const sku = text(state, row, 'sku', 'sku');
  const root = state.detail ?? row;
  const current = recordsOf(state.detail?.versions).find(
    (version) => text(state, version, 'id', 'id') === text(state, row, 'id', 'id'),
  );
  return (
    <DetailDrawer
      title={`物料详情 · ${sku}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-item-detail-summary">
        <p>
          <span class="console-label">物料编码</span>
          {sku}
          <span class="console-label">名称</span>
          {text(state, root, 'name', 'name', '—')}
        </p>
        <p>
          <span class="console-label">类别</span>
          {categoryLabel(text(state, root, 'itemType', 'itemType'))}
          <span class="console-label">基本单位</span>
          {text(state, root, 'baseUnitCode', 'baseUnitCode', '—')}
          <span class="console-label">创建时间</span>
          {day(text(state, root, 'createdAt', 'created_at', ''))}
        </p>
      </div>
      {state.detailLoading ? (
        <p class="console-label" data-testid="kt-item-detail-loading">
          详情加载中…
        </p>
      ) : null}
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-item-submit-error">
          {state.submitError}
        </p>
      ) : null}
      <p class="console-label">规格参数（第 {text(state, row, 'version', 'version', '1')} 版）</p>
      <div data-testid="kt-item-detail-spec">
        <SpecChips specification={(current ?? row).specification} limit={12} />
      </div>
      <VersionHistory state={state} />
      <Related
        state={state}
        field="boms"
        testId="kt-item-boms"
        title="关联 BOM（作为产品）"
        line={(bom) => (
          <span>
            {`${text(state, bom, 'code', 'code', '—')} · ${text(state, bom, 'name', 'name', '')} `}
            <VersionChips state={state} versions={bom.versions} />
          </span>
        )}
      />
      <Related
        state={state}
        field="usedIn"
        testId="kt-item-used-in"
        title="被引用位置（作为组件或替代料）"
        line={(reference) => <UsedInLine state={state} row={reference} />}
      />
      <Related
        state={state}
        field="routings"
        testId="kt-item-routings"
        title="工艺路线（作为产品）"
        line={(routing) => (
          <span>
            {`${text(state, routing, 'code', 'code', '—')} · ${text(state, routing, 'name', 'name', '')} `}
            <VersionChips state={state} versions={routing.versions} />
          </span>
        )}
      />
      <Related
        state={state}
        field="productionOrders"
        testId="kt-item-orders"
        title="最近工单"
        line={(order) => <OrderLine state={state} row={order} />}
      />
    </DetailDrawer>
  );
};
