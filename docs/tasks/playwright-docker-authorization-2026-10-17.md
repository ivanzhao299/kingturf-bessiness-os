# Docker Playwright 前置补跑授权引用（R7，2026-10-17）

## 开工基线与时序

分支 `harnessing`，开工亲核 HEAD `d801237548981d2caa02c22b77f3e774447392b1`，`git status --short` 为空、无外来 untracked。S4 实施及交验文档已收口；最终完整 `pnpm ci:local` 实际 exit0 / 191602.5ms，日志 `/tmp/kingturf-batch4-acceptance-final-head-ci-2026-10-17.log` 首尾同 HEAD、clean=true、unchanged=true，API126/17242、Web14/313、config71、结构0/29、预算11991/1898、audit0。S4 整批人工验收仍待交付，不预填通过；下列人类后继授权明确以前置实施收口为条件，不以本任务启动代替整批验收。

原始人类授权亲读：协调会话 `01a12db5-380f-79c2-9329-8bcc500a27c8`，用户消息 `01a147c7-c45d-7ab1-96f0-1cca53b6e426`。同会话用户对九旧 spec 的专项回复 `01a147b3-7265-7193-ae34-c4360b95f5f1` 明确“九份暂不改；适配、变异及补跑合并到阶段5前”。两者共同限定后继工作；本次先库存、通道准备和映射，不先改内联 fixture/旧断言，不重复索取已授许可；有具体边界冲突则带文件/行与实测停报。

## 本次执行切片

本提交仅授权文档、索引与计划日志，独立回滚点为父提交 d801237；随后逐行盘点全部12份 spec（含 .mjs）与两配置，分类先落盘，准备本地 Chrome 固化镜像并核实际 tag/id/version。主代理唯一写入/执行，子代理仅只读独立核验。分类与 S4 所需逐处旧→新映射交协调事实检查后再续已授权 A→B；C 一律不跑。配置、九旧 spec 此刻不改，业务源码零改动，不扩一般阶段5。最终最后提交须稳定干净 HEAD 完整 CI 实际0。

## 人类完整 Docker 任务原文

继续 KingTurf Harness 改造。本次正式授权：阶段 5 前置子任务——使用 Docker Playwright 通道补跑浏览器 E2E（履行批次 3 验收时登记的补跑义务）。

【先读】docs/evidence/playwright-docker-channel-2026-10-17.md（通道核查证据与复现命令，验收人实测）、docs/exec-plans/active/harness-migration.md §0/§0.5、docs/GATES.md、tests/e2e/ 全部 spec 与 playwright.config.ts。

【当前基线】分支 harnessing。开工第一件事：本授权独立 docs 提交落盘（R7）并记 §7。

【时序前置条件（先核后动）】

1. 确认 S4 实施会话已收口：工作树干净、无并行 untracked（曾见 harness-batch4-s4-design-\*.md 半成品）、HEAD 稳定。若 S4 仍在进行，等待其收口后再开工——S4 改会话载体，登录/会话类夹具在其落地前后语义不同，先跑会白跑。
2. S4 落地后的补跑才算数：若 S4 已合入，本批补跑即覆盖新会话行为；若 S4 撤销或未启动，按当前代码跑。两种情况都在证据中写明基线 SHA。

【通道准备（按核查证据执行）】

1. 固化镜像：起容器 `npx playwright install chrome`（root，实测 rc=0）后 `docker commit` 为本地 tag（建议 kingturf-e2e:pw1.62.1-chrome），避免每次补装；镜像 tag 与 Chrome 版本落盘证据。
2. 网络形态：宿主 `vite preview --port 4173 --strictPort --host 0.0.0.0`（CLI 参数不改仓库）；容器 `--add-host` + `KINGTURF_BASE_URL=http://<网关IPv4>:4173`（网关以 getent ahostsv4 实测为准，核查时为 192.168.65.254）；容器内 `no_proxy='*'`；playwright.config.ts **一字不改**。
3. 挂载仓库（含 node_modules），`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`。

【spec 分類盘点（先落盘再执行）】
盘点 tests/e2e/ 全部 spec（含 .spec.mjs），按依赖分类并落盘：

- A 本地 preview 即可（纯前端断言）；
- B 需后端 API+PG 种子（宿主起 API，容器经网关 IP 访问；种子用 pnpm demo:seed 或 spec 自备夹具，写明）；
- C 需生产站点或特殊授权（如 production-\*）——**本批一律不跑**，逐个列明依赖与所需授权，列为待决项上报。
  分类依据（每个 spec 一行：依赖的 baseURL/后端/账号/数据）落盘证据后，先跑 A、再跑 B。

【执行与证据纪律】

1. 每个 spec 独立记录：命令、退出码、耗时、失败截图/trace（config 已 retain-on-failure）；失败不重写不跳过——失败史如实保留，修复属行为问题走 TD- 登记不顺手修（R4）。
2. 全量通过后按 config 现状连续再跑一轮全量（共两轮），记录两轮结果（稳定性证据；阶段 5 终验要求连续 3 次，本轮先备两轮，终验时补第三轮）。
3. C 类待决项与 A/B 结果一起落盘验收证据（docs/evidence/，含通道环境、镜像 tag、分类表、逐 spec 结果、两轮记录），登记 docs/index.md。

【恒定约束（违反即返工）】

1. 不 push、不部署、不修改 .github/workflows/；**不触碰生产**（C 类 spec 不跑，等单独授权）。
2. playwright.config.ts 与 tests/e2e/ 的 spec 文件一字不改；夹具若因 S4 后状态需要适配，逐处登记旧→新并做变异实测（同批次 3 纪律），独立提交。
3. 业务源码零改动；发现疑似 bug 只登记 TD-。
4. 不动 S4 及其他会话的未提交文件；本批只新增证据文档与必要的环境脚本（若固化启动命令为脚本，放 scripts/e2e-docker/ 并入版本管理）。
5. 完成即停：汇报最终 HEAD、镜像 tag、A/B 逐 spec 结果与两轮稳定性、C 类待决清单、回滚点，等待人工验收；不自行启动阶段 5 其余任务（补测/覆盖率/收官归档另授权）。

## 恒定保护与证据

不读/回显真实 .env、密码、token、proof、完整 Cookie 或 DSN；镜像准备不挂载 PG/会话材料入镜像层。已有 tag 先核身份，禁止覆盖他人资源；不 push 镜像、不主机 sudo、不生产导航/curl、不放宽 Secure/Origin/Chrome 安全旗标。不改变 Playwright 配置、业务语义、依赖、workflow，不部署/dispatch。逐 spec 命令、真实 exit/耗时及失败 trace/截图保留，两轮仅在全部可执行 A+B 第一轮通过后连续进行；未跑不标绿。
