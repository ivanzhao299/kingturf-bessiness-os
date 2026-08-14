import { describe, expect, it, vi } from 'vitest';
import { StructuredTelemetry } from '../src/runtime-telemetry.js';

describe('StructuredTelemetry', () => {
  it('emits bounded operational labels without sensitive or arbitrary payloads', () => {
    const write = vi.fn();
    const telemetry = new StructuredTelemetry(write);
    telemetry.count('http_requests_total', 1, {
      method: 'GET',
      route: 'api',
      status: '200',
      authorization: 'Bearer secret',
      tenant: 'sensitive',
    });
    expect(write).toHaveBeenCalledWith({
      level: 'info',
      event: 'metric',
      metric: 'http_requests_total',
      kind: 'counter',
      value: 1,
      labels: { method: 'GET', route: 'api', status: '200' },
    });
  });

  it('drops invalid metric names and values', () => {
    const write = vi.fn();
    const telemetry = new StructuredTelemetry(write);
    telemetry.timing('unsafe.metric', Number.NaN);
    expect(write).not.toHaveBeenCalled();
  });
});
