# 3a 商业 HTTP 工厂（2026-10-16）

历史小步快照；唯一现时总表见[3a检查点](frontend-3a-checkpoint-2026-10-16.md)，文中“待CI/下一未开始”保留原时点，由后补实测与总表覆盖。

基线 `1a7c4a9` CRM工厂稳定干净HEAD完整CI真实0/174221.138ms后启动本步，不实施3b/3c控制器或视图迁移。

## 迁移与逐字守恒

原bootstrap的完整 `export const createFetchCommercialApi` 箭头工厂 → `shared/commercial-http.ts`，完整箭头116行/AST4，模块120 split行。运行依赖只原http json/requestId，同一模块实例；保留全部对象方法/游标循环/上传checksum和base64/await及幂等键求值顺序，不改receiver，不把函数改成外层大factory。

必要纯类型Opportunity、CommercialApi、CostMatrixAttention、CostMatrixSort、CostMatrixQuery、CostMatrixPage → `commercial/types.ts`（58 split行/AST0），bootstrap保留原六类型和工厂公开facade。夹在旧类型间的technicalSolutionOpportunityId和后续initialCostMatrixQuery留原位。类型均编译擦除，无域运行反向依赖bootstrap；这是3a必要类型桥接而非提前业务域实施。

主代理证明 `/tmp/kingturf-3a-commercial-http-conservation-2026-10-16.log` 真实exit0：整个箭头factory、原两段types逐字相同；去新增四个import/export并回填旧三块后整个bootstrap逐字相同。模块800/完整函数200/AST5均满足，解析错误0，结构0硬/31旧豁免；bootstrap15590→15433 split行净−157，包含facade开销。

## 524089d 读取映射、绑定与变异

仅适配 `bootstrap.test.ts` 的 `provides product-grade register controls for high-frequency business records`：旧source单读 `./bootstrap.ts` → 新source组合仍在原位置的bootstrap UI正文与 `./shared/commercial-http.ts` 原工厂正文。其余it读取与预算路径不改。原全部expect调用行/匹配字面/顺序保持逐字相同；样式读取不变。新增两读取非空、原workspace函数锚存在、工厂真实export锚存在且唯一检查；原游标语句仅存在新实际工厂，不存在bootstrap残留字符串/死实现。组合读取延续原源码集合，不弱化正向/负向语义。

真实序列（指定用例各1、86 skipped，独立于全量114）：

- 未适配旧读取先真实exit1，命中已迁出分页代码：`/tmp/kingturf-3a-commercial-http-old-read-red-2026-10-16.log`。
- 适配读取真实exit0：`/tmp/kingturf-3a-commercial-http-read-green-2026-10-16.log`。
- 新shared工厂 `cursor = page.nextCursor` 临时改 `cursor = null`，指定原用例真实exit1、命中原cursor断言：`/tmp/kingturf-3a-commercial-http-mutation-red-2026-10-16.log`。
- apply_patch完整还原后指定用例exit0，随后全web114绿：`/tmp/kingturf-3a-commercial-http-mutation-restored-2026-10-16.log` 与 `...-web-2026-10-16.log`。旧oracle不为迁移改语义，临时变异未提交。

## 检查与回滚

后补：独立源码/证据提交 `af97961` 稳定干净HEAD完整CI真实exit0，单调计时173798.915ms，`/tmp/kingturf-3a-commercial-http-head-ci-2026-10-16.log`。API117/17099、web114、原PG、database68/domain14、纯JS4、预算11368/1898、结构0硬/31旧豁免、audit无已知漏洞，完成后才启动navigation。

提交门禁一次失败：pre-commit ESLint要求新增读取guard的 `indexOf(anchor)<0` 改为 `!includes(anchor)`（prefer-includes）。未绕过hook/未生成失败提交，改等价guard后重新跑指定测试/原web114及提交门禁；不涉及业务源码或expect改变。

新产物CDP Nvpg7i真实exit0：Chrome154.0.8037.99/PID15204/127.0.0.1:54313，owned preview2205690；七场景32 DOM/3 viewport/25 route/10 text/10 overflow，网络blocked/unknownAPI/failedAPI皆0，preview/process/profile全部清理。日志 `/tmp/kingturf-3a-commercial-http-cdp-2026-10-16.log`，截图 `/tmp/kingturf-cdp-preflight-Nvpg7i-probes.png`；全精确合成stub，真实新工厂经过成本/报价GET及迟到竞态，不覆盖上传/写入/全部游标页/真实账户或Playwright，不计入web114。协调与独立只读reviewer核对实际候选、原两分页模式仅新工厂各1处、组合读取与真实红绿日志，均无阻塞；未运行测试或写入。

原web9文件114、typecheck、capabilities39/19通过；metrics177源文件52714 split行（`/tmp/kingturf-3a-commercial-http-metrics-2026-10-16.log`）。build预算JS11368/CSS1898 gzip、阈值12000/4000不变（`/tmp/kingturf-3a-commercial-http-build-2026-10-16.log`）。CDP与独立HEAD完整CI随后记录，不能以旧CRM CI冒称本步全链。

本小步独立回滚到1a7c4a9，工厂/必要类型/facade与这处测试读取同步撤；保留前form/locale/CRM/C3。无新依赖/后端/packages/SQL/workflow/生产/push/部署，navigation/3b未实施，原31与评分/债务、Playwright九spec冻结未执行及阶段5前真实补跑义务均保持。
