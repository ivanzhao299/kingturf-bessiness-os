import type { SessionDto, SessionResponse } from '../session';
import { parseResponseRecord } from './response-parser';

export function parseSessionProof(record: Record<string, unknown>): void {
  if ('token' in record || 'tokenHash' in record) throw new Error('服务器返回的会话数据格式无效');
  if (
    typeof record.generation !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/u.test(record.generation) ||
    typeof record.csrfToken !== 'string' ||
    !/^v1\.s\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/u.test(record.csrfToken)
  )
    throw new Error('服务器返回的会话数据格式无效');
}

export function parseSessionRestore(value: unknown): SessionResponse {
  const record = sessionRecord(value);
  parseSessionProof(record);
  return record as SessionResponse;
}

export function parseSessionResponse(value: unknown): SessionDto {
  return sessionRecord(value) as SessionDto;
}

function sessionRecord(value: unknown): Record<string, unknown> {
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
  return record;
}
