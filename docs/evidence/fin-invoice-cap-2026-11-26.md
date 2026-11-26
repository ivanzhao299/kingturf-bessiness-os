# FN2：超额开票准入（TD-FIN-003）· 2026-11-26

## 1. 范围、基线与裁定

实施分支 `fix/w2-fin-invoice-cap`，工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003`，基线 `main@4a93003aac22bdf52e82d7ae2b74098897157bc8`。本批只改变既有开票写路径的累计金额准入，延续原权限、幂等、台账、审计和 outbox；不新增写端点、运行时依赖或数据库迁移，不改公共 UI、冻结旧分派器或信用旧 SQL。

项目所有者在本批任务书中的原裁定（2026-11-26）：

> 累计开票不得超过订单金额——超过则拒绝；不设尾差容差（精确比较）；已超额的历史记录不自动改账，先出清单再定处理方式。

后续裁定与主协调指引一并落盘：

- 项目所有者（2026-11-26）：**贷项通知暂不冲减累计开票，现行口径不扣减**。这一点已裁定，不再作为待裁项。
- 项目所有者后续说明：当前处于开发阶段，生产没有实际业务单据，**历史超额清单不需要出**。本批没有执行历史账务查询、修订或清账。
- 同单开票沿用已有「租户:客户:credit-ledger」事务级 advisory 锁；校验放在取锁之后。**不新增订单行 `FOR UPDATE`**。先用真库坐实默认及实际事务隔离级别为 `READ COMMITTED`，再显式观察两个请求等待同一把锁。
- 现行权威 SQL 没有可调用的累计开票函数。新增命名仓储方法承载新校验的求和，注释关联迁移 0026、0027 和旧 `evaluateCredit`；旧信用 SQL 不改，以同一组真库数据对拍。
- 台账主表在该基线没有 TD-FIN-003 行，只有顶部历史列表项。按主协调指示，本批**不新增主表行、不改原历史列表项**，仅在台账顶部新增本批状态小节；主表登记由主协调在集成分支处理。
- 本批不执行完整 `pnpm ci:local`，完整门禁由主协调在集成分支串行执行。补强后按主协调指示复验定向用例与 lint/typecheck，沿用此前 API 全量回执，不重复全量测试。

原发现记录为 [FIN 财务验收 §4、§5 fin1-6](fin1-2026-11-25.md)。不可变与金额契约依据 [ADR-0007](../adr/0007-immutable-business-object-schemas.md)、[ADR-0009](../adr/0009-commercial-revision-graph.md)、[ADR-0010](../adr/0010-immutable-quote-to-cash-ledger.md)。

## 2. 现行口径及源码依据

下列行号对应本批补强后的源码；迁移、路由与前端运行源码保持基线原样。

| 项目               | 现行口径及本批处理                                                                                                                                                                                                        | 依据（file:line）                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 开票端点           | `POST /api/v1/ar-open-items`。桥轨及 legacy 均分派同一仓储 `postAr`；只在仓储内加准入                                                                                                                                     | `apps/api/src/routes/fastify/ar-open-items.ts:281`、`:309`；`apps/api/src/routes/qtc-ar-post.ts:40`、`:77`；`apps/api/src/qtc-repositories.ts:666`                                                                     |
| 校验事务与锁       | `command` 先取命令幂等锁、重新授权、检查重放，再执行 work。work 取得客户台账 advisory 锁后校验，再写任何台账                                                                                                              | `apps/api/src/qtc-repositories.ts:33`、`:44`、`:48`、`:55`、`:690`、`:693`；`apps/api/src/command-results.ts:12`                                                                                                       |
| 事务隔离级别       | 数据库包装只执行普通 `BEGIN`，没有显式更改隔离级别；本批真库断言默认与实际事务均为 `read committed`。每条语句取新快照，锁后查询能看到先行请求提交的发票                                                                   | `packages/database/src/index.ts:40`、`:44`；`apps/api/test/ar-invoice-cap-concurrency-postgres.integration.test.ts` 的 `beforeAll` 与并发测试                                                                          |
| 累计开票           | 同租户、同销售订单的 `ar_documents.amount`，只对 `document_type='INVOICE'` 求和；使用单据原始金额，**不使用未核销余额**。新方法用无限精度 `numeric` 聚合文本，避免历史异常合计超列宽时先溢出                              | 迁移 `0026_quote_to_cash_immutable_ledger.sql:74`、`0027_quote_to_cash_governance_repairs.sql:100`；`apps/api/src/qtc-repositories.ts:254`；新增 `apps/api/src/qtc-read-repositories.ts:193`、`:203`、`:210`           |
| 贷项、红字         | 当前枚举只有 `INVOICE`、`CREDIT_NOTE`，金额必须大于零；没有单独红字类型或负金额发票。`CREDIT_NOTE` 不冲减累计开票；它会在信用敞口的应收部分按负号计入，这是另一口径，保持原样                                             | 迁移 `0026_quote_to_cash_immutable_ledger.sql:5`、`:38`、`:73`；本批所有者后续裁定                                                                                                                                     |
| 作废、冲销、修订   | `ar_documents` 没有作废/冲销状态列，UPDATE/DELETE 被不可变触发器拒绝。当前没有可从累计额扣除的作废记录。更正应追加证据；本批不新增更正语义或改历史                                                                        | 迁移 `0026_quote_to_cash_immutable_ledger.sql:38`、`:83`；迁移 `0021_commercial_sales_to_cash.sql:53`；ADR-0010:9、:15                                                                                                 |
| 订单金额           | 使用 `sales_orders.total`，精度 `numeric(24,6)`，必须为正。数据库强制它等于钉定签发报价 `quote_revisions.total`，币种也必须相同；报价 total 为 subtotal − discount                                                        | 迁移 `0026_quote_to_cash_immutable_ledger.sql:24`、`:57`；迁移 `0021_commercial_sales_to_cash.sql:47`                                                                                                                  |
| 订单多行、部分开票 | 上限按**整个订单**，不是逐行配额。订单行 total = trunc(quantity × unit_price, 6)，延迟约束要求行合计精确等于头 total。应收单据只挂订单、不挂订单行，分次发票原额直接累计                                                  | 迁移 `0026_quote_to_cash_immutable_ledger.sql:25`、`:27`、`:35`、`:38`；迁移 `0027_quote_to_cash_governance_repairs.sql:112`                                                                                           |
| 订单变更           | 订单及行同样不可改删；正常写入口没有改量后调小 total 的命令。本批不发明这种变更或历史重算规则                                                                                                                             | 迁移 `0026_quote_to_cash_immutable_ledger.sql:83`；`apps/api/src/qtc-repositories.ts:582`                                                                                                                              |
| 币种               | 挂订单的单据必须与订单同客户、同币种、同租户；不做 FX 换算。上限仅在这组身份一致时判断，不一致继续交给原数据库守卫拒绝                                                                                                    | 迁移 `0027_quote_to_cash_governance_repairs.sql:63`、`:86`；`apps/api/src/qtc-repositories.ts:773`                                                                                                                     |
| 含税语义           | 当前订单/应收没有 tax_amount、含税标记或税额换算。可确证的是“等于签发报价 total”；无法从这些字段认定它是含税价或不含税价。本批只沿用字段金额，不赋予新税务含义（FN2-1）                                                   | 迁移 `0021_commercial_sales_to_cash.sql:47`；迁移 `0026_quote_to_cash_immutable_ledger.sql:24`、`:38`                                                                                                                  |
| 前端数字与提示     | 表单选择项只显示订单号、币种、订单总额，**没有已开票/剩余可开票字段**。客户及币种取所选订单，documentType 固定 INVOICE，金额按字符串提交。拒绝提示沿既有 HTTP → failureMessage → submitError → FormSection.error 通道显示 | `apps/web/src/commercial/console/ar-host.ts:24`、`:29`；`ar-payload.ts:19`；`ar-actions.ts:154`；`ar-create.tsx:25`；`fin-kit.tsx:293`；`apps/web/src/http-core.ts:55`；`packages/ui/src/form-section.tsx:125`、`:287` |

数据库既有守卫继续处理客户/币种关联、正金额、外键和不可变约束；**它们不强制本次新增的累计开票上限**。直接 SQL 写入仍能构造超额状态，本批仅在两条应用写轨共同调用的事务中拒绝新超额。没有新增数据库级 cap 守卫或迁移。

## 3. 落地方式、改动理由与提交

| 提交      | 英文主题                                                               | 改动及理由                                                                                                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `8d83fb9` | `fix(finance): reject excess invoices TD-FIN-003 [未测试]`             | `qtc-repositories.ts` 在客户台账锁后、第一笔 INSERT 前调用 `assertInvoiceWithinOrder`；`qtc-read-repositories.ts` 的 `invoicedOrderAmount` 只集中新增求和，不改旧信用 SQL。比较由 PostgreSQL numeric 执行，`>` 拒绝、`=` 放行，中文提示含订单金额、已开票、本次、合计。附核心真库 7 例和受影响 AR 测试夹具修正 |
| `9c7670f` | `test(finance): prove HTTP invoice serialization TD-FIN-003 [未测试]`  | 新增真实网络 HTTP 测试：真实本地 API、真实认证、真实 PostgreSQL；显式占 advisory 锁，并通过 `pg_locks JOIN pg_stat_activity` 观察两个等待者后释放。另钉定求和、触发器及旧信用计算口径                                                                                                                          |
| `c156cd3` | `test(web): retain invoice cap rejection feedback TD-FIN-003 [未测试]` | 只新增 AR 组件用例，验证 RequestError(409) 的中文原因逐字留在表单，抽屉和输入保留，不误报成功、不刷新。前端运行源码及公共 UI 无需改动                                                                                                                                                                          |
| `0b5767f` | `fix(finance): enforce invoice query invariants TD-FIN-003 [未测试]`   | 主协调复核补强：聚合/比较缺行或坏类型为内部错误，回滚；聚合取消 numeric(24,6) 列宽强转。新增 4 个故障注入和 1 个真实 PostgreSQL 超列宽历史合计用例，核心用例累计 12 个                                                                                                                                         |

最后单独的 docs 提交新增本文、在 `docs/index.md` 收录、在技术债台账顶部追加状态小节；其 SHA 见本分支最终 `git log`。上述 `[未测试]` 按任务书只表示**没有运行完整 ci:local**，不表示没有进行下述定向/全量包测试。

生产代码仅修改两份已有仓储文件。`qtc-repositories.ts` 是基线已存在的 G1 存量白名单文件，本批没有扩充白名单或进行无关拆分；不宣称该文件小于 800 行。结构门禁检查新增函数/嵌套，强制违规为 0。

### 既有断言改前、改后

`apps/api/test/ar-read-postgres.integration.test.ts` 的桥轨 POST 用例原先对 `AUTH-ORDER` 再开 `12.34`，期望 201；夹具已给这个订单开满 `950000`。新准入使原用例精确红为 **expected 201, received 409**（其余 19 例通过）。本例保留“201 并可读回、金额三项、关联订单号、错客户 409、重复单号 500”的全部判据，改用同一商业图复制出的未开票订单 `FIN-SPARE-ORDER`，订单号断言相应改成该值。`released-order-copy.ts` 将两份测试共用的夹具复制集中，不绕过数据库订单图、行合计及信用容量触发器。原已全额订单的拒绝由新核心测试独立钉定，不删除或弱化该负例。

## 4. 真库前后对照

专用 PostgreSQL：`w2-fin-003-pg`，回环端口 `5448`，实际预置库名 `w2_fin_003_test`。基线 detached 工作树为 `/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003-artifacts/baseline`，HEAD 固定 `4a93003`；基线库 `w2_fin_003_baseline_test`。两库迁移均为 77 条 applied，无漂移。依赖复用本工作树已安装目录的符号链接，不重新安装；基线测试完成后仅移除自己建立的基线树、符号链接和基线库。

| 场景                                         | 基线结果                                                                      | 修复后同一判据                                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 已开满 950000，再开 12.34                    | 仓储 Promise 成功，应用分派 201，新账务落库                                   | DomainError(conflict)；两条 HTTP 分派均 409；单据、开放项、审计、outbox、命令结果零新增                                                                                                                 |
| 紧接着同客同币种信用评估                     | `credit_exposure_snapshots_uninvoiced_order_amount_check`，SQLSTATE **23514** | 评估正常完成 PENDING_APPROVAL，无约束异常                                                                                                                                                               |
| 实际网络 HTTP：已满额再开 0.000001，随后评估 | 实际响应 **201 → 500**                                                        | 实际响应 **409 → 201**；发票、开放项、审计、事件、命令结果在拒绝后均无增量                                                                                                                              |
| 两个并发请求：先开 800000，两个各开 100000   | 观察到两个 advisory 等待者，释放后 **201、201**，合计超额                     | 同样观察两个等待者后释放，**恰一个 201、一个 409**；最终两张发票（含前置一张），合计 900000                                                                                                             |
| 微单位与等号边界                             | 在 800000 后开 150000.000001 仍成功                                           | 150000.000001 被拒；最后开 150000 成功，累计恰好 950000；再加 0.000001 被拒                                                                                                                             |
| 幂等                                         | 保留旧结果模型                                                                | 成功请求同键重放不增行；被拒请求不占键，同键随后可提交另一合法请求                                                                                                                                      |
| 贷项通知及核销                               | 贷项不扣累计、核销不减原额                                                    | 同式保持；已满额且有过核销的订单，加贷项后累计仍为 950000                                                                                                                                               |
| 口径钉定                                     | 依据迁移及信用旧 SQL                                                          | 满额/部分/未开票三个订单，累计求和反推未开票 **1100000.000000**，与直接 INSERT 触发器派生值和 evaluateCredit 快照一致；evaluateCredit 自算返回敞口也与触发器结果相等，避免被快照触发器覆盖掩盖 SQL 漂移 |
| 异常旧数据总额超列宽                         | 无本次 cap                                                                    | 两张各 999999999999999999.999999 的合成历史单据，累计 **1999999999999999999.999998**，不发生 numeric(24,6) 聚合溢出；新开 0.000001 为中文 409，历史单据不改                                             |
| 查询结果异常                                 | 本批初稿会把缺行当 0 或放行                                                   | 缺聚合行、聚合 NaN、缺比较行、比较布尔为文本均内部错误并回滚；只对指定 SELECT 故障注入，其余走真实 PostgreSQL                                                                                           |

口径用例在同一数据组同时保留发票原额与核销余额的差异、贷项通知、满额/部分/未开票状态。因此若新增求和改扣贷项、改按余额，或旧信用计算改变自算敞口，断言会失败。迁移 0027 的守卫本体未修改；本批没有逐一变异三个历史 SQL 定义。

## 5. 验证命令、快照、退出码与失败历史

所有数据库命令通过环境变量传入连接串；本文、仓库与日志命令不写入口令或完整连接串。重活使用 `/home/jinhuit/Kingturf/kingturf-coord/bin/heavy`，API 配置始终单 worker，Web 全量明确 `--maxWorkers=4`。产物根为 `/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003-artifacts/`，下表日志均在其 `logs/`。

| 检查                   | 命令/范围                                                                                                                | 结果                                                                                                          | 对应快照与日志                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 专用库迁移             | `pnpm db:migrate`、`pnpm db:status`                                                                                      | EXIT 0；77 applied                                                                                            | 改码前主库、基线库；初始工具回执                                                                                                                                                                  |
| 基线核心红             | `pnpm --filter @kingturf/api exec vitest run test/ar-invoice-cap-postgres.integration.test.ts`                           | **EXIT 1：5 败、2 过**；旧成功、201、23514 均实证                                                             | `4a93003` + 新核心 7 用例；`11-baseline-cap-red-final.log`                                                                                                                                        |
| 基线实际 HTTP / 并发红 | 并发文件 `-t '真实 HTTP\|并发'`                                                                                          | **EXIT 1：2 败、1 未选中**；201→500、201/201                                                                  | `4a93003`；`46-baseline-http-concurrency-red.log`；未选中的是基线尚无新增命名方法的口径钉定用例                                                                                                   |
| 基线 311 / 28          | `vitest run test/app-batch4-preservation.test.ts test/dispatch-source-preservation.test.ts`                              | EXIT 0；**311/311、28/28**                                                                                    | 基线 HEAD 无 tracked diff；`57-baseline-preservation.log`                                                                                                                                         |
| 核心转绿               | 核心 7 + AR 20                                                                                                           | EXIT 0；27/27                                                                                                 | `8d83fb9` 核心实现；`23-fixed-cap-and-ar-read.log`                                                                                                                                                |
| API 全量               | `heavy pnpm --filter @kingturf/api test`                                                                                 | EXIT 0；**200 文件、18287/18287**，739.39 秒                                                                  | 对应 `8d83fb9` 核心改动的稳定生产源码；运行时 HEAD 仍为 4a93003（未提交源码），详见 `30-step3-api-full.meta`、`30-step3-api-full.log`。不覆盖后来新增的 HTTP 并发文件与补强，不冒称最终 HEAD 全量 |
| 冻结及相关旧轨定向     | 原 AR route、Fastify、f3、dispatch、QTC、root-capture                                                                    | EXIT 0；966/966，内含 311/28                                                                                  | `24-fixed-targeted.log`                                                                                                                                                                           |
| Web 组件               | `vitest run src/commercial/console/ar-console.test.tsx`                                                                  | EXIT 0；5/5                                                                                                   | `c156cd3`；修正导入路径后通过                                                                                                                                                                     |
| Web 全量               | `heavy pnpm --filter @kingturf/web exec vitest run --maxWorkers=4`                                                       | EXIT 0；65 文件、**1025/1025**                                                                                | `c156cd3` 同一前端测试内容；`43-web-full.log`                                                                                                                                                     |
| 全仓静态门禁           | `pnpm format:check`、`doc:lint`、`structure:check`、`service:check`、`verify:frontend-capabilities`、`lint`、`typecheck` | 全部 EXIT 0；structure 强制 0 / 旧豁免 30，service 244 files / 32 ports / 241 route templates / 0 violations  | 补强前；`44-*.log`。lint 保留 `server-fastify.ts` 两条已有 unused-disable 警告，未顺手修                                                                                                          |
| Web build              | `heavy pnpm --filter @kingturf/web build`                                                                                | EXIT 0；登录预算脚本 JS 11753 B gzip、CSS 0 B；console CSS guard 通过                                         | `45-web-build.log`；CSS 0 是已登记 TD-GATE-005 的旧漏计，不是实际 CSS 字节为零。本批前端运行源码/CSS 未改                                                                                         |
| 最终补强定向           | core cap、HTTP 并发、AR read、QTC、Fastify AR、legacy AR、f3、dispatch 8 文件                                            | EXIT 0；**666/666**，其中核心 12、HTTP/并发/口径 3、AR 20、QTC 2、Fastify 82、legacy 208、f3 311、dispatch 28 | `0b5767f`；`49-hardening-targeted-green.log`                                                                                                                                                      |
| 最终补强静态检查       | 改动 API 文件 eslint、API typecheck                                                                                      | EXIT 0                                                                                                        | `53-final-api-eslint.log`、`54-final-api-typecheck.log`；最终提交前通过                                                                                                                           |
| 浏览器专项             | 见 §6，重活均经 heavy                                                                                                    | EXIT 0；walk 各 3/3；两档真实表单均 409 → 201                                                                 | `0b5767f`；`60-walk-*.log`、`64-browser-invoice-cap-final.log`                                                                                                                                    |
| 文档收尾门禁           | `pnpm format:check` / `doc:lint` / `structure:check` / `service:check` / `verify:frontend-capabilities`                  | 全部 EXIT 0；最终逐项退出码保留在 `66-final-gates.log`                                                        | 最终文档及 `0b5767f` 生产源码；不以补强前回执冒称最终文档快照                                                                                                                                     |

如实保留以下失败，不将重试结果回填为从未失败：

1. `20-fixed-cap-green.log` 初轮 6/7：边界测试自己把最后金额写成 `149999.999999`，然后错误期待再加 `0.000001` 被拒；实际上两者正好补到订单金额。修正最后金额为 `150000` 后 `21-fixed-cap-green.log` 7/7。没有放松“等于成功”规则。
2. `22-fixed-ar-read.log` 19/20：原 POST 夹具对已满额订单再开票，按新规则变 409。按 §3 改用未开票复制订单，保留原成功与守卫断言，20/20。
3. 早期 Web 组件测试导入误写成 `../../../http-core`，用例加载失败；正确路径 `../../http-core` 后 5/5。已有 `40-web-ar-console.log` 记录失败。
4. `48-hardening-targeted.log`：新增四个故障注入用例超时，原因是测试替换 PoolClient.query 后未在归还前恢复回调重载；影响随后池查询及清理。用 finally 恢复 spy 后 8 套 666/666，未放宽原 5 秒判据。该轮其它真库/HTTP/冻结测试通过。
5. `55-p1.log`：浏览器最终 up 在重活闸排队时过早调 P1，被入口以“无 state 文件”拒绝，**没有执行产品浏览器用例**。后续严格等 up 完成再执行专项；按主协调指示本分支不再重复 P1 多轮，集成候选由主协调统一三轮。
6. 一次补强提交尝试止于 Prettier check（给故障注入加 finally 后尚未格式化），没有产生提交；格式修正后通过并交 `0b5767f`。早期新增测试 require-await/可选类型诊断均修正后才提交。
7. 浏览器写探针的只读旁证在 `61-browser-invoice-cap.log`、`62-browser-invoice-cap.log` 两次收到 401：直接 Playwright APIRequestContext 没有保持应用的完整浏览器会话上下文。改为同页 fetch，并使用从应用请求观察到的 session-generation（仅内存、不外发）后旁证通过。`63-browser-invoice-cap.log` 已实际完成桌面表单 409 → 201，但将登录前正常 `/auth/session` 401 混入业务失败计数，期望 1 实际 2 而失败；最终把登录阶段与业务阶段分别记录，**没有排除业务阶段的任何意外错误**。`64-browser-invoice-cap-final.log` 两档均通过，业务阶段仅有预期 409 及其浏览器网络提示，无其它失败。
8. 旧 heavy 在满槽时固定等待 slot1，导致最终 up 在空槽已释放时仍排队。主协调修复共享 helper 并通知后，先确认本批无 state/容器、旧等待任务尚未启动 up，再用 TaskStop 只停止自己的旧队列并通过同一 heavy 重排。`52-final-browser-up.log` 为空是未执行；`59-final-browser-up-requeued.log` 为最终启动成功回执，没有绕闸。

## 6. 浏览器专项与截图

执行用户指定的 Docker Playwright 配方，已阅读 [本地 e2e harness](../engineering/local-e2e-browser-harness.md)。`E2E_LOCAL_ADMIN_DATABASE_URL` 指向专用实例，`E2E_LOCAL_CONTAINER=e2e-harness-fin003`，`E2E_LOCAL_OUT=/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003-artifacts/e2e`；临时探针仅在 `/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003-artifacts/probe/invoice-cap.mjs`，不写入仓库。栈只挂本工作树及专用产物目录。

最终被测生产源码为 `0b5767f`，重启专用栈后执行：

```sh
heavy node scripts/e2e-local/e2e-local.mjs up --skip-build
heavy node scripts/e2e-local/e2e-local.mjs walk --routes receivables,sales-orders,credit-review --viewport desktop
heavy node scripts/e2e-local/e2e-local.mjs walk --routes receivables,sales-orders,credit-review --viewport mobile
heavy docker exec -i --workdir "$FN2_ROOT" e2e-harness-fin003 node --input-type=module - "$FN2_ROOT" "$E2E_LOCAL_OUT" < "$FN2_ARTIFACTS/probe/invoice-cap.mjs"
node scripts/e2e-local/e2e-local.mjs down
```

其中 `FN2_ROOT=/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003`，`FN2_ARTIFACTS=/home/jinhuit/Kingturf/kingturf-coord/wave2/fin-003-artifacts`。`--skip-build` 复用已验证的 Web 构建，前端运行源码未改。

| 视口                   | 相关路由 walk                                                           | 表单专项                                                                                                                                        | 实际布局量测                                                    |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| desktop 1440×900       | 3/3；页面与两个详情抽屉的 console/pageerror、≥400、布局、焦点告警均为 0 | 已满额且已核销订单再开 12.34：409，中文提示含 CNY 950000 / 950000 / 12.34 / 950012.34，保留输入；随后同浏览器信用评估表单 201、PENDING_APPROVAL | 文档宽 1440；提示 top=500.0625、bottom=530.0625，在视口内并获焦 |
| mobile 390×844、倍率 2 | 3/3；同上全部为 0                                                       | 同一真实表单链 409 → 201；发票零新增                                                                                                            | 文档宽 390；提示 top=500.0625、bottom=530.0625，在视口内并获焦  |

每档在提交前用只读旁证确认演示发票原始金额为 `950000.000000`、已核销后余额为 `0.000000`；因此本例也验证上限按开票原额而非余额。拒绝前后，按该新发票号码查询均为空。**两次写操作都由界面点击触发**，只读查询仅作佐证；信用评估有真实 201 响应和“已发起信用评估”状态行。

写探针的业务阶段没有 pageerror，也没有意外 console error 或意外失败请求。每档唯一失败响应为本次预期的开票 409，浏览器同时产生一条对应的网络 console error，已单独保留，没有声称该负例零错误响应。登录前正常 session restore 的 401 也在最终日志单列。

原始报告与截图全部保留在本批产物目录：

- `e2e/walk/desktop/report.json`、`e2e/walk/mobile/report.json`，各有三张页面截图与 AR/信用两张详情截图（`walk/<viewport>/shots/`）。共 10 张，均用 Read 逐张目检；窄屏表格在自身容器内横向滚动，页面没有横向溢出。
- `e2e/invoice-cap/report.json`，两档专项均通过。四张截图为 `desktop-rejected.png`、`mobile-rejected.png`、`desktop-credit-continued.png`、`mobile-credit-continued.png`；均已逐张目检：红色原因完整可见、金额清晰、抽屉与输入保留，后续信用列表出现待审批记录和成功状态行。
- 最终命令退出码：up 0；desktop walk 0；mobile walk 0；定向探针 0；down 0。日志分别为 `59-final-browser-up-requeued.log`、`60-walk-desktop.log`、`60-walk-mobile.log`、`64-browser-invoice-cap-final.log`、`65-final-browser-down.log`。

## 7. 偏离、未做、未验证与新发现

- 原任务书要求订单行锁；后续主协调明确改为复用客户台账 advisory 锁，不加 `FOR UPDATE`。实际 READ COMMITTED 与两个锁等待者均有真库断言，非仅静态推论。
- 实际预置库名为 `w2_fin_003_test`（任务书最初写作 w2_fin003_test），以专用容器实际空库为准完成迁移，未连接共享开发/CI 库。
- 原任务书要求只改台账 TD-FIN-003 状态格；基线无该主表行，后续按主协调指示仅追加顶部状态小节，不改历史原文。
- 没有新增数据库迁移或数据库 cap 守卫；直接 SQL 可以绕过应用准入。没有扫描、修改任何真实历史账务，后续裁定已取消历史清单需求。
- 没有引入贷项冲减、FX 换算、税额重算、行级开票配额、订单改量、撤销或冲销的新口径。相同订单的错币种/错客户沿原守卫；未挂订单的发票及 CREDIT_NOTE 沿原规则。
- 完整 `ci:local`、生产验证、最终集成 P1 三轮均由主协调执行；本批没有 push、合并 main、发布或修改工作流。补强后未重复 API 全量，明确以最终 666 定向 + lint/typecheck 交验。
- 浏览器只覆盖 Chromium、合成全权限账号、1440×900 与 390×844；不冒称跨浏览器、受限字段/权限或全站验证。

| FN2 编号 | 发现、复现与影响                                                                                                                                                                                                                        | 处置                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| FN2-1    | **订单金额税义待核实**：迁移 0021 quote.total=subtotal-discount，0026 订单固定该 total；订单与应收均无含税标记/税额列，因此单看现有单据无法断定 total 的税务含义。影响后续税务标注、税额拆分与口径解释，不影响本批按现有 total 精确比较 | 已向主协调上报；按主协调答复保留待核实，不扩本次 cap、不自行定义含税/不含税 |

贷项通知是否冲减已经由所有者裁定为暂不冲减，故不列为待裁 FN2 项。其它多币种、订单改量、多行部分开票均按 §2 说明现有代码边界，没有发现必须发明新口径才能完成此次准入的情况。

## 8. 资源与收尾

基线树与基线库已由本批自清，记录 `58-baseline-cleanup.log`。最终 `down` EXIT 0，记录 `65-final-browser-down.log`；独占浏览器容器 `e2e-harness-fin003` 和浏览器库 `w2_fin003_browser_test` 已删除，`creds.json` 与 `state.json` 均已不存在。主实施工作树、分支及仍在运行的 `w2-fin-003-pg` 保留，实例中本批主测试库 `w2_fin_003_test` 保留。没有停止或删除其它会话资源。`67-resource-verification.json` 记录容器/数据库/凭据/基线树的最终机器核对，也机械确认台账原首节及其之后所有历史字节与基线完全一致。
