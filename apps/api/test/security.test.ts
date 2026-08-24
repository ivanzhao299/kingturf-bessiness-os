import { describe, expect, it } from 'vitest';
import type { AuditEvent, AuthorizationContext } from '@kingturf/domain';
import {
  AuthenticationService,
  PasswordHasher,
  hashSessionToken,
  type CredentialStore,
} from '../src/security.js';
import { dataScopeSql } from '../src/policy.js';
const options = {
  saltBytes: 16,
  keyLength: 32,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
} as const;
describe('password and session security', () => {
  it('salts and verifies memory-hard password hashes', async () => {
    const hasher = new PasswordHasher(options);
    const first = await hasher.hash('correct horse battery');
    const second = await hasher.hash('correct horse battery');
    expect(first).not.toBe(second);
    await expect(hasher.verify('correct horse battery', first)).resolves.toBe(true);
    await expect(hasher.verify('wrong password', first)).resolves.toBe(false);
  });
  it('hashes opaque tokens with the server secret', () => {
    expect(hashSessionToken('token', 'secret')).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashSessionToken('token', 'secret')).not.toContain('token');
  });
  it('runs the login, session validation, and logout lifecycle without storing the raw token', async () => {
    const hasher = new PasswordHasher(options);
    const passwordHash = await hasher.hash('correct horse battery');
    let storedHash = '';
    let revoked = false;
    const audits: AuditEvent[] = [];
    const authorization: AuthorizationContext = {
      actor: { employeeId: 'employee', companyId: 'company' },
      permissions: new Map(),
    };
    const store: CredentialStore = {
      findForLogin: () =>
        Promise.resolve({
          identityId: 'identity',
          employeeId: 'employee',
          companyId: 'company',
          passwordHash,
          identityActive: true,
          employeeActive: true,
          memberActive: true,
        }),
      createSession: (input) => {
        storedHash = input.tokenHash;
        return Promise.resolve();
      },
      resolveSession: (tokenHash) =>
        Promise.resolve(!revoked && tokenHash === storedHash ? authorization : null),
      revokeSession: (tokenHash) => {
        revoked = tokenHash === storedHash;
        return Promise.resolve(revoked);
      },
      replacePasswordForEmployee: () => Promise.resolve(),
      provisionIdentity: () => Promise.resolve('identity-2'),
    };
    const service = new AuthenticationService(
      store,
      hasher,
      { secret: 'server-secret', ttlSeconds: 3600 },
      {
        record: (event) => {
          audits.push(event);
          return Promise.resolve();
        },
      },
    );
    const login = await service.login(
      'ADMIN',
      'correct horse battery',
      '10000000-0000-4000-8000-000000000001',
    );
    expect(login?.token).toBeTruthy();
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(storedHash).not.toBe(login?.token);
    await expect(service.authenticate(login?.token ?? '')).resolves.toEqual(authorization);
    await service.logout(login?.token ?? '', authorization, '10000000-0000-4000-8000-000000000001');
    await expect(service.authenticate(login?.token ?? '')).resolves.toBeNull();
    expect(audits.map((event) => event.action)).toEqual(['auth.login', 'auth.logout']);
  });
  it('provisions a tenant-bound identity without exposing the password hash', async () => {
    const hasher = new PasswordHasher(options);
    let provisioned: Parameters<CredentialStore['provisionIdentity']>[0] | undefined;
    const audits: AuditEvent[] = [];
    const store: CredentialStore = {
      findForLogin: () => Promise.resolve(null),
      createSession: () => Promise.resolve(),
      resolveSession: () => Promise.resolve(null),
      revokeSession: () => Promise.resolve(false),
      replacePasswordForEmployee: () => Promise.resolve(),
      provisionIdentity: (input) => {
        provisioned = input;
        return Promise.resolve('identity-2');
      },
    };
    const service = new AuthenticationService(
      store,
      hasher,
      { secret: 'server-secret', ttlSeconds: 3600 },
      {
        record: (event) => {
          audits.push(event);
          return Promise.resolve();
        },
      },
    );
    const context: AuthorizationContext = {
      actor: { employeeId: 'admin', companyId: 'company' },
      permissions: new Map(),
    };
    await service.provisionIdentity(
      context,
      'approver',
      'KT-COST-APPROVER',
      'correct horse battery',
      '10000000-0000-4000-8000-000000000001',
    );
    expect(provisioned).toMatchObject({
      employeeId: 'approver',
      companyId: 'company',
      login: 'kt-cost-approver',
      actorId: 'admin',
    });
    expect(provisioned?.passwordHash).not.toContain('correct horse battery');
    expect(audits.map((event) => event.action)).toEqual(['auth.identity_provision']);
  });
});
describe('DataScope predicates', () => {
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY'] as const)(
    'builds a repository predicate for %s',
    (scope) => {
      const result = dataScopeSql([scope]);
      expect(result.sql).not.toBe('FALSE');
    },
  );
  it('defaults to deny and treats GROUP as unrestricted', () => {
    expect(dataScopeSql([]).sql).toBe('FALSE');
    expect(dataScopeSql(['GROUP']).sql).toBe('TRUE');
  });
});
