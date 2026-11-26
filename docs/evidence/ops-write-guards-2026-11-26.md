# 质量与投诉写路径裁定落地（TD-OPS-006、TD-OPS-007）

> 批号前缀 OP2。隔离工作协议；主协调转达项目所有者裁定并复核。本文只记录本批事实，不含生产数据。

## 1. 范围与边界

| 项     | 内容                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 分支   | `fix/w2-ops-write-guards`                                                                                                      |
| 工作树 | `/home/jinhuit/Kingturf/kingturf-coord/wave2/ops`                                                                              |
| 基线   | `main@4a93003`                                                                                                                 |
| 基线树 | `git worktree add --detach` 到 `ops-artifacts/baseline`，用完已删除；依赖以符号链接指向本批工作树                              |
| 数据库 | 专用 PostgreSQL 17.7 容器 `w2-ops-pg`（`127.0.0.1:5449`）；`w2_ops_test`（修复树）、`w2_ops_base_test`（基线树），各 77 条迁移 |

范围内：投诉登记的描述长度下限（TD-OPS-007）；检验计划规格上下限、检验结果备注、不合格报告临时遏制说明三处的留空处理（TD-OPS-006）。

范围外且未动：数据库迁移、`packages/ui` 公共行为、`app-values.ts`、`routes/dispatch/*`、发布工作流、`AGENTS.md`。

## 2. 裁定原文（主协调转达，2026-11-26）

TD-OPS-006（覆盖任务书里「任何字段都不允许空串入库」那一条）：

> - 检验特性的数值上下限：留空=不适用，存 NULL（端点把空串当作未传）。
> - 检验结果备注（quality_inspection_results.notes，NOT NULL）：留空时存空串。
> - 临时遏制说明（nonconformance_reports.temporary_containment，NOT NULL DEFAULT ''）：留空时存空串。

「空白」的边界（主协调答复）：

> 1. 空串与纯空白串都算留空——与解析器 string() 自己的口径一致（它用的是 !value.trim()）。存库时存空串，不要把纯空白原样存进去。
> 2. 数值上下限两个字段：null 也当作未传（存 NULL）。理由是 null 与空串在这里是同一个意思的两种写法，表单的数字输入框发哪一种取决于组件实现，不该因此一个通过一个被拒。
> 3. 两个文本字段（备注、临时遏制说明）：按你说的先只接受字符串形式的留空，null 等非字符串值维持原拒绝。但必须用真实表单在浏览器里做一次留空提交，确认表单实际发出的载荷形态；如果真实表单对空字段发的是 null，那这个字段就把 null 也当作留空，并在证据里写明「依据真实表单载荷」。
> 4. 数字、布尔、对象这类非字符串值一律维持原拒绝，不放宽。

TD-OPS-007：

> 沿用现值：投诉描述最短 10 个字符（迁移 0054：CHECK(length(trim(description))>=10)）。端点按码点计数与 PostgreSQL 的 length() 同口径，认可。

另：项目所有者说明当前是开发阶段、生产没有实际业务单据，不需要做现网空值分布取证。

## 3. 逐字段事实表与最终口径

行号均指基线 `4a93003`。「表单发什么」指真实表单留空时发出的值：`FormSection` 对未填字段给空串（`packages/ui/src/form-section.tsx:107`、`:114`），`trimOpsValues` 只去首尾空白（`apps/web/src/commercial/console/ops-form.tsx:26`、`:63`）。

| 字段（表.列）                                | 表单是否允许留空                                                                     | 数据库约束                                                                                                                | legacy 写路径对空值的实际处理                                                                                                                                                                                 | 端点校验器（基线）对空值的处理                                                                                                                                            | 最终口径                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| quality_plan_characteristics.lower_limit     | 允许。`quality-forms.ts:48`（「下限（可选）」，无 required）；载荷 `:67`，留空发空串 | `numeric(24,6)` 可空（`0043:21`）；与上限同非空时 `upper_limit>=lower_limit`，非 NUMERIC 类型必须两者皆 NULL（`0043:24`） | 键缺省：省略，仓储 `item.lowerLimit ?? null` 存 NULL（`quality-repositories.ts:88`）。空串与 null：被解析器拒绝，不落库                                                                                       | 只在 `undefined` 时省略键（`quality-plan-create.ts:72-74`）；`''`、纯空白、`null` 交 `decimal` → `string` → 400 `lowerLimit is required`（`app-values.ts:82-85`、`:297`） | **留空=不适用，存 NULL**。未传、`null`、空串、纯空白串都当未传                                                    |
| quality_plan_characteristics.upper_limit     | 同上（`quality-forms.ts:49`、`:68`）                                                 | 同上（`0043:21`、`:24`）                                                                                                  | 同上（`quality-repositories.ts:89`）                                                                                                                                                                          | 同上（`quality-plan-create.ts:75-77`，400 `upperLimit is required`）                                                                                                      | **留空=不适用，存 NULL**。同上                                                                                    |
| quality_inspection_results.notes             | 允许。`quality-forms.ts:170`（无 required）；载荷 `:180`，留空发空串                 | `text NOT NULL`，无 CHECK、无默认值（`0043:46`）；接受空串                                                                | 校验器 `string(body.notes ?? '', 'notes')`（`quality-result-record.ts:90`）：空串、未传、`null` 一律 400 `notes is required`。仓储原样写入 `input.notes`（`quality-repositories.ts:273`）；数据库本身接受空串 | 同左：400 `notes is required`                                                                                                                                             | **留空存空串**。空串与纯空白串存 `''`；未传与 `null` 仍是 400                                                     |
| nonconformance_reports.temporary_containment | 允许。`complaint-forms.ts:225`（无 required）；载荷 `:237`，留空发空串               | `text NOT NULL DEFAULT ''`（`0054:52`），无 CHECK                                                                         | 校验器 `p.string(body.temporaryContainment, …)`（`ncr-create.ts:68`）：空串、未传、`null` 一律 400 `temporaryContainment is required`。仓储原样写入（`complaint-repositories.ts:489`）                        | 同左：400 `temporaryContainment is required`                                                                                                                              | **留空存空串**。空串与纯空白串存 `''`；未传与 `null` 仍是 400                                                     |
| customer_complaints.description              | 必填但无长度提示。`complaint-forms.ts:56`                                            | `text NOT NULL CHECK(length(trim(description))>=10)`（`0054:23`）                                                         | 校验器只要求非空（`complaint-create.ts:63`）；仓储原样写入（`complaint-repositories.ts:321`）。不足 10 个字符命中检查约束，HTTP 500                                                                           | 通过，直到数据库拒绝                                                                                                                                                      | **沿用 10**。端点前置校验：去首尾空白后不足 10 个字符 → 400「问题描述至少 10 个字符」，按码点计数；表单标最少字数 |

相邻字段（核对过，不在裁定内，未改动）：

- `quality_plan_characteristics.unit_code`（`0043:20`，可空）：不在任何表单上；解析点 `quality-plan-create.ts:71` 与上下限同形（缺省 → NULL，`''` 与 `null` → 400）。见 OP2-3。
- `quality_plan_characteristics.instructions`（`0043:21`，NOT NULL）：表单没有输入项、恒发空串（`quality-forms.ts:70`），ops1-1 已让端点接受字面空串。与本裁定「NOT NULL 文本列留空存空串」同向。
- `customer_complaints.customer_request`（`0055:3`，`CHECK(length(trim(customer_request))>=2)`）：与描述同类，见 OP2-1。

## 4. 提交清单

| 提交      | 主题行                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `8635dc9` | `fix(complaint): reject descriptions shorter than 10 characters before the database (TD-OPS-007) [未测试]` |
| `75858b8` | `fix(quality): store blank limits as NULL and blank notes as empty strings (TD-OPS-006) [未测试]`          |
| 文档提交  | 见最终报告                                                                                                 |

## 5. 改动与理由

| 文件                                                                    | 改动                                                                        | 理由                                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/complaint-create.ts`                               | 新增 `complaintDescription`：解析后按码点计数，不足 10 抛 `invalid_request` | 在数据库之前给出 4xx；码点计数与 `length()` 一致，星面字符不会被端点放行后又被数据库拒绝             |
| `apps/api/src/blank-text.ts`（新）                                      | `isBlankText`、`isUnfilledLimit`、`blankableText` 三个纯函数                | 三条路由共用同一判据，不在各域各写一份；不进 `app-values.ts`（其导出清单受 f3 保真比对冻结）         |
| `apps/api/src/routes/quality-plan-create.ts`                            | 上下限改用 `isUnfilledLimit` 判断                                           | 留空时省略键，沿用仓储既有的 `?? null`，落库值与规范哈希同「未传」完全一致                           |
| `apps/api/src/routes/quality-result-record.ts`                          | `notes` 改用 `blankableText`                                                | 留空存空串；其余值的拒绝消息不变                                                                     |
| `apps/api/src/routes/ncr-create.ts`                                     | `temporaryContainment` 改用 `blankableText`                                 | 同上                                                                                                 |
| `apps/api/test/complaint-create-route-contract.test.ts`                 | +2                                                                          | 钉住 9 个字符（含首尾空白、5 个星面字符）的 400 信封与恰好 10 个字符的放行                           |
| `apps/api/test/quality-route-contract.test.ts`                          | 改钉 8 条既有断言，用例数不变（1310）                                       | 上下限的空串与 `null` 四条、备注空串与纯空白四条由 400 改钉为 201 并核对仓储入参；其余断言未动       |
| `apps/api/test/ncr-create-route-contract.test.ts`                       | 改 1 行、新增 9 条                                                          | 优先级行改用 `null` 保持「先于版本号」的断言；另钉留空 2 条与非字符串 7 条                           |
| `apps/api/test/ops-write-guard-http-postgres.integration.test.ts`（新） | 8 条真 HTTP + 真库用例                                                      | 前后对照的载体；每条同时核对响应、落库值与零写入                                                     |
| `apps/web/src/commercial/console/complaint-forms.ts`                    | 问题描述加 `minLength: 10` 与提示；载荷处注明口径                           | 表单标最少字数，沿用 `FormSection` 既有做法（同 `identity-page.tsx` 的临时密码字段）                 |
| `apps/web/src/commercial/console/quality-forms.ts`                      | 两处载荷注释                                                                | 三处字段本就非必填，无行为改动                                                                       |
| `apps/web/src/commercial/console/ops-write-guard-forms.test.tsx`（新）  | 2 条                                                                        | 真实 `FormSection`：三处留空不触发必填提示、提交到达、载荷里是空串；描述 9 个字符被拦、10 个字符放行 |

## 6. 真库前后对照

同一份用例文件（sha256 `d77f0164…01fb62`）先在基线树 `4a93003` 上跑，再在修复树上跑。基线 4 失败 4 通过，修复后 8 通过。

下表由同一探针脚本在两棵树上各跑一次得到（真 HTTP、真库；行数为请求后的相关表计数）。日志在 `ops-artifacts/logs/probe-baseline.log` 与 `probe-fixed.log`。

| 请求                      | 基线 `4a93003`                         | 修复后                                                  | 落库值（修复后）                     |
| ------------------------- | -------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| 投诉描述 9 个字符         | 500 `internal_error`，投诉表 0 行      | 400 `invalid_request`「问题描述至少 10 个字符」，零写入 | —                                    |
| 投诉描述 5 个星面字符     | 500                                    | 400，同上，零写入                                       | —                                    |
| 投诉描述恰好 10 个字符    | 201                                    | 201                                                     | 去首尾空白后的原值                   |
| 计划上下限 `""`、`""`     | 400 `lowerLimit is required`           | 201                                                     | `lower_limit`、`upper_limit` 均 NULL |
| 计划上下限 `null`、`null` | 400 `lowerLimit is required`           | 201                                                     | 均 NULL                              |
| 计划上下限 `10`、`""`     | 400 `upperLimit is required`           | 201                                                     | `10.000000`、NULL                    |
| 检验结果备注 `""`         | 400 `notes is required`                | 201                                                     | `''`                                 |
| 检验结果备注 `null`       | 400 `notes is required`                | 400（不变）                                             | —                                    |
| 临时遏制说明 `""`         | 400 `temporaryContainment is required` | 201                                                     | `''`                                 |
| 临时遏制说明 `null`       | 400 `temporaryContainment is required` | 400（不变）                                             | —                                    |

用例里另钉：上下限的非字符串值（`0`、`false`、`[]`、`{}`、`'NaN'`）与两个文本字段的非字符串值（未传、`null`、`3`、`false`、`{}`）都维持原拒绝且零写入；这几条在基线上同样通过。

## 7. 冻结轨迹与旧分派保真

| 检查                      | 文件                                   | 结果    |
| ------------------------- | -------------------------------------- | ------- |
| f3 冻结轨迹               | `app-batch4-preservation.test.ts`      | 311/311 |
| 旧分派源码保真            | `dispatch-source-preservation.test.ts` | 28/28   |
| `app-values` 导出清单保真 | `app-values-preservation.test.ts`      | 2/2     |

动了旧写路径：三个路由的解析点在 legacy 轨与 Fastify 桥轨之间共用，两条轨的行为同时改变。没有动 `routes/dispatch/*`（否则要重钉旧分派保真）、没有动仓储、没有动 `app-values.ts`，因此两项保真检查不需要重钉，也没有改任何断言。

既有契约测试里有 9 条断言因裁定而变：`quality-route-contract` 8 条（上下限的空串与 `null` 四条、备注空串与纯空白四条），`ncr-create-route-contract` 1 行。逐条改成钉新口径，没有删除断言；修复前跑这三份契约测试恰好这 9 条失败。

## 8. 验证

所有重活经重活闸 `/home/jinhuit/Kingturf/kingturf-coord/bin/heavy` 运行；数据库变量一律经环境变量传入。

| 命令                                                                                                | 结果                                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm format:check`、`doc:lint`、`structure:check`、`service:check`、`verify:frontend-capabilities` | 均 0（结构门禁强制违规 0，白名单豁免 30 条为存量）         |
| `pnpm lint`（过闸）                                                                                 | 0；`apps/api` 有 2 条存量警告，见 OP2-4                    |
| `pnpm typecheck`（过闸）                                                                            | 0                                                          |
| `pnpm --filter @kingturf/web build`（过闸）                                                         | 0；登录入口 gzip 11.75 kB，样式 28.66 kB，登录预算断言通过 |
| `pnpm --filter @kingturf/web exec vitest run --maxWorkers=4`（过闸）                                | 66 文件 1026/1026                                          |
| `pnpm --filter @kingturf/api test`（过闸，串行）                                                    | 0；200 文件 18299/18299，775.9 秒                          |
| 定向 API 7 文件（含三项保真）                                                                       | 1845/1845                                                  |
| 定向 Web 3 文件                                                                                     | 119/119                                                    |
| 基线树上跑同一份新用例                                                                              | 4 失败 4 通过（退出码 1，旧结果如 §6）                     |

日志在 `/home/jinhuit/Kingturf/kingturf-coord/wave2/ops-artifacts/logs/`。

### 8.1 浏览器

栈：`scripts/e2e-local/e2e-local.mjs up`（过闸），容器 `e2e-harness-ops`、专用库 `w2_ops_e2e_test`、合成全权限账号 `admin`。跑完已 `down`：容器删除、专用库删除、口令文件删除，退出码 0。

| 项目                                    | 桌面 1440×900                                               | 手机 390×844（倍率 2） |
| --------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| 走查 `walk --routes quality-inspection` | 1/1 到达；控制台报错 0、≥400 响应 0、页面问题 0、抽屉问题 0 | 同左                   |
| 定向探针                                | 5/5；登录后控制台报错 0、≥400 响应 0                        | 同左                   |

探针用真实表单提交，并抓取表单实际发出的请求体：

| 步骤 | 界面操作                         | 表单实际发出的值                                 | 结果                                    |
| ---- | -------------------------------- | ------------------------------------------------ | --------------------------------------- |
| B1   | 创建检验计划，上下限两格留空     | `lowerLimit: ""`、`upperLimit: ""`（都是字符串） | 201，「创建检验计划成功」               |
| B2   | 记录检验结果，备注留空           | `notes: ""`                                      | 201，「记录检验结果成功」               |
| B3   | 开立不合格报告，临时遏制说明留空 | `temporaryContainment: ""`                       | 201，「开立不合格报告成功」             |
| A1   | 登记投诉，描述 9 个字符          | 不发请求                                         | 被浏览器原生 `minlength` 拦下，见 OP2-6 |
| A2   | 描述改为恰好 10 个字符           | 10 个字符的描述                                  | 201，「登记客户投诉成功」               |

三处留空字段在界面上都没有 `required` 属性和「必填」标记，留空提交不触发必填提示。真实表单对空字段发的是空串而不是 `null`，所以按裁定第 3 点，两个文本字段没有把 `null` 放行。

前置数据里有一部分是经令牌接口建立的，不是界面操作：B2 的检验单开立与抽样，B3 的处理时限策略、投诉登记、分派与开始调查。B1、A1、A2 的对象完全由界面创建。没有从界面走「开立检验单」，因为那一格的来源业务编号只收 UUID（OP2-3）。创建检验计划提交前有确认框，探针点了确认。

截图 20 张，逐张目检：`ops-artifacts/e2e/probe/{desktop,mobile}/` 各 9 张（`B1-plan-form-blank-limits`、`B1-plan-created`、`B2-result-form-blank-notes`、`B2-result-recorded`、`B3-ncr-form-blank-containment`、`B3-ncr-created`、`A1-complaint-form-9-chars`、`A1-complaint-9-chars-blocked`、`A2-complaint-created`），走查整页截图 `ops-artifacts/e2e/walk/{desktop,mobile}/shots/quality-inspection.png`。表单截图是填完最后一个字段后的状态，抽屉体滚到底部，顶部几个字段被标题栏遮住，这是滚动位置而不是布局缺陷。检验结果表里空备注显示为「—」。

探针首轮两个视口都是 0/5：探针自己没有处理创建检验计划的确认框，后续步骤被确认层挡住。修的是探针脚本，产品没有改动；上表是修后的结果。

## 9. 偏离任务书之处

- 任务书要求改台账两行的「状态」格；这两条在台账里是列表项，没有独立的格。按同一意图把两行改写成一行式的状态说明，并按要求新增小节。
- 任务书的落地规则是「legacy 不允许留空的字段 → 表单标必填」。主协调转达的所有者裁定改为「备注与临时遏制说明留空存空串、表单不标必填」，按裁定执行。
- 为让两个 TD 各自单独成提交，两份新测试文件先以只含 TD-OPS-007 用例的版本进入第一个提交，第二个提交补齐 TD-OPS-006 的用例。

## 10. 没做与没验证

- 没有跑完整 `pnpm ci:local`（任务书禁止），两个代码提交都标 `[未测试]`。
- 浏览器只有 Chromium、两个视口、一个合成全权限账号。
- 没有从界面走「开立检验单」和投诉的分诊、调查这几步，它们是探针经接口建立的前置数据。
- OP2-1 里另外六处长度下限只按代码同形推断，没有逐一实测。
- 没有在线上验证；按所有者说明没有做现网空值分布取证。

## 11. 新发现（任务书之外，未修）

均只取证、未修（R4）。X1、X2、X3 由同一探针在基线树与修复树上各跑一次，两棵树结果相同，说明不是本批引入。

| 编号  | 现象                                                                                                                                                                           | 复现与影响面                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP2-1 | 投诉、NCR、CAPA 链路上另有 8 个文本字段只有数据库长度下限，端点只要求非空，与 TD-OPS-007 同类                                                                                  | 真 HTTP 取证两条：客户诉求 1 个字符 → 500；投诉分诊理由 1 个字符 → 500（约束见 `0055:3`、`0055:6`）。其余六处按代码同形推断、未逐一实测（待核实）：NCR 缺陷类型与影响范围（`0055:8-9`）、NCR 流转理由（`0055:10`）、CAPA 流转理由（`0055:14`）、CAPA 措施描述不足 5 个字符（`0054:94`）、CAPA 验证标准与样本范围（`0055:20-21`）。用户输入单字符时得到「服务器处理请求时出错」         |
| OP2-2 | 开立检验单的「来源业务编号」在表单里是自由文本（`quality-forms.ts:104`），端点却要求 UUID（`quality-inspection-open.ts:73`）                                                   | 真 HTTP：`sourceId` 填 `SO-2026-001` → 400 `sourceId must be a UUID`。用户填业务单号无法开立检验单，除非粘贴一个 UUID                                                                                                                                                                                                                                                                  |
| OP2-3 | `quality_plan_characteristics.unit_code` 的空串与 `null` 被拒（400），键缺省才存 NULL，与本批上下限修复前同形                                                                  | 不在任何表单上，目前无界面入口会触发；若日后表单加单位输入会重现                                                                                                                                                                                                                                                                                                                       |
| OP2-4 | `pnpm lint` 在 `apps/api` 留有 2 条警告：`server-fastify.ts:36-37` 的 eslint-disable 指令已无对应问题                                                                          | 基线即有，不影响退出码                                                                                                                                                                                                                                                                                                                                                                 |
| OP2-5 | 投诉登记表单的「问题分类」是自由文本，默认显示英文枚举 `OTHER`（`complaint-forms.ts:53`）；端点只要求非空（`complaint-create.ts:59`），数据库只接受 30 个固定编码（`0054:18`） | 真 HTTP：填「起球」→ 500。用户在这一格填任何中文或自拟分类都会得到「服务器处理请求时出错」                                                                                                                                                                                                                                                                                             |
| OP2-6 | 描述过短时用户看到的是浏览器原生气泡，语言随浏览器，不是表单的中文提示                                                                                                         | 真 Chromium：气泡为「Please lengthen this text to 10 characters or more (you are currently using 9 characters).」。原生 `minlength` 先于表单自校验触发（`packages/ui/src/form-section.tsx:228`），这是 `FormSection` 对所有 `minLength` 字段的既有行为，与待裁的 WFB-3 / TD-WEB-016 同源。字段下方的中文提示常驻。表单按 UTF-16 码元计数、端点按码点计数，两者不一致时端点给明确的 400 |
| OP2-7 | 手机视口投诉页签的三个工具栏按钮（＋ 登记投诉、发布处理时限、批量分派）紧贴无间距                                                                                              | 仅目检所见（`probe/mobile/A2-complaint-created.png`），存量样式，未量测；走查的布局检查没有判为问题                                                                                                                                                                                                                                                                                    |
