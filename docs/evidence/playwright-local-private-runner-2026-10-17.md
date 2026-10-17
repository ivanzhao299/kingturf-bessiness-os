# B 本地私有执行器验证记录（2026-10-17）

## 授权/当前范围

按[直接P1人裁](../tasks/playwright-p1-artifact-authorization-2026-10-17.md)及[接线设计](../tasks/playwright-local-private-runner-2026-10-17.md)，独立`local p1|runtime label [privacy|interrupt|interrupt-stop]`。只环境/安全观察工具，不改原两config/产品/依赖/种子业务。当前仅候选静态检查通过，隐私/取消探针和真实B尚未运行，不预记成功。

复用原宿主guard/marker/PG只读同实例→owned API/preview回环；P1同schema原完整seed，身份/guardURL仅stdin传容器。B root/repo只读、声明两tmpfs、无Docker raw日志，拒额外持久可写volume/bind；系统特殊mount另有/dev/shm等，不声称只有两处可写。XDG五路径/TMPDIR/Chrome日志/tmp，原始stdout/stderr0600/HTML/error/截图仅临时文件系统。宿主仅固定字段双层重编码，不导出raw/PNG；原截图实际代码保持但证据未保留/未视觉验收。RAM/swap/虚拟化物理零落盘不保证。

## 静态与独立review

`node --test scripts/e2e-docker/private-contract.test.mjs`实际5/5，含精确local/C隔离、固定11/1原case清单、raw错误/标题/附件不转发、索引/状态/时间校验、0 exit缺发现/complete/用例或有失败均拒绝。观察reporter同步收case，异步onEnd写安全summary，错误/未知test令complete=false；子进程真实close、全发现/完成/无重复/全passed才可正常0。host另绑定固定CLI kind/label、probe↔明确privacy参数，非probe须先观察一次真实close/无signal且exit匹配，拒重复result。600s外层有界，原每例timeout/worker/retries保持，覆盖P1固定11×30s加初始化余量。

原`pnpm exec eslint scripts/e2e-docker/*.mjs`、相关Prettier、diff-check最终0；structure-gate0/29原豁免保持。初取消故障注入直接throw在finally被原no-unsafe-finally拒1，改用固定assert注入，不disable规则。

独立只读review初审三处必要收紧已实施：B stop失败不得跳过精确rm，后独立docker ps exact-name核空才报清理；探针不得冒充普通B成功；本地seed失败只固定stage/status不转动态path。额外建议已收紧local宿主异常只报固定phase，A原诊断保持。B`interrupt-stop`用于固定注入stop分支错误后验证实际强制移除；尚未执行，不声称已清理。外部Docker rm/确认失败会安全停报并保schema供检查，不伪报gone。

父bd7e14d为本工具回滚点；P1/runtime会话候选另在工作树，不纳入本工具提交。下一步先固定非秘密privacy探针/只读失配真变异/取消故障，再真实B逐文件及会话真变异；C/第二轮/业务失败原边界保持。最后稳定干净HEAD实际完整CI仍必跑。
