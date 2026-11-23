// U3-PROC-4：收货控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type GoodsReceiptRow = Readonly<Record<string, unknown>>;

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
  refresh: () => Promise<readonly GoodsReceiptRow[]>;
}>;
