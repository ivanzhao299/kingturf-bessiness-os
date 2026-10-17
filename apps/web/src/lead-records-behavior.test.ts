import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openForm } from './shared/forms';
import { appendLeadList } from './crm/lead-records';
import { CrmController, visibleCrmSections } from './crm/controller';
import type { CrmApi, CrmPermission, Lead } from './crm/types';
import type { CrmRecordPorts, EmployeeChoices, Pagination } from './crm/record-ports';
import {
  createBehaviorElement,
  findElement,
  flushBehaviorPromises,
  htmlElement,
} from '../test/fixtures/behavior-dom';

vi.mock('./shared/forms', () => ({ openForm: vi.fn() }));
const form = vi.mocked(openForm);
const unused = (): never => {
  throw new Error('Unexpected CRM API/port');
};
const allPermissions: readonly CrmPermission[] = [
  'lead:create',
  'lead-pool:read',
  'lead-pool:claim',
  'lead:lifecycle',
  'lead:assign',
  'lead:reassign',
  'lead-pool:release',
];
const poolLead: Lead = {
  id: 'lead-1',
  title: '学校',
  source: '网站',
  status: 'POOL',
  ownerId: null,
  version: 7,
};
const setup = (
  records: readonly Lead[] = [poolLead],
  permissions = allPermissions,
  choices: EmployeeChoices = [],
) => {
  const api: CrmApi = {
    listEmployees: unused,
    listCustomers: unused,
    customer360: unused,
    createCustomer: unused,
    transitionCustomer: unused,
    addContact: unused,
    addActivity: unused,
    assignCustomer: unused,
    listPool: unused,
    listLeads: unused,
    createLead: unused,
    claimLead: unused,
    transitionLead: unused,
    assignLead: unused,
    releaseLead: unused,
  };
  const controller = new CrmController(new Set(permissions), api);
  controller.pool = records;
  const shell = createBehaviorElement('main'),
    split = createBehaviorElement('section');
  const bootstrap = vi.fn<CrmRecordPorts['bootstrapView']>();
  const pagination = vi.fn<Pagination>(() => htmlElement(createBehaviorElement('nav')));
  const ports: CrmRecordPorts = {
    bootstrapView: bootstrap,
    customer360Content: unused,
    customerStateLabel: unused,
  };
  const mount = () => {
    appendLeadList(
      htmlElement(split),
      htmlElement(shell),
      controller,
      visibleCrmSections(controller.permissions),
      choices,
      pagination,
      ports,
    );
  };
  const click = (text: string) => {
    findElement(split, (node) => node.tagName === 'BUTTON' && node.textContent === text).click();
    const call = form.mock.calls.at(-1);
    if (!call) throw new Error('Form missing');
    expect(call[0]).toBe(htmlElement(shell));
    return { fields: call[3], run: call[5], title: call[1] };
  };
  return { controller, shell, split, bootstrap, pagination, mount, click };
};
beforeEach(() => {
  form.mockClear();
  vi.stubGlobal('document', { createElement: createBehaviorElement });
});
afterEach(() => vi.unstubAllGlobals());

describe('lead list real render and callback contracts', () => {
  it('creates a pool lead using fixed payload and reboots only after successful command', async () => {
    const f = setup();
    const command = vi.spyOn(f.controller, 'createLead').mockResolvedValue();
    f.mount();
    expect(
      findElement(f.split, (node) => node.classList.contains('lead-pool')).getAttribute(
        'data-route-view',
      ),
    ).toBe('leads');
    const opened = f.click('新建线索');
    expect(opened.fields.find((field) => field.name === 'title')).toMatchObject({
      required: true,
      minLength: 2,
      maxLength: 160,
    });
    expect(
      opened.fields.find((field) => field.name === 'source')?.options?.map((item) => item.value),
    ).toEqual(['展会', '网站', '转介绍', '主动开发']);
    let finish: () => void = unused;
    command.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = opened.run({ title: '学校项目', source: '网站' });
    expect(command).toHaveBeenCalledExactlyOnceWith({
      title: '学校项目',
      source: '网站',
      customerId: null,
      pool: true,
    });
    expect(f.bootstrap).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(f.bootstrap).toHaveBeenCalledTimes(1);
    expect(f.bootstrap.mock.calls[0]?.[0]).toBe(htmlElement(f.shell));
    expect(f.bootstrap.mock.calls[0]?.[1]).toBe(f.controller);
    command.mockRejectedValueOnce(new Error('create rejected'));
    await expect(opened.run({ title: '学校项目', source: '网站' })).rejects.toThrow(
      'create rejected',
    );
    expect(f.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('claims the original versioned POOL object and waits before reboot', async () => {
    const f = setup();
    let finish: () => void = unused;
    const claim = vi.spyOn(f.controller, 'claim').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    f.mount();
    findElement(f.split, (node) => node.textContent === '认领').click();
    expect(claim.mock.calls[0]?.[0]).toBe(poolLead);
    expect(f.bootstrap).not.toHaveBeenCalled();
    finish();
    await flushBehaviorPromises();
    expect(f.bootstrap).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      '变更状态',
      poolLead,
      [],
      'lifecycle',
      { status: 'QUALIFIED', reason: 'qualified evidence' },
      'QUALIFIED',
      'qualified evidence',
    ],
    [
      '分配',
      poolLead,
      [],
      'assignment',
      { assigneeId: 'employee-1', reason: 'assignment evidence' },
      'employee-1',
      'assignment evidence',
    ],
    [
      '改派',
      { ...poolLead, ownerId: 'old-owner', status: 'CLAIMED' },
      [{ value: 'employee-1', label: '员工甲' }],
      'assignment',
      { assigneeId: 'employee-1', reason: 'reassignment evidence' },
      'employee-1',
      'reassignment evidence',
    ],
    [
      '释放公海',
      { ...poolLead, ownerId: 'owner-1', status: 'CLAIMED' },
      [],
      'release',
      { reason: 'release evidence' },
      '',
      'release evidence',
    ],
  ] as const)(
    'binds %s form to the original lead and fixed command',
    async (label, lead, choices, action, values, first, reason) => {
      const f = setup([lead], allPermissions, choices);
      const mutate = vi.spyOn(f.controller, 'mutateLead').mockResolvedValue();
      f.mount();
      const opened = f.click(label);
      expect(opened.fields.every((field) => field.required)).toBe(true);
      if (label === '变更状态')
        expect(opened.fields[0]?.options?.map((item) => item.value)).toEqual([
          'QUALIFIED',
          'DISQUALIFIED',
          'CONVERTED',
        ]);
      if (label === '分配')
        expect(opened.fields[0]).toMatchObject({ name: 'assigneeId', label: '负责人编号' });
      if (label === '改派') {
        expect(opened.fields[0]?.type).toBe('select');
        expect(opened.fields[0]?.options).toBe(choices);
      }
      await opened.run(values);
      expect(mutate).toHaveBeenCalledExactlyOnceWith(lead, action, first, reason);
      expect(mutate.mock.calls[0]?.[0]).toBe(lead);
      expect(f.bootstrap).toHaveBeenCalledTimes(1);
      mutate.mockRejectedValueOnce(new Error('mutation rejected'));
      await expect(opened.run(values)).rejects.toThrow('mutation rejected');
      expect(f.bootstrap).toHaveBeenCalledTimes(1);
    },
  );

  it('requires permission, integer version and known owner before offering mutation buttons', () => {
    const noPermission = setup([poolLead], []);
    noPermission.mount();
    expect(noPermission.split.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual(
      [],
    );
    const invalid = setup([
      { id: 'missing-version', status: 'POOL', ownerId: null },
      { ...poolLead, id: 'fractional', version: 1.5 },
    ]);
    invalid.mount();
    expect(
      invalid.split
        .descendants()
        .filter((node) => node.tagName === 'BUTTON')
        .map((node) => node.textContent),
    ).toEqual(['新建线索']);
    const unknownOwner = setup(
      [{ id: 'unknown', status: 'QUALIFIED', version: 1 }],
      ['lead:assign', 'lead:reassign', 'lead-pool:release'],
    );
    unknownOwner.mount();
    expect(unknownOwner.split.descendants().filter((node) => node.tagName === 'BUTTON')).toEqual(
      [],
    );
    expect(unknownOwner.split.textContent).toContain('unknown · —');
    expect(form).not.toHaveBeenCalled();
  });

  it('uses actual controller dedupe/filter/page and propagates search/page changes to reboot', () => {
    const leads = Array.from({ length: 12 }, (_, index) => ({
      ...poolLead,
      id: `lead-${String(index)}`,
      title: `项目${String(index)}`,
    }));
    const f = setup(leads, []);
    f.controller.leads = [leads[0] ?? poolLead];
    f.controller.leadPage = 2;
    f.mount();
    expect(
      f.split
        .descendants()
        .filter((node) => node.classList.contains('lead-row'))
        .map((node) => node.textContent),
    ).toEqual(['项目10 · 网站', '项目11 · 网站']);
    expect(f.pagination).toHaveBeenCalledTimes(1);
    expect(f.pagination.mock.calls[0]?.slice(0, 2)).toEqual([12, 2]);
    const change = f.pagination.mock.calls[0]?.[2];
    if (!change) throw new Error('Pagination callback missing');
    change(1);
    expect(f.controller.leadPage).toBe(1);
    expect(f.bootstrap).toHaveBeenCalledTimes(1);
    const search = findElement(f.split, (node) => node.type === 'search');
    search.value = '项目11';
    f.controller.leadPage = 2;
    search.dispatchEvent(new Event('input'));
    expect(f.controller.leadQuery).toBe('项目11');
    expect(f.controller.leadPage).toBe(1);
    expect(f.bootstrap).toHaveBeenCalledTimes(2);
    f.split.replaceChildren();
    f.mount();
    expect(
      f.split
        .descendants()
        .filter((node) => node.classList.contains('lead-row'))
        .map((node) => node.textContent),
    ).toEqual(['项目11 · 网站']);
    expect(findElement(f.split, (node) => node.type === 'search').value).toBe('项目11');
  });

  it('shows three empty queues without pagination when no lead matches', () => {
    const f = setup();
    f.controller.leadQuery = 'no-match';
    f.mount();
    expect(f.pagination).not.toHaveBeenCalled();
    expect(
      f.split.descendants().filter((node) => node.classList.contains('queue-item')),
    ).toHaveLength(3);
    expect(f.split.textContent).toContain('暂无逾期线索');
  });
});
