# Frontend Capability and Permission Matrix

Updated: 2026-08-26 Asia/Shanghai

This matrix is the authoritative frontend disposition for authenticated KingTurf capabilities. The session grant set controls navigation, route, section, action and field affordances. The API and database remain authoritative for data scope, field allowlists, state transitions and segregation of duties.

| Product surface            | Read capability                                                          | Main action capabilities                                                         | Frontend route            | Disposition             |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------- | ----------------------- |
| Executive overview         | `executive-dashboard:read`                                               | —                                                                                | `overview`                | User-facing             |
| CRM and Customer 360       | `customer:read`, `customer-360:read`, `lead:read`, `lead-pool:read`      | customer, contact, activity, ownership and lead lifecycle capabilities           | `crm`                     | User-facing             |
| Opportunity and CTR        | `opportunity:read`, `ctr:read`, `technical-solution:read`                | create, update, lifecycle, submit and approve capabilities                       | `opportunity-ctr`         | User-facing             |
| Cost, policy and quote     | `cost-model:read`, `cost:read`, `sales-policy:read`, `quote:read`        | model/policy management, evaluation, quote create/update/approve/issue           | `cost-quote`              | User-facing             |
| Credit, contract and order | `credit:read`, `contract:read`, `sales-order:read`, `order-360:read`     | evaluate/approve, revise/sign and order create                                   | `contract-order`          | User-facing             |
| AR, payment and commission | `ar:read`, `bank-payment:read`, `reconciliation:read`, `commission:read` | post, intake, reconcile, accrue/manage/pay                                       | `ar-payment`              | User-facing             |
| Risk                       | `risk-policy:read`, `risk:read`                                          | policy manage, evaluate and responsibility lifecycle                             | `ar-payment`              | User-facing             |
| Manufacturing master data  | item, BOM and routing read capabilities                                  | corresponding manage capabilities                                                | `planning-production`     | User-facing             |
| Procurement and inventory  | supplier, procurement and inventory read capabilities                    | supplier/procurement manage and inventory move                                   | `planning-production`     | User-facing             |
| MRP and production         | MRP policy, MRP and production read capabilities                         | plan, approve, release, material, report and close                               | `planning-production`     | User-facing             |
| Quality and traceability   | quality plan, quality and traceability read capabilities                 | plan manage, inspect and disposition                                             | `quality-warehouse`       | User-facing             |
| Complaint, NCR and CAPA    | `complaint:read`, `ncr:read`, `capa:read`                                | complaint create/triage/assign/close, NCR manage/disposition, CAPA manage/verify | `quality-warehouse`       | User-facing             |
| Manufacturing cost         | `manufacturing-cost:read`                                                | policy, calculate and approve                                                    | `planning-production`     | User-facing             |
| Shipment and POD           | `shipment:read`                                                          | request, exception approve, release, dispatch and track                          | `delivery-evidence`       | User-facing             |
| Organization structure     | `organization:read`                                                      | `organization:create`, `organization:update`                                     | `governance`              | User-facing             |
| Employees                  | `employee:read`                                                          | `employee:create`, `employee:update`                                             | `governance`              | User-facing             |
| Identity and access        | `authorization:read`                                                     | `authorization:manage`                                                           | `governance`              | User-facing             |
| Audit                      | `audit:read`                                                             | —                                                                                | `governance`              | User-facing             |
| Master data                | `master-data:read`                                                       | create, update and delete                                                        | `governance`              | User-facing             |
| Number definitions         | `number:read`                                                            | create, update and allocate                                                      | `governance`              | User-facing             |
| Business rules             | `rule:read`                                                              | create, update and evaluate                                                      | `governance`              | User-facing             |
| Workflows and tasks        | `workflow:read`                                                          | create, update, start and decide                                                 | `governance`              | User-facing             |
| Notifications              | `notification:read`                                                      | `notification:manage`                                                            | `governance`              | User-facing             |
| Attachments                | `attachment:read`                                                        | `attachment:manage`                                                              | Contextual business forms | Supporting API          |
| Business object registry   | `business-object:read`                                                   | `business-object:manage`                                                         | `governance`              | User-facing             |
| Event delivery             | `event:operate`                                                          | claim, complete, retry and dead-letter                                           | `governance` counts only  | Internal runner actions |

## Enforcement rules

1. A route is present only when at least one contained section is readable or actionable.
2. A section is present only when its atomic read or action capability is in the authenticated session.
3. Action controls require their exact action capability; read access never implies mutation access.
4. Sensitive fields remain hidden when the server field allowlist excludes them.
5. Data scope is never inferred by the frontend; the server filters every list and detail response.
6. Direct URL access, forged requests and conflicting role combinations must still be rejected by the API or database.
7. Event claims and delivery transitions are not exposed as ordinary buttons; only counts and failure state are visible to operators.
8. `pnpm verify:frontend-capabilities` fails when a directly authorized backend capability or governed platform endpoint family has no explicit frontend disposition.
