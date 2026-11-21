// U3-COM-6：销售政策控制台端口层——视图数据/提交经最小面
//（页面不依赖 PricingViewController，行为测试注入 double）。
export type PolicyRow = Readonly<Record<string, unknown>>;

export type PolicyConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialPolicies: readonly PolicyRow[];
  initialCosts: readonly PolicyRow[];
  initialEvaluations: readonly PolicyRow[];
  textValue: (value: unknown, fallback?: string) => string;
  recordValue: (value: unknown) => Readonly<Record<string, unknown>>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<{
    policies: readonly PolicyRow[];
    costs: readonly PolicyRow[];
    evaluations: readonly PolicyRow[];
  }>;
}>;
