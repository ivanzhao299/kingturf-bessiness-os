import type { LoginProof } from '../session';
import { parseResponseRecord } from './response-parser';
import { parseSessionProof } from './session-parser';

export function parseLoginProof(value: unknown): LoginProof {
  const record = parseResponseRecord(value);
  if (
    typeof record.csrfToken !== 'string' ||
    !/^v1\.l\.[0-9]{1,13}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/u.test(record.csrfToken)
  )
    throw new Error('服务器返回的登录数据格式无效');
  return record as LoginProof;
}

export function parseLoginResponse(
  value: unknown,
): Readonly<{ expiresAt: string; generation: string; csrfToken: string }> {
  const record = parseResponseRecord(value);
  parseSessionProof(record);
  if (typeof record.expiresAt !== 'string' || !Number.isFinite(Date.parse(record.expiresAt)))
    throw new Error('服务器返回的登录数据格式无效');
  return record as { expiresAt: string; generation: string; csrfToken: string };
}
