import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { OpportunityListPage } from './opportunity-list';
import type { OpportunityListPorts } from './opportunity-list';
import { SolutionConsolePage } from './solution-console';
import type { SolutionConsolePorts } from './solution-ports';
import { QuoteConsolePage } from './quote-console';
import type { QuoteConsolePorts } from './quote-ports';
import { CostMatrixConsolePage } from './cost-matrix-console';
import type { CostMatrixConsolePorts } from './cost-matrix-ports';
import { CtrConsolePage } from './ctr-console';
import type { CtrConsolePorts } from './ctr-ports';
import { PolicyConsolePage } from './policy-console';
import type { PolicyConsolePorts } from './policy-ports';
import { CreditConsolePage } from './credit-console';
import type { CreditConsolePorts } from './credit-ports';
import { LeadConsolePage } from './lead-console';
import type { LeadConsolePorts } from './lead-ports';
import { CustomerConsolePage } from './customer-console';
import type { CustomerConsolePorts } from './customer-ports';
import { SupplierConsolePage } from './supplier-console';
import type { SupplierConsolePorts } from './supplier-ports';
import { RfqConsolePage } from './rfq-console';
import type { RfqConsolePorts } from './rfq-ports';
import { PurchaseOrderConsolePage } from './po-console';
import type { PurchaseOrderConsolePorts } from './po-ports';

// U3-COM-1..7：commercial 控制台挂载体（经宿主动态 import 独立 chunk，登录入口
// 预算不受影响）；按宿主路由选择页面，页面工厂闭包持有各自 signal 状态。
type ConsoleMountPorts =
  | Readonly<{ kind: 'opportunities'; ports: OpportunityListPorts }>
  | Readonly<{ kind: 'technical-solutions'; ports: SolutionConsolePorts }>
  | Readonly<{ kind: 'quotes'; ports: QuoteConsolePorts }>
  | Readonly<{ kind: 'cost-matrices'; ports: CostMatrixConsolePorts }>
  | Readonly<{ kind: 'technical-requirements'; ports: CtrConsolePorts }>
  | Readonly<{ kind: 'sales-policies'; ports: PolicyConsolePorts }>
  | Readonly<{ kind: 'credit-review'; ports: CreditConsolePorts }>
  | Readonly<{ kind: 'leads'; ports: LeadConsolePorts }>
  | Readonly<{ kind: 'customers'; ports: CustomerConsolePorts }>
  | Readonly<{ kind: 'suppliers'; ports: SupplierConsolePorts }>
  | Readonly<{ kind: 'rfqs'; ports: RfqConsolePorts }>
  | Readonly<{ kind: 'purchase-orders'; ports: PurchaseOrderConsolePorts }>;

const PAGE_BY_KIND: Readonly<Record<ConsoleMountPorts['kind'], (ports: never) => ComponentType>> = {
  opportunities: OpportunityListPage as (ports: never) => ComponentType,
  'technical-solutions': SolutionConsolePage as (ports: never) => ComponentType,
  quotes: QuoteConsolePage as (ports: never) => ComponentType,
  'cost-matrices': CostMatrixConsolePage as (ports: never) => ComponentType,
  'technical-requirements': CtrConsolePage as (ports: never) => ComponentType,
  'sales-policies': PolicyConsolePage as (ports: never) => ComponentType,
  'credit-review': CreditConsolePage as (ports: never) => ComponentType,
  leads: LeadConsolePage as (ports: never) => ComponentType,
  customers: CustomerConsolePage as (ports: never) => ComponentType,
  suppliers: SupplierConsolePage as (ports: never) => ComponentType,
  rfqs: RfqConsolePage as (ports: never) => ComponentType,
  'purchase-orders': PurchaseOrderConsolePage as (ports: never) => ComponentType,
};

export function mountCommercialConsole(host: HTMLElement, mount: ConsoleMountPorts): void {
  const factory = PAGE_BY_KIND[mount.kind];
  render(h(factory(mount.ports as never), {}), host);
}

export type { ConsoleMountPorts };
