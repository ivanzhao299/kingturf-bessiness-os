import type { AppRoute } from './navigation';
import type { BusinessDocumentTemplate } from './shell-types';

export const BUSINESS_DOCUMENT_TEMPLATES: readonly BusinessDocumentTemplate[] = [
  {
    name: '技术需求确认书',
    description: '冻结场景、产品参数、工程条件与验收标准',
    file: '01-人造草坪项目技术需求确认书.docx',
    routes: ['opportunities', 'technical-requirements'],
  },
  {
    name: '产品技术规格书',
    description: '产品结构、批次检验、储运与订单确认',
    file: '02-体育用人造草产品技术规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '采购询价及比价文件',
    description: '采购清单、供应商响应、比价与定标',
    file: '03-采购询价及比价文件.docx',
    routes: ['procurement'],
  },
  {
    name: '采购合同',
    description: '质量追溯、交付验收、付款和违约条款',
    file: '04-采购合同模板.docx',
    routes: ['procurement'],
  },
  {
    name: '销售合同',
    description: '技术附件、价款、交付、质保和争议条款',
    file: '05-销售合同模板.docx',
    routes: ['contracts'],
  },
  {
    name: '成品检验与项目验收单',
    description: '批次检验、验收判定与不合格处置',
    file: '06-成品检验与项目验收单.docx',
    routes: ['quality-inspection', 'shipments'],
  },
  {
    name: '发货到货与签收确认单',
    description: '卷号批次、承运、到货异常和签收',
    file: '07-发货到货与签收确认单.docx',
    routes: ['shipments', 'order-360'],
  },
  {
    name: '产品规格与选型总表',
    description: '常用产品族、型号、参数与适用边界',
    file: '08-常用产品规格与选型总表.docx',
    routes: ['opportunities', 'technical-requirements', 'technical-solutions', 'quotes'],
  },
  {
    name: '足球草系统规格书',
    description: '足球系统、填充、减震垫与测试要求',
    file: '09-足球用人造草系统规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '中小学足球场规格书',
    description: '校园材料、环保、运动性能与施工追溯',
    file: '10-中小学足球场系统规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '景观休闲草规格书',
    description: '景观系列、排水、阻燃与场景确认',
    file: '11-景观休闲人造草规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '门球与多用途草规格书',
    description: '短草密度、填砂、球速和平整度',
    file: '12-门球及多用途短草规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '项目正式报价单',
    description: '产品、辅材、运输施工、税率与交期',
    file: '13-项目正式报价单.docx',
    routes: ['quotes'],
  },
  {
    name: '合同评审记录',
    description: '法务、技术、质量、财务、产能和风险会签',
    file: '14-合同评审记录.docx',
    routes: ['credit-review', 'contracts'],
  },
  {
    name: '订单评审与交付启动单',
    description: '合同信用、技术冻结、物料和交付启动',
    file: '15-订单评审与交付启动单.docx',
    routes: ['sales-orders', 'order-360'],
  },
  {
    name: '标准BOM与用料核算表',
    description: '物料、标准用量、损耗和订单需求',
    file: '16-标准BOM与用料核算表.docx',
    routes: ['manufacturing-master', 'material-planning', 'production-orders'],
  },
  {
    name: '生产任务单',
    description: '色批、工艺、包装与实际生产记录',
    file: '17-生产任务单.docx',
    routes: ['production-orders'],
  },
  {
    name: '工艺流转卡',
    description: '备料至包装全过程追溯',
    file: '18-工艺流转卡.docx',
    routes: ['production-orders'],
  },
  {
    name: '原辅材料来料检验单',
    description: '原辅料批次接收和不合格控制',
    file: '19-原辅材料来料检验单.docx',
    routes: ['procurement', 'quality-inspection'],
  },
  {
    name: '生产首件检验单',
    description: '换型、换色、换料后的首件批准',
    file: '20-首件检验确认单.docx',
    routes: ['production-orders', 'quality-inspection'],
  },
  {
    name: '生产过程巡检记录',
    description: '草高、密度、色差、背胶和异常趋势',
    file: '21-过程巡检记录.docx',
    routes: ['production-orders', 'quality-inspection'],
  },
  {
    name: '成品入库与库位卡',
    description: '卷号、色批、面积、质量状态和库位',
    file: '22-成品入库与库位卡.docx',
    routes: ['production-orders', 'quality-inspection'],
  },
  {
    name: '装箱单与卷号清单',
    description: '订单、卷号、卷长、面积和装车追溯',
    file: '23-装箱单与卷号清单.docx',
    routes: ['shipments'],
  },
  {
    name: '铺装维护与质保手册',
    description: '铺装、使用、维护、报修和质保边界',
    file: '24-铺装维护与质保手册.docx',
    routes: ['contracts', 'shipments', 'order-360'],
  },
  {
    name: '投诉与不合格闭环单',
    description: '投诉、NCR、根因、措施和效果验证',
    file: '25-客户投诉与不合格闭环单.docx',
    routes: ['quality-inspection', 'business-risks'],
  },
] as const;

export const templatesForRoute = (route: AppRoute): readonly BusinessDocumentTemplate[] =>
  BUSINESS_DOCUMENT_TEMPLATES.filter((template) => template.routes.includes(route));
