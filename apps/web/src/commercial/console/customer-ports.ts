// U3-CRM-2：客户控制台端口层——视图数据/提交经最小面
//（页面不依赖 CrmController，行为测试注入 double）。
export type CustomerRow = Readonly<Record<string, unknown>>;

export type CustomerConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialCustomers: readonly CustomerRow[];
  opportunities: readonly Record<string, unknown>[];
  textValue: (value: unknown, fallback?: string) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  load360: (customerId: string) => Promise<Readonly<Record<string, unknown>> | null>;
  createContact: (
    customerId: string,
    payload: Record<string, unknown>,
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<readonly CustomerRow[]>;
}>;
