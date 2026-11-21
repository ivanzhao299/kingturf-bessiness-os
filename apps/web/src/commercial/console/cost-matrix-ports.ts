import type { CostMatrixPage, CostMatrixQuery } from '../types';

// U3-COM-4：成本矩阵控制台端口层——summaries 分页查询/详情读取/提交/命令经最小面
//（页面不依赖 PricingViewController，行为测试注入 double）。
export type CostMatrixRow = Readonly<Record<string, unknown>>;

export type CostMatrixConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialQuery: CostMatrixQuery;
  /** 首绘数据（flat 视图行，与 vanilla ledger 首屏同语义）；后续经 summaries 查询。 */
  initialPage: CostMatrixPage;
  itemVersions: readonly Readonly<{ value: string; label: string }>[];
  roleGuidance: (permissions: ReadonlySet<string>) => string;
  textValue: (value: unknown, fallback?: string) => string;
  recordValue: (value: unknown) => Readonly<Record<string, unknown>>;
  decimalValue: (value: number) => string;
  querySummaries: (update: Partial<CostMatrixQuery>) => Promise<CostMatrixPage>;
  loadMatrix: (id: string) => Promise<Readonly<Record<string, unknown>> | null>;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  navigateToQuotes: () => void;
  refresh: () => Promise<CostMatrixPage>;
}>;
