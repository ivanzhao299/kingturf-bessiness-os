import type { credentialRoutes } from '../auth.ts';
import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest, ApiResponse } from '../../api-types.ts';
import type { ApiDependencies } from '../../app.ts';

export type RouteDispatchContext = Readonly<{
  request: ApiRequest;
  dependencies: ApiDependencies;
  context: AuthorizationContext;
  correlationId: string;
}>;
export type AuthenticatedRouteDispatchContext = RouteDispatchContext &
  Readonly<{ securedAuthContext: Parameters<typeof credentialRoutes>[0] }>;
type Projection<Result, Reply> = { project(value: Awaited<Result>): Reply }['project'];
type ContinueAcceptance = 'non-null' | 'truthy';
type Acceptance = ContinueAcceptance | 'always';
// Nominal pairing prevents handwritten/spread objects from replacing either half.
class PendingReply<Result, Reply, Accept extends Acceptance> {
  public readonly kind = 'pending';
  readonly #projector: Projection<Result, Reply>;
  private constructor(
    public readonly pending: Promise<Result>,
    project: Projection<Result, Reply>,
    public readonly accept: Accept,
  ) {
    this.#projector = project;
    Object.freeze(this);
  }
  public project(value: Awaited<Result>): Reply {
    return this.#projector(value);
  }
  public static pair<Result, Reply, Accept extends Acceptance>(
    pending: Promise<Result>,
    project: (value: Awaited<Result>) => Reply,
    accept: Accept,
  ): PendingReply<Result, Reply, Accept> {
    return new PendingReply(pending, project, accept);
  }
}
export type RouteAttempt =
  | Readonly<{ kind: 'immediate'; value: ApiResponse }>
  | PendingReply<unknown, ApiResponse, 'always'>
  | PendingReply<unknown, ApiResponse | null, ContinueAcceptance>;
export type RouteAttempts = Iterable<RouteAttempt>;
export function projectedReply<Result>(
  pending: Promise<Result>,
  project: (value: Awaited<Result>) => ApiResponse,
): PendingReply<Result, ApiResponse, 'always'> {
  return PendingReply.pair(pending, project, 'always');
}
export function routeReply(
  pending: Promise<ApiResponse | null>,
  accept: ContinueAcceptance = 'non-null',
): PendingReply<ApiResponse | null, ApiResponse | null, ContinueAcceptance> {
  return PendingReply.pair(pending, (value) => value, accept);
}

export type DependencyScope<Port extends keyof ApiDependencies> = RouteDispatchContext & {
  readonly dependencies: ApiDependencies & {
    readonly [Key in Port]-?: NonNullable<ApiDependencies[Key]>;
  };
};
// Exactly the original presence test. Never cache the repository or widen its authorization.
export function dependencyPresent<Port extends keyof ApiDependencies>(
  scope: RouteDispatchContext,
  port: Port,
): scope is DependencyScope<Port> {
  return !!scope.dependencies[port];
}

export function directReply(value: ApiResponse): RouteAttempt {
  return Object.freeze({ kind: 'immediate', value });
}
