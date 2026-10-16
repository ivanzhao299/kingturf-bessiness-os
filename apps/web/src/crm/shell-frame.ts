import { el } from '../dom';
import { brandMark } from '../brand';
import { openForm } from '../shared/forms';
import {
  APP_ROUTE_LABELS,
  APP_ROUTE_DESCRIPTIONS,
  appRouteFromHash,
  setAppRoute,
  type AppRoute,
} from '../shared/navigation';
import type { Viewport, RoleWorkspaceProfile, NavIconName } from '../shared/shell-types';
import { visibleCrmSections, type CrmController } from './controller';

type ShellFramePorts = Readonly<{
  viewportFor: (width: number) => Viewport;
  visibleAppRoutes: (permissions: ReadonlySet<string>) => ReadonlySet<AppRoute>;
  roleWorkspaceProfile: (permissions: ReadonlySet<string>) => RoleWorkspaceProfile;
  navIcon: (name: NavIconName) => HTMLElement;
  bootstrapView: (shell: HTMLElement, controller: CrmController) => void;
}>;

export function createShellSidebar(
  controller: CrmController,
  width: number,
  allPermissions: ReadonlySet<string>,
  ports: ShellFramePorts,
) {
  const { viewportFor, visibleAppRoutes, roleWorkspaceProfile, navIcon } = ports;
  let viewportWidth = width;
  const sections = visibleCrmSections(controller.permissions);
  const shell = el('main', `app-shell ${viewportFor(viewportWidth)}`);
  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = globalThis.localStorage.getItem('kingturf.sidebar.collapsed') === 'true';
  } catch {
    sidebarCollapsed = false;
  }
  const renderSidebarState = () => {
    shell.className = `app-shell ${viewportFor(viewportWidth)}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`;
    const workspace = shell.querySelector<HTMLElement>('.commercial-workspace');
    if (workspace) {
      workspace.classList.remove('desktop', 'tablet', 'mobile');
      workspace.classList.add(viewportFor(viewportWidth));
    }
  };
  renderSidebarState();
  const resizeTarget = globalThis as unknown as {
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
  const handleViewportResize = () => {
    if (!shell.isConnected) {
      resizeTarget.removeEventListener?.('resize', handleViewportResize);
      return;
    }
    viewportWidth = globalThis.innerWidth || viewportWidth;
    renderSidebarState();
  };
  resizeTarget.addEventListener?.('resize', handleViewportResize);
  const aside = el('aside', 'sidebar');
  const brand = el('div', 'brand-lockup');
  const brandLogoFrame = el('span', 'brand-logo-frame');
  const brandLogo = document.createElement('img');
  brandLogo.className = 'brand-logo';
  brandLogo.src = brandMark;
  brandLogo.alt = '';
  brandLogo.width = 512;
  brandLogo.height = 512;
  const brandIdentity = el('span', 'brand-identity');
  brandIdentity.append(
    el('strong', 'brand-name', '金特夫'),
    el('small', 'brand-english', 'KING TURF'),
  );
  brandLogoFrame.setAttribute('aria-label', '金特夫 King Turf');
  brandLogoFrame.append(brandLogo, brandIdentity);
  brand.append(brandLogoFrame);
  const sidebarToggle = el('button', 'sidebar-toggle');
  sidebarToggle.type = 'button';
  const renderSidebarToggle = () => {
    sidebarToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${sidebarCollapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'}"></path></svg>`;
    sidebarToggle.setAttribute('aria-label', sidebarCollapsed ? '展开左侧导航' : '收起左侧导航');
    sidebarToggle.setAttribute('title', sidebarCollapsed ? '展开导航' : '收起导航');
    sidebarToggle.setAttribute('aria-expanded', String(!sidebarCollapsed));
  };
  renderSidebarToggle();
  sidebarToggle.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    renderSidebarState();
    renderSidebarToggle();
    try {
      globalThis.localStorage.setItem('kingturf.sidebar.collapsed', String(sidebarCollapsed));
    } catch {
      // The visible state still works when storage is unavailable.
    }
  });
  aside.append(brand);
  const nav = el('nav');
  const visibleRoutes = visibleAppRoutes(allPermissions);
  const roleProfile = roleWorkspaceProfile(allPermissions);
  const currentRoute =
    typeof globalThis.location === 'undefined'
      ? 'overview'
      : appRouteFromHash(globalThis.location.hash);
  const navGroup = (
    title: string,
    domainIcon: NavIconName,
    items: readonly [NavIconName, string, AppRoute][],
  ) => {
    const visibleItems = items.filter(([, , route]) => visibleRoutes.has(route));
    if (visibleItems.length === 0) return;
    const routes = visibleItems.map(([, , route]) => route);
    const group = el(
      'section',
      `nav-group${routes.includes(currentRoute) ? ' open active-domain' : ''}`,
    );
    const childrenId = `nav-domain-${routes[0] ?? 'available'}`;
    const parent = el('button', 'nav-parent');
    parent.type = 'button';
    parent.title = title;
    parent.setAttribute('data-nav-routes', routes.join(' '));
    parent.setAttribute('aria-controls', childrenId);
    parent.setAttribute('aria-expanded', String(routes.includes(currentRoute)));
    const parentIcon = el('span', 'nav-glyph');
    parentIcon.append(navIcon(domainIcon));
    parent.append(parentIcon, el('span', 'nav-text', title), el('span', 'nav-parent-chevron', '›'));
    const children = el('div', 'nav-children');
    children.id = childrenId;
    parent.addEventListener('click', () => {
      if (sidebarCollapsed) {
        sidebarCollapsed = false;
        renderSidebarState();
        renderSidebarToggle();
      }
      const open = !group.classList.contains('open');
      group.classList.toggle('open', open);
      parent.setAttribute('aria-expanded', String(open));
    });
    for (const [icon, label, route] of visibleItems) {
      const item = el('button', `nav-item${currentRoute === route ? ' active' : ''}`);
      item.title = label;
      item.setAttribute('data-app-route', route);
      item.setAttribute('aria-current', currentRoute === route ? 'page' : 'false');
      item.addEventListener('click', () => {
        setAppRoute(route);
      });
      const iconBox = el('span', 'nav-glyph');
      iconBox.append(navIcon(icon));
      item.append(iconBox, el('span', 'nav-text', label));
      children.append(item);
    }
    group.append(parent, children);
    nav.append(group);
  };
  navGroup('经营管理', 'overview', [['overview', '经营总览', 'overview']]);
  navGroup('业务文档', 'operations', [['operations', '业务文档库', 'document-templates']]);
  navGroup('客户与商机', 'sales', [
    ['opportunities', '销售线索', 'leads'],
    ['customers', '客户管理', 'customers'],
    ['opportunities', '销售商机', 'opportunities'],
  ]);
  navGroup('技术与报价', 'cost', [
    ['opportunities', '技术需求', 'technical-requirements'],
    ['operations', '技术方案', 'technical-solutions'],
    ['cost', '成本核算', 'costing'],
    ['cost', '销售政策', 'sales-policies'],
    ['contracts', '销售报价', 'quotes'],
  ]);
  navGroup('合同与订单', 'contracts', [
    ['receivables', '信用审查', 'credit-review'],
    ['contracts', '合同管理', 'contracts'],
    ['contracts', '销售订单', 'sales-orders'],
    ['overview', '订单全景', 'order-360'],
  ]);
  navGroup('财务与风控', 'receivables', [
    ['receivables', '应收账款', 'receivables'],
    ['receivables', '催收与法务', 'collections'],
    ['receivables', '收款与核销', 'payments'],
    ['cost', '销售佣金', 'commissions'],
    ['quality', '业务风险', 'business-risks'],
  ]);
  navGroup('供应链与生产', 'production', [
    ['operations', '制造主数据', 'manufacturing-master'],
    ['delivery', '采购管理', 'procurement'],
    ['production', '物料计划', 'material-planning'],
    ['production', '生产执行', 'production-orders'],
  ]);
  navGroup('质量与交付', 'quality', [
    ['quality', '质量检验', 'quality-inspection'],
    ['delivery', '发货与签收', 'shipments'],
  ]);
  navGroup('系统管理', 'governance', [['governance', '组织、权限与配置', 'governance']]);
  aside.append(nav);
  return { shell, aside, sidebarToggle, sections, visibleRoutes, roleProfile, currentRoute };
}

export function createShellOverview(
  frame: ReturnType<typeof createShellSidebar>,
  controller: CrmController,
  allPermissions: ReadonlySet<string>,
  profileLabel: string,
  ports: ShellFramePorts,
): HTMLElement {
  const { shell, aside, sidebarToggle, sections, visibleRoutes, roleProfile, currentRoute } = frame;
  const { bootstrapView } = ports;
  const sidebarFooter = el('div', 'sidebar-footer');
  sidebarFooter.append(el('span', 'online-dot'), el('span', '', '生产环境 · erp.kingturf.cn'));
  aside.append(sidebarFooter);
  const content = el('section', 'workspace');
  const utility = el('header', 'utility-bar');
  const utilityLeading = el('div', 'utility-leading');
  const utilityContext = el('span', 'utility-context', APP_ROUTE_LABELS[currentRoute]);
  utilityContext.setAttribute('data-utility-context', 'true');
  utilityLeading.append(sidebarToggle, utilityContext);
  const search = el('button', 'global-search');
  search.type = 'button';
  search.setAttribute('aria-label', '进入客户与业务查询');
  search.append(
    el('span', 'search-symbol', '⌕'),
    el('span', '', '搜索客户、订单或业务编号'),
    el('span', 'search-action', '进入查询'),
  );
  search.addEventListener('click', () => {
    setAppRoute('customers');
  });
  const profile = el('div', 'profile-chip');
  profile.append(
    el('span', 'profile-avatar', profileLabel.slice(0, 1)),
    el('span', '', profileLabel),
    el('span', 'profile-role', roleProfile.title),
  );
  utility.append(utilityLeading, search, profile);
  content.append(utility);
  const routeContext = el('header', 'route-context-header');
  routeContext.setAttribute('data-route-context', 'true');
  routeContext.hidden = currentRoute === 'overview';
  routeContext.append(
    el('p', 'eyebrow', `金特夫业务系统 · ${APP_ROUTE_LABELS[currentRoute]}`),
    el('h1', '', APP_ROUTE_LABELS[currentRoute]),
    el('p', 'page-subtitle', APP_ROUTE_DESCRIPTIONS[currentRoute]),
  );
  content.append(routeContext);
  const header = el('header', 'topbar');
  const title = el('div');
  const today = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
  title.append(el('p', 'eyebrow', `经营总览 · ${today}`), el('h1', '', '经营概览'));
  title.append(el('p', 'page-subtitle', '经营指标、重点待办与异常事项'));
  header.append(title);
  if (sections.customerCreate) {
    const create = el('button', 'primary', '＋ 新建客户');
    create.addEventListener('click', () => {
      openForm(
        shell,
        '新建客户',
        '建立客户主档后，可继续补充联系人、商机和跟进活动。',
        [
          {
            name: 'name',
            label: '客户名称',
            required: true,
            placeholder: '例如：华东体育设施有限公司',
            minLength: 2,
            maxLength: 120,
          },
          {
            name: 'customerNumber',
            label: '客户编号',
            required: true,
            placeholder: '例如：CUS-2026-001',
            minLength: 3,
            maxLength: 64,
            hint: '建议使用公司统一的客户编码规则。',
          },
          { name: 'tags', label: '客户标签', placeholder: '多个标签用逗号分隔' },
        ],
        '创建客户',
        async (values) => {
          await controller.createCustomer({
            name: values.name ?? '',
            customerNumber: values.customerNumber ?? '',
            tags: (values.tags ?? '')
              .split(/[,，]/u)
              .map((tag) => tag.trim())
              .filter(Boolean),
          });
          bootstrapView(shell, controller);
        },
      );
    });
    header.append(create);
  }
  content.append(header);
  header.setAttribute('data-route-view', 'overview');
  const roleHome = el('section', 'role-home');
  roleHome.setAttribute('data-route-view', 'overview');
  const roleHomeHead = el('header', 'role-home-head');
  const roleHomeCopy = el('div');
  roleHomeCopy.append(
    el('p', 'eyebrow', '我的岗位工作台'),
    el('h2', '', roleProfile.title),
    el('p', 'muted', roleProfile.description),
  );
  const domainList = el('div', 'role-domain-list');
  for (const domain of roleProfile.domains) domainList.append(el('span', 'role-domain', domain));
  roleHomeHead.append(roleHomeCopy, domainList);
  roleHome.append(roleHomeHead);
  const roleTaskGrid = el('div', 'role-task-grid');
  for (const route of visibleRoutes) {
    if (route === 'overview') continue;
    const task = el('button', 'role-task');
    task.type = 'button';
    task.setAttribute('data-role-task-route', route);
    task.addEventListener('click', () => {
      setAppRoute(route);
    });
    task.append(
      el('span', 'role-task-state', '可处理'),
      el('strong', '', APP_ROUTE_LABELS[route]),
      el('small', '', APP_ROUTE_DESCRIPTIONS[route]),
      el('span', 'role-task-count', '正在汇总当前岗位数据…'),
      el('span', 'role-task-action', '进入工作台 →'),
    );
    roleTaskGrid.append(task);
  }
  if (roleTaskGrid.children.length === 0)
    roleTaskGrid.append(el('p', 'empty', '当前岗位暂无可处理业务入口'));
  roleHome.append(roleTaskGrid);
  content.append(roleHome);
  const metrics = el('section', 'metrics');
  metrics.setAttribute('data-route-view', 'overview');
  for (const [label, metric, note, tone] of [
    ['本月销售预测', '¥ 0', '等待商机数据', 'emerald'],
    ['活跃线索', String(controller.visibleLeads().length), '需持续推进', 'blue'],
    ['待审批事项', '0', '当前无阻塞', 'amber'],
    ['应收余额', '¥ 0', '回款风险正常', 'violet'],
  ] as const) {
    const card = el('article', `metric ${tone}`);
    card.append(el('span', 'metric-label', label), el('strong', '', metric), el('small', '', note));
    metrics.append(card);
  }
  if (allPermissions.has('executive-dashboard:read')) content.append(metrics);
  const flow = el('section', 'panel business-flow');
  flow.setAttribute('data-route-view', 'overview');
  const flowHead = el('div', 'panel-head');
  flowHead.append(el('div', '', '销售到回款主链'), el('span', 'flow-caption', '端到端业务进度'));
  flow.append(flowHead);
  const flowRail = el('div', 'flow-rail');
  for (const [index, label] of [
    '线索',
    '客户',
    '商机',
    '技术需求',
    '报价',
    '合同',
    '订单',
    '回款',
  ].entries()) {
    const step = el('div', `flow-step${index === 0 ? ' current' : ''}`);
    step.append(el('span', 'flow-node', String(index + 1)), el('span', '', label));
    flowRail.append(step);
  }
  flow.append(flowRail);
  if (allPermissions.has('executive-dashboard:read')) content.append(flow);
  return content;
}
