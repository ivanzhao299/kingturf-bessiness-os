import { el, setOperationStatus } from '../dom';
import { buildBusinessDocumentTemplateHtml } from '../business-document-content';
import { APP_ROUTE_LABELS, type AppRoute } from './navigation';
import type { BusinessDocumentTemplate, OnlineBusinessDocument } from './shell-types';

type ContextualDocumentPorts = Readonly<{
  visibleAppRoutes: (permissions: ReadonlySet<string>) => ReadonlySet<AppRoute>;
  BUSINESS_DOCUMENT_TEMPLATES: readonly BusinessDocumentTemplate[];
  BUSINESS_DOCUMENT_SUBJECTS: Partial<
    Record<AppRoute, Readonly<{ endpoint: string; type: string; numberKeys: readonly string[] }>>
  >;
  templatesForRoute: (route: AppRoute) => readonly BusinessDocumentTemplate[];
  businessDocumentOption: (label: string, value: string) => HTMLOptionElement;
  businessDocumentSubjectLabel: (item: Record<string, unknown>, keys: readonly string[]) => string;
  businessDocumentPrefill: (item: Record<string, unknown> | undefined) => string;
  onlineTemplateKey: (template: BusinessDocumentTemplate, route: AppRoute) => string;
  onlineDocumentApi: <T>(path: string, init?: RequestInit) => Promise<T>;
  onlineDocumentRead: <T>(path: string) => Promise<T>;
  openOnlineDocumentEditor: (
    documentData: OnlineBusinessDocument,
    permissions: Readonly<{
      manage: boolean;
      approve: boolean;
      send: boolean;
      translate: boolean;
      configure: boolean;
    }>,
    onSaved?: (currentVersion: number) => void,
  ) => void;
}>;

function createContextualSubject(
  route: AppRoute,
  allPermissions: ReadonlySet<string>,
  ports: ContextualDocumentPorts,
) {
  const {
    BUSINESS_DOCUMENT_SUBJECTS,
    businessDocumentOption,
    businessDocumentSubjectLabel,
    onlineDocumentRead,
  } = ports;
  const contextualDocuments = el('section', 'panel contextual-documents');
  contextualDocuments.setAttribute('data-route-view', route);
  const contextualHead = el('div', 'panel-head contextual-documents-head');
  const contextualCopy = el('div');
  contextualCopy.append(
    el('p', 'eyebrow', '业务文件'),
    el('h2', '', `${APP_ROUTE_LABELS[route]}常用模板`),
    el(
      'p',
      'muted',
      route === 'technical-requirements'
        ? '选用模板后下载编辑，完成后在技术需求附件区回传并随版本冻结'
        : '按当前业务选择受控模板，下载编辑后作为本业务单据附件留存',
    ),
  );
  const libraryLink = document.createElement('a');
  libraryLink.className = 'text-button';
  libraryLink.href = '#/document-templates';
  libraryLink.textContent = '全部模板';
  contextualHead.append(contextualCopy, libraryLink);
  contextualDocuments.append(contextualHead);
  const subjectConfig = BUSINESS_DOCUMENT_SUBJECTS[route];
  const subjectSelect = el('select', 'business-document-subject-select');
  const subjectRecords = new Map<string, Record<string, unknown>>();
  subjectSelect.setAttribute('aria-label', '关联业务单据');
  subjectSelect.append(businessDocumentOption('不关联具体业务单据', ''));
  if (subjectConfig && allPermissions.has('business-document:manage')) {
    subjectSelect.append(businessDocumentOption('正在加载可关联业务…', ''));
    void onlineDocumentRead<
      readonly Record<string, unknown>[] | { items?: readonly Record<string, unknown>[] }
    >(subjectConfig.endpoint)
      .then((result) => {
        const items: readonly Record<string, unknown>[] = Array.isArray(result)
          ? (result as readonly Record<string, unknown>[])
          : ((result as { items?: readonly Record<string, unknown>[] }).items ?? []);
        subjectSelect.replaceChildren(businessDocumentOption('不关联具体业务单据', ''));
        for (const item of items.slice(0, 100)) {
          const id = typeof item.id === 'string' ? item.id : '';
          if (!id) continue;
          subjectRecords.set(id, item);
          subjectSelect.append(
            businessDocumentOption(
              businessDocumentSubjectLabel(item, subjectConfig.numberKeys),
              id,
            ),
          );
        }
      })
      .catch(() => {
        subjectSelect.replaceChildren(businessDocumentOption('业务单据加载失败，可稍后重试', ''));
      });
    contextualDocuments.append(subjectSelect);
  }
  return { contextualDocuments, subjectConfig, subjectSelect, subjectRecords };
}

function createContextualBindings(
  contextualDocuments: HTMLElement,
  allPermissions: ReadonlySet<string>,
  ports: ContextualDocumentPorts,
) {
  const { businessDocumentOption, onlineDocumentRead } = ports;
  const bindingValues = {
    customers: new Map<string, string>(),
    orders: new Map<string, Readonly<{ name: string; customerId: string }>>(),
    employees: new Map<string, string>(),
  };
  const bindingGrid = el('div', 'business-document-binding-grid');
  const bindingSelect = (label: string): HTMLSelectElement => {
    const select = el('select');
    select.setAttribute('aria-label', label);
    select.append(businessDocumentOption(`选择${label}`, ''));
    return select;
  };
  const customerBinding = bindingSelect('客户');
  const orderBinding = bindingSelect('销售订单');
  const operatorBinding = bindingSelect('经办人');
  const salespersonBinding = bindingSelect('业务员');
  const assigneeBinding = bindingSelect('下一处理人');
  if (allPermissions.has('business-document:manage')) {
    for (const [label, select] of [
      ['客户', customerBinding],
      ['销售订单', orderBinding],
      ['经办人', operatorBinding],
      ['业务员', salespersonBinding],
      ['下一处理人', assigneeBinding],
    ] as const) {
      const field = el('label', 'business-document-binding-field');
      field.append(el('span', '', label), select);
      bindingGrid.append(field);
    }
    contextualDocuments.append(bindingGrid);
    void onlineDocumentRead<{
      customers: readonly Readonly<{ id: string; name: string; number: string }>[];
      orders: readonly Readonly<{ id: string; name: string; customerId: string }>[];
      employees: readonly Readonly<{ id: string; name: string; number: string }>[];
    }>('/api/v1/business-documents/reference-data')
      .then((references) => {
        for (const customer of references.customers) {
          bindingValues.customers.set(customer.id, customer.name);
          customerBinding.append(
            businessDocumentOption(`${customer.number} · ${customer.name}`, customer.id),
          );
        }
        for (const order of references.orders) {
          bindingValues.orders.set(order.id, order);
          orderBinding.append(businessDocumentOption(order.name, order.id));
        }
        for (const employee of references.employees) {
          bindingValues.employees.set(employee.id, employee.name);
          for (const select of [operatorBinding, salespersonBinding, assigneeBinding])
            select.append(
              businessDocumentOption(`${employee.number} · ${employee.name}`, employee.id),
            );
        }
      })
      .catch(() => {
        bindingGrid.append(el('p', 'operation-status', '业务绑定数据加载失败，请刷新后重试'));
      });
    orderBinding.addEventListener('change', () => {
      const order = bindingValues.orders.get(orderBinding.value);
      if (order?.customerId) customerBinding.value = order.customerId;
    });
  }
  return {
    bindingValues,
    customerBinding,
    orderBinding,
    operatorBinding,
    salespersonBinding,
    assigneeBinding,
  };
}

type ContextualSubject = ReturnType<typeof createContextualSubject>;
type ContextualBindings = ReturnType<typeof createContextualBindings>;

function createOnlineDocumentAction(
  template: BusinessDocumentTemplate,
  route: AppRoute,
  allPermissions: ReadonlySet<string>,
  subject: ContextualSubject,
  bindings: ContextualBindings,
  selectionStatus: HTMLElement,
  ports: ContextualDocumentPorts,
): HTMLButtonElement {
  const { subjectConfig, subjectSelect, subjectRecords } = subject;
  const {
    bindingValues,
    customerBinding,
    orderBinding,
    operatorBinding,
    salespersonBinding,
    assigneeBinding,
  } = bindings;
  const {
    onlineTemplateKey,
    onlineDocumentApi,
    businessDocumentPrefill,
    openOnlineDocumentEditor,
  } = ports;
  const online = el('button', 'primary compact', '新建在线文档');
  online.type = 'button';
  online.addEventListener('click', () => {
    online.disabled = true;
    setOperationStatus(selectionStatus, 'loading', `正在创建“${template.name}”…`);
    void onlineDocumentApi<OnlineBusinessDocument>('/api/v1/business-documents', {
      method: 'POST',
      body: JSON.stringify({
        templateKey: onlineTemplateKey(template, route),
        title: `${template.name} · ${new Date().toLocaleDateString('zh-CN')}`,
        route,
        ...(subjectConfig && subjectSelect.value
          ? { subjectType: subjectConfig.type, subjectId: subjectSelect.value }
          : {}),
        ...(customerBinding.value ? { customerId: customerBinding.value } : {}),
        ...(orderBinding.value ? { salesOrderId: orderBinding.value } : {}),
        ...(operatorBinding.value ? { operatorId: operatorBinding.value } : {}),
        ...(salespersonBinding.value ? { salespersonId: salespersonBinding.value } : {}),
        ...(assigneeBinding.value ? { assignedTo: assigneeBinding.value } : {}),
        content: {
          html: buildBusinessDocumentTemplateHtml(
            template.file,
            template.name,
            template.description,
            [
              businessDocumentPrefill(subjectRecords.get(subjectSelect.value)),
              customerBinding.value
                ? `客户：${bindingValues.customers.get(customerBinding.value) ?? customerBinding.value}`
                : '',
              orderBinding.value
                ? `销售订单：${bindingValues.orders.get(orderBinding.value)?.name ?? orderBinding.value}`
                : '',
              operatorBinding.value
                ? `经办人：${bindingValues.employees.get(operatorBinding.value) ?? operatorBinding.value}`
                : '',
              salespersonBinding.value
                ? `业务员：${bindingValues.employees.get(salespersonBinding.value) ?? salespersonBinding.value}`
                : '',
              assigneeBinding.value
                ? `下一处理人：${bindingValues.employees.get(assigneeBinding.value) ?? assigneeBinding.value}`
                : '',
            ]
              .filter(Boolean)
              .join('\n'),
            new Date().toLocaleDateString('zh-CN'),
          ),
        },
      }),
    })
      .then((created) => {
        setOperationStatus(selectionStatus, 'success', `已创建“${template.name}”在线文档 V1`);
        openOnlineDocumentEditor(
          created,
          {
            manage: allPermissions.has('business-document:manage'),
            approve: allPermissions.has('business-document:approve'),
            send: allPermissions.has('business-document:send'),
            translate: allPermissions.has('business-document:translate'),
            configure: allPermissions.has('business-document:configure'),
          },
          (currentVersion) => {
            online.disabled = false;
            setOperationStatus(
              selectionStatus,
              'success',
              `“${template.name}”已保存为 V${String(currentVersion)}；关闭编辑窗口后可在“已保存在线文档”中重新打开。`,
            );
          },
        );
        online.disabled = false;
      })
      .catch((failure: unknown) => {
        online.disabled = false;
        setOperationStatus(
          selectionStatus,
          'error',
          failure instanceof Error ? failure.message : '在线文档创建失败',
        );
      });
  });
  return online;
}

function appendTemplateCards(
  routeTemplates: readonly BusinessDocumentTemplate[],
  route: AppRoute,
  allPermissions: ReadonlySet<string>,
  subject: ContextualSubject,
  bindings: ContextualBindings,
  contextualGrid: HTMLElement,
  selectionStatus: HTMLElement,
  ports: ContextualDocumentPorts,
): void {
  for (const template of routeTemplates) {
    const card = el('article', 'contextual-document-card');
    card.append(
      el('span', 'role-task-state', '受控模板'),
      el('strong', '', template.name),
      el('small', '', template.description),
    );
    const actions = el('div', 'contextual-document-actions');
    const use = el('button', 'secondary compact', '下载 Word');
    use.type = 'button';
    const download = document.createElement('a');
    download.className = 'text-button';
    download.href = `/business-templates/${template.file}`;
    download.download = template.file;
    download.textContent = '仅下载';
    use.addEventListener('click', () => {
      for (const sibling of Array.from(contextualGrid.querySelectorAll('article')))
        sibling.classList.remove('selected');
      card.classList.add('selected');
      selectionStatus.textContent = `已下载“${template.name}”Word 交换文件`;
      selectionStatus.dataset.state = 'success';
      download.click();
    });
    if (allPermissions.has('business-document:manage')) {
      actions.append(
        createOnlineDocumentAction(
          template,
          route,
          allPermissions,
          subject,
          bindings,
          selectionStatus,
          ports,
        ),
      );
    }
    actions.append(use, download);
    card.append(actions);
    contextualGrid.append(card);
  }
}

function createSavedDocumentButton(
  item: OnlineBusinessDocument,
  allPermissions: ReadonlySet<string>,
  selectionStatus: HTMLElement,
  ports: ContextualDocumentPorts,
): HTMLButtonElement {
  const { onlineDocumentApi, openOnlineDocumentEditor } = ports;
  const open = el(
    'button',
    'business-document-open',
    `${item.title} · V${String(item.currentVersion)}${item.assigneeName ? ` · 待办：${item.assigneeName}` : ''}`,
  );
  open.type = 'button';
  open.addEventListener('click', () => {
    open.disabled = true;
    void onlineDocumentApi<OnlineBusinessDocument>(`/api/v1/business-documents/${item.id}`)
      .then((full) => {
        openOnlineDocumentEditor(
          full,
          {
            manage: allPermissions.has('business-document:manage'),
            approve: allPermissions.has('business-document:approve'),
            send: allPermissions.has('business-document:send'),
            translate: allPermissions.has('business-document:translate'),
            configure: allPermissions.has('business-document:configure'),
          },
          (currentVersion) => {
            open.textContent = `${item.title} · V${String(currentVersion)}${item.assigneeName ? ` · 待办：${item.assigneeName}` : ''}`;
            setOperationStatus(
              selectionStatus,
              'success',
              `${item.title} 已保存为 V${String(currentVersion)}，仍保留在当前业务页的“已保存在线文档”。`,
            );
          },
        );
        open.disabled = false;
      })
      .catch((failure: unknown) => {
        open.disabled = false;
        setOperationStatus(
          selectionStatus,
          'error',
          failure instanceof Error ? failure.message : '在线文档读取失败',
        );
      });
  });
  return open;
}

function appendSavedDocuments(
  contextualDocuments: HTMLElement,
  route: AppRoute,
  allPermissions: ReadonlySet<string>,
  selectionStatus: HTMLElement,
  ports: ContextualDocumentPorts,
): void {
  const { onlineDocumentRead } = ports;
  if (allPermissions.has('business-document:read')) {
    const savedDocuments = el('div', 'business-document-register');
    savedDocuments.append(el('strong', '', '已保存在线文档'), el('span', 'muted', '正在加载…'));
    void onlineDocumentRead<{ items: readonly OnlineBusinessDocument[] }>(
      `/api/v1/business-documents?route=${encodeURIComponent(route)}`,
    )
      .then((result) => {
        savedDocuments.replaceChildren(el('strong', '', '已保存在线文档'));
        if (result.items.length === 0) {
          savedDocuments.append(el('span', 'muted', '暂无，选择上方模板新建'));
          return;
        }
        for (const item of result.items.slice(0, 8)) {
          savedDocuments.append(
            createSavedDocumentButton(item, allPermissions, selectionStatus, ports),
          );
        }
      })
      .catch((failure: unknown) => {
        savedDocuments.replaceChildren(
          el('strong', '', '已保存在线文档'),
          el('span', 'error', failure instanceof Error ? failure.message : '读取失败'),
        );
      });
    contextualDocuments.append(savedDocuments);
  }
}

export function appendContextualDocuments(
  content: HTMLElement,
  allPermissions: ReadonlySet<string>,
  ports: ContextualDocumentPorts,
): void {
  const { visibleAppRoutes, BUSINESS_DOCUMENT_TEMPLATES, templatesForRoute } = ports;
  const permittedRoutes = visibleAppRoutes(allPermissions);
  const templateRoutes = Array.from(
    new Set(BUSINESS_DOCUMENT_TEMPLATES.flatMap((template) => template.routes)),
  ).filter((route) => permittedRoutes.has(route));
  for (const route of templateRoutes) {
    const routeTemplates = templatesForRoute(route);
    const subject = createContextualSubject(route, allPermissions, ports);
    const { contextualDocuments } = subject;
    const bindings = createContextualBindings(contextualDocuments, allPermissions, ports);
    const contextualGrid = el('div', 'contextual-document-grid');
    const selectionStatus = el(
      'p',
      'operation-status contextual-document-status',
      '请选择本次业务需要的文件',
    );
    selectionStatus.setAttribute('aria-live', 'polite');
    appendTemplateCards(
      routeTemplates,
      route,
      allPermissions,
      subject,
      bindings,
      contextualGrid,
      selectionStatus,
      ports,
    );
    appendSavedDocuments(contextualDocuments, route, allPermissions, selectionStatus, ports);
    contextualDocuments.append(contextualGrid, selectionStatus);
    content.append(contextualDocuments);
  }
}
