import type { SessionResponse } from './session';

export class SessionSignals {
  private count = 0;
  public notify(): void {
    this.count += 1;
  }
  public get revision(): number {
    return this.count;
  }
}

export async function restoreCurrentSession(
  signals: SessionSignals,
  restore: () => Promise<SessionResponse>,
): Promise<Readonly<{ value: SessionResponse; revision: number }>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const revision = signals.revision;
    try {
      const value = await restore();
      if (signals.revision === revision) return { value, revision };
    } catch (error) {
      if (signals.revision === revision) throw error;
    }
  }
  throw new Error('Session changed');
}

export function sessionInvalidationMessage(value: unknown): boolean {
  return value === 'invalidate';
}
