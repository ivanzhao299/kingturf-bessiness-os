import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent, AuthorizationContext } from '@kingturf/domain';
import {
  AuthenticationService,
  isCommonPassword,
  DEFAULT_LOGIN_LOCKOUT,
  PasswordHasher,
  type CredentialStore,
} from '../src/security.js';
import { secret } from '../src/app-values.js';

const options = {
  saltBytes: 16,
  keyLength: 32,
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
} as const;

const actor: AuthorizationContext = {
  actor: { employeeId: 'employee', companyId: 'company' },
  permissions: new Map(),
};

describe('credential parsing and screening contracts (A-F2a)', () => {
  it('keeps credential bytes intact: secret never trims, string still trims', () => {
    expect(secret('  padded secret  ', 'password')).toBe('  padded secret  ');
    expect(secret('trailing   ', 'password')).toBe('trailing   ');
    expect(() => secret('', 'password')).toThrow(/password is required/u);
    expect(() => secret(42, 'password')).toThrow(/password is required/u);
  });

  it('rejects oversized passwords before driving scrypt (A2-F7)', async () => {
    const hasher = new PasswordHasher(options);
    await expect(hasher.hash('a'.repeat(513))).rejects.toThrow(/at most 512 characters/u);
    await expect(hasher.hash('a'.repeat(512))).resolves.toMatch(/^scrypt\$/u);
  });

  it('screens common passwords on change and provision (A2-F7)', async () => {
    expect(isCommonPassword('password')).toBe(true);
    expect(isCommonPassword('correct horse battery staple')).toBe(false);
    const currentHash = await new PasswordHasher(options).hash('current-password-x');
    const store: CredentialStore = {
      findForLogin: () => Promise.resolve(null),
      recordLoginFailure: () => Promise.resolve(),
      createSession: () => Promise.resolve(true),
      resolveSession: () => Promise.resolve(null),
      revokeSession: () => Promise.resolve(false),
      findPasswordForEmployee: () => Promise.resolve(currentHash),
      replacePasswordForEmployee: () => Promise.resolve(),
      provisionIdentity: () => Promise.resolve('identity-2'),
    };
    const service = new AuthenticationService(
      store,
      new PasswordHasher(options),
      { secret: 'server-secret', ttlSeconds: 3600, idleSeconds: 3600 },
      { record: () => Promise.resolve() },
    );
    await expect(
      service.changePassword(actor, 'current-password-x', '123456', 'token', 'corr-1'),
    ).rejects.toThrow(/must not be a common password/u);
    await expect(
      service.provisionIdentity(actor, 'employee-2', 'newlogin', 'qwerty123', 'corr-2'),
    ).rejects.toThrow(/must not be a common password/u);
  });

  it('rejects a new password equal to the current password (A2-F7)', async () => {
    const hasher = new PasswordHasher(options);
    const passwordHash = await hasher.hash('current-password-x');
    const store: CredentialStore = {
      findForLogin: () => Promise.resolve(null),
      recordLoginFailure: () => Promise.resolve(),
      createSession: () => Promise.resolve(true),
      resolveSession: () => Promise.resolve(null),
      revokeSession: () => Promise.resolve(false),
      findPasswordForEmployee: () => Promise.resolve(passwordHash),
      replacePasswordForEmployee: () => Promise.resolve(),
      provisionIdentity: () => Promise.resolve('identity-2'),
    };
    const service = new AuthenticationService(
      store,
      hasher,
      { secret: 'server-secret', ttlSeconds: 3600, idleSeconds: 3600 },
      { record: () => Promise.resolve() },
    );
    await expect(
      service.changePassword(actor, 'current-password-x', 'current-password-x', 'token', 'corr-3'),
    ).rejects.toThrow(/must differ from the current password/u);
  });

  it('keeps the timing of locked logins identical to plain failures (A2-F1)', async () => {
    const hasher = new PasswordHasher(options);
    const passwordHash = await hasher.hash('correct horse battery');
    const verify = vi.spyOn(hasher, 'verify');
    const audits: AuditEvent[] = [];
    const failures: Parameters<CredentialStore['recordLoginFailure']>[0][] = [];
    const lockedUntil = new Date(Date.now() + 600_000);
    const makeStore = (locked: boolean): CredentialStore => ({
      findForLogin: () =>
        Promise.resolve({
          identityId: 'identity',
          employeeId: 'employee',
          companyId: 'company',
          passwordHash,
          identityActive: true,
          employeeActive: true,
          memberActive: true,
          failedAttempts: locked ? DEFAULT_LOGIN_LOCKOUT.attempts : 0,
          lockedUntil: locked ? lockedUntil : null,
        }),
      recordLoginFailure: (input) => {
        failures.push(input);
        return Promise.resolve();
      },
      createSession: () => Promise.resolve(true),
      resolveSession: () => Promise.resolve(null),
      revokeSession: () => Promise.resolve(false),
      findPasswordForEmployee: () => Promise.resolve(null),
      replacePasswordForEmployee: () => Promise.resolve(),
      provisionIdentity: () => Promise.resolve('identity-2'),
    });
    const audit = {
      record: (event: AuditEvent) => {
        audits.push(event);
        return Promise.resolve();
      },
    };
    const lockedService = new AuthenticationService(
      makeStore(true),
      hasher,
      { secret: 'server-secret', ttlSeconds: 3600, idleSeconds: 3600 },
      audit,
      DEFAULT_LOGIN_LOCKOUT,
    );
    await expect(
      lockedService.login('admin', 'correct horse battery', 'corr-locked'),
    ).resolves.toBeNull();
    const plainService = new AuthenticationService(
      makeStore(false),
      hasher,
      { secret: 'server-secret', ttlSeconds: 3600, idleSeconds: 3600 },
      audit,
      DEFAULT_LOGIN_LOCKOUT,
    );
    await expect(plainService.login('admin', 'wrong-password', 'corr-plain')).resolves.toBeNull();
    // Both paths ran exactly one scrypt verify against the stored credential.
    expect(verify).toHaveBeenCalledTimes(2);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({
      identityId: 'identity',
      attempts: DEFAULT_LOGIN_LOCKOUT.attempts,
      windowSeconds: DEFAULT_LOGIN_LOCKOUT.windowSeconds,
    });
    expect(audits.map((event) => [event.action, event.outcome])).toEqual([
      ['auth.rate_limited', 'FAILURE'],
      ['auth.login', 'FAILURE'],
    ]);
    const lockoutAudit = audits[0];
    if (!lockoutAudit) throw new Error('lockout audit event missing');
    expect(lockoutAudit.metadata).toEqual({ reason: 'persistent_lockout' });
  });

  it('does not extend the fixed lock window nor record failures while locked', async () => {
    const hasher = new PasswordHasher(options);
    const failures: unknown[] = [];
    const irrelevantHash = await hasher.hash('irrelevant-password');
    const store: CredentialStore = {
      findForLogin: () =>
        Promise.resolve({
          identityId: 'identity',
          employeeId: 'employee',
          companyId: 'company',
          passwordHash: irrelevantHash,
          identityActive: true,
          employeeActive: true,
          memberActive: true,
          failedAttempts: 7,
          lockedUntil: new Date(Date.now() + 600_000),
        }),
      recordLoginFailure: (input) => {
        failures.push(input);
        return Promise.resolve();
      },
      createSession: () => Promise.resolve(true),
      resolveSession: () => Promise.resolve(null),
      revokeSession: () => Promise.resolve(false),
      findPasswordForEmployee: () => Promise.resolve(null),
      replacePasswordForEmployee: () => Promise.resolve(),
      provisionIdentity: () => Promise.resolve('identity-2'),
    };
    const service = new AuthenticationService(
      store,
      hasher,
      { secret: 'server-secret', ttlSeconds: 3600, idleSeconds: 3600 },
      { record: () => Promise.resolve() },
      DEFAULT_LOGIN_LOCKOUT,
    );
    await expect(service.login('admin', 'anything', 'corr-x')).resolves.toBeNull();
    expect(failures).toHaveLength(0);
  });
});
