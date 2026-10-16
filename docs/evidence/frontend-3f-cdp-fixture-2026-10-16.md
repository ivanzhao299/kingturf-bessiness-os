# 3f前置工具：客户360合成响应契约修正（2026-10-16）

## 范围与授权

输入303d3d9实际稳定干净HEAD完整CI0/178202.497ms（`/tmp/kingturf-3e-date-303d3d9-head-ci-2026-10-16.log`）。开始3f已登记TD-BOUND001后，发现新增CDP harness的客户360 detail漏掉必需`unavailableSections`，故先做独立工具修正，不和解析业务混提交。

人类原冻结对象为现有Web114断言/夹具与Playwright config/9spec；CDP是本批授权创建扩展的synthetic工具。主代理一度误把历史byte对拍纪律当作人工冻结，协调核对原授权后纠正；随后用户也明确回复“允许独立修正该夹具（推荐）”。初问拟空数组，实际主读仓储/共享类型确定固定`['orders','finance']`，已向用户说明采用真实值，非扩大生产或其它夹具修改权限。

事实锚点：`apps/api/src/routes/customer-360.ts`的`projectCustomer360Result`固定回传found.unavailableSections，`apps/api/src/crm-repositories.ts:869`为orders/finance、`packages/types/src/index.ts:371`为同tuple。旧303d3d9 `scripts/e2e-cdp/fixtures.mjs:624–631`缺字段。这里只补那一个合成字段；web轻量parser仍只需string[]，不强tuple业务词汇。

## 负向与验证

**当前补记**：独立只读审核仓储tuple/路由透传/新Node契约与保护区零diff，无阻塞。原29浏览器`0Ct2nR`真实0，DOM80/viewport47/route69/text142/overflow56与旧计数一致；网络三零，preview/root/profile自有资源清理全真（`/tmp/kingturf-3f-cdp-dto-fixture-browser29-2026-10-16.log`）。待执行仅源码稳定干净HEAD完整CI；下段原29“待补”为先前时态。业务WIP本会话stash SHA `93d6aee46e0e26030cdeccda5311a753b2626c68`保留可恢复，验证工具前后apps/web、apps/api、packages、workflows/依赖/Playwright均零diff。

- 新增Node契约直接请求原映射的GET客户360，断言200/字段确为array/精确真实tuple。旧fixture真红（`/tmp/kingturf-3f-cdp-dto-fixture-red-2026-10-16.log`、`red2`），Array.isArray=false，非业务UI故障。初新测试曾按初拟[]写二级期待，核对真实tuple后冻结为orders/finance并再次旧红；两次都在第一项array断言失败，未改原用例。
- 补字段后纯JS fixtures/network-policy/driver共33真绿（原30+3e新增2+本次1），`/tmp/kingturf-3f-cdp-dto-fixture-tools-green-2026-10-16.log`。原probes/driver/network/preflight零diff，原Web179及Playwright不动；此次原CDP fixture不再宣称字节相同，唯一变更明确为字段补齐。
- 3f未提交业务WIP按14个明确路径存入本会话stash隔离，工具commit/CI不得混入；未丢弃文件。先重建303d3d9旧业务source的dist（旧3f candidate ignored dist不能当工具baseline），构建真实0，预算11368/1898。原fixture29/CDP与完整干净HEAD CI结果待随后真实补记。

TD-TEST008先登记，台账现46含历史项。只修synthetic契约，不推论生产缺字段，不放宽GET allowlist/未知或写入失败硬闸/物理命中/三秒driver预算，不改后端/packages/原114或Playwright。工具回滚基点303d3d9；源码SHA/实际干净HEAD CI待补。之后恢复本会话3f WIP并使已知必需字段缺失真实拒绝，继续至3f后整批人工验收。
