import type { SessionContext } from '../session';
import { json, requestId } from '../http';
import type { CrmApi, Customer, Employee, Lead } from '../crm/types';
import { parseResponseRecord, type ResponseParser } from './response-parser';
import {
  parseResponseArray,
  parseResponseItems,
  parseCustomer360Response,
} from './api-response-parser';

export function createFetchCrmApi(context: SessionContext): CrmApi {
  const post = <T>(
    path: string,
    body: unknown,
    headers?: HeadersInit,
    decode: ResponseParser<unknown> | null = null,
  ) =>
    json<T>(
      path,
      context,
      {
        method: 'POST',
        body: JSON.stringify(body),
        ...(headers === undefined ? {} : { headers }),
      },
      decode,
    );
  return {
    listEmployees: () =>
      json<readonly Employee[]>('/api/v1/employees', context, undefined, parseResponseArray),
    async listCustomers() {
      return (
        await json<{ items: Customer[] }>(
          '/api/v1/customers',
          context,
          undefined,
          parseResponseItems,
        )
      ).items;
    },
    customer360: (id) =>
      json(`/api/v1/customers/${id}/360`, context, undefined, parseCustomer360Response),
    createCustomer: (input) => post('/api/v1/customers', input, undefined, parseResponseRecord),
    transitionCustomer: (customer, status, reason) =>
      json(
        `/api/v1/customers/${customer.id}`,
        context,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, reason, expectedVersion: customer.version }),
        },
        parseResponseRecord,
      ),
    addContact: (id, name, email) =>
      post(`/api/v1/customers/${id}/contacts`, {
        name,
        email,
        title: null,
        phone: null,
        primary: false,
      }),
    addActivity: (id, summary) =>
      post(
        `/api/v1/customers/${id}/activities`,
        { leadId: null, type: 'NOTE', occurredAt: new Date().toISOString(), summary, details: {} },
        { 'idempotency-key': requestId() },
      ),
    assignCustomer: (customer, assigneeId, reason) =>
      post(
        `/api/v1/customers/${customer.id}/ownership`,
        {
          assigneeId,
          reason,
          expectedVersion: customer.version,
          reassignment: customer.ownerId !== null,
        },
        undefined,
        parseResponseRecord,
      ),
    async listPool() {
      return (
        await json<{ items: Lead[] }>('/api/v1/leads/pool', context, undefined, parseResponseItems)
      ).items;
    },
    async listLeads() {
      return (
        await json<{ items: Lead[] }>('/api/v1/leads', context, undefined, parseResponseItems)
      ).items;
    },
    createLead: (input) => post('/api/v1/leads', input, undefined, parseResponseRecord),
    claimLead: (lead) =>
      post(
        `/api/v1/leads/${lead.id}/claim`,
        { expectedVersion: lead.version },
        { 'idempotency-key': requestId() },
        parseResponseRecord,
      ),
    transitionLead: (lead, status, reason) =>
      post(
        `/api/v1/leads/${lead.id}/transition`,
        {
          status,
          reason,
          expectedVersion: lead.version,
        },
        undefined,
        parseResponseRecord,
      ),
    assignLead: (lead, assigneeId, reason) =>
      post(
        `/api/v1/leads/${lead.id}/${lead.ownerId === null ? 'assign' : 'reassign'}`,
        {
          assigneeId,
          reason,
          expectedVersion: lead.version,
        },
        undefined,
        parseResponseRecord,
      ),
    releaseLead: (lead, reason) =>
      post(
        `/api/v1/leads/${lead.id}/release`,
        { reason, expectedVersion: lead.version },
        undefined,
        parseResponseRecord,
      ),
  };
}
