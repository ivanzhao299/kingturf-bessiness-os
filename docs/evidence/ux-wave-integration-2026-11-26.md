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
