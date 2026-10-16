import { json, requestId } from '../http';
import type { CrmApi, Customer, Employee, Lead } from '../crm/types';

export function createFetchCrmApi(token: string): CrmApi {
  const post = <T>(path: string, body: unknown, headers?: HeadersInit) =>
    json<T>(path, token, {
      method: 'POST',
      body: JSON.stringify(body),
      ...(headers === undefined ? {} : { headers }),
    });
  return {
    listEmployees: () => json<readonly Employee[]>('/api/v1/employees', token),
    async listCustomers() {
      return (await json<{ items: Customer[] }>('/api/v1/customers', token)).items;
    },
    customer360: (id) => json(`/api/v1/customers/${id}/360`, token),
    createCustomer: (input) => post('/api/v1/customers', input),
    transitionCustomer: (customer, status, reason) =>
      json(`/api/v1/customers/${customer.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, expectedVersion: customer.version }),
      }),
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
      post(`/api/v1/customers/${customer.id}/ownership`, {
        assigneeId,
        reason,
        expectedVersion: customer.version,
        reassignment: customer.ownerId !== null,
      }),
    async listPool() {
      return (await json<{ items: Lead[] }>('/api/v1/leads/pool', token)).items;
    },
    async listLeads() {
      return (await json<{ items: Lead[] }>('/api/v1/leads', token)).items;
    },
    createLead: (input) => post('/api/v1/leads', input),
    claimLead: (lead) =>
      post(
        `/api/v1/leads/${lead.id}/claim`,
        { expectedVersion: lead.version },
        { 'idempotency-key': requestId() },
      ),
    transitionLead: (lead, status, reason) =>
      post(`/api/v1/leads/${lead.id}/transition`, {
        status,
        reason,
        expectedVersion: lead.version,
      }),
    assignLead: (lead, assigneeId, reason) =>
      post(`/api/v1/leads/${lead.id}/${lead.ownerId === null ? 'assign' : 'reassign'}`, {
        assigneeId,
        reason,
        expectedVersion: lead.version,
      }),
    releaseLead: (lead, reason) =>
      post(`/api/v1/leads/${lead.id}/release`, { reason, expectedVersion: lead.version }),
  };
}
