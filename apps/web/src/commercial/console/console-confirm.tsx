import { signal, type Signal } from '@preact/signals';
import { ConfirmDialog } from '@kingturf/ui';

// TD-WF-014②（写流程冒烟 WS-P3-02）：不可逆的单击动作先确认。发布版本、签发 / 取消订单、发布 / 关闭
// 询价原先一点即生效。经表单提交的动作（批准、拒绝、修订…）已经是「填理由 → 明确的确认按钮」两步，
// 含敏感词的还有 FormSection 的勾选确认，不在这一层重复加框。
export type ConfirmRequest = Readonly<{
  // 对什么做什么。
  title: string;
  // 做了之后会怎样、能否撤回。
  message: string;
  confirmLabel: string;
  // 破坏性动作：确认框的初焦落在「取消」上。
  destructive?: boolean;
  // 用户确认后执行的动作。动作自己负责错误呈现（各控制台既有的 submitError / actionError）。
  run: () => Promise<void> | void;
}>;

// 当前等待确认的动作；null 表示没有确认框。每个控制台页面一个。
export type ConfirmSignal = Signal<ConfirmRequest | null>;

export const createConfirm = (): ConfirmSignal => signal<ConfirmRequest | null>(null);

// 把一次单击变成「先确认」：记下动作，由页面根部的 ConsoleConfirmDialog 呈现。
export const askConfirm = (pending: ConfirmSignal, request: ConfirmRequest): void => {
  pending.value = request;
};

// 制造主数据三个控制台（物料 / BOM / 工艺路线）共用的「发布版本」确认：行内与详情里的发布按钮同一句话。
// target 是版本的身份（如「FG-KT-PRO-50 第 1 版」），what 是这一版冻结后不能再改的东西。
export const askPublishVersion = (
  pending: ConfirmSignal,
  target: string,
  what: string,
  run: () => Promise<void> | void,
): void => {
  askConfirm(pending, {
    title: '发布版本',
    message: `发布后 ${target} 随即冻结，${what}不可再修改。`,
    confirmLabel: '确认发布',
    run,
  });
};

export const ConsoleConfirmDialog = ({ pending }: Readonly<{ pending: ConfirmSignal }>) => {
  const request = pending.value;
  if (request === null) return null;
  const settle = (): void => {
    pending.value = null;
  };
  return (
    <ConfirmDialog
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      destructive={request.destructive === true}
      onCancel={settle}
      onConfirm={() => {
        // 先关框再执行：关框时焦点还回触发按钮；动作随后按各控制台既有的方式呈现结果。
        settle();
        void request.run();
      }}
    />
  );
};
