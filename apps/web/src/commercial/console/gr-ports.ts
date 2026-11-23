// U3-PROC-4：收货控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type GoodsReceiptRow = Readonly<Record<string, unknown>>;

// PROC-UX：批次追踪事实面（additive 可选）——经既有质检查询/追溯/库存视图端点并行
// 读取；403（无对应权限：quality:read / traceability:read / inventory:read）或读取
// 失败 → null（该面不可见，节点呈「无查看权限」），不拖垮收货详情。
export type TraceSources = Readonly<{
  inspections: readonly Record<string, unknown>[] | null;
  lots: readonly Record<string, unknown>[] | null;
  balances: readonly Record<string, unknown>[] | null;
}>;

export type GoodsReceiptConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialReceipts: readonly GoodsReceiptRow[];
  // 可续收订单行选项（ISSUED/PARTIALLY_RECEIVED 行，value=orderId|lineId；vanilla
  // 登记收货表单同源同公式）。
  openOrderLineChoices: readonly { readonly value: string; readonly label: string }[];
  // 活动库位选项（value=code；vanilla 同源）。
  locationChoices: readonly { readonly value: string; readonly label: string }[];
  recordText: (record: GoodsReceiptRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  decimalValue: (value: number) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  // 详情读取（additive findGoodsReceipt：根行+批次行项+关联采购单数量核对）。
  loadDetail: (receiptId: string) => Promise<GoodsReceiptRow | null>;
  // PROC-UX：批次追踪事实面读取（可选端口——缺省时时间线整段不渲染）。
  loadTraceSources?: () => Promise<TraceSources>;
  refresh: () => Promise<readonly GoodsReceiptRow[]>;
}>;
