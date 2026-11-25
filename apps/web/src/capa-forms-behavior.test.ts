import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  capaAction,
  capaClose,
  capaComplete,
  capaCreate,
  capaVerify,
} from './commercial/console/complaint-capa-forms';
import type { OperationsViewContext } from './commercial/operations-view-ports';
import { operationsContext } from '../test/fixtures/operations-context';
import { createOpsWriter, type OpsForm } from './commercial/console/ops-form';
const evidenceFields = [
  { name: 'reason', label: '关闭原因', required: true },
  { name: 'evidenceReference', label: '证据', required: true },
];
type Case = Readonly<{
  name: string;
  open: (context: OperationsViewContext) => OpsForm;
  path: string;
  values: Readonly<Record<string, string>>;
  payload: Record<string, unknown>;
}>;
const cases: readonly Case[] = [
  {
    name: 'create',
    open: (context) => capaCreate(context, { severity: 'HIGH', version: 7 }, 'ncr-1'),
    path: '/api/v1/ncrs/ncr-1/capas',
    values: {
      capaNumber: 'CAPA-1',
      ownerId: 'employee-1',
      targetAt: '2026-10-20T12:00',
      rootCause: 'fixed root cause',
      evidenceReference: 'CREATE-EVIDENCE',
    },
    payload: {
      capaNumber: 'CAPA-1',
      ownerId: 'employee-1',
      targetAt: '2026-10-20T12:00',
      riskLevel: 'HIGH',
      rootCauseSnapshot: { conclusion: 'fixed root cause' },
      complaintExpectedVersion: 7,
      evidence: { reference: 'CREATE-EVIDENCE' },
      idempotencyKey: 'CMP-FIXED-COMMAND-KEY',
    },
  },
  {
    name: 'action',
    open: (context) => capaAction(context, 'capa-1', 8),
    path: '/api/v1/capas/capa-1/actions',
    values: {
      actionType: 'PREVENTIVE',
      description: 'fixed measure',
      ownerId: 'employee-2',
      dueAt: '2026-10-21T12:00',
    },
    payload: {
      actionType: 'PREVENTIVE',
      description: 'fixed measure',
      ownerId: 'employee-2',
      dueAt: '2026-10-21T12:00',
      expectedVersion: 8,
      idempotencyKey: 'CMP-FIXED-COMMAND-KEY',
    },
  },
  {
    name: 'complete',
    open: (context) => capaComplete(context, { id: 'action-1', description: 'fixed measure' }, 9),
    path: '/api/v1/capa-actions/action-1/complete',
    values: { evidenceReference: 'COMPLETE-EVIDENCE' },
    payload: {
      completedAt: '2026-10-17T12:34:56.000Z',
      evidence: { reference: 'COMPLETE-EVIDENCE' },
      expectedCapaVersion: 9,
      idempotencyKey: 'CMP-FIXED-COMMAND-KEY',
    },
  },
  {
    name: 'verify',
    open: (context) => capaVerify(context, { version: 10 }, 'capa-1', 11),
    path: '/api/v1/capas/capa-1/verify',
    values: {
      standard: 'fixed standard',
      sampleScope: 'fixed scope',
      observationUntil: '2026-10-23T12:00',
      result: 'PASSED',
      evidenceReference: 'VERIFY-EVIDENCE',
    },
    payload: {
      verifiedAt: '2026-10-17T12:34:56.000Z',
      standard: 'fixed standard',
      sampleScope: 'fixed scope',
      observationUntil: '2026-10-23T12:00',
      result: 'PASSED',
      evidence: { reference: 'VERIFY-EVIDENCE' },
      expectedVersion: 11,
      complaintExpectedVersion: 10,
      idempotencyKey: 'CMP-FIXED-COMMAND-KEY',
    },
  },
  {
    name: 'close',
    open: (context) => capaClose(context, 'capa-1', 12, evidenceFields),
    path: '/api/v1/capas/capa-1/close',
    values: { reason: 'fixed closure reason', evidenceReference: 'CLOSE-EVIDENCE' },
    payload: {
      expectedVersion: 12,
      reason: 'fixed closure reason',
      evidence: { reference: 'CLOSE-EVIDENCE' },
      idempotencyKey: 'CMP-FIXED-COMMAND-KEY',
    },
  },
];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:34:56Z'));
});
afterEach(() => vi.useRealTimers());

describe('CAPA forms preserve concurrency versions and immutable evidence payloads', () => {
  it.each(cases)(
    'submits fixed $name payload before refreshing, with failure propagation',
    async (entry) => {
      const f = operationsContext(),
        refresh = vi.fn(() => Promise.resolve());
      const model = createOpsWriter(f.submit, refresh);
      const form = entry.open(f.context);
      if (entry.name === 'close') expect(form.fields).toBe(evidenceFields);
      if (entry.name === 'create' || entry.name === 'action')
        expect(form.fields.find((field) => field.name === 'ownerId')?.options).toEqual([
          { value: 'employee-1', label: '员工甲' },
          { value: 'employee-2', label: 'E-2' },
          { value: 'employee-3', label: '未命名员工' },
        ]);
      if (entry.name === 'verify')
        expect(
          form.fields
            .find((field) => field.name === 'result')
            ?.options?.map((option) => option.value),
        ).toEqual(['PASSED', 'FAILED']);
      const write = async () => {
        model.open(form);
        const pending = model.write(entry.values);
        void model.confirmation.peek()?.run();
        await pending;
      };
      let complete: () => void = () => {
        throw new Error('Not initialized');
      };
      f.requestId
        .mockReturnValueOnce('fixed-command-key')
        .mockReturnValueOnce('second-command-key');
      f.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
      const pending = write();
      await Promise.resolve();
      expect(f.submit).toHaveBeenCalledExactlyOnceWith(entry.path, entry.payload);
      expect(JSON.stringify(f.submit.mock.calls[0]?.[1])).toBe(JSON.stringify(entry.payload));
      expect(f.requestId).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
      complete();
      await pending;
      expect(refresh).toHaveBeenCalledTimes(1);
      f.submit.mockRejectedValueOnce(new Error('command rejected'));
      await write();
      expect(model.error.peek()).toContain('command rejected');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(f.requestId).toHaveBeenCalledTimes(2);
      expect(f.submit.mock.calls[1]).toEqual([
        entry.path,
        { ...entry.payload, idempotencyKey: 'CMP-SECOND-COMMAND-KEY' },
      ]);
      refresh.mockRejectedValueOnce(new Error('refresh rejected'));
      await write();
      expect(model.notice.peek()).toContain('refresh rejected');
    },
  );
});
