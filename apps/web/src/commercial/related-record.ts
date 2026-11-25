type RelatedRoute = 'sales-orders' | 'production-orders' | 'quality-inspection';
type Receiver = (id: string) => void;
type Request = Readonly<{ route: RelatedRoute; id: string }>;
type Destination = Readonly<{ host: HTMLElement; receive: Receiver }>;

const pending = new WeakMap<HTMLElement, Request>();
const destinations = new WeakMap<HTMLElement, Map<RelatedRoute, Destination>>();

export function revealRelatedRecord(workspace: HTMLElement, route: RelatedRoute, id: string): void {
  const target = destinations.get(workspace)?.get(route);
  if (target?.host.isConnected) {
    target.receive(id);
    return;
  }
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
  const request = pending.get(workspace);
  if (request?.route !== route) return;
  pending.delete(workspace);
  receive(request.id);
}
