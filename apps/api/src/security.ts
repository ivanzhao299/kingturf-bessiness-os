import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '@kingturf/config';
import { COMMON_PASSWORDS } from '@kingturf/config';
import { DomainError, type AuditSink, type AuthorizationContext } from '@kingturf/domain';
import { SessionProof } from './session-proof.ts';

const scrypt = (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: Parameters<typeof nodeScrypt>[3],
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (failure, result) => {
      if (failure) reject(failure);
      else resolve(result);
    });
  });
export type CredentialStore = {
  findForLogin(normalizedLogin: string): Promise<Readonly<{
    identityId: string;
    employeeId: string;
    companyId: string;
    passwordHash: string;
    identityActive: boolean;
    employeeActive: boolean;
    memberActive: boolean;
    failedAttempts: number;
    lockedUntil: Date | null;
  }> | null>;
  recordLoginFailure(
    input: Readonly<{ identityId: string; attempts: number; windowSeconds: number }>,
  ): Promise<void>;
  createSession(
    input: Readonly<{
      identityId: string;
      employeeId: string;
      expectedPasswordHash: string;
      correlationId: string;
      organizationId: string;
      tokenHash: string;
      expiresAt: Date;
    }>,
  ): Promise<boolean>;
  revokeSession(tokenHash: string): Promise<boolean>;
  resolveSession(tokenHash: string, now: Date): Promise<AuthorizationContext | null>;
  findPasswordForEmployee(employeeId: string, companyId: string): Promise<string | null>;
  replacePasswordForEmployee(
    input: Readonly<{
      employeeId: string;
      companyId: string;
      expectedPasswordHash: string;
      passwordHash: string;
      tokenHash: string;
      correlationId: string;
    }>,
  ): Promise<void>;
  provisionIdentity(
    input: Readonly<{
      employeeId: string;
      companyId: string;
      login: string;
      passwordHash: string;
      actorId: string;
      correlationId: string;
    }>,
  ): Promise<string>;
};
// A2-F7: common-password screening — SHA-256 membership over the config data set
// (built once per process; packages/config stays free of node imports).
const COMMON_PASSWORD_HASHES: ReadonlySet<string> = new Set(
  [...COMMON_PASSWORDS].map((word) => createHash('sha256').update(word, 'utf8').digest('hex')),
);
export const isCommonPassword = (password: string): boolean =>
  COMMON_PASSWORD_HASHES.has(createHash('sha256').update(password, 'utf8').digest('hex'));

export class PasswordHasher {
  public constructor(private readonly options: AppConfig['password']) {}
  public async hash(password: string): Promise<string> {
    if (password.length < 12)
      throw new DomainError('invalid_request', 'Password must contain at least 12 characters');
    // A2-F7: bound the hashing input so oversized bodies cannot drive scrypt cost.
    if (password.length > 512)
      throw new DomainError('invalid_request', 'Password must contain at most 512 characters');
    const salt = randomBytes(this.options.saltBytes);
    const derived = await scrypt(password, salt, this.options.keyLength, {
      N: this.options.cost,
      r: this.options.blockSize,
      p: this.options.parallelization,
      maxmem: 256 * 1024 * 1024,
    });
    return `scrypt$${String(this.options.cost)}$${String(this.options.blockSize)}$${String(this.options.parallelization)}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
  }
  public async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] = encoded.split('$');
    if (
      algorithm !== 'scrypt' ||
      !cost ||
      !blockSize ||
      !parallelization ||
      !saltValue ||
      !hashValue
    )
      return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: 256 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
export function hashSessionToken(token: string, secret: string): string {
  return createHash('sha256').update(secret).update(token).digest('hex');
}

export type LoginLockoutConfig = Readonly<{ attempts: number; windowSeconds: number }>;

export const DEFAULT_LOGIN_LOCKOUT: LoginLockoutConfig = Object.freeze({
  attempts: 5,
  windowSeconds: 900,
});

export class AuthenticationService {
  readonly #dummyHash: Promise<string>;
  readonly #proof: SessionProof;
  public constructor(
    private readonly store: CredentialStore,
    private readonly hasher: PasswordHasher,
    private readonly config: AppConfig['session'],
    private readonly audit: AuditSink,
    private readonly lockout: LoginLockoutConfig = DEFAULT_LOGIN_LOCKOUT,
  ) {
    this.#dummyHash = hasher.hash('invalid-password-padding');
    this.#proof = new SessionProof(config.secret);
  }
  public async login(
    login: string,
    password: string,
    correlationId: string,
  ): Promise<Readonly<{ token: string; expiresAt: string }> | null> {
    const normalizedLogin = login.trim().toLocaleLowerCase('en-US');
    const credential = await this.store.findForLogin(normalizedLogin);
    // A2-F1: the password check always runs (real or dummy scrypt) so locked and
    // unlocked accounts are indistinguishable by timing.
    const valid = await this.hasher.verify(
      password,
      credential?.passwordHash ?? (await this.#dummyHash),
    );
    const locked =
      credential?.lockedUntil !== null &&
      credential?.lockedUntil !== undefined &&
      credential.lockedUntil.getTime() > Date.now();
    if (
      !credential ||
      !valid ||
      locked ||
      !credential.identityActive ||
      !credential.employeeActive ||
      !credential.memberActive
    ) {
      if (locked) {
        await this.audit.record({
          action: 'auth.rate_limited',
          outcome: 'FAILURE',
          actorId: null,
          organizationId: credential.companyId,
          targetType: 'identity',
          targetId: credential.identityId,
          correlationId,
          metadata: { reason: 'persistent_lockout' },
        });
        return null;
      }
      if (credential && this.lockout.attempts > 0)
        await this.store.recordLoginFailure({
          identityId: credential.identityId,
          attempts: this.lockout.attempts,
          windowSeconds: this.lockout.windowSeconds,
        });
      await this.audit.record({
        action: 'auth.login',
        outcome: 'FAILURE',
        actorId: null,
        organizationId: credential?.companyId ?? null,
        targetType: 'identity',
        targetId: credential?.identityId ?? null,
        correlationId,
      });
      return null;
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.ttlSeconds * 1000);
    const created = await this.store.createSession({
      identityId: credential.identityId,
      employeeId: credential.employeeId,
      expectedPasswordHash: credential.passwordHash,
      correlationId,
      organizationId: credential.companyId,
      tokenHash: hashSessionToken(token, this.config.secret),
      expiresAt,
    });
    if (!created) {
      await this.audit.record({
        action: 'auth.login',
        outcome: 'FAILURE',
        actorId: null,
        organizationId: credential.companyId,
        targetType: 'identity',
        targetId: credential.identityId,
        correlationId,
      });
      return null;
    }
    return { token, expiresAt: expiresAt.toISOString() };
  }
  // A2-F8: sliding-window 429s are audited on the same sink as the persistent
  // lockout hits recorded inside login(); metadata carries no sensitive values.
  public async auditRateLimited(
    correlationId: string,
    metadata: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.audit.record({
      action: 'auth.rate_limited',
      outcome: 'FAILURE',
      actorId: null,
      organizationId: null,
      targetType: null,
      targetId: null,
      correlationId,
      metadata,
    });
  }
  public authenticate(token: string): Promise<AuthorizationContext | null> {
    return this.store.resolveSession(hashSessionToken(token, this.config.secret), new Date());
  }
  public sessionGeneration(token: string): string {
    return this.#proof.generation(token);
  }
  public matchesSessionGeneration(token: string, value: string): boolean {
    return this.#proof.matchesGeneration(token, value);
  }
  public issueCsrfProof(token: string): string {
    return this.#proof.issueSession(token);
  }
  public verifyCsrfProof(token: string, value: string): boolean {
    return this.#proof.verifySession(token, value);
  }
  public issueLoginProof(token: string | null): string {
    return this.#proof.issueLogin(token);
  }
  public verifyLoginProof(token: string | null, value: string): boolean {
    return this.#proof.verifyLogin(token, value);
  }
  public async changePassword(
    context: AuthorizationContext,
    currentPassword: string,
    password: string,
    token: string,
    correlationId: string,
  ): Promise<void> {
    const expectedPasswordHash = await this.store.findPasswordForEmployee(
      context.actor.employeeId,
      context.actor.companyId,
    );
    if (!expectedPasswordHash || !(await this.hasher.verify(currentPassword, expectedPasswordHash)))
      throw new DomainError('forbidden', 'Current password is incorrect');
    // A2-F7: the replacement must differ from the current password and must not
    // be a screened common password.
    if (password === currentPassword)
      throw new DomainError(
        'invalid_request',
        'New password must differ from the current password',
      );
    if (isCommonPassword(password))
      throw new DomainError('invalid_request', 'Password must not be a common password');
    await this.store.replacePasswordForEmployee({
      employeeId: context.actor.employeeId,
      companyId: context.actor.companyId,
      expectedPasswordHash,
      passwordHash: await this.hasher.hash(password),
      tokenHash: hashSessionToken(token, this.config.secret),
      correlationId,
    });
  }
  public async provisionIdentity(
    context: AuthorizationContext,
    employeeId: string,
    login: string,
    password: string,
    correlationId: string,
  ): Promise<void> {
    const normalizedLogin = login.trim().toLocaleLowerCase('en-US');
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/u.test(normalizedLogin))
      throw new Error(
        'Login must contain 3-64 lowercase letters, numbers, dots, underscores or hyphens',
      );
    if (isCommonPassword(password))
      throw new DomainError('invalid_request', 'Password must not be a common password');
    await this.store.provisionIdentity({
      employeeId,
      companyId: context.actor.companyId,
      login: normalizedLogin,
      passwordHash: await this.hasher.hash(password),
      actorId: context.actor.employeeId,
      correlationId,
    });
  }
  public async logout(
    token: string,
    context: AuthorizationContext,
    correlationId: string,
  ): Promise<void> {
    await this.store.revokeSession(hashSessionToken(token, this.config.secret));
    await this.audit.record({
      action: 'auth.logout',
      outcome: 'SUCCESS',
      actorId: context.actor.employeeId,
      organizationId: context.actor.companyId,
      targetType: 'session',
      targetId: null,
      correlationId,
    });
  }
}
