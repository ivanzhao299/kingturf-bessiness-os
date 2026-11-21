// U3-COM-2：技术方案控制台端口层——控制器能力到组件 Props 的最小面
//（页面不依赖 SalesViewController，行为测试注入 double）。
export type SolutionRow = Readonly<Record<string, unknown>>;

export type SolutionConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialSolutions: readonly SolutionRow[];
  initialCtrs: readonly SolutionRow[];
  technicalSolutionOpportunityId: (ctrs: readonly SolutionRow[], ctrVersionId: string) => string;
  textValue: (value: unknown, fallback?: string) => string;
  formValue: (value: unknown) => string;
  displayRequirement: (value: unknown) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<void>;
  refresh: () => Promise<{
    solutions: readonly SolutionRow[];
    ctrs: readonly SolutionRow[];
  }>;
}>;
