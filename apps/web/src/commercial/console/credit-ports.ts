// U3-COM-7：信用审查控制台端口层——视图数据/提交经最小面
//（页面不依赖 CreditContractViewContext，行为测试注入 double）。
export type CreditRow = Readonly<Record<string, unknown>>;

// issuedQuotes 行含 customerId/issuedSnapshotId/total（评估流消费）。

export type CreditConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialLimits: readonly CreditRow[];
  initialDecisions: readonly CreditRow[];
  issuedQuotes: readonly CreditRow[];
  customers: readonly Readonly<{ id: string; name?: string | null }>[];
  textValue: (value: unknown, fallback?: string) => string;
  recordText: (record: unknown, camel: string, snake: string, fallback?: string) => string;
  displayMoney: (currency: unknown, value: unknown) => string;
  currencyLabel: (value: unknown) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<{
    limits: readonly CreditRow[];
    decisions: readonly CreditRow[];
  }>;
}>;
