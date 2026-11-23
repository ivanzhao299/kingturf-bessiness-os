// U3-PROC-3：采购单控制台端口层——视图数据/提交/合同文档经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type PurchaseOrderRow = Readonly<Record<string, unknown>>;
export type ContractDocumentRow = Readonly<Record<string, unknown>>;

export type PurchaseOrderConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialOrders: readonly PurchaseOrderRow[];
  // 已发布物料版本/供应商选项（创建表单；vanilla 采购订单表单同源）。
  itemVersionChoices: readonly { readonly value: string; readonly label: string }[];
  supplierChoices: readonly { readonly value: string; readonly label: string }[];
  // 合同文档视图行（/api/v1/contract-documents；抽屉按 subjectId 过滤呈现）。
  initialDocuments: readonly ContractDocumentRow[];
  recordText: (record: PurchaseOrderRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  decimalValue: (value: number) => string;
  businessStateLabel: (value: unknown, fallback?: string) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  uploadContractDocument: (
    businessType: 'SALES' | 'PURCHASE',
    subjectType: 'contract-revision' | 'purchase-order',
    subjectId: string,
    file: File,
  ) => Promise<Readonly<Record<string, unknown>>>;
  // 详情读取（additive findPurchaseOrder：根行+行项收货状态+关联收货单）。
  loadDetail: (orderId: string) => Promise<PurchaseOrderRow | null>;
  refresh: () => Promise<{
    orders: readonly PurchaseOrderRow[];
    documents: readonly ContractDocumentRow[];
  }>;
}>;
