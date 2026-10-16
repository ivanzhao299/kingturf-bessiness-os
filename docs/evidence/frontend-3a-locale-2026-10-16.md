# 3a locale 小步（2026-10-16）

历史小步快照；唯一现时总表见[3a检查点](frontend-3a-checkpoint-2026-10-16.md)，文中“待CI/下一未开始”保留原时点，由后补实测与总表覆盖。

基线 `86e7026` form小步已完整CI真实exit0/182105.292ms，工作区干净后才启动本步（见[form证据](frontend-3a-form-2026-10-16.md)）。

## 提取与证据

仅将旧bootstrap.ts:12915–13004两张纯文案表及localizeEnterpriseCopy完整17行移至 `shared/locale.ts`（91 split行/90非末尾行、整体AST3/无解析错误）。status表export供原治理查询与函数共用，eyebrow表保持private，函数export供bootstrap原调用；无依赖、顶层调用、getter、DOM读取或包装factory。两张表提前分配纯字符串对象，所有引用仍在调用函数体内，原three sites表达式/时序未改。

主代理机械证明日志 `/tmp/kingturf-3a-locale-conservation-2026-10-16.log` 真实exit0：去export整个locale块与旧块逐字相同；回填旧块并删新增唯一import，整个bootstrap逐字相同；完整函数17≤200、AST3≤5、模块91≤800；结构0硬/31旧豁免。独立只读reviewer核实际diff与三处调用/治理查询，无阻塞、未运行测试或写入；其一次文字误报“97行块”已纠正为90正文/91含分隔，与机械证据一致。

本步原web全部测试文件与预算脚本相对基线零diff，无新读源/slice适配。递归搜索 `apps/web/src` 下所有9个 `*.test.ts`，以 `ENTERPRISE_STATUS_LABELS|ENTERPRISE_EYEBROW_LABELS|localizeEnterpriseCopy|EXECUTIVE COCKPIT|SHOP-FLOOR EXECUTION|已启用|经营驾驶舱` 未命中（rg exit1），此阴性仅指所查符号/文案，不声称无其他间接覆盖。原web114实际全绿进一步核对，未为迎合测试留原文死代码。

## 运行验证与边界

后补：独立源码/证据提交 `66a2f2b` 稳定干净HEAD完整 `pnpm ci:local` 真实exit0，单调计时171878.057ms，日志 `/tmp/kingturf-3a-locale-head-ci-2026-10-16.log`；API117/17099、web114、原PG、database68/domain14、纯JS4、预算11369/1898、结构0硬/31旧豁免、audit无已知漏洞。完成后才启动CRM HTTP，未并发DB/浏览器/共享树注入。下文“随后CI”为此前提交时点历史。

- `pnpm --filter @kingturf/web test`：9文件114/114真实exit0；`/tmp/kingturf-3a-locale-web-2026-10-16.log`。
- capabilities：39 direct/19 governed families通过；metrics：173源文件/52676 split行、bootstrap15731（form后15821净−90），日志 `/tmp/kingturf-3a-locale-metrics-2026-10-16.log`。
- build/预算：JS11369/CSS1898 gzip，原阈值12000/4000与lazy bootstrap约束未改，`/tmp/kingturf-3a-locale-build-2026-10-16.log`。
- CDP新产物 KWzks2：Chrome154.0.8037.99/PID47348/127.0.0.1:59705，owned preview2164698；七场景32 DOM/3 viewport/25 route/10 text/10 overflow全通过，网络blocked/unknownAPI/failedAPI=0，preview/process/profile全部清理。日志 `/tmp/kingturf-3a-locale-cdp-2026-10-16.log`，截图 `/tmp/kingturf-cdp-preflight-KWzks2-probes.png`。仅四路由合成数据、不是全locale条目/治理数据/21视图/真实API/真实权限矩阵覆盖，不计入web114或Playwright。

本独立提交HEAD完整CI随后串行执行，不以旧form CI冒称本步结果。下一HTTP factory未迁移，不提前3b。回滚本小步到86e7026，form与C3保留；无依赖/后端/packages/SQL/workflow/生产/push/部署更改，Playwright九spec冻结未执行及阶段5前全套真实补跑义务不变，整批评分/债务不提前结清。
