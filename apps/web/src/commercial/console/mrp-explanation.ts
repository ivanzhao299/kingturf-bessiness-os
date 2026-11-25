// MFG-6：建议的解释——前端基于批次详情（additive GET /api/v1/mrp-runs/:id）的行项计算，不为呈现
// 新增读端点。纯函数，不经 IO。
// 需求从哪来：需求信号是根（第 0 层），经 BOM 逐层展开（第 1 层起）到组件——每层的量 = 上层量 ×
// BOM 行用量 ×（1 + 损耗率）/ 产出量，与服务端计算时展开需求用的是同一个式子。批次不保存 BOM 快照，
// 展开按当前已发布的 BOM 版本还原（接口同样如此说明）。
import type { MrpRow } from './mrp-ports';
import { numOf, records, textOf } from './mrp-state';

export type ExplainSource = Readonly<{
  kind: string;
  id: string;
  // 来源是销售订单且账号读得到订单时才有；否则是空串。
  orderNumber: string;
  orderStatus: string;
}>;
export type ExplainBom = Readonly<{
  code: string;
  quantity: number;
  scrapBasisPoints: number;
  outputQuantity: number;
}>;
export type ExplainNode = Readonly<{
  key: string;
  itemVersionId: string;
  sku: string;
  name: string;
  // 0 = 需求信号（根）；1 起 = 经一层 BOM 展开出来的组件。
  level: number;
  // 这一层的毛需求贡献。
  quantity: number;
  requiredAt: string;
  bom?: ExplainBom;
  source?: ExplainSource;
  // 这一层正是这条建议对应的物料与需求日期（高亮）。
  target: boolean;
  children: readonly ExplainNode[];
}>;

// 与服务端计算的展开深度上限一致（mrp-repositories.ts 的 e.depth<20）。
const MAX_DEPTH = 20;
const round = (value: number): number => Math.round(value * 1e6) / 1e6;
const isRow = (value: unknown): value is MrpRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Input = Readonly<{
  itemVersionId: string;
  sku: string;
  name: string;
  quantity: number;
  requiredAt: string;
  bom?: ExplainBom;
  source?: ExplainSource;
}>;
const sourceOf = (value: unknown): ExplainSource | undefined => {
  if (!isRow(value)) return undefined;
  return {
    kind: textOf(value.kind),
    id: textOf(value.id),
    orderNumber: textOf(value.orderNumber),
    orderStatus: textOf(value.orderStatus),
  };
};

/** 解释树：根是本批次的需求信号，子节点是经 BOM 展开出来的组件；这条建议对应的那一层带 target。 */
export const explanationOf = (detail: MrpRow | null, proposal: MrpRow): readonly ExplainNode[] => {
  if (!detail) return [];
  const targetItem = textOf(proposal.item_version_id);
  const targetDate = textOf(proposal.due_at);
  const edges = new Map<string, MrpRow[]>();
  for (const edge of records(detail.bomEdges)) {
    const parent = textOf(edge.parentItemVersionId);
    const siblings = edges.get(parent) ?? [];
    siblings.push(edge);
    edges.set(parent, siblings);
  }
  const build = (
    input: Input,
    level: number,
    path: readonly string[],
    key: string,
  ): ExplainNode | null => {
    const target = input.itemVersionId === targetItem && input.requiredAt === targetDate;
    const children: ExplainNode[] = [];
    const nextPath = [...path, input.itemVersionId];
    for (const edge of level < MAX_DEPTH ? (edges.get(input.itemVersionId) ?? []) : []) {
      const component = textOf(edge.componentItemVersionId);
      const output = numOf(edge.outputQuantity);
      if (nextPath.includes(component) || output <= 0) continue;
      const quantity = numOf(edge.quantity);
      const scrap = numOf(edge.scrapBasisPoints);
      const child = build(
        {
          itemVersionId: component,
          sku: textOf(edge.componentSku),
          name: textOf(edge.componentItemName),
          quantity: round((input.quantity / output) * quantity * (1 + scrap / 10_000)),
          requiredAt: input.requiredAt,
          bom: {
            code: textOf(edge.bomCode),
            quantity,
            scrapBasisPoints: scrap,
            outputQuantity: output,
          },
        },
        level + 1,
        nextPath,
        `${key}:${textOf(edge.lineNumber)}`,
      );
      if (child) children.push(child);
    }
    if (!target && children.length === 0) return null;
    return { ...input, key, level, target, children };
  };
  return records(detail.demandSnapshots).flatMap((snapshot, index) => {
    if (textOf(snapshot.required_at) !== targetDate) return [];
    const source = sourceOf(snapshot.source);
    const root = build(
      {
        itemVersionId: textOf(snapshot.item_version_id),
        sku: textOf(snapshot.sku),
        name: textOf(snapshot.itemName),
        quantity: numOf(snapshot.quantity),
        requiredAt: textOf(snapshot.required_at),
        ...(source ? { source } : {}),
      },
      0,
      [],
      textOf(snapshot.id) || String(index),
    );
    return root ? [root] : [];
  });
};

/** 批次原始解释口径，包括净值计算使用的快照数与批量结果。 */
export const formulaOf = (explanation: unknown): string => {
  if (!isRow(explanation)) return '';
  const at = (key: string): string => textOf(explanation[key]);
  return `毛需求 ${at('grossDemand')} · 安全库存 ${at('safetyStock')} · 可用库存 ${at('onHand')} · 在途 ${at('scheduledReceipts')} · 净需求 ${at('netRequirement')}；按批量取整为 ${at('plannedQuantity')}`;
};

/** 详情行项里属于这条建议的物料的那些行。 */
export const forItem = (rows: readonly MrpRow[], proposal: MrpRow): readonly MrpRow[] =>
  rows.filter((row) => textOf(row.itemVersionId) === textOf(proposal.item_version_id));

const EVIDENCE_LABELS: Readonly<Record<string, string>> = {
  approval: '审批证据',
  freezeOverrideApproval: '冻结覆盖审批',
  reference: '凭证',
  releaseBatch: '下达批次',
};
/** 决定事件上的凭证：字符串值的证据项（计算那一步的证据是整份计算快照，不在这里列）。 */
export const evidenceOf = (event: MrpRow): string => {
  if (!isRow(event.evidence)) return '';
  return Object.entries(event.evidence)
    .filter(([, value]) => typeof value === 'string' && value !== '')
    .map(([key, value]) => `${EVIDENCE_LABELS[key] ?? key} ${String(value)}`)
    .join(' · ');
};
