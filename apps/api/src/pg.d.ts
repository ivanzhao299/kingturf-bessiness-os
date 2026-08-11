declare module 'pg' {
  export type QueryResultRow = Record<string, unknown>;
  export type QueryResult<T extends QueryResultRow> = { rows: T[]; rowCount: number | null };
  export type PoolClient = {
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    release(): void;
  };
  export class Pool {
    constructor(options: { connectionString: string; max: number });
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
