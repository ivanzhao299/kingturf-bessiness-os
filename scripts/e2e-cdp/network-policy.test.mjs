import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequest } from './network-policy.mjs';

test('CDP allows only local GET static resources; every proxy context and unknown path is closed', () => {
  const local = 'http://127.0.0.1:4173';
  for (const path of ['/', '/assets/index.js', '/assets/index.css', '/favicon.ico'])
    assert.equal(classifyRequest(local + path, 'GET'), 'static');
  for (const path of ['/api', '/api/v1/customers', '/apix', '/api%2Fv1%2Fcustomers'])
    assert.equal(classifyRequest(local + path, 'GET'), 'api');
  for (const path of [
    '/health',
    '/health-extra',
    '/ready',
    '/version',
    '/%61pi/v1/customers',
    '/unmapped',
  ])
    assert.equal(classifyRequest(local + path, 'GET'), 'blocked');
  assert.equal(classifyRequest('https://example.invalid/asset.js', 'GET'), 'blocked');
  assert.equal(classifyRequest('http://127.0.0.1:3000/api/v1/customers', 'GET'), 'blocked');
  assert.equal(
    classifyRequest('http://synthetic@127.0.0.1:4173/assets/index.js', 'GET'),
    'blocked',
  );
  assert.equal(classifyRequest(local + '/assets/index.js', 'POST'), 'blocked');
});
