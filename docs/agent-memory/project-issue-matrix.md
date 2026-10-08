# KingTurf Project Issue Matrix

Updated: 2026-10-08 Asia/Singapore, Batch 1 integration / Batch 2. This live matrix supplements the immutable [takeover report](../evidence/PROJECT_TAKEOVER_REPORT_20261008.md). Current evidence: [Batch 1](../evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md), code checkpoint `61617c9608af59035117b050e24fd19f2aad8325`; [integration](../evidence/BATCH1_INTEGRATION_REPORT_20261008.md), [Batch 2](../evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md) code `e76cb1eee5b70f4328ca07a358aab65aab9bbf98`.

Implemented and locally validated means available for review; it does not mean merged, enabled in GitHub or deployed. Historical observations retain their evidence date.

| ID                                      | Severity | Current status                | Evidence / next action                                                                                                     |
| --------------------------------------- | -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| KT-001 release input/source             | P1       | PR31_OPEN_HOSTED_FAIL         | Exact SHA, canonical main history, immutable control/candidate, lock-time revalidation; main still has old workflow        |
| KT-002 GitHub protection                | P1       | CONFIRMED_EXTERNAL_BLOCKER    | Current main/environment rules absent; defaults permissions403 NOT_VERIFIED; administrator approval/configuration required |
| KT-003 deployment concurrency/preflight | P1       | PARTIAL_IMPLEMENTED           | Current deploy job shared group/non-canceling implemented; mount/schema preflight and historical/manual writers remain     |
| KT-004 recovery                         | P1       | NOT_VERIFIED                  | Attachment/off-host backup and restore acceptance not performed                                                            |
| KT-005 credential/session/audit         | P1       | IMPLEMENTED_LOCAL_VALIDATED   | Batch2 real HTTP old token401; audit/revoke rollback and concurrency pass; main still vulnerable                           |
| KT-006 Order360 source scope            | P1       | CONFIRMED_CODE_DISPATCH_GAP   | Source scopes not propagated; real role/data impact and cross-tenant IDOR not reproduced                                   |
| KT-007 nested legal permissions         | P1       | CONFIRMED_CAPABILITY_EXPOSURE | Independent atomic policy; synthetic dispatch exposes manifest/legal event evidence; actual tenant breach not proven       |
| KT-008 login anti-abuse                 | P1       | NOT_VERIFIED_UPSTREAM         | App/ingress historical missing controls; external runtime protection unknown                                               |
| KT-009 Web date/DOM test                | P1       | REPRODUCED_CURRENT            | Current Web108/109, Hosted104/105; same fixed-date overdue DOM fixture failure                                             |
| KT-010 CAPA date test                   | P1       | REPRODUCED_CURRENT            | Current API160/161; same fixed target violates preserved CHECK                                                             |
| KT-011 API local runtime                | P1       | HISTORICAL_UNCHANGED_SOURCE   | Not rerun this batch; strip/source-export failure evidence in takeover                                                     |
| KT-012 local env/proxy                  | P1       | HISTORICAL_UNCHANGED_SOURCE   | Not rerun this batch; takeover evidence; no runtime config changed                                                         |
| KT-013 migration control                | P1       | OPEN                          | Startup DDL/non-read-only status and migration concurrency remain; no production DB audit                                  |
| KT-014 CI/browser coverage              | P2       | PARTIAL_IMPROVEMENT           | Hosted release38/38; Batch2 real HTTP19, mock browser23 combined; real role UAT open                                       |
| KT-015 document delivery                | P1       | NOT_VERIFIED                  | Provider consumer/receipt acceptance still pending                                                                         |
| KT-016 UX/volume                        | P2       | OPEN                          | Pagination, typed filters and handoffs after safety fixes                                                                  |
| KT-017 historical DB constraints        | P2       | NOT_VERIFIED                  | No production historical-row checks or constraint validation                                                               |
| KT-018 state drift                      | P2       | INCREMENTALLY_MAINTAINED      | Current report/status/matrix linked; historical acceptance not rewritten                                                   |
| KT-019 architecture debt                | P2       | DEFERRED                      | No broad rewrite; large app/bootstrap files unchanged                                                                      |
| KT-020 derived risk fields              | P2       | OPEN                          | Source capability policy for anomalies still needs implementation                                                          |
| KT-021 premature release marker         | P1       | IMPLEMENTED_LOCAL_VALIDATED   | Atomic promotion only after probes/exact JSON version; failure/retry shell tests                                           |
| KT-022 backup/config order              | P2       | PARTIAL_IMPLEMENTED           | Dump failure now prevents secret sync; later failure may retain synchronized config; no automatic config rollback          |

No production P0 was confirmed. Production release remains blocked by current gate failures and unresolved safety/operations acceptance. KT-005 is repaired locally only. Next batch prioritizes KT-006/007 and deterministic gate restoration; production safety is still blocked.
