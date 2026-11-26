import type { PurchaseOrderRow } from './po-ports';

// 派生批次信息经过服务端 mrp:read 的 scope/fields 门控；只有引用自身时只显示 UUID。
export const PurchaseProposalLink = ({
  row,
  permissions,
}: Readonly<{
  row: PurchaseOrderRow;
  permissions: ReadonlySet<string>;
}>) => {
  const id = row.mrp_proposal_id;
  if (typeof id !== 'string' || !id) return <span>—</span>;
  const run = row.mrp_run_id;
  return permissions.has('mrp:read') && typeof run === 'string' ? (
    <a
      data-testid="kt-po-source-link"
      href={`#/material-planning?run=${encodeURIComponent(run)}&proposal=${encodeURIComponent(id)}`}
    >
      {id}
    </a>
  ) : (
    <span data-testid="kt-po-source-id">{id}</span>
  );
};
