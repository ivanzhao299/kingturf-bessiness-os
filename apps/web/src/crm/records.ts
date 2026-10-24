import { el } from '../dom';
import { visibleCrmSections, type CrmController } from './controller';
import { appendCustomerList, appendCustomerDetail } from './customer-records';
import { appendLeadList } from './lead-records';
import type { CrmRecordPorts, SelectedCrmController } from './record-ports';

export function createCrmRecords(
  shell: HTMLElement,
  controller: CrmController,
  ports: CrmRecordPorts,
): HTMLElement {
  const sections = visibleCrmSections(controller.permissions);
  const content = el('section', 'crm-records');
  content.setAttribute('data-route-view', 'customers leads');
  if (controller.error) {
    const notice = el('p', 'error', controller.error);
    notice.setAttribute('role', 'alert');
    content.append(notice);
  }
  const employeeChoices = controller.employees.map((employee) => ({
    value: employee.id,
    label: `${employee.displayName ?? employee.id}${employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}`,
  }));
  const pagination = (total: number, page: number, change: (page: number) => void) => {
    const pages = Math.max(1, Math.ceil(total / controller.pageSize));
    const footer = el('footer', 'pagination');
    const previous = el('button', 'page-button', '← 上一页');
    previous.disabled = page <= 1;
    previous.addEventListener('click', () => {
      change(page - 1);
    });
    const state = el('span', '', `${String(page)} / ${String(pages)} 页 · ${String(total)} 条`);
    const next = el('button', 'page-button', '下一页 →');
    next.disabled = page >= pages;
    next.addEventListener('click', () => {
      change(page + 1);
    });
    footer.append(previous, state, next);
    return footer;
  };
  const sectionHeader = el('div', 'section-heading');
  sectionHeader.append(el('div', '', '今日业务'), el('span', '', '数据实时来自业务台账'));
  sectionHeader.setAttribute('data-route-view', 'leads customers');
  content.append(sectionHeader);
  const split = el('section', 'split');
  split.setAttribute('data-route-view', 'leads customers');
  if (sections.customers) {
    appendCustomerList(split, shell, controller, pagination, ports);
  }
  if (sections.customer360 && controller.selected) {
    appendCustomerDetail(split, shell, controller as SelectedCrmController, employeeChoices, ports);
  }
  if (sections.leads) {
    appendLeadList(split, shell, controller, sections, employeeChoices, pagination, ports);
  }
  content.append(split);
  return content;
}
