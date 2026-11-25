type RelatedRoute = 'sales-orders' | 'production-orders' | 'quality-inspection';
type Receiver = (id: string) => void;
type Request = Readonly<{ route: RelatedRoute; id: string }>;
type Destination = Readonly<{ host: HTMLElement; receive: Receiver }>;

const pending = new WeakMap<HTMLElement, Request>();
const destinations = new WeakMap<HTMLElement, Map<RelatedRoute, Destination>>();

export function revealRelatedRecord(workspace: HTMLElement, route: RelatedRoute, id: string): void {
  pending.set(workspace, { route, id });
}

export function registerRelatedRecord(
  workspace: HTMLElement,
  host: HTMLElement,
  route: RelatedRoute,
  receive: Receiver,
): void {
  const map = destinations.get(workspace) ?? new Map<RelatedRoute, Destination>();
  map.set(route, { host, receive });
  destinations.set(workspace, map);
  if (globalThis.location.hash === `#/${route}`) flushRelatedRecord(workspace, route);
}

export function flushRelatedRecord(workspace: HTMLElement, route: string): void {
  const request = pending.get(workspace);
  if (request?.route !== route) return;
  const target = destinations.get(workspace)?.get(request.route);
  if (!target?.host.isConnected) return;
  if (target.host.closest('[hidden], [inert], [data-commercial-data-state="unloaded"]')) return;
  pending.delete(workspace);
  target.receive(request.id);
}
