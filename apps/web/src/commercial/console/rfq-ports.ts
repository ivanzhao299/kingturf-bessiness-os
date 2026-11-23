// U3-PROC-2：询价控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type RfqRow = Readonly<Record<string, unknown>>;

export type RfqConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialRfqs: readonly RfqRow[];
  // 已发布物料版本选项（创建表单行项；vanilla 采购询价表单同源）。
  itemVersionChoices: readonly { readonly value: string; readonly label: string }[];
  recordText: (record: RfqRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  // 详情读取（additive findRfq：根行+行项+报价对比）；读取失败回退列表行。
  loadDetail: (rfqId: string) => Promise<RfqRow | null>;
  // PROC-UX：当前时间源（截止倒计时/报价有效期判定）；缺省取系统时间。
  now?: () => Date;
  refresh: () => Promise<readonly RfqRow[]>;
}>;
