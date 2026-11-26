// U3-CRM-2：客户控制台端口层——视图数据/提交经最小面
//（页面不依赖 CrmController，行为测试注入 double）。
import type { CustomerCreditSummary } from '../../crm/crm-ux';

export type CustomerRow = Readonly<Record<string, unknown>>;

// CRM-UX 可选端口：宿主未注入时对应增强自动隐藏（既有装配方无需改动）。
// - now：统计与相对时间的基准时钟（单测注入固定值）。
// - loadCredit：TD-CRM-006 经宿主按 credit:read 注入，使用既有 CRM HTTP 客户端读取信用台账；
//   展示最新生效额度、最近评估敞口与最近决定。360 响应若内嵌 credit 分区则优先于本端口。
// - highValue：「高价值客户」口径暂缓（TD-CRM-006），生产不注入，卡片保持隐藏。
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
  createActivity: (
    customerId: string,
    payload: Record<string, unknown>,
  ) => Promise<Readonly<Record<string, unknown>> | null>;
  refresh: () => Promise<readonly CustomerRow[]>;
  now?: () => number;
  loadCredit?: (customerId: string) => Promise<CustomerCreditSummary | null>;
  highValue?: Readonly<{
    label: string;
    hint: string;
    count: (customers: readonly CustomerRow[]) => number;
  }>;
}>;
