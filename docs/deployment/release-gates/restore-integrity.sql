\set ON_ERROR_STOP on
-- Only execute inside an approved isolated restore database, never production.
-- Metadata/counts only: no business row contents. Never call migrate here.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
-- Exact manifest frozen from candidate20ded96; regenerate for a changed candidate.
DO $$
DECLARE n bigint;
BEGIN
 WITH expected(name,checksum) AS (VALUES
    ('0001_identity_authorization_foundation.sql','c53c5cf749da1135ca7bed9ecaa91f74f461dd6e252d11c2eca0a5a02aa694ee'),
    ('0002_tenant_integrity.sql','918c043b124b539fc702582f166daff6552feee0594be2e08484eea8e1e05538'),
    ('0003_identity_authorization_hardening.sql','f47063fa8acd913682abc8d11d0bc6440ec9e377e6df20fe57883746345ea71d'),
    ('0004_authorization_integrity_completion.sql','59a2aa362d90c575b9dc5013ba52b19f20701fc9b09280d100be139ffaa6c518'),
    ('0005_business_platform_foundations.sql','5955c1e94e1ef38b5ab2d8228a35a676719e6791d7b1d932bf58c6022e946fc9'),
    ('0006_platform_engine_integrity.sql','d9ed3c6084f93532688aa103f71737763f27965142f7a8761f3b216c69629402'),
    ('0007_event_notification_foundations.sql','ee59aaca8530662e1a9344962eb982ca573abcc2b947f29d1910049698880459'),
    ('0008_attachment_foundation.sql','9293f8bfb4047737fd15c9639537ce869a885e5ef004a965cd440d4b40f0506f'),
    ('0009_business_object_registry.sql','96dd0606130d7edd6d20d9f29f357eea6595843c6d3cd451c924ea7bc8a74730'),
    ('0010_foundation_tenant_guards.sql','43d647bec187d90756c6cf4ebe72b5a38d8ee1666fc49fb8cd6b398cb6facf3e'),
    ('0011_foundation_review_hardening.sql','af96f8e7eb9efe02bc28a885c1b75c87d1fd2c38ac07b29503b43a05817dfbd0'),
    ('0012_foundation_operational_safety.sql','563f6b54d816cdae8ba0cccac73e074d926a8bf0c3f2063f78ba251a7f8ae5ce'),
    ('0013_foundation_operational_safety_columns.sql','a491578b6b5c2c5b63da7027a75d3a52007f86f44d38114bf55bcffb5d27e76c'),
    ('0014_event_claim_fencing.sql','a74b260d98c2514b4dd5af7e75a37c96430d4ba7d6052d80d6d928bef103e5a9'),
    ('0015_published_relationship_immutability.sql','a5f1a291ec2cfff2f0879839bf0f82a2c68c365d8226fac674a277e41f17413b'),
    ('0016_notification_idempotency_and_registry_revision.sql','a4c04891433af4522dbbbaa9cea1b3a3e7f00dea220ce2371d3bd6fb6a570a84'),
    ('0017_crm_customer_lead_foundation.sql','6e42e44269d1bcd5558b63f235213084eba3b68c1b46be901f163b9480efaa75'),
    ('0018_customer_ownership_reassign_permission.sql','c110789c49b900a98bbb9332a2402b72268d6ffbedb4e9c04c90493c2cfc2b15'),
    ('0019_crm_contact_identity_integrity.sql','4514b5115d2d0089a5f0cc1fdb81b8686f738054ec77787dea22f0a722bdffee'),
    ('0020_crm_response_and_deletion_hardening.sql','2c5dea964ebc318a222af8960efdfff19892ef92891671de49791b86851d96c6'),
    ('0021_commercial_sales_to_cash.sql','242924ade695325d08f28fabe5ca48bce86ffaa8ab9b1a1dd37db90434eb7640'),
    ('0022_commercial_integrity_completion.sql','f4f668288fe8be624156e3f06c775a11dec09e6ed29dbff8a35a264ecfd95485'),
    ('0023_commercial_review_hardening.sql','27aabe7a8765e949a053ef873fe59fab200a251aa34f0271dd932c1bb50e62d7'),
    ('0024_ctr_attachment_snapshot_freeze.sql','c5daa59226b6ce2097aa409f2536d6db0781a428e2895684b711954ca9104daf'),
    ('0025_commercial_final_integrity.sql','43161c3d3db5389542add10c3866c4b3537ffc57d6644fa9608b1c105e0bed8d'),
    ('0026_quote_to_cash_immutable_ledger.sql','f9505021c71098d6030cb699c61c881963ca644e5d7c448f522952a72b387299'),
    ('0027_quote_to_cash_governance_repairs.sql','ec728d81fc964a13097fcab095eeb82c22e8da92da2dc030a94894b0db781bbc'),
    ('0028_platform_permission_catalog.sql','c52e432189a59c2d3e017f48baafc0f2019d7c253cd2bae323607c2814729d7f'),
    ('0029_commercial_definition_company_scope.sql','7110e22638e563e7f186cab46f915d39e612a9b9dbf8ff67f1c49ad2a6035b31'),
    ('0030_qtc_order_trigger_alias_repair.sql','afef76d741e3cee08d9675dbc9ec7e6aa47b930fea6c477f1ca89768e6831e8f'),
    ('0031_commission_engine_immutable_ledger.sql','b2dea2d74c9cd87f0699df3a1571e7c55c97ee4e84220401289012904202398b'),
    ('0032_order_360_permission.sql','d99bf9ee17dd03a2d0a219901f3884ce010684089ea2c5b6a91e416f51027e44'),
    ('0033_risk_engine_v1.sql','d1cb0ed65180e786afa0d6f5b0c7824e8ef75c8562250e743e753a730330dd95'),
    ('0034_risk_governance_repairs.sql','ffc03bc92767a4de217551ea66af0fada5f78bed08f63738c66cf1760db37cee'),
    ('0035_executive_dashboard_permission.sql','81f7f66d858b6b1629c05acd2d878770094371770e6ea715f6ee45de4f90d83b'),
    ('0036_manufacturing_master_data.sql','048a7b16edd19c858c65df19f1067dcb1df8a78179025e70ebefaaa1ce43f120'),
    ('0037_procurement_inventory_ledger.sql','a3d658744555ec06605221722fa811f74bb5428564b4f441e20500f6903ff2a1'),
    ('0038_procurement_inventory_integrity.sql','55f1df65448fbb278ffa5a1bccf5c346f8b03eaab938f2ce87b96e1150180562'),
    ('0039_mrp_planning_foundation.sql','80d54980a3efd2e5f721916174896c0772ce0f964affb7f17388bdc23ca4081e'),
    ('0040_mrp_integrity_hardening.sql','0bf8c30b95a7393d232cde2765f6e4912730147c03999320a94569bcb632c195'),
    ('0041_production_execution_foundation.sql','9e2783fcec3d771a828977f022abc8a051ebb9da91c71bc141ac536c740dc49c'),
    ('0042_production_execution_integrity.sql','c98249ccd3cb4b6d64841ae6a07695ef5e53547b04292903f81fb55980a742e2'),
    ('0043_quality_wms_foundation.sql','492e85ca38f4fc8629d916bc6844ae75d8b7629fa47a225c6b7823e1735ce9bb'),
    ('0044_quality_inventory_integration.sql','6cf407e779fbd671bc7f1a8b8b5ff06843e3e1a42bd4b2b6be86832298bb405e'),
    ('0045_system_admin_commercial_company_scope.sql','b93b4a65a3ccc4c024f8e96b2a31c98bcc0ce3352e361b9244cbc0b5d977ac5e'),
    ('0046_atomic_business_role_catalog.sql','cb8996f8f9044386dc59a9fc116d7d3a445a731868a283ad6827b7b0cccf37ac'),
    ('0047_atomic_role_segregation_guards.sql','f15602f078a79daa1032756ea73c3edd2b025d352090cbdbde54b77b8733ff1f'),
    ('0048_actual_manufacturing_cost.sql','d78362aec51e68c541f2cb2234e606cf44cca2ce920312d49364a1241c1b3acb'),
    ('0049_manufacturing_cost_admin_grants.sql','3b6affdccb95733f7bd3b06644cb57a15f39da318ceedfd9b884017cb0a6f298'),
    ('0050_shipment_release_logistics_pod.sql','9ab8c1d7c5bdd160e7c47d5debd5f9b13b70ded1a7c1dd3dbc0975140f8d378d'),
    ('0051_shipment_sales_order_source_compatibility.sql','590ab25a48686120f56c4c5e7d3c323db79a3929d5644d6d05c2eb9ad967ad99'),
    ('0052_platform_read_permissions.sql','2d61bee8ecbfda3d6d6e7f7314fe06a6b7c06e351629e684b6f998892b70dde0'),
    ('0053_collections_legal_evidence.sql','278b82fa2f0497b8deb9696c75930947b252245c6df7841b97d5081470e79196'),
    ('0054_complaint_ncr_capa.sql','9931ae9ab7847616ed3901cdba1bf7b85629c7ec7b3c9dbc4cf507a1d1b5f499'),
    ('0055_complaint_ncr_capa_hardening.sql','da4a48c07886e7b637f66fee747af1d84f6b0b74b10e68f31074b88aeb2c97f1'),
    ('0056_complaint_sla_policy_permissions.sql','78ed620b5ad97baca288500313847a00acfeb7e9ac65a897f3bf98aa44c6dbdf'),
    ('0057_complaint_closure_chain.sql','8cd3cdb4ce2ae5cfc10235274a91285f08d0d725fc1df285766a22137414525a'),
    ('0058_ncr_close_permission.sql','39e8c251d55218f32d8268c4b879035aaa187a1a73bb5922a4541bd75285c6c7'),
    ('0059_business_document_versioning.sql','23931d23cbbc5e84254fad791cec47092df224b087774490ec38c81fcdd3d35a'),
    ('0060_business_document_approval.sql','10bb2f55ada674fc2ab6ee39f9bb69411afc82568d2d66d4d4aff38c09eb3c62'),
    ('0061_contract_document_lifecycle.sql','5734d64780d7c9629d448fb25e7ee060a32eb1d27767d35a61dc9f2201441b8f'),
    ('0062_atomic_iam_administration.sql','ba7e02973bcaddc7765473261a05a81d645c664731b8aa338f5b5f505d8312a3'),
    ('0063_business_document_role_permissions.sql','c25d03706087d10bac4e3203a641e4016f37c30f21a9e99c0ce5ae9eeaf2a4e2'),
    ('0064_business_document_bindings.sql','de8e1a037d58e7f3c74bde581c70bb94c569e00decf8624e0c6b47ae81affc61'),
    ('0065_cost_model_matrix.sql','6577febbd926c1f4067f6e00c3a5ebf094369a542132ea1d1b0a09f1f641c2a8'),
    ('0066_cost_model_presets.sql','f0ca22894e7442cbc8f77cc88ec1208bdf8db8960709c32d32c59843c227c71b'),
    ('0067_cost_matrix_role_grants.sql','ca7891860802b92e68896618919feadd3b2d786abc8922d4b70d886a3fc0a3c4'),
    ('0068_website_lead_ingest.sql','b6255304ca01db1c58925200302b84374a6cc9a0069980be560f5062a849d003'),
    ('0069_cost_matrix_price_governance.sql','dc65b36dbed285642f0ea9ea2140f2b634bc0e6fb8110791ccafb00f780c87f4'),
    ('0070_business_document_communications.sql','dd0daaf9dcd502845859090045e93a2d7ef5575f669f787d52a68347a7153a6b'))
 SELECT count(*) INTO n FROM expected e FULL JOIN schema_migrations a USING(name)
 WHERE e.name IS NULL OR a.name IS NULL OR e.checksum IS DISTINCT FROM a.checksum;
 IF n>0 THEN RAISE EXCEPTION 'Candidate migration mismatch count=%',n; END IF;
END $$;
SELECT count(*) AS unvalidated_constraints
FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
WHERE n.nspname='public' AND NOT c.convalidated;
-- Evaluate every table CHECK, including NOT VALID historical checks.
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT c.conname,c.conrelid,pg_get_expr(c.conbin,c.conrelid) AS expr
           FROM pg_constraint c JOIN pg_namespace ns ON ns.oid=c.connamespace
           WHERE ns.nspname='public' AND c.contype='c' AND c.conrelid<>0
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE NOT (%s)',r.conrelid::regclass,r.expr) INTO n;
    IF n>0 THEN RAISE EXCEPTION 'CHECK % violations=%',r.conname,n; END IF;
  END LOOP;
END $$;
-- Composite tenant foreign keys, honoring MATCH SIMPLE/FULL NULL behavior.
DO $$
DECLARE r record; n bigint; partial_nulls bigint; eq text; nonnull text; anynull text;
BEGIN
  FOR r IN SELECT c.conname,c.conrelid,c.confrelid,c.conkey,c.confkey,c.confmatchtype
           FROM pg_constraint c JOIN pg_namespace ns ON ns.oid=c.connamespace
           WHERE ns.nspname='public' AND c.contype='f'
  LOOP
    SELECT string_agg(format('p.%I=c.%I',pa.attname,ca.attname),' AND '),
           string_agg(format('c.%I IS NOT NULL',ca.attname),' AND '),
           string_agg(format('c.%I IS NULL',ca.attname),' OR ')
    INTO eq,nonnull,anynull
    FROM unnest(r.conkey,r.confkey) k(child,parent)
    JOIN pg_attribute ca ON ca.attrelid=r.conrelid AND ca.attnum=k.child
    JOIN pg_attribute pa ON pa.attrelid=r.confrelid AND pa.attnum=k.parent;
    EXECUTE format('SELECT count(*) FROM %s c WHERE (%s) AND NOT EXISTS (SELECT 1 FROM %s p WHERE %s)',r.conrelid::regclass,nonnull,r.confrelid::regclass,eq) INTO n;
    IF r.confmatchtype='f' THEN
      EXECUTE format('SELECT count(*) FROM %s c WHERE (%s) AND NOT (%s)',r.conrelid::regclass,anynull,replace(nonnull,'IS NOT NULL','IS NULL')) INTO partial_nulls;
      n := n + partial_nulls;
    END IF;
    IF n>0 THEN RAISE EXCEPTION 'FK % violations=%',r.conname,n; END IF;
  END LOOP;
END $$;
SELECT count(*) AS negative_ar_balances FROM ar_open_item_balances WHERE remaining_amount<0;
SELECT count(*) AS negative_payment_balances FROM bank_payment_balances WHERE remaining_amount<0;
SELECT count(*) AS allocation_currency_mismatches
FROM allocation_entries a
JOIN bank_payments p ON (p.id,p.tenant_id)=(a.bank_payment_id,a.tenant_id)
JOIN ar_open_items i ON (i.id,i.tenant_id)=(a.ar_open_item_id,a.tenant_id)
WHERE a.currency IS DISTINCT FROM p.currency OR a.currency IS DISTINCT FROM i.currency;
SELECT count(*) AS order_line_total_mismatches
FROM sales_orders o
WHERE o.total IS DISTINCT FROM (SELECT coalesce(sum(l.total),0) FROM sales_order_lines l WHERE (l.sales_order_id,l.tenant_id)=(o.id,o.tenant_id));
SELECT count(*) AS available_attachments,
 count(*) FILTER (WHERE actual_size IS NULL OR actual_checksum IS NULL OR finalized_at IS NULL
   OR actual_size<>expected_size OR actual_checksum<>expected_checksum) AS invalid_available_attachments
FROM attachments WHERE state='AVAILABLE';
SELECT count(*) AS active_bindings_to_unavailable
FROM attachment_bindings b JOIN attachments a ON (a.id,a.tenant_id)=(b.attachment_id,b.tenant_id)
WHERE b.unbound_at IS NULL AND a.state<>'AVAILABLE';

-- Fail closed on every business count above; output-only summaries are not admission.
DO $$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM ar_open_item_balances WHERE remaining_amount<0;
 IF n>0 THEN RAISE EXCEPTION 'Negative AR balance count=%',n; END IF;
 SELECT count(*) INTO n FROM bank_payment_balances WHERE remaining_amount<0;
 IF n>0 THEN RAISE EXCEPTION 'Negative payment balance count=%',n; END IF;
 SELECT count(*) INTO n FROM allocation_entries a
 JOIN bank_payments p ON (p.id,p.tenant_id)=(a.bank_payment_id,a.tenant_id)
 JOIN ar_open_items i ON (i.id,i.tenant_id)=(a.ar_open_item_id,a.tenant_id)
 WHERE a.currency IS DISTINCT FROM p.currency OR a.currency IS DISTINCT FROM i.currency;
 IF n>0 THEN RAISE EXCEPTION 'Allocation currency mismatch count=%',n; END IF;
 SELECT count(*) INTO n FROM sales_orders o
 WHERE o.total IS DISTINCT FROM (SELECT coalesce(sum(l.total),0) FROM sales_order_lines l WHERE (l.sales_order_id,l.tenant_id)=(o.id,o.tenant_id));
 IF n>0 THEN RAISE EXCEPTION 'Order line total mismatch count=%',n; END IF;
 SELECT count(*) INTO n FROM attachments WHERE state='AVAILABLE' AND
 (actual_size IS NULL OR actual_checksum IS NULL OR finalized_at IS NULL OR actual_size<>expected_size OR actual_checksum<>expected_checksum);
 IF n>0 THEN RAISE EXCEPTION 'Available attachment metadata mismatch count=%',n; END IF;
 SELECT count(*) INTO n FROM attachment_bindings b JOIN attachments a ON (a.id,a.tenant_id)=(b.attachment_id,b.tenant_id)
 WHERE b.unbound_at IS NULL AND a.state<>'AVAILABLE';
 IF n>0 THEN RAISE EXCEPTION 'Active binding to unavailable attachment count=%',n; END IF;
END $$;

-- Historical NOT VALID metadata is intentionally preserved by migration0055.
-- Rows have already been checked above. New unvalidated constraints are drift,
-- while validation of an existing historical constraint is a stricter state.
DO $$
DECLARE n bigint;
BEGIN
 WITH expected(table_name,constraint_name) AS (VALUES
    ('capa_action_completions','capa_action_completions_evidence_nonempty_check'),
    ('capa_actions','capa_actions_due_check'),
    ('capa_cases','capa_cases_root_cause_check'),
    ('capa_cases','capa_cases_target_check'),
    ('capa_events','capa_events_reason_check'),
    ('capa_verifications','capa_verifications_evidence_nonempty_check'),
    ('capa_verifications','capa_verifications_observation_check'),
    ('capa_verifications','capa_verifications_scope_check'),
    ('capa_verifications','capa_verifications_standard_check'),
    ('customer_complaint_events','customer_complaint_events_reason_check'),
    ('customer_complaints','customer_complaints_deadline_order_check'),
    ('customer_complaints','customer_complaints_occurred_check'),
    ('customer_complaints','customer_complaints_request_check'),
    ('customer_complaints','customer_complaints_snapshot_check'),
    ('ncr_events','ncr_events_reason_check'),
    ('nonconformance_reports','nonconformance_reports_defect_check'),
    ('nonconformance_reports','nonconformance_reports_scope_check'))
 SELECT count(*) INTO n FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
 JOIN pg_namespace ns ON ns.oid=c.connamespace
 WHERE ns.nspname='public' AND NOT c.convalidated
 AND NOT EXISTS (SELECT 1 FROM expected e WHERE e.table_name=t.relname AND e.constraint_name=c.conname);
 IF n>0 THEN RAISE EXCEPTION 'Unexpected unvalidated constraint count=%',n; END IF;
END $$;
COMMIT;
