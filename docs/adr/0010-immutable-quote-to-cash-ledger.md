# ADR 0010: Immutable Quote-to-Cash ledger

## Decision

E11-E17 is an append-only tenant-composite ledger. Credit exposure is calculated from open AR plus released/uninvoiced orders minus unapplied bank payments, floored at zero. All amounts use ISO currency plus scale 6 and exact integer/`numeric(24,6)` arithmetic.

A sales order pins one exact issued quote revision and issued snapshot, one approved and unexpired versioned credit decision, one contract revision, and its immutable signature receipt. A later revision never silently supersedes a pin.

Raw bank intake, AR postings, decisions, approvals, signatures, reconciliation runs, and allocations cannot be updated or deleted. Remaining AR and payment balances are projections of original amounts minus allocation entries; there is no balance-write command.

Reconciliation sorts by payment receipt time/payment ID and due time/open-item ID. It validates one currency, locks both balances, and retains canonical input/result hashes. Identical canonical input therefore has one ordered result and replay identity.

## Consequences and limitations

- Corrections are new evidence (credit notes, new decisions/revisions, or compensating allocations), never edits.
- Cross-currency allocation and FX conversion are outside this boundary.
- Bank-provider verification is upstream; this boundary retains the received payload and hash.
- Fulfilment and tax-engine behavior remain separate downstream concerns.
