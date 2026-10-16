import type { SessionDto } from '../session';
import { parseResponseRecord } from './response-parser';

export function parseStoredSessionToken(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/u.test(value) ? value : null;
}

export const parseSessionExpired = (value: unknown): boolean => value === '1';

export function parseLoginResponse(value: unknown): { token: string } {
  const record = parseResponseRecord(value);
  if (parseStoredSessionToken(record.token) === null)
    throw new Error('服务器返回的登录数据格式无效');
  return record as { token: string };
}

export function parseSessionResponse(value: unknown): SessionDto {
  const record = parseResponseRecord(value);
  if (
    typeof record.employeeId !== 'string' ||
    typeof record.companyId !== 'string' ||
    !Array.isArray(record.permissions) ||
    !record.permissions.every((permission: unknown) => typeof permission === 'string')
  )
    throw new Error('服务器返回的会话数据格式无效');
  for (const key of ['displayName', 'employeeNumber']) {
    const field = record[key];
    if (field !== undefined && field !== null && typeof field !== 'string')
      throw new Error('服务器返回的会话数据格式无效');
  }
  return record as SessionDto;
}
