import { describe, expect, it } from 'vitest';
import { ConfigurationError, parseEnvironment } from './index.js';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://app:test@localhost/test',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  SESSION_SECRET: 'test-only-non-placeholder',
  SESSION_TTL_SECONDS: '3600',
  PASSWORD_SALT_BYTES: '16',
  PASSWORD_KEY_LENGTH: '64',
  PASSWORD_SCRYPT_COST: '16384',
  PASSWORD_SCRYPT_BLOCK_SIZE: '8',
  PASSWORD_SCRYPT_PARALLELIZATION: '1',
  ATTACHMENT_STORAGE_ADAPTER: 'local',
  ATTACHMENT_LOCAL_DIRECTORY: '/tmp/kingturf-test-attachments',
  WEBSITE_LEAD_INGEST_SECRET: 'test-website-lead-ingest-secret-at-least-32-characters',
};
describe('parseEnvironment', () => {
  it('returns an immutable typed configuration', () => {
    expect(Object.isFrozen(parseEnvironment(valid).session)).toBe(true);
  });
  it('rejects missing and placeholder secrets', () => {
    expect(() => parseEnvironment({ ...valid, SESSION_SECRET: 'change-me' })).toThrow(
      ConfigurationError,
    );
    expect(() => parseEnvironment({ ...valid, DATABASE_URL: '' })).toThrow(
      'DATABASE_URL is required',
    );
  });
  it('requires production transport and secret strength', () => {
    expect(() =>
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        DATABASE_URL: `${valid.DATABASE_URL}?sslmode=disable`,
      }),
    ).toThrow(ConfigurationError);
    expect(() =>
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough',
        ATTACHMENT_LOCAL_DIRECTORY: '/var/lib/kingturf/attachments',
        WEBSITE_LEAD_INGEST_SECRET: '',
      }),
    ).toThrow(/WEBSITE_LEAD_INGEST_SECRET/u);
  });
  it('selects local storage explicitly and requires a durable production path', () => {
    expect(parseEnvironment(valid).attachmentStorage.adapter).toBe('local');
    expect(() => parseEnvironment({ ...valid, ATTACHMENT_STORAGE_ADAPTER: 's3' })).toThrow(
      /unsupported/u,
    );
    expect(() =>
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough',
      }),
    ).toThrow(/attachment storage/u);
    expect(
      parseEnvironment({
        ...valid,
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-production-secret-that-is-long-enough',
        ATTACHMENT_LOCAL_DIRECTORY: '/var/lib/kingturf/attachments',
      }).attachmentStorage.directory,
    ).toBe('/var/lib/kingturf/attachments');
  });
});
