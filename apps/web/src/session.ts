export type SessionDto = Readonly<{
  employeeId: string;
  companyId: string;
  displayName: string | null;
  employeeNumber: string | null;
  permissions: readonly string[];
}>;

export class SessionOwner {
  private active = true;
  private writable = true;
  private readonly cleanups = new Set<() => void>();
  public isCurrent(): boolean {
    return this.active;
  }
  public canWrite(): boolean {
    return this.active && this.writable;
  }
  public pause(): void {
    this.writable = false;
  }
  public resume(): void {
    if (this.active) this.writable = true;
  }
  public onDispose(cleanup: () => void): void {
    if (this.active) this.cleanups.add(cleanup);
    else cleanup();
  }
  public dispose(): void {
    if (!this.active) return;
    this.active = false;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
  }
}

export type SessionResponse = SessionDto & Readonly<{ generation: string; csrfToken: string }>;
export type LoginProof = Readonly<{ csrfToken: string }>;
export type SessionContext = Readonly<{
  session: SessionDto;
  generation: string;
  csrfToken: string;
  owner: SessionOwner;
  epoch: number;
}>;

export class SessionState {
  public current: SessionContext | null = null;
  private revision = 0;
  public begin(): number {
    this.current?.owner.dispose();
    this.current = null;
    return ++this.revision;
  }
  public accepts(epoch: number): boolean {
    return epoch === this.revision;
  }
  public install(value: SessionResponse, epoch: number): SessionContext | null {
    if (!this.accepts(epoch)) return null;
    this.current?.owner.dispose();
    const session = Object.freeze({
      employeeId: value.employeeId,
      companyId: value.companyId,
      displayName: value.displayName,
      employeeNumber: value.employeeNumber,
      permissions: Object.freeze([...value.permissions]),
    });
    const context = Object.freeze({
      session,
      generation: value.generation,
      csrfToken: value.csrfToken,
      owner: new SessionOwner(),
      epoch,
    });
    this.current = context;
    return context;
  }
  public isCurrent(context: SessionContext): boolean {
    return this.current === context && this.accepts(context.epoch) && context.owner.isCurrent();
  }
}

export { clearLegacySession } from './legacy-session';

/** Match the captured owner/epoch so a delayed response cannot invalidate a newer UI. */
export function expireSession(
  context: SessionContext | null,
  state: SessionState,
  expired: () => void,
): boolean {
  if (!context || !state.isCurrent(context)) return false;
  state.begin();
  expired();
  return true;
}
