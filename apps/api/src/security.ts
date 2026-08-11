import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '@kingturf/config';
import type { AuditSink, AuthorizationContext } from '@kingturf/domain';

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
  }> | null>;
  createSession(
    input: Readonly<{
      identityId: string;
      organizationId: string;
      tokenHash: string;
      expiresAt: Date;
    }>,
  ): Promise<void>;
  revokeSession(tokenHash: string): Promise<boolean>;
  resolveSession(tokenHash: string, now: Date): Promise<AuthorizationContext | null>;
  replacePasswordForEmployee(employeeId: string, passwordHash: string): Promise<void>;
};
export class PasswordHasher {
  public constructor(private readonly options: AppConfig['password']) {}
  public async hash(password: string): Promise<string> {
    if (password.length < 12) throw new Error('Password must contain at least 12 characters');
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

export class AuthenticationService {
  readonly #dummyHash: Promise<string>;
  public constructor(
    private readonly store: CredentialStore,
    private readonly hasher: PasswordHasher,
    private readonly config: AppConfig['session'],
    private readonly audit: AuditSink,
  ) {
    this.#dummyHash = hasher.hash('invalid-password-padding');
  }
  public async login(
    login: string,
    password: string,
    correlationId: string,
  ): Promise<Readonly<{ token: string; expiresAt: string }> | null> {
    const normalizedLogin = login.trim().toLocaleLowerCase('en-US');
    const credential = await this.store.findForLogin(normalizedLogin);
    const valid = await this.hasher.verify(
      password,
      credential?.passwordHash ?? (await this.#dummyHash),
    );
    if (
      !credential ||
      !valid ||
      !credential.identityActive ||
      !credential.employeeActive ||
      !credential.memberActive
    ) {
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
    await this.store.createSession({
      identityId: credential.identityId,
      organizationId: credential.companyId,
      tokenHash: hashSessionToken(token, this.config.secret),
      expiresAt,
    });
    await this.audit.record({
      action: 'auth.login',
      outcome: 'SUCCESS',
      actorId: credential.employeeId,
      organizationId: credential.companyId,
      targetType: 'identity',
      targetId: credential.identityId,
      correlationId,
    });
    return { token, expiresAt: expiresAt.toISOString() };
  }
  public authenticate(token: string): Promise<AuthorizationContext | null> {
    return this.store.resolveSession(hashSessionToken(token, this.config.secret), new Date());
  }
  public async changePassword(
    context: AuthorizationContext,
    password: string,
    correlationId: string,
  ): Promise<void> {
    await this.store.replacePasswordForEmployee(
      context.actor.employeeId,
      await this.hasher.hash(password),
    );
    await this.audit.record({
      action: 'auth.password_change',
      outcome: 'SUCCESS',
      actorId: context.actor.employeeId,
      organizationId: context.actor.companyId,
      targetType: 'employee',
      targetId: context.actor.employeeId,
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
