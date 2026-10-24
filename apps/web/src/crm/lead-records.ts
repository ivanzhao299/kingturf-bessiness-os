import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { CrmController } from './controller';
import type { Lead } from './types';
import type { CrmRecordPorts, CrmSections, EmployeeChoices, Pagination } from './record-ports';

function createLeadHeader(
  shell: HTMLElement,
  controller: CrmController,
  ports: CrmRecordPorts,
): HTMLElement {
  const { bootstrapView } = ports;
  const leadHeader = el('div', 'panel-head');
  leadHeader.append(el('h2', '', '线索公海'));
  if (controller.permissions.has('lead:create')) {
    const createLead = el('button', 'secondary', '新建线索');
    createLead.addEventListener('click', () => {
      openForm(
        shell,
        '新建线索',
        '线索默认进入公海，具备权限的销售人员可以认领。',
        [
          {
            name: 'title',
            label: '线索标题',
            required: true,
            placeholder: '例如：学校运动场改造项目',
            minLength: 2,
            maxLength: 160,
          },
          {
            name: 'source',
            label: '线索来源',
            type: 'select',
            required: true,
            options: [
              { value: '展会', label: '展会' },
              { value: '网站', label: '网站' },
              { value: '转介绍', label: '转介绍' },
              { value: '主动开发', label: '主动开发' },
            ],
          },
        ],
        '创建线索',
        async (values) => {
          await controller.createLead({
            title: values.title ?? '',
            source: values.source ?? '',
            customerId: null,
            pool: true,
          });
          bootstrapView(shell, controller);
        },
      );
    });
    leadHeader.append(createLead);
  }
  return leadHeader;
}

function createLeadRow(
  lead: Lead,
  shell: HTMLElement,
  controller: CrmController,
  sections: CrmSections,
  employeeChoices: EmployeeChoices,
  ports: CrmRecordPorts,
): HTMLElement {
  const { bootstrapView } = ports;
  const row = el('div', 'lead-row', `${lead.title ?? lead.id} · ${lead.source ?? '—'}`);
  if (sections.leadClaim && lead.status === 'POOL' && Number.isInteger(lead.version)) {
    const claim = el('button', 'primary', '认领');
    claim.addEventListener('click', () => {
      void controller.claim(lead).then(() => {
        bootstrapView(shell, controller);
      });
    });
    row.append(claim);
  }
  if (controller.permissions.has('lead:lifecycle') && Number.isInteger(lead.version)) {
    const transition = el('button', 'secondary', '变更状态');
    transition.addEventListener('click', () => {
      openForm(
        shell,
        '变更线索状态',
        '线索状态变更将写入审计记录。',
        [
          {
            name: 'status',
            label: '目标状态',
            type: 'select',
            required: true,
            options: [
              { value: 'QUALIFIED', label: '已确认' },
              { value: 'DISQUALIFIED', label: '无效线索' },
              { value: 'CONVERTED', label: '已转化' },
            ],
          },
          { name: 'reason', label: '变更原因', type: 'textarea', required: true },
        ],
        '确认变更',
        async (values) => {
          await controller.mutateLead(lead, 'lifecycle', values.status ?? '', values.reason ?? '');
          bootstrapView(shell, controller);
        },
      );
    });
    row.append(transition);
  }
  const assignmentPermission =
    lead.ownerId === undefined ? null : lead.ownerId === null ? 'lead:assign' : 'lead:reassign';
  if (
    assignmentPermission !== null &&
    controller.permissions.has(assignmentPermission) &&
    Number.isInteger(lead.version)
  ) {
    const assign = el('button', 'secondary', lead.ownerId === null ? '分配' : '改派');
    assign.addEventListener('click', () => {
      openForm(
        shell,
        lead.ownerId === null ? '分配线索' : '改派线索',
        '指定负责人并保留分配原因。',
        [
          employeeChoices.length > 0
            ? {
                name: 'assigneeId',
                label: '负责人',
                type: 'select',
                required: true,
                options: employeeChoices,
              }
            : { name: 'assigneeId', label: '负责人编号', required: true },
          { name: 'reason', label: '分配原因', type: 'textarea', required: true },
        ],
        '确认分配',
        async (values) => {
          await controller.mutateLead(
            lead,
            'assignment',
            values.assigneeId ?? '',
            values.reason ?? '',
          );
          bootstrapView(shell, controller);
        },
      );
    });
    row.append(assign);
  }
  if (
    typeof lead.ownerId === 'string' &&
    lead.status === 'CLAIMED' &&
    controller.permissions.has('lead-pool:release') &&
    Number.isInteger(lead.version)
  ) {
    const release = el('button', 'secondary', '释放公海');
    release.addEventListener('click', () => {
      openForm(
        shell,
        '释放至线索公海',
        '释放后其他具备权限的销售人员可以认领。',
        [{ name: 'reason', label: '释放原因', type: 'textarea', required: true }],
        '确认释放',
        async (values) => {
          await controller.mutateLead(lead, 'release', '', values.reason ?? '');
          bootstrapView(shell, controller);
        },
      );
    });
    row.append(release);
  }
  return row;
}

export function appendLeadList(
  split: HTMLElement,
  shell: HTMLElement,
  controller: CrmController,
  sections: CrmSections,
  employeeChoices: EmployeeChoices,
  pagination: Pagination,
  ports: CrmRecordPorts,
): void {
  const { bootstrapView } = ports;
  const leads = el('article', 'panel lead-pool');
  leads.setAttribute('data-route-view', 'leads');
  const leadHeader = createLeadHeader(shell, controller, ports);
  leads.append(leadHeader);
  const leadSearch = el('input', 'filter-search lead-search');
  leadSearch.type = 'search';
  leadSearch.placeholder = '搜索线索标题、来源或状态';
  leadSearch.value = controller.leadQuery;
  leadSearch.addEventListener('input', () => {
    controller.leadQuery = leadSearch.value;
    controller.leadPage = 1;
    bootstrapView(shell, controller);
  });
  leads.append(leadSearch);
  const visibleLeads = controller.visibleLeads();
  for (const lead of controller.leadPageItems()) {
    leads.append(createLeadRow(lead, shell, controller, sections, employeeChoices, ports));
  }
  if (visibleLeads.length > 0)
    leads.append(
      pagination(visibleLeads.length, controller.leadPage, (page) => {
        controller.leadPage = page;
        bootstrapView(shell, controller);
      }),
    );
  if (visibleLeads.length === 0) {
    const queue = el('div', 'queue-list');
    for (const [title, detail, badge] of [
      ['待跟进线索', '暂无逾期线索', '0'],
      ['待提交技术需求', '技术需求等待确认', '0'],
      ['待审批报价', '价格与利润率检查', '0'],
    ]) {
      const item = el('div', 'queue-item');
      item.append(el('span', 'queue-status'), el('div', 'queue-copy', title));
      item.append(el('small', '', detail), el('b', '', badge));
      queue.append(item);
    }
    leads.append(queue);
  }
  split.append(leads);
}
