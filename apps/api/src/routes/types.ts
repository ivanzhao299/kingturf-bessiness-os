import type { ApiRequest, ApiResponse } from '../app.ts';

export type RouteMatch = Readonly<{ params: readonly string[] }>;
export type RouteValidator<Input> = (request: ApiRequest, match: RouteMatch) => Input;
export type RouteHandler<Input> = (
  request: ApiRequest,
  match: RouteMatch,
  input: Input,
) => Promise<ApiResponse> | ApiResponse;

export type RouteDefinition<Input = unknown> = Readonly<{
  method: string;
  match: (pathname: string) => RouteMatch | null;
  validate: RouteValidator<Input> | null;
  handler: RouteHandler<Input>;
}>;

export function defineRoute<Input>(definition: RouteDefinition<Input>): RouteDefinition<Input> {
  return definition;
}

export async function dispatchRoutes<Input>(
  routes: readonly RouteDefinition<Input>[],
  request: ApiRequest,
): Promise<ApiResponse | null> {
  for (const route of routes) {
    if (route.method !== request.method) continue;
    const match = route.match(request.pathname);
    if (!match) continue;
    const input = route.validate ? route.validate(request, match) : undefined;
    return route.handler(request, match, input as Input);
  }
  return null;
}
