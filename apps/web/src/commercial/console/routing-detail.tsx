// U3-MFG-3（ADR-0014 分域重写）：工艺路线详情抽屉——顺序步骤视图（竖向步进条：
// 工序号 → 工序名称/编码 → 工作中心 → 准备工时/单件工时 → 说明）、版本历史 chips
//（草稿行内发布）。详情数据来自 additive findRouting（versions 工序 sequence 升序）。
import { DetailDrawer, StatusBadge } from '@kingturf/ui';
import type { RoutingRow } from './routing-ports';
import {
  routingOperations,
  routingRecords,
  statusTone,
  STATUS_LABELS,
  type RoutingViewState,
} from './routing-state';

type DetailProps = Readonly<{ state: RoutingViewState }>;

const recordOf = (value: unknown): RoutingRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RoutingRow) : {};

export const versionLabel = (state: RoutingViewState, status: unknown): string =>
  STATUS_LABELS[String(status)] ?? state.ports.businessStateLabel(status);

// 顺序步骤视图：单版本工序竖排（步骤号 = 行序；工序号为业务 sequence）。
export const StepList = ({
  state,
  operations,
}: DetailProps & Readonly<{ operations: readonly RoutingRow[] }>) => (
  <ol class="routing-steps" data-testid="kt-routing-steps">
    {operations.map((operation, index) => (
      <li
        key={state.ports.textValue(operation.id ?? operation.sequence, String(index))}
        class="routing-step"
      >
        <span class="routing-step-no" data-testid="kt-routing-step-no">
          {String(index + 1)}
        </span>
        <div class="routing-step-body">
          <p class="routing-step-head">
            <strong>{state.ports.textValue(operation.name, '—')}</strong>
            <span class="routing-muted">
              {state.ports.textValue(operation.operation_code, '—')}
            </span>
          </p>
          <p class="routing-step-meta">
            <span>{`工作中心 ${state.ports.textValue(operation.work_center_code, '—')}`}</span>
            <span>{`准备 ${state.ports.textValue(operation.setup_minutes, '—')} 分钟`}</span>
            <span>{`单件 ${state.ports.textValue(operation.run_minutes_per_unit, '—')} 分钟`}</span>
          </p>
        </div>
      </li>
    ))}
  </ol>
);

export const RoutingDetailDrawer = ({ state }: DetailProps) => {
  const row = state.selected;
  if (!row) return null;
  const detail = state.detail ?? row;
  const versions = routingRecords(detail.versions);
  const latest = versions[0];
  const operations = latest ? routingOperations(latest) : routingOperations(row);
  return (
    <DetailDrawer
      title={`工艺路线详情 · ${state.ports.recordText(row, 'code', 'code')}`}
      onClose={() => {
        state.open(null);
      }}
    >
      <div class="console-summary" data-testid="kt-routing-detail-summary">
        <p>
          <span class="console-label">路线编码</span>
          {state.ports.recordText(row, 'code', 'code')}
          <span class="console-label">名称</span>
          {state.ports.recordText(detail, 'name', 'name', '—')}
        </p>
        <p>
          <span class="console-label">产品</span>
          {`${state.ports.textValue(recordOf(detail.product).sku, '—')} · ${state.ports.textValue(recordOf(detail.product).name, '')}`}
          <span class="console-label">版本数</span>
          {String(versions.length)}
        </p>
      </div>
      {state.detailLoading ? (
        <p class="console-label" data-testid="kt-routing-detail-loading">
          详情加载中…
        </p>
      ) : null}
      {state.submitError !== '' ? (
        <p class="console-error" role="alert" data-testid="kt-routing-submit-error">
          {state.submitError}
        </p>
      ) : null}
      <p class="console-label">版本历史</p>
      <div class="console-chips" data-testid="kt-routing-versions">
        {(versions.length > 0 ? versions : [row]).map((version, index) => {
          const status = state.ports.textValue(version.status, '');
          return (
            <span
              key={state.ports.textValue(version.id, String(index))}
              class="console-chip"
              data-testid="kt-routing-version"
            >
              <StatusBadge tone={statusTone(status)}>
                {`${versionLabel(state, status)} · 第 ${state.ports.textValue(version.version, '?')} 版`}
              </StatusBadge>
              {state.mayManage && status === 'DRAFT' ? (
                <button
                  type="button"
                  class="mfg-chip-remove"
                  data-testid="kt-routing-publish-version"
                  onClick={() => {
                    void state.runPublish(version);
                  }}
                >
                  发布
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
      <p class="console-label">
        {`顺序步骤（${latest ? versionLabel(state, latest.status) + ' · 第 ' + state.ports.textValue(latest.version, '?') + ' 版' : '当前行'}）`}
      </p>
      <div data-testid="kt-routing-steps-wrap">
        {operations.length > 0 ? (
          <StepList state={state} operations={operations} />
        ) : (
          <p class="routing-muted">该版本暂无工序</p>
        )}
      </div>
    </DetailDrawer>
  );
};
