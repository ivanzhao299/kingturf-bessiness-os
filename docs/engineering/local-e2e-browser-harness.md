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
6. 行级「查看」类触发器：抽屉是否以浮层出现、打开时焦点是否进入对话框、连按 Tab 是否留在对话框内、Esc 是否关闭、关闭后焦点是否回到触发器（焦点归还发生在抽屉节点移除之后，实测约 30 毫秒，所以移除后最多再等 1 秒）；抽屉截图与抽屉内的同款布局检查。

参数：`--viewport`（`desktop` 为 1440×900，`mobile` 为 390×844 倍率 2，也可写 `宽x高[@倍率]`）、`--routes`（逗号分隔的子集；缺省取应用路由表全集）、`--out`、`--max-drawers`、`--tabs`。

缺省路由全集取自 `apps/web/src/shared/navigation.ts`。账号导航里没有入口的路由记为跳过；用 `--routes` 显式点名而打不开时算失败，退出码为 1。

产物在 `E2E_LOCAL_OUT/walk/<视口>/`：`shots/` 是截图，`report.json` 是逐路由结果。`summarize.mjs` 把报告压成一张表，并单独列出未到达的路由、≥400 响应、控制台异常与抽屉焦点问题。

## 5. 为什么浏览器、预览、API 必须在同一个容器

预览代理对每个响应都回 `Connection: close`，登录后首屏约 70 个请求各需一条新 TCP 连接。若浏览器在容器里经中转去访问宿主机上的预览与 API，这批连接经过 Docker 的地址转换时个别握手包会丢，要等重传才成功，卡住的请求建连可达 15 秒，而服务端 42 毫秒就已答完。表现为 `p1-demo.spec.ts` 随机失败 1 到 2 例，失败用例每轮不同，页面停在「登录成功，正在并行加载业务数据…」。

把三个进程放进同一个网络命名空间后只有数据库连接穿过 Docker，仓库原配置连续三轮 11 / 11。数据见 [UX 波次真浏览器验收](../evidence/ux-real-browser-verification-2026-11-24.md)。

## 6. 已知限制

- **只覆盖读路径。** 新建、发布、状态流转等写操作没有在浏览器里点过（TD-TEST-024）。
- **只有一个全权限账号。** 按权限隐藏或裁剪的呈现形态没有覆盖。
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

| 文件                                          | 职责                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `e2e-local.mjs`                               | 命令入口：`run` / `up` / `e2e` / `walk` / `seed` / `down`            |
| `db-target.mjs`                               | 数据库目标守卫：库名硬闸、维护连接、专用库连接串                     |
| `db-target.test.mjs`                          | 守卫的单元测试（`node --test`，不连数据库）                          |
| `database.mjs`                                | 专用库生命周期：`create` / `drop` / `migrate` / `status`             |
| `bootstrap.mjs`                               | 自举合成全权限账号，写 0600 的 `creds.json`                          |
| `stack.mjs`                                   | 同容器栈：起容器、起 API 与预览、等就绪、灌数据、跑 e2e 与走查、拆栈 |
| `exec.mjs`、`redact.mjs`                      | 子进程封装与输出脱敏；按名转发的环境变量缺失时直接报错               |
| `exec.test.mjs`                               | docker 参数解析的单元测试（不启动 docker）                           |
| `vite.preview.config.mjs`                     | 预览配置：与 `apps/web/vite.config.ts` 的 preview 段同款，端口可配置 |
| `pw.config.ts`                                | Playwright 包装配置：改用自带 Chromium，产物指向仓库之外             |
| `walk.mjs`、`walk-audit.mjs`、`summarize.mjs` | 全站走查、页内审计、报告汇总                                         |
