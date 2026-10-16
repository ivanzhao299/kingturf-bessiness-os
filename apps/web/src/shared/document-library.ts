import { el } from '../dom';

type DocumentLibraryPorts = Readonly<{
  renderDocumentConnectors: (connectorGrid: HTMLElement, saved?: boolean) => void;
  onlineDocumentApi: <T>(path: string, init?: RequestInit) => Promise<T>;
}>;

export function appendDocumentLibrary(
  content: HTMLElement,
  allPermissions: ReadonlySet<string>,
  ports: DocumentLibraryPorts,
): void {
  const { renderDocumentConnectors, onlineDocumentApi } = ports;
  const documentLibrary = el('section', 'role-home');
  documentLibrary.setAttribute('data-route-view', 'document-templates');
  const documentLibraryHead = el('header', 'role-home-head');
  const documentLibraryCopy = el('div');
  documentLibraryCopy.append(
    el('p', 'eyebrow', '受控业务模板'),
    el('h2', '', '金特夫业务文档库'),
    el('p', 'muted', '下载后可直接修改项目、客户、数量、价格、交期和签署信息'),
  );
  documentLibraryHead.append(documentLibraryCopy, el('span', 'role-domain', 'V2.0 · 25份'));
  documentLibrary.append(documentLibraryHead);
  const documentGrid = el('div', 'role-task-grid');
  for (const [name, description, file] of [
    [
      '技术需求确认书',
      '冻结场景、草高、Dtex、密度、底布、填充和验收标准',
      '01-人造草坪项目技术需求确认书.docx',
    ],
    [
      '产品技术规格书',
      '标准足球草型号、结构、批次检验、储运和订单确认',
      '02-体育用人造草产品技术规格书.docx',
    ],
    [
      '采购询价及比价文件',
      '采购清单、供应商响应、加权比价和定标记录',
      '03-采购询价及比价文件.docx',
    ],
    ['采购合同', '原辅材料采购、质量追溯、交付验收、付款和违约条款', '04-采购合同模板.docx'],
    ['销售合同', '产品销售、技术附件、价款、交付、质保和争议条款', '05-销售合同模板.docx'],
    [
      '成品检验与项目验收单',
      '批次检验、验收判定、不合格处置和双方确认',
      '06-成品检验与项目验收单.docx',
    ],
    [
      '发货到货与签收确认单',
      '卷号批次、承运信息、到货核验、异常证据和签收',
      '07-发货到货与签收确认单.docx',
    ],
    [
      '产品规格与选型总表',
      '12类常用产品族、型号、草高、Dtex、密度与适用边界',
      '08-常用产品规格与选型总表.docx',
    ],
    [
      '足球草系统规格书',
      '40/50/60mm足球系统、填充、减震垫与系统测试要求',
      '09-足球用人造草系统规格书.docx',
    ],
    [
      '中小学足球场规格书',
      '校园材料、环保、运动性能、进场和施工追溯要求',
      '10-中小学足球场系统规格书.docx',
    ],
    [
      '景观休闲草规格书',
      '20-40mm景观系列、密度、结构、排水、阻燃和场景确认',
      '11-景观休闲人造草规格书.docx',
    ],
    [
      '门球与多用途草规格书',
      '短草密度、填砂、球速、平整度和试铺确认',
      '12-门球及多用途短草规格书.docx',
    ],
    [
      '项目正式报价单',
      '产品、辅材、运输施工、税率、付款、交期和报价边界',
      '13-项目正式报价单.docx',
    ],
    ['合同评审记录', '法务、技术、质量、财务、产能、交期和风险会签', '14-合同评审记录.docx'],
    [
      '订单评审与交付启动单',
      '合同信用、技术冻结、物料、产能、质量和物流启动',
      '15-订单评审与交付启动单.docx',
    ],
    [
      '标准BOM与用料核算表',
      '草丝、底布、背胶、包装、标准用量、损耗和订单需求',
      '16-标准BOM与用料核算表.docx',
    ],
    ['生产任务单', '物料色批、簇绒、背胶、排版、包装和实际生产记录', '17-生产任务单.docx'],
    ['工艺流转卡', '备料、簇绒、背胶、裁切、成检和包装全过程追溯', '18-工艺流转卡.docx'],
    [
      '原辅材料来料检验单',
      '草丝、底布、背胶、包装的批次接收和不合格控制',
      '19-原辅材料来料检验单.docx',
    ],
    ['生产首件检验单', '换型、换色、换料和调机后的首件批准与留样', '20-首件检验确认单.docx'],
    ['生产过程巡检记录', '草高、密度、色差、背胶、幅宽和异常趋势控制', '21-过程巡检记录.docx'],
    [
      '成品入库与库位卡',
      '卷号、型号、色批、面积、质量状态和库位一致性',
      '22-成品入库与库位卡.docx',
    ],
    [
      '装箱单与卷号清单',
      '订单、卷号、色批、卷长、面积、装车和排版追溯',
      '23-装箱单与卷号清单.docx',
    ],
    [
      '铺装维护与质保手册',
      '储存、铺装、使用、维护、异常报修和质保边界',
      '24-铺装维护与质保手册.docx',
    ],
    [
      '投诉与不合格闭环单',
      '投诉、NCR、控制、根因、纠正预防和效果验证',
      '25-客户投诉与不合格闭环单.docx',
    ],
  ] as const) {
    const link = document.createElement('a');
    link.className = 'role-task';
    link.href = `/business-templates/${file}`;
    link.download = file;
    link.append(
      el('span', 'role-task-state', '正式模板'),
      el('strong', '', name),
      el('small', '', description),
      el('span', 'role-task-count', 'Word 可编辑文件'),
      el('span', 'role-task-action', '下载并填写 →'),
    );
    documentGrid.append(link);
  }
  documentLibrary.append(documentGrid);
  if (
    allPermissions.has('business-document:configure') ||
    allPermissions.has('business-document:audit')
  ) {
    const communicationAdmin = el('section', 'document-communication-admin');
    communicationAdmin.append(
      el('p', 'eyebrow', '管理员专属'),
      el('h2', '', '文档发送配置与审计'),
      el(
        'p',
        'muted',
        '第三方密钥不写入业务数据库；这里只维护连接器状态、发送身份和安全密钥引用。',
      ),
    );
    if (allPermissions.has('business-document:configure')) {
      const connectorGrid = el('div', 'document-connector-grid');
      renderDocumentConnectors(connectorGrid);
      communicationAdmin.append(el('h3', '', '发送与翻译连接器'), connectorGrid);
    }
    if (allPermissions.has('business-document:audit')) {
      const auditList = el('div', 'document-audit-list');
      auditList.append(el('p', 'operation-status', '正在加载逐用户文档日志…'));
      void onlineDocumentApi<{
        items: readonly Readonly<{
          id: string;
          occurredAt: string;
          action: string;
          outcome: string;
          actorName?: string;
          documentTitle?: string;
          targetId?: string;
          correlationId: string;
        }>[];
      }>('/api/v1/business-document-activity?limit=100')
        .then(({ items }) => {
          auditList.replaceChildren();
          if (items.length === 0) auditList.append(el('p', 'empty', '暂无文档操作日志'));
          for (const item of items) {
            const row = el('article', 'document-audit-row');
            row.append(
              el('strong', '', item.actorName ?? '系统用户'),
              el('span', '', item.action.replace('business-document.', '')),
              el('span', '', item.documentTitle ?? item.targetId ?? '文档配置'),
              el('time', '', new Date(item.occurredAt).toLocaleString('zh-CN')),
              el('small', '', `关联号 ${item.correlationId}`),
            );
            auditList.append(row);
          }
        })
        .catch((failure: unknown) => {
          auditList.replaceChildren(
            el('p', 'error', failure instanceof Error ? failure.message : '文档审计日志加载失败'),
          );
        });
      communicationAdmin.append(el('h3', '', '逐用户文档操作日志'), auditList);
    }
    documentLibrary.append(communicationAdmin);
  }
  content.append(documentLibrary);
}
