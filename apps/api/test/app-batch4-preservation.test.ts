import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Run = { baseline: string; results: { name: string; [key: string]: unknown }[] };
const root = fileURLToPath(new URL('../../../', import.meta.url));
const probe = fileURLToPath(
  new URL('../../../scripts/analysis/app-preservation-probe.mjs', import.meta.url),
);
const run = (mode: string) =>
  JSON.parse(
    execFileSync(process.execPath, ['--experimental-transform-types', probe, mode], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ) as Run;
const baseline = run('baseline');
const current = run('current');
// B2（TD-API-003，行为变更已批）：治理列表 list 调用新增 parsePageFilter(request.query)
// 默认实参 { limit: 50 }（冻结 f3 基线不含该实参）。比对前仅从 trace 的 call 行参数
// 末尾移除该已批实参；其余 trace/响应字段仍与冻结基线逐字段相等。
const isPageFilterArg = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  (value as { limit?: unknown }).limit === 50;
// UI-M2（加性契约已批）：employees.list 新增可选 organization 过滤实参；无过滤时
// 恒为末尾 undefined，比对前同样移除（仅该一处，其余 trace 逐字段相等）。
// JSON 往返后 undefined 呈现为 null：尾参为 null/undefined 且其前恰为 pageFilter
// 默认实参时成对剥离（employees.list 的 UI-M2 organization 过滤；其余 list 不受影响）。
const stripApprovedOrganizationArg = (row: unknown): unknown => {
  if (
    !Array.isArray(row) ||
    row[0] !== 'call' ||
    row[2] !== 'list' ||
    !Array.isArray(row[3]) ||
    (row[3].at(-1) !== null && row[3].at(-1) !== undefined) ||
    !isPageFilterArg(row[3].at(-2))
  )
    return row;
  return ['call', row[1], row[2], row[3].slice(0, -1)];
};
const stripApprovedListArgs = (row: unknown): unknown => {
  // 先剥 UI-M2 组织过滤尾参（undefined），再剥 B2 pageFilter 默认实参。
  const withoutOrganization = stripApprovedOrganizationArg(row);
  if (
    !Array.isArray(withoutOrganization) ||
    withoutOrganization[0] !== 'call' ||
    !Array.isArray(withoutOrganization[3])
  )
    return withoutOrganization;
  const args = withoutOrganization[3] as unknown[];
  return isPageFilterArg(args.at(-1))
    ? ['call', withoutOrganization[1], withoutOrganization[2], args.slice(0, -1)]
    : withoutOrganization;
};
// A-F2a（A2-F8，行为变更已批）：登录路由上下文新增 audit 依赖访问；比对前从 trace
// 移除该已批 ["root","audit"] 行（仅该一处新增访问，其余 trace 逐字段相等）。
const stripApprovedAuditAccess = (row: unknown): boolean =>
  Array.isArray(row) && row.length === 2 && row[0] === 'root' && row[1] === 'audit';
// U3-COM-2/7（ADR-0015 接线，主协调已批）：dispatch 前段新增 dependencies.commercial
// 访问（Fastify 路由组认领门）；仅对 current 侧比对前移除该一处新增访问（首个
// ["root","commercial"] 行）——基线侧不做此剥离（其同键行属冻结基线自身）。
// credit 认领路径（U3-COM-7）复用既有 quoteToCash 依赖引用，未新增根访问行，
// 故无需额外剥离。
const stripApprovedBridgeAccess = (rows: unknown[]): unknown[] => {
  const index = rows.findIndex(
    (row) => Array.isArray(row) && row.length === 2 && row[0] === 'root' && row[1] === 'commercial',
  );
  return index === -1 ? rows : rows.filter((_, at) => at !== index);
};
// TD-API-004（主协调已批，行为变更）：未预期异常此前被 catch 丢弃，现新增一条
// ["log","error","http.request.failed",5xx] 记录。仅对 current 侧比对前移除该已批日志行
//（基线侧没有这一行），仓储抛错的 37 个场景其余 trace 逐字段等于冻结基线。
const stripApprovedFailureLog = (rows: unknown[]): unknown[] =>
  rows.filter(
    (row) => !(Array.isArray(row) && row[0] === 'log' && row[2] === 'http.request.failed'),
  );
const preserve = (result: { name: string; [key: string]: unknown }) => ({
  ...result,
  ...(Array.isArray(result.trace)
    ? {
        trace: result.trace
          .filter((row) => !stripApprovedAuditAccess(row))
          .map((row) => stripApprovedListArgs(row)),
      }
    : {}),
});
describe('Batch4 app extraction against fixed f3 complete request traces', () => {
  it('retains the frozen baseline and every scenario', () => {
    expect(current.baseline).toBe('f3f0c42aa8493f594076c03d3270f0c21de7ba78');
    expect(current.results.map((r) => r.name)).toEqual(baseline.results.map((r) => r.name));
    expect(current.results).toHaveLength(310);
  });
  // U3-COM-7（ADR-0015 接线，主协调已批）：credit 路径四场景（credit-limits/
  // credit-decisions GET/POST）现经生产桥处理——dispatch 组访问顺序发生授权内
  // 根本变化（遗留组探测被桥压缩，仓储调用与响应逐字段守恒）。按 A1-P3/A-F2a
  // 已批 re-pin 先例，四场景比对降级为响应+终止仓储调用（不含中间授权顺序）。
  const CREDIT_REPIN_SCENARIOS = new Set([
    'GET /api/v1/credit-limits',
    'POST /api/v1/credit-limits',
    'GET /api/v1/credit-decisions',
    'POST /api/v1/credit-decisions',
    // U3-CRM-1（同批已批）：线索路径场景经生产桥。GET 两场景原为 f3 冻结遗留缺陷
    //（未认证/解析序崩溃返回 500）——桥轨正确返回 200 空列表，e2e P1 佐证；按
    // A1-P3/A-F2a 已批 re-pin 先例钉定新响应形态。
    'GET /api/v1/leads',
    'GET /api/v1/leads/pool',
    'POST /api/v1/leads',
    'PUT /api/v1/leads',
    // U3-PROC-1（ADR-0015 接线，同批）：suppliers 路径场景经生产桥——桥组注册引入
    // 依赖/授权访问序变化（多组 root/grant 行），响应与终止仓储调用逐字段守恒；
    // GET 终止调用由 list('suppliers') 换为 additive listSupplierPage（同投影/排序）。
    'GET /api/v1/suppliers',
    'POST /api/v1/suppliers',
    // U3-PROC-2（同批）：RFQ 路径场景经生产桥——同 suppliers 口径；GET 终止调用
    // 由 list('rfqs') 换为 additive listRfqs（同投影/排序，页对象形态）。
    'GET /api/v1/procurement-rfqs',
    'POST /api/v1/procurement-rfqs',
    // U3-PROC-3（同批）：采购单路径场景经生产桥——同口径；GET 终止调用由
    // list('orders') 换为 additive listPurchaseOrders（同投影/排序，页对象形态）。
    'GET /api/v1/purchase-orders',
    'POST /api/v1/purchase-orders',
    // U3-PROC-4（同批）：收货单路径场景经生产桥——同口径；GET 终止调用由
    // list('receipts') 换为 additive listGoodsReceipts（同投影/排序，页对象形态）。
    'GET /api/v1/goods-receipts',
    'POST /api/v1/goods-receipts',
    // PROC-6A: the default quote list retains list('quotes') and its response; only bridge access changes.
    'GET /api/v1/supplier-quotes',
    // PROC-6B: movement parsing uses the existing legacy command. The default balance GET
    // has no frozen f3 scenario; inventory-ledger-postgres.integration.test.ts verifies it.
    'POST /api/v1/inventory-movements',
    // U3-MFG-1（同批）：manufacturing-items 路径场景经生产桥——同口径；GET 终止
    // 调用由 list('items') 换为 additive listItemPage（同投影/排序，页对象形态）。
    'GET /api/v1/manufacturing-items',
    'POST /api/v1/manufacturing-items',
    // U3-MFG-2（同批）：manufacturing-boms 路径场景经生产桥——同口径；GET 终止
    // 调用由 list('boms') 换为 additive listBomPage（同投影/排序，页对象形态）。
    'GET /api/v1/manufacturing-boms',
    'POST /api/v1/manufacturing-boms',
    // U3-MFG-3（同批）：manufacturing-routings 路径场景经生产桥——同口径；GET 终止
    // 调用由 list('routings') 换为 additive listRoutingPage（同投影/排序，页对象形态）。
    'GET /api/v1/manufacturing-routings',
    'POST /api/v1/manufacturing-routings',
    // U3-MFG-4（同批）：production-orders 路径场景经生产桥——同口径；GET 终止调用由
    // list 换为 additive listProductionOrderPage（同投影/排序，页对象形态）。
    'GET /api/v1/production-orders',
    'POST /api/v1/production-orders',
    // MFG-6（同批）：MRP 路径场景经生产桥——同口径；GET 终止调用由 list 换为 additive 分页
    // 方法（缺省空过滤 = legacy list 同一条 SQL，页对象形态）；POST 场景的空请求体在两轨上都
    // 止于解析拒绝（不触达仓储），走下方通用比对（响应 + 终止调用）。
    'GET /api/v1/mrp-policies',
    'POST /api/v1/mrp-policies',
    'GET /api/v1/mrp-demands',
    'POST /api/v1/mrp-demands',
    'GET /api/v1/mrp-runs',
    'POST /api/v1/mrp-runs',
    // FIN-1（ADR-0015 接线，同批）：ar-open-items 的 GET / POST 场景经生产桥——同口径；
    // GET 未带加性参数时分派 legacy listOperationalPage（同一条 SQL、同一实参），POST 走
    // legacy qtcArPostRoutes 同解析链；响应与终止仓储调用均与冻结基线逐字段守恒。
    'GET /api/v1/ar-open-items',
    'POST /api/v1/ar-open-items',
    // FIN-2: default lists and both legacy writes retain their terminal calls and responses.
    'GET /api/v1/bank-payments',
    'POST /api/v1/bank-payments',
    'GET /api/v1/reconciliation-runs',
    'POST /api/v1/reconciliation-runs',
    // OPS-1：桥接仍分派原列表 SQL 和原写命令；冻结响应及终止仓储实参逐键比对。
    'GET /api/v1/quality-plans',
    'GET /api/v1/quality-inspections',
    'POST /api/v1/quality-plans',
    'POST /api/v1/quality-inspections',
    // OPS-2：原发货列表与写命令经生产桥，响应和完整终止仓储调用维持冻结对拍。
    'GET /api/v1/shipment-releases',
    'POST /api/v1/shipment-releases',
    ...['list', 'request', 'transition', 'dispatch', 'track'].flatMap((method) =>
      ['ok', 'sync-throw', 'reject', 'scope-change'].map(
        (outcome) => `legacy shipments.${method} ${outcome}`,
      ),
    ),
  ]);
  const preserveWithStrip = (result: {
    name: string;
    [key: string]: unknown;
  }): { name: string; [key: string]: unknown } => {
    const normalized = preserve(result);
    return Array.isArray(normalized.trace)
      ? {
          ...normalized,
          trace: stripApprovedFailureLog(stripApprovedBridgeAccess(normalized.trace)),
        }
      : normalized;
  };
  for (const [index, row] of baseline.results.entries())
    it(row.name, () => {
      const currentRow = current.results[index];
      if (currentRow === undefined) throw new Error('Current scenario result missing');
      if (CREDIT_REPIN_SCENARIOS.has(row.name)) {
        // re-pin 降级：响应 + 终止 call 行（仓储方法与实参）逐字段相等；
        // 中间授权顺序因桥接流程发生根本变化，不在 re-pin 比对内。
        const terminalCalls = (run: unknown): unknown[] => {
          const trace = (run as { trace?: unknown }).trace;
          return Array.isArray(trace)
            ? trace.filter((candidate) => Array.isArray(candidate) && candidate[0] === 'call')
            : [];
        };
        const pinnedCurrent = preserveWithStrip(currentRow) as unknown as {
          response: unknown;
          trace?: unknown[];
          [key: string]: unknown;
        };
        const pinnedBaseline = preserve(row) as unknown as {
          response: unknown;
          trace?: unknown[];
          [key: string]: unknown;
        };
        // U3-CRM-1：f3 冻结的 GET /leads 与 /leads/pool 500 为遗留缺陷——桥轨按
        // 已批迁移语义返回 200 空列表（e2e P1 佐证）；re-pin 钉定新响应形态与
        // 桥轨仓储调用（listLeadPage：actor/COMPANY/空锚/limit=100 默认过滤）。
        // TD-CRM-003（2026-11-26，项目所有者确认的加性字段，主协调授权重钉）：
        // listLeadPage 新增第 5 个实参——最近一次活动的可见范围（探针上下文对任何
        // 能力都返回 COMPANY 授权，故此处为 scopes=['COMPANY']/空锚）。响应形态不变
        //（{ items: [] }）；前四个实参与改前逐字段相同。
        if (row.name === 'GET /api/v1/leads' || row.name === 'GET /api/v1/leads/pool') {
          expect(pinnedCurrent.response).toEqual({
            statusCode: 200,
            body: { items: [] },
            headers: (pinnedBaseline.response as { headers: unknown }).headers,
          });
          expect(terminalCalls(pinnedCurrent)).toEqual([
            [
              'call',
              'crm',
              'listLeadPage',
              [
                {
                  employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                },
                ['COMPANY'],
                [],
                { limit: 100, pool: row.name.endsWith('pool') },
                { scopes: ['COMPANY'], anchors: [] },
              ],
            ],
          ]);
          return;
        }
        // U3-PROC-1：suppliers GET 经生产桥——响应与 legacy 逐字段一致（200
        // {items:[]}）；终止调用钉定桥轨形态（listSupplierPage：company 作用域
        // 上下文 + 默认空过滤=legacy 全量语义）。
        if (
          row.name === 'GET /api/v1/suppliers' ||
          row.name === 'GET /api/v1/procurement-rfqs' ||
          row.name === 'GET /api/v1/purchase-orders' ||
          row.name === 'GET /api/v1/goods-receipts'
        ) {
          expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
          const listMethod =
            row.name === 'GET /api/v1/suppliers'
              ? 'listSupplierPage'
              : row.name === 'GET /api/v1/procurement-rfqs'
                ? 'listRfqs'
                : row.name === 'GET /api/v1/purchase-orders'
                  ? 'listPurchaseOrders'
                  : 'listGoodsReceipts';
          // 收货单不可变事实无筛选窗口——listGoodsReceipts 仅收作用域上下文单参。
          const listArgs =
            row.name === 'GET /api/v1/goods-receipts'
              ? [
                  {
                    actor: {
                      employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                      companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                    },
                    scopes: ['COMPANY'],
                    anchors: [],
                  },
                ]
              : [
                  {
                    actor: {
                      employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                      companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                    },
                    scopes: ['COMPANY'],
                    anchors: [],
                  },
                  {},
                ];
          expect(terminalCalls(pinnedCurrent)).toEqual([
            ['call', 'procurement', listMethod, listArgs],
          ]);
          return;
        }
        // U3-MFG-1：manufacturing-items GET 经生产桥——响应与 legacy 逐字段一致
        // （200 {items:[]}）；终止调用钉定桥轨形态（listItemPage：company 作用域
        // 上下文 + 默认空过滤=legacy 全量语义）。
        if (
          row.name === 'GET /api/v1/manufacturing-items' ||
          row.name === 'GET /api/v1/manufacturing-boms' ||
          row.name === 'GET /api/v1/manufacturing-routings'
        ) {
          expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
          expect(terminalCalls(pinnedCurrent)).toEqual([
            [
              'call',
              'manufacturing',
              row.name.endsWith('items')
                ? 'listItemPage'
                : row.name.endsWith('boms')
                  ? 'listBomPage'
                  : 'listRoutingPage',
              [
                {
                  actor: {
                    employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  },
                  scopes: ['COMPANY'],
                  anchors: [],
                },
                {},
              ],
            ],
          ]);
          return;
        }
        // U3-MFG-4：production-orders GET 经生产桥——响应与 legacy 逐字段一致（200
        // {items:[]}）；终止调用钉定桥轨形态（listProductionOrderPage：company 作用域
        // 上下文 + 默认空过滤=legacy 全量语义，走与 legacy list 同一条 SQL）。
        if (row.name === 'GET /api/v1/production-orders') {
          expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
          expect(terminalCalls(pinnedCurrent)).toEqual([
            [
              'call',
              'production',
              'listProductionOrderPage',
              [
                {
                  actor: {
                    employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  },
                  scopes: ['COMPANY'],
                  anchors: [],
                },
                {},
              ],
            ],
          ]);
          return;
        }
        // MFG-6：mrp GET 经生产桥——响应与 legacy 逐字段一致（200 {items:[]}）；终止调用钉定
        // 桥轨形态（缺省空过滤 = legacy list 同一条 SQL）。
        if (
          row.name.startsWith('GET /api/v1/mrp-') &&
          (row.name.endsWith('/mrp-policies') ||
            row.name.endsWith('/mrp-demands') ||
            row.name.endsWith('/mrp-runs'))
        ) {
          expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
          expect(terminalCalls(pinnedCurrent)).toEqual([
            [
              'call',
              'mrp',
              row.name.endsWith('policies')
                ? 'listPolicyPage'
                : row.name.endsWith('demands')
                  ? 'listDemandPage'
                  : 'listRunPage',
              [
                {
                  actor: {
                    employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  },
                  scopes: ['COMPANY'],
                  anchors: [],
                },
                {},
              ],
            ],
          ]);
          return;
        }
        // FIN-1：ar-open-items GET 经生产桥——响应与冻结基线逐字段一致（200 {items:[]}）；
        // 终止调用仍是 legacy listOperationalPage('ar', { limit: 50 }, 作用域上下文)（旧轨同链，
        // 未带加性参数时不触达加性方法），与冻结基线的终止调用逐字段相等。POST 走同解析链，
        // 空对象请求在 documentType 处被 400 拒绝，不触达仓储（终止调用为空）。
        if (row.name === 'GET /api/v1/ar-open-items' || row.name === 'POST /api/v1/ar-open-items') {
          expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
          expect(terminalCalls(pinnedCurrent)).toEqual(terminalCalls(pinnedBaseline));
          expect(terminalCalls(pinnedCurrent)).toEqual(
            row.name === 'GET /api/v1/ar-open-items'
              ? [
                  [
                    'call',
                    'quoteToCash',
                    'listOperationalPage',
                    [
                      'ar',
                      { limit: 50 },
                      {
                        actor: {
                          employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                          companyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                        },
                        scopes: ['COMPANY'],
                        anchors: [],
                      },
                    ],
                  ],
                ]
              : [],
          );
          return;
        }
        expect(pinnedCurrent.response).toEqual(pinnedBaseline.response);
        expect(terminalCalls(pinnedCurrent)).toEqual(terminalCalls(pinnedBaseline));
        return;
      }
      expect(preserveWithStrip(currentRow)).toEqual(preserve(row));
    });
});
