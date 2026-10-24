import { vi } from 'vitest';
import type { OperationsViewContext } from '../../src/commercial/operations-view-ports';
import { createBehaviorElement, htmlElement } from './behavior-dom';

const unused = (): never => {
  throw new Error('Unexpected operations port');
};
export const operationsContext = () => {
  const workspace = createBehaviorElement('main');
  const submit = vi.fn<OperationsViewContext['controller']['submit']>(() => Promise.resolve());
  const requestId = vi.fn(() => 'fixed-command-key');
  const context: OperationsViewContext = {
    workspace: htmlElement(workspace),
    status: htmlElement(createBehaviorElement('p')),
    permissions: new Set(),
    controller: {
      customers: [],
      views: new Map(),
      message: '',
      submit,
      load: unused,
      employees: [
        { id: 'employee-1', displayName: '员工甲' },
        { id: 'employee-2', employeeNumber: 'E-2' },
        { id: 'employee-3' },
      ],
      api: { get: unused, uploadContractDocument: unused },
    },
    ports: {
      recordValue: unused,
      recordText: (record, camel, snake, fallback = '') => {
        const value = record[camel] ?? record[snake];
        return typeof value === 'string'
          ? value
          : typeof value === 'number'
            ? String(value)
            : fallback;
      },
      textValue: unused,
      decimalValue: unused,
      inventoryLocationOption: unused,
      businessStateLabel: unused,
      supplyModeLabel: unused,
      qualityStageLabel: unused,
      operationsNextAction: unused,
      COMPLAINT_SEVERITY_LABELS: {},
      COMPLAINT_STATE_LABELS: {},
      requestId,
    },
  };
  return { context, submit, requestId };
};
