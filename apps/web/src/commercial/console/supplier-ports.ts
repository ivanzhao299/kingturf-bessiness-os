// U3-PROC-1：供应商控制台端口层——视图数据/提交经最小面
//（页面不依赖 CommercialController，行为测试注入 double）。
export type SupplierRow = Readonly<Record<string, unknown>>;

export type SupplierConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialSuppliers: readonly SupplierRow[];
  // 已发布物料版本选项（资质审核表单；legacy 物料准入表单同源）。
  itemVersionChoices: readonly Readonly<{ value: string; label: string }>[];
  // 供应商报价历史（/api/v1/supplier-quotes 视图行，按 supplierId 过滤展示）。
  initialQuotes: readonly SupplierRow[];
  recordText: (record: SupplierRow, camel: string, snake: string, fallback?: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<
    Readonly<{ suppliers: readonly SupplierRow[]; quotes: readonly SupplierRow[] }>
  >;
  // PROC-UX：当前时间源（报价有效期判定）；缺省取系统时间。
  now?: () => Date;
}>;
