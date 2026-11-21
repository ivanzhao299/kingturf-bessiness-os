import { el } from '../dom';
import { visibleCrmSections, type CrmController } from './controller';
import { appendCustomerConsole, appendLeadConsole } from '../commercial/console-entry';

export function createCrmRecords(_shell: HTMLElement, controller: CrmController): HTMLElement {
  const sections = visibleCrmSections(controller.permissions);
  const content = el('section', 'crm-records');
  // U3-CRM route-view fix: must include both 'customers' and 'leads' — otherwise
  // the parent hides the lead console when route is #/leads.
  content.setAttribute('data-route-view', 'customers leads');
  if (controller.error) {
    const notice = el('p', 'error', controller.error);
    notice.setAttribute('role', 'alert');
    content.append(notice);
  }
  const sectionHeader = el('div', 'section-heading');
  sectionHeader.append(el('div', '', '今日业务'), el('span', '', '数据实时来自业务台账'));
  sectionHeader.setAttribute('data-route-view', 'customers leads');
  content.append(sectionHeader);
  // U3-CRM-2..4：客户列表迁移至 Preact 客户控制台（含 360 抽屉+联系人+活动时间线）。
  if (sections.customers) appendCustomerConsole(content, controller);
  // U3-CRM-1：线索列表迁移至 Preact 线索控制台（data-route-view=leads）。
  if (sections.leads) appendLeadConsole(content, controller);
  return content;
}
