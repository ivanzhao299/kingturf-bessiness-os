import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  it('reports stable health without external dependencies', async () => {
    const app = buildApp();
    const response = await app.dispatch({ method: 'GET', pathname: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /version', () => {
  it('reports an explicit development identity without runtime dependencies', async () => {
    const app = buildApp();
    const response = await app.dispatch({ method: 'GET', pathname: '/version' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ sha: 'development', environment: 'development' });
  });
});
