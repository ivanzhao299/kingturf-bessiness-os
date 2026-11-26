# 发布步骤摘要修复（TD-GATE-006）

日期：2026-11-26。关联：台账 TD-GATE-006；代码提交 `537634d`（fix(ci): write release step summaries with printf）。工作分支 `fix/w2-gate-006`（基线 main@4a93003）。产物日志与探针脚本位于仓库外目录 `kingturf-coord/wave2/gate-006-artifacts/`（不在版本库内，以下仅作文字路径记录）。

## 1. 缺陷

发布工作流 build 任务的「Emit immutable digests」步骤用无引号 heredoc 写步骤摘要（`cat >> "$GITHUB_STEP_SUMMARY" <<EOF … EOF`），同一缺陷在两个文件各一处：

- `.github/workflows/release.yml`（修复前第 120–124 行，sha 取 `${{ needs.validate.outputs.commit_sha }}`）
- `.github/workflows/release-images.yml`（修复前第 157–161 行，sha 取 `${{ inputs.commit_sha }}`）

无引号 heredoc 正文做命令替换：Markdown 反引号包住的镜像摘要（`` `${{ steps.api.outputs.digest }}` ``）被 bash 当作命令执行，摘要里 API/Web 两行的值为空，日志出现 `command not found`；job 退出码与写入 `GITHUB_OUTPUT` 的两行不受影响。

## 2. 修复

两处摘要步骤改照 release.yml 的 post 任务「Publish release summary」步骤（第 368–383 行）已有的 printf 样式：

```bash
{
  printf '## Release image digests (%s)\n' '<sha>'
  printf -- '- API: `%s`\n' '<api_digest>'
  printf -- '- Web: `%s`\n' '<web_digest>'
} >> "$GITHUB_STEP_SUMMARY"
```

以 `-` 开头的格式串写成 `printf --`。硬约束逐项遵守：步骤名、`id: digests`、写入 `GITHUB_OUTPUT` 的两行、env、needs、job 依赖一概不变；每个文件的 diff 恰好是摘要那 5 行（两文件合计 10 insertions / 10 deletions）；未采用给 heredoc 定界符加引号的方案；`.github/workflows/ci.yml` 零改动。

## 3. 静态守卫与接线

新增 `tests/workflows/step-summary-heredoc.test.mjs`（node --test，写法参考同目录 actions-sha-pinning.test.mjs）：扫描 `.github/workflows` 下全部 `.yml`/`.yaml`，断言「无引号 heredoc（`<<EOF`、`<<-EOF` 等定界符未加引号）正文含未转义反引号」为零，违规消息给出修复提示（改 printf 或给定界符加引号，参考 release.yml 的 Publish release summary 步骤）；单引号里的反引号在无引号 heredoc 内同样会被执行，计入违规。扫描器另带语义用例：quoted heredoc（`<<'EOF'` / `<<"EOF"` / `<<\EOF`）、转义反引号 `` \` ``、`<<<` here-string 在这些用例形态下均不误报（quoted heredoc 正文若出现形如 `inner <<INNER` 的行，其后内容会被按新的无引号 heredoc 处理而报出，方向偏严，边界记录见第 6 节）。接线：根 `package.json` 的 `test:release-guardrails` 命令链末尾追加 `&& node --test tests/workflows/step-summary-heredoc.test.mjs`。

## 4. 验证记录（均在本会话真实执行）

1. 守卫先红（修复前）：`node --test tests/workflows/step-summary-heredoc.test.mjs` 退出 1，恰好报出两处——`release-images.yml:157`（正文反引号行 159、160）与 `release.yml:120`（正文反引号行 122、123）；与 grep 复核的仓库 heredoc 清单（8 处 heredoc 中 6 处已加引号）一致，无额外误报。日志：`gate-006-artifacts/guard-red-before-fix.log`。
2. 守卫转绿（修复后）：同命令 tests 2 / pass 2 / fail 0，退出 0。日志：`gate-006-artifacts/guard-green-after-fix.log`。
3. PyYAML 解析：`python3 -c "import yaml; yaml.safe_load(open(...))"`（PyYAML 6.0.3）对两个 workflow 各跑一次，均 YAML OK。日志：`gate-006-artifacts/yaml-parse.log`。
4. bash 真实执行探针（`gate-006-artifacts/probe-summary.sh`，输出 `probe-run.log`）：用 PyYAML 抽出两文件「Emit immutable digests」的 run 脚本原文（`release.yml` 470 字符、`release-images.yml` 454 字符），把 `${{ }}` 表达式换成样例值（40 位小写 hex、`sha256:` + 64 位 hex）后各为 710 字符，用 bash 执行——`GITHUB_STEP_SUMMARY` 恰好三行（标题含完整 sha、API/Web 两行反引号字面保留）、`GITHUB_OUTPUT` 两行 `api_digest`/`web_digest` 与原语义一致、stderr 0 字节且无 `command not found`。
5. 旧写法对照复现：对基线 `4a93003` 的旧 heredoc 版本（`git show 4a93003:.github/workflows/release.yml`，执行对照实验时 HEAD 即为该基线，产物 `old-release.yml` 与之逐字节相同）跑同一探针——退出码 0（job 不受影响）、摘要 API/Web 两行为空、stderr 出现两条 `sha256:…: command not found`，复现台账描述的缺陷形态。
6. 接线后全量 `pnpm test:release-guardrails` 退出 0（日志 `gate-006-artifacts/release-guardrails-run.log`）：链尾新守卫 2 用例 pass；python 演练 145 tests OK（一条无害 ResourceWarning）；演练 verdict COMPLETED、迁移注册表 FULLY_MATCHED 77 条。
7. `pnpm exec prettier --check` 四个涉改文件（两 workflow、守卫、package.json）全部通过；守卫文件初稿经 `prettier --write` 修正后达标。`pnpm exec eslint tests/workflows/step-summary-heredoc.test.mjs` 退出 0。

## 5. 提交与门禁过程

第一个提交（代码与测试：两 workflow 改 printf、守卫文件、`package.json` 接线）经三轮：第 1 轮门禁「工作树状态检查」未过（守卫文件当时未暂存），第 2 轮门禁「守卫接线检查」未过（接线当时未随该提交），第 3 轮审查通过，已提交 `537634d`。本提交为文档提交（证据、索引、变更历史、台账），是本任务最后一个提交。

## 6. 边界与未验证事项

- **线上效果待下一次发布验证**：修复的运行时行为只有下一次发布流水线真实运行才能看到；本地已以 bash 探针等效验证脚本级行为（第 4 节第 4、5 条），未做任何生产操作。
- 未跑 `pnpm ci:local` 全量（其 15 步链含 API/Web 全套件与 PG 集成测试，见 `docs/GATES.md`，不含 e2e）；e2e（`pnpm e2e:p1`）不在 `ci:local` 内，同样未跑。本次验证范围如第 4 节所列，本任务不涉及数据库与浏览器改动。
- 守卫扫描器的已知边界（主协调合并复核时实测，2026-11-26）：① quoted heredoc 正文里若出现形如 `inner <<INNER` 的行，其后内容会被当作新的无引号 heredoc 正文，其中的反引号会被报出——这一条只会多报、不会因此漏报，简单形态（本仓库现状）无误报；② 有两处会漏报：动态定界符（如 `<<$DELIM`）不会被识别为 heredoc；同一行先加引号、后不加引号的两个 heredoc（如 `cat <<'A' <<B`），扫描器在加引号的那个处跳过，第二个的正文不被检查。两种写法在 bash 里都会执行反引号。现有 workflow 没有这些写法；若日后出现，需先扩展 `HEREDOC_START` 的识别。
- 台账主表 TD-GATE-006 行仅更新状态格；顶部「2026-11-25 第十次发布与集成复核」小节内登记该缺陷的历史段落按 R5 保留原样。

## 7. 正式流水线后继验证

2026-11-26 UTC正式release.yml run45871553369（北京时间27日，B120d6fc／固定C1控制5ab1cea）五任务全部success。build中的Emit immutable digests、post中的Publish release summary均成功，原构建与post日志没有command not found；实际API/Web摘要与正式原包及部署回执一致。日志持久位于kingturf-coord/integration-artifacts/production-release-120d6fc-control-5ab1cea/completed-job-logs，build SHA-256为8520c16715a57cade9b9fc9d29ea927bb9969e0689e02e23600adff554465ab2，post为b3fd30c269a3f393c85002edcb0ce198fea3b7ba15d50ef97df879193404378b。

本节补足原§6的下一次正式执行证据，不改写独立开发批当时未跑完整CI／生产的历史；主协调B/C1完整本地CI及本次正式verify均已实际通过，详见[第十一次发布](ux-wave-release-2026-11-24.md#17-第十一次发布-120d6fc2026-11-27北京时间)。本次核对原运行日志与输出绑定，未另抓取GitHub步骤摘要的视觉呈现。
