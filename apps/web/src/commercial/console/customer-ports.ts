// U3-CRM-2：客户控制台端口层——视图数据/提交经最小面
//（页面不依赖 CrmController，行为测试注入 double）。
import type { CustomerCreditSummary } from '../../crm/crm-ux';

export type CustomerRow = Readonly<Record<string, unknown>>;

// CRM-UX 可选端口：宿主未注入时对应增强自动隐藏（既有装配方无需改动）。
// - now：统计与相对时间的基准时钟（单测注入固定值）。
// - loadCredit：客户 360 信用概要的数据通道——CRM 前端 HTTP 客户端与端口装配
//   不在本批边界内，生产接线待主协调裁定（TD-CRM-005）；360 响应若内嵌 credit
//   分区则优先于本端口。
// - highValue：「高价值客户」口径由宿主给出（全仓无定义，TD-CRM-006 待裁定）。
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
