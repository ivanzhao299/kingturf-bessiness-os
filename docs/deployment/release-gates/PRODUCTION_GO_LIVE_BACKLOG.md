# KingTurf Production Go-Live Backlog

This backlog is deferred from engineering takeover closure because the project owner has classified the currently reachable instance as development/test. It remains mandatory before any formal production launch. Historical production `NO_GO` reports remain authoritative for the earlier production-classification decisions.

| Gate | Status | Required evidence |
| --- | --- | --- |
| Independent recovery bundle | OPEN | Private off-host copy of database, attachments/empty-state proof and manifest with receiver-side SHA-256 and retention evidence |
| Encrypted configuration recovery | OPEN | Root-controlled encrypted export, approved recipient key ID/fingerprint, controlled decryption test and key custody record |
| Full restore | OPEN | Restore from the independent copy, complete schema/data/attachment/config checks, isolated application startup and permissions |
| RPO/RTO | OPEN | Measured recovery point, restore time, failure handling and documented operator steps |
| Emergency rollback | OPEN | Reviewed emergency baseline retaining session revocation, atomic audit, authorization and SELECT-only startup; real failure-injection drill |
| Business UAT | OPEN | Approved role matrix and actual business-owner acceptance for CRM, order, AR/payment, legal and audit flows |
| GitHub governance | OPEN | Main PR-only protection, required quality/current-base checks, no force push/delete, production main-only environment and approval policy |
| Production deployment | OPEN | Exact main SHA deployment through the reviewed workflow, version/health/ready/security smoke and release receipt |
| Operations/SLA | OPEN | Error/latency/auth audit monitoring, backup retention alerts, disk/DB/container observation and incident rollback triggers |

The current development/test instance may only be updated after its data owner confirms that its records are synthetic or authorized test data, external lead traffic is controlled, and the production-named workflow is approved for that test target. No item above is satisfied merely by the owner’s environment label.
