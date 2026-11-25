import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CollectionConsolePage } from './collection-console';
import { collectionSubmission, type CollectionAction } from './collection-payload';
import type { CollectionPorts } from './collection-ports';

const timestamp = new Date('2026-11-25T12:00:00Z');
const at = '2026-11-25T09:00:00Z';
const due = '2026-11-26T09:00:00Z';
const fixtures: readonly [
  CollectionAction,
  Readonly<Record<string, string>>,
  string,
  string,
  string,
][] = [
  [
    'create',
    { caseNumber: ' CASE-1 ', arOpenItemId: 'ar-1', assignedTo: 'emp-1', reason: ' opened ' },
    '/api/v1/collection-cases',
    'COL',
    '{"caseNumber":"CASE-1","arOpenItemId":"ar-1","assignedTo":"emp-1","priority":"HIGH","reason":"opened"}',
  ],
  [
    'followup',
    {
      occurredAt: at,
      contactPerson: ' Debtor ',
      outcome: ' result ',
      evidenceReference: ' A ',
      nextActionAt: ' ',
    },
    '/api/v1/collection-cases/case-1/followups',
    'FOLLOW',
    '{"channel":"PHONE","occurredAt":"2026-11-25T09:00:00.000Z","contactPerson":"Debtor","outcome":"result","evidence":{"reference":"A"}}',
  ],
  [
    'followup',
    {
      channel: 'EMAIL',
      occurredAt: at,
      contactPerson: 'Debtor',
      outcome: 'result',
      nextActionAt: due,
      evidenceReference: 'A',
    },
    '/api/v1/collection-cases/case-1/followups',
    'FOLLOW',
    '{"channel":"EMAIL","occurredAt":"2026-11-25T09:00:00.000Z","contactPerson":"Debtor","outcome":"result","nextActionAt":"2026-11-26T09:00:00.000Z","evidence":{"reference":"A"}}',
  ],
  [
    'promise',
    {
      promisedAmount: ' 12.500001 ',
      promisedAt: at,
      dueAt: due,
      debtorContact: ' Debtor ',
      evidenceReference: 'A',
    },
    '/api/v1/collection-cases/case-1/promises',
    'PROMISE',
    '{"promisedAmount":"12.500001","currency":"CNY","promisedAt":"2026-11-25T09:00:00.000Z","dueAt":"2026-11-26T09:00:00.000Z","debtorContact":"Debtor","evidence":{"reference":"A"}}',
  ],
  [
    'break',
    { reason: ' overdue ', evidenceReference: ' B ' },
    '/api/v1/collection-promises/case-1/break',
    'BROKEN',
    '{"reason":"overdue","allocationEntryIds":[],"evidence":{"reference":"B"}}',
  ],
  [
    'handoff',
    { handoffNumber: ' HANDOFF-1 ', reason: ' handoff ' },
    '/api/v1/collection-cases/case-1/legal-handoffs',
    'LEGAL',
    '{"handoffNumber":"HANDOFF-1","reason":"handoff"}',
  ],
  [
    'accept',
    { reason: ' accepted ', reviewReference: ' C ' },
    '/api/v1/legal-handoffs/case-1/accept',
    'LEGAL-ACCEPT',
    '{"reason":"accepted","evidence":{"reviewReference":"C"}}',
  ],
  [
    'package',
    { packageNumber: ' PKG-1 ' },
    '/api/v1/legal-handoffs/case-1/evidence-packages',
    'DEBT',
    '{"packageNumber":"PKG-1"}',
  ],
];

it.each(fixtures)(
  'retains the legacy %s request path and exact JSON body',
  (action, values, path, prefix, body) => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(timestamp);
    try {
      const submission = collectionSubmission({ action, subjectId: 'case-1' }, values);
      expect(submission.path).toBe(path);
      expect(JSON.stringify(submission.body)).toBe(
        `${body.slice(0, -1)},"idempotencyKey":"${prefix}-${timestamp.getTime().toString(36)}"}`,
      );
    } finally {
      vi.useRealTimers();
    }
  },
);

const item = {
  id: 'case-1',
  case_number: 'COL-001',
  state: 'CONTACTING',
  customerName: '逾期客户',
  currency: 'CNY',
  remainingAmount: '500000',
  overdueDays: 45,
  documentNumber: 'AR-001',
};
const detail = {
  ...item,
  promises: [{ id: 'promise-1', state: 'PENDING' }],
  legalHandoffs: [
    {
      id: 'handoff-1',
      state: 'ACCEPTED',
      packages: [
        {
          id: 'pkg-1',
          package_number: 'SENSITIVE-PACKAGE',
          state: 'READY',
          package_hash: '1234567890abcdef',
        },
      ],
    },
  ],
};
const sleepTick = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
const mount = async (permissions: readonly string[]) => {
  const ports: CollectionPorts = {
    permissions: new Set(permissions),
    receivables: [],
    employees: [],
    arRouteVisible: true,
    currencyLabel: () => '人民币',
    fetchPage: vi.fn().mockResolvedValue({ items: [item], nextCursor: null }),
    loadDetail: vi.fn().mockResolvedValue(detail),
    submit: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  const host = installGlobalTestDom().document.createElement('div');
  const Page = CollectionConsolePage(ports);
  await act(async () => {
    render(h(Page, {}), host);
    await sleepTick();
  });
  const trigger = await vi.waitFor(() => {
    const ready = host.querySelector('[data-testid="kt-collection-open"]');
    if (!ready) throw new Error(`Missing case trigger: ${host.textContent}`);
    return ready as TestElement;
  });
  await act(async () => {
    trigger.click();
    await sleepTick();
  });
  return host;
};

it('keeps legacy case data and action grants in the case drawer', async () => {
  const host = await mount(['collection:read', 'collection:manage', 'collection:escalate']);
  const drawer = host.querySelector('.detail-drawer');
  expect(host.textContent).toContain('催收案件');
  expect(host.textContent).toContain('逾期客户');
  expect(drawer?.textContent).toContain('逾期 45 天');
  expect(drawer?.textContent).toContain('确认承诺违约');
  expect(drawer?.textContent).toContain('申请法务移交');
  expect(drawer?.textContent).not.toContain('受理法务移交');
  expect(drawer?.textContent).not.toContain('生成债权证据包');
  expect(drawer?.textContent).not.toContain('SENSITIVE-PACKAGE');
});

it('shows the legal package only with the legal read grant and no write actions for readers', async () => {
  const host = await mount(['collection:read', 'legal-case:read']);
  expect(host.querySelector('[data-testid="kt-collection-create"]')).toBeNull();
  expect(host.querySelector('[data-testid="kt-collection-action-followup"]')).toBeNull();
  expect(host.querySelector('[data-testid="kt-collection-action-package"]')).toBeNull();
  expect(host.querySelector('[data-testid="kt-collection-package"]')?.textContent).toContain(
    'SENSITIVE-PACKAGE',
  );
});
