import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { OpportunityListPage } from './opportunity-list';
import type { OpportunityListPorts } from './opportunity-list';
import { SolutionConsolePage } from './solution-console';
import type { SolutionConsolePorts } from './solution-ports';
import { QuoteConsolePage } from './quote-console';
import type { QuoteConsolePorts } from './quote-ports';

// U3-COM-1/2/3：commercial 控制台挂载体（经宿主动态 import 独立 chunk，登录入口
// 预算不受影响）；按宿主路由选择页面，页面工厂闭包持有各自 signal 状态。
type ConsoleMountPorts =
  | Readonly<{ kind: 'opportunities'; ports: OpportunityListPorts }>
  | Readonly<{ kind: 'technical-solutions'; ports: SolutionConsolePorts }>
  | Readonly<{ kind: 'quotes'; ports: QuoteConsolePorts }>;

const PAGE_BY_KIND: Readonly<Record<ConsoleMountPorts['kind'], (ports: never) => ComponentType>> = {
  opportunities: OpportunityListPage as (ports: never) => ComponentType,
  'technical-solutions': SolutionConsolePage as (ports: never) => ComponentType,
  quotes: QuoteConsolePage as (ports: never) => ComponentType,
};

export function mountCommercialConsole(host: HTMLElement, mount: ConsoleMountPorts): void {
  const factory = PAGE_BY_KIND[mount.kind];
  render(h(factory(mount.ports as never), {}), host);
}

export type { ConsoleMountPorts };
