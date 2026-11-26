# MG2 制造写路径裁定落地（2026-11-26）

## 1. 范围、基线与裁定

分支 `fix/w2-mfg-guards`，工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave2/mfg-db`。基线 `main@4a93003aac22bdf52e82d7ae2b74098897157bc8`。仅实施 TD-MFG-012、014、015、017。复核、集成与发布归主协调；本批没有 push、合并 main、触发发布或运行完整 `pnpm ci:local`。

项目所有者在任务书中的裁定原文：

| 项目       | 裁定原文                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| TD-MFG-014 | 数据库层禁止向已发布版本插入子行。                                                                      |
| TD-MFG-015 | 组件必须全部已发布（与替代料一致）；存量混合 BOM 只核查、不自动改写。                                   |
| TD-MFG-012 | SALES_ORDER 为准；SALES-ORDER 作为别名接受并归一存储为 SALES_ORDER。不加迁移（存量行不改）。            |
| TD-MFG-017 | 允许小数。把规范化/指纹逻辑收敛到一个共享实现。对旧入口原本接受的所有输入，新旧规范化指纹必须逐个相等。 |

D 项勘探后主协调补充裁定：选择 C，只收敛版本内容指纹 `canonical_hash`；续版入口的幂等请求绑定摘要 `request_hash` 保持现有 PostgreSQL jsonb 口径，不加兼容分支。拆成纯重构与行为变更两个提交，任何中间提交都不故意破坏小数续版。C 项允许同时适配演示种子的规范写法、种子查找的历史兼容及 Docker 诊断。

台账处理经主协调确认：本分支的基线没有这四项的主表行，只在台账标题下加本批小节，不新增、重排或修改主表；主协调在集成分支统一登记状态。AGENTS、发布记录与 active 计划不改。

先读的任务证据是 [MFG-7](mfg-7-version-continuation-2026-11-25.md)、[MFG-6](mfg-6-mrp-console-2026-11-25.md)、[WF-A](wf-a-server-write-paths-2026-11-24.md) 及 [MFG-5](mfg-5-shop-floor-2026-11-24.md) 的既有拒绝映射先例。数据库只用本批实例 `w2-mfg-db-pg`（回环端口 5446），没有连接生产或共享开发库。连接串仅通过环境传入，不落盘。

## 2. 提交清单与修改理由

| 提交      | 英文主题行（各代码提交均标 `[未测试]`）                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `8f8dd5c` | fix(mfg): forbid inserting child rows into published manufacturing versions (TD-MFG-014) |
| `7c5a3fc` | fix(mfg): require every BOM component to be published before publishing (TD-MFG-015)     |
| `67a04f6` | fix(mrp): store the SALES-ORDER demand source as SALES_ORDER (TD-MFG-012)                |
| `813d1f5` | refactor(domain): extract a policy-parameterized canonical serializer (TD-MFG-017)       |
| `3aa984a` | fix(mfg): share content fingerprints and accept decimal specifications (TD-MFG-017)      |
| `9dfb6f1` | fix(mrp): normalize only the exact demand source alias (TD-MFG-012)                      |
| `6b1a418` | fix(mfg): serialize child insertion with version publication (TD-MFG-014)                |
| `c27e960` | fix(mfg): validate components when creating a published BOM (TD-MFG-015)                 |

`[未测试]` 仅表示本会话没有跑完整 `pnpm ci:local`，不表示未跑定向门禁。完整 API、其它包全量与浏览器的代码快照为 `6b1a418`；最终创建即发布补强为 `c27e960`，按项目所有者最新要求只再跑相关制造/桥轨、311/28、lint/tsc。两个快照的日志在 §8 分开列明，未把原全量当作补强后的全量。最后另有纯文档提交，编号以分支日志为准。

| 修改文件                                                                                             | 原因                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/database/migrations/0078_manufacturing_published_child_insert_guard.sql`                   | 只给子行冻结守卫加 INSERT 分支及父版本共享行锁，重建三个触发器的事件集合。                           |
| `packages/database/migrations/0079_bom_requires_published_components.sql`                            | 只把 BOM 发布的组件条件改为全部已发布，保留非空组件要求和其它分支。                                  |
| `apps/api/src/manufacturing-repositories.ts`                                                         | 独立发布与根创建即发布共用未发布组件的中文 409 前置校验；根创建的内容指纹改用共享函数。              |
| `apps/api/src/manufacturing-fingerprint.ts`                                                          | 制造内容指纹唯一实现；复用 domain 的结构规范化，只扩展制造数值口径。                                 |
| `apps/api/src/manufacturing-version-repository.ts`                                                   | 续版内容指纹改用共享函数；PG 请求摘要仅改名为 `requestBinding` 并解释用途，摘要 SQL 原文不变。       |
| `apps/api/src/mrp-repositories.ts`                                                                   | 精确归一唯一别名，存储、响应、审计与指纹使用同一规范入参。                                           |
| `packages/domain/src/index.ts`                                                                       | 抽出 `canonicalizeWith(numberPolicy, value)`，既有 `canonicalize` 委托严格整数策略，其它域口径不变。 |
| `packages/domain/src/canonical.test.ts`                                                              | 固化 28 个基线规范文本与 2 个大输入摘要，另测数值策略、旧拒绝规则和键序。                            |
| `apps/api/test/manufacturing-fingerprint.test.ts`                                                    | 旧公式与新内容指纹差分，覆盖安全整数、嵌套 JSON、数组、字符串、布尔、null、小数及保留的拒绝项。      |
| `apps/api/test/manufacturing-specification-postgres.integration.test.ts`                             | 根创建小数、旧整数摘要守恒、两入口内容指纹同源、请求绑定仍为 PG jsonb、重放无副作用。                |
| `apps/api/test/manufacturing-published-child-postgres.integration.test.ts`                           | 三子表拒插、草稿放行、旧更新删除规则、旧守卫还原、迁移重放与续版发布。                               |
| `apps/api/test/manufacturing-child-concurrency-postgres.integration.test.ts`                         | 三子表乘两种先后顺序的双连接锁等待测试。                                                             |
| `apps/api/test/bom-publish-components-postgres.integration.test.ts`                                  | 升级保留旧混合 BOM、两条发布轨与触发器兜底；真实 HTTP 创建即发布的 409、六类零残留及 201 正例。      |
| `apps/api/test/fastify/manufacturing-boms.test.ts`                                                   | 409 中文消息透传，既有其它 P0001 拒绝仍按端点原规则处理为 500。                                      |
| `apps/api/test/mrp-source-postgres.integration.test.ts`                                              | 别名归一、销售订单验证、唯一键语义、存量不改和非别名原样保留。                                       |
| `apps/api/test/production-postgres.integration.test.ts`                                              | 原夹具在发布后插子行，依赖本次修复的缺口；改合法建数顺序，业务断言一条不改。                         |
| `packages/database/test/migrations.test.ts`                                                          | 对 0078/0079 与 0036 做机械比对，保护旧分支原文，更新最新迁移钉定。                                  |
| `packages/database/test/{read-only-status,startup-gate}.integration.test.ts`                         | 当前迁移数与待应用后缀更新为 79。                                                                    |
| `scripts/{application_release.py,prepare_release_bundle.sh}`                                         | 发布物料的迁移清单绑定同步更新为 79。                                                                |
| `tests/operations/{apply_migrations_rehearsal,production_preflight,release_migration_drill}_test.py` | 演练的批准后缀、数量与最新迁移钉定同步更新。                                                         |
| `scripts/seed_p1_demo.mjs`                                                                           | 改发规范来源，幂等查找兼容历史别名，避免重灌新增需求。                                               |
| `scripts/e2e-docker/mrp-input-diagnostics.mjs`                                                       | 不可变快照仍可能含旧拼写，诊断兼容两种。                                                             |

没有修改 `apps/web`、`packages/ui`、registry、运行时依赖或发布工作流。界面复用既有 BOM 抽屉错误位及物料表单。

## 3. A：已发布版本禁止插入子行

全迁移检索确认，`protect_published_manufacturing_child()` 与 `validate_manufacturing_publish()` 在 0036 之后没有任何迁移重定义。0078/0079 均以 0036 为底本。0077 真库上三条冻结触发器为 `BEFORE DELETE OR UPDATE`，缺少 INSERT。

0078 给 `protect_published_manufacturing_child()` 前置 INSERT 分支：BOM 行项查 `NEW.bom_version_id`，工序查 `NEW.routing_version_id`，替代料经 `NEW.bom_line_id` 找父 BOM 版本。父版本已发布即 `P0001`，说明“已发布版本不可变，不能追加子行，应续建草稿”。草稿插入继续放行。旧 UPDATE/DELETE 分支的 865 字节原文、检查顺序和消息全部保留；静态用例将最终 0078 与“0036 原定义 + 明确的新增分支 + 六条触发器重建语句”全文比较。

现有生产写入口都通过 `insertBomLines` / `insertRoutingOperations` 向新草稿插入子行，没有发现端点能直接向已发布版本追加子行，故没有新增端点错误映射。原制造真库写测试及 MFG-7 续版发布测试照跑。

### 3.1 真库前后对照

独立基线树 `/home/jinhuit/Kingturf/kingturf-coord/wave2/mfg-db-artifacts/baseline` 初始检出 `4a93003`，有自己的 workspace 依赖链接。基线代码与 0077 库先建立合成物料、已发布与草稿 BOM/路线。相同 SQL 在总是回滚的事务中执行，前后各跑一次。

| 相同 SQL 的目标                | 0077       | 最终 0078/0079 |
| ------------------------------ | ---------- | -------------- |
| 向已发布工艺路线插入工序       | 成功       | P0001 拒绝     |
| 向已发布 BOM 插入行项          | 成功       | P0001 拒绝     |
| 向已发布 BOM 的行项插入替代料  | 成功       | P0001 拒绝     |
| 向草稿插入上述三类子行         | 全部成功   | 全部成功       |
| 修改已发布工序、删除已发布行项 | 原文 P0001 | 同原文 P0001   |

入库的新守卫测试在基线上运行，两个目标用例真红、三个对照用例绿；修复后 7/7 通过。另两个迁移专属用例没有在缺少 0078 文件的基线上执行。日志 `logs/a-baseline-red.log`、`logs/a-new-guard-test.log`。

### 3.2 发布与插入的并发窗口

主协调复核指出：最初的 0078 仅 SELECT 状态，外键的 KEY SHARE 与父行 UPDATE 的 NO KEY UPDATE 兼容，因此可能读到 DRAFT 后在另一事务发布期间插入。这个缺口真实存在。

原红版本 `3aa984a` 的确定性复现：发布事务更新父版本后停在显式屏障；另一连接 `FOR KEY SHARE NOWAIT` 成功、`FOR SHARE NOWAIT` 得到 `55P03`，证明所需锁关系；子行插入在发布未提交时完成且 `pg_blocking_pids` 为 `[]`。随后先提交发布、再提交子行，已发布路线由 1 个工序变为 2 个。保存了 26 条 `pg_locks` 观测，见 `evidence/a-race-original.json`。

修正提交 `6b1a418` 仅在新 INSERT 分支父版本查询末尾增加 `FOR SHARE`，替代料用 `FOR SHARE OF v`。三子表分别测两种顺序：

1. 发布先更新：INSERT 等待发布事务；提交后重新读取状态并拒绝，不落子行。
2. INSERT 先完成：持父版本共享锁至提交，发布等待；插入提交后发布成功，子行属于发布前内容。

六个用例在原实现上全部真红，修正后全部通过。测试使用事务屏障和 `pg_blocking_pids`，并断言 `pg_locks` 存在未授予的 `transactionid / ShareLock`；不靠固定 sleep 决定先后。加旧守卫回归共 13/13，见 `logs/a-concurrency-{original-red,corrected-green}.log`。

0078 是本波未发布的新迁移。修正后删除重建所有已应用原 0078 的自有测试库，再从零或 0077 升级；没有改注册表或 checksum。主协调已确认该处理边界。0001–0077 全部逐字节不动。

### 3.3 未被三触发器覆盖的引用

目录与迁移核对：制造版本内容子表只有 `manufacturing_bom_lines`、`manufacturing_bom_substitutes`、`manufacturing_routing_operations`，已全部覆盖；物料规格直接存在版本行 JSONB 中，没有另一张规格子表。`production_orders.routing_version_id` 是额外的工单引用，`production_order_operations.routing_operation_id` 是执行快照引用，属于引用/执行表，不纳入本批内容冻结触发器。其余引用物料版本的采购、库存、MRP、质量、成本表亦不扩修。

## 4. B：BOM 所有组件均须已发布

0079 仅重定义发布函数。BOM 分支由“至少一个组件已发布”换为“有组件，且不存在未发布组件”，产品与替代料条件、通用发布检查、物料和路线分支原文不变。空 BOM 仍拒绝，避免把空集的“全部已发布”误当作有效 BOM。

仓储 `publish('bom')` 与 `createBom(... publish:true)` 在同一事务里共用 `assertComponentsPublished`，按租户与草稿版本查组件，按 SKU/名称排序去重，抛 `DomainError('conflict', 中文提示)`。示例：`无法发布 BOM：以下组件尚未发布：BM-DRAFT-RAW（草稿组件）。请先发布这些组件版本，再发布 BOM`。独立发布的桥轨 PUT 和旧轨 POST、根创建即发布均经该函数，没有复制判断。其它 P0001 不新增全局或端点映射，仍为固定 500 信封。触发器是最终防线。

真库对照：0077 含一条已发布、一条草稿组件的 BOM 可发布；最终同一 UPDATE 被触发器拒绝。独立发布的桥轨分发在单独的基线用例中为 201，新代码同断言为 409，日志 `logs/b-baseline-bridge-isolated-red.log`。这是直通真实路由组/仓储的测试，未启动 HTTP listener；不要把多个基线用例共用数据所产生的后续 404 当成端点基线结果。

升级用例先只应用 0001–0078，用旧 UPDATE 发布混合 BOM，记录版本状态、发布时间、内容摘要和完整行项文本；再运行迁移到 0079，逐字段/逐文本比较完全相等，仍为 PUBLISHED 且行项仍是 PUBLISHED + DRAFT。新建同结构草稿则被拒绝。全发布组件照常可发布；先发布组件后再发布 BOM 可以成功；MFG-7 草稿续写→发布用例保持通过。最初新增真库 9/9；加入创建即发布真实 HTTP 用例后为 10/10，BOM 桥轨契约 16/16。

最终补强 `c27e960`：真实独立 Node HTTP listener 使用新代码、专用 schema、合成登录及 `bom:manage/read` 公司权限，以 `fetch` 发送 `POST /api/v1/manufacturing-boms`，载荷含已发布组件、草稿组件、已发布替代料及 `publish:true`。新增断言在 `6b1a418` 源码上真红，实际为 500、期望 409（`logs/b-create-publish-http-red.log`，退出 1）；共用前置校验后返回 409 和上述固定中文消息。请求前后 BOM 根、版本、行项、替代料、audit、outbox 六类计数完全相等。随后全部组件改为已发布，同一路由返回 201/PUBLISHED，六类计数恰增 1/1/2/1/1/1。正负两条都连真实 PostgreSQL，不借用浏览器栈中已加载的旧服务。单例绿回执 `logs/b-create-publish-http-green.log`，最终整文件 10/10 见 `logs/supplement-manufacturing.log`。

双视口界面证据见 §8。发布没有独立输入表单，失败消息通过既有 `kt-bom-submit-error` 显示在当前 BOM 详情抽屉内；新建表单继续使用自己的 `FormSection.error`。本批没有为此更改公共 UI 行为。

## 5. C：SALES-ORDER 别名归一

只在仓储创建需求时做精确等值归一：`sourceType === 'SALES-ORDER' ? 'SALES_ORDER' : sourceType`。先归一，再使用既有销售订单校验、参数化 INSERT、规范化内容指纹、响应和审计证据。路由解析与其它来源类型不变，无迁移。

真库对照：基线用别名创建后存储/返回 `SALES-ORDER`；修复后同断言得到 `SALES_ORDER`。别名不能再绕过“不存在/已取消/外租户订单”的既有校验；拒绝不落需求、audit 或 outbox。相同需求改用规范拼写不能再通过拼写差异绕过唯一键。存量手工保留的别名行不被改写，读侧两种拼写继续兼容。

原实现曾用普通对象映射别名，主协调复核发现 `toString`/`constructor`/`__proto__` 会命中 Object.prototype。独立修正 `9dfb6f1` 改精确比较。新真库用例在修正前得到 `Unsupported canonical value`，修正后上述值及 `hasOwnProperty`、`SALES_ORDER_X` 均原样存储，指纹与旧公式相同。这里只验证仓储原契约，HTTP 的稳定编码校验没有放宽。

前端来源类型是自由文本，默认 `SALES-FORECAST`，没有需要删除的别名选项。演示种子改发规范拼写，查找兼容旧拼写；Docker 固定快照诊断改为 `IN('SALES_ORDER','SALES-ORDER')`。`verify_p1_demo.mjs` 和 `tests/e2e` 没有旧拼写断言。重灌/verify/P1 实测见 §8。

## 6. D：小数与两种摘要

### 6.1 纯重构与旧输入守恒

`813d1f5` 抽出 domain 的 `canonicalizeWith`。严格 `canonicalize` 仍只接受安全整数，字符串、数组、对象键排序、null、布尔、负数和零的文本保持原样，其它域不会因此接受小数。

`3aa984a` 新增制造共享内容指纹。结构仍只有 domain 的那一份；制造数值策略接受安全整数与有限小数，使用 `String(value)` 形成最短往返文本。非有限值和不安全的整数继续拒绝。根创建与续版都调用 `manufacturingContentHash`，没有另复制一份规范化。

差分语料：30 条精选值加 200,000 条固定种子的随机安全整数 JSON 值（嵌套对象/数组、字符串、布尔、null、负数、零、最大最小安全整数、不同键序）。对每个值比较基线规范文本、sha256、新共享内容指纹，**200,030/200,030 逐个相等，零差异**。规范文本集合摘要为 `9fbd9e021bccb5a0cdff705c28c8e612040026cc1ca59a7aff950e2df87356a9`。

入库测试固化了基线生成的 28 条规范文本和 2 条大输入 SHA256，另有制造内容指纹差分及真实两入口写库核对。外部完整语料脚本与回执位于 `probe/mg2-d-{corpus,differential}.mjs`、`evidence/d-differential-{D1,D2}.json`。D1 的 21 个额外探针原样保持判定（其中 Date/Map/Set 原实现会当作对象接受，本次也未改变）；D2 的制造策略另允许其中的小数。

### 6.2 请求绑定摘要保持原样

内容指纹回答“内容是什么”，用于版本 `canonical_hash`。幂等请求摘要回答“是不是同一请求”，用于续版回执 `request_hash`，仍由 PG 对 jsonb 文本求 SHA256。两者设计上不同，代码注释明确禁止把这两件事误当重复实现去合并。

旧根创建入口没有幂等回执处理；真正使用回执的是续版入口。没有给旧根入口发明新的幂等语义。续版请求摘要 SQL 原文不变，没有兼容垫片。

实际跨代码重放使用独立 `w2_mfg_db_receipt_test`：基线树 `4a93003` 先迁到 0077、创建合成数据，旧根入口对同一份小数规格报 `Canonical numeric inputs must be safe integers`；旧续版入口成功建立回执。新代码在同一库同键重放，首次响应、回执行逐键相等，版本/回执/audit/outbox 仍为 **2/1/2/2**，无新增。新根入口接受同一小数规格。日志 `evidence/d2-receipt-{before,after}.json`。

### 6.3 续版内容指纹确实改变

续版从 PG jsonb 文本内容摘要改为共享 TS 内容摘要，因此新建续版的 `canonical_hash` 值会改变，这是本批内容指纹收敛的直接结果。实际样本旧值 `f81661360f6cd04e2bb8d18c46777e993908c012df133ca03048861a783d6db0`，新值 `b50203da8ab7581de431842d45e2e9e81be264fc0a386ff7b79f460ae0f02c55`。历史版本与回执中的旧值不改写。

制造 `canonical_hash` 在全仓只有写入、读投影和证据载荷，未发现用它仲裁幂等或比较是否同一请求的逻辑；真正重放比较的是 `commercial_command_results.request_hash`。冻结轨迹的仓储是桩，没有断言真实制造内容 SHA；相关冻结夹具与检查源码都未改，311/311 与 28/28 仍通过。

## 7. 迁移、钉定与空库/升级验证

当前分支恰有 79 条迁移，新文件仅 0078/0079，没有占用 0080 及以后的编号。0001–0077 与基线逐文件逐字节比对，77/77 相同。0078 修订后重建自有库，不改注册表，不容忍 drifted。

| 起点                                               | 最终状态                           | 日志                                                   |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| 新建空库 `w2_mfg_db_test`                          | 79 applied / 0 pending / 0 drifted | `logs/final-empty-{migrate,status}.log`                |
| 基线树把 `w2_mfg_db_base_test` 从空库迁到 0077     | 77 applied / 0 pending / 0 drifted | `logs/final-baseline-0077-{migrate,status}.log`        |
| 上述 0077 库有合成已发布混合 BOM，再用最终分支升级 | 79 applied / 0 pending / 0 drifted | `logs/final-upgrade-0077-to-0079-{migrate,status}.log` |

最终升级前后，九张制造表的行数及按 ID 排序的整行文本 MD5 全部相同；混合 BOM 的状态与完整行项 JSON 完全相同。SQL 对照恰好四条结果改变（三类已发布子行插入、含草稿组件的 BOM 发布），其余对照保持。见 `evidence/final-sql-{before-0077,after-0079,compare}.json`。

钉定修改共八个文件（77→78→79），每个位置如下，供集成时主协调统一更新最终数量：

| 文件与行号                                                                        | 钉定内容                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `scripts/application_release.py:115`、`:116`                                      | 批次注释与候选迁移 manifest 长度 79                  |
| `scripts/prepare_release_bundle.sh:30`                                            | manifest 长度与报错文字 79                           |
| `packages/database/test/migrations.test.ts:222`                                   | 最新文件为 0079；新增的 0078/0079 静态用例另见同文件 |
| `packages/database/test/read-only-status.integration.test.ts:62`                  | 当前状态长度 79                                      |
| `packages/database/test/startup-gate.integration.test.ts:37`、`:38`、`:67`、`:68` | 候选数/错误文字 79，待应用清单追加 0078/0079         |
| `tests/operations/apply_migrations_rehearsal_test.py:31`、`:104`、`:156`          | APPROVED 后缀、expected-after、注册表计数 79         |
| `tests/operations/production_preflight_test.py:262`、`:263`                       | manifest 数量 79、最新文件 0079                      |
| `tests/operations/release_migration_drill_test.py:27`、`:183`                     | 实际文件数与最终注册表数量 79                        |

发布时需按主协调的最终迁移集合批准 0078/0079 后缀。本批没有执行生产迁移或迁移回退；已发布旧函数原文保存在历史迁移与测试里。

## 8. 验证命令、回执与浏览器

所有完整包测试、构建、Python 演练、制造定向整组及 Docker up/walk 都经 `/home/jinhuit/Kingturf/kingturf-coord/bin/heavy`。API 配置单 worker，Web 全包限 `--maxWorkers=4`。没有执行完整 `pnpm ci:local`。

### 8.1 完整代码验证快照 `6b1a418`

下表均属于最终创建即发布补强之前的代码快照。原 API 全量任务没有中断或新开；恢复后先读取原落盘回执，204 文件、18,311 例通过，837.91 秒，`API_EXIT=0`。

| 命令（工作树根执行，带专用 DATABASE_URL）                                                   | 退出码与数字                                     | 日志（相对本批 artifacts）                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `pnpm format:check`                                                                         | 0                                                | `logs/final-format-check.log`                 |
| `pnpm doc:lint`                                                                             | 0（文档提交前再验证）                            | `logs/final-doc-lint.log`                     |
| `pnpm structure:check`                                                                      | 0                                                | `logs/final-structure-check.log`              |
| `pnpm service:check`                                                                        | 0                                                | `logs/final-service-check.log`                |
| `pnpm verify:frontend-capabilities`                                                         | 0                                                | `logs/final-verify-frontend-capabilities.log` |
| `pnpm lint`、`pnpm typecheck`                                                               | 各 0                                             | `logs/final-{lint,typecheck}.log`             |
| `pnpm --filter @kingturf/api test`                                                          | 0，204 文件 18311/18311，837.91 秒               | `logs/final-api.log`                          |
| `pnpm --filter @kingturf/database test`                                                     | 0，4 文件 79/79                                  | `logs/final-database.log`                     |
| `pnpm --filter @kingturf/domain test`                                                       | 0，5 文件 26/26                                  | `logs/final-domain.log`                       |
| `pnpm --filter @kingturf/web exec vitest run --maxWorkers=4`                                | 0，65 文件 1024/1024                             | `logs/final-web.log`                          |
| `pnpm --filter @kingturf/web build`                                                         | 0，登录预算 JS 11752 B / CSS 0 B（沿用既有计量） | `logs/final-web-build.log`                    |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/operations -p '*_test.py'` | 0，145/145，含真实迁移演练                       | `logs/final-operations.log`                   |
| `vitest run test/app-batch4-preservation.test.ts test/dispatch-source-preservation.test.ts` | 0，311/311 + 28/28；无 re-pin                    | `logs/final-frozen.log`                       |

早期 A+B+C 干净快照 `67a04f6` 另跑会写制造表的 21 个真库文件，199/199。`6b1a418` 完整 API 是更广的回归，不用早期数字代替该回执。

### 8.2 最终补强快照 `c27e960`

主协调明确要求补强后只跑相关制造/桥轨、311/28、lint/tsc，不再一轮完整 API。以下四份日志首行均钉定 `c27e96033918f619aa1c284432bff7a594699d3f`，补强后源码没有再改。

| 命令                                                                                        | 退出码与数字                  | 日志                                |
| ------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `pnpm --filter @kingturf/api exec vitest run` 加下列 13 文件                                | 0，13 文件 692/692，52.52 秒  | `logs/supplement-manufacturing.log` |
| `vitest run test/app-batch4-preservation.test.ts test/dispatch-source-preservation.test.ts` | 0，311/311 + 28/28；无 re-pin | `logs/supplement-frozen.log`        |
| `pnpm lint`                                                                                 | 0                             | `logs/supplement-lint.log`          |
| `pnpm typecheck`                                                                            | 0                             | `logs/supplement-typecheck.log`     |

13 文件的真实命令参数为 `test/bom-publish-components-postgres.integration.test.ts`、`test/manufacturing-postgres.integration.test.ts`、`test/manufacturing-versions-postgres.integration.test.ts`、`test/manufacturing-child-concurrency-postgres.integration.test.ts`、`test/manufacturing-published-child-postgres.integration.test.ts`、`test/manufacturing-specification-postgres.integration.test.ts`、`test/manufacturing-fingerprint.test.ts`、`test/manufacturing-route-contract.test.ts`、`test/fastify/manufacturing-items.test.ts`、`test/fastify/manufacturing-boms.test.ts`、`test/fastify/manufacturing-routings.test.ts`、`test/production-postgres.integration.test.ts`、`test/mrp-source-postgres.integration.test.ts`。制造路由契约 571 例、三组桥轨 45 例、真实制造/MRP/生产与指纹 76 例，合计 692。

### 8.3 Docker 浏览器（`6b1a418`）

专用容器 `e2e-harness-mfgdb`，产物 `artifacts/e2e`，管理连接指向本批 5446 实例。`up --skip-build` 复用 §8.1 验证过的 Web 构建。前后端在同一容器；没有将之后的 `c27e960` 补强算入本轮浏览器结果。补强的真实 HTTP 验证另见 §4/§8.2。

| 步骤/命令                                                                                                                 | 结果                                                  | 回执                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `node scripts/e2e-local/e2e-local.mjs up --skip-build`                                                                    | 0，独立库与合成账号建成，首次 seed 成功               | `logs/browser-up.log`                                                                        |
| 原 `scripts/verify_p1_demo.mjs`，重灌前/后各一次                                                                          | **两次退出 1**；第 105 行实际建议 5、预期 6，断言未改 | `logs/browser-verify-{before,after}.log`                                                     |
| `node scripts/e2e-local/e2e-local.mjs seed`                                                                               | 0；前后需求来源与数量逐字节相同                       | `logs/browser-seed.log`、`evidence/browser-demands-{before,after}-seed.json`                 |
| `node scripts/e2e-local/e2e-local.mjs e2e -- tests/e2e/p1-demo.spec.ts`                                                   | 0，11/11，41.3 秒                                     | `logs/browser-p1.log`                                                                        |
| `walk --viewport desktop/mobile --routes manufacturing/items,manufacturing/boms,manufacturing/routings,material-planning` | 两视口各 4/4；页面错误、失败请求、页面横溢出均 0      | `e2e/walk/{desktop,mobile}/report.json`                                                      |
| `probe/mg2-browser.mjs` 初轮与等待动画后修订轮                                                                            | 两视口 BOM 发布 409、小数物料创建 201；无页面异常     | `logs/browser-targeted.log`、`logs/browser-targeted-settled.log`、`e2e/targeted-report.json` |
| `node scripts/e2e-local/e2e-local.mjs down`                                                                               | 0；容器、专用库及私有 creds/state 均移除              | `logs/browser-down.log`                                                                      |

所有重活经 heavy。up 最初排在旧固定 slot1 队列，尚未执行；主协调修复闸后只停止自己的排队任务并原样重排，随后 up 退出 0。不是一次执行失败后重复启动，原 API 全量也没有中断。

verify 的 5≠6 已由项目所有者决定登记 **TD-TEST-038（MG2-N6）**，不改脚本、不将其宣称为通过。P1 的 11/11 与 verify 的两次失败分别保留；重灌未新增需求的比较退出 0。

定向探针在两个真实视口（1440×900、390×844@2x）经 GUI 打开混合 BOM 并点击发布/确认，真实 PUT 返回 409，中文草稿组件编码/名称显示在当前抽屉的 `kt-bom-submit-error`，BOM 仍为 DRAFT；两视口文档宽度分别等于 1440/390。随后 GUI 创建物料，在草高参数填写 `50.5` 并保存草稿，真实 POST 返回 201，请求与保存后的 `specification.pileHeightMm` 均为数值 50.5。

截图逐张通过 Read 目检：走查桌面 8 张、移动 8 张（各四页及四个详情抽屉），定向最终 4 张。走查中表格自身横滚与页面横溢出分开判定，详情内容均可读。初轮两张物料定向图拍在入场动画中途，不作为最终图；原图留在 `evidence/probe-early-animation-shots/`。修订探针等待抽屉可见和动画结束后改按固定视口拍摄，回执 `TARGETED_SETTLED_EXIT=0`；四张覆盖后的最终图也已逐张重读，抽屉完整入场，50.5 与错误文字清楚可见，无需再次重跑。

最终定向截图为 `e2e/targeted-shots/desktop-bom-unpublished-components.png`、`mobile-bom-unpublished-components.png`、`desktop-item-decimal-created.png`、`mobile-item-decimal-created.png`。走查图为 `e2e/walk/{desktop,mobile}/shots/` 下的 `manufacturing__{items,boms,routings}.png`、各自的 `--{item,bom,routing}-drawer.png` 以及 `material-planning.png`、`material-planning--mrp-drawer.png`。探针源文件放在 `artifacts/probe`，不入库。

## 9. 偏离、失败与未验证项

- 原任务要求改四条台账状态格，但基线没有对应主表行；经主协调确认仅加顶部小节，主表由集成统一处理。
- D 的“共享”按主协调选择 C 实施：只共享内容指纹。旧根入口本来没有幂等回执，未为它新增幂等机制；真实旧回执兼容用续版入口证明。
- A 的已有测试夹具需要配合修正。最初 `7336203` 的 database 78/78，21 类写入方中的 19 文件通过、`production-postgres` 两个 beforeAll 被新守卫拒绝，10 条用例随钩子失败跳过。这不是负载超时，原日志 `logs/commitA-mfg-writers.log` 保留。夹具改成草稿→子行→发布后 10/10；A 修订为 `8f8dd5c`，B/C 随 rebase 改 SHA。TD-COST-003 的双行 BOM 改为新版本发布，成本选择最近发布版本，原业务断言一条未动。
- 初版 0078 的并发窗口、新别名对象映射的原型命中均由主协调复核指出，原红与修正提交分开保留，没有把原红隐藏为环境问题。
- 新测试开发时曾遇到 bigint count 返回字符串、重复行号/替代料唯一约束、动态 schema 名、枚举数组解析与 HTTP 时间规范文本的期望错误；均修测试后重跑，未放宽产品约束。辅助脚本的引号/语法错误亦不算验证成功。
- 基线树必须解析自己的 workspace 包，所以仅在新开的基线树做了一次离线安装（复用已装 store、912 ms）。本工作树没有重复安装依赖，也没有新增运行时依赖。
- 没有生产存量核查或存量数据改写；本批“存量混合 BOM”是专用库中的合成升级证据。所有者已说明处于开发阶段、生产无实际业务单据，主协调已取消生产存量取证 SQL 任务，本批没有待执行的生产核查。
- 没有运行完整 ci:local、覆盖率采集、生产发布、生产冒烟、Firefox/WebKit 或更多视口；完整集成门禁归主协调。本批 build 预算沿用现有工具，未修已登记的 CSS 漏计问题。
- 最终 `c27e960` 补强之后，按主协调要求只跑 §8.2 定向，不再跑完整 API、其它包全量或 P1/walk。§8.1 与 §8.3 保留原 `6b1a418` 快照归属；新 HTTP listener 验证的是补强源码。
- verify 两次实际 5、预期 6，均退出 1，登记 TD-TEST-038（MG2-N6）。没有改断言或把 P1 的通过当作 verify 通过。初轮物料截图的动画问题及修订后目检均保留。
- 只验证本批三类 INSERT 的并发正确性，没有扩修旧 UPDATE/DELETE 守卫。模型切换后未遇 1308；临时服务器过载恢复后沿原树、原任务续作，没有新开全量或空重试。

## 10. 新发现（MG2-N）与清理

| 编号   | 事实、复现与影响面                                                                                                                                                                             | 处理                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| MG2-N1 | `listDemandPage` 的 `sourceType` 筛选仍是 `d.source_type=$n` 精确匹配。无参数读取及解释树兼容两种历史拼写，但带某个拼写的过滤不会自动合并另一种拼写的存量行。代码已核对，未追加行为测试。      | 不改，交主协调分配后继事项。                                                       |
| MG2-N2 | `production-postgres` 夹具在已发布 BOM/路线上插子行，KT-L15 beforeAll 被 0078 拒绝；TD-COST-003 也直接追加行项。影响仅测试建数，应用写入口未见同类路径。                                       | 作为本批必要夹具适配修正，业务断言保持。                                           |
| MG2-N3 | 旧 UPDATE 分支只检查 OLD 父版本。把草稿子行的父引用直接 UPDATE 到已发布版本可能绕过冻结。目录未见其它专门阻止改父引用的触发器/约束，外键只保证租户与存在性。现有应用没有这种子行 UPDATE 入口。 | **代码推断待核实**；按主协调指示不做新复现实验、不加测试、不改旧分支。             |
| MG2-N4 | 本波初版 INSERT 分支未锁父版本，存在发布与插入并发窗口，双连接明确复现。                                                                                                                       | `6b1a418` 已修，六条确定性锁用例全绿。                                             |
| MG2-N5 | 本波别名对象查表会命中继承属性，不符合仅归一一个别名。真库原实现出现 Unsupported canonical value。                                                                                             | `9dfb6f1` 已修，非别名原值/指纹测试通过。                                          |
| MG2-N6 | 原 verify 脚本在重灌前后均于第 105 行报告建议实际 5、预期 6；seed 与 P1 另各通过，未改变这个失败。                                                                                             | 主协调决定登记 **TD-TEST-038**；原脚本保持，主协调统一更新主表，不阻本批余下验收。 |

本批 artifacts 根目录为 `/home/jinhuit/Kingturf/kingturf-coord/wave2/mfg-db-artifacts`。无密钥的日志、JSON 回执、SQL/浏览器探针与截图保留供主协调复核；不含连接串。

清理已完成：`e2e-harness-mfgdb` 已 down，`kingturf_test_e2e_dc39273b` 已删除，私有 `creds.json`/`state.json` 已由配方移除。清理后按文件名扫描，未留 creds/state/storageState、trace zip 或 WebM；没有把它们读出或纳入提交。`logs/browser-down.log` 退出 0，`evidence/cleanup-final.json` 记录容器与基线树均不存在、私有/trace 文件列表为空。

只移除了本批自建且状态干净的基线树 `artifacts/baseline`（`logs/baseline-cleanup.log` 退出 0）。额外自建库 `w2_mfg_db_empty_test`、`w2_mfg_db_base_test`、`w2_mfg_db_receipt_test` 均核对归属与零会话后删除（`logs/temporary-database-cleanup.log` 退出 0）；主库 `w2_mfg_db_test` 保留。专用 PostgreSQL 容器 `w2-mfg-db-pg` 仍运行，分支与工作树按任务书保留；未停删其它容器、工作树或库。最终文档门禁与差异检查的回执见 `logs/docs-final-{format,doc-lint,diff-check}.log`。
