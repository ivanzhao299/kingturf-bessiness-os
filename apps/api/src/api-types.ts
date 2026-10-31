type Json = unknown;

export type ApiRequest = Readonly<{
  method: string;
  pathname: string;
  query?: Readonly<Record<string, string | undefined>>;
  headers?: Readonly<Record<string, string | undefined>>;
  headersDistinct?: Readonly<Record<string, readonly string[] | undefined>>;
  hasQuery?: boolean;
  body?: unknown;
  peerAddress?: string | undefined;
  forwardedFor?: readonly string[] | undefined;
}>;

export type ApiResponse = Readonly<{
  body: Json;
  statusCode: number;
  headers?: Readonly<Record<string, string | readonly string[]>>;
}>;

export type ApiApplication = Readonly<{
  dispatch(request: ApiRequest): Promise<ApiResponse>;
  rejectOversized(correlationId?: string): ApiResponse;
}>;
