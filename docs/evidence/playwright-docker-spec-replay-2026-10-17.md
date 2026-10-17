# Docker 单 spec 回放证据（2026-10-17）

## 基线和环境执行器

成本小步 `12285318f7756b20d446d45523661eac150d1f6a` 已实际稳定干净HEAD完整CI0/202370.62ms，首尾同HEAD、unchanged/clean=true，日志 `/tmp/kingturf-docker-p1-cost-1228531-head-ci-2026-10-17.log`。API126/17242、Web14/313、无已知漏洞；此CI不是浏览器补跑。

本步沿[原R7](../tasks/playwright-docker-authorization-2026-10-17.md)和[增量R7](../tasks/playwright-docker-rulings-2026-10-17.md)只增加必要环境执行入口：

- `preflight.mjs spec <A文件名> <唯一标签>`；原宿主guard/marker→容器只读同实例核证→owned API/preview后才执行，真实容器127.0.0.1字节转发，镜像/Chrome/配置同原通道。
- `spec-runner.mjs`明确A8精确白名单；B2/C2/未知路径与不合法标签实际断言拒绝，不允许全目录发现。启动原Playwright CLI/原主配置/单worker/retries0，只用CLI独立output和HTML目录隔离证据，标签已存在即拒绝，不覆盖红绿史。stdout/stderr只存该本地结果目录，父进程只输出spec/label/真实exit/耗时。原retain-on-failure trace/截图保持；A用合成会话，不放真实认证材料。原网络stub边界不扩大为全部硬闸。
- 取消信号终止owned Playwright进程组、3秒后强制终止；先drain后清理容器/preview/schema。主机10分钟协作deadline，不称任意OS挂起都可有界结束。退出非0原样使容器/宿主非0。
- `tests/e2e/tsconfig.json`仅给A8/合成helper接现有strict TypeScript工程，沿已有browser配置和已安装API node types；原spec无法被ESLint project service找到的真实错误已确认，接线后原login spec ESLint实际0。无新依赖/规则放宽，不改两份Playwright配置，不执行C文件。

新增的手动 `pnpm exec tsc -p tests/e2e/tsconfig.json --noEmit` **实际exit2**：旧冻结 `document-send-product-quality.spec.ts:154` 把 `headers()['idempotency-key']` 的string|undefined推入string[]。不改该业务断言、不加非空断言/默认值、不放宽noUncheckedIndexedAccess。独立只读确认此额外全A tsc不是原根CI的lint/typecheck门禁，也未证明阻断Playwright；登记TD-TEST-012仅静态候选，若实际阻断原hook/补跑则C7，不声称全A类型通过。原hook/最终CI仍须照跑。

环境白名单断言已通过；实际spec执行/逐处适配/变异/首轮与第二轮仍待下列逐项补记，未运行不填绿。仅fixture/已授三文件oracle可改；其它形状/业务失败C7停报。原[全12份库存](playwright-docker-inventory-2026-10-17.md)、C禁跑与旧延期义务不变。

回滚：本环境小步父1228531，逆序撤后继适配再撤此入口/类型接线，先核相邻依赖；未实际revert。最终最后稳定干净HEAD完整CI另执行，不把前成本CI充后继CI。
