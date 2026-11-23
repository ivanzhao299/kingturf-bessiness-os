# GOV-UX 治理域 UX 重构证据（2026-11-23）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权 + 并行会话政策（GOV-UX 会话派单）。
> 载体：TD-UI-001（UI 基座计划）U2 governance 九页控制台之后的**交互体验优化批**——
> 不是样式迁移，是按治理模块自身标准的深度 UX 升级。行为守恒（R1）：全部写路径仍为
> 既有端点，零新增 API、零 schema 变更、零新运行时依赖。

## 1. 五项交互升级

### ① 身份与授权页：用户 360 抽屉角色矩阵（勾选式管理）

- `console/identity-matrix.tsx` + `identity-matrix-state.ts` + `matrix-model.ts`：
  抽屉内「用户×角色」交叉表——**勾选即分配**（POST /api/v1/assignments，替代原
  「分配角色」弹窗表单，授权度量 2 步→更少交互），**取消勾选经内联确认**（列出连带
  失去的权限点后 DELETE /api/v1/assignments，保留 B3「撤销需二次确认」语义——
  服务端敏感词正则不适用于自绘确认，语义等价由行为测试钉定）。
- 「按权限点」派生视图：用户×权限点交叉表按资源分组（`groupCapabilities`），语义
  约束如实呈现——后端有效权限点只由「用户→角色」指派推导（`resolveSession` 中
  直接数据范围仅在已有能力时生效），API 无「按用户按权限点」原子写路径，故仅当
  某权限点对该用户只有**唯一角色来源**时允许直接勾选（等价勾选/取消那个角色）；
  多来源或授权清单不可读/未读尽时只读并给出原因（`permissionPlan` 四分支）。
- 角色清单/授权清单按 cursor 分页读尽（复用 limit+cursor 契约，`paged-source.ts`
  封顶 10 页）；读不到（403）或未读尽一律降级只读并提示，不冒充完整清单。
- 原「分配角色/撤销角色」弹窗表单退役（`AssignRoleForm`/`RevokeRoleForm` 删除，
  `kt-identity-action-assign/revoke` 入口随退）；账号启停/配置登录账号两动作保留。
- SoD 冲突由服务端原子校验拒绝——前端如实展示错误并保持勾选态（行为测试钉定）。

### ② 组织与员工页：可视化组织架构图（人数统计徽章）

- `console/org-chart.tsx` + `org-chart-model.ts`：左侧下拉式 TreeSelect 升级为
  常显树形图（`role=tree/treeitem/group` ARIA、aria-level/expanded/selected、
  展开/收起按钮、←/→ 方向键收展、Tab+Enter 可达；「全部组织」按钮恢复不过滤态）。
- 人数徽章两级：**直属 N 人** + **含下级 M**（仅当 subtree>direct 时出现）；
  口径=当前账号可见员工（employees 列表本受 DataScope 过滤）按 organizationId
  归集，分页读尽后统计（复用首屏页不重复请求）；未读尽时徽章为下限并如实提示、
  读取失败提示不可用、员工归属未展示的组织时计数提示（`headcountOf`）。
- 选中语义不变：点节点仍走既有 `GET /api/v1/employees?organization=<uuid>`
  服务端过滤（console.test 原 TreeSelect 用例迁移为点节点断言）。

### ③ 审计页：时间线视图（按日期分组）+ 导出保留

- `console/audit-timeline.tsx`：默认视图改为按**本地日历日**分组的事件流
  （今天/昨天相对标签 + 周几 + 当日条数；FAILURE 事件左侧红色强调 + 「失败」徽章）；
  筛选区新增「时间线/表格」视图切换（`aria-pressed`），表格视图完整保留
  （DataTable 全量分页）。CSV 导出逻辑零改动（B2 分页循环语义 + 10000 条上限保留，
  行为测试断言 cursor 循环不变）；时间线下分页/错误/加载/空态沿用 DataTable 的
  class 语义与「继续加载」契约。

### ④ 配置页：版本对比（当前 vs 上一版本并排差异高亮）

- `console/version-model.ts`（纯函数）+ `version-compare-state.ts`（状态机）+
  `version-compare.tsx`（组件）+ `config-versions.ts`（四页字段清单）：
  抽屉版本侧栏内增加「上一版本 vs 当前版本」并排表格，差异单元格按 改/增/删
  三色高亮，默认「仅显示差异」可切换全部字段，顶部汇总「变更 X · 新增 Y · 移除 Z」。
- 数据源零 API 变更：编号/规则/工作流取列表行**内嵌 versions[]**（服务端既有
  jsonb_agg 投影，取版本号排序后末两项）；主数据条目是生效期版本——经既有
  `GET /api/v1/master-data/entries/{id}?at=`（M3 端点）按「当前生效起点前一刻」
  读上一生效版本（条目版本计数 1 即首版不发请求；404 视为无上一版本；其它错误
  如实提示）。迟到/过期响应按行 key 丢弃（`isStale`）。
- 结构化值（规则 AST/工作流 spec/主数据 value/必需输入）按叶子路径展开逐项比对
  （`flattenLeaves` 深度封顶 6，空容器/null 占位）；字段清单逐页声明，不把 id/
  租户/创建人等逐版必变的审计列当差异。通知中心/业务对象两页无版本形态，不出现
  该区（spec 未声明 `versions`）。
- **如实登记（R4 不顺手修，待核实）**：配置页既有列表列引用 `effectiveFrom`/
  `prefix` 等键，而列表 API 实际返回形状疑为 `effective_from`/`versions` 内嵌
  （`to_jsonb` 投影）——既有列可能恒显空。本批新增代码按 API 原形键取数；既有列
  键名问题属 UI-M2b 既有行为，未改动、留待主协调核实另批。

### ⑤ 概览页：dashboard 组件化（卡片钻取 + 异常计数醒目提示）

- 约束如实披露：边界外 `bootstrap.test.ts` 以**同步断言**钉定概览 vanilla 卡片墙
  （标题/指标/「下一步：」文案），整页 Preact 化将使其变红——故本批采用
  「vanilla 同步基线 + 真实浏览器组件化升级」双层：
  - `workspace-card.ts`：11 张模块卡片标题行追加**原生钻取锚点**（`a.gov-card-link`
    → `#/governance/<subroute>`，样式拉伸覆盖整卡、键盘可达；卡内操作区/数据源
    预览 z-index 在其上层不受影响）+ **异常徽章**（`kt-gov-card-anomaly`，数据源
    读取失败时醒目计数）。卡片标题文本不变（黑盒探针按标题定位不受影响）。
  - `dashboard-model.ts`：四项指标口径从 `workspace-heading.ts` 收敛为单一来源
    （取值与原实现逐项一致），并派生「需要关注」清单（数据源异常按受影响模块给
    钻取去向；待审批/未读仅在对应子页对当前账号可见时给出，不产生无权限路由链接）。
  - `console/overview-dashboard.tsx`（Preact，ADR-0014「仪表盘页=指标卡+钻取」）：
    异常提示条（逐项可点击钻取 + 运行正常态）+ 四张指标卡（可钻取的渲染为链接、
    危险/警告 tone 描边）。经 `dashboard-upgrade.ts` 动态 import（独立懒载 chunk，
    宿主 `.governance-metrics` 已接入文档才挂载）在真实浏览器替换 vanilla 指标区；
    chunk 不可达或测试 DOM 无 isConnected 时同步基线仍可见（优雅降级）。

## 2. 文件清单（27 个，全部 apps/web/src/governance/\*\* 内）

新增 16：`governance-gov-ux.css`（域内样式，tokens 取值，并入宿主静态图）、
`dashboard-model.ts`、`dashboard-upgrade.ts`、`console/paged-source.ts`、
`console/audit-timeline.tsx`、`console/org-chart.tsx`、`console/org-chart-model.ts`、
`console/version-model.ts`、`console/config-versions.ts`、
`console/version-compare-state.ts`、`console/version-compare.tsx`、
`console/matrix-model.ts`、`console/identity-matrix-state.ts`、
`console/identity-matrix.tsx`、`console/overview-dashboard.tsx`、
`console/gov-ux.test.tsx`。
修改 11：`console/ports.ts`（ConsolePorts 增 views/viewError/fetchRecord 三能力，
全部 consolePorts 一处接线）、`console/audit-page.tsx`、
`console/organization-page.tsx`、`console/config-console.tsx`、
`console/config-specs.tsx`、`console/identity-page.tsx`、
`console/console.test.tsx`、`workspace.ts`（+3 行升级调用）、
`workspace-card.ts`、`workspace-heading.ts`（指标改经 dashboard-model）、
`console-entry.ts`（共享文件，纯追加 3 行 CSS import——协调更新后的允许项）。
退役：identity 页 `AssignRoleForm`/`RevokeRoleForm` 弹窗表单
（引用清零；原弹窗端点与载荷由矩阵同路径继承）。

## 3. 测试（红→绿）

- 新增 `console/gov-ux.test.tsx` 23 例：③ 时间线分组/相对标签/失败强调/表格切换/
  导出循环 cursor 不变/筛选参数不变/继续加载 cursor/空态；② 树形层级+两级徽章/
  未读尽下限提示/未展示组织提示/展开收起/点节点服务端过滤+aria-selected/全部组织
  清除；④ flattenLeaves/diffSnapshots 四态/pairFromRow 末两项/编号规则并排对比/
  仅显示差异切换/规则 AST 叶子路径/首版本提示/主数据 at= 请求与上一版渲染/首版本
  不发请求/读取失败 alert；① 按角色矩阵渲染与排序/勾选即 POST/取消勾选内联确认
  连带权限列出/确认 DELETE/取消不发请求/SoD 错误如实展示/无权限只读/搜索收敛列/
  仅看当前用户/权限点分组视图/唯一来源可勾选/多来源只读 title/来源不可读降级且
  按角色视图仍可管理；⑤ dashboardModel 指标口径与钻取清单/子页不可见不给链接/
  卡片锚点 href 与异常徽章/vanilla 指标基线保持/Preact 提示条与指标卡 tone/无异常
  运行正常/mountGovernanceDashboard 替换基线且未接入文档宿主不升级。
- 既有 `console.test.tsx` 16 例守恒迁移：identity 原「分配/撤销弹窗」两用例随表单
  退役（断言迁 gov-ux 矩阵族）；TreeSelect 用例改点节点；其余 14 例原断言不变。
- 边界外 `bootstrap.test.ts` 96 例零改动全绿（概览同步基线与源绑定锚点不受影响；
  概览 vanilla 标题断言、console 宿主 data-testid 断言全部保持）。
- G5 驱动拆分：`AuditConsolePage` 加入视图切换后完整函数 221 行超 200——按修复
  指引拆出模块级 `AuditToolbar`（筛选+视图切换，data-testid 逐字保持）与模块级
  列定义，拆后 structure-gate 强制违规 0、G5 精确豁免 0（未新增任何豁免）。

## 4. 门禁回执

| 门禁                                                                                                  | 结果                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 共享树预检 prettier / eslint（27 文件）                                                               | 0 / 0                                                                                                                                                                                                                            |
| 共享树预检 tsc --noEmit（governance 域）                                                              | 0 错误（剩余 7 错误全在并行会话未提交的 commercial/console/item-console.test.tsx，不在本批边界）                                                                                                                                 |
| structure-gate / function-length                                                                      | 强制违规 0（G5 拆分 0 豁免）/ 0                                                                                                                                                                                                  |
| service-boundary / verify:frontend-capabilities                                                       | 0 违规 / 19 平台端点族通过                                                                                                                                                                                                       |
| build + 启动预算 + console-css 守卫                                                                   | 通过——登录预算 JS 11752/12000 gzip 守恒；governance-gov-ux.css 并入唯一 CSS 包；overview-dashboard 独立懒载 chunk（4.46KB）                                                                                                      |
| web 单测（governance 43 + bootstrap 96）                                                              | 139/139 全绿                                                                                                                                                                                                                     |
| **完整 pnpm ci:local（第 3 轮：隔离干净克隆 + 共享 kingturf_test，U3 各批同款；协调排程下唯一在跑）** | **EXIT=0 全链 @ 干净 HEAD 92fd450（774133 ms）**；coverage check：overall 52786/65761（80.3%）· domain 630/672 · repositories 10447/12621、deficits 空（三目标达标且基线不降）；登录预算 JS 11750/12000 守恒、console-css 守卫过 |

三轮 CI 记录（如实）：①第 1 轮（隔离库 kingturf*govux_test）format:check 红——gov-ux.test.tsx 在末轮 eslint 修复后未重跑 prettier，本会话疏漏，amend 修复；②第 2 轮（同库）python ops 8 错误（phase12c_drill*\* 六个 StopError + rehearsal task-drain in-flight=1）——**与并行会话 ci:local 叠跑冲突**（drill 固定库名互删/共享状态互踩，主协调排程通知已确认该时段各会话 CI 均因此失败重跑）；③第 3 轮改用共享 kingturf_test 独占跑 EXIT=0。新建库不满足 ops 演练族前提（共享 kingturf_test 为历史批次人工收口库），临时库已清理。
| e2e P1（黑盒） | **未执行——KINGTURF_ADMIN_PASSWORD 所有者口令本会话不可得**（U3-COM/CRM/PROC 同已知缺口；本批曾于本地 dev 库自建临时验证账号并试图实跑浏览器冒烟，因本机 WSL2 缺 chromium 系统库且无 sudo 安装权限未成，账号已清理；行为覆盖由白盒 43 例 + 挂载断言 96 例补偿） |

## 5. 边界与后续

- **推送状态**：本人未执行任何 push；feat 提交 92fd450 已随 CRM-UX 会话 14:27:28 的 `git push`（共用分支固有行为）上远端 main（主协调已定性非违规）。本人按推送前新规则核查：`git log origin/main..HEAD` 现为空，无他人未复核提交挡在我之后。
- API 零改动：`apps/api/**` 本批零触碰；矩阵写路径、组织过滤、审计筛选、版本读取
  全部为既有端点既有语义。
- `packages/ui/**` 零改动（预算守卫不触碰共享组件层）；`bootstrap.ts` 零改动。
- 浏览器冒烟脚本与截图留在 /tmp/gov-ux-backup/（不入库）；临时验证账号已在本地
  dev 库清理（employees/identities/credentials/memberships/assignments 全删）。
- 已知如实缺口：① 配置页既有列键名疑与 API 响应形状不符（见 §1④，R5 待核实）；
  ② e2e P1 与真实浏览器冒烟未跑（见 §4 回执行）；③ 概览组件化受边界外同步测试
  钉定，整页 Preact 化待该测试族随域重写政策另批处理。

## 6. 共享文件改动（依协调共享文件规则逐项申报）

| 文件                                       | 改动                                                                                               | 性质                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/web/src/governance/console-entry.ts` | +3 行（`./governance-gov-ux.css` import + 2 行注释，紧跟既有 `./console/console.css` import 之后） | 纯追加（协调 2026-11-23 更新允许；未重排/未改写既有函数/未动无关 import） |
| `docs/index.md`                            | +1 行收录本证据文档                                                                                | 纯追加（工作区另含并行会话未提交行，按规则以精确补丁只暂存本行）          |
| `docs/exec-plans/tech-debt-tracker.md`     | 顶部 +1 段 GOV-UX 收官登记                                                                         | 纯追加（同上处理）                                                        |

其余本批触碰文件全部位于 `apps/web/src/governance/**`（派单边界内）。
