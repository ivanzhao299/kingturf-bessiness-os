INSERT INTO commercial_units(code,dimension) VALUES ('KWH','ENERGY') ON CONFLICT(code) DO NOTHING;

ALTER TABLE cost_specification_factors
  ADD COLUMN unit_code text NOT NULL DEFAULT 'EA' REFERENCES commercial_units(code),
  ADD COLUMN price_source_name text NOT NULL DEFAULT '人工录入',
  ADD COLUMN price_source_reference text,
  ADD COLUMN price_effective_at date,
  ADD COLUMN price_note text;

ALTER TABLE cost_specification_factors DROP CONSTRAINT cost_specification_factors_source_type_check;
ALTER TABLE cost_specification_factors DROP CONSTRAINT cost_specification_factors_check;
ALTER TABLE cost_specification_factors
  ADD CONSTRAINT cost_specification_factors_source_type_check
    CHECK(source_type IN('MANUAL','PURCHASE_ORDER','SUPPLIER_QUOTE','MARKET_REFERENCE','INTERNAL_BENCHMARK')),
  ADD CONSTRAINT cost_specification_factors_source_item_check
    CHECK(source_type NOT IN('PURCHASE_ORDER','SUPPLIER_QUOTE') OR source_item_version_id IS NOT NULL),
  ADD CONSTRAINT cost_specification_factors_reference_check
    CHECK(source_type NOT IN('MARKET_REFERENCE','INTERNAL_BENCHMARK') OR length(trim(price_source_name))>0);

ALTER TABLE cost_matrix_calculations
  ADD COLUMN technical_solution_revision_id uuid,
  ADD COLUMN cost_model_version_id uuid,
  ADD COLUMN cost_decision_id uuid,
  ADD CONSTRAINT cost_matrix_calculations_solution_fk FOREIGN KEY(technical_solution_revision_id,tenant_id) REFERENCES technical_solution_revisions(id,tenant_id),
  ADD CONSTRAINT cost_matrix_calculations_model_version_fk FOREIGN KEY(cost_model_version_id,tenant_id) REFERENCES cost_model_versions(id,tenant_id),
  ADD CONSTRAINT cost_matrix_calculations_decision_fk FOREIGN KEY(cost_decision_id,tenant_id) REFERENCES cost_sheet_decisions(id,tenant_id),
  ADD CONSTRAINT cost_matrix_calculations_quote_link_check CHECK(
    (technical_solution_revision_id IS NULL AND cost_model_version_id IS NULL AND cost_decision_id IS NULL)
    OR
    (technical_solution_revision_id IS NOT NULL AND cost_model_version_id IS NOT NULL AND cost_decision_id IS NOT NULL)
  ),
  ADD CONSTRAINT cost_matrix_calculations_cost_decision_unique UNIQUE(tenant_id,cost_decision_id);

-- Dated, editable planning baselines. Purchase orders and valid supplier quotes remain the
-- preferred production sources after a factor is bound to a manufacturing item version.
UPDATE cost_specification_factors f
SET
  source_type=CASE
    WHEN f.factor_code IN('YARN','COATING','DIRECT-LABOR','DIRECT-ENERGY') THEN 'MARKET_REFERENCE'
    ELSE 'INTERNAL_BENCHMARK'
  END,
  quantity=CASE f.factor_code
    WHEN 'DIRECT-LABOR' THEN 0.075
    WHEN 'DIRECT-ENERGY' THEN 1.25
    WHEN 'FIXED-RESERVE' THEN 1
    WHEN 'PERSONNEL-RESERVE' THEN 1
    WHEN 'FINANCE-RESERVE' THEN 1
    WHEN 'MARKETING-RESERVE' THEN 1
    ELSE f.quantity
  END,
  unit_code=CASE f.factor_code
    WHEN 'DIRECT-LABOR' THEN 'HOUR'
    WHEN 'DIRECT-ENERGY' THEN 'KWH'
    WHEN 'DIRECT-OVERHEAD' THEN 'M2'
    WHEN 'FIXED-RESERVE' THEN 'M2'
    WHEN 'PERSONNEL-RESERVE' THEN 'M2'
    WHEN 'FINANCE-RESERVE' THEN 'M2'
    WHEN 'MARKETING-RESERVE' THEN 'M2'
    ELSE 'KG'
  END,
  manual_unit_price_tax_inclusive=CASE f.factor_code
    WHEN 'YARN' THEN 8.60
    WHEN 'PRIMARY-BACKING' THEN 10.50
    WHEN 'SECONDARY-BACKING' THEN 11.50
    WHEN 'COATING' THEN 5.90
    WHEN 'MASTERBATCH' THEN 18.00
    WHEN 'PACKAGING' THEN 8.00
    WHEN 'DIRECT-LABOR' THEN 40.37
    WHEN 'DIRECT-ENERGY' THEN 0.83
    WHEN 'DIRECT-OVERHEAD' THEN 1.30
    WHEN 'FIXED-RESERVE' THEN 0.50
    WHEN 'PERSONNEL-RESERVE' THEN 0.60
    WHEN 'FINANCE-RESERVE' THEN 0.35
    WHEN 'MARKETING-RESERVE' THEN 0.65
    ELSE f.manual_unit_price_tax_inclusive
  END,
  price_source_name=CASE f.factor_code
    WHEN 'YARN' THEN '同花顺 iFinD 聚乙烯现货（齐鲁化工参考）'
    WHEN 'COATING' THEN '胶友通丁苯胶乳月度市场均价'
    WHEN 'DIRECT-LABOR' THEN '国家统计局 2025 年规模以上企业生产制造岗位工资'
    WHEN 'DIRECT-ENERGY' THEN '山东工商业电价公开政策参考上限'
    ELSE 'Kingturf 初始计划成本基准'
  END,
  price_source_reference=CASE f.factor_code
    WHEN 'YARN' THEN 'https://news.10jqka.com.cn/20260829/c679411423.shtml'
    WHEN 'COATING' THEN 'https://m.jiaoyout.cn/marketDetail_0_0_0_0_0_0_0_2_1126102.html'
    WHEN 'DIRECT-LABOR' THEN 'https://www.stats.gov.cn/sj/zxfb/202605/t20260515_1963707.html'
    WHEN 'DIRECT-ENERGY' THEN 'https://jndpc.jinan.gov.cn/col/col2191/art/2026/art_48fa87d47b2c433d94ac85c9638d60d0.html'
    ELSE 'KT-COST-BASELINE-2026-08'
  END,
  price_effective_at=CASE f.factor_code
    WHEN 'COATING' THEN DATE '2026-08-01'
    WHEN 'DIRECT-LABOR' THEN DATE '2025-12-31'
    WHEN 'DIRECT-ENERGY' THEN DATE '2026-10-01'
    ELSE DATE '2026-08-28'
  END,
  price_note=CASE f.factor_code
    WHEN 'YARN' THEN '按 2026-08-28 国内 LLDPE 主流现货区间取 8.60 元/kg；实际报价优先改用有效采购订单或供应商报价。'
    WHEN 'COATING' THEN '按 2026-08 丁苯胶乳公开月均价 5.90 元/kg；PU 背胶规格须单独覆盖。'
    WHEN 'DIRECT-LABOR' THEN '80739 元/年按 250 个工作日、每日 8 小时折算为 40.37 元/小时。'
    WHEN 'DIRECT-ENERGY' THEN '0.83 元/kWh 为公开工商业参考上限，具体以企业当月电费结算单为准。'
    ELSE '用于消除空白模型的可编辑初始计划值；对外报价前须由成本专员以合同、订单、供应商报价或企业定额复核。'
  END,
  updated_at=now()
FROM cost_specification_models m
WHERE f.specification_model_id=m.id
  AND f.tenant_id=m.tenant_id
  AND m.is_system_preset=true
  AND f.manual_unit_price_tax_inclusive=0;

-- Preserve historical zero calculations for audit, but make a new non-zero baseline the latest
-- visible result so upgraded production tenants do not need to click through all 12 presets.
WITH baseline AS (
  SELECT
    m.tenant_id,
    m.id specification_model_id,
    m.currency,
    m.created_by,
    sum(CASE WHEN f.category IN('DIRECT_MATERIAL','DIRECT_LABOR','DIRECT_ENERGY','DIRECT_OVERHEAD') THEN f.quantity*f.manual_unit_price_tax_inclusive ELSE 0 END) direct_cost,
    sum(CASE WHEN f.category NOT IN('DIRECT_MATERIAL','DIRECT_LABOR','DIRECT_ENERGY','DIRECT_OVERHEAD') THEN f.quantity*f.manual_unit_price_tax_inclusive ELSE 0 END) reserved_cost,
    jsonb_agg(
      jsonb_build_object(
        'factorId',f.id,
        'factorName',f.factor_name,
        'category',f.category,
        'requestedSourceType',f.source_type,
        'resolvedSourceType',f.source_type,
        'sourceReference',coalesce(f.price_source_reference,f.price_source_name),
        'sourceEffectiveAt',f.price_effective_at,
        'priceNote',f.price_note,
        'quantity',f.quantity,
        'unitCode',f.unit_code,
        'unitPrice',f.manual_unit_price_tax_inclusive,
        'amount',f.quantity*f.manual_unit_price_tax_inclusive
      ) ORDER BY f.sort_order,f.factor_code
    ) factor_trace
  FROM cost_specification_models m
  JOIN cost_specification_factors f ON f.tenant_id=m.tenant_id AND f.specification_model_id=m.id
  WHERE m.is_system_preset=true AND m.active=true
  GROUP BY m.tenant_id,m.id,m.currency,m.created_by
  HAVING sum(f.quantity*f.manual_unit_price_tax_inclusive)>0
)
INSERT INTO cost_matrix_calculations(
  tenant_id,specification_model_id,pricing_mode,currency,direct_production_cost,reserved_expense_cost,total_cost,factor_trace,calculated_by,idempotency_key
)
SELECT
  tenant_id,specification_model_id,'TAX_INCLUSIVE',currency,direct_cost,reserved_cost,direct_cost+reserved_cost,factor_trace,created_by,
  'system-baseline-2026-08-28-'||specification_model_id::text
FROM baseline
ON CONFLICT(tenant_id,idempotency_key) DO NOTHING;
