// U3-COM-5：技术需求控制台的动作工厂（WFD 拆分，G1 ≤800 行纪律；沿 quote / routing / bom 的
// console-actions 先例）。创建 / 修订 / 状态流转 / 附件上传四个写动作与写后刷新从这里出，
// 函数体与拆分前逐字节相同（只有 fail 多了一个 bundle 参数）；视图与状态面留在 ctr-console.tsx。
import type { Signal } from '@preact/signals';
import type { CtrConsolePorts, CtrRow } from './ctr-ports';
import type { CtrFormKind } from './ctr-console';
import { failureMessage } from '../../shared/api-error-message';
import { syncSelected } from './selected-sync';

export type CtrSignalBundle = Readonly<{
  ctrs: Signal<readonly CtrRow[]>;
  solutions: Signal<readonly CtrRow[]>;
  statusFilter: Signal<'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>;
  search: Signal<string>;
  loadError: Signal<string>;
  submitError: Signal<string>;
  loading: Signal<boolean>;
  selected: Signal<CtrRow | null>;
  activeForm: Signal<CtrFormKind>;
  decision: Signal<'APPROVED' | 'REJECTED' | null>;
  shownCount: Signal<number>;
  baselineId: Signal<string>;
}>;

export type CtrActions = Readonly<{
  runRefresh: () => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  runRevise: (row: CtrRow, values: Readonly<Record<string, string>>) => Promise<void>;
  runState: (row: CtrRow, body: Record<string, unknown>) => Promise<void>;
  runUpload: (row: CtrRow, file: File) => Promise<void>;
  closeForm: () => void;
}>;

// vanilla ctr-view 创建/修订表单的需求字段（requirements 载荷逐字段同构）。
const requirementsPayload = (values: Readonly<Record<string, string>>) => ({
  application: values.application ?? '',
  projectRegion: values.projectRegion ?? '',
  performanceStandard: values.performanceStandard ?? '',
  pileHeightMm: Number(values.pileHeight ?? 0),
  quantitySquareMeters: Number(values.quantity ?? 0),
  color: values.color ?? '',
  baseCondition: values.baseCondition ?? '',
  drainageRequirement: values.drainageRequirement ?? '',
  fireRating: values.fireRating ?? '',
  warrantyYears: Number(values.warrantyYears ?? 0),
  delivery: values.delivery ?? '',
});

// 给每个版本行标上「是否本需求单的最新版」：只有最新版能新建修订（新建修订之后标记随刷新移动）。
export const withLatestVersion = (ctrs: readonly CtrRow[]): readonly CtrRow[] => {
  const latestVersionByCtr = new Map<string, number>();
  for (const item of ctrs) {
    const rootId = typeof item.ctrId === 'string' ? item.ctrId : '';
    const revision = typeof item.version === 'number' ? item.version : 0;
    latestVersionByCtr.set(rootId, Math.max(latestVersionByCtr.get(rootId) ?? 0, revision));
  }
  return ctrs.map((item) => ({
    ...item,
    isLatestVersion:
      Number(item.version ?? 0) ===
      latestVersionByCtr.get(typeof item.ctrId === 'string' ? item.ctrId : ''),
  }));
};

const fail = (error: unknown, bundle: CtrSignalBundle, fallback: string): void => {
  const message = failureMessage(error, fallback);
  if (bundle.selected.value !== null || bundle.activeForm.value !== null)
    bundle.submitError.value = message;
  else bundle.loadError.value = message;
};

export const ctrActions = (ports: CtrConsolePorts, bundle: CtrSignalBundle): CtrActions => {
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.decision.value = null;
    bundle.submitError.value = '';
  };

  // TD-WF-008：列表换新的之后，抽屉里开着的那条也换成刷新后的行（已不在列表里则关闭抽屉）。
  const applyCtrs = (ctrs: readonly CtrRow[]): void => {
    bundle.ctrs.value = ctrs;
    syncSelected({
      selected: bundle.selected,
      // WFD-1：换进抽屉的行同样带「是否最新版」标记——此前抽屉里的行没有它，提交评审之后认不出
      // 这一版还能不能新建修订。
      rows: withLatestVersion(ctrs),
      idOf: (row) => ports.textValue(row.id, ''),
    });
  };

  const runRefresh = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      const fresh = await ports.refresh();
      applyCtrs(fresh.ctrs);
      bundle.solutions.value = fresh.solutions;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      fail(error, bundle, '技术需求加载失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit('/api/v1/ctrs', {
        opportunityId: values.opportunityId ?? '',
        code: values.code ?? '',
        title: values.title ?? '',
        requirements: requirementsPayload(values),
      });
      const fresh = await ports.refresh();
      applyCtrs(fresh.ctrs);
      closeForm();
    } catch (error: unknown) {
      fail(error, bundle, '技术需求创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runRevise = async (
    row: CtrRow,
    values: Readonly<Record<string, string>>,
  ): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(`/api/v1/ctrs/${ports.textValue(row.ctrId, '')}/versions`, {
        title: values.title ?? '',
        requirements: requirementsPayload(values),
      });
      const fresh = await ports.refresh();
      applyCtrs(fresh.ctrs);
      closeForm();
    } catch (error: unknown) {
      fail(error, bundle, '修订创建失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runState = async (row: CtrRow, body: Record<string, unknown>): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.submit(`/api/v1/ctr-versions/${ports.textValue(row.id, '')}/state`, body, 'PUT');
      const fresh = await ports.refresh();
      applyCtrs(fresh.ctrs);
      closeForm();
    } catch (error: unknown) {
      fail(error, bundle, '技术需求状态流转失败');
    } finally {
      bundle.loading.value = false;
    }
  };

  const runUpload = async (row: CtrRow, file: File): Promise<void> => {
    bundle.loading.value = true;
    bundle.submitError.value = '';
    try {
      await ports.uploadAttachment(ports.textValue(row.id, ''), file);
      const fresh = await ports.refresh();
      applyCtrs(fresh.ctrs);
    } catch (error: unknown) {
      fail(error, bundle, '附件上传失败');
    } finally {
      bundle.loading.value = false;
    }
  };
  return { closeForm, runRefresh, runCreate, runRevise, runState, runUpload };
};
