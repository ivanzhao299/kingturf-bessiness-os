# Long Task Sequence

1. L01: wire navigation to existing workbenches/APIs, URL and refresh recovery.
2. L02: productize P1 sales-to-cash screens.
3. L03: verify one real order end to end.
4. L04: close KT-L16 quality/WMS.
5. L05-L09: cost variance, delivery evidence, collections/CAPA, cockpit, production gates.

Each step requires tests, Validator/Reviewer evidence, commit SHA, UAT evidence, and rollback notes before advancing.

## Current execution plan (2026-08-17)

- Gate 0: preserve the existing `main` WIP; run the Web navigation contract tests and record the current SHA.
- Gate 1: implement navigation state, route mapping, active state, and refresh recovery against existing workbenches.
- Gate 2: validate desktop and 390px mobile click flows; then run lint, typecheck, build, and focused/full tests.
- Gate 3: continue P1 Sales-to-Cash as one real order path, with RBAC/DataScope/audit and rejection paths.
- Gate 4: close KT-L16 quality/WMS with inspection, disposition, locations, finished-goods receipt, and traceability.

Do not advance on a self-reported completion; require a repository SHA and evidence entry.
