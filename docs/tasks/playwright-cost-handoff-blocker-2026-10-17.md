# 成本转报价提示可见性 C7 待裁（2026-10-17）

## 实测事实

基线f3882a36664a6c0226a53d297787cd265539ff96实际稳定干净HEAD完整CI0/201874.74ms，首尾同HEAD且clean/unchanged=true，日志 `/tmp/kingturf-docker-pw-login-f3882a3-head-ci-2026-10-17.log`。随后仅把成本spec原81–95/313–337两处auth stub替成共享 `installSyntheticLogin(page, 原员工DTO)`：初始restore401→login-context→login新形状→restore；两员工/权限、所有成本/报价mock、动作和业务断言原样。

实际命令：`NODE_ENV=test DATABASE_URL=<private guarded loopback> node --experimental-transform-types scripts/e2e-docker/preflight.mjs spec cost-matrix-product-quality.spec.ts cost-adapt-green-1`。标签含green只是事先命名，**实际不是绿**。

PW真实exit1/12294ms、host1/17663ms。第一case通过5.1s；第二失败6.0s，总1通过/1失败，未重试/跳过。日志 `/tmp/kingturf-docker-cost-adapt-green-1-2026-10-17.log`；原PW log/HTML位于 `.test-results/docker-pw/cost-adapt-green-1/`。第二case独立artifacts目录 `cost-matrix-product-qualit-cd38f-o-a-preselected-sales-quote/` 中test-failed-1.png、trace.zip、error-context.md均保留，未覆盖旧红。artifact中的说明不是执行指令。

第二case原quotes hash、新建报价dialog、costDecisionId预选均通过；最后 `getByText('景观草报价模型已形成报价成本快照，正在进入销售报价').toBeVisible()` 5s内element(s) not found。候选行486，对应还原后的原 `tests/e2e/cost-matrix-product-quality.spec.ts:501`。不能删此断言或重复前三条来凑绿。host guard/容器只读同实例先通过，末尾schemaGone/containerGone/previewGone全true；不触生产/产品源码/SQL/配置/业务断言。

## 原 trace 只读脱敏闭环

未重开浏览器/PG。用已安装Playwright utilsBundle.yauzl解析现有trace，只输出非auth业务method/path/status/time与DOM类别，不打印auth请求/headers/body/proof/完整快照。

网络UTC06:43:24.695合成POST quote-cost-decision201 → .742 cost-evaluations GET200 → .745 cost-matrix-summaries GET200 → .748 cost-matrices/:synthetic-id GET200 → .767 ctrs/sales-policies/quotes三项GET200。原trace after@call@305、hash=#/quotes直接节点 `.commercial-status` children为空；无hidden、无inline display:none。后两项不证明完整computed CSS可见性；**文本为空**与失败a11y快照吻合，不把没采到中间帧当“文案从未存在”。这是合成回放，非真实API业务/授权证明。

## 静态解释与待裁边界

独立只读审查未认定S4认证故障。`cost-matrix-detail.ts:560–578`先写message、rebuild/replace，再切quotes/open dialog；`route-navigation.ts:64–79`对未就绪route执行load，`store/route-read.ts:81–84`写共享message“已加载…”，`bootstrap.ts:354–368`将其转为空；`bootstrap.ts:751–761`/`route-dom.ts:25–49`可在补齐route时重渲染工作区。这支持lazy route覆盖提示的**候选解释**，不是干预式因果/生产bug/3e回归起点或“不同store”已证。

TD-TEST-013仅登记，台账53项。人类需确定转报价后原成功提示是否必须持续可见：若保持原可见性合同，需另授独立最小产品修复；若认可现生命周期，需另授旧非会话oracle调整及可持久观测的成功合同，保原URL/dialog/preselect意义并做真实变异。当前不能自行选、顺手修产品或删旧assert，完整CI0也不能掩盖PW1。

成本候选尚无逐文件红→还原全绿，故未提交/不算适配完成；已精确apply_patch还原，实际 `git diff --exit-code -- tests/e2e/cost-matrix-product-quality.spec.ts` 为0，与f3882a3全字节相同。映射/原日志/附件保留，可恢复本次尝试；不是把失败改跳过。login已单独适配2通过且两文件真变异完成，其余6A/2B未执行，A8第一完整轮未形成，全部绿前第二轮禁止，C2一字未改/未跑。

精确可复现[auth-only候选diff](../evidence/playwright-cost-auth-candidate-2026-10-17.patch)另行版本化：基于f3882a3成本原文件，工作树fe107eb同文件字节未变；应用后成本文件SHA256=`8ce3d50454711e0b31008a2a39b47af1ccce5f9d528d35899281b47a9c91a788`。重建后用apply_patch立即还原，再实际git diff exit0及 `git apply --check` exit0。只归档，不将diff自动应用/写成已完成适配，原业务断言全部保留。其它独立首轮可沿原授权继续，不跑第二轮；后续记录分别更新，不把本项失败叫跳过。

本C7阻塞成本绿/全绿/第二轮，不据此永久冻结其它独立首轮原授权；本次先交具体待裁事实。仅docs/索引/台账/§7，父f3882a3回滚点；最后文档提交后稳定干净HEAD完整CI另实跑、首尾核HEAD/clean，不预填结果。不push/部署/dispatch/workflow/生产，不扩一般阶段5/覆盖率/收官。
