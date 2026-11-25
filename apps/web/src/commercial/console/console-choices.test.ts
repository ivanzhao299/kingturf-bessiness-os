// TD-WF-007（写流程冒烟 WS-P2-04）：表单下拉选项是页面挂载时的快照。各宿主在挂载时从 controller.views
// 算出选项后不再更新——刚建的供应商在采购订单表单里选不到、刚签发的订单在收货表单里选不到、刚发布的
// 物料在 BOM 表单里选不到。现在选项按最新视图计算：控制台每次写操作后都会经 refresh 端口重读全部视图，
// 之后打开表单拿到的就是当前快照里的选项。
// 宿主把 ports 经动态 import 交给 mountCommercialConsole；这里把 mount 换成替身，取回 ports 直接读选项。
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreditContractViewContext } from '../credit-contract-view-ports';
import type { OperationsViewContext } from '../operations-view-ports';
import { appendCreditConsole, appendLeadConsole } from '../console-entry';
import { CrmController } from '../../crm/controller';
import type { CrmApi, Employee } from '../../crm/types';
import { CommercialController } from '../store/controller';
import type { CommercialApi } from '../types';
import { appendManufacturingBomConsole } from './bom-host';
import { itemVersionChoicesOf, ITEM_VERSIONS_PATH, perView } from './console-choices';
import { appendGoodsReceiptConsole } from './gr-host';
import { mountCommercialConsole } from './mount';
import { appendPurchaseOrderConsole } from './po-host';
import { appendRfqConsole } from './rfq-host';
import { appendManufacturingRoutingConsole } from './routing-host';
import { appendSupplierConsole } from './supplier-host';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';

vi.mock('./mount', () => ({ mountCommercialConsole: vi.fn() }));

type Row = Record<string, unknown>;
type Views = Map<string, readonly Row[]>;

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const recordText = (
  record: Record<string, unknown>,
  camel: string,
  snake: string,
  fallback = '',
): string => {
  const value = record[camel] ?? record[snake] ?? fallback;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
};

const item = (id: string, sku: string, status: string, itemType = 'RAW_MATERIAL'): Row => ({
  id,
  itemId: `root-${sku}`,
  sku,
  name: `${sku}-名称`,
  status,
  itemType,
  version: 1,
});

/** 造一份宿主用的上下文：视图表可变（模拟 controller.load 之后换了新数组）。 */
const contextFor = (views: Views) => {
  const scope = installGlobalTestDom();
  // 宿主按浏览器 HTMLElement 使用 workspace；测试 DOM double 结构上够用。
  const workspace = scope.document.createElement('div') as unknown as HTMLElement;
  const ports = {
    recordText,
    textValue: (value: unknown, fallback = ''): string =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    recordValue: (value: unknown): Row =>
      typeof value === 'object' && value !== null ? (value as Row) : {},
    displayMoney: (currency: unknown, value: unknown) => `${String(currency)} ${String(value)}`,
    decimalValue: (value: number) => String(value),
    currencyLabel: (value: unknown) => String(value),
    inventoryLocationOption: (row: Row) => ({
      value: recordText(row, 'code', 'code'),
      label: recordText(row, 'name', 'name', recordText(row, 'code', 'code')),
    }),
    businessStateLabel: (value: unknown) => String(value),
  };
  const context = {
    workspace,
    status: scope.document.createElement('p'),
    controller: {
      views,
      opportunities: [],
      customers: [],
      employees: [],
      message: '',
      api: {},
      submit: () => Promise.resolve(),
      load: () => Promise.resolve(),
    },
    permissions: new Set<string>(),
    ports,
  } as unknown as OperationsViewContext;
  return { context, workspace };
};

/** 取回宿主交给 mount 的 ports：宿主先挂 section 再动态 import，section 连在文档上才会挂载。 */
const portsOf = async (workspace: HTMLElement): Promise<Record<string, unknown>> => {
  const host = workspace as unknown as TestElement;
  for (const section of host.querySelectorAll('section'))
    (section as unknown as { isConnected: boolean }).isConnected = true;
  await flush();
  await flush();
  const mount = vi.mocked(mountCommercialConsole);
  expect(mount).toHaveBeenCalledTimes(1);
  const handed = mount.mock.calls[0]?.[1] as unknown as Readonly<{
    ports: Record<string, unknown>;
  }>;
  return handed.ports;
};

const labels = (choices: unknown): readonly string[] =>
  (choices as readonly Readonly<{ label: string }>[]).map((choice) => choice.label);

afterEach(() => {
  vi.mocked(mountCommercialConsole).mockReset();
});

describe('console-choices：按最新视图计算的选项', () => {
  it('perView：同一份视图数组只算一次，数组换了才重算', () => {
    const views: Views = new Map([['/x', [{ id: 'a' }]]]);
    const build = vi.fn((rows: readonly Row[]) => rows.map((row) => String(row.id)));
    const read = perView(views, '/x', build);
    expect(read()).toEqual(['a']);
    expect(read()).toEqual(['a']);
    expect(build).toHaveBeenCalledTimes(1);
    // controller.load 重读后换了一个新数组（哪怕内容一样）。
    views.set('/x', [{ id: 'a' }, { id: 'b' }]);
    expect(read()).toEqual(['a', 'b']);
    expect(build).toHaveBeenCalledTimes(2);
    views.delete('/x');
    expect(read()).toEqual([]);
  });

  it('itemVersionChoicesOf：只取已发布版本，value 是版本行 id，label 是「SKU · 名称」', () => {
    const choices = itemVersionChoicesOf(
      [
        item('v-draft', 'RM-DRAFT', 'DRAFT'),
        item('v-yarn', 'RM-KT-YARN-12000', 'PUBLISHED'),
        item('v-pro', 'FG-KT-PRO-50', 'PUBLISHED', 'FINISHED_GOOD'),
      ],
      recordText,
    );
    expect(choices).toEqual([
      {
        value: 'v-yarn',
        label: 'RM-KT-YARN-12000 · RM-KT-YARN-12000-名称',
        itemId: 'root-RM-KT-YARN-12000',
      },
      {
        value: 'v-pro',
        label: 'FG-KT-PRO-50 · FG-KT-PRO-50-名称',
        itemId: 'root-FG-KT-PRO-50',
      },
    ]);
  });
});

describe('宿主的表单选项随视图更新（TD-WF-007）', () => {
  const PUBLISHED = [item('v-yarn', 'RM-KT-YARN-12000', 'PUBLISHED')];

  it('供应商与询价宿主：别处刚发布的物料出现在物料版本下拉里', async () => {
    for (const append of [appendSupplierConsole, appendRfqConsole]) {
      vi.mocked(mountCommercialConsole).mockReset();
      const views: Views = new Map([[ITEM_VERSIONS_PATH, [...PUBLISHED]]]);
      const { context, workspace } = contextFor(views);
      append(context, workspace);
      const ports = await portsOf(workspace);
      expect(labels(ports.itemVersionChoices)).toEqual([
        'RM-KT-YARN-12000 · RM-KT-YARN-12000-名称',
      ]);
      views.set(ITEM_VERSIONS_PATH, [...PUBLISHED, item('v-new', 'RM-E2EWS-NEW', 'PUBLISHED')]);
      expect(labels(ports.itemVersionChoices)).toEqual([
        'RM-KT-YARN-12000 · RM-KT-YARN-12000-名称',
        'RM-E2EWS-NEW · RM-E2EWS-NEW-名称',
      ]);
    }
  });

  it('采购订单宿主：在供应商页新建的供应商出现在供应商下拉里', async () => {
    const suppliers = '/api/v1/suppliers';
    const views: Views = new Map([
      [suppliers, [{ id: 's-1', supplier_number: 'SUP-1', name: '草纱供应商' }]],
    ]);
    const { context, workspace } = contextFor(views);
    appendPurchaseOrderConsole(context, workspace);
    const ports = await portsOf(workspace);
    expect(labels(ports.supplierChoices)).toEqual(['SUP-1 · 草纱供应商']);
    // 供应商控制台写操作之后 controller.load 重读：新的数组里多了刚建的那家。
    views.set(suppliers, [
      { id: 's-1', supplier_number: 'SUP-1', name: '草纱供应商' },
      { id: 's-2', supplier_number: 'SUP-E2EWS', name: 'E2E写流程冒烟供应商' },
    ]);
    expect(labels(ports.supplierChoices)).toEqual([
      'SUP-1 · 草纱供应商',
      'SUP-E2EWS · E2E写流程冒烟供应商',
    ]);
  });

  it('收货宿主：刚签发的订单行出现在「采购订单行」下拉里；收齐后消失', async () => {
    const orders = '/api/v1/purchase-orders';
    const line = { id: 'l-1', sku: 'RM-KT-YARN-12000', quantity: '800', receivedQuantity: '0' };
    const views: Views = new Map([[orders, []]]);
    const { context, workspace } = contextFor(views);
    appendGoodsReceiptConsole(context, workspace);
    const ports = await portsOf(workspace);
    expect(ports.openOrderLineChoices).toEqual([]);
    views.set(orders, [{ id: 'po-1', po_number: 'PO-E2EWS', status: 'ISSUED', lines: [line] }]);
    expect(ports.openOrderLineChoices).toEqual([
      { value: 'po-1|l-1', label: 'PO-E2EWS · RM-KT-YARN-12000 · 未收 800' },
    ]);
    views.set(orders, [{ id: 'po-1', po_number: 'PO-E2EWS', status: 'RECEIVED', lines: [line] }]);
    expect(ports.openOrderLineChoices).toEqual([]);
  });

  it('BOM 与工艺路线宿主：刚发布的物料进成品 / 组件下拉，左树也认得它的产品类型', async () => {
    for (const append of [appendManufacturingBomConsole, appendManufacturingRoutingConsole]) {
      vi.mocked(mountCommercialConsole).mockReset();
      const views: Views = new Map([[ITEM_VERSIONS_PATH, [...PUBLISHED]]]);
      const { context, workspace } = contextFor(views);
      append(context, workspace, undefined);
      const ports = await portsOf(workspace);
      const productTypeOf = ports.productTypeOf as (id: string) => string;
      expect(labels(ports.itemVersionChoices)).toHaveLength(1);
      expect(productTypeOf('root-RM-E2EWS-NEW')).toBe('');
      views.set(ITEM_VERSIONS_PATH, [
        ...PUBLISHED,
        item('v-new', 'RM-E2EWS-NEW', 'PUBLISHED', 'FINISHED_GOOD'),
      ]);
      expect(labels(ports.itemVersionChoices)).toEqual([
        'RM-KT-YARN-12000 · RM-KT-YARN-12000-名称',
        'RM-E2EWS-NEW · RM-E2EWS-NEW-名称',
      ]);
      expect(productTypeOf('root-RM-E2EWS-NEW')).toBe('FINISHED_GOOD');
    }
  });

  // TD-WF-010：列表「产品」列把 productItemId 解析成「SKU · 名称」；同一物料多个版本行时取已发布的那一版。
  it('BOM 与工艺路线宿主：产品根 id 解析成「SKU · 名称」，随视图更新', async () => {
    for (const append of [appendManufacturingBomConsole, appendManufacturingRoutingConsole]) {
      vi.mocked(mountCommercialConsole).mockReset();
      const views: Views = new Map([
        [
          ITEM_VERSIONS_PATH,
          [
            item('v1', 'FG-KT-PRO-50', 'RETIRED', 'FINISHED_GOOD'),
            item('v2', 'FG-KT-PRO-50', 'PUBLISHED', 'FINISHED_GOOD'),
          ],
        ],
      ]);
      const { context, workspace } = contextFor(views);
      append(context, workspace, undefined);
      const ports = await portsOf(workspace);
      const productLabelOf = ports.productLabelOf as (id: string) => string;
      expect(productLabelOf('root-FG-KT-PRO-50')).toBe('FG-KT-PRO-50 · FG-KT-PRO-50-名称');
      expect(productLabelOf('root-NOT-HERE')).toBe('');
      views.set(ITEM_VERSIONS_PATH, [
        item('v1', 'FG-KT-PRO-50', 'RETIRED', 'FINISHED_GOOD'),
        item('v2', 'FG-KT-PRO-50', 'PUBLISHED', 'FINISHED_GOOD'),
        item('v-new', 'RM-E2EWS-NEW', 'DRAFT'),
      ]);
      expect(productLabelOf('root-RM-E2EWS-NEW')).toBe('RM-E2EWS-NEW · RM-E2EWS-NEW-名称');
    }
  });

  it('信用宿主：别处刚签发的报价出现在「已签发报价」下拉里', async () => {
    const quotes = '/api/v1/quotes';
    const views: Views = new Map([[quotes, []]]);
    const { context, workspace } = contextFor(views);
    appendCreditConsole(context as unknown as CreditContractViewContext);
    const ports = await portsOf(workspace);
    expect(ports.issuedQuotes).toEqual([]);
    const issued = {
      id: 'qr-1',
      quoteNumber: 'Q-E2EWS',
      status: 'ISSUED',
      issuedSnapshotId: 'snap-1',
    };
    views.set(quotes, [issued, { ...issued, id: 'qr-2', status: 'DRAFT', issuedSnapshotId: null }]);
    expect(ports.issuedQuotes).toEqual([issued]);
  });

  // WFC-1（写流程冒烟 WS-P2-04 的残余）：客户与员工清单的权威来源是 CRM 控制器，它在新建客户与每次
  // load() 之后换成新数组。此前商业控制器拿到的是 bootstrap 构建工作台时的一次性数组引用拷贝，
  // 信用额度的客户下拉、线索的负责人下拉又在挂载时把它截进 ports——本会话新建的客户 / 员工选不到。
  it('信用宿主：CRM 控制器换上新客户清单后，额度表单的客户下拉读得到新客户', async () => {
    const { context, workspace } = contextFor(new Map());
    const crmRecords = {
      customers: [{ id: 'customer-1', name: '国际学校' }],
      employees: [] as readonly Employee[],
    };
    const controller = new CommercialController({} as unknown as CommercialApi);
    controller.followCrmRecords(crmRecords);
    appendCreditConsole({ ...context, controller } as unknown as CreditContractViewContext);
    const ports = await portsOf(workspace);
    const customerIds = (): readonly string[] =>
      (ports.customers as readonly Readonly<{ id: string }>[]).map((item) => item.id);
    expect(customerIds()).toEqual(['customer-1']);
    // 客户控制台新建客户之后：CRM 控制器换成新数组，没有新增任何请求。
    crmRecords.customers = [
      ...crmRecords.customers,
      { id: 'customer-2', name: '本会话新建的客户' },
    ];
    expect(customerIds()).toEqual(['customer-1', 'customer-2']);
  });

  it('线索宿主：员工清单换新数组后，负责人下拉给出新员工；同一份数组不重算', async () => {
    const scope = installGlobalTestDom();
    const workspace = scope.document.createElement('div') as unknown as HTMLElement;
    const crm = new CrmController(new Set(['lead:read', 'lead:reassign']), {} as unknown as CrmApi);
    const first: readonly Employee[] = [
      { id: 'employee-1', displayName: '销售一号', active: true },
    ];
    crm.employees = first;
    appendLeadConsole(workspace, crm);
    const ports = await portsOf(workspace);
    const labelsOf = (): readonly string[] =>
      (ports.employeeChoices as readonly Readonly<{ label: string }>[]).map((item) => item.label);
    expect(labelsOf()).toEqual(['销售一号']);
    // 同一份清单只算一次（按数组身份缓存）；清单换了才重算，停用的员工不进下拉。
    expect(ports.employeeChoices).toBe(ports.employeeChoices);
    crm.employees = [
      ...first,
      { id: 'employee-2', displayName: '新入职销售', active: true },
      { id: 'employee-3', displayName: '已停用', active: false },
    ];
    expect(labelsOf()).toEqual(['销售一号', '新入职销售']);
  });
});
