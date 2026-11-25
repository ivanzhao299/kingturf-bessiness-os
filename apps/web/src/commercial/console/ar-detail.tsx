// FIN-1：应收详情抽屉——单据信息 + 关联销售订单摘要 + 核销分配记录；可跳到关联的销售订单与
// 客户（hash 链接，与制造概览卡同一机制；目标路由对当前账号可见时才渲染链接）。
// 详情来自 additive GET /api/v1/ar-open-items/:id：订单摘要按 sales-order:read、分配记录里的
// 收款侧字段按 bank-payment:read 门控——相应键不在响应里时如实说明，不以「暂无」冒充「无权限」。
import type { ComponentChild } from 'preact';
import { DetailDrawer, StatusBadge } from '@kingturf/ui';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';
import {
  FinAmount,
  FinFacts,
  FinLink,
  FinSection,
  FinTable,
  finDay,
  finLink,
  finRecord,
  finRows,
  finText,
  finWhen,
} from './fin-kit';
import {
  AR_STATES,
  ORDER_STATES,
  arAgingText,
  arDocumentType,
  arState,
  arStateTone,
  type ArViewState,
} from './ar-state';
import type { ArRow } from './ar-ports';

const OrderSection = ({ state, row }: Readonly<{ state: ArViewState; row: ArRow }>) => {
  const { ports } = state;
  const salesOrderId = finText(row, 'salesOrderId');
  if (state.detailLoading) {
    return <FinSection title="关联销售订单" testId="kt-ar-order" note="正在读取详情…" />;
  }
  if (!Object.hasOwn(row, 'order')) {
    return (
      <FinSection
        title="关联销售订单"
        testId="kt-ar-order"
        note={salesOrderId === '' ? '这张单据没有关联销售订单。' : '关联销售订单摘要暂不可用。'}
      />
    );
  }
  const order = finRecord(row.order);
  const orderNumber = finText(order, 'orderNumber') || '—';
  const status = finText(order, 'status');
  return (
    <FinSection title="关联销售订单" testId="kt-ar-order">
      <FinFacts
        items={[
          [
            '订单号',
            orderNumber !== '—' && ports.routeVisible('sales-orders') ? (
              <FinLink
                href={finLink('sales-orders')}
                testId="kt-ar-link-order"
                onNavigate={() => {
                  state.open(null);
                }}
              >
                {orderNumber}
              </FinLink>
            ) : (
              orderNumber
            ),
          ],
          ['状态', ORDER_STATES[status] ?? (status === '' ? '—' : status)],
          ['币种', finText(order, 'currency') || '—'],
          [
            '订单总额',
            <FinAmount currency={order.currency} amount={order.total} testId="kt-ar-order-total" />,
          ],
          ['下单时间', finWhen(order, 'createdAt')],
        ]}
      />
    </FinSection>
  );
};

const AllocationSection = ({ state, row }: Readonly<{ state: ArViewState; row: ArRow }>) => {
  if (!Object.hasOwn(row, 'allocations')) {
    return (
      <FinSection
        title="核销分配记录"
        testId="kt-ar-allocations"
        note={state.detailLoading ? '正在读取详情…' : '核销分配详情暂不可用。'}
      />
    );
  }
  const allocations = finRows(row.allocations);
  // 收款侧字段（银行流水号 / 到账时间）只在 bank-payment:read 授权时由服务端给出。
  const hasReference = allocations.some((item) => Object.hasOwn(item, 'bankReference'));
  const hasReceivedAt = allocations.some((item) => Object.hasOwn(item, 'paymentReceivedAt'));
  const head = [
    '次序',
    '金额',
    '币种',
    ...(hasReference ? ['银行流水号'] : []),
    ...(hasReceivedAt ? ['到账时间'] : []),
    '分配时间',
  ];
  return (
    <FinSection title="核销分配记录" testId="kt-ar-allocations">
      <FinTable
        testId="kt-ar-allocation-table"
        head={head}
        empty="暂无核销分配记录"
        rowTestId={(index) => `kt-ar-allocation-${String(index + 1)}`}
        rows={allocations.map((item): readonly ComponentChild[] => [
          <span data-testid="kt-ar-allocation-order">
            {finText(item, 'allocationOrder') || '—'}
          </span>,
          <FinAmount
            currency={item.currency}
            amount={item.amount}
            testId="kt-ar-allocation-amount"
          />,
          <span class="fin-token">{finText(item, 'currency') || '—'}</span>,
          ...(hasReference ? [finText(item, 'bankReference') || '—'] : []),
          ...(hasReceivedAt
            ? [<time class="fin-token">{finWhen(item, 'paymentReceivedAt')}</time>]
            : []),
          <time class="fin-token">{finWhen(item, 'createdAt')}</time>,
        ])}
      />
    </FinSection>
  );
};

export const ArDetailDrawer = ({ state }: Readonly<{ state: ArViewState }>) => {
  const row = state.selected;
  if (!row) return null;
  const { ports } = state;
  const number = finText(row, 'documentNumber', 'document_number') || '—';
  const stateText = arState(row);
  const customer = finText(row, 'customerName') || '—';
  return (
    <DetailDrawer
      title={`应收单据 · ${number}`}
      onClose={() => {
        state.open(null);
      }}
      // TD-WF-014①：写成功的提示放在抽屉底部，不随抽屉体滚走。
      footer={state.notice === '' ? undefined : <ConsoleNotice message={state.notice} />}
    >
      <FinSection title="单据信息" testId="kt-ar-detail">
        <FinFacts
          items={[
            ['单据号', <span data-testid="kt-ar-detail-number">{number}</span>],
            ['类型', arDocumentType(row)],
            [
              '客户',
              customer !== '—' && ports.routeVisible('customers') ? (
                <FinLink
                  href={finLink('customers')}
                  testId="kt-ar-link-customer"
                  onNavigate={() => {
                    state.open(null);
                  }}
                >
                  {customer}
                </FinLink>
              ) : (
                customer
              ),
            ],
            ['币种', finText(row, 'currency') || '—'],
            [
              '原始金额',
              <FinAmount
                currency={row.currency}
                amount={row.originalAmount}
                testId="kt-ar-detail-original"
              />,
            ],
            [
              '已核销',
              <FinAmount
                currency={row.currency}
                amount={row.appliedAmount}
                testId="kt-ar-detail-applied"
              />,
            ],
            [
              '未核销',
              <FinAmount
                currency={row.currency}
                amount={row.remainingAmount}
                testId="kt-ar-detail-remaining"
              />,
            ],
            ['到期日', finDay(row, 'dueAt', 'due_at')],
            ['过账时间', finWhen(row, 'postedAt')],
            ['账龄', <span data-testid="kt-ar-detail-aging">{arAgingText(row, Date.now())}</span>],
            [
              '状态',
              <StatusBadge tone={arStateTone(stateText)}>
                {AR_STATES[stateText] ?? stateText}
              </StatusBadge>,
            ],
          ]}
        />
      </FinSection>
      <OrderSection state={state} row={row} />
      <AllocationSection state={state} row={row} />
      {/* TD-WF-014④：行内表单开合或按钮变化时，把键盘焦点带回抽屉。 */}
      <FocusAnchor token="detail" />
    </DetailDrawer>
  );
};
