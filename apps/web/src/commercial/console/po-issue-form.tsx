// TD-PROC-016：签发失败原因跟随签发动作留在表单内；确认框与精确 PUT 载荷沿用既有流程。
import { askConfirm, type ConfirmSignal } from './console-confirm';

type Props = Readonly<{
  number: string;
  error: string;
  confirm: ConfirmSignal;
  issue: () => Promise<void>;
}>;

export function PurchaseOrderIssueForm({ number, error, confirm, issue }: Props) {
  return (
    <form
      class="form-section po-issue-form"
      onSubmit={(event) => {
        event.preventDefault();
        askConfirm(confirm, {
          title: '签发采购订单',
          message: `签发后订单 ${number} 进入执行，供应商开始备货。`,
          confirmLabel: '确认签发',
          run: issue,
        });
      }}
    >
      <button type="submit" class="primary" data-testid="kt-po-issue">
        签发订单
      </button>
      <p class="form-error" role="alert" data-testid="kt-po-submit-error">
        {error}
      </p>
    </form>
  );
}
