import { h, render } from 'preact';
import { OpportunityListPage } from './opportunity-list';
import type { OpportunityListPorts } from './opportunity-list';

// U3-COM-1：商机列表控制台挂载体（经宿主动态 import 独立 chunk，登录入口预算不受影响）。
export function mountOpportunityConsole(host: HTMLElement, ports: OpportunityListPorts): void {
  render(h(OpportunityListPage(ports), {}), host);
}
