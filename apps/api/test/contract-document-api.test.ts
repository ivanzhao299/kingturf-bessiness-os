import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp, type ApiDependencies } from '../src/app.js';

const actor = { employeeId: randomUUID(), companyId: randomUUID() };
const permissions = new Map(
  [
    'contract-document:read',
    'contract-document:manage',
    'contract-ocr:operate',
    'contract-ocr:review',
    'contract-signature:send',
    'contract-signature:confirm',
  ].map((capability) => [capability, { scopes: ['COMPANY'], fields: null }]),
);
const base = {
  auth: {
    authenticate: vi.fn(() => Promise.resolve({ actor, permissions, scopeAnchors: new Map() })),
    login: vi.fn(),
    logout: vi.fn(),
  },
  organizations: {},
  employees: {},
} as unknown as ApiDependencies;

describe('contract document API', () => {
  it('binds an uploaded file to a purchase order with governed context', async () => {
    const create = vi.fn((...arguments_: unknown[]) => {
      void arguments_;
      return Promise.resolve({ id: randomUUID(), state: 'UPLOADED' });
    });
    const subjectId = randomUUID(),
      attachmentId = randomUUID();
    const response = await buildApp({ ...base, contractDocuments: { create } as never }).dispatch({
      method: 'POST',
      pathname: '/api/v1/contract-documents',
      headers: { authorization: 'Bearer token' },
      body: {
        businessType: 'PURCHASE',
        subjectType: 'purchase-order',
        subjectId,
        attachmentId,
        title: '采购合同.pdf',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(create.mock.calls[0]?.[0]).toEqual({
      businessType: 'PURCHASE',
      subjectType: 'purchase-order',
      subjectId,
      attachmentId,
      title: '采购合同.pdf',
    });
    expect(create.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ actor, scopes: ['COMPANY'] }),
    );
  });

  it('requires valid OCR confidence and at least one signer', async () => {
    const ocr = vi.fn(),
      createEnvelope = vi.fn();
    const id = randomUUID();
    const app = buildApp({ ...base, contractDocuments: { ocr, createEnvelope } as never });
    const invalidConfidence = await app.dispatch({
      method: 'POST',
      pathname: `/api/v1/contract-documents/${id}/ocr`,
      headers: { authorization: 'Bearer token' },
      body: { provider: 'ocr', text: 'text', fields: {}, confidence: 1.5 },
    });
    expect(invalidConfidence.statusCode).toBe(400);
    expect(ocr).not.toHaveBeenCalled();
    const noSigner = await app.dispatch({
      method: 'POST',
      pathname: `/api/v1/contract-documents/${id}/signature-envelopes`,
      headers: { authorization: 'Bearer token' },
      body: {
        provider: 'sign',
        providerEnvelopeId: 'ENV-1',
        signingOrder: 'SEQUENTIAL',
        expiresAt: null,
        signers: [],
      },
    });
    expect(noSigner.statusCode).toBe(400);
    expect(createEnvelope).not.toHaveBeenCalled();
  });
});
