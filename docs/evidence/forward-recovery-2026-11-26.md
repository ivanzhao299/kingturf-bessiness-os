# TD-REL-011：失败应用的受控前滚恢复控制

## 1. 授权、基线与交付边界

本批在隔离工作树 `wave4/forward-recovery`、分支 `fix/w4-forward-recovery` 实施，基线 `fab3679`。阻断先由主协调登记于 `08996f1`；主协调在 `7b4a358` 落盘显式 `compatible_recovery` 证据模式的实施裁定。本批没有合并该共享文档提交，主协调负责最终集成。

交付控制脚本和负例，不执行生产恢复。没有修改 `.github/workflows/`、业务代码、SQL、迁移登记或迁移号；现有 77 条计数保持，最终 81 条由主协调集成统一。AGENTS、active 计划和发布记录均未修改。全部提交标 `[未测试]`：本树不跑完整 `pnpm ci:local`。

**没有生成发布用的兼容恢复通过报告，没有启动真实 API/Web 恢复镜像，没有访问生产。** 原 77 镜像 L 在 81 数据库上会被启动校验拒绝；兼容候选 R 是另一个 SHA/镜像，不能把 R 称为原 L。本批控制测试中的通过记录都是临时合成夹具，不能用于发布。

## 2. 失败来源准备与原路径守恒

`production_preflight.py` 把原磁盘、私有配置、挂载及注册表检查提取为 `inventory()`，原 `preflight()` 继续按相同顺序和判据调用。新增的 `--inspect-forward-recovery` 只返回检查记录，不能返回部署 `preflight: PASS`，也没有停止、重启或写数据库能力。

停服资格同时要求：

- 候选完整清单与实际注册表名称、checksum 全等，`FULLY_MATCHED` 且零 pending；候选 SHA 与旧 marker 不同。
- 精确 Compose 项目、服务和持久挂载；PostgreSQL 健康，Web 保持运行。
- API 容器的 `KINGTURF_RELEASE_SHA` 与旧 marker 一致，ID/image ID 有效且原镜像仍存在。
- API 明确处于非零退出的 `restarting` 或 `exited` 状态，不能是健康、单纯 unhealthy、暂停或 dead 的模糊状态。
- 同一容器自本次 `StartedAt` 起的有界日志包含迁移兼容检查失败，失败迁移属于目标清单。Docker 的应用 stderr 也参与检查；任意日志内容不落公开材料，只保留匹配迁移名和该错误行摘要。

检查记录绑定候选 SHA、规范清单摘要、注册表摘要、marker、原 release、API 容器 ID/image ID/引用、状态、重启次数和 UTC 时间，有效期最多 300 秒。`application_release.py prepare-forward-recovery <bundle> --source-sha256 <摘要>` 验证批准材料、原始清单绑定、已导入的批准镜像及记录字节，重新只读核对现场；旧记录、状态或身份变化立即拒绝。

通过前置核对后，准备动作以 0600、排他创建保存 `forward-before.json`、`forward-containers.json`、`forward-env` 等私有现场，持久启用写闸，**直接停止 API**，不先启动旧 API 以获取健康响应。随后必须观察 `Running=false` 且 `Restarting=false`、连接排空，并验证含原 applied_at 的登记、历史迁移状态文件和 marker 不变。准备失败保留现场和已启用的闸，不执行迁移。

`recover_application_images.sh` 的分支顺序为：

| 来源               | 顺序                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 健康应用或已停交接 | 原严格 preflight → 传输并核字节 → precheck → import → backup → switch → postcheck                                                                               |
| 已确认的失败来源   | 原严格 preflight 拒绝 → 独立只读来源检查 → 传输并核字节 → import → prepare-forward-recovery → **再跑原严格 preflight** → precheck → backup → switch → postcheck |

来源检查失败不能触发停服。源记录传输、镜像导入或批准核对失败均先于准备动作；原记录超过 300 秒时拒绝，不能用放宽 startup/preflight 或复用过期记录代替新的检查。

手工前滚分支先带闸启动批准候选 R；第 7 节的显式兼容恢复模式也要求 B/R 带闸启动。核实批准镜像身份、内外 health/ready/version、登记与迁移状态不变后，才解闸重建 API 并复探。验证前失败不解闸；解闸后的复探失败重新启闸并停下本次应用。失败不会重新启动已证明不可启动的旧镜像，也不得停止现场出现的无关 API。原 legacy 切换仍保持原来的一次启动顺序与判据。

## 3. 新候选冒烟与兼容恢复证据分离

成功的普通候选冒烟现在写 `candidate_app_on_schema`，绑定候选 SHA 和物料原始清单摘要，不再生成 `old_app_on_new_schema=true`。

历史旧字段仍仅用于原同候选应用重跑的既有读取。迁移证据门继续要求旧应用兼容证明；已知旧代码生成的 `runner isolation smoke ...` 引用会被拒绝作为旧应用证明。兼容候选 R 的成功也不会回填旧镜像 L 的字面兼容布尔值。

`release_orchestrator.py` 的镜像证据门保留，默认 `legacy`。只有本次 `release_approval.json` 明确选择 `image_compatibility_mode: compatible_recovery`，才验证下述独立材料；单独发现 `compatible_recovery.json` 不改变模式，也不会在校验失败后回退另一模式。

### 3.1 私有证据 bundle 的入口和布局

本树基线的 workflow 在迁移前只传控制脚本及 SQL，不自动传新增报告。下面是控制脚本要求的私有证据 bundle 布局；**迁移前传入该目录的 workflow 接线由 FN2 在另一工作树实施并由主协调集成**，本树没有该接线，不能把人工预置当作已完成的传输前置：

```text
.release-migration-evidence/
  migration-recovery-approval.json
  compatible_recovery.json
  compatible-recovery/
    recovery.tar.gz
    source.bundle
    report.json
```

`apply_migrations.py` 读取 canonical 的 `migration-recovery-approval.json`；CLI 可用 `--recovery-approval <该目录内相对文件>` 明确指定另一批准文件。该文件必须明确选模式，绑定本次 release SHA、批准后缀、审批人及有效窗口。它在启用迁移写闸之前经过报告和来源核对，随后作为本次 `release_approval.json` 原样交给 orchestrator，不静默重写批准时间。无该批准材料时原 legacy 流程保持。

兼容模式进入迁移执行后若失败，保持 API 停止和闸启用，报告需要兼容恢复；不会再尝试用原应用启动来掩盖已经提交的新 schema。迁移前旧应用仍已通过健康核验时，原失败恢复行为保留。

已向主协调报告最小接线差异：在 `release.yml` 既有 verify 中，以固定控制提交读取显式批准材料、核验实测所用的 R 原 tar/source.bundle/report 并放进现有传输 artifact；在既有 deploy 的生产锁内、apply 之前，使用相同 known_hosts/SSH secrets 校验并传入本次私有证据目录。输入、job 图、审批和锁不必改变。严格不改 workflow 无法完成这个传输，不通过 plan 副作用、SQL 目录或嵌入脚本 payload 绕过限制。主协调随后于 `1eed945` 落盘接线裁定，交由另树 `wave4/recovery-transport` 实施：成功的 R 镜像发布固化原 artifact，控制提交 C 携带显式 B/R 批准及脱敏实测报告，verify 下载确切 artifact，deploy 锁内先传材料再 apply。本批尚未修改 workflow，不能把该后继接线冒称已完成。

初始检查点的应用控制依赖为原三文件；第 7 节普通 B 失败选择 R 的后继修复复用严格材料门，**应用 bundle 增加第四固定控制 `release_orchestrator.py`**，与 C 的同目录 `production_preflight.py` 一同核字节。`recover_application_images.sh` 的远端 cmp 循环已加入第四项；`release.yml`、`recover-application-images.yml`、`release-rollback.yml` 的 cp/cmp 接线由 FN2 同步，本树不改 workflow。迁移 stage 原三文件本已包含 orchestrator，不增加其传输依赖；离线来源验证仍另需主机 Git。不会执行可变主机源码或复制另一套报告校验。

传输方可直接调用同一严格材料门，不复制校验逻辑：

```sh
python3 scripts/release_orchestrator.py check-compatible-recovery \
  '<plan.json>' '<approval.json>' '<证据bundle根>' '<完整L SHA>'
```

该 CLI 不访问数据库、不停 API；plan 必须有 `release_sha=B`、B 全部 SQL 的 `manifest` 和批准后缀的 `pending`（name/checksum 必须是清单的精确后缀）。批准必须显式选 `compatible_recovery`。成功输出绑定 SHA/清单摘要与 `live_fence_verified: false`；失败非零、保留 `GATE_FAILED` 类别，不回退 legacy。实际 L/marker/容器的交叉验证留在迁移执行锁内。

主协调选定控制提交 C 的唯一材料路径 `release-materials/compatible-recovery/<B>/approval.json`，同目录保存 descriptor、脱敏 report 与 transport-source 绑定；FN2 负责从确切成功 R artifact 获取原 tar/source.bundle，并在锁内按 B 目录保留旧材料。根 `compatible_recovery.json` 可指向 `<B>/recovery.tar.gz`、`<B>/source.bundle`、`<B>/report.json`；两个根元数据均为普通文件，stage 先核完整 B 目录，再原子安装 descriptor，最后安装批准文件。中断的混合绑定拒绝，不删除旧目录。

### 3.2 批准绑定与文件描述

以下为结构说明，所有占位值均须由主协调的实际物料/演练产生；不是通过报告。

批准材料在原 `release_sha / approved_suffix / approver / approved_at_utc / window_end_utc` 之外包含：

```json
{
  "image_compatibility_mode": "compatible_recovery",
  "compatible_recovery": {
    "legacy_business_sha": "<L完整40位SHA>",
    "recovery_release_sha": "<R完整40位SHA>",
    "recovery_main_sha": "<已批准的main完整40位SHA>",
    "api_digest": "sha256:<R的API根摘要>",
    "web_digest": "sha256:<R的Web根摘要>",
    "target_manifest_sha256": "<最终名称/checksum映射的规范JSON摘要>",
    "recovery_bundle_sha256": "<R完整OCI传输tar原字节摘要>",
    "report_sha256": "<实际报告原字节摘要>"
  }
}
```

`target_manifest_sha256` 采用 Python `json.dumps(manifest, sort_keys=True).encode()` 的 SHA-256；完整 R tar 的原字节摘要是另一个绑定。R tar 内 `release.json.migration_manifest_sha256` 还须等于该 tar 内实际 `migrations.json` 字节摘要，不能只核计数或文件名。

`compatible_recovery.json` 的字段为：

```json
{
  "kind": "compatible_application_recovery_v1",
  "recovery_bundle_file": "compatible-recovery/recovery.tar.gz",
  "source_bundle_file": "compatible-recovery/source.bundle",
  "report_file": "compatible-recovery/report.json"
}
```

上述路径必须是证据 bundle 内现存普通文件的相对路径；拒绝绝对路径、`..` 和任意一级符号链接。报告实际字节摘要必须等于批准值，非空 URL 或字符串不能替代报告。

R tar 的 release SHA、API/Web 来源与根 digest、完整迁移映射必须匹配批准/本次计划。`source.bundle` 必须是自包含本地 Git bundle，含 `refs/heads/main`（生成 R artifact 时的 origin/main 快照 M，由 C 批准）和 `refs/heads/recovery`（R）；C 的传输校验另确认 M 是当前受信 main 的祖先，不要求旧 artifact 含未来的 C。在新的临时 bare repo 中禁用 hooks、全局配置和交互认证，仅从该本地文件取对象，验证 L/R 均在批准 main 历史中，并从 R 的真实 Git 树重算全部 SQL checksum。源 bundle 是数据，不执行其中源码。

在执行锁内还会交叉核验：L 等于 write-fence 的原 release、实际旧 marker 和真正停止的旧 API 容器 release。不能只相信 JSON 的旧 release 声明。

### 3.3 实际演练报告的观察集合

报告根字段为 `kind: compatible_application_recovery_drill_v1`、`isolated: true`、`bindings`、`tested_at_utc`、`steps`、`runtime`、`authenticated_write`、`registry`、`migration_state`。

- `bindings` 精确等于批准的 `compatible_recovery` 对象去掉 `report_sha256`（避免报告自身摘要循环）。
- `runtime` 精确包含 R 的 `release_sha / api_digest / web_digest`。
- `steps` 必须按下面顺序，每项带实际 `name / result / at_utc`，结果必须是 `PASS`。时间为 UTC、非递减，末项不晚于 `tested_at_utc`，实测完成不晚于批准时间。
- `authenticated_write` 必须有真实 `authenticated: true`、整数 2xx `status`、非空 `operation`。

必须观察的六步是：

1. `failed_candidate_switch`
2. `recovery_started_fenced`
3. `recovery_identity_health_ready_version`
4. `write_fence_disabled`
5. `authenticated_write`
6. `registry_and_state_unchanged`

`registry` 必须包含 `includes_applied_at: true`、`before / after` 两个完整非空数组及 `before_sha256 / after_sha256`。数组按 name 排序，每行精确包含 `name / checksum / applied_at`；名称/checksum 恰好是最终清单，原始 applied_at 逐行相同且不晚于实测。代码重算观察数组摘要，不能拿 count 或空数组摘要相同代替。

`migration_state` 必须有相同的非空 `before_files / after_files` 路径→原字节 SHA-256 映射及对应规范映射摘要 `before_sha256 / after_sha256`。以演练发布根为基准，最小集合是：

- `.release-migration-state/orchestration-state.json`：本次成功迁移后的执行记录。
- `.staging/wave2-<run>-<attempt>/plan.json`：包含本次最终清单的真实迁移计划。

可另外观察 `.release-migration-state/archive/<sha40>-<UTC时间戳>.json` 的历史迁移记录。应用恢复目录、`application-state.json` 和 `forward-preparation.json` 等本来会变化的应用 journal 不得混入这个要求不变的集合；空 `{}`、只有应用 journal 或缺 plan 均被拒绝。

## 4. 验证及失败历史

本批所有重任务通过 `coord/bin/heavy` 执行。专用 PostgreSQL 为 `w4-forward-recovery-pg`、回环端口 5454、库 `w4_forward_recovery_test`。测试口令只从主检出示例模板的指定键进入进程环境；不打印、不写口令文件，不读取真实环境文件或生产凭据。

| 检查                                                        | 结果与边界                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 恢复控制/兼容材料定向测试                                   | 最新 57/57 通过；包含真实本地 Git、tar、JSON/字节与私有文件测试，Docker/HTTP 恢复动作使用替身        |
| Python 发布/操作测试全套                                    | 最新 205/205 通过，28.728 秒，含既有真实 PostgreSQL 迁移与宿主演练；最终注册表 77 条 FULLY_MATCHED   |
| 恢复 shell                                                  | `bash -n` 通过；静态契约核对正常顺序、失败分支导入/准备/再次严格预检顺序及 workflow 输入/job/审批/锁 |
| structure/service/lint/tsc/format/doc                       | 全部通过；lint 仅两条既有 warning（无 error），doc/format 收尾复验通过                               |
| 完整 ci:local、真实 R 双镜像恢复、81 清单隔离恢复、生产发布 | 本批未执行，由主协调集成验收                                                                         |

负例覆盖来源变化、记录过期/字节篡改、容器与 image ID 错绑、健康或单纯 unhealthy、无启动失败日志、非 FULLY_MATCHED/漂移/目标错绑、停止后仍 restarting、数据库未排空、历史迁移状态变化、验证前不得解闸及解闸后失败重新留闸。兼容证据另覆盖未显式选择模式、真实报告缺失/被改/越界/符号链接、空登记或文件映射、applied_at 改变、应用 journal 冒充迁移记录、未来或非 UTC 实测时间、失败步骤/未认证写、R 不在 main 历史、R 真 Git 迁移字节不同，以及 tar/清单/运行身份错绑。缺证据在迁移锁和执行之前被拒绝。

失败历史保留：

1. 最早 14 个恢复控制用例中 13 个通过，正常 switch 夹具未设“backup 已停 API”，触发原有停止前提；补正夹具，未放宽生产检查。
2. 工作树存在 node_modules 目录但依赖尚未装齐。全套首跑 176 项中 4 失败、1 错误，均停于 Node 参考迁移器缺模块；格式检查也因缺 prettier 退出 254。随后仅执行 `pnpm install --frozen-lockfile`，补齐依赖后全套通过。
3. 首轮静态门禁的 structure/service/lint/tsc/format 已过，doc-lint 在新证据与索引尚未同步完成时报告 index-incomplete；补齐索引行后单独复验，不改门禁。

脱敏原始日志和检查启动器保留于同级 `forward-recovery-artifacts/`，包括 `operations-01.log`（失败）、`static-01.log`（缺工具）、`install.log`、`operations-02.log`（182 项通过）、`operations-03.log`（首个交付检查点 185 项通过）、`preflight-parity.log`（原严格预检前缀/续段 AST 与顺序完全相同）及后续静态门禁日志。启动器只在内存传递示例测试口令，输出在落盘前脱敏。

## 5. 主协调衔接与保留阻断

先把控制提交集成并统一最终 81 清单；主协调准备 R 的双镜像、批准的来源对象与实际演练报告，并完成第 3 节所列迁移前传输接线，才能真实传入同一私有证据 bundle。原应急 `recover-application-images.yml` 的四输入、job 图、production 审批和锁均未改变；`release-images` 成功运行、完整候选 CI 和真实候选冒烟仍是前提。

本批通过控制/既有迁移测试不代表真实镜像恢复成功。没有实测报告时 compatible_recovery 门继续拒绝；未显式选择模式时不变宽。TD-REL-011 的本波发布阻断由主协调在真实 81 清单恢复、认证写及最终集成 CI 后裁定解除。

## 6. 独立复核后的停止目标修复

`94b909a` 为首个控制检查点（全套 185 项通过）；`e47843c` 提供严格材料 CLI（随后全套 189 项通过，26.273 秒）。独立复核发现，两处 forward 停服在检查来源后仍按 `compose stop api` 动态解析服务名，检查和停止之间的容器替换可能把停止权限转给新 API。

新增两个受控替换用例在未修代码上恰好 2 失败、其余 16 通过：准备路径确实停到了新 ID，失败清理路径也未识别替换。修复后只调用 `docker stop -t 30 <已核验完整ID>`，随后分别 inspect 该 ID 与 canonical API，必须仍指向同一来源且真正停止；替换时拒绝、留闸和现场，从不把停止授权交给新 ID。18 个控制用例通过。测试的 L 与候选现在使用不同容器 ID、image ID 和 Config.Image，失败清理不再靠保留旧身份的替身冒充候选身份。当时正常路径的 compose 停服未改；本文件第 12 节记录 TD-REL-013 的后继修复。

原始红绿日志为 `stop-race-red.log`、`stop-race-green.log`。该复核还指出普通 B bundle 的失败链尚未消费独立 R 目标；仅有手工前滚准备不能证明普通 B fail→R 已完成。后继收口见第 7 节，真实镜像演练仍由主协调执行。

## 7. 普通 B 切换失败选择 R 的后继修复

普通 B 的 backup 在已有完整清单、已停 L 的 handover 状态下，必须消费本次显式批准，复用第四固定 control 的严格材料门。`prepare_compatible_target()` 在 B 切换/停服前实际校验、展开 R 原 tar，并调用已有 OCI 导入和镜像字节核验；把 R 的独立 SHA、双 digest、真实 image IDs/local refs 和批准/报告绑定存进私有目标及 before.json。L 的真实原容器身份、配置、环境和联合备份仍单独保存；R 绝不冒称原 L。

此模式下 B 先带持久闸启动并核身份、内外 health/ready/version，验证后才解闸复探。B 失败时 `main()` 选择独立 R 目标，**不调用 `recover_previous_application(L)`**。恢复先复核 R 的已导入实际字节和原登记/迁移状态，按第 6 节的不可变 ID 停本次来源；用 R 的 SHA/双镜像配置带闸启动 R，再核身份及所有探针，成功才解闸复探、原子更新 marker 为 R，状态记 `RECOVERED_COMPATIBLE_APPLICATION`。B 的发布结论仍失败。R 恢复失败则保留闸/现场，按绑定 ID 停本次失败应用，状态记 `COMPATIBLE_RECOVERY_FAILED`，不退而启动 L。

R 作为实际健康原应用进行下一次零 pending 的 B 重试时，不消费历史 L 批准；backup 保留当时真实 R 来源，失败仍走原准确原镜像恢复。正常 legacy 逻辑不因 JSON 存在自动选 R，也不放宽 startup/preflight。R 导入期间若来源容器被替换，backup 在任何服务停止之前拒绝。

新增 7 项控制流测试区分 L/B/R 的 container ID、image ID、Config.Image，记录 import/up/stop/fence/probe/marker 顺序：普通 B fail→R 且从未调用 L start；B 解闸后失败仍选 R；R 在闸内或解闸后探针失败留闸；报告缺失零导入/零启动；R 导入时来源替换零停止；健康 R 重试不被历史 L 批准阻断并走原恢复函数。这些用例真实校验本地 Git、tar、报告字节，但 OCI daemon、HTTP 与已验证 backup 后置条件使用明确替身，**不算真实镜像链证明**。

验证：相关 47 项通过；Python 操作全套 **199/199** 通过，27.887 秒，含既有真实 PostgreSQL 演练（仍为本树 77 条）；structure/service/bash 复验通过，完整 ci:local 未跑。`ordinary-r-01.log` 首轮 1 项夹具遗漏 backup 停服后置条件，补正后通过；`ordinary-r-03.log` 的 1 项旧静态契约禁止出现 orchestrator 文件名，与第四固定 control 的新裁定冲突，改为 AST 精确限制只可调用四个材料校验函数，并继续禁止迁移执行器/session/DDL。没有删除实际迁移禁止条件。通过日志 `ordinary-r-04.log`、`operations-r-final.log`、`r-static.log`。

主协调采用两层真实演练消除自证明循环：先取得明确标为手工受控恢复的真实 R 兼容报告，再通过同一严格门实跑普通 B backup/switch 失败→自动 R。代码不为首份报告放宽条件，不生成或替代该真实报告；最终自动镜像链和 81 清单集成验收仍待主协调回执。

## 8. 隔离实测的显式 CLI 执行回执

第一层真实隔离升级可由 R 的迁移 CLI 执行，不得把未运行的 orchestrator 写成 COMPLETED。经主协调追加技术裁定，报告的 `migration_state.method` 可显式为 `explicit_cli`：最小观察集合改为实际 `.release-migration-state/explicit-cli-execution.json` 加原 `.staging/wave2-<run>-<attempt>/plan.json`，仍要求非空、前后全等与规范映射摘要。默认或显式 `orchestrator` 仍要求原 orchestration-state 路径，未知 method 拒绝。

`migration_state.execution_receipt` 精确包含九个字段：`kind: isolated_migration_cli_execution_v1`、`isolated: true`、`release_sha: R`、`target_manifest_sha256`、`command: ["node", "--experimental-transform-types", "packages/database/src/cli.ts", "migrate"]`、严格整数 0 的 `exit_code`（拒绝 bool）、UTC 的 `started_at_utc / finished_at_utc`、实际持久执行日志的 `log_sha256`。要求 start≤finish≤首次 failed_candidate_switch；R/清单与批准绑定相同，日志摘要为完整 SHA-256。回执按 `json.dumps(receipt, sort_keys=True).encode()` 原样无额外换行落盘，其规范摘要必须等于 before_files/after_files 对应该真实回执文件的原字节摘要。

该分支只解释隔离报告的真实升级方法，生产 apply 仍走原 orchestrator，不执行报告中的 Node 命令，不改变 8 键绑定或 FN2 descriptor 接口。原始日志由主协调实际运行、持久保存并算 hash，不写凭据/URL。定向兼容材料 29 项通过，含真实临时回执文件字节正例，以及缺回执、错误 R/清单、错误命令、bool/非零退出、错误时间、缺日志摘要、换文件名冒充默认方法和观察摘要不符等负例；这里的合成夹具不冒称实际迁移回执。

## 9. API 停止授权的项目与挂载范围

独立复核发现 `operation_api()` 对批准 B/R 只核镜像、SHA 和 image ID，未在返回停止身份之前复核 canonical 容器的所属项目与附件绑定。新增共享只读 `require_api_scope()`：Name 必须是 `/kingturf-erp-production-api-1`，Compose labels 必须为项目 `kingturf-erp-production`、服务 `api`；附件目标 `/var/lib/kingturf/attachments` 必须恰有一个 bind，源严格等于同目录固定 `production_preflight.ATTACHMENTS`，不复制整套预检。

`operation_api()` 的原源/B/R 全分支，以及手工 forward 失败清理都先通过该检查才可停止不可变 ID。两类失败清理先恢复本机持久写闸并写失败记录，再核容器范围；拒绝时不调用 stop 或 up，也不把持久闸误称为该运行容器的 live 闸已生效。普通 `recover_previous_application()` 函数保持原样。

新增三组测试覆盖九种范围异常：错 Name、错 project、错 service、缺 labels、附件错源/错目标/volume 类型/缺失/重复；分别验证 preserved 原源、批准 B/R、手工 forward 原源和候选。旧实现实跑 57 项时，这 45 个新增子情形全部失败；修复后同类 **57/57** 通过，所有异常均零停止，失败清理保留持久闸。日志 `scope-red.log`、`scope-green.log` 保留。Docker/HTTP 仍是明确替身，不充真实镜像恢复证据。

包含第 8、9 节后，Python 发布/操作全套最终 **205/205** 通过（28.728 秒，无跳过；真实 PostgreSQL 演练最终 77 条 FULLY_MATCHED），日志 `operations-scope-final.log`。structure/service/lint/typecheck/bash 最终复验退出 0，lint 仍仅原两条 warning，日志 `static-scope-final.log`。本树保持 77 条，完整 ci:local 与真实 81 清单镜像恢复的验收归主协调；不将这些控制测试当作该验收。

## 10. 主协调的 81 清单集成复验

主协调合入最终恢复控制 `7795017`、材料传输 `8a0deae` 和 R 的最终 81 条钉定后，在干净提交 `22a546df61cdc8da3cc735659890bae1259ad195` 执行完整 `pnpm ci:local`。该轮于 2026-11-26 08:47:30–08:50:36 UTC 真实退出 1；前置格式、文档、结构、依赖边界、能力清单、数据库 guard/migrate/status、lint 和 typecheck 通过，随后在发布运维测试处停止，尚未进入 API/Web 覆盖率及后续构建检查。242 项运维测试有 7 项失败、15 项报错，首先触发 `Candidate migration manifest binding invalid`：两份新增恢复夹具仍只构造 77 条，而生产控制正确要求 81 条。失败日志和干净树回执保留于 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/ci-22a546d/`，不覆盖、不改标为通过。

独立测试修正 `93af1e1da1f76a1b2683e485ae847252454df9b6` 只改两份夹具：失败来源清单改为 81 条；兼容应用夹具明确保留 L 的 77 条真实 Git 文件，再由 R 追加 0078–0081 四条，并同步批准后缀。原日志解析的 `0077_fixture.sql` 负例、普通 B 失败选 R、R 失败留闸、替换竞态及范围拒绝断言均保留；生产控制、严格计数和迁移字节未改。

在上述干净提交上，主协调以回环 `5438/kingturf_test_coordrel`、`kingturf` 角色经 heavy 串行执行完整 `python3 -m unittest discover -s tests/operations -p '*_test.py'`：**242/242 通过、零 skip，测试耗时 39.125 秒，退出 0**。前后 HEAD 相同、受跟踪工作树干净。原始日志、SHA-256 与结果在 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/operations-93af1e1/`，其中日志摘要为 `a63cad8d5706d1291a5477d4a6eb46e7ba661744020341170e4b47679c2c91f9`。

该回执只证明最终同树运维测试通过。新的完整 CI、R 原镜像物料、两层真实恢复及恢复后认证写仍须分别实跑；没有据此解除 TD-REL-011 的发布阻断。

## 11. 第二轮 CI 与历史 BOM 升级夹具

完整 CI 在干净提交 `da5a1cf4fa14e478b1b6b4a7d011c09bf84dfe6f` 于 2026-11-26 09:13:44–09:28:58 UTC 再跑，退出 1，前后 HEAD 与受跟踪工作树保持不变。运维 242 项通过；API 的 212 文件中 211 通过，**18,387 项中 18,386 通过、1 项失败**。唯一失败是 `bom-publish-components-postgres.integration.test.ts` 的历史升级用例：该用例先造 0078 库、用旧规则发布混合 BOM，却调用默认全量迁移后仍期待末位是 0079；集成清单的实际末位正确为 0081。完整日志和摘要保留于 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/ci-da5a1cf/`。该轮未进入 Web/数据库/UI 覆盖率和后续构建，不算完整通过。

独立测试修正 `4803bb450ba52545622b2ff97fab8a5a82e0e0dc` 将 0079 原 SQL 复制到该用例已建立的 0078 私有目录，再明确以该目录执行 migrate/status，精确检验所声明的 0078→0079 历史升级。原末位 0079、全部已应用、状态/时间/hash/完整行项全等及升级后同结构草稿被拒绝的断言逐字保留；其余真库用例继续默认使用完整 81 清单。生产门禁、业务代码、迁移字节和注册表均未修改。

主协调在该干净提交上经 heavy 复跑整份 BOM 真库测试：**10/10 通过，退出 0，7.41 秒**，前后 HEAD 不变、受跟踪工作树干净。结果与日志在 `/home/jinhuit/Kingturf/kingturf-coord/integration-artifacts/bom-upgrade-4803bb4/`；制造侧证据同步记录。后继干净提交仍须完整 `pnpm ci:local`，不能把本次定向绿态替代该门禁。

## 12. TD-REL-013/014：常规停止身份与子解释器隔离

### 12.1 授权、独立提交与边界

主协调依据项目所有者既有的全权技术审查与发布授权，采纳驱动独立静态复核的第 4、7 项，在 `wave4/control-stop-ids`、分支 `fix/w4-control-stop-ids` 组织独立修复。本项是主协调技术裁定，没有新增项目所有者业务裁定。基线 `514d8f4e2948dc2c51bf8dfd73f5f4c62eaa792e` 的完整 CI 已由主协调报告退出 0；本批没有重复该完整门禁，也不把基线回执算成本批回执。R 与 integration 树均未改。

提交按单一职责保留：`72b462a` 先登记 TD-REL-013/014；`a2b4919` 修常规 backup/apply 的停止；`0ed25ed` 将原 HTTPS-before-stop 静态契约同步到 immutable stop；`0bce8ef` 单独修真正子解释器的 `-I`；主协调技术复核后的 `b7c6bac` 收敛纯共享 scope 与完整环境守恒；`1a4f086` 仅补正测试替身匹配范围；`acfb385` 收住来源漂移后从 backup 停止异常进入原 CLI 旧恢复的出口，同时保留稳定来源普通失败的原恢复对照。全部标 `[未测试]`，表示本树没有跑完整 `pnpm ci:local`。最后的文档提交另见分支日志。

没有修改 workflow、业务、SQL、依赖或最终 81 pin，没有 push、发布、访问生产或执行真实恢复。驱动的其它五项由 W4 作者另行修复；镜像漏洞/工具链问题由主协调另批处理。本批通过不解除真实镜像恢复或发布验收边界。

### 12.2 TD-REL-013 的身份与范围

原 `precheck()` 只在 handover 返回 `container_id`；现在仅把该既有观察字段保留到普通返回中，全部预检判据、顺序和探针 AST 不变。backup 跨 R 目标准备仍核对原容器 ID、image ID/ref；保存私有现场后，在停止前再次检查 canonical API、project/service、固定附件 bind、原 ID/image/ref/env，再调用原 `stop_bound_api`，不再按服务名停止。停止请求本身只带核验所得完整 ID，后置检查仍验证该 ID 与 canonical 未被替换、Running/Restarting 均为 false。健康来源与真正已停 handover 均保留正常通路。

`acfb385` 补充 main 级观察：原 CLI 会在 STOPPING_API 的 backup 停止异常后调用原恢复函数，即使异常来自来源被替换。现在仅在停止核验异常后再次观察并确认 ID/scope/image/ref/env 漂移或身份无法确认时，写 `BACKUP_STOP_UNCONFIRMED` 并恢复本机持久闸，使原 main 的既有分派不进入旧恢复；不操作未知新对象，也不宣称其 live 闸启用。若确认原身份仍一致，仅为普通 stop 命令失败，保持 STOPPING_API 原恢复语义；成功停服后普通 drain 失败仍保持原 API_STOPPED 恢复语义。main 与 recover_previous_application AST 均未改，没有把全部 backup 异常一概禁止恢复。

apply 先观察原来源并绑定 marker/image/ref/完整环境，启闸并由原 Compose 路径合法重建后重新观察实际新 ID；只允许 `KINGTURF_WRITE_FENCE` 改为 enabled，全部其它环境按键值保持，顺序不影响比较，缺失、额外或重复键拒绝。停止前再次核对来源并按新 ID 停止，停止后核 canonical 与原身份。发现身份/范围漂移时保留持久闸，不调用旧失败恢复去重启替换对象；本机持久闸不被冒称为未知运行对象的 live 闸。未漂移的迁移前失败继续原恢复行为，原 `restore_api_on_failure` 函数 AST 未改。

主协调指出初版 app/apply 重复了安全谓词，随后 `b7c6bac` 将 canonical/project/service/附件 bind 的纯检查集中在既有同 C `production_preflight.require_api_scope`，两调用方仅委托，不增加控制文件依赖。该模块移除新增 helper 后的整个 AST 与基线完全相等，所有原函数及相对顺序保持；九类 scope 负例继续覆盖。ID 格式与来源内容属于调用方附加检查。

### 12.3 旧红新绿与原 CLI 守恒

| 回执（相对本批 artifacts）                 | 快照与结果                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `logs/td-rel-013-red.log`                  | 初始 10 方法在原源码上 32 个失败子情形，含误停新 ID；退出 1                                                                                    |
| `logs/td-rel-013-baseline-final-red.log`   | 该轮 11 个停止测试方法在 Git 对象 `514d8f4` 的原控制源码上运行，33 个失败子情形；退出 1。只替换测试加载的模块，不还原/覆盖工作树、不使用 stash |
| `logs/td-rel-013-targeted-green.log`       | `a2b4919` 对应源码，相关四模块 72/72，退出 0                                                                                                   |
| `logs/td-rel-013-static-green.log`         | 原 HTTPS/入口/审批/锁及第四 control 契约 6/6，退出 0；只把停止位置改为 immutable call 并明确禁止 backup compose stop                           |
| `logs/td-rel-014-red.log`                  | `0bce8ef` 之前源码：argv 断言 1 失败，PYTHONPATH 与 staging 两个实际投毒导入报错；非零子命令对照通过；退出 1                                   |
| `logs/td-rel-014-green.log`                | `0bce8ef` 对应源码，apply 模块 25/25，退出 0                                                                                                   |
| `logs/td-rel-013-environment-red.log`      | `0bce8ef` 源码对数据库/会话/额外/缺失/重复环境的 5 个子情形真红，环境顺序正例通过；退出 1                                                      |
| `logs/td-rel-013-final-targeted-green.log` | `b7c6bac` 对应源码，共享 scope 与环境收口后六模块 114/114，退出 0                                                                              |
| `logs/targeted-final.log`                  | 中间干净测试快照 `1a4f086` 上相同六模块 114/114，退出 0                                                                                        |

最终 CLI 出口补强另留 `logs/td-rel-013-cli-red.log`（初始两处时机真红）与 `logs/td-rel-013-cli-final-red.log`：`1a4f086` 源码上 3 方法中，同/异镜像新 CID、scope/env 漂移 6 个子情形均触发旧恢复权限，稳定来源普通 stop/drain 失败对照通过。修复后两类拒绝均零 recover/up/停止新对象，后者继续原恢复。`logs/targeted-cli-final.log` 为提交前对应源码的 117/117；最终干净 `acfb385` 上 `logs/targeted-acfb385.log` 为 **117/117、退出 0**，全套另见下节。

TD-REL-014 的生产差异仅为 `run_orchestrator` 真正子进程 argv 增加 `-I`。固定参数、CLI 路径、execute/plan 参数顺序、带空格的数据参数、JSON 返回与非零拒绝语义均保留。导入负例实际启动新解释器，分别在 PYTHONPATH 和 staging 脚本目录放置抛错的 `decimal.py`；修复后使用标准库且 isolated/ignore_environment/no_user_site 均为 1，没有 monkeypatch 生产执行链。原 HostFlow 的 `check-evidence → execute → postcheck` 和 81 注册表计数断言继续保留；原服务名停止断言换成恰停止实际重建的完整 ID，禁止 compose stop。

### 12.4 完整 operations、失败保留与源码稳定

`b7c6bac7cd302fede55d9e0b26026cc0c519e268` 的首轮完整 operations 运行了 258 项，257 项未失败、1 项报错，37.719 秒，退出 1。唯一错误是本批 HostFlow 测试替身拦截所有 `docker inspect`，把真实 PostgreSQL `w2-mfg-db-pg` 误送到模拟 API 的 retired 字典，KeyError，尚未完成 happy-path 的真实备份验证。失败日志 `logs/operations-final.log`、对应 HEAD 与退出码原样保留，不改标为绿。

`1a4f086d20f11186e0d8e6edefd5fe34f3f56f77` 只收窄夹具到已知 API canonical/immutable IDs，真实 PG inspect 继续原 command；三份生产源码与 `b7c6bac` 逐字节相同。在该干净快照经 heavy 执行 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/operations -p '*_test.py'`，**258/258、零 skip、36.634 秒、退出 0**；前后 HEAD 相同，受跟踪树干净，见 `logs/operations-round2.log`。使用已准自有回环 `5446/w4_control_stop_ids_test`，口令只从模板指定键经环境传入，不打印、不落盘。现有真实 PG 演练包含在整套中，Docker/API/HTTP 主机动作在对应控制测试中使用明确替身，不能充当真实 R/B 镜像恢复证明。

最后在 **`acfb385beef520393d7588ba6aa8dcb7ae07879e` 干净快照**执行同一完整 operations 命令：**261/261、零 skip、37.646 秒、退出 0**，前后 HEAD 相同，期间未改被测树，日志 `logs/operations-acfb385.log`。为保持该测试快照干净，仅将本批自己的三份待收尾文档保存为树外临时输入，再恢复提交版本；测试结束核对输入摘要后恢复草稿并删除临时输入，没有使用共享 stash。前述 258 项两轮及其源码身份保留，不作为本次 CLI 补强后的回执。

机械证明见 `source-stability-final.json`：应用 `main`、`recover_previous_application`、原 `stop_bound_api` 与 `restore_api_on_failure` AST 全等；预检除返回原 ID 外判据 AST 全等；生产 gate 除新增纯 helper 外整个 AST 全等；orchestrator 函数除显式 `-I` 外 AST 全等；81 SQL 原字节及其原钉定保持，APPROVED 后缀仍为 0073–0081，所有者裁定首节原字节保持。应用控制允许变化的既有函数只有 precheck/backup/纯 scope 适配，apply 只有 main/run_orchestrator，未扩修其它 legacy 路径。

本批 artifacts 为 `/home/jinhuit/Kingturf/kingturf-coord/wave4/control-stop-ids-artifacts`；各轮原始日志、稳定性 JSON 与脱敏结果保留。最终格式、文档链接、结构、边界和差异检查见 `logs/final-checks-acfb385-summary.log`（旧 `final-checks-summary.log` 为 CLI 补强前的检查，不混用）。专用测试库与容器保留供主协调复核；本树完整 CI、两层真实恢复及发布仍由主协调实施。

主协调已复核最终源码差异、117/261 回执与稳定性记录，将交付 `09e3e352a72cd380d3e2bfc59585d0bd9c97d5d7` 合入集成提交 `5ddfa9e`；冲突仅在文档索引，已同时保留集成构建证据和本节入口。生产源码与测试取交付分支原字节，合并检查未改动业务或迁移。合并提交标 `[未测试]`，最终集成完整 CI 与真实恢复仍待执行。

## 13. 运行镜像最小封装（TD-REL-015）

本批在独立工作树 `/home/jinhuit/Kingturf/kingturf-coord/wave4/runtime-image`、分支 `fix/w4-runtime-image` 实施，基线 `514d8f4e2948dc2c51bf8dfd73f5f4c62eaa792e`；原 FN2、transport、R 工作树均未修改。主协调提供该基线完整 CI 退出 0 的回执；本批完整 `ci:local` 和 production 字节的浏览器复验仍由主协调集成执行，各提交标 `[未测试]`。本节记录真实本机构建、扫描和运行，不是 `release-images` 成功物料，也不是兼容恢复演练报告，TD-REL-011／015 的发布放行仍待主协调后继验收。

### 13.1 原阻断、实施顺序与封装边界

真实 R/B images run `45796321430`／`45796346483` 均在 API HIGH/CRITICAL 门退出 1，未生成可用的原 tar/source artifact；旧失败 R `ecb3ded74dde454725265f0c7ea354a4e80ef9b5` 历史保留。主协调用 `aquasec/trivy:0.70.0` 复扫公开 B API 原根摘要 `sha256:702ff8214cd4a41b994f1a0a82a4ca03e605e3b9fdc930f1101509d4f9a1af17`，为 **63 HIGH、2 CRITICAL**：Debian 12.15 的 39 项 OS 命中均无该发行版 FixedVersion，另 26 项来自残留的 pnpm／npm 工具及依赖。不能把这些发现解释成全部项目业务依赖都要升级，项目 prod audit 与镜像扫描是不同证据。

本批从原 B-job 日志精确取得 Web 原根摘要 `sha256:32d9da665094727b1e925dc6ac7b18dadb1ebd38273971951b3365c30cbcc7ce`，匿名实扫退出 1，**57 HIGH、1 CRITICAL**，不是假定 Web 已通过。旧 Web 附带 image-filter、GeoIP、njs、XSLT 及其依赖，现有固定 Nginx 配置不使用这些模块。

提交顺序（均 `[未测试]`，表示未由本代理执行最终完整 CI）：

| 提交                                       | 内容                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `5ad55686de258a466ef03cb36a2a4e5d26c1f716` | 先登记 TD-REL-015，保留所有者裁定首节                             |
| `985641c270b51ee356f4f0e13b588fff69827024` | API 独立依赖阶段与受维护的最小运行层                              |
| `35cc30b217f7f13d306893a57bc585af492e803d` | Web 独立最小运行层                                                |
| `69b8611726c56f456673f57c89bd1ce34ffefb2a` | 补回原字节相同的供应商 `50x.html`                                 |
| `158baf69fecb51264063992dbd2601e20c6aa17b` | 去掉多余 GNU wget，保留原 BusyBox 健康命令 GET 语义；最终源码冻结 |

API 依赖阶段为 `node:24-alpine3.23`，仅安装 `@kingturf/api...` 工作区闭包的生产依赖；运行阶段从 `alpine:3.23` 升级维护包后仅安装 `nodejs~24`、CA、完整 ICU 与实际库依赖。本次为 Alpine **3.23.8**、Node **24.22.3-r0**、30 个 OS 包，运行层不带全局 npm、Corepack、pnpm 或其缓存。API 原大小 408,371,291 B，本次 192,402,169 B。Web 使用维护后的 Alpine、Nginx **1.28.3-r10**、CA 和基础 BusyBox，共 19 个 OS 包；原 96,414,231 B，本次 30,016,271 B。APK 数据库和版本元数据完整保留，没有 ignore、排除扫描、降严重度或 ignore-unfixed。

两个镜像的原缺省 User 均为空（实际 UID 0），新镜像保持；API 保留 UID/GID 1000 的 node 账号。构建时创建附件目录并设 node:node／0750，运行时没有入口 chown，不改现有宿主挂载的所有权。`/app/apps/api/src/server.ts`、`/app/packages/database/src/cli.ts`、全部 81 原 SQL 与 Node transform-types 命令保留原路径。Web 原 Nginx 配置及 Compose 字节不变；直接使用 BusyBox wget，不能用 GNU wget 改变原健康命令的请求方法。

构建阶段仍固定项目 pnpm **10.33.4**，该版本在既有报告中的工具漏洞边界未消除。本批没有全量扫描并认证构建阶段无漏洞，也没有升级业务依赖、全项目 pnpm 或锁文件；最终运行镜像零发现不代表整个构建工具链零风险。基础镜像与 APK 仍按维护分支获取更新，未来重建必须重新捕获实际摘要、库存和扫描结果。

### 13.2 实际镜像身份与完整扫描

全部构建和扫描经 `coord/bin/heavy`，从各提交的不可变 `git archive` 构建；使用本批 `docker-config/config.json` 的空 auth 配置，没有读取真实环境或生产凭据。证据根目录为 `/home/jinhuit/Kingturf/kingturf-coord/wave4/runtime-image-artifacts/`。

下列摘要是**本机 BuildKit OCI index 根摘要**，与该 daemon 报告的 image ID 相同。已从各原保存 tar 读取对应 blob、验证其 SHA-256 和 index 类型，见 `local-image-identities.json`；不是把 config 摘要当根摘要。镜像仅有本机 tag，没有推送或成功的 GHR run 绑定。

| 服务 | 实际构建源码                               | 本机 tag                               | 本机 OCI index 根摘要                                                     | linux/amd64 manifest 摘要                                                 |
| ---- | ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| API  | `985641c270b51ee356f4f0e13b588fff69827024` | `e2e-harness-runtime-api:985641c270b5` | `sha256:3f0e702787f4f194909f88001790b51afa347986c21468523ce0b95516752c7b` | `sha256:c942e545745008a015b012052627253414dfb3a502f888e545daa3d8d5ac3371` |
| Web  | `158baf69fecb51264063992dbd2601e20c6aa17b` | `e2e-harness-runtime-web:158baf69fecb` | `sha256:d5221fb8cd485ab78525df7b3aff7b070b2cc753e42c8a4682c9d6cd9a19874d` | `sha256:57f0a7a3861f0396e1f52e80d18bc66b1d1660446655b0918ba58f780c83cdbd` |

API 原保存 `image/image.tar` SHA-256 为 `0f08d814184d44bc8767729035ac358f597ca6a897e2c696954051e80e486856`，Web 为 `0323b6430a98da6e2fd47a2e54525ab5e676f7423e6fa26b13dd7907956a86d7`。它们只是本机扫描输入，不作为恢复原 tar。实际构建输入 archive 分别为 `c4e9f78d54507e359b48fb19c45aa1c8f1340cbfab3294899cac6ac81607b5b2`、`b2cb3d067dbbab808a1a21ba206328a823a13b94556009e6ff0a77ea0f813ba9`；原始 build metadata、完整日志、镜像保存字节和扫描 JSON 分别在 `builds/api-985641c270b5/`、`builds/web-158baf69fecb/`。

同版 Trivy **0.70.0** 每个镜像真实运行两次：`--scanners vuln,secret --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1`，以及原阻断口径 `--severity HIGH,CRITICAL --exit-code 1`。四次均退出 **0**，所有级别漏洞和秘密发现均为 **0**。

| 完整报告（相对证据根）                      | 原始 JSON SHA-256                                                  | 退出码／发现 |
| ------------------------------------------- | ------------------------------------------------------------------ | ------------ |
| `builds/api-985641c270b5/reports/full.json` | `2415c7e2f4493be35dce6a2e89c3cb8a42378300ab813c9ff1e3f29bc864210c` | 0／0         |
| `builds/api-985641c270b5/reports/gate.json` | `081c5bebf15044b14900c3a0432c1248eb3a7d6a5a83f12d83f7516891049bbf` | 0／0         |
| `builds/web-158baf69fecb/reports/full.json` | `3e5594963db377d0b350f7b76b7e630e4ad12c6ec9b6a362c5f52337bf80f657` | 0／0         |
| `builds/web-158baf69fecb/reports/gate.json` | `9376c26e5aad163c7ab4fc82d119f26d99531a938336d9cc02c7e6793ee5b2cb` | 0／0         |

### 13.3 真实运行、原 CLI 与权限契约

最终启动器 `validate-runtime.py` 以明确的 Web 源码 SHA 选择已扫描镜像；通过回执 `validation-1caf153f8f/result.json`，原字节 SHA-256 为 `79e2ee3db5cab347b3463e440f0ae003d1b39105fd628d0cf939fe5786fb6249`，启动器 SHA-256 为 `4242edf8835a7cd7322150e60794034242434298d4528ba5277e29dd1f82383f`。该轮 14 组检查全部通过，日志 `logs/17-runtime-final-validation.log`，每条实际 Docker／CLI 命令与脱敏 stdout/stderr 另存编号日志。

| 契约         | 实际结果                                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 原迁移 CLI   | UID1000、只读 rootfs，原 `node --experimental-transform-types packages/database/src/cli.ts`；回环合成库 guard 通过，production migrate 两次均 0，status 恰 81 条、全部 applied，实际与已存 checksum 全等        |
| SQL 字节     | 镜像中 `/app/packages/database/migrations` 恰 81 个原路径 SQL，逐文件 SHA-256 与工作树完全相同                                                                                                                  |
| PG／TLS      | 自有 PostgreSQL 17.7，真实 `pg_stat_ssl` 为 TLSv1.3、TLS_AES_256_GCM_SHA384、256 bits；移除合成自签 CA 后必须以 `DEPTH_ZERO_SELF_SIGNED_CERT` 拒绝，未把一般连接失败算通过                                      |
| API 生产启动 | NODE_ENV=production，UID0 与 UID1000 均用原 CMD 启动；直接 health／ready 为 200，version 为指定真实 API 源码 SHA 与 production                                                                                  |
| 写闸         | UID0 启闸时 POST login 为 503；UID1000 无闸时同类未知用户 login 为 401，实际进入原认证路径；未执行真实业务认证写                                                                                                |
| PID1／退出   | 两种 UID 的 `/proc/1/exe` 均为 `/usr/bin/node`，cmdline 精确为 `node --experimental-transform-types apps/api/src/server.ts`；原 Node 健康命令 0、Docker healthy，实际 SIGTERM 后均退出 0                        |
| 附件卷       | 两份自有 bind 分别属 UID0／1000，实际 LocalAttachmentStorage put/get/delete；内容含中文、原字节往返相同，文件 owner 与运行 UID 一致、权限 0600，删除后不存在；初始化／清理所需 chown 仅在自有夹具 helper 中执行 |
| Web          | 最终镜像实际反代 health／ready／version 与 API 相同，首页和原字节 50x 可取；原 Compose `wget --quiet --tries=1 --spider http://127.0.0.1:8080/health` 真实退出 0，Docker healthy                                |
| 资源回收     | 自有容器／网络剩余均空，附件 bind 清空并恢复宿主 owner，合成 TLS 私钥删除，cleanup_errors 空；未停止或删除外来网络／容器                                                                                        |

因宿主 Docker 地址池耗尽，最终夹具没有申请新子网：自有 PG 父容器使用默认 bridge、仅向宿主 127.0.0.1 随机发布 API/Web HTTP 端口；PG 仅监听该自有 namespace 的 127.0.0.1:5432、不向宿主发布。CLI/API/Web 只加入该父容器 namespace。连接串和合成秘密只经子进程环境传递，命令日志落盘前脱敏，未写连接串文件。

另以旧 B0 与新 API 的实际 PasswordHasher 双向验证 scrypt，均接受对方生成的测试 hash、拒绝错误口令；UID1000、只读 rootfs、无网络。两者 Node 都是 v24.22.3；ICU 由旧镜像的 78.3 变为 76.1，Node 内置 tz 数据由 2026e 变为 2024b。zh-CN／en-US、固定日期中文输出 `2026/11/26 08:00:00`、Asia/Shanghai 与 America/New_York 的本地小时均通过，见 `scrypt-intl.json`。这是具体 locale／时区兼容性检查，不是所有 ICU／全球时区规则的穷尽证明；TLS 检查针对本轮合成 PG CA，没有访问生产数据库或外部业务集成。

### 13.4 静态字节、保留的失败与后继验收

`static-web-158baf69fecb-comparison.json` 保存最终实际镜像目录的完整 raw SHA-256 map：与旧 B0 **50／50** 文件完全相等，missing／extra／different 均空。与主协调同 514 源码 production 构建的 **49／49** 文件完全相等，仅多原供应商 `50x.html`，其 hash 为 `876766b4e80133fd490603e073d3567425b88794828a9292104244c9e40875ed`。主协调 map 路径为 `integration-artifacts/build-mode-514d8f4/production-map.json`，原字节 hash 为 `92a35475bbca7a69fb7061a81e96bc5928868a1ca553f4040c4d61439010af00`；没有只比文件数／长度、gzip 或归一化后的字符串。

原浏览器验收的 test-mode dist 与 B0 production 的真实差异另存 `reference-static-comparison.json`：18 个 hashed 文件名以及 index／manifest 原字节不符。主协调以同源码同 cwd 仅改 NODE_ENV 的因果实验确认，独立登记 TD-GATE-007 并提交 `775445d`，只将 `ci:local` 的 build 子命令显式 production；后继浏览器验证由主协调重跑。本树没有把镜像构建改成 test 来凑一致，没有抹去原差异回执。

失败历史原样保留：

1. 初版 Web `35cc30b` 扫描为零，但目录比较发现缺原 `50x.html`；实际 APK vendor 页与 B0 字节相同，在 `69b8611` 独立补回并重建扫描。初版报告和比较仍保留。
2. `validation-29756d644d` 在申请测试网络时因地址池耗尽而停，服务尚未启动；结果 passed=false，零残留。随后只改夹具采用自有父 namespace，没有删除外来网络。
3. `validation-cde4754a68` 的附件夹具初始化和清理因辅助 root 去掉全部 capability、不能遍历宿主 UID1000／0750 目录而失败；原编号日志和当时脚本保留，另记中断结果。仅给夹具初始化／清理加 CHOWN、DAC_OVERRIDE、FOWNER；服务和附件实际操作不借这些初始化权限，旧私钥与资源已清。
4. `validation-0e9b15274b` 的裸 AssertionError 和 `validation-8c5e5b4d3d` 后继 traceback 保留；后者明确定位 `/proc/1/comm` 实际为 MainThread，错误地要求它等于 node。改为核实际 exe／完整 cmdline，并检查真实 SIGTERM 退出，没有修改服务源码或启动命令。
5. `validation-8a03e717e4` 发现本批新增 GNU wget 默认 spider 发 HEAD，实际 Nginx 日志 HEAD health→401、命令退出 6。`wget-behavior-comparison.json` 在同一自有 loopback GET-only 夹具上证明：旧 B0 wget 为 GET／0，新增 GNU 为 HEAD／6，新镜像自带 BusyBox 为 GET／0。`158baf6` 独立移除 GNU 包后重新构建、双扫描和完整运行通过，没有改 API、Compose、Nginx 配置或健康命令来迁就新工具。

最终源码白名单仅两份现有 Dockerfile；交付文档白名单为本证据、tech-debt-tracker 和 docs/index。`source-conservation-158baf69fecb.json`（原字节 SHA-256 `b77d640a5ffdb408621daf6557f494226e73cb988d1b4ca45e576f4b5ca4a342`）精确对账基线／最终 `158baf6` 冻结源码：整个 apps／packages、工作流、所有 package／锁文件、Compose 和 Nginx 配置的 Git 对象均相同；API 实际构建输入在最终冻结中也相同，SQL 已有上述镜像内 81 文件逐字节复核。旧 `source-conservation.json` 仍绑定 `69b8611`，作为历史保留，不覆盖；新回执另核 `69b8611→158baf6` 只有 Web Dockerfile 的 GNU 包／注释差异。所有者裁定首节原 4,761 字节 SHA-256 `58e30a61b3bf70b7c9e313d2b498140e9a14d814f5266da7d68d5823a4414830` 完全保留。

新 R 仍由主协调在另树构造，要求业务源码与 L `5dc88e5c922ff731e2cfeb949b28c5cd8c333032` 保真，仅纳入已批准的 81 pin／SQL 与必要封装；本批未改旧 R、批准文件、恢复 driver、工作流或发布锁，未 push／上传／部署。真正 GHR 双镜像原物料、两层恢复、恢复后认证写和最终集成 CI 必须另行实跑；本机运行验证明确 `recovery_drill=false`，不能替代这些材料。
