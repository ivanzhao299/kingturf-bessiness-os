# 冒烟目录补修复提交证据（TD-TEST-029，2026-11-26）

> 台账条目 [TD-TEST-029](../exec-plans/tech-debt-tracker.md)（P3，测试基础设施）：冒烟目录的历史条目 `cause` 文本仍描述修复前状态，目录未标注修复提交。
> 改动范围：`scripts/e2e-local/write-smoke-catalog.mjs`（目录）、`scripts/e2e-local/write-smoke.mjs`（报告）、新增 `scripts/e2e-local/write-smoke-report.test.mjs`、`package.json` 一行接入、本证据与台账、索引、[配方文档 §4.5](../engineering/local-e2e-browser-harness.md) 同步。产品代码零改动。
> 隔离：独立工作树（分支 `test/w3-smoke-catalog-fixed-in`，基线 main `4a93003`）；浏览器验证用一次性专用库（容器 `w3-smoke-catalog-pg` @127.0.0.1:5451，e2e-local 自建自删）。

## 1. 做了什么

1. 目录条目新增可选字段 `fixedIn`：该缺陷修复提交的完整 40 位 SHA（必须在 main 历史上）。逐条判断现有 24 个条目，23 条补上；cause 一律改写成「修复前是这样，已于某提交修复」；WS-P2-03 没有单独修复提交，不补字段、cause 保持 HEAD 原文（§2.3）。
2. 报告侧（`printSummary`）把未复现的条目按有无 `fixedIn` 分两组展示——「已修复、留作回归检查（未复现）」与「基线即未复现、无修复提交」，摘要行分别计数；另有台账的条目（WS-P2-07）归「已另有台账的条目（对账用）」组；`--flows` 没跑到、流程中止未执行或探针跳过的条目单列「未检查的条目」组（组内条目数与摘要计数可能相差 1，标题注明对账组里的未检查条目）。检查项断言与退出码规则（流程失败或 P1/P2 复现即为 1）零改动。
3. 行尾「（短号 修复）」后缀只在标题未提及时显示（WS-P2-07、WS-P3-09 的标题已含提交号，不再重复）。
4. 新增 `write-smoke-report.test.mjs`（`node --test`，不连数据库、不起浏览器）：覆盖全量 clean、`--flows lead` 部分运行、流程中止、旧提交上 WS-P2-07 复现四种输入的分组，并断言每条 `fixedIn` 是 40 位小写十六进制。经 `package.json` 的 `test:session-network-tools` 接入 `pnpm test`。`printSummary` 导出供测试 import，入口守卫用仓库既有的 `process.argv[1]` + `pathToFileURL` 写法（见 §3.3）。

## 2. 修复提交的考证

### 2.1 考证方法

提交号取自台账（`tech-debt-tracker.md` 各行）与 WF-A/WF-B/WF-C 三份证据文档的提交表；再用 `git show --stat` 逐一核对提交确实改动了缺陷描述的代码，`git rev-parse` 取 40 位全长，`git merge-base --is-ancestor <sha> HEAD` 对工作树 HEAD（`4a93003…`）核对祖先关系。23 条全部成立（探针回执：条目 24 条，带 fixedIn 23 条，不带 1 条，核对失败 0 条）。探针脚本（`verify-fixed-in.mjs`）放产物目录、不入库；「在 main 历史上」的核对不随 `pnpm test` 运行（CI 浅克隆没有历史提交对象，见 §3.3 第 1 条）。

### 2.2 逐条对照

| 检查项                            | 台账编号       | fixedIn（短号） | 关联提交                                       |
| --------------------------------- | -------------- | --------------- | ---------------------------------------------- |
| WS-P1-01 信用评估不可用           | TD-WF-001      | `551952a`       | —                                              |
| WS-P1-02 信用审批 400             | TD-WF-002      | `dcdb19b`       | —                                              |
| WS-P1-03 关闭询价 500             | TD-WF-003      | `891df58`       | 合并提交 `dd062aa`（WF-A 分支并入 main）       |
| WS-P1-04 双击重复提交             | TD-WF-004      | `d10a353`       | `f5a6919`（四个表单交还 Promise）              |
| WS-P2-01 新建抽屉零提示           | TD-WF-005      | `8bcd469`       | `c86217b`（FormSection error 属性）            |
| WS-P2-02 错误英文原文             | TD-WF-006      | `c1a20d3`       | `a2d3ae5`（信用控制台补接）                    |
| WS-P2-03 登记收货后订单列表不更新 | —              | 不补            | （§2.3）                                       |
| WS-P2-04 下拉挂载快照             | TD-WF-007      | `c6654fa`       | —                                              |
| WS-P2-05 详情抽屉不刷新           | TD-WF-008      | `322716c`       | —                                              |
| WS-P2-06 必填下拉空选             | TD-WF-009      | `9591547`       | —                                              |
| WS-P2-07 数字字段小数被拦         | TD-UI-009      | `b32402f`       | —                                              |
| WS-P2-08 产品列裸 UUID            | TD-WF-010      | `184290c`       | —                                              |
| WS-P2-09 草稿 BOM 组件层级空      | TD-WF-011      | `4209326`       | —                                              |
| WS-P2-10 错误提示在视口外         | TD-WF-012      | `2ae9e7c`       | —                                              |
| WS-P2-11 输入错误返回 500         | TD-WF-013      | `b16784c`       | `77c7339`（名称重复与 legacy 轨自批）          |
| WS-P3-01 无成功提示               | TD-WF-014 之一 | `9e0bc5a`       | —                                              |
| WS-P3-02 无确认对话框             | TD-WF-014 之一 | `df60062`       | `6b1e757`（ConfirmDialog 组件）                |
| WS-P3-03 ON_HOLD 枚举原文         | TD-WF-014 之一 | `012a9c6`       | —                                              |
| WS-P3-04 焦点掉出抽屉             | TD-WF-014 之一 | `9140b9d`       | `23861af`（真浏览器抓到的回归修复）            |
| WS-P3-05 「我确认要确认拒绝」     | TD-WF-014 之一 | `746ae5c`       | —                                              |
| WS-P3-06 第 2 行起无默认值        | TD-WF-014 之一 | `5b9de63`       | `ac494d5`（控制台测试）、`3fae094`（探针口径） |
| WS-P3-07 币种与倒计时连写         | TD-WF-014 之一 | `37cfd50`       | —                                              |
| WS-P3-08 信用决定用 ID 片段       | TD-WF-014 之一 | `b62fbff`       | —                                              |
| WS-P3-09 testid 撞名              | —              | `1cabe3f`       | （目录头注释与提交本身记载）                   |

考证中的两处更正与补充，均以 git 实测为准：

- **WS-P2-06 的提交号**：WF-B 证据 §2 提交表写 `adae9be`，但该 SHA 不在 main 历史上（`git merge-base --is-ancestor` 判 NOT-ANCESTOR，是证据落盘后 rebase/重建前的旧号）；采台账 TD-WF-009 行记载的 `9591547`（在 main 历史上，`git show --stat` 确认改 `packages/ui/src/form-section.tsx` 的必填下拉行为）。
- **WS-P3-01 的接入规模**：cause 初稿照抄 WF-C 证据 §1 提交表的「九个控制台十八类写动作」，但该行自己列了 11 个控制台名字且 §7.4 写「十一处」；按 `git show --stat 9e0bc5a` 实际改动改写为「供应商 / 采购订单 / 询价 / 收货 / 物料 / BOM / 工艺路线 / 报价 / 信用 / 线索 / 客户十一个控制台」。

### 2.3 WS-P2-03 不补 fixedIn 的裁定（审查第 2 轮修正）

初稿把 `6902b9e`（`feat(web): split procurement into sub-routes…`）填作 WS-P2-03 的 fixedIn，cause 又自写「没有针对本缺陷的单独修复提交」，与目录头注释直接矛盾。审查裁定不补：台账与三份 WF 证据都没有把它记为已修复（台账口径是「1 项在采购域子路由化后不再复现」），`6902b9e` 是 TD-PROC-010 的行为变更提交、全文未提 WS-P2-03，它让同屏场景消失但没有改「写完不通知同屏控制台」的根因。已按裁定去掉 fixedIn、cause 恢复 HEAD 原文，该条目落「基线即未复现、无修复提交」组——这也是任务书第二组第一次有真实条目（全量轮计数 1）。

## 3. 审查轮次与本提交的演化（工作流记录，共 4 轮）

### 3.1 第 1 轮：门禁「暂存区与提交主题检查」未过

主题行缺 TD 编号。改为 `test(e2e): record fixing commits in the smoke catalog with fixedIn (TD-TEST-029) [未测试]`（本轮只补 TD 编号；scope 从 `e2e` 改 `e2e-local` 是第 2 轮的建议采纳项，见 §3.2）。

### 3.2 第 2 轮：必须改 3 条（初版的两处回归与一处考证错误）

1. **未检查条目从摘要消失**（初版分组实现把 `report.probed` 里没有值的条目排除在所有组之外）：摘要新增「未检查的条目」组，注释与实现一致，摘要行补「未检查 N 项」计数。
2. **tracking 标记被静默丢弃**（工厂改成 extras 对象后只读 `extra.tracking`，WS-P2-07 传的 `tracker` 键不再生效，tracking 机制成死代码）：WS-P2-07 改传 `{ tracking: { tracker: 'TD-UI-009' }, fixedIn: … }`，复现时归对账组并计 1 项；tracking 对象里旧的 7 位短号不再保留（顶层 `fixedIn` 已是 40 位全长）。
3. **WS-P2-03 不该补 fixedIn**：见 §2.3。

同时采纳建议：scope 改 `e2e-local`；「（短号 修复）」后缀仅在标题未提及时显示；WS-P3-01 的控制台数按提交改「十一个」（§2.2）；新增分组单元测试（§1.4）；WS-P2-06 的 cause 加回「「否 / 是」这类布尔项尤其应当有默认值」。

### 3.3 第 3 轮：必须改 2 条（新测试与入口守卫在允许环境上的失效）

1. **新测试的祖先断言在 CI 浅克隆必红**：CI 的 `actions/checkout` 默认 depth=1，`git merge-base --is-ancestor <fixedIn> HEAD` 会因提交对象不存在而失败（审查者在 depth=1 克隆实测 pass 4 / fail 1、`fatal: Not a valid commit name`）。已删该断言，只保留 40 位格式断言，用例名同步改；「在 main 历史上」由探针在完整检出上核对（§2.1）。验收：depth=1 克隆主检出、导入本批四个文件后 `node --test scripts/e2e-local/write-smoke-report.test.mjs` 5/5 通过、exit 0。
2. **`import.meta.main` 在 Node 24.0/24.1 上不存在**（engines 下限 `>=24.0.0`，该属性自 24.2.0 才有），守卫静默失效、脚本以 0 退出，破坏「流程失败或 P1/P2 复现即为 1」的契约（审查者实测 Node 24.1.0 下暂存版无输出 exit 0）。已换成仓库既有写法 `process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url`（同 `scripts/validate_release.mjs:67`），并留注释说明不用 `import.meta.main` 的原因。验收：Node 24.1.0 与本机 24.19.0 下直接运行均报 `KINGTURF_CREDS_FILE is required`、exit 1；被测试 import 时不执行 main。

另采纳建议：「未检查的条目」组在有未检查的台账条目时，标题注记「另有 N 条已另有台账、归对账组」；[配方文档 §4.5](../engineering/local-e2e-browser-harness.md) 的分组描述同步本批（随本提交）。

### 3.4 第 4 轮：审查通过

工具提交 `f54d72f`（`test(e2e-local): record fixing commits in the smoke catalog with fixedIn (TD-TEST-029) [未测试]`，4 文件 +296/−53）过门禁与审查并入库；本证据文档、索引与台账为随后的文档提交。

## 4. 验证

| 检查      | 命令                                                                                                                             | 结果                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 单元测试  | `node --test scripts/e2e-local/db-target.test.mjs scripts/e2e-local/exec.test.mjs scripts/e2e-local/write-smoke-report.test.mjs` | 13/13 通过（db-target 5 + exec 3 + 分组 5）                                  |
| Lint      | `pnpm lint`                                                                                                                      | exit 0（仅 apps/api 两条既有 unused-disable warning，与本批无关）            |
| 格式      | `pnpm exec prettier --check`（本批全部暂存文件）                                                                                 | 全过                                                                         |
| SHA 探针  | `node verify-fixed-in.mjs <工作树>`（产物目录脚本：加载目录模块，逐条 rev-parse + merge-base --is-ancestor + 对照 git log 主题） | 24 条：带 fixedIn 23 条全部 OK，WS-P2-03 无字段，核对失败 0；HEAD `4a93003…` |
| 浅克隆    | `git clone --depth 1` 主检出 + 导入本批文件 + `node --test scripts/e2e-local/write-smoke-report.test.mjs`                        | 5/5 通过、exit 0（§3.3 修正后）                                              |
| 整链      | `pnpm test:session-network-tools`                                                                                                | exit 0                                                                       |
| Node 版本 | `node scripts/e2e-local/write-smoke.mjs`（无口令文件）与 `npx -y -p node@24.1.0 node …`                                          | 均报 `KINGTURF_CREDS_FILE is required`、exit 1                               |
| 真浏览器  | e2e-local Docker 栈（`e2e-harness-smokecatalog`，一次性库自建自删）                                                              | 见 §4.1                                                                      |

`ci:local` 全量未在本分支或任何合并树上实跑：工作流只跑了暂存区/主题行等确定性门禁，审查者重跑的是决定性检查（`node --test`、`pnpm lint`、doc-lint、prettier 等），不是完整门禁；本提交按审查要求以 [未测试] 结尾，完整 `ci:local` 待合并树上补跑。`prompt-history.txt` 未触碰；口令只经环境变量传递，未打印、未落盘。

### 4.1 写流程真浏览器（四轮起栈，全部 down 拆栈、专用库已删）

| 轮                 | 被测版本              | 流程       | 必须步骤     | 检查项分组                                                                       | 摘要行（当时代码的实际输出）                                                                 | 退出码 |
| ------------------ | --------------------- | ---------- | ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| 1（初版目录）      | 全量                  | 6/6        | 32/32        | 24 项全落「已修复」组（当时 24 条全带 fixedIn，基线组为空）                      | 未复现 24 项：已修复、留作回归检查 24 项；基线即未复现 0 项（当时还没有「未检查」组与计数）  | 0      |
| 2（extras 重构后） | `--flows lead`        | 1/1        | 5/5          | 3 条 clean 进已修复组；其余 21 条不在摘要任何组里（这正是第 2 轮审查的必须改项） | 未复现 3 项：已修复、留作回归检查 3 项；基线即未复现 0 项（「未检查」组系第 2 轮修正后才补） | 0      |
| 3（§3.2 修正后）   | 全量 + `--flows lead` | 6/6 与 1/1 | 32/32 与 5/5 | 全量：23 条已修复组 + WS-P2-03 落基线组；lead：3 + 20 + 对账组 1                 | 未复现 24 项：23 / 1 / 未检查 0；未复现 3 项：3 / 0 / 未检查 21                              | 0 与 0 |
| 4（§3.3 修正后）   | 全量 + `--flows lead` | 6/6 与 1/1 | 32/32 与 5/5 | 同第 3 轮；lead 轮组标题带「另有 1 条已另有台账、归对账组」注记                  | 未复现 24 项：23 / 1 / 未检查 0；未复现 3 项：3 / 0 / 未检查 21                              | 0 与 0 |

四个一次性库 `kingturf_test_e2e_34555cdc` / `5b80bedd` / `8a364be8` / `e028d2af` 均随 `down` 删除；报告与截图在产物目录 `e2e/write-smoke/`。

## 5. 边界与遗留

- 目录里 23 条对应已修复缺陷、WS-P2-03 是不再复现的基线条目（第 2 轮修正后 23 条带 fixedIn + 1 条基线组）；「未检查的条目」组在完整运行时为空，只有 `--flows` 部分运行或流程中止时出现。
- 「在 main 历史上」的核对不随 `pnpm test` 运行（§3.3）；目录后续新增 fixedIn 时需在完整检出上跑探针或等效核对。
- TD-WF-014 八项在 cause 里统一标注「台账 TD-WF-014 之一」，单项提交映射见 §2.2 表（与台账 TD-WF-014 行一致）。
