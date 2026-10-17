// Opt-in diagnostics in the owned API only. Preserve SQL/results; never emit query text or values.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../packages/database/package.json', import.meta.url));
const { Client } = require('pg');
const original = Client.prototype.query;
Client.prototype.query = function (...args) {
  const result = original.apply(this, args);
  if (!result || typeof result.catch !== 'function') return result;
  return result.catch((error) => {
    const code = /^[A-Z0-9]{5}$/u.test(error.code ?? '') ? error.code : 'unknown';
    const constraint = /^[a-zA-Z0-9_]{1,128}$/u.test(error.constraint ?? '')
      ? error.constraint
      : 'unavailable';
    const locations = [
      ...String(error.stack ?? '').matchAll(/\/apps\/api\/src\/[a-zA-Z0-9_/-]+\.ts:\d+:\d+/gu),
    ].map((match) => match[0]);
    const categories = new Map([
      [
        'production close requires serialized finished quantity',
        'production-close-serialized-quantity',
      ],
      ['production order event sequence must be contiguous', 'production-event-sequence'],
      ['completed production order can only close', 'production-completed-transition'],
      ['closed production order is immutable', 'production-closed-immutable'],
      ['active production order can only complete or cancel', 'production-active-transition'],
      ['released production order can only start or cancel', 'production-released-transition'],
      ['draft production order can only be released or cancelled', 'production-draft-transition'],
    ]);
    const category = categories.get(error.message) ?? 'unclassified';
    const context = String(error.where ?? '').match(/function ([a-z_]+)\(\) line (\d+)/u);
    process.stderr.write(
      `${JSON.stringify({ kind: 'owned-pg-failure', code, constraint, locations, category, trigger: context?.[1], triggerLine: context ? Number(context[2]) : undefined })}\n`,
    );
    throw error;
  });
};
