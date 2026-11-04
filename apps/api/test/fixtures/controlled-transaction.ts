import { setTimeout as delay } from 'node:timers/promises';
import type { Database, SqlClient } from '@kingturf/database';

export function signal<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  void promise.catch(() => {
    /* Some checkpoints have no observer; the transaction outcome still propagates failure. */
  });
  return { promise, resolve, reject };
}

/** Interposes only transaction scheduling. All queries and evidence use real PG connections. */
export function controlledTransaction(database: Database, pauseAfterWork = false) {
  const started = signal<number>(),
    written = signal<undefined>(),
    resume = signal<undefined>();
  const db: SqlClient & Pick<Database, 'transaction'> = {
    query: database.query.bind(database),
    transaction: async (work) => {
      try {
        return await database.transaction(async (tx) => {
          const pid = (await tx.query<{ pid: number }>('SELECT pg_backend_pid() pid')).rows[0]?.pid;
          if (!pid) throw new Error('Owned transaction backend missing');
          started.resolve(pid);
          const result = await work(tx);
          written.resolve(undefined);
          if (pauseAfterWork) await resume.promise;
          return result;
        });
      } catch (error) {
        started.reject(error);
        written.reject(error);
        throw error;
      }
    },
  };
  return {
    db,
    started: started.promise,
    written: written.promise,
    release: () => {
      resume.resolve(undefined);
    },
  };
}

export const outcome = <T>(pending: Promise<T>) =>
  pending.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

export async function waitForBlocking(database: SqlClient, waiter: number, blocker: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const row = (
      await database.query<{ blocked: boolean }>(
        'SELECT $2::int=ANY(pg_blocking_pids($1::int)) blocked',
        [waiter, blocker],
      )
    ).rows[0];
    if (row?.blocked) return;
    await delay(20);
  }
  throw new Error('Expected competing PostgreSQL backend did not block on the held resource');
}

export async function bounded<T>(pending: Promise<T>, milliseconds = 2000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Owned transaction coordination deadline exceeded'));
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
