import { h, render } from 'preact';
import '@kingturf/ui/tokens.css';
import './console.css';
import { IdentityConsolePage } from './identity-page';
import { OrganizationConsolePage } from './organization-page';
import { AuditConsolePage } from './audit-page';
import { configConsoleFor } from './config-specs';
import type { ConsolePorts } from './ports';

// UI-M2：按宿主路由选择控制台页面并挂载（页面工厂闭包持有各自 signal 状态）。
const PAGE_BY_ROUTE: Readonly<Record<string, (ports: ConsolePorts) => preact.ComponentType>> = {
  'governance/identity': IdentityConsolePage,
  'governance/organization': OrganizationConsolePage,
  'governance/audit': AuditConsolePage,
};

export function mountGovernanceConsole(host: HTMLElement, ports: ConsolePorts): void {
  const configFactory = configConsoleFor(ports.route);
  if (configFactory) {
    const Page = configFactory(ports);
    render(<Page />, host);
    return;
  }
  const factory = PAGE_BY_ROUTE[ports.route];
  if (!factory) return;
  const Page = factory(ports);
  render(h(Page, {}), host);
}
