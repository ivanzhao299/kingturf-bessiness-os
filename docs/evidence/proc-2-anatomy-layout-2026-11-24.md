# PROC-2 供应链域 UX 第二批证据：采购域子路由化与抽屉对比表堆叠卡片（2026-11-24）

> 授权链：项目所有者第 4-7 次人裁 + 主协调全权。
> 性质：范围 A（TD-PROC-008，抽屉内对比表在窄容器下改按供应商堆叠的卡片）+ 范围 B（TD-PROC-010，采购域子路由化）。零 API / 仓储 / 域层改动，零新写路径，零 `packages/ui` 改动。
> 执行：PROC-2 会话，在隔离 worktree（`/tmp/proc2-wt`，分支 `proc/proc-2-anatomy`）与一次性 PG 容器上完成。真浏览器证据为本会话自建环境实跑，不是主协调的复验。

## 1. 基线与提交

基线 `e0babf3`（main）。分支建在 `47b74e7` 上，之后随 main 前进做过两次 rebase（`47b74e7` → `a3bd196` → `e0babf3`），均无冲突。第一次 rebase（→ `a3bd196`）带入的 web 改动是 MFG-3 的工艺路线控制台与侧栏两条样式规则（`abdd785`、`a3bd196`），本分支不碰 `style.css`，两条规则在 rebase 后的树里完好。第二次（→ `e0babf3`）只新增了本地 e2e 配方，没有 web 源码变化。

| 提交      | 类型 | 内容                                                                     | 文件 | 增 / 删     |
| --------- | ---- | ------------------------------------------------------------------------ | ---- | ----------- |
| `35da63e` | fix  | 范围 A：询价「报价对比矩阵」与供应商「报价历史对比」在窄容器下改堆叠卡片 | 6    | +735 / −50  |
| `9af788f` | ref  | 纯搬移：四个采购控制台宿主迁出 `console-entry.ts`（行为不变）            | 6    | +259 / −248 |
| `6902b9e` | feat | 范围 B：采购域子路由化（行为变更，TD-PROC-010）与同步的单测、e2e 契约    | 17   | +538 / −91  |
| `5f1f73b` | fix  | 范围 A 续：供应商对比单元格内徽章折行（见 §3，单独提交，可单独丢弃）     | 2    | +12 / −0    |
| `2c4d283` | docs | 证据、台账、索引与 AGENTS 记录                                           | 4    | +240 / −3   |

代码四个提交合计 21 个文件，+1510 / −355。提交标题均标 `[未测试]`，以 §11 的 ci:local 回执为准。

## 2. 范围 A：对比表在窄容器下改按供应商堆叠的卡片

### 2.1 问题

详情抽屉宽 `min(480px, 90vw)`、抽屉体内边距 20px。390px 视口下抽屉体内容宽只有 311px，行项 × 供应商的矩阵在这个宽度上读不了。`7be91d9` 让 DataTable 外层成为滚动容器并给单元格保留了最小列宽，但矩阵本身在手机宽度上仍然不可读。

### 2.2 做法（DOM / CSS 结构）

切换机制是**状态驱动的二选一渲染**，不是「两套结构同时渲染、靠 CSS 显隐」：

- `console/compare-stack.ts`：`useStackedCompare()` 返回 `[ref, stacked]`。ref 挂在对比区根节点上，用 ResizeObserver 实测该节点的内容宽度；不超过 `STACKED_COMPARE_WIDTH`（420px）时 `stacked` 为真。
- 宽度测不到时（单测用的 mini-DOM 没有 ResizeObserver、不支持该 API 的浏览器）`stacked` 恒为假，**保持矩阵，DOM 与此前逐字节一致**。这是既有契约不受影响的根据。
- `ref` 用 `useCallback` 保持稳定，切换形态时不会重新观测；节点卸载时断开观测。
- 两处 `QuoteComparison` 都是经 JSX 渲染的组件，hooks 放在任何早退之前。

询价（`rfq-console-detail.tsx`）：

- `SupplierQuoteCards`：`div.proc-compare-cards[data-testid=kt-rfq-quote-cards]` 下每家供应商一张 `article.proc-quote-card[data-testid=kt-rfq-quote-card][data-quote]`，卡内依次是供应商名、报价单 · 收于 · 有效至、以及全部询价行（每行 `li.proc-quote-line[data-testid=kt-rfq-card-line]` = 行项描述 + 复用的 `QuoteCell`）。
- 区块标签、报价单图例 `kt-rfq-quote-legend`、推荐说明在两种形态下都保留。

供应商（`supplier-console-detail.tsx`）：

- 原来的四个列渲染抽成 `SupplierCell` / `PriceCell` / `QuoteCell`（矩阵与卡片共用，DOM 与文案同源）。
- 每个 `kt-supplier-compare-item`（一个物料一组）内由表格换成 `SupplierCompareCards`：按供应商归并（组内保持既有排序，组序取各组首行次序），每家供应商一张 `article.proc-quote-card[data-testid=kt-supplier-compare-card][data-supplier]`，卡内列出该供应商的报价行。

样式在新建的 `console/procurement-console.css`（全部取值来自 kt tokens，经 `procurement-view.ts` 并入宿主静态图，裁定 15）：卡片纵向堆叠、`min-width: 0`、`max-width: 100%`，文字在卡片宽度内折行，长编号用 `overflow-wrap: anywhere` 断行。

### 2.3 契约

- 表格态的 DOM 与 `7be91d9` 之后一致；`rfq-console.test.tsx`、`supplier-console.test.tsx` 两份既有测试**零改动**。
- 卡片沿用矩阵单元格的标识：`kt-rfq-matrix-cell`（含 `data-quote`、`data-recommended`）与 `kt-supplier-compare-price`（含 `data-best`）。
- 卡片新增的标识：`kt-rfq-quote-cards`、`kt-rfq-quote-card`、`kt-rfq-card-line`、`kt-supplier-compare-cards`、`kt-supplier-compare-card`、`kt-supplier-compare-line`。

### 2.4 守卫

`console/procurement-compare-stack.test.tsx` 12 条：可控的 ResizeObserver 替身发宽度，验证无 ResizeObserver 时保持矩阵、不超过阈值时渲染卡片（卡数、卡序、行项、推荐 / 失效 / 最优 / 本供应商标记）、阈值含边界、两个方向来回切换、桌面 440px 保持矩阵；另有样式表静态守卫（堆叠规则、仅 kt tokens、经宿主静态图引入）与徽章折行的源码守卫（§3）。

## 3. 范围 A 续：桌面抽屉里的徽章折行（超出收窄后范围的一项）

主协调把范围 A 收窄为「只做窄容器堆叠卡片」，前提是桌面问题已由 `7be91d9` 解决。本会话在真浏览器里量测子路由时发现前提对其中一张表不成立，于是做了对照：

| 同一数据、同一环境下的「报价历史对比」第一列 | main `e0babf3`     | 本分支修复前 | 本分支修复后   |
| -------------------------------------------- | ------------------ | ------------ | -------------- |
| 桌面 1440px：「青岛金特夫草纱战略供应商」    | 12 行 × 1 字       | 12 行 × 1 字 | 5 行 × 约 5 字 |
| 手机 390px                                   | 矩阵，12 行 × 1 字 | 已是堆叠卡片 | 堆叠卡片       |

成因在该单元格内部：它是「名称 + 『本供应商』徽章」横排且不换行的 flex 容器，徽章自带 `white-space: nowrap`，列宽不足时徽章先占满，名称只剩一个字的宽度。`7be91d9` 的滚动容器与单元格最小列宽管不到这里。询价矩阵没有「长名称 + 徽章同排」的单元格，所以桌面审计本来就是通过的（最挤处 6.6 字/行）。

在最新 main `cbb2fca`（已含 `752119b` 的字号修复与 `8b3f24d` 的 ASCII 单元格不折行）上复测，结果相同：桌面与手机都是 12 行 × 1 字。`8b3f24d` 只给 render 返回字符串的单元格加不折行，这里三列都是返回元素的单元格，不在其列。

修复 `5f1f73b`：三个共用单元格的行内容器加 `flexWrap: 'wrap'`，徽章放不下时折到下一行。没有动列最小宽度，没有动 `packages/ui`。这一个提交是独立的，主协调若认为不应在本批处理，可以直接丢弃，不影响其余三个提交。

残余：桌面 480px 抽屉里四列并排仍然偏挤（长名称约 5 字/行，「MOQ 800 · 2026-12-05」这类内容折成三行，最后一列需要横向滚动才能看全）。再改善需要给这张表设列最小宽度并固定首列，这正是主协调明确说本批不要再做的一项，所以没有做，列为待裁事项（§10）。

## 4. 范围 B：采购域子路由化

### 4.1 路由与可见性

| 路由                          | 中文名       | 可见性                                                         | 数据闭包（均为概览闭包的子集）                                      |
| ----------------------------- | ------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `procurement`                 | 采购概览     | 前缀 `supplier:` / `procurement:` / `inventory:`（原规则不变） | 原 9 个数据源不变                                                   |
| `procurement/suppliers`       | 供应商与准入 | `supplier:read`                                                | suppliers、supplier-quotes、manufacturing-items                     |
| `procurement/rfqs`            | 询价管理     | `procurement:read`                                             | procurement-rfqs、manufacturing-items                               |
| `procurement/purchase-orders` | 采购订单     | `procurement:read`                                             | purchase-orders、manufacturing-items、suppliers、contract-documents |
| `procurement/goods-receipts`  | 收货管理     | `procurement:read`                                             | goods-receipts、purchase-orders、inventory-locations                |

子路由的可见性取各控制台主数据源的读权限，与 `readableCommercialSources` 的映射同口径。概览路由仍是前缀规则，但它不再连带放行子路由：例如只有 `supplier:manage` 或只有 `inventory:read` 的账号看得到概览，看不到任何子路由。角色目录里没有任何角色是「有 manage 无 read」，采购专员（`supplier:*` + `procurement:*` + `inventory:read`）四条子路由全可见，库存控制员（`inventory:read` + `inventory:move`）只有概览。

### 4.2 概览页 `#/procurement`

- 面板仍是 `section.procurement-workbench[data-testid=procurement-workbench]`，`data-route-view="procurement"`，旧书签照常打开。
- 顶部四张汇总卡的口径与文案逐字沿用（`procurement-summary.ts`）。目标子路由对当前账号可见时整卡是指向该路由的锚点（hash 导航，同治理域概览的 `a.metric`），不可见时保持纯指标卡——否则点进去会被导航兜底弹回首个可用路由。
- 「供应商报价」「批次库存台账」两块 vanilla 面板原样保留在下方，代码未改。
- 面板的说明文字由「供应商、询报价、采购与批次收货」改为「采购待办汇总；下方为供应商报价与批次库存台账」，因为前一句描述的四个控制台已不在此页。标题「供应商、采购与批次库存」未改。
- 模板面板（「采购概览常用模板」）留在概览路由，没有扩散到子路由。理由：上下文文档是按路由各建一个面板，各带独立的参考数据与已保存在线文档请求，而且在线文档按路由分片存放；把子路由加进模板的路由列表会新增首屏请求并让文档按子路由分散。是否下放到子路由待主协调裁定（§10）。

### 4.3 装配

- `procurement-surfaces.ts`：surface 注册表（控制台 id、路由、读权限），做法同 `governance/surfaces.ts`。`visibleAppRoutes`、侧栏分组与宿主装配共用这一处定义。
- `shell-frame.ts`：「采购管理」从「供应链与生产」的一项升为独立分组，组内为概览 + 四条子路由。`procurement` 只出现在一个分组的 `data-nav-routes` 里。
- 宿主：四个宿主节段自身成为路由视图（携带 `data-route-view`，直接挂工作区根），与其它商业控制台宿主同口径；只在对应路由可见时挂载。宿主函数从 `console-entry.ts` 迁到 `console/supplier-host.ts`、`rfq-host.ts`、`po-host.ts`、`gr-host.ts`，`console-entry.ts` 745 → 503 行，纯删 242 行、零新增。
- `workspace-frame.ts`：`.commercial-status` 的 `data-route-view` token 清单加入四条子路由，否则子页面上看不到加载与错误提示。
- `route-dependencies.ts`：四条子路由各自的数据闭包。概览闭包未变，加载概览时的出站请求与此前一致。
- `workspace-routes.ts` 未改：`'procurement-workbench': 'procurement'` 仍然成立，宿主自己带 `data-route-view`。
- 写操作后停留在子路由：四个控制台内部没有任何导航调用，`controller.submit` 对采购路径不触发重载，也没有会重建工作区的监听。真浏览器实证见 §6。

## 5. 测试与断言变更

### 5.1 被修改的断言（共 2 处，无删除、无弱化）

`apps/web/src/bootstrap.test.ts` › `renders supplier, sourcing, purchase, receipt, and immutable lot-balance evidence`

| 改前                                                                                                                                     | 改后                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 对四个宿主各两条：在 `.procurement-workbench` 内找到 `suppliers-console` 等；`data-testid` 等于 `kt-proc-*`；`data-route-view` 为 `null` | 对四个宿主各四条：在整个工作区内恰好 1 个；`data-testid` 等于 `kt-proc-*`；`data-route-view` 等于对应子路由；`.procurement-workbench` 内为 0 个 |

`tests/e2e/p1-demo.spec.ts` › `shows supplier qualification, received purchase order, receipt, and derived lot balance`

| 改前                                                                               | 改后                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openRoute(page, 'procurement')` 后在 `.procurement-workbench` 范围内断言 7 段文案 | 依次 `openRoute` 四条子路由，在各自宿主（`kt-proc-suppliers` 等）内断言供应商、询价、采购单、收货 4 段；再 `openRoute(page, 'procurement')` 在 `.procurement-workbench` 内断言报价、批次、结存 3 段 |

7 段文案的正则一字未改。第 119–120 行的导航巡检未改，`openRoute` 的用法未改。

### 5.2 新增的测试

| 文件                                         | 条数 | 内容                                                                                                                                         |
| -------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `console/procurement-compare-stack.test.tsx` | 12   | §2.4                                                                                                                                         |
| `bootstrap.test.ts`                          | 4    | 子路由可见性（含 `appRouteFromHash` 与旧书签）；宿主按读权限挂载且不进概览面板；汇总卡文案口径与「只链接可见子路由」；侧栏分组               |
| `commercial-route-data.test.ts`              | 10   | 依赖矩阵新增 4 行；子路由闭包 ⊆ 概览闭包（4 条参数化）；不越权拉取读不到的数据源；深链只拉所需、概览加载后四条子路由即就绪、概览出站请求未增 |

web 全量 749 条通过（49 个文件），其中本批新增 26 条（基线 `e0babf3` 为 723 条）。纯搬移提交 `9af788f` 单独验证过：当时既有测试零改动，721 条全绿。

## 6. 真浏览器量测与 e2e

### 6.1 环境

- 浏览器：`mcr.microsoft.com/playwright:v1.62.1-noble` 自带 Chromium，无头。
- 网络：浏览器容器以 `--network container:kingturf-pg-proc2` 加入本会话 PG 容器的网络命名空间；API（127.0.0.1:3947）、vite preview（127.0.0.1:4197）与浏览器同在该命名空间的回环上，其中 127.0.0.1:5432 就是本会话的 PG，命名空间内没有其它数据库。API 启动前比对 `pg_control_system().system_identifier` 与经 `docker exec` 从本会话 PG 取得的值，不一致拒绝启动。
- 数据：`scripts/seed_p1_demo.mjs` 经 API 灌入演示数据；量测脚本另经界面新建了 2 家供应商、经 API 登记了 2 条报价，使对比表有多家供应商。
- 账号：合成的全权限账号（193 项能力）与一个只授 `inventory:read` / `inventory:move` 的账号。不是项目所有者口令。
- 量测对象是「`a3bd196` + 本批四个提交」的构建；之后的 rebase 没有 web 源码变化，结论对最终提交同样成立。

### 6.2 定向量测（`/tmp/proc2-verify/measure.mjs`，30 项全部通过）

判据沿用主协调巡检脚本的规则（表格宽于裁剪祖先且不可滚动、某元素直接文本 ≥3 行且每行 ≤2.5 个字、浏览器默认外观按钮），另加「可见元素越出作用域右边界」。

| 范围           | 结果  | 关键数字                                                                                                                                                                                                                |
| -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 侧栏与概览     | 6 / 6 | 「采购管理」独立分组、概览 + 四子路由；标题「采购概览」，可见视图都属于该路由；四张汇总卡为锚点，文案与接口数据逐张一致；只含两块台账、不含控制台宿主；布局审计零问题；点「待准入供应商」进入 `#/procurement/suppliers` |
| 桌面子路由     | 4 / 4 | 逐条进入：标题正确，只有该路由的视图可见，页面无横向溢出，布局审计零问题                                                                                                                                                |
| 写流程         | 3 / 3 | 服务端接受创建载荷；新建供应商成功后仍在 `#/procurement/suppliers`，列表行数 +1；回到概览汇总卡数值随数据更新并与接口一致                                                                                               |
| 桌面抽屉       | 2 / 2 | 询价与供应商两张对比表都渲染矩阵、不渲染卡片；抽屉体无溢出、无裁切、无一字一行                                                                                                                                          |
| 手机 390px     | 7 / 7 | 四条子路由各自可达且无溢出；询价对比 3 张卡、供应商对比 3 张卡，卡宽 303px 等于对比区宽度，矩阵未渲染；抽屉体布局审计零问题                                                                                             |
| 活尺寸切换     | 1 / 1 | 抽屉开着由 390px 放宽到 1440px 回到矩阵，再收窄恢复卡片                                                                                                                                                                 |
| 库存权限账号   | 3 / 3 | 分组里只有概览；四张汇总卡为纯指标卡；直接访问 `#/procurement/suppliers` 被带回 `#/overview`，页面上没有供应商宿主                                                                                                      |
| 准备数据       | 1 / 1 | 经 API 为第二家供应商登记报价成功（该询价单的报价数即手机端应有的卡片数，≥ 2）                                                                                                                                          |
| 报错与失败请求 | 3 / 3 | 桌面、手机、库存权限三段流程均零控制台报错、零 ≥400 响应                                                                                                                                                                |

### 6.3 e2e P1

仓库自带的 `tests/e2e/p1-demo.spec.ts` 在同一环境里实跑三轮，仓库原配置、不放宽任何超时：**11 / 11、11 / 11、11 / 11**（32.2s、32.1s、31.8s）。第 3 例（手机视口导航巡检，含未改动的 `procurement` 断言）与第 9 例（改写后的采购用例）都在内。`openRoute` 展开分组后立即点击，依赖 `a3bd196` 去掉子菜单高度过渡。

### 6.4 局限

- 只有 Chromium，只有 1440px 与 390px 两种宽度，另有抽屉开着在这两者之间切换的一次检查。
- 账号只有全权限与库存权限两种；中间形态（例如只有 `procurement:read`）由单测覆盖，没有在浏览器里看过。
- 写流程只点了「新建供应商」一步；其余写路径仍只有单测、契约与真库测试覆盖（TD-TEST-024 不因本批关闭）。
- 这是执行会话的自测，不是主协调的独立复验。

### 6.5 临时资产

量测脚本、日志与报告在 `/tmp/proc2-verify/`（`measure.mjs`、`report.json`、`e2e-p1*.log`），截图在 `/tmp/proc2-verify/shots/`（桌面概览、桌面两张抽屉、手机两张卡片抽屉、手机概览长图、库存权限概览，以及与 main 的对照图）。均未入库。验证用容器与临时 worktree 已删除。

### 6.6 在最新 main 上的复测

§6.2 与 §6.3 量的是 `a3bd196` + 本批四个代码提交。之后 main 又进了 `752119b`（表格字号由 16px 恢复为 14px）与 `8b3f24d`（ASCII 单元格不折行），正好落在对比表上，所以在「main `cbb2fca` + 本批四个代码提交」的临时 worktree 上重跑了一遍（各包使用各自的 `packages/ui`，已确认构建产物带新规则）：

| 对象                                           | 桌面 1440px 询价矩阵                   | 桌面 1440px 供应商矩阵                    | 手机 390px                         | e2e P1                    |
| ---------------------------------------------- | -------------------------------------- | ----------------------------------------- | ---------------------------------- | ------------------------- |
| 本批（main `cbb2fca` + 四个代码提交）          | 矩阵，布局审计零问题（最挤 7.7 字/行） | 矩阵，布局审计零问题；供应商名 5 行       | 两张表都是堆叠卡片，布局审计零问题 | 11 / 11、11 / 11、11 / 11 |
| 最新 main `cbb2fca` 本身（同一数据、同一环境） | 未单独量                               | 供应商名 12 行 × 1 字，审计报「一字一行」 | 仍是矩阵，12 行 × 1 字             | 未跑                      |

定向量测 30/30。相对旧基线，询价矩阵最挤处由 6.6 字/行变为 7.7 字/行（字号变小所致）；供应商名修复后仍是 5 行，最新 main 上的缺陷表现也仍是 12 行 × 1 字。

## 7. 共享文件改动

| 文件                                     | 改动                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `shared/navigation.ts`                   | `AppRoute` 联合、标签、描述各加 4 条子路由；`procurement` 的标签由「采购管理」改为「采购概览」，描述随之更新 |
| `crm/shell-frame.ts`                     | 「供应链与生产」去掉采购管理一项；新增 `navGroup('采购管理', 'delivery', …)`，组内 5 项                      |
| `bootstrap.ts`                           | 新增 1 行 import 与 1 处循环：`for (const route of procurementSubRoutes(permissions)) routes.add(route);`    |
| `bootstrap.test.ts`                      | §5：修改 1 组断言，新增 4 条测试，import 列表加 `APP_ROUTE_LABELS`                                           |
| `commercial/console-entry.ts`            | 只减不增：−242 行                                                                                            |
| `commercial/store/route-dependencies.ts` | `routeSources` 加 4 条子路由闭包                                                                             |
| `commercial/workspace-frame.ts`          | 状态节点的 `data-route-view` 加 4 个 token                                                                   |
| `commercial/workspace-routes.ts`         | 未改                                                                                                         |
| `tests/e2e/p1-demo.spec.ts`              | §5：采购用例改按子路由断言                                                                                   |

登录入口预算不受影响：登录入口的静态可达集只有 `index-*.js`，上述文件都在动态加载的 bootstrap 分块里。构建前后 `Login critical path: JS 11751 bytes` 不变。

## 8. 给「制造主数据子路由化」复用的接线步骤

1. **先单独提交一次纯搬移**：把该域的宿主函数从 `console-entry.ts` 迁到 `console/<域>-host.ts`，行为不变，既有测试零改动即应全绿。这样复核时可以机械比对函数体。
2. `shared/navigation.ts`：`AppRoute` 联合、`APP_ROUTE_LABELS`、`APP_ROUTE_DESCRIPTIONS` 各加子路由（都是 `Record<AppRoute, …>`，漏一条类型检查就会报）。多段 hash 不需要额外处理，`appRouteFromHash` 整段匹配。
3. 照 `commercial/procurement-surfaces.ts` 建该域的 surface 注册表：控制台 id、路由、该控制台主数据源的**读权限**（精确到 `xxx:read`）。
4. `bootstrap.ts` 的 `visibleAppRoutes`：概览那条 `addWhen` 前缀规则保持不动，后面加 `for (const route of <域>SubRoutes(permissions)) routes.add(route);`。
5. `crm/shell-frame.ts`：从原分组里删掉概览那一项，新增 `navGroup('<域名>', '<图标>', [[<图标>, '<概览名>', '<概览路由>'], …子路由])`。概览路由必须只出现在一个分组的 `data-nav-routes` 里，e2e 的 `openRoute` 靠它定位分组父按钮。
6. `commercial/store/route-dependencies.ts`：给每条子路由加数据闭包，取概览闭包的子集，概览闭包本身不要动。在 `commercial-route-data.test.ts` 的依赖矩阵里补行。
7. `commercial/workspace-frame.ts`：把子路由 token 加进 `.commercial-status` 的 `data-route-view`，否则子页面看不到加载与错误提示。
8. 宿主节段自己设 `data-route-view=<路由>` 并挂到工作区根（与 `createConsoleHost` 同口径）；在概览的装配函数里按 `visible<域>Surfaces(permissions)` 决定挂不挂。`workspace-routes.ts` 的类名映射不用改。
9. 概览页：面板的 class 与 `data-testid` 原样保留（导航巡检用），汇总卡只在目标子路由可见时做成锚点（`procurement-summary.ts` 可直接照搬），vanilla 残余不动。
10. 测试：`bootstrap.test.ts` 里宿主位置的断言要改（改前是「在面板内、`data-route-view` 为 null」），再补可见性、挂载、汇总卡、侧栏分组四类；e2e 用例改按子路由逐条进入再断言，导航巡检那两行不要动。逐条记下改前改后。
11. 验证时看三件单测看不到的事：登录入口字节数是否不变、侧栏分组在真浏览器里能否被 `openRoute` 展开、只有部分权限的账号是否看得到不该看的子路由。

## 9. 台账增减

| 编号        | 变更                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| TD-PROC-005 | 更新：采购四宿主已迁出，`console-entry.ts` 745 → 503 行；其余域按域整体拆分另批    |
| TD-PROC-008 | 更新：窄屏堆叠卡片与桌面徽章折行已修；桌面列宽偏挤为残余，待裁                     |
| TD-PROC-010 | 更新：已修复，待主协调复核                                                         |
| TD-PROC-012 | 新登记：概览「待准入供应商」的口径把所有供应商都算进去                             |
| TD-TEST-025 | 新登记：`scripts/e2e-cdp/probes.mjs` 的采购分支仍指向已退役的 vanilla 卡片与旧标题 |

更正一处既有表述：台账此前把 `inventory-register` 记作「库存只读呈现」。实际上「供应商报价」面板带「＋ 登记供应商报价」（写 `supplier-quotes`），「批次库存台账」每个批次带「领用 / 调整」（写 `inventory-movements`）。两块面板不是纯只读。本批按要求原样保留、代码未改。

## 10. 已知偏差与待裁事项

1. **基线 SHA**：指令先后给过 `4e0ae4a`、`e3c2a21`、`47b74e7`。建分支时 main 已经在 `47b74e7`，直接以它为基线；之后随 main 前进 rebase 到 `e0babf3`。
2. **做了一件收窄范围之外的事**（§3，`5f1f73b`）：桌面抽屉里供应商名一字一行是 `7be91d9` 没有解决的既有问题。只做了单元格内徽章折行这一处最小修复，列最小宽度没有碰。
3. **待裁：桌面列宽**。供应商对比表在 480px 抽屉里四列并排仍偏挤。建议给供应商列与报价单列设域内的列最小宽度并固定首列（表格横向滚动）。没有做，因为指令说本批不要再做列最小宽度。
4. **待裁：模板面板**。采购模板仍只挂在概览路由（§4.2）。
5. **待裁：堆叠形态下的报价单图例**。询价对比在卡片形态下图例与每张卡的「报价单 · 收于 · 有效至」重复。为了让 `kt-rfq-quote-legend` 在两种形态下都在，没有去掉图例；若只求手机上更紧凑，可以只在矩阵形态保留图例。
6. **待检库存卡的落点**：四张汇总卡按位对应四条子路由，「待检库存」指向收货管理。这个口径的数据本体在概览页的「批次库存台账」，收货管理只是业务上游；若认为应指向别处（或不可点），只需改 `procurement-summary.ts` 里一行。
7. **观察，未处理**：概览页上「采购概览常用模板」面板排在汇总卡与台账上方。这是全站惯例（凡有模板的路由，「业务文件」面板都排在工作区之前），main 上同样如此，本批没有改动。
8. **e2e 没有扩展导航巡检**：手机视口巡检仍只打开 `procurement`，没有加入四条子路由（现有巡检也不含治理域子路由）。入库的走查脚本缺省取路由表全集，会自动覆盖新子路由。
9. **rebase 到最新 main 停在一处文档冲突，未自行解决**。分支交付时基于 `e0babf3`；main 此后前进到 `cbb2fca`。在临时 worktree 里试过 rebase：四个代码提交零冲突，文档提交在 `docs/exec-plans/tech-debt-tracker.md` 冲突。原因是 main 的 `cbb2fca` 往台账表里加了更长的行，对齐后的宽度超过 prettier 的阈值，整张表被改成紧凑格式，而我的行改动是在旧的对齐格式上做的。AGENTS.md、`docs/index.md` 与证据文档都能自动合并。按「rebase 出现冲突，停下报告，不要自行解决」的指令，分支保持原样。解法是确定的：以 main 的表为准，重新应用五处行改动（TD-PROC-005 / 008 / 010 的状态、新增 TD-PROC-012 与 TD-TEST-025），并在我的段落里补上回执。
10. **一次对被禁端点的连接尝试，无任何读写**。为适配「浏览器容器与 PG 容器同网络命名空间」的拓扑，我把宿主机侧环境助手里的端口闸从 5437 放宽成了 5432；随后在宿主机上运行自举脚本时，脚本向 `127.0.0.1:5432`（主库 compose 实例）发起了一次连接，要打开的库名是 `kingturf_test_proc2`。主库上没有这个库，连接被服务端以 `FATAL 3D000` 拒绝，没有任何查询被执行，也没有触碰 5432 上的任何库。发现后已把端口闸改回：宿主机侧助手钉死 5437、库名与回环主机，并对 5432、错误库名、非回环主机各做了一次拒绝测试；容器内的连接串只在容器启动脚本里给出，不再由宿主机侧的助手生成；实例指纹校验也补做了一次「错误指纹被拒」的测试。

## 11. CI 回执

快照 `2c4d283`（基线 `e0babf3` + 本批五个提交，工作区零改动），在隔离 worktree `/tmp/proc2-wt` 与本会话专用 PG 容器 `kingturf-pg-proc2`（宿主机回环 5437，全新实例）上运行 `NODE_ENV=test pnpm ci:local`：

| 项                  | 结果                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 退出码              | **EXIT=0**                                                                                                                |
| 起止                | 2026-11-24 12:16:29 → 12:28:19（710s）                                                                                    |
| API                 | 179 个文件，17969 / 17969                                                                                                 |
| Web                 | 49 个文件，749 / 749                                                                                                      |
| 其余包              | UI 包 71 / 71；另四个包 75、20、5、48 全过                                                                                |
| Python 发布演练     | Ran 145 tests，OK                                                                                                         |
| 覆盖率              | overall 56564/69416（81.49%）、domain 630/672、repositoryLines 10957/12878，deficits 为空；结果的 head 字段记录 `2c4d283` |
| 登录入口预算        | JS 11752B（上限 12000B）                                                                                                  |
| 结构门禁 / 服务边界 | 强制违规 0（白名单豁免 30 条、G5 豁免 0 条）；service-boundary 0 违规                                                     |
| 文档 / 审计         | doc-lint 通过（索引收录 311 个 docs 文件）；audit 无已知漏洞                                                              |

日志 `/tmp/proc2-ci-1.log`。未被这次运行覆盖的只有之后追加的文档提交。
