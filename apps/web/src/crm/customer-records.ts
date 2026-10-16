import { el } from '../dom';
import { openForm, type FormField } from '../shared/forms';
import type { CrmController } from './controller';
import type { CrmPermission } from './types';
import type {
  CrmRecordPorts,
  EmployeeChoices,
  Pagination,
  SelectedCrmController,
} from './record-ports';

export function appendCustomerList(
  split: HTMLElement,
  shell: HTMLElement,
  controller: CrmController,
  pagination: Pagination,
  ports: CrmRecordPorts,
): void {
  const { bootstrapView, customerStateLabel } = ports;
  const list = el('article', 'panel customer-list');
  list.setAttribute('data-route-view', 'customers');
  const listHead = el('div', 'panel-head');
  const listTitle = el('div');
  listTitle.append(
    el('h2', '', '重点客户'),
    el('p', 'muted', `${String(controller.customers.length)} 个可见客户`),
  );
  listHead.append(listTitle, el('button', 'text-button', '查看全部 →'));
  const filters = el('div', 'list-filters');
  const customerSearch = el('input', 'filter-search');
  customerSearch.type = 'search';
  customerSearch.placeholder = '搜索客户名称或编号';
  customerSearch.value = controller.customerQuery;
  customerSearch.addEventListener('input', () => {
    controller.customerQuery = customerSearch.value;
    controller.customerPage = 1;
    bootstrapView(shell, controller);
  });
  const statusFilter = el('select', 'filter-select');
  for (const [status, label] of [
    ['ALL', '全部状态'],
    ['PROSPECT', '潜在客户'],
    ['ACTIVE', '合作客户'],
    ['INACTIVE', '暂停合作'],
    ['ARCHIVED', '已归档'],
  ] as const) {
    const option = el('option', '', label);
    option.value = status;
    option.selected = controller.customerStatus === status;
    statusFilter.append(option);
  }
  statusFilter.addEventListener('change', () => {
    controller.customerStatus = statusFilter.value;
    controller.customerPage = 1;
    bootstrapView(shell, controller);
  });
  filters.append(customerSearch, statusFilter);
  list.append(listHead, filters);
  const visibleCustomers = controller.visibleCustomers();
  if (controller.customers.length === 0) {
    const empty = el('div', 'empty-state');
    empty.append(
      el('span', 'empty-icon', '◇'),
      el('strong', '', '还没有客户数据'),
      el('p', '', '新建第一个客户，开始沉淀线索、商机与跟进记录。'),
    );
    list.append(empty);
  } else if (visibleCustomers.length === 0) {
    list.append(el('p', 'empty filter-empty', '没有符合当前筛选条件的客户'));
  }
  for (const customer of controller.customerPageItems()) {
    const row = el('button', 'customer-row');
    row.append(
      el('span', 'avatar', customer.name?.slice(0, 1) ?? '?'),
      el('span', 'identity', customer.name ?? customer.id),
      el('span', 'status', customerStateLabel(customer.status)),
      el('span', 'owner', customer.ownerId ?? '未分配'),
    );
    row.addEventListener('click', () => {
      void controller
        .selectCustomer(customer.id)
        .then(() => {
          bootstrapView(shell, controller);
        })
        .catch((failure: unknown) => {
          controller.error =
            failure instanceof Error ? failure.message : '客户详情读取失败，请重试';
          bootstrapView(shell, controller);
        });
    });
    list.append(row);
  }
  if (visibleCustomers.length > 0)
    list.append(
      pagination(visibleCustomers.length, controller.customerPage, (page) => {
        controller.customerPage = page;
        bootstrapView(shell, controller);
      }),
    );
  split.append(list);
}

export function appendCustomerDetail(
  split: HTMLElement,
  shell: HTMLElement,
  controller: SelectedCrmController,
  employeeChoices: EmployeeChoices,
  ports: CrmRecordPorts,
): void {
  const { customerStateLabel, customer360Content } = ports;
  const detail = el('article', 'panel detail');
  detail.setAttribute('data-route-view', 'customers');
  detail.append(
    el('p', 'eyebrow', '客户全景'),
    el('h2', '', controller.selected.customer.name),
    el(
      'p',
      'customer-identity',
      `${controller.selected.customer.customerNumber ?? '编号受限'} · ${customerStateLabel(controller.selected.customer.status)} · ${controller.selected.customer.ownerId ?? '未分配或负责人受限'}`,
    ),
    el(
      'p',
      'muted',
      `${String(controller.selected.contacts.length)} 联系人 · ${String(controller.selected.leads.length)} 线索 · ${String(controller.selected.opportunities.length)} 商机 · ${String(controller.selected.activities.length)} 活动`,
    ),
    customer360Content(controller.selected),
  );
  const ownershipPermission: CrmPermission =
    controller.selected.customer.ownerId === null
      ? 'customer-ownership:assign'
      : 'customer-ownership:reassign';
  const actions: readonly [CrmPermission, string][] = [
    ['customer:update', '添加联系人'],
    ['customer-activity:create', '记录活动'],
    ['customer:lifecycle', '变更状态'],
    [
      ownershipPermission,
      ownershipPermission === 'customer-ownership:assign' ? '分配客户' : '重新分配客户',
    ],
  ];
  for (const [permission, label] of actions)
    if (
      controller.permissions.has(permission) &&
      (permission !== 'customer:lifecycle' ||
        Number.isInteger(controller.selected.customer.version)) &&
      (!['customer-ownership:assign', 'customer-ownership:reassign'].includes(permission) ||
        (Number.isInteger(controller.selected.customer.version) &&
          controller.selected.customer.ownerId !== undefined))
    ) {
      const button = el('button', 'secondary', label);
      button.addEventListener('click', () => {
        openCustomerAction(shell, controller, label, employeeChoices, ports);
      });
      detail.append(button);
    }
  split.append(detail);
}

function openCustomerAction(
  shell: HTMLElement,
  controller: CrmController,
  label: string,
  employeeChoices: EmployeeChoices,
  ports: CrmRecordPorts,
): void {
  const { bootstrapView } = ports;
  const definitions: Record<string, { description: string; fields: readonly FormField[] }> = {
    添加联系人: {
      description: '联系人至少需要填写邮箱；联系方式会受字段权限保护。',
      fields: [
        { name: 'first', label: '联系人姓名', required: true },
        { name: 'second', label: '联系人邮箱', type: 'email', required: true },
      ],
    },
    记录活动: {
      description: '跟进记录会进入 Customer 360 活动时间线。',
      fields: [{ name: 'first', label: '活动摘要', type: 'textarea', required: true }],
    },
    变更状态: {
      description: '状态变更会保留原因、操作人和完整审计记录。',
      fields: [
        {
          name: 'first',
          label: '目标状态',
          type: 'select',
          required: true,
          options: [
            { value: 'PROSPECT', label: '潜在客户' },
            { value: 'ACTIVE', label: '合作客户' },
            { value: 'INACTIVE', label: '暂停合作' },
            { value: 'ARCHIVED', label: '归档' },
          ],
        },
        { name: 'second', label: '变更原因', type: 'textarea', required: true },
      ],
    },
    分配客户: {
      description: '指定客户负责人并记录分配原因。',
      fields: [
        employeeChoices.length > 0
          ? {
              name: 'first',
              label: '负责人',
              type: 'select',
              required: true,
              options: employeeChoices,
            }
          : { name: 'first', label: '负责人编号', required: true },
        { name: 'second', label: '分配原因', required: true },
      ],
    },
    重新分配客户: {
      description: '改派操作会保留原负责人和新负责人记录。',
      fields: [
        employeeChoices.length > 0
          ? {
              name: 'first',
              label: '新负责人',
              type: 'select',
              required: true,
              options: employeeChoices,
            }
          : { name: 'first', label: '新负责人编号', required: true },
        { name: 'second', label: '改派原因', required: true },
      ],
    },
  };
  const definition = definitions[label];
  if (!definition) return;
  openForm(shell, label, definition.description, definition.fields, '确认提交', async (values) => {
    const action =
      label === '添加联系人'
        ? 'contact'
        : label === '记录活动'
          ? 'activity'
          : label === '变更状态'
            ? 'lifecycle'
            : 'ownership';
    await controller.mutateSelected(action, values.first ?? '', values.second ?? '');
    bootstrapView(shell, controller);
  });
}
