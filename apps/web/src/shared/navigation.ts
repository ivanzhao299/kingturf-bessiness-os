export type AppRoute =
  | 'overview'
  | 'document-templates'
  | 'leads'
  | 'customers'
  | 'opportunities'
  | 'technical-requirements'
  | 'technical-solutions'
  | 'costing'
  | 'sales-policies'
  | 'quotes'
  | 'credit-review'
  | 'contracts'
  | 'sales-orders'
  | 'order-360'
  | 'receivables'
  | 'collections'
  | 'payments'
  | 'commissions'
  | 'business-risks'
  | 'manufacturing-master'
  | 'procurement'
  | 'material-planning'
  | 'production-orders'
  | 'quality-inspection'
  | 'shipments'
  | 'governance';

export const APP_ROUTE_LABELS: Readonly<Record<AppRoute, string>> = {
  overview: '经营总览',
  'document-templates': '业务文档库',
  leads: '销售线索',
  customers: '客户管理',
  opportunities: '销售商机',
  'technical-requirements': '技术需求',
  'technical-solutions': '技术方案',
  costing: '成本核算',
  'sales-policies': '销售政策',
  quotes: '销售报价',
  'credit-review': '信用审查',
  contracts: '合同管理',
  'sales-orders': '销售订单',
  'order-360': '订单全景',
  receivables: '应收账款',
  collections: '催收与法务',
  payments: '收款与核销',
  commissions: '销售佣金',
  'business-risks': '业务风险',
  'manufacturing-master': '制造主数据',
  procurement: '采购管理',
  'material-planning': '物料计划',
  'production-orders': '生产执行',
  'quality-inspection': '质量检验',
  shipments: '发货与签收',
  governance: '系统管理与治理',
};
const APP_ROUTE_DESCRIPTIONS: Readonly<Record<AppRoute, string>> = {
  overview: '指标、待办与经营异常',
  'document-templates': '技术、采购、合同、质量与交付模板',
  leads: '线索认领、分配与跟进',
  customers: '客户档案、联系人与活动',
  opportunities: '商机阶段、金额与赢率',
  'technical-requirements': '产品规格与工程条件',
  'technical-solutions': '方案版本与技术依据',
  costing: '成本模型、明细与差异',
  'sales-policies': '毛利、折扣与审批规则',
  quotes: '报价版本、毛利与签发',
  'credit-review': '客户额度与信用敞口',
  contracts: '合同版本、条款与签署',
  'sales-orders': '订单创建、释放与状态',
  'order-360': '订单全链路与业务证据',
  receivables: '应收余额、账龄与到期',
  collections: '催收承诺、升级与法务移交',
  payments: '银行收款、认领与核销',
  commissions: '佣金计提、释放与支付',
  'business-risks': '风险评价、责任与处置',
  'manufacturing-master': '物料、BOM 与工艺路线',
  procurement: '供应商、询价、采购与收货',
  'material-planning': '需求运算、库存抵扣与建议',
  'production-orders': '工单、用料、报工与入库',
  'quality-inspection': '检验、处置与批次追溯',
  shipments: '发货门禁、物流与签收',
  governance: '组织、权限与平台配置',
};

export const routeViewSelector = (route: AppRoute): string => `[data-route-view~="${route}"]`;

const APP_ROUTES = new Set<AppRoute>(Object.keys(APP_ROUTE_LABELS) as AppRoute[]);

export function appRouteFromHash(hash: string): AppRoute {
  const candidate = hash.replace(/^#\/?/u, '') as AppRoute;
  return APP_ROUTES.has(candidate) ? candidate : 'overview';
}

function applyRouteVisibility(
  root: HTMLElement,
  route = appRouteFromHash(
    typeof globalThis.location === 'undefined' ? '' : globalThis.location.hash,
  ),
): void {
  const views = [root, ...Array.from(root.querySelectorAll<HTMLElement>('[data-route-view]'))];
  for (const view of views) {
    const routes = view.getAttribute('data-route-view');
    if (routes) view.hidden = !routes.split(/\s+/u).includes(route);
  }
}

const navigationDisposers = new WeakMap<HTMLElement, () => void>();

function setAppRoute(route: AppRoute): void {
  if (typeof globalThis.location === 'undefined') return;
  const hash = `#/${route}`;
  if (globalThis.location.hash !== hash) globalThis.location.hash = hash;
}

export function installAppNavigation(shell: HTMLElement): void {
  navigationDisposers.get(shell)?.();
  const events = new AbortController();
  const availableRoutes = new Set(
    Array.from(shell.querySelectorAll<HTMLElement>('[data-app-route]')).map(
      (item) => item.dataset.appRoute as AppRoute,
    ),
  );
  const fallbackRoute = availableRoutes.values().next().value;
  const allowedRoute = (requested: AppRoute): AppRoute | undefined =>
    availableRoutes.has(requested) ? requested : fallbackRoute;
  const apply = (route: AppRoute) => {
    for (const item of Array.from(shell.querySelectorAll<HTMLElement>('[data-app-route]'))) {
      const active = item.dataset.appRoute === route;
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    }
    for (const parent of Array.from(shell.querySelectorAll<HTMLElement>('[data-nav-routes]'))) {
      const routes = (parent.dataset.navRoutes ?? '').split(/\s+/u);
      const active = routes.includes(route);
      const group = parent.parentElement;
      parent.classList.toggle('active', active);
      group?.classList.toggle('active-domain', active);
      if (active) {
        group?.classList.add('open');
        parent.setAttribute('aria-expanded', 'true');
      }
    }
    applyRouteVisibility(shell, route);
    const routeContext = shell.querySelector<HTMLElement>('[data-route-context]');
    if (routeContext) {
      routeContext.hidden = route === 'overview';
      const heading = routeContext.querySelector<HTMLElement>('h1');
      const description = routeContext.querySelector<HTMLElement>('.page-subtitle');
      const breadcrumb = routeContext.querySelector<HTMLElement>('.eyebrow');
      if (heading) heading.textContent = APP_ROUTE_LABELS[route];
      if (description) description.textContent = APP_ROUTE_DESCRIPTIONS[route];
      if (breadcrumb) breadcrumb.textContent = `金特夫业务系统 · ${APP_ROUTE_LABELS[route]}`;
    }
    const utilityContext = shell.querySelector<HTMLElement>('[data-utility-context]');
    if (utilityContext) utilityContext.textContent = APP_ROUTE_LABELS[route];
    const placeholder = shell.querySelector<HTMLElement>('[data-route-placeholder]');
    if (!placeholder) return;
    const hasView = Array.from(shell.querySelectorAll<HTMLElement>('[data-route-view]')).some(
      (view) => !view.hidden && (view.dataset.routeView ?? '').split(/\s+/u).includes(route),
    );
    placeholder.hidden = hasView;
    placeholder.textContent = `${APP_ROUTE_LABELS[route]}：当前账号在本模块暂无可用功能，请联系权限管理员核对岗位职责。`;
  };
  for (const item of Array.from(shell.querySelectorAll<HTMLElement>('[data-app-route]'))) {
    item.addEventListener(
      'click',
      () => {
        setAppRoute(item.dataset.appRoute as AppRoute);
      },
      { signal: events.signal },
    );
  }
  const initial =
    typeof globalThis.location === 'undefined'
      ? 'overview'
      : appRouteFromHash(globalThis.location.hash);
  const initialAllowed = allowedRoute(initial);
  if (initialAllowed === undefined) return;
  apply(initialAllowed);
  if (initialAllowed !== initial) setAppRoute(initialAllowed);
  const observer = new MutationObserver(() => {
    if (!shell.isConnected) return;
    const route = allowedRoute(appRouteFromHash(globalThis.location.hash));
    if (route) applyRouteVisibility(shell, route);
  });
  observer.observe(shell, { childList: true, subtree: true });
  const dispose = () => {
    events.abort();
    observer.disconnect();
    navigationDisposers.delete(shell);
  };
  navigationDisposers.set(shell, dispose);
  globalThis.addEventListener(
    'hashchange',
    () => {
      if (!shell.isConnected) {
        dispose();
        return;
      }
      const requested = appRouteFromHash(globalThis.location.hash);
      const allowed = allowedRoute(requested);
      if (allowed === undefined) return;
      apply(allowed);
      if (allowed !== requested) setAppRoute(allowed);
    },
    { signal: events.signal },
  );
}

export {
  APP_ROUTE_DESCRIPTIONS,
  APP_ROUTES,
  applyRouteVisibility,
  navigationDisposers,
  setAppRoute,
};
