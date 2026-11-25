import { DetailDrawer, FormSection } from '@kingturf/ui';
import { ConsoleNotice } from './console-notice';
import { FocusAnchor } from './focus-anchor';
import {
  FinAmount,
  FinFacts,
  FinSection,
  FinTable,
  finRows,
  finText,
  finWhen,
  type FinRow,
} from './fin-kit';
import type { PaymentTab } from './payment-ports';

export const runStatus = (row: FinRow): string => {
  const state = finText(row, 'status');
  return state === 'COMPLETED' ? '已完成' : state === 'NO_MATCH' ? '未匹配' : state || '—';
};
export const paymentReference = (row: FinRow): string =>
  finText(row, 'bankReference', 'bank_reference');
export const resultHash = (row: FinRow): string => finText(row, 'resultHash', 'result_hash');
export const paymentCanRun = (row: FinRow, permissions: ReadonlySet<string>): boolean =>
  permissions.has('reconciliation:run') && Number(row.remainingAmount) > 0;
export const allocationOrderDescription =
  '系统将按同一客户、同一币种查找未结清发票，再按到期日、创建时间和单据 ID 的稳定顺序分配本笔剩余收款，并保存结果哈希。';

export const PaymentDetail = (
  props: Readonly<{
    tab: PaymentTab;
    row: FinRow;
    notice: string;
    canRun: boolean;
    busy: boolean;
    runningForm: boolean;
    error: string;
    onOpenRun: () => void;
    onClose: () => void;
    onSubmitRun: () => void;
  }>,
) => {
  const { row } = props;
  const payment = props.tab === 'payments';
  return (
    <DetailDrawer
      title={payment ? `银行收款 · ${paymentReference(row) || '—'}` : '核销运行'}
      onClose={props.onClose}
      footer={props.notice === '' ? undefined : <ConsoleNotice message={props.notice} />}
    >
      <FinSection
        title={payment ? '收款信息' : '运行结果'}
        testId={payment ? 'kt-payment-detail' : 'kt-payment-run-detail'}
      >
        {payment ? <PaymentFacts row={row} /> : <RunFacts row={row} />}
      </FinSection>
      <AllocationRows row={row} />
      {props.runningForm ? (
        <FormSection
          title="运行自动核销"
          description={allocationOrderDescription}
          fields={[]}
          submitLabel="预览确认"
          error={props.error}
          onSubmit={props.onSubmitRun}
        />
      ) : props.canRun ? (
        <button
          type="button"
          class="primary"
          data-testid="kt-payment-run"
          disabled={props.busy}
          onClick={props.onOpenRun}
        >
          运行自动核销
        </button>
      ) : null}
      <FocusAnchor token={props.runningForm ? 'reconcile' : 'detail'} />
    </DetailDrawer>
  );
};

const PaymentFacts = ({ row }: Readonly<{ row: FinRow }>) => (
  <FinFacts
    items={[
      ['银行流水号', paymentReference(row) || '—'],
      ['客户', finText(row, 'customerName') || '—'],
      ['币种', finText(row, 'currency') || '—'],
      ['到账金额', <FinAmount currency={row.currency} amount={row.originalAmount} />],
      ['已分配', <FinAmount currency={row.currency} amount={row.appliedAmount} />],
      ['未分配', <FinAmount currency={row.currency} amount={row.remainingAmount} />],
      ['到账时间', finWhen(row, 'receivedAt', 'received_at')],
      ['登记时间', finWhen(row, 'registeredAt')],
    ]}
  />
);
const RunFacts = ({ row }: Readonly<{ row: FinRow }>) => (
  <FinFacts
    items={[
      ['运行时间', finWhen(row, 'createdAt', 'created_at')],
      ['状态', runStatus(row)],
      ['匹配笔数', finText(row, 'matchCount') || '—'],
      ['结果哈希', <code data-testid="kt-payment-detail-hash">{resultHash(row) || '—'}</code>],
      ['收款', paymentReference(row) || '—'],
      ['运行后收款余额', finText(row, 'remainingAfterRun') || '—'],
      ...(row.algorithm === 'due_at,created_at,id'
        ? [['分配顺序', '到期日 → 创建时间 → 单据 ID'] as const]
        : []),
    ]}
  />
);
const AllocationRows = ({ row }: Readonly<{ row: FinRow }>) => (
  <FinSection title="核销分配明细" testId="kt-payment-allocations">
    {Array.isArray(row.allocations) ? (
      <FinTable
        testId="kt-payment-allocation-table"
        head={['次序', '应收单据', '分配金额', '当前应收余额', '分配时间']}
        empty="暂无核销分配"
        rows={finRows(row.allocations).map((entry) => [
          finText(entry, 'allocationOrder'),
          finText(entry, 'documentNumber') || '—',
          <FinAmount currency={entry.currency} amount={entry.amount} />,
          <FinAmount currency={entry.currency} amount={entry.receivableRemaining} />,
          <time class="fin-token">{finWhen(entry, 'createdAt')}</time>,
        ])}
      />
    ) : (
      <p class="fin-muted">核销分配详情暂不可用。</p>
    )}
  </FinSection>
);

export const PaymentIntake = (
  props: Readonly<{
    customers: readonly Readonly<{ value: string; label: string }>[];
    error: string;
    onClose: () => void;
    onSubmit: (values: Readonly<Record<string, string>>) => Promise<void>;
  }>,
) => (
  <DetailDrawer title="登记银行收款" onClose={props.onClose}>
    <FormSection
      title="登记银行收款"
      description="银行流水号和原始摘要将生成不可变哈希。"
      fields={[
        {
          name: 'customerId',
          label: '客户',
          type: 'select',
          required: true,
          options: props.customers,
        },
        { name: 'bankReference', label: '银行流水号', required: true },
        { name: 'amount', label: '到账金额', type: 'number', required: true },
        {
          name: 'currency',
          label: '币种',
          type: 'select',
          required: true,
          options: [
            { value: 'CNY', label: '人民币' },
            { value: 'USD', label: '美元 USD' },
          ],
        },
        { name: 'receivedAt', label: '到账日期', type: 'date', required: true },
        { name: 'payer', label: '付款方户名', required: true },
      ]}
      submitLabel="保存收款"
      error={props.error}
      onSubmit={props.onSubmit}
    />
  </DetailDrawer>
);
