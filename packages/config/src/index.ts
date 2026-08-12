export const DEFAULT_API_PORT = 3000;

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl: string;
  api: Readonly<{ host: string; port: number }>;
  session: Readonly<{ secret: string; ttlSeconds: number }>;
  password: Readonly<{
    saltBytes: number;
    keyLength: number;
    cost: number;
    blockSize: number;
    parallelization: number;
  }>;
  attachmentStorage: Readonly<{ adapter: 'local'; directory: string }>;
}>;

export class ConfigurationError extends Error {}

export type EnvironmentRecord = Readonly<Record<string, string | undefined>>;

const PLACEHOLDERS = new Set([
  'change-me',
  'changeme',
  'placeholder',
  'secret',
  'local-development-only',
]);
const POSTGRES_CONNECTION_STRING =
  /^postgres(?:ql)?:\/\/(?:[^\s/?#]+@)?(?:\[[0-9a-f:]+\]|[^\s/:?#]+)(?::[0-9]+)?\/[^\s/?#]+(?:\?[^\s#]*)?(?:#\S*)?$/iu;

function required(env: EnvironmentRecord, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new ConfigurationError(`${key} is required`);
  return value;
}
function integer(env: EnvironmentRecord, key: string, minimum: number, maximum: number): number {
  const value = Number(required(env, key));
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationError(
      `${key} must be an integer between ${String(minimum)} and ${String(maximum)}`,
    );
  }
  return value;
}

export function parseEnvironment(env: EnvironmentRecord): AppConfig {
  const nodeEnv = required(env, 'NODE_ENV');
  if (!['development', 'test', 'production'].includes(nodeEnv))
    throw new ConfigurationError('NODE_ENV is invalid');
  const databaseUrl = required(env, 'DATABASE_URL');
  if (!POSTGRES_CONNECTION_STRING.test(databaseUrl)) {
    throw new ConfigurationError('DATABASE_URL must use PostgreSQL');
  }
  const secret = required(env, 'SESSION_SECRET');
  if (PLACEHOLDERS.has(secret.toLowerCase()))
    throw new ConfigurationError('SESSION_SECRET must not be a placeholder');
  if (nodeEnv === 'production' && secret.length < 32)
    throw new ConfigurationError(
      'SESSION_SECRET must contain at least 32 characters in production',
    );
  if (nodeEnv === 'production' && /[?&]sslmode=disable(?:&|#|$)/iu.test(databaseUrl)) {
    throw new ConfigurationError('DATABASE_URL must not disable TLS in production');
  }
  const attachmentAdapter = required(env, 'ATTACHMENT_STORAGE_ADAPTER');
  if (attachmentAdapter !== 'local')
    throw new ConfigurationError('ATTACHMENT_STORAGE_ADAPTER is unsupported');
  if (nodeEnv === 'production')
    throw new ConfigurationError('Local attachment storage is forbidden in production');
  const config: AppConfig = {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    databaseUrl,
    api: { host: required(env, 'API_HOST'), port: integer(env, 'API_PORT', 1, 65_535) },
    session: { secret, ttlSeconds: integer(env, 'SESSION_TTL_SECONDS', 60, 2_592_000) },
    password: {
      saltBytes: integer(env, 'PASSWORD_SALT_BYTES', 16, 64),
      keyLength: integer(env, 'PASSWORD_KEY_LENGTH', 32, 128),
      cost: integer(env, 'PASSWORD_SCRYPT_COST', 16_384, 1_048_576),
      blockSize: integer(env, 'PASSWORD_SCRYPT_BLOCK_SIZE', 8, 32),
      parallelization: integer(env, 'PASSWORD_SCRYPT_PARALLELIZATION', 1, 16),
    },
    attachmentStorage: {
      adapter: 'local',
      directory: required(env, 'ATTACHMENT_LOCAL_DIRECTORY'),
    },
  };
  return Object.freeze({
    ...config,
    api: Object.freeze(config.api),
    session: Object.freeze(config.session),
    password: Object.freeze(config.password),
    attachmentStorage: Object.freeze(config.attachmentStorage),
  });
}
