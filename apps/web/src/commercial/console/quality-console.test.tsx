import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { operationsContext } from '../../../test/fixtures/operations-context';
import type { OperationsViewContext } from '../operations-view-ports';
import { mountQualityConsole } from './quality-console';
import {
  newQualityInspection,
  newQualityPlan,
  publishQualityPlan,
  qualityInspectionCommand,
  qualityResult,
} from './quality-forms';
import { trimOpsValues } from './ops-form';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

it('renders the Chinese complaint ledger and exposes batch triage only to the assigned roles', async () => {
  const row = {
    id: 'complaint-1',
    complaint_number: 'CMP-2026-001',
    customerName: '华北体育工程',
    severity: 'MAJOR',
    state: 'REPORTED',
    version: 1,
    closure_due_at: '2026-09-01T08:00:00Z',
  };
  for (const canAssign of [true, false]) {
    const { context } = operationsContext();
    const host = installGlobalTestDom().document.createElement('div');
    const get = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('?')
          ? { items: [row], nextCursor: null }
          : { ...row, events: [{ state: 'REPORTED', reason: '收到投诉' }] },
      ),
    );
    const configured: OperationsViewContext = {
      ...context,
      permissions: canAssign
        ? new Set(['complaint:read', 'complaint:triage', 'complaint:assign'])
        : new Set(['complaint:read']),
      controller: { ...context.controller, api: { ...context.controller.api, get } },
      ports: {
        ...context.ports,
        businessStateLabel: () => '—',
        COMPLAINT_SEVERITY_LABELS: { MAJOR: '重大' },
        COMPLAINT_STATE_LABELS: { REPORTED: '待分诊' },
      },
    };
    await act(async () => {
      mountQualityConsole(host as unknown as HTMLElement, configured);
      await tick();
    });
    expect(get).toHaveBeenCalledExactlyOnceWith('/api/v1/complaints?limit=25');
    expect(host.querySelector('[data-testid="kt-qi-complaints-ledger"]')).not.toBeNull();
    for (const text of ['客户投诉与整改闭环', 'CMP-2026-001', '重大', '待分诊'])
      expect(host.textContent).toContain(text);
    for (const text of ['REPORTED', 'MAJOR', '发布处理时限'])
      expect(host.textContent).not.toContain(text);
    expect(host.textContent.includes('批量分派')).toBe(canAssign);
    expect(host.querySelector('[data-testid="kt-qi-tab-inspections"]')).toBeNull();
    const trigger = host.querySelector('[data-testid="kt-qi-complaints-open"]') as TestElement;
    await act(async () => {
      trigger.click();
      await tick();
    });
    expect(get).toHaveBeenLastCalledWith('/api/v1/complaints/complaint-1');
    expect(host.querySelector('[data-testid="kt-qi-complaint-sla"]')?.textContent).toContain(
      '关闭倒计时',
    );
    expect(host.querySelector('[data-testid="kt-qi-complaint-timeline"]')?.textContent).toContain(
      '收到投诉',
    );
  }
});

it('retains the exact quality form bytes including blank, trimmed, omitted and derived values', () => {
  const now = () => new Date('2026-11-25T12:00:00.000Z');
  const date = '2026-11-25T12:00:00.000Z';
  const plan = newQualityPlan([]);
  expect(
    JSON.stringify(
      plan.payload(
        trimOpsValues({
          code: ' QP-1 ',
          name: ' 计划 ',
          itemVersionId: 'item',
          inspectionStage: 'FINAL',
          samplingMethod: '全检',
          acceptanceRule: '必检',
          effectiveAt: date,
          characteristicCode: 'LENGTH',
          characteristicName: '长度',
          lowerLimit: '',
        }),
      ),
    ),
  ).toBe(
    '["/api/v1/quality-plans",{"code":"QP-1","name":"计划","itemVersionId":"item","inspectionStage":"FINAL","samplingMethod":"全检","acceptanceRule":{"description":"必检"},"effectiveAt":"2026-11-25T12:00:00.000Z","characteristics":[{"code":"LENGTH","name":"长度","dataType":"NUMERIC","lowerLimit":"","required":true,"instructions":""}],"publish":true}]',
  );
  expect(JSON.stringify(publishQualityPlan('plan').payload({ confirmation: 'ignored' }))).toBe(
    '["/api/v1/quality-plans/plan/publish",{}]',
  );
  expect(
    JSON.stringify(
      newQualityInspection([], []).payload({
        inspectionNumber: 'QI-1',
        planVersionId: 'plan',
        lotId: 'lot',
        sourceId: 'roll',
        sampleSize: '2.5',
      }),
    ),
  ).toBe(
    '["/api/v1/quality-inspections",{"inspectionNumber":"QI-1","planVersionId":"plan","lotId":"lot","sourceType":"PRODUCTION_ROLL","sourceId":"roll","sampleSize":"2.5"}]',
  );
  for (const action of ['sample', 'complete', 'cancel', 'release', 'reject'] as const) {
    expect(
      JSON.stringify(
        qualityInspectionCommand('inspection', action).payload({
          reason: '检查',
          evidence: 'E-1',
          idempotencyKey: 'K-1',
        }),
      ),
    ).toBe(
      `["/api/v1/quality-inspections/inspection/${action}",{"reason":"检查","evidence":{"reference":"E-1"},"idempotencyKey":"K-1"}]`,
    );
  }
  expect(
    JSON.stringify(
      qualityResult('inspection', [], now).payload({
        characteristicId: 'length',
        measuredNumeric: '10.5',
        passed: 'false',
        idempotencyKey: 'K-2',
      }),
    ),
  ).toBe(
    '["/api/v1/quality-inspections/inspection/results",{"characteristicId":"length","measuredNumeric":"10.5","passed":false,"notes":"","occurredAt":"2026-11-25T12:00:00.000Z","idempotencyKey":"K-2"}]',
  );
});
