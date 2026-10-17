import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import {
  openCapaAction,
  openCapaClose,
  openCapaComplete,
  openCapaCreate,
  openCapaVerify,
} from './commercial/capa-forms';
import type { OperationsViewContext } from './commercial/operations-view-ports';
import { operationsContext } from '../test/fixtures/operations-context';
vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const evidenceFields = [
  { name: 'reason', label: '关闭原因', required: true },
  { name: 'evidenceReference', label: '证据', required: true },
];
type Case = Readonly<{
  name: string;
  open: (context: OperationsViewContext, refresh: () => Promise<void>) => void;
  path: string;
  values: Readonly<Record<string, string>>;
  payload: Record<string, unknown>;
}>;
const cases: readonly Case[] = [
  {
    name: 'create',
    open: (context, refresh) => {
      openCapaCreate(context, { severity: 'HIGH', version: 7 }, 'ncr-1', refresh);
    },
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
      idempotencyKey: 'fixed-command-key',
    },
  },
  {
    name: 'action',
    open: (context, refresh) => {
      openCapaAction(context, 'capa-1', 8, refresh);
    },
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
      idempotencyKey: 'fixed-command-key',
    },
  },
  {
    name: 'complete',
    open: (context, refresh) => {
      openCapaComplete(context, { id: 'action-1', description: 'fixed measure' }, 9, refresh);
    },
    path: '/api/v1/capa-actions/action-1/complete',
    values: { evidenceReference: 'COMPLETE-EVIDENCE' },
    payload: {
      completedAt: '2026-10-17T12:34:56.000Z',
      evidence: { reference: 'COMPLETE-EVIDENCE' },
      expectedCapaVersion: 9,
      idempotencyKey: 'fixed-command-key',
    },
  },
  {
    name: 'verify',
    open: (context, refresh) => {
      openCapaVerify(context, { version: 10 }, 'capa-1', 11, refresh);
    },
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
      idempotencyKey: 'fixed-command-key',
    },
  },
  {
    name: 'close',
    open: (context, refresh) => {
      openCapaClose(context, 'capa-1', 12, evidenceFields, refresh);
    },
    path: '/api/v1/capas/capa-1/close',
    values: { reason: 'fixed closure reason', evidenceReference: 'CLOSE-EVIDENCE' },
    payload: {
      expectedVersion: 12,
      reason: 'fixed closure reason',
      evidence: { reference: 'CLOSE-EVIDENCE' },
      idempotencyKey: 'fixed-command-key',
    },
  },
];
beforeEach(() => {
  form.mockClear();
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
      entry.open(f.context, refresh);
      const call = form.mock.calls[0];
      if (!call) throw new Error('CAPA form missing');
      expect(call[0]).toBe(f.context.workspace);
      if (entry.name === 'close') expect(call[3]).toBe(evidenceFields);
      if (entry.name === 'create' || entry.name === 'action')
        expect(call[3].find((field) => field.name === 'ownerId')?.options).toEqual([
          { value: 'employee-1', label: '员工甲' },
          { value: 'employee-2', label: 'E-2' },
          { value: 'employee-3', label: '未命名员工' },
        ]);
      if (entry.name === 'verify')
        expect(
          call[3].find((field) => field.name === 'result')?.options?.map((option) => option.value),
        ).toEqual(['PASSED', 'FAILED']);
      let complete: () => void = () => {
        throw new Error('Not initialized');
      };
      f.submit.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
      const pending = call[5](entry.values);
      expect(f.submit).toHaveBeenCalledExactlyOnceWith(entry.path, entry.payload);
      expect(f.requestId).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
      complete();
      await pending;
      expect(refresh).toHaveBeenCalledTimes(1);
      f.submit.mockRejectedValueOnce(new Error('command rejected'));
      await expect(call[5](entry.values)).rejects.toThrow('command rejected');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(f.requestId).toHaveBeenCalledTimes(2);
      refresh.mockRejectedValueOnce(new Error('refresh rejected'));
      await expect(call[5](entry.values)).rejects.toThrow('refresh rejected');
    },
  );
});
