import type { SessionState, SessionContext, SessionResponse } from './session';
function sameSessionIdentity(context: SessionContext, value: SessionResponse): boolean {
  return (
    context.generation === value.generation &&
    context.session.employeeId === value.employeeId &&
    context.session.companyId === value.companyId &&
    context.session.permissions.length === value.permissions.length &&
    context.session.permissions.every((permission) => value.permissions.includes(permission))
  );
}

/** Same identity keeps its immutable context and form; only a changed identity is remounted. */
export async function revalidateSession(
  state: SessionState,
  captured: SessionContext,
  restore: () => Promise<SessionResponse>,
  isFresh: () => boolean = () => true,
): Promise<'unchanged' | 'changed' | 'manual' | 'stale'> {
  if (!state.isCurrent(captured) || !isFresh()) return 'stale';
  captured.owner.pause();
  const value = await restore();
  if (!state.isCurrent(captured) || !isFresh()) return 'stale';
  if (!sameSessionIdentity(captured, value)) return 'changed';
  if (captured.csrfToken !== value.csrfToken) return 'manual';
  captured.owner.resume();
  return 'unchanged';
}

export {
  SessionSignals,
  restoreCurrentSession,
  sessionInvalidationMessage,
} from './session-signals';
