import type { ApiRequest, ApiResponse } from '../app.ts';

export type RouteMatch = Readonly<{ params: readonly string[] }>;
export type RouteValidator<Input> = (request: ApiRequest, match: RouteMatch) => Input;
type BivariantHandler<Input> = {
  bivarianceHack(
    request: ApiRequest,
    match: RouteMatch,
    input: Input,
  ): Promise<ApiResponse> | ApiResponse;
}['bivarianceHack'];
export type RouteHandler<Input> = BivariantHandler<Input>;
/*
 * Handler input is intentionally bivariant so a heterogeneous route table can
 * be stored behind an unknown boundary without any or unsafe casts.
 */

export type RouteDefinition<Input = unknown> = Readonly<{
  method: string;
  match: (pathname: string) => RouteMatch | null;
  preflight?: (
    request: ApiRequest,
    match: RouteMatch,
  ) => ApiResponse | null | Promise<ApiResponse | null>;
  validate: RouteValidator<Input> | null;
  handler: RouteHandler<Input>;
}>;

export function defineRoute<Input>(definition: RouteDefinition<Input>): RouteDefinition<Input> {
  return definition;
}

export async function dispatchRoutes(
  routes: readonly RouteDefinition[],
  request: ApiRequest,
): Promise<ApiResponse | null> {
  for (const route of routes) {
    if (route.method !== request.method) continue;
    const match = route.match(request.pathname);
    if (!match) continue;
    if (route.preflight) {
      const response = await route.preflight(request, match);
      if (response !== null) return response;
    }
    const input = route.validate ? route.validate(request, match) : undefined;
    return route.handler(request, match, input);
  }
  return null;
}
