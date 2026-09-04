# Online Business Document Communications

## Product boundary

Online business documents remain versioned, customer/order-bound records. External delivery is a
separate governed capability: a user may edit a draft, an independent approver locks a version, and
an authorized sender may then select that exact version or a ready translation for delivery. A
draft, rejected document, unbound document, stale translation, or unconfigured channel is never
silently sent.

## Roles

- Document author: creates and versions content; cannot self-approve.
- Document approver: independently approves the exact current version.
- Customer communicator: sends an approved, customer-bound version through an enabled channel.
- Translator/reviewer: requests configured machine translation or stores a reviewed manual
  translation pinned to the source version and hash.
- System administrator: configures connectors and reads company-wide document activity. Connector
  permissions are not granted to ordinary business roles.

## Connectors

The registry supports email, WeChat Work/Official Account, WhatsApp Business, Microsoft Teams,
Telegram, LINE, and a translation provider. The database stores only non-secret account metadata
and a `KINGTURF_CONNECTOR_*` secret reference. Tokens, passwords, OAuth refresh material, and API
keys belong in the deployment secret store and are never returned to ordinary senders or written to
audit metadata.

Connector status is `UNCONFIGURED`, `READY`, or `DISABLED`. A `READY` connector requires a secret
reference. Delivery and automatic translation create bounded transactional-outbox events; a
provider adapter consumes those events after the corresponding account, consent, templates, and
regional requirements have been configured. Personal WeChat automation is explicitly unsupported;
WeChat delivery uses an approved enterprise or official-account integration.

## Translation and delivery evidence

Every translation pins source document id, source version, source canonical hash, target locale,
provider, requester, correlation id, content/status, and timestamp. Manual reviewed translations
are immediately ready; configured provider requests are queued.

Every delivery pins document version, optional translation, connector, channel, recipient,
recipient hash, subject, message, requester, idempotency key, correlation id, status, and timestamps.
Recipient addresses remain available only in the protected delivery record; user-facing histories
and administrator activity logs show a masked value or one-way hash.

## Audit and privacy

Document create, version, binding, review, print/export, translation, connector configuration, and
send-request actions use the existing immutable `audit_events` ledger. The dedicated document
activity endpoint requires `business-document:audit`, which is granted only to `SUPER_ADMIN` and
`SYSTEM_ADMIN`. Each row identifies the individual employee and correlation id. Existing audit
immutability prevents updates or deletes.

## Operational rollout

1. Deploy the schema and UI with every connector unconfigured.
2. An administrator chooses a provider, sender identity, non-secret metadata, and secret reference.
3. Operations provisions the referenced secret without placing its value in Git, the database, or
   application logs.
4. Validate a sandbox recipient, provider callback, retry/dead-letter behavior, consent, and
   attachment/link retention before changing the connector to `READY`.
5. Repeat production UAT per channel. Email is the recommended first channel; international
   platforms require their own verified business account and customer consent.
