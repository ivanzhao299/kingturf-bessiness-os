// U3-COM-3：报价控制台端口层——控制器能力到组件 Props 的最小面
//（页面不依赖 CommercialController/pricing ports，行为测试注入 double）。
export type QuoteRow = Readonly<Record<string, unknown>>;

export type QuoteSnapshot = Readonly<{
  quotes: readonly QuoteRow[];
  costs: readonly QuoteRow[];
  policies: readonly QuoteRow[];
  solutions: readonly QuoteRow[];
  ctrs: readonly QuoteRow[];
  preferredCostDecisionId: string;
}>;

export type QuoteConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialSnapshot: QuoteSnapshot;
  textValue: (value: unknown, fallback?: string) => string;
  recordValue: (value: unknown) => Readonly<Record<string, unknown>>;
  decimalValue: (value: number) => string;
  printIssuedQuote: (quote: QuoteRow) => void;
  /** controller.submit 语义：完成后返回 revisionState（政策校验结果消费面）。 */
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  clearPreferredCostDecisionId: () => void;
  command: (
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ) => Promise<void>;
  refresh: () => Promise<QuoteSnapshot>;
}>;
