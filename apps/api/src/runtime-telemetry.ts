import type { Telemetry } from '@kingturf/domain';

type MetricEntry = Readonly<{
  level: 'info';
  event: 'metric';
  metric: string;
  kind: 'counter' | 'timing';
  value: number;
  labels: Readonly<Record<string, string>>;
}>;

const METRIC = /^[a-z][a-z0-9_]{0,63}$/u;
const SAFE_LABELS = new Set(['method', 'route', 'status']);

/** A dependency-free runtime sink emitting bounded, payload-free structured metrics. */
export class StructuredTelemetry implements Telemetry {
  public constructor(private readonly write: (entry: MetricEntry) => void) {}

  public count(name: string, value = 1, labels: Readonly<Record<string, string>> = {}): void {
    this.emit('counter', name, value, labels);
  }

  public timing(
    name: string,
    milliseconds: number,
    labels: Readonly<Record<string, string>> = {},
  ): void {
    this.emit('timing', name, milliseconds, labels);
  }

  private emit(
    kind: MetricEntry['kind'],
    metric: string,
    value: number,
    labels: Readonly<Record<string, string>>,
  ): void {
    if (!METRIC.test(metric) || !Number.isFinite(value) || value < 0) return;
    const safeLabels = Object.fromEntries(
      Object.entries(labels).filter(
        ([key, label]) => SAFE_LABELS.has(key) && /^[A-Za-z0-9_-]{1,32}$/u.test(label),
      ),
    );
    this.write({ level: 'info', event: 'metric', metric, kind, value, labels: safeLabels });
  }
}
