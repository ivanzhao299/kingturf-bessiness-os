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
- API suite: 116/116 passed, including shipment route authorization, command validation and governed self-approval rejection.
- Web suite: 26/26 passed.
- Formatting, lint, typecheck and production build passed.

## Release acceptance

## Production acceptance

- Release: `b6033d0872deb86a6c606b32359b3954d5baa38d`
- CI: GitHub Actions run `32692442771`, passed.
- Deployment: GitHub Actions run `32692461458`, verify and deploy passed.
- Public runtime: `https://erp.kingturf.cn/health` returned `200 {"status":"ok"}` and `/ready` returned `200 {"status":"ready"}`.
- Exception-success UAT release: `263d9352-0227-4b1d-9d2b-7ba738d69e9f`; real frozen failures were `quality` and `cost`. Dedicated employee `KT-UAT-COST-APPROVER-01`, additionally assigned only `KT_SHIPMENT_EXCEPTION_APPROVER`, independently approved the exception. Warehouse release, shipment `62182de5-df56-44af-86b6-7cc77eb5693b` and POD `POD-KT-L18-UAT-001` reached `DELIVERED`.
- Segregation rejection UAT release: `7965fa0c-f50d-4a84-8413-f62c846de3b5`; requester self-approval returned `403 forbidden`, then the independent approver rejected the record to terminal `REJECTED`.

KT-L18 is capability-complete and production-accepted. The next queued long task is KT-L19 collections, legal handoff and debt evidence package.

## Rollback

Application rollback uses the previous immutable release SHA. Migration `0050` is additive and evidence tables are append-only; do not drop or rewrite them during application rollback. If the new module must be disabled, remove its grants or roll the application image back while preserving shipment evidence.
