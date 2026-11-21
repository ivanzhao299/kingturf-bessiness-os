// U3-CRM-1：线索控制台端口层——视图数据/提交/认领经最小面
//（页面不依赖 CrmController，行为测试注入 double）。
export type LeadRow = Readonly<Record<string, unknown>>;

export type LeadConsolePorts = Readonly<{
  permissions: ReadonlySet<string>;
  initialLeads: readonly LeadRow[];
  poolMode: boolean;
  employeeChoices: readonly Readonly<{ value: string; label: string }>[];
  textValue: (value: unknown, fallback?: string) => string;
  submit: (
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH' | 'PUT',
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<readonly LeadRow[]>;
}>;
