# ADR 0011: Serialize inventory resources without a second balance ledger

## Status and authorization

Accepted for Batch 3 local implementation and isolated verification, 2026-10-26. Production migration/deployment remains unauthorized. This enforces the existing non-negative rule; it changes neither posting timing nor quantities, valuation, shipment semantics or historical movements.

## Evidence and alternatives

The ledger and inventory_balances view remain the balance authority. All four production INSERT paths reach validate_inventory_movement. In 19d40a2 two real transactions each ISSUE 7 against 10 and both commit, producing -4. Locking one movement cannot protect the aggregate; locking a lot alone also couples unrelated locations. A materialized authoritative balance would require backfill and double-write reconciliation, unnecessary for this repair.

Choose a separate operational inventory_stock_guards row keyed by tenant/lot/location, whose revision is actually updated on every movement. The lot determines material identity, retained by the original validation. A missing guard is atomically created by UPSERT. No quantity is stored there and the revision is not a business version or an audit sequence.

## Concurrency and snapshot contract

The existing BEFORE INSERT trigger first validates lot/material, UPSERTs the shared guard, then executes a separate SUM plus NEW delta, retaining the original negative-balance exception. Guard, movement and caller evidence share one transaction.

PostgreSQL VOLATILE procedural functions take query-level fresh snapshots, which matters after waiting at READ COMMITTED. See [PG17 volatility](https://www.postgresql.org/docs/17/xfunc-volatility.html). Actual row updates also force stale REPEATABLE READ/Serializable writers to fail rather than use an old sum; callers must retry the entire transaction, never only its last INSERT. See [PG17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

BEFORE-row checks retain their prior per-row semantics, including same-statement earlier rows; this is not a new net-per-statement allowance. See [PG17 trigger visibility](https://www.postgresql.org/docs/17/trigger-datachanges.html). Resource writers serialize, unrelated resources can proceed. Arbitrary multi-resource SQL can deadlock; PostgreSQL aborts a victim and the whole business transaction must roll back. Future multi-existing-resource commands must preacquire guards in tenant/lot/location order. Current generic and production material commands touch one resource; multi-line receipts create new lots. See [PG17 locking](https://www.postgresql.org/docs/17/explicit-locking.html).

## Migration and compatibility

0071 locks inventory_movements against concurrent writers, rejects any pre-existing negative balance, adds the operational table and stock-resource lookup index, and replaces only the existing validation function. The runner wraps the entire migration and registry insert in one transaction. No old migration, movement, sign/uniqueness/FK/immutability constraint or balance view is rewritten. Guards populate lazily; no history is invented.

Legacy SQL remains compatible, including already-running old code. A restarted old binary whose migration manifest ends at 0070 will reject a database containing 0071 under the existing startup compatibility gate. Application rollback therefore needs a compatibility build that recognizes 0071 and retains its protection. Removing the database guard would restore a known integrity defect and is not a normal rollback; any production rollback/repair requires separate approval and a controlled write stop.

Historical negatives require a separately authorized investigation and compensating business correction; migration must fail, never silently add stock. Protect guard rows from operational cleanup or direct manipulation. Extreme revision overflow fails closed. The table is synchronization metadata, not an API or a replacement inventory ledger.

## Acceptance

Real separate-connection tests must prove observable lock waiting for 7+7, correct RC post-wait sums, stale-snapshot 40001, first guard creation, whole-statement/whole-transaction rollback, duplicate source rejection without effects, cross-resource/company isolation and deadlock victim rollback. Preserve procurement/production regressions and run final exact-SHA CI, independent review, HTTP acceptance and two P1 rounds. Passing only the old commit-after-both-writes barrier is insufficient: that barrier intentionally deadlocks after proper serialization.
