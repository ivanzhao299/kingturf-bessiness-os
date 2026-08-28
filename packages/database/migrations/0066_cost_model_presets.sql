ALTER TABLE cost_specification_models ADD COLUMN is_system_preset boolean NOT NULL DEFAULT false;
ALTER TABLE cost_specification_models ADD COLUMN product_family text;

WITH companies AS (
  SELECT o.id tenant_id,e.id created_by
  FROM organizations o
  JOIN LATERAL (SELECT id FROM employees WHERE company_id=o.id AND active=true AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1)e ON true
  WHERE o.organization_type='COMPANY' AND o.active=true AND o.deleted_at IS NULL
), presets(code,name,family,pile_height_mm,yarn_dtex,stitches_per_m2,yarn_kg,backing_kg,coating_kg) AS (VALUES
 ('PRESET-LANDSCAPE-20','景观休闲草 20mm','景观休闲草',20,8800,21000,0.62,0.24,0.72),
 ('PRESET-LANDSCAPE-30','景观休闲草 30mm','景观休闲草',30,11000,18900,0.82,0.25,0.78),
 ('PRESET-LANDSCAPE-40','景观休闲草 40mm','景观休闲草',40,13200,16800,1.02,0.26,0.84),
 ('PRESET-FOOTBALL-50','足球运动草 50mm 充砂型','足球运动草',50,12000,10500,1.18,0.27,0.90),
 ('PRESET-FOOTBALL-60','足球运动草 60mm 充砂型','足球运动草',60,15000,9500,1.38,0.28,0.96),
 ('PRESET-FOOTBALL-NONINFILL-30','免填充足球草 30mm','免填充运动草',30,15000,25200,1.25,0.30,0.88),
 ('PRESET-MULTISPORT-20','多功能运动草 20mm','多功能运动草',20,8800,37800,0.86,0.27,0.80),
 ('PRESET-HOCKEY-13','曲棍球草 13mm 高密型','曲棍球草',13,6600,58800,0.78,0.28,0.76),
 ('PRESET-TENNIS-12','网球草 12mm','网球草',12,6600,50400,0.70,0.27,0.74),
 ('PRESET-GOLF-10','高尔夫果岭草 10mm','高尔夫果岭草',10,5500,63000,0.66,0.28,0.72),
 ('PRESET-PLAYGROUND-25','幼儿园安全草 25mm','儿童活动草',25,11000,23100,0.78,0.27,0.82),
 ('PRESET-PET-30','宠物专用草 30mm 排水型','宠物草',30,11000,18900,0.84,0.24,0.70)
)
INSERT INTO cost_specification_models(tenant_id,code,name,product_specification,currency,default_tax_rate,active,is_system_preset,product_family,created_by)
SELECT c.tenant_id,p.code,p.name,jsonb_build_object('productFamily',p.family,'pileHeightMm',p.pile_height_mm,'yarnDtex',p.yarn_dtex,'stitchesPerM2',p.stitches_per_m2,'costBasis','每平方米成品','presetNote','预置耗用量为初始核算基线，投产前应按实际BOM、损耗率和采购物料绑定复核'),'CNY',0.13,true,true,p.family,c.created_by
FROM companies c CROSS JOIN presets p ON CONFLICT(tenant_id,code) DO NOTHING;

WITH preset_usage(code,yarn_kg,backing_kg,coating_kg) AS (VALUES
 ('PRESET-LANDSCAPE-20',0.62,0.24,0.72),('PRESET-LANDSCAPE-30',0.82,0.25,0.78),('PRESET-LANDSCAPE-40',1.02,0.26,0.84),
 ('PRESET-FOOTBALL-50',1.18,0.27,0.90),('PRESET-FOOTBALL-60',1.38,0.28,0.96),('PRESET-FOOTBALL-NONINFILL-30',1.25,0.30,0.88),
 ('PRESET-MULTISPORT-20',0.86,0.27,0.80),('PRESET-HOCKEY-13',0.78,0.28,0.76),('PRESET-TENNIS-12',0.70,0.27,0.74),
 ('PRESET-GOLF-10',0.66,0.28,0.72),('PRESET-PLAYGROUND-25',0.78,0.27,0.82),('PRESET-PET-30',0.84,0.24,0.70)
), factors(factor_code,factor_name,category,quantity_key,tax_rate,sort_order) AS (VALUES
 ('YARN','草丝原料（PE/PP）','DIRECT_MATERIAL','yarn',0.13,10),('PRIMARY-BACKING','主底布','DIRECT_MATERIAL','backing',0.13,20),
 ('SECONDARY-BACKING','复合底布/网格布','DIRECT_MATERIAL','secondary',0.13,30),('COATING','背胶（丁苯乳胶/PU）','DIRECT_MATERIAL','coating',0.13,40),
 ('MASTERBATCH','色母及功能助剂','DIRECT_MATERIAL','additive',0.13,50),('PACKAGING','纸管、编织膜及标签','DIRECT_MATERIAL','packaging',0.13,60),
 ('DIRECT-LABOR','簇绒、背胶、整理直接人工','DIRECT_LABOR','labor',0.06,70),('DIRECT-ENERGY','电力、燃气及生产用水','DIRECT_ENERGY','energy',0.13,80),
 ('DIRECT-OVERHEAD','设备折旧、维修及车间制造费用','DIRECT_OVERHEAD','overhead',0.06,90),('FIXED-RESERVE','固定成本预留','FIXED','reserve',0,100),
 ('PERSONNEL-RESERVE','管理人员成本预留','PERSONNEL','reserve',0.06,110),('FINANCE-RESERVE','财务费用预留','FINANCE','reserve',0.06,120),
 ('MARKETING-RESERVE','营销费用预留','MARKETING','reserve',0.06,130)
)
INSERT INTO cost_specification_factors(tenant_id,specification_model_id,factor_code,factor_name,category,source_type,quantity,manual_unit_price_tax_inclusive,tax_rate,adjustable,sort_order,created_by)
SELECT m.tenant_id,m.id,f.factor_code,f.factor_name,f.category,'MANUAL',
 CASE f.quantity_key WHEN 'yarn' THEN u.yarn_kg WHEN 'backing' THEN u.backing_kg WHEN 'secondary' THEN 0.12 WHEN 'coating' THEN u.coating_kg WHEN 'additive' THEN 0.04 WHEN 'packaging' THEN 0.08 WHEN 'labor' THEN 1 WHEN 'energy' THEN 1 WHEN 'overhead' THEN 1 ELSE 0 END,
 0,f.tax_rate,true,f.sort_order,m.created_by
FROM cost_specification_models m JOIN preset_usage u ON u.code=m.code CROSS JOIN factors f
WHERE m.is_system_preset=true
ON CONFLICT(tenant_id,specification_model_id,factor_code) DO NOTHING;
