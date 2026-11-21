// U3-COM-5：CTR 控制台端口层——视图数据/提交/命令/附件经最小面
//（页面不依赖 SalesViewController，行为测试注入 double）。
export type CtrRow = Readonly<Record<string, unknown>>;

export type CtrConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialCtrs: readonly CtrRow[];
  initialSolutions: readonly CtrRow[];
  opportunities: readonly Readonly<{ id: string; name?: string | null }>[];
  textValue: (value: unknown, fallback?: string) => string;
  recordValue: (value: unknown) => Readonly<Record<string, unknown>>;
  displayRequirement: (value: unknown) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  uploadAttachment: (versionId: string, file: File) => Promise<void>;
  refresh: () => Promise<{ ctrs: readonly CtrRow[]; solutions: readonly CtrRow[] }>;
}>;
