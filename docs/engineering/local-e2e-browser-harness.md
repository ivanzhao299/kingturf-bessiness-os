# 本地真浏览器 e2e 配方（local-e2e-browser-harness）

> 台账 TD-TEST-023。目的：让每个批次在没有项目所有者口令的情况下，在本机跑一遍真浏览器验收。
> 入口：`scripts/e2e-local/`。首次使用的背景与证据见 [UX 波次真浏览器验收](../evidence/ux-real-browser-verification-2026-11-24.md)。

## 1. 它解决什么

单元测试跑在自研的 mini-DOM 上，看不到真实渲染。此前多次出现「报告完成 → 部署 → 人工验收才发现样式丢失、抽屉位置错误、页面空白」。这套配方在 Docker 官方 Playwright 镜像里跑真 Chromium，数据是自建的一次性专用库和合成的全权限账号，产物落在仓库之外。

与 `scripts/e2e-docker/` 的分工：那边是带受控通道与取证契约的发布验收工具；本目录是日常批次的轻量配方。

## 2. 前置条件

- Node 24 与 pnpm，并已执行 `pnpm install --frozen-lockfile`。
- Docker（本机 Linux 或 Docker Desktop）。
- 镜像 `mcr.microsoft.com/playwright:v<版本>-noble`，版本跟随仓库锁定的 `@playwright/test`；本机没有时先 `docker pull`，或用 `E2E_LOCAL_IMAGE` 指定已有镜像。
- 一个回环地址上可达的 PostgreSQL，以及对它有建库权限的连接串。仓库自带的 `infra/docker/compose.yaml` 即可。

## 3. 怎么跑

所有命令在仓库根目录执行。连接串只经环境变量传入。

### 3.1 一条命令跑完 e2e

```sh
E2E_LOCAL_ADMIN_DATABASE_URL='postgresql://用户:口令@127.0.0.1:5432/kingturf_dev' \
  node scripts/e2e-local/e2e-local.mjs run
```

流程：建专用库 → 迁移 → 自举两个合成账号 → 构建 web → 起容器 → 起同容器内的 API 与预览 → 灌 P1 演示数据 → 跑 `tests/e2e/p1-demo.spec.ts` → 停容器、删口令文件、删专用库。退出码即 Playwright 的退出码。

示例里的连接串指向开发库也没关系：工具只取它的服务器地址与凭据，从不连接它指向的库。

要换 spec 或传 Playwright 参数，写在 `--` 之后：

```sh
E2E_LOCAL_ADMIN_DATABASE_URL=… node scripts/e2e-local/e2e-local.mjs run -- tests/e2e/login-product-quality.spec.ts --grep 登录
```

### 3.2 起栈后反复使用

```sh
export E2E_LOCAL_ADMIN_DATABASE_URL='postgresql://用户:口令@127.0.0.1:5432/kingturf_dev'

node scripts/e2e-local/e2e-local.mjs up                      # 建库、自举、构建、起栈、灌演示数据，保持运行
node scripts/e2e-local/e2e-local.mjs e2e                     # 跑默认 spec
node scripts/e2e-local/e2e-local.mjs walk --viewport desktop # 全站走查
node scripts/e2e-local/e2e-local.mjs walk --viewport mobile --routes procurement,sales-orders
node scripts/e2e-local/summarize.mjs /tmp/kingturf-e2e-local/walk/desktop/report.json
node scripts/e2e-local/e2e-local.mjs seed                    # 重灌 P1 演示数据（幂等）
node scripts/e2e-local/e2e-local.mjs down                    # 停容器、删口令文件、删库
```

`up` 中途失败时，用 `down` 清掉已建的资源。`Ctrl-C` 会走同样的拆栈流程。已经构建过且产物未变时，`up --skip-build` 可以省掉构建。

一次 `run` 在本机约一分钟，其中 e2e 约 30 秒。

### 3.3 环境变量

| 变量                           | 必填 | 说明                                                                                               |
| ------------------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| `E2E_LOCAL_ADMIN_DATABASE_URL` | 是   | 目标 PostgreSQL 的连接串，必须是回环地址。只取服务器地址与凭据；建库、删库只连 `postgres` 维护库。 |
| `E2E_LOCAL_DATABASE`           | 否   | 专用库名。必须含独立的 test 段，不得是 `kingturf_dev` 或 `kingturf_test`；缺省随机生成。           |
| `E2E_LOCAL_OUT`                | 否   | 产物目录，必须在仓库之外。缺省 `/tmp/kingturf-e2e-local`。                                         |
| `E2E_LOCAL_API_PORT`           | 否   | 容器内的 API 端口，缺省 `3938`。                                                                   |
| `E2E_LOCAL_WEB_PORT`           | 否   | 容器内的预览端口，缺省 `4198`。                                                                    |
| `E2E_LOCAL_CONTAINER`          | 否   | 容器名，必须以 `e2e-harness-` 开头；缺省按时间戳生成。                                             |
| `E2E_LOCAL_IMAGE`              | 否   | Playwright 镜像；缺省与仓库锁定的 `@playwright/test` 版本一致。                                    |

两个端口只在容器内监听，宿主机上不开放任何端口，因此不会与其它会话的栈冲突。

### 3.4 专用库与账号

- **库名硬闸**（`db-target.mjs`）：库名必须含独立的 test 段（`kingturf_contest` 不算），否则直接报错退出；`kingturf_dev` 与 `kingturf_test` 是共享的开发库与 CI 库，一律拒绝；连接串的主机必须是回环地址。单元测试见 `db-target.test.mjs`。
- **自建自清**：`run` 与 `up` 各自新建一个专用库；`run` 结束时删除，`up` 起的库由 `down` 删除（`--keep-database` 可保留）。
- **账号**（`bootstrap.mjs`）：`admin` 与 `credit.approver` 两个合成全权限账号，登录名沿用 `scripts/seed_p1_demo.mjs` 与 `tests/e2e/p1-demo.spec.ts` 的默认值。口令随机生成，只写入产物目录下的 `creds.json`（权限 0600）。库里已有账号时拒绝自举。
- **演示数据**：仓库自带的 `scripts/seed_p1_demo.mjs`，在容器内经 API 写入。

## 4. 走查输出

`walk.mjs` 对每个路由记录：

1. 是否到达及耗时（`openRoute` 的写法：展开 `[data-nav-routes~="<路由>"]`，点 `[data-app-route="<路由>"]`，等 `aria-current` 与路由视图就绪）；
2. `pageerror` 与 `console.error` 去重清单；
3. 状态码 ≥400 的接口响应（方法、路径、状态码）；
4. 整页截图；
5. 基于 DOM 量测的布局检查：表格宽于裁剪祖先且不可滚动、中日韩文字被压成每行一两个字、按钮仍是浏览器默认外观、标题或表头被截断、文字被裁切、页面横向溢出；
6. 行级「查看」类触发器：按发现时的 testid、行 ID 和文字重新定位当前可见入口，验证抽屉的模态语义、遮罩、固定定位／贴顶靠右／视口内尺寸；保留打开时焦点进入、逐次 Tab 留在抽屉、Esc 关闭和关闭还焦判据，另实测末项 Tab 回首项、首项 Shift+Tab 回末项。关闭还焦仍在节点移除后最多等 1 秒，未回到真实触发器记为失败；记录截图与抽屉布局审计。
7. `collections`、`payments`、`quality-inspection` 的 `*-filter-open` 是 `OPEN` 状态按钮，按状态筛选交互验证：点击后检查 `aria-pressed`、对应端点的真实 GET／`state=OPEN` 响应、列表 `aria-busy=false` 与响应行 ID；再点击真实「全部」，等无 state 参数的 GET 和列表恢复，并保留筛选／恢复两张图。它们不被排除，也不再被当作抽屉等待。

参数：`--viewport`（`desktop` 为 1440×900，`mobile` 为 390×844 倍率 2，也可写 `宽x高[@倍率]`）、`--routes`（逗号分隔的子集；缺省取应用路由表全集）、`--out`、`--max-drawers`、`--tabs`。

缺省路由全集取自 `apps/web/src/shared/navigation.ts`。无法到达或被跳过的请求路由均算失败；受限账号应以 `--routes` 显式选择其可见范围。每个可见入口标识仍取一个代表行，不遍历所有数据行／页签；`--max-drawers` 限制本轮实际交互数，未执行的已发现入口会记为覆盖失败，不能借该参数得到空验收。

TD-TEST-040 起，路由到达与验收通过分别记录为 `reached` 和 `ok`，报告 `summary` 分列 `reached/passed/failed/skipped` 及抽屉／筛选数量。`drawer.error`、筛选错误、焦点／定位／布局不合规、页面／请求错误及首屏失败都会令命令退出 1；不再只用导航到达决定退出码。异常保留原记录，清理用的 Esc 不构成重试。

产物在 `E2E_LOCAL_OUT/walk/<视口>/`：`shots/` 是截图，`report.json` 是逐路由结果。指定 `--out` 时传基础目录，脚本还会再拼一次视口名。`summarize.mjs` 可列出原有路由／页面／抽屉信息；完整判定与筛选记录以 `report.json` 为准，也可用 `node scripts/e2e-local/walk-verdict.mjs <report.json>` 只读复核退出码。41 例判定／发现回归测试通过根 `pnpm test:session-network-tools` 接入。旧报告保留原貌，不把历史退出 0 改写成全部交互通过。

最终验收显式执行 `NODE_ENV=production pnpm --filter @kingturf/web build` 后再 `up --skip-build`；production 环境只给 Web 构建，合成 API／数据库栈继续沿用工具的 test 模式。保存 dist 全文件哈希并核对浏览器运行前后不变；`ci:local` 的 test 构建不能自动替代该 production Web 口径。

## 4.5 写流程冒烟（TD-TEST-024）

`write-smoke.mjs` 在同一套栈上从浏览器界面完成写操作：新建、发布、状态流转，并断言界面上可见的结果。与走查互补——那边只读，这边只写。与 `tests/e2e/p1-demo.spec.ts` 的分工：spec 断言固定的演示数据端态（含只读断言），本工具断言「新建的对象在界面上出现、状态按预期变化」。

```sh
E2E_LOCAL_ADMIN_DATABASE_URL=… node scripts/e2e-local/e2e-local.mjs up
node scripts/e2e-local/e2e-local.mjs write-smoke                          # 全部六条
node scripts/e2e-local/e2e-local.mjs write-smoke --flows lead,quote       # 只跑指定的
node scripts/e2e-local/e2e-local.mjs down
```

六条流程：`lead`（线索：新建 → 列表 → 认领 → 变更状态 → 改派）、`customer`（客户：新建 → 添加联系人 → 添加活动）、`procurement`（供应商含准入审核 → 询价 → 采购订单 → 登记收货，走采购子路由）、`manufacturing`（物料 / BOM / 工艺路线 新建草稿 → 发布）、`credit`（信用审查：设置额度 → 发起评估 → 审批人批准 / 拒绝）、`quote`（报价：新建过销售政策 → 批准 → 签发）。流程由 `write-smoke-flows.mjs` 定义，全部写操作经界面触发；接口只用于只读佐证和信用流程里明确标注的前置数据（令牌登录，与 seed 同款）。

- **账号**：主流程用 `admin`；信用审批用第二个合成账号 `credit.approver`（数据库触发器拒绝评估人自批，职责分离）。
- **报告**：产物在 `E2E_LOCAL_OUT/write-smoke/<时间戳>-<pid>/`（`report.json` 与 `shots/`）。步骤分三类——`must`（流程自身结果，失败即流程失败）、`probe`（缺陷检查项）、`fixture`（接口前置数据）。报告开头打印页面里量得的视口（TD-TEST-026 的教训：视口键写错时这行会暴露），并逐条缺陷附截图。
- **缺陷目录**：`write-smoke-catalog.mjs` 里每条目录项对应一个检查项，断言「正确行为」，不成立即记为已复现并留截图。已被其它提交修复的条目带 `fixedIn`（修复提交的 40 位 SHA，cause 写明「修复前是这样，已于某提交修复」），未复现时归「已修复、留作回归检查」组；没有单独修复提交的基线条目（WS-P2-03）归「基线即未复现、无修复提交」组；已另有台账的条目（TD-UI-009 等）在复现、未能判定或未检查时归对账组，未复现且带 `fixedIn` 时仍进「已修复」组；`--flows` 没跑到或流程中止未执行的条目单列「未检查」组，摘要逐组计数。修复落地后对应检查项自动转绿；运行不带修复的旧提交时它们会照常「已复现」——这是特性，不是噪音。
- **写后的数据**：跑过 `write-smoke` 的专用库不要再跑 `p1-demo.spec`（它断言信用决定恰为 3 行）。要跑 e2e 就 `down` 之后重新 `up`（拿全新库）。
- **退出码**：流程失败或 P1/P2 复现即为 1。当前在 3ba2e9e 上退出码是 1（信用两条写路径在界面不可用），属预期，缺陷修复后下降。

## 5. 为什么浏览器、预览、API 必须在同一个容器

预览代理对每个响应都回 `Connection: close`，登录后首屏约 70 个请求各需一条新 TCP 连接。若浏览器在容器里经中转去访问宿主机上的预览与 API，这批连接经过 Docker 的地址转换时个别握手包会丢，要等重传才成功，卡住的请求建连可达 15 秒，而服务端 42 毫秒就已答完。表现为 `p1-demo.spec.ts` 随机失败 1 到 2 例，失败用例每轮不同，页面停在「登录成功，正在并行加载业务数据…」。

把三个进程放进同一个网络命名空间后只有数据库连接穿过 Docker，仓库原配置连续三轮 11 / 11。数据见 [UX 波次真浏览器验收](../evidence/ux-real-browser-verification-2026-11-24.md)。

## 6. 已知限制

- ~~**只覆盖读路径。** 新建、发布、状态流转等写操作没有在浏览器里点过（TD-TEST-024）。~~ 写流程冒烟（4.5 节）已补上读写两条路径的浏览器级验证；权限裁剪形态等缺口见下。
- **写冒烟只覆盖六个域的六条主链。** 生产执行（工单流转、报工、领料、入库）、发货签收、催收法务、收款核销、佣金、风险处置等写路径不在其中；领料选错批次的 500 已另行登记（TD-MFG-010）。
- **只有一个全权限账号（外加一个信用审批账号）。** 按权限隐藏或裁剪的呈现形态没有覆盖。
- **只有 Chromium，只有预设的两种视口。** 没有 Firefox、WebKit，没有平板宽度。
- **布局检查是启发式的。** 能稳定抓到第 4 节列出的几类；重叠、对齐、配色、间距这类观感问题要靠人看截图。
- **e2e 只在合成账号与演示数据上跑。**
- **工作台首屏等全部加载器完成才渲染**，单个请求卡住即整页停住（TD-WEB-014）。本配方绕开了它的触发条件，没有修它。
- **`tests/e2e/p1-demo.spec.ts` 的 `openRoute` 在时序上偏脆。** 导航分组展开是 220 毫秒的过渡，helper 在展开后约 60 毫秒就点条目；走查脚本已改为等过渡结束，spec 本身未改。

## 7. 安全与清理

- 仓库内不含任何口令、密钥、cookie。连接串与口令只经环境变量传入；传给容器的变量按名字转发，值不进命令行参数，因此不会出现在进程列表里。子进程输出逐行脱敏后才回显。
- Playwright 失败时保留的 `trace.zip` 会明文记录登录时填写的口令与会话 cookie。产物目录因此强制在仓库之外，这些文件不要入库或外发。
- 清理只按本工具自己的容器名（前缀 `e2e-harness-`）进行；栈内进程随容器整体启停，宿主机上没有常驻进程。不使用按模式杀进程。
- 口令文件与状态文件在拆栈时删除。
- 容器以宿主机用户的身份运行（镜像里有这个 uid 的账号时），写进产物目录的截图、日志、报告仍归宿主机用户，可以随时查看和删除。镜像里没有该 uid 时退回 root，并在每次容器内命令之后把产物目录的属主改回宿主机用户。

## 8. 文件清单

| 文件                                          | 职责                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `e2e-local.mjs`                               | 命令入口：`run` / `up` / `e2e` / `walk` / `write-smoke` / `seed` / `down` |
| `db-target.mjs`                               | 数据库目标守卫：库名硬闸、维护连接、专用库连接串                          |
| `db-target.test.mjs`                          | 守卫的单元测试（`node --test`，不连数据库）                               |
| `database.mjs`                                | 专用库生命周期：`create` / `drop` / `migrate` / `status`                  |
| `bootstrap.mjs`                               | 自举合成全权限账号，写 0600 的 `creds.json`                               |
| `stack.mjs`                                   | 同容器栈：起容器、起 API 与预览、等就绪、灌数据、跑 e2e 与走查、拆栈      |
| `exec.mjs`、`redact.mjs`                      | 子进程封装与输出脱敏；按名转发的环境变量缺失时直接报错                    |
| `exec.test.mjs`                               | docker 参数解析的单元测试（不启动 docker）                                |
| `vite.preview.config.mjs`                     | 预览配置：与 `apps/web/vite.config.ts` 的 preview 段同款，端口可配置      |
| `pw.config.ts`                                | Playwright 包装配置：改用自带 Chromium，产物指向仓库之外                  |
| `walk.mjs`、`walk-audit.mjs`、`summarize.mjs` | 全站走查、页内审计、报告汇总                                              |
| `walk-interactions.mjs`、`walk-verdict.mjs`   | 稳定入口／筛选和抽屉交互、浏览器与离线共用的严格结果判定                  |
| `walk.test.mjs`                               | 41 例 Node 回归：错误抽屉、焦点／布局、筛选、缺失覆盖与真实 CLI 退出码    |
| `write-smoke.mjs`                             | 写流程冒烟入口：登录、逐流程执行、证据收集、缺陷汇总（4.5 节）            |
| `write-smoke-flows.mjs`                       | 六条写流程的步骤定义                                                      |
| `write-smoke-kit.mjs`                         | 浏览器操作封装：导航、抽屉、表单、提交并等待写响应、列表行、佐证读取      |
| `write-smoke-catalog.mjs`                     | 缺陷目录：每条对应一个检查项，修复落地后检查项转绿                        |
