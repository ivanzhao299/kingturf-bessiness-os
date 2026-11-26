import type { MrpConsolePorts, MrpRow } from './mrp-ports';
import { idOf, records } from './mrp-state';

// TD-MFG-013：按已授权的批次详情定位建议；不从采购读端点绕开 MRP 读权限和数据范围。
export function watchMrpProposalLink(
  ports: Pick<MrpConsolePorts, 'permissions' | 'loadRunDetail'>,
  select: (run: string, proposal: MrpRow) => void,
  fail: () => void,
) {
  if (typeof globalThis.addEventListener !== 'function') return;
  const events = new AbortController();
  const openLinked = async () => {
    const hash = globalThis.location.hash;
    if (!hash.startsWith('#/material-planning?')) return;
    const params = new URLSearchParams(hash.slice(hash.indexOf('?') + 1));
    const run = params.get('run');
    const proposal = params.get('proposal');
    if (!run || !proposal || !ports.permissions.has('mrp:read')) return;
    try {
      const detail = await ports.loadRunDetail(run);
      if (events.signal.aborted || globalThis.location.hash !== hash) return;
      const row = records(detail?.proposals).find((item) => idOf(item) === proposal);
      if (row) select(run, row);
    } catch {
      if (!events.signal.aborted) fail();
    }
  };
  const open = () => {
    void openLinked();
  };
  globalThis.addEventListener('hashchange', open, { signal: events.signal });
  open();
  return () => {
    events.abort();
  };
}
