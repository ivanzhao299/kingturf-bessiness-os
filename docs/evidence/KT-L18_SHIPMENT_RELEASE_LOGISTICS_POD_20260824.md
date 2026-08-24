# KT-L18 Shipment Release, Logistics and POD Evidence

Date: 2026-08-24 Asia/Shanghai

## Business outcome

KT-L18 connects the commercial order, manufacturing result, finished-goods lot and delivery evidence. A shipment release request freezes nine server-derived gates: signed and released contract/order, current approved credit, required allocated payment, no overdue balance, exact sales-order-to-MRP-to-production provenance, released lot quality, completed production, approved actual manufacturing cost, and sufficient lot inventory.

Failed gates enter `EXCEPTION_PENDING`. The requester cannot approve or reject their own exception. An eligible or independently approved request must be explicitly released before a carrier dispatch can exist. Dispatch, in-transit and delivered states are append-only. Delivery requires receiver name, received timestamp and proof reference.

## Delivered controls

- PostgreSQL migration `0050_shipment_release_logistics_pod.sql` owns immutable release, shipment and POD ledgers.
- The database recomputes the release gates and rejects a forged snapshot or inconsistent initial state.
- Four atomic roles isolate request, exception approval, warehouse release/dispatch, and logistics tracking.
- Six least-privilege permissions protect read, request, exception approval, release, dispatch and tracking.
- Order 360 includes release, shipment and POD evidence in both the aggregate and chronological timeline.
- The web `交付与证据` workspace exposes only actions granted to the signed-in role.

## Verification

- Static migration suite: 32/32 passed.
- PostgreSQL database suite: 42/42 passed.
- API suite: 115/115 passed, including shipment route authorization and command validation.
- Web suite: 26/26 passed.
- Formatting, lint, typecheck and production build passed.

## Release acceptance

Production deployment SHA, health/readiness, authenticated business UAT, dedicated role identities and Feishu private delivery receipt are recorded after the governed production release. Until those fields are present, KT-L18 is implementation-complete but not production-accepted.

## Rollback

Application rollback uses the previous immutable release SHA. Migration `0050` is additive and evidence tables are append-only; do not drop or rewrite them during application rollback. If the new module must be disabled, remove its grants or roll the application image back while preserving shipment evidence.
