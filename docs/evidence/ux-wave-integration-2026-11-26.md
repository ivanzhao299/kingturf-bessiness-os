# 2026-11-26 业务波次集成验收

## 1. 当前交付边界

本页记录主协调已经实际执行的集成验证。基础候选为 `514d8f4e2948dc2c51bf8dfd73f5f4c62eaa792e`，树为 `c7b2a7a784502ada50f2dc36837995807f50883a`。该提交已推送 main，供镜像构建使用；本页所述阶段尚未部署生产。

原生产业务版本 L 为 `5dc88e5c922ff731e2cfeb949b28c5cd8c333032`。原恢复候选 R 为 `ecb3ded74dde454725265f0c7ea354a4e80ef9b5`，包含 L 的业务字节与最终 81 条迁移。R/B 的首轮镜像构建均在漏洞扫描失败，未生成可消费的原始恢复物料。TD-REL-011、013、014、015 的后继控制、运行镜像和真实恢复验收仍是发布前置；没有把合成测试或本页浏览器结果替代真实恢复。

主协调没有生产登录凭据和生产库权限。线上只能复核公开端点、发布回执和静态资源；本页浏览器数据全部来自一次性合成测试库。

## 2. 完整 CI

在上述干净提交，以 `NODE_ENV=test`、回环 `5438/kingturf_test_coordrel`、`kingturf` 角色经 heavy 串行运行 `pnpm ci:local`。2026-11-26 09:34:06–09:50:07 UTC，退出 **0**，耗时 **960.72 秒**；前后 HEAD 相同、受跟踪工作树干净。

| 检查                                                                      | 实际结果                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| 发布运维测试                                                              | 242/242，零 skip                                |
| API                                                                       | 212 文件，18,387/18,387                         |
| Web                                                                       | 67 文件，1,064/1,064                            |
| config                                                                    | 2 文件，71/71                                   |
| database                                                                  | 4 文件，79/79                                   |
| domain                                                                    | 5 文件，26/26                                   |
| types                                                                     | 2 文件，5/5                                     |
| UI                                                                        | 9 文件，101/101                                 |
| 格式、文档、结构、依赖边界、能力清单、lint、typecheck、覆盖率、构建、审计 | 完整链退出 0                                    |
| 迁移状态                                                                  | 81 条 FULLY_MATCHED，无 pending/drifted         |
| 登录关键路径 gzip                                                         | JS 11,751 B / 12,000 B；CSS 25,640 B / 27,000 B |

CSS 计量包含 HTML 静态 stylesheet 与 manifest 入口静态可达 CSS 的去重并集；工作区继续延迟加载。不是旧脚本漏计的 CSS 0 B。

原始回执位于 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/ci-514d8f4/`，日志 SHA-256 为 `29b12f61a5f3ebf1d35fec73651ca7535eac316909cd565b4840ec60dc40b89b`。前两轮失败及各自的最小夹具修正保留于 [受控恢复证据 §10–11](forward-recovery-2026-11-26.md#10-主协调的-81-清单集成复验)，不覆盖失败历史。

## 3. 真浏览器自动验收

复用该 CI 生成的 Web 构建，使用仓库 `scripts/e2e-local/e2e-local.mjs` 启动浏览器、预览和 API 同容器栈。后继 TD-GATE-007 因果实验确认这份构建继承了 `NODE_ENV=test`，因此本节保留为 test 构建上的行为验证；正式 production 字节的浏览器验收须重新执行，不能据本节放行镜像产物。管理连接串只取主检出 `.env` 的 `DATABASE_URL` 行，经环境传递；工具只连接维护库建立专用库，不访问原连接串指向的开发库。合成口令不入库、不出现在命令行。

产物根为 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/browser-514d8f4-20261126T095307Z/`。专属容器 `e2e-harness-integration-514d8f4-20261126t095307z`，专用库 `kingturf_test_integrated_514d8f4_20261126t095307z`。

| 步骤         | 实际结果                                                        | 原始日志或报告（相对产物根）            |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| P1 第 1 轮   | 11/11，34.2 秒                                                  | `logs/p1-1.log`                         |
| P1 第 2 轮   | 11/11，33.2 秒                                                  | `logs/p1-2.log`                         |
| P1 第 3 轮   | 11/11，33.5 秒                                                  | `logs/p1-3.log`                         |
| 桌面全站走查 | 1440×900，路由45/45、零路由失败/跳过；抽屉探针5次超时           | `walk/desktop/desktop/report.json`      |
| 手机全站走查 | 390×844，路由45/45、零路由失败/跳过；抽屉探针5次超时            | `walk/mobile/mobile/report.json`        |
| 写流程冒烟   | 六流程通过，must 32/32；32 次 probe 为 clean，覆盖 24 个目录 ID | `write-smoke/MWXDS1LB-1434/report.json` |
| 拆栈         | down 退出 0，专属容器/库已删除，creds/state 文件已删除          | `logs/down.log`、`result.json`          |

P1 三轮先执行，写流程最后执行，避免信用写数据改变 P1 固定种子断言。写冒烟中的 409、400、403 为目录中的预期拒绝负例；不能把这些请求说成没有发出，也不能把它们算作未预期失败。未读取或入库可能包含认证材料的 Playwright trace。

运行结束前后 HEAD 与受跟踪树不变，Web 构建的全部文件 SHA-256 映射相同。上述结果不覆盖生产登录态或所有受限角色。

### 3.1 独立截图目检与自动计数的缺口

独立代理随后只读检查全部 **133 张现存原图**：桌面 45 页+21 抽屉、手机 45 页+21 抽屉、写冒烟信用场景 1 图。通过 37 张完整分片 contact sheets 覆盖全部原图，另直接读取 21 张原 PNG 和 6 张原分辨率局部图；没有启动新浏览器、重做写链或读取凭据/trace。三份报告与全部原图的聚合 SHA-256 前后均为 `8dc3a125138dfc617e52ecdb576b9087678ae69c728d5fd5c537a7dc13a01550`。逐图清单、查看方式和局部图在产物根 `visual-review-g5/review.json` 及同目录。

目检发现三类可见现象，按 R4 分别登记 TD-UI-021/022/023：佣金及经营风险台账的选择框遮住行首编号或表头；审计时间线的长标识符过度换行；生产/质检文件卡「仅下载」折成两行。金额与状态徽章完整可读，没有据此认定数据丢失或功能阻断；三者均未与改前构建对照，新增与否、根因仍待核实。本批不顺手改这些页面。

**路由到达计数不等于全部抽屉通过。** 两份报告各有 5 个 `drawer.error`：collections 筛选、payments 筛选/详情、quality-inspection 筛选/详情。筛选探针等 `.detail-drawer` 超时 8 秒，另两详情探针未能找到当前可见的 `data-e2e-pick` 节点，超时 30 秒；没有对应截图。脚本仍退出 0、summary.failed 仍为 0，登记为 TD-TEST-040 并独立修复。必须分别核对工具选择器/重渲染和产品真实行为，不能直接将这些探针错误冒称产品故障，也不能以路由45/45忽略它们。这与固定 GLM 工作流中的供应商 mini-DOM 初焦 TD-TEST-035 是不同任务。

手机客户信用卡下半及供应商比较卡下部在截图视口之外；库存流水右侧来源列在静态图中截断，未验证横向滚动。写冒烟仅保存一张信用图，其余流程的成功依据是实际 JSON/请求/界面断言，不能说全部写状态均有截图目检。

### 3.2 TD-TEST-040：严格交互判定与 production Web 独立回归

本节为隔离工具批的实际回执，基线 `f2bcf458f8ad5d992f43bd2b85e94aa480ea00fc`，工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave4/walk-drawer-gate`、分支 `fix/w4-walk-drawer-gate`。源码修复为 `c2375ed339606eee684089b6ebcd6249b0912e65`，测试与根命令接线为 `2525704085fefe412061ef48b27e7793bbc48684`，均标 `[未测试]`（未运行完整 `ci:local`）。只改 `walk*.mjs`、必要同目录测试、`test:session-network-tools` 和本批授权文档；应用业务、UI、SQL、权限、固定 GLM 的 TD-TEST-035 均未改。第 3 节旧轮报告和原 10 个错误保持原貌。

**根因与修复。** 三处 `*-filter-open` 实际是 `FinFilters` 的 OPEN 状态按钮，具有 `aria-pressed`，并不打开抽屉；旧 `/-open$/` 将它们误分类。点击后真实 GET 过滤列表，重渲染替换或移除了随后「查看」节点，一次性 `data-e2e-pick` 标记随之失效。最终判定又在捕获 `drawer.error` 后无条件令 `row.ok=true`，只计路由到达，遗漏抽屉错误及原焦点／几何／布局判据。

新工具将状态筛选保留为真实交互：点击 OPEN、检查对应 GET 的 `state=OPEN` 与成功响应、按钮选中、列表结束加载、DOM 行 ID 与响应一致；再点击真实「全部」，等无 state 的 GET 与列表恢复，保存两态截图。详情按 testid、行 ID、文字重新获得当前「查看」，仍实测遮罩、模态语义、固定定位、贴顶靠右和视口内尺寸、初焦、原四次 Tab、Esc 关闭及 1 秒内还焦，另验证末项 Tab 回首项和首项 Shift+Tab 回末项。原布局审计阈值未改。错误清理用的 Esc 不作重试；错误、缺失交互、跳过／未达路由、页面／请求错误及首屏失败都会令共用判定器返回退出 1，`reached` 与 `passed` 分开计数。

**红绿证据。** 将旧 `walk.mjs` 最终决策块原文用于原桌面／手机报告，各有 5 个 `drawer.error`，旧块仍返回 0；要求返回 1 的两例实际均以 `0 !== 1` 失败，决策块 SHA-256 为 `03d71faa30989d88ddc6ff8d3b93666bbff87319cd0235201b5870deed4dd528`。最初辅助探针漏传 `preset` 得到 `ReferenceError`，不算红证据，原失败日志仍保留；补齐探针上下文后的有效红证据另存。随后在自己的初轮同容器栈实跑旧工具三路由，再现 3/3 到达、5 次错误、退出 0；新工具同三路由为 3/3 通过、3 真抽屉与 3 筛选、零错误。该初轮使用工具默认 build，未以显式 production 口径验收；拆栈后才进行下述最终独立轮。

新增 41 例 Node 正负回归，覆盖抽屉错误、几何／遮罩／焦点／Tab 边界／Esc／还焦／布局、真实筛选响应、缺失／重复／未计划交互、页面／请求／首屏错误和发现分类；真实子进程 CLI 的「已到达路由含错误抽屉」必须退出 1。根 `pnpm test:session-network-tools` 实跑 **110/110、零失败／跳过**；冻结源码的 lint、typecheck、structure:check 均退出 0。没有用成功默认值、删断言或调阈值消除失败。

**最终浏览器轮。** 显式经 heavy 执行 `NODE_ENV=production pnpm --filter @kingturf/web build`，保存全部 dist 文件哈希，再建全新专用栈 `up --skip-build`。production 环境只给 Web 构建；API 和数据库仍按原 e2e-local 的 test 模式运行。登录预算实测 JS **11,752 B**、CSS **25,640 B**，本轮没有修改预算或 `ci:local`。该口径独立于第 3 节复用的旧 test 构建，也未把主协调另批的 TD-GATE-007 改动带进本树。

| 项目                           | 桌面 1440×900                    | 手机 390×844、DPR 2 |
| ------------------------------ | -------------------------------- | ------------------- |
| 请求／到达／通过路由           | 45／45／45                       | 45／45／45          |
| 失败／跳过                     | 0／0                             | 0／0                |
| 真详情抽屉／抽屉错误           | 23／0                            | 23／0               |
| OPEN 筛选／筛选错误            | 3／0                             | 3／0                |
| 原逐次 Tab／新增双向边界检查   | 92／46                           | 92／46              |
| 筛选与恢复的真实 GET           | 6                                | 6                   |
| 截图                           | 74（45 页+23 抽屉+6 筛选／恢复） | 74（同口径）        |
| 走查退出码／报告离线复核退出码 | 0／0                             | 0／0                |

三处 OPEN 响应均为 0 行；恢复「全部」后 collections 仍 0 行、payments 为 2 行、quality-inspection 为 1 行。收款／质检真实「查看」在列表恢复后重新定位并实际打开；collections 无数据，未覆盖催收详情。保持原 45 路由，无删路由或跳过。覆盖每个已发现可见入口的一个代表行，未遍历全部记录／非活动页签；不能外推非空 OPEN 结果、受限角色、生产登录态或写链。本树未重跑完整 CI、P1 spec、写流程冒烟，完整集成门禁由主协调串行执行。

**截图目检。** 实际检查本轮 **148/148 原图**：读取 41 张完整分片 contact sheets（桌面 20、手机 21，共 116+168 个连续无缺口分片），另直接读 6 张收款／核销运行／质检详情原 PNG 和 4 张原分辨率局部图。三处筛选／恢复状态、恢复出的收款与质检详情均有图；未把静态图冒称键盘或写链实测。原 TD-UI-021/022/023 的选择框遮挡、审计窄标识符和文件卡「仅下／载」仍可见；选择框同形遮挡在手机合同编号上也可见，已报主协调，未改这些页面。

新恢复的小屏质检详情图 `e2e-production/walk/mobile/shots/quality-inspection--qi-inspections-drawer.png` 中，测量值 `12000` 折成 `1200 / 0`、判定「合格」折成两行；桌面同字段完整单行。此项以 `TD40-VR-01` 报主协调，关联后继登记项 TD-UI-024（P3 呈现），未顺手修产品。旧轮没有该抽屉图，不能判断引入时点；现有 DOM 启发式未报出该数值折行，严格 DOM／交互结果通过不代表目检没有问题。客户信用卡与供应商详情下半仍在抽屉视口之外，横向滚动未目检，不扩大静态图的覆盖结论。

**稳定性与清理。** 全部 **49 个 dist 文件**的 SHA-256 映射在最终双视口运行前后完全相同。六个冻结工具／测试／package 文件与 `2525704` 提交字节一致，API、Web、UI、database、domain、types、config 七个产品目录的 Git tree 与基线相同。初轮 `e2e-harness-w4-walk-drawer-gate`／`kingturf_test_w4_walk_drawer_gate`、最终轮 `e2e-harness-w4-walk-drawer-production`／`kingturf_test_w4_walk_drawer_production` 均 down 退出 0；随后按精确容器名检查不存在，经参数化 `pg_database` 只读查询确认两库均不存在，两输出目录的 creds/state 均不存在。未读认证文件内容或 trace，未操作其它会话资源。

独立产物根为 `/home/jinhuit/Kingturf/kingturf-coord/wave4/walk-drawer-gate-artifacts/`，全部重活经 heavy。可复核材料如下（路径相对该根）：

- 原实现／原报告副本：`legacy/`；有效红证据 `logs/legacy-report-red-verified.log`；首次无效探针 `logs/legacy-report-red.log`。
- 自有旧三路由：`e2e/walk-legacy/desktop/report.json`；新三路由：`e2e/walk-fixed-probe/desktop/report.json`；初轮 down：`logs/down-probe.log`。
- 新增 41 例：`logs/walk-unit-first.log`；根 110 例：`logs/session-network-tools-final.log`；源码门禁：`logs/source-final-gates.log` 与同前缀分项日志。
- 显式构建／起栈：`logs/production-build.log`、`logs/up-production.log`；最终走查：`logs/walk-production-desktop.log`、`logs/walk-production-mobile.log`。
- 严格原始报告：`e2e-production/walk/desktop/report.json`、`e2e-production/walk/mobile/report.json`，各同级 `shots/`；计数复核 `browser-result.json`。
- 全 dist 字节映射：`logs/production-dist-before.json`、`logs/production-dist-after.json`；冻结源码映射：`source-stability.json`。
- 逐图目检／原图 SHA／完整分片索引：`visual-review/review.json`、`visual-review/contact-index.json` 与同目录 PNG；最终 down／独立清理确认：`logs/down-production.log`、`cleanup-result.json`。

回滚工具修复时依次回退测试接线 `2525704`、源码 `c2375ed`；会恢复旧假绿缺陷，不能继续用旧退出 0 声称抽屉验收通过。本节只交付工具修复及独立定向证据，不宣称发布或受控恢复完成。

## 4. 首轮真实镜像发布的扫描阻断

通过现有 `release-images.yml`、ref main，分别明确选择 R 和 B。两次运行的固定导出控制均为 `514d8f4`，没有把 workflow 的 head SHA 冒称 R 的源码 SHA。

| 类型 | 输入源码                                   | GitHub run                                                                                   | 实际结论                                                               |
| ---- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| R    | `ecb3ded74dde454725265f0c7ea354a4e80ef9b5` | [45796321430](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/45796321430) | API/Web 已构建推送；API HIGH/CRITICAL 扫描失败，后续恢复物料导出未执行 |
| B    | `514d8f4e2948dc2c51bf8dfd73f5f4c62eaa792e` | [45796346483](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/45796346483) | API/Web 已构建推送；API HIGH/CRITICAL 扫描失败，后续恢复物料导出未执行 |

调度、完整 job 日志和最终状态保留于 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/image-builds-514d8f4/`。未因镜像已经 push 就将失败运行作为 approved 来源。

主协调用相同 `aquasec/trivy:0.70.0`，对 B 的真实 API 根摘要 `sha256:702ff8214cd4a41b994f1a0a82a4ca03e605e3b9fdc930f1101509d4f9a1af17` 重新扫描并保留 JSON。严重度仍为 HIGH/CRITICAL、退出阈值仍为 1；该诊断实际退出 1。报告包括 Debian 12.15 的 util-linux、PAM、systemd、gzip、ncurses、perl、zlib 等包，以及镜像中的 pnpm 和其工具链依赖。多个 OS 项没有该发行版的 fixedVersion；项目 `pnpm audit` 通过不能代替镜像扫描。

完整报告、安全摘要和执行记录在上述根的 `local-scan/`。后继运行封装修复另批登记为 TD-REL-015，须真正消除受影响组件并重新构建、扫描、验证生产启动和原迁移 CLI；扫描排除、删除包元数据、降低严重度或伪造 PASS 均不能解除本阻断。新的 R 若有必要调整封装，将使用新的源码 SHA，保留本次失败候选历史，不复用其身份。

## 5. production 构建口径纠正（TD-GATE-007）

运行镜像代理对账时发现，§3 的 49 文件清单与真实 B0 production 镜像不同。主协调先登记 TD-GATE-007，再于同一 `514d8f4` 源码、同一构建目录与 Node v24.19.0 上完成控制实验：离线 frozen 安装后，先 `NODE_ENV=test`、再 `NODE_ENV=production` 执行相同 Web build 命令，唯一实验变量是 `NODE_ENV`。2026-11-26 10:47:40–10:47:45 UTC，两次 build 均退出 0，前后 HEAD 不变、受跟踪树干净；原 CI 产物已另存原字节。

| 测量                              | test 构建   | production 构建 |
| --------------------------------- | ----------- | --------------- |
| 全文件数                          | 49          | 49              |
| JavaScript 原字节合计             | 1,393,307 B | 935,652 B       |
| JSX `fileName` 开发元数据出现次数 | 2,580       | 0               |
| 绝对构建目录出现次数              | 2,580       | 0               |

两构建有 18 个 hash 命名路径变化，另 `index.html` 与 `.vite/manifest.json` 同名但原字节不同。production 清单的全部 49 项与真实旧 B0 Web 镜像、运行层修订 `35cc30b` Web 镜像逐文件 SHA-256 相同，缺项与不同字节均为零；旧 B0 镜像另有一份 `50x.html`，不把文件数差异混作 Web 发行产物失配。旧浏览器清单与该 production 清单仍不相同，未覆盖或改写旧回执。

原始实验、三份构建目录和映射位于 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/build-mode-514d8f4/`：`result.json`、`test-map.json`、`production-map.json`、`image-map-comparison.json`、`build-test.log`、`build-production.log`、`original-ci-test-dist/`、`test-dist/`、`production-dist/`。

独立修复提交 `775445d` 将 `ci:local` 中的 build 子命令改为 `NODE_ENV=production pnpm build`；父 shell 的测试、数据库 guard、迁移及后续审计仍为 `NODE_ENV=test`。本次格式与 diff 检查退出 0；该提交尚未跑完整 `ci:local`，最终集成须在 production 构建上重新执行浏览器验收并与实际镜像逐文件对账。没有把镜像改成 test 构建来满足旧清单。

## 6. 新 R 的运行封装修订与来源白名单

主协调依据 TD-REL-015 已登记的技术裁定，采纳运行封装最终源码 `158baf69fecb51264063992dbd2601e20c6aa17b`。其本机真实运行验证和独立审查均完成：69b 阶段 GNU wget 把原健康检查变为 HEAD、得到 401/退出6，最终158移除多余包，恢复 BusyBox GET；原 Compose/API/nginx 契约保持。原 CLI、81 SQL、TLS 正负例、两种 UID 的附件读写、写闸、健康检查与停机实测通过。本机运行与扫描回执仍属于该封装验证，不是新 R 的成功 GHR 物料或真实恢复回执；完整分支证据沿 forward-recovery 文档收尾。

在原 R `ecb3ded74dde454725265f0c7ea354a4e80ef9b5` 上仅按原顺序挑入四笔封装修复，得到新的 R **`32e705a9a835e577b528fd6ff6d72c06b449ca35`**，保留旧 R 的扫描失败身份和历史。相对原 R，差异恰为 `infra/docker/Dockerfile.api-preview` 与 `infra/docker/Dockerfile.web-preview`，两文件原字节均等于已审查的158源码；相对 L，完整白名单为原四条 SQL、八处 pin 加两份 Dockerfile，共14文件。

真实 Git 树对比确认：新 R 的 apps/api、apps/web 及 config/database/domain/types/ui 的运行源码与 L 原字节相同，packages/testing、根依赖/lock、Compose、nginx 亦不变。原 L 的77条迁移保持，新 R 的81条映射与原 R 全等，规范 SHA-256 仍为 `7fc59f4afbab4ac65e5240fc8ee14d5482f115710adc9880c441a1470ef57994`。静态回执与映射在 `/home/jinhuit/Kingturf/kingturf-coord/wave4/recovery-runtime-81-artifacts/scope.json`、`migrations.json`。首次内联检查因错误假定存在 packages/testing/src 而中止，随后改为完整 packages/testing 差异及全树精确白名单核验，未修改源码；该工具假设错误保留在回执说明，不当作新 R 运行失败或通过。

新 R 已通过集成提交 `e19dfe1` 纳入集成祖先；此合并没有新的文件差异。驱动已仅把受信 R 常量和对应帮助文案更新为新身份，仍要求完整 SHA 精确相等。原21项纯边界回归21/21，四文件语法与两个 audit-help 均通过；这轮没有读取GHR物料、运行Docker或执行恢复。当前四源码快照、测试前后元数据与原始日志另存于 `/home/jinhuit/Kingturf/kingturf-coord/wave4/recovery-rehearsal-controller-artifacts/r-32e705a9-help-v2/`，旧两代证据不覆盖；本代证据清单 SHA-256 为 `8fba9332d1cdf64a0f7d2a466577a14fe0bf6c454926edc1bbced259de7d4a5a`，受信契约文件 SHA-256 为 `5f559c2e30d69515cb2fb7b02750d550c940c5bd8860535cf10730007546869c`。本段静态冻结时，新 R 的实际镜像构建/扫描、成功原始 artifact、完整集成 CI、两层真实恢复和认证写均待执行；后继检查点与真实流水线结果见第7节，尚未解除发布门禁。

## 7. production 检查点完整 CI 与新 R 首轮导出

主协调在独立、干净的 `c3f1239fd3447dde026cf715fea9bdca6c8eef84`（树 `493d6b2d28158aaec741a3879a2c7accba904cf8`）经 heavy 运行完整 `pnpm ci:local`，2026-11-26 11:15:28–11:32:21 UTC **退出0，耗时1,012.30秒**。前后HEAD相同、受跟踪树干净。API **18,387/18,387（212文件）**、Web **1,064/1,064（67文件）**、config71、database79、domain26、types5、UI101全部通过；operations **261/261**，最终迁移81条 FULLY_MATCHED。格式、文档、结构、边界、能力清单、DB guard、lint、typecheck、覆盖率、production构建和审计的完整链全部通过。

本轮确实执行修正后的 production build，登录 gzip 为 JS **11,752 B**／CSS **25,640 B**，预算保持12,000／27,000 B。回执新增完整49文件SHA-256 map及规范摘要 `459128338786c7181818d4c230130d79c7ed2c19062bf5c10b16322961375e9d`；另与第5节同源production映射逐键核对，49/49相同。该回执可绑定后继浏览器使用的确切字节，不把源码Git树相同当作未跟踪dist也相同。原始日志和结果为 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/ci-c3f1239/`，日志SHA-256 `5b316f99d2ae4f575c92744f2147c07c885eb9456da929512767c354b8c37593`。

11:33 UTC，核对远端仍为514、可快进关系及新R祖先后，主协调已将上述已测检查点推送main，并将主检出快进至同一SHA且保持干净，回执 `integration-artifacts/publish-c3f1239.json`。后继文档合并未改变该检查点源码与测试；最终业务B及其完整CI／production字节浏览器仍须在指定GLM余项完成后固定，当前不是生产发布。

新 R 通过现有 `release-images.yml`、ref main，以完整R SHA明确调度，固定导出控制为c3f1239：[run 45811774272，attempt1](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/45811774272)。本轮真实完成API/Web构建推送、tag与digest核对、双HIGH/CRITICAL扫描、SBOM和不可变digest输出，之后在 **Export original recovery bytes and offline source** 步骤退出1：`GATE_FAILED:recovery_transport: [Errno 1] Operation not permitted: '/tmp/recovery-export-jhfxpy8o/oci/web'`。Retain步骤未执行，整体run为failure，不能消费其已推镜像作为成功approved恢复物料。

本轮观察到的API根摘要为 `sha256:61a7914363f8ab34e5391296cc9209fa6e3a31352089c20dc0fef1167d7f5d20`，Web为 `sha256:be9cff07190d2b4cdb7b2110f365c58937aeccc7b6c37a6396b9991413ea2af0`。调度、run/job最终JSON、完整job原日志和watch回执保留在 `integration-artifacts/image-builds-32e705a/`（job139881174681，错误约R-job.log:2826）。另批TD-REL-016已先登记为 `2eb8f814fcf13f60e111946e2941b50733904d8a`。独立实施者以原固定Skopeo镜像和自有bind实测复现：copy成功后目录为root的0:0/0755，runner清理先遇unlink EACCES，再在resetperms chmod web目录时EPERM，与本轮调用链和末错误相同；GHR临时目录已消失，未冒称取得该目录现场stat。修复只拟对齐Skopeo写入UID/GID与实际runner，另附测试，不改R业务源或放宽成功来源门。两层真实恢复、认证写、最终B/C材料与生产发布均未执行。

### 7.1 轻量文档检查的工作目录更正

此前若干直接以绝对脚本路径调用doc-lint的轻量检查，进程实际工作目录是主检出；不能把它们计作当时集成合并树的文档通过证据。主协调已在干净 `710f72fc65e495a38a0d403b444c07a12680ba5b` 上显式指定集成目录，重跑 `pnpm doc:lint` 和 `pnpm format:check`，二者退出0，HEAD与受跟踪树不变，完整原始日志及各自摘要在 `integration-artifacts/doc-check-710f72f/`。第2节及本节完整CI启动器一直显式设置对应被测工作树的cwd，其完整回执和生产构建字节不受本次轻量调用口径更正影响。后继轻量命令使用 `pnpm --dir <集成树>` 或显式cwd。

## 8. 指定 GLM 工作流的冒烟目录批已集成

指定工作流的TD-TEST-029已经完成开发、确定性门禁及GLM-5.4审查并提交：工具 `f54d72f86e075e36e4f91b38df18c7e1e4c9081a`、证据 `aa1160445957b92125cee9019037354267994848`。主协调只读复核完整代码差异和四轮审查记录后，合入 `a5ff13b1b5fc314c3dd3698c2be38af68887f7bf`；保留两边工具测试、发布摘要／预算守卫及production构建，所有者裁定仍为台账第一节，既有TD-WEB-016盘查状态不被旧分支覆盖。没有修改仍在执行的供应商初焦任务，开发模型和审查模型保持用户指定配置。

同一干净合并快照的根 `test:session-network-tools` **115/115、零skip、退出0**，前后HEAD和受跟踪树不变；完整检出的fixing-commit探针核对24条、23条完整SHA祖先全部成立、1条无单独修复提交、核对失败0。回执在 `integration-artifacts/catalog-a5ff13b/`，工具日志SHA-256为 `4c423f4e1dd8e50c72df5893edf6bfe7db88d38bb9eb8fea3be5f343b4df0299`。这是合并后定向回执，不能拿第7节c3的完整CI替代新增源码后的最终完整CI；浏览器四轮、浅克隆和Node24.1兼容等分支证据详见[目录批证据](smoke-catalog-fixed-in-2026-11-26.md)。

## 9. 导出修复集成后的完整 CI 与成功 R 流水线

TD-REL-016 经独立复核后整支合入 **`1f6f3de8b5bbd79fb1c2a6bb6ccc82963099aa66`**，树 `e4fb09e5f70c4c94c802f66638c5d4dd158a9a0a`。两份准备脚本／测试与交付分支原字节一致，保留目录批、严格走查、发布守卫和 production 构建；台账所有者裁定首节原字节不变。

主协调在独立干净工作树，经 heavy 于 **2026-11-26 12:00:30–12:16:34 UTC** 实跑完整 `pnpm ci:local`，**退出0，耗时964.16秒**。API **18,387/18,387（212文件）**、Web **1,064/1,064（67文件）**、config71、database79、domain26、types5、UI101、operations **264/264、零skip**；81条迁移 FULLY_MATCHED。完整链全部通过，前后HEAD相同且受跟踪树干净。登录 gzip 为 JS **11,752 B**／CSS **25,640 B**；全部49个production文件与第5节保留映射逐键相同，规范摘要仍为 `459128338786c7181818d4c230130d79c7ed2c19062bf5c10b16322961375e9d`。原始回执／日志位于 `integration-artifacts/ci-1f6f3de/`，日志SHA-256 `a33919c6ab9901606115b99b6954cf82319b1a9c0472ed8d70cfd4876e2c2b78`。

**12:19:59 UTC**，再次核对远端和主检出仍为c3、受跟踪树干净、c3与新R均为本检查点祖先后，已将1f6f3de推送main并将主检出快进至同一SHA；独立远端核对与本地clean均通过，见 `integration-artifacts/publish-1f6f3de.json`。这是已测技术检查点，最终业务B尚未固定。

**12:30:13 UTC** 通过原 `release-images.yml`、ref main，再次明确输入相同R **`32e705a9a835e577b528fd6ff6d72c06b449ca35`**，导出控制固定为1f6f3de。[run 45820243736，attempt1](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/45820243736) **整体success**，publish job **139910346270**，watch退出0；构建、双HIGH/CRITICAL扫描、原物料导出与artifact留存完成。首次admission后列表暂未出现新run，只做唯一运行reconciliation，没有重复dispatch。完整调度、run/job JSON、watch及原job日志保留于 `integration-artifacts/image-builds-32e705a-control-1f6f3de/`。

本节记录流水线成功；原artifact下载与逐字节核对见下节，不能以整体success替代两层真实恢复、R认证写、最终B的标准smoke及production浏览器验收。旧失败run45811774272和两个扫描失败run原样保留，不作成功来源。

### 9.1 成功原 artifact 的字节与离线来源核对

原 artifact **15118360718**，名称 `compatible-recovery-material-32e705a9a835e577b528fd6ff6d72c06b449ca35`。下载器再次通过GitHub API核对canonical仓库、workflow_dispatch/main、completed/success、attempt1、固定控制1f与未过期artifact身份；实际ZIP的SHA-256与服务端digest相同。ZIP恰包含五个普通文件，无目录、链接、额外或重复条目，分别安全写入新的私有目录；解释器从可信脚本目录以`-I`运行。

| 原始字节或身份          | 实际值                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| ZIP SHA-256             | `4eb7f078ea6553b0bb518f924cf828f7383a1a3be4b7adda629b5dad1ec548b7`        |
| recovery.tar.gz SHA-256 | `5fe1c083ca1a4f6ea8928b83656c0163c5a1fd271956ecab835372e59ee3f199`        |
| source.bundle SHA-256   | `8cbcbad8f4ca809fcf9657c02611df97cc660b811c100867c70f3608b741f474`        |
| provenance.json SHA-256 | `067ca1e2fe9661ed7b0c05e438279a6f4e67d8f3bcdac0132915f15c4dea4db3`        |
| API 根 digest           | `sha256:c8b35723e5f440980180355d438302e20018eb76a85f84700eeb205f8aea69be` |
| Web 根 digest           | `sha256:be20680d1f0d91ec93bb7025dcfc53ffb92c4deae591518ddf4a905290f09c8a` |
| 原导出main快照M／控制E  | 均为 `1f6f3de8b5bbd79fb1c2a6bb6ccc82963099aa66`                           |
| 81清单规范SHA-256       | `7fc59f4afbab4ac65e5240fc8ee14d5482f115710adc9880c441a1470ef57994`        |

五文件原字节均与provenance逐键一致。另将原tar严格按普通文件／目录拆至新的数据目录，保留原tar不重打包，内部release/migrations与原导出件原字节相同；执行固定控制的原OCI verifier，全部可达OCI descriptor/blob（含attestation）摘要和平台／config／layer结构通过。source.bundle在新的bare数据仓库中验证为自包含且恰为main=M、recovery=R两refs，hooks／全局配置／交互认证均关闭；L≤R≤M，R真实Git对象的81 SQL重算全等，API/Web及既定运行包源码与L相同，没有执行bundle中的源码。

下载于 **12:32:48 UTC** 完成，离线核对于 **12:35:29 UTC** 完成。证据均在上述流水线产物根的 `R-original/`：`download-result.json`、`run.json`、`artifact.json`、`transport-source.json`、`archive/export.zip`、`export/`原五件，以及 `offline-verification/result.json`、`oci-verify.log`、`source-verify.log`。两离线日志摘要分别为 `40e85a24ed24c28d775b98cdc607ad6ef68bfe88551695ea9eac98d20c016b3f`、`556ffa85e95a050ffc295957933ba34c94f4a2d5b82cd44aed0f35a483691b9d`。

TD-REL-016的实际导出阻断已解除，成功原始来源已取得；尚未生成演练PASS、迁移批准或B/C应用授权。后继标准smoke须另有独立81-schema数据库；原helper只继承DATABASE_URL，不负责建库／迁移。R预验与最终B smoke分别记账，现有L/77环境继续留给真实恢复，两层恢复和最终发布仍须实际执行。

### 9.2 不可变恢复报告的格式门禁冲突

主协调在准备真实报告入库时，经独立只读定位确认：冻结driver的 `canonical()` 使用 `json.dumps(value, sort_keys=True).encode()`，manual按该原字节保存报告，automatic同时要求C中的报告、消费文件与manual原件原字节相同；当前完整CI与pre-commit均调用Prettier，原.prettierignore未排除此路径。对报告重新排版并重算批准hash仍会破坏automatic的原件绑定。

先登记 **TD-GATE-008（P2）**，主协调按既有技术授权拟独立修复格式口径。**2026-11-26 12:46:03 UTC**，以09e518f项目的实际Prettier3.8.1，在外部新私有夹具目录调用真实冻结canonical函数，将 `kind: format_boundary_probe`、`real_recovery_report: false` 的非报告JSON放入规定模式的report.json路径，格式检查真实退出 **1**，fixture原字节不变。该夹具不是恢复报告，不含PASS、认证写或批准字段；完整路径／命令结果／摘要位于 `integration-artifacts/report-format-gate/legacy-red.json`、`legacy-red.log`，夹具SHA-256 `4dc44121fb7a78868e684cb66b994fc53909c1f34808206511448b24bcabb9e7`。

本登记时修复尚未实施。拟仅在既有.prettierignore加入 `release-materials/compatible-recovery/*/report.json`，以保留真实原件字节；批准、descriptor与transport-source继续接受格式检查，实际内容／时序／来源／hash仍经严格材料门。原tar/source.bundle由成功artifact供给，最终C显式核对并暂存四selection JSON。

登记提交 **`b61325e41ff655558ab678ba64755ec0f58dc5d9`** 后，独立fix **`4f934cd1dee3bf62339c4dc4bdaa7b260b7ab6d3`** 恰改.prettierignore一行。12:49:04 UTC，同一原字节fixture在目标report路径的显式文件检查转 **退出0**；approval.json、compatible_recovery.json、transport-source.json、错目录report.json、该目录更深一层的report.json这五类仍 **退出1**，六项边界全部符合预期。所有fixture的原字节／SHA-256均未变，项目完整format:check退出0。原有五个固定控制脚本与1f原字节完全相同，driver与严格材料门未改；没有生成演练报告／PASS／批准。绿态原始日志、逐项退出码与字节摘要在 `integration-artifacts/report-format-gate/fixed-green.json` 和 `fixed-case-*.log`，fix／控制字节回执为 `fix-commit.json`。最终B完整CI与真实报告入库、manual／automatic仍须后继执行。

## 10. 供应商初焦批集成与定向复验

指定GLM开发／审查流程已交付 **`3882d0114a969836dd151eaf864b5330668e0efd`**，主协调复核完整源码差异后合入 **`acbdf0f11e241b6debe4ec718495d78c48f65aba`**。只改供应商控制台测试：14处残余打开抽屉路径经act helper，同步结清初焦effect并增加焦点落位断言；两个原确认框初焦断言保留。产品组件、API、SQL、权限和写路径均未改。

唯一合并冲突在共享台账的顶部插入位置。依据三方Git原对象，验证交付方对台账恰为增加一个完整新小节后，将它放在现有所有者裁定之后，所有者裁定仍为第一节且原字节相同，既有新债务／状态保持。测试和新增分支证据与3882d01原字节一致，唯一apps/packages变更为此测试文件；文档、格式和diff检查退出0。完整合并回执与日志在 `integration-artifacts/drawer-focus-3882d01/merge-result.json` 及同目录。

**13:14:40–13:15:01 UTC**，在干净合并提交经heavy运行同一个供应商测试命令 **20轮，20/20通过，每轮19/19**；每轮原日志分别保存，任一轮失败即停止，没有重试。前后HEAD相同、受跟踪树干净；源码SHA-256 `050917fb7f669310b8c98b1b2d27c850ebeea3f8c344a3334eca21f5760dc52b`。回执 `merged-test-result.json`，日志 `merged-supplier-01.log`…`20.log`。这是合并后的目标稳定性回执；分支旧基线100/100未复现、隔离探针红绿及分支全量1024的历史与失败均保留在[原证据](drawer-focus-stability-2026-11-26.md)，不冒称合并后的完整CI或production浏览器已经通过。

分支另外发现独立既有概率性测试失败，主协调已读回原日志并核对源码，登记 **TD-TEST-041**：真实Web Crypto四位36进制随机键的200个样本不保证零碰撞，单文件20轮中1轮 `expected 199 to be 200`。原日志 `wave3/drawer-focus-artifacts/prod-order-keys-20.log`，SHA-256 `3e882c24553646d36e63c20004efc1587aa4389778c48d649ccfba2ea8af6ef1`。该生成器与测试均不在TD-TEST-035改动面，本波按R4仅登记，既有失败与重跑绿态分别留档。

## 11. 远端检查与生产公开基线

对已推送检查点1f的GitHub状态只读核对：CI [run45818647493](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/45818647493) 与CodeQL [run45818647511](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/45818647511) 均completed/success。原查询和UTC回执在 `integration-artifacts/remote-checks-1f6f3de/`；不外推为后继新提交的检查结果。

**2026-11-26 12:53:04 UTC**，公开GET `https://erp.kingturf.cn/health`、`/ready`、`/version` 均HTTP200，前两者分别为status=ok、ready；version仍为L `5dc88e5c922ff731e2cfeb949b28c5cd8c333032`、environment=production、builtAt=`application-45609177419-1`。原body及摘要在 `integration-artifacts/public-baseline-20261126T125304Z/`。观察范围仅为未登录公开读取，不能代替生产登录态或数据库／迁移检查，尚未执行生产发布。
