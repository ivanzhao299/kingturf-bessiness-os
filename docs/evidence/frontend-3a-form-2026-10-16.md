# 3a 公共 form 小步（2026-10-16）

## 基线、候选与守恒

基线 `175be7d` 的新 web C3 护栏协调复核通过。主代理完整 `pnpm ci:local` 真实退出 0，Node performance.now 单调计时 **169277.626ms**（`/tmp/kingturf-web-c3-head-ci-2026-10-16.log`）；协调读取已完成原会话命令元数据为 **175385ms**。两项计时来源不同，并列记录、不混成同一测量。该时点工作区干净。

本小步仅从 bootstrap 提取连续 FormField/openForm/openFileForm，新增 `shared/forms.ts`；调用方直接 import 两函数和 type-only FormField。共享模块仅运行时依赖原 `dom.ts` 的 el/setOperationStatus，无反向 bootstrap 依赖，无顶层 DOM 操作、缓存、wrapper factory、异步初始化。类型仍供 CRM 数组和治理签名使用，不留假字符串或死代码迎合测试。

| 旧基线位置                            | 新目标                                  | 实测                                |
| ------------------------------------- | --------------------------------------- | ----------------------------------- |
| bootstrap.ts:11925–11950 FormField    | shared/forms.ts:3–28 export type        | 类型 AST 正文逐字相同               |
| bootstrap.ts:11951–12125 openForm     | shared/forms.ts:29–203 export function  | 完整175行，AST4；参数与body逐字相同 |
| bootstrap.ts:12126–12186 openFileForm | shared/forms.ts:204–264 export function | 完整61行，AST4；参数与body逐字相同  |

新文件265行（split换行含末尾空项；非空末尾口径264），整体AST4，解析错误0，满足800/200/5；不是凭片段量函数。保留字段创建顺序、脏状态双确认、FormData trim、receiver/闭包、then/catch/finally、close移除DOM、文件严格 `>26_214_400` 判断。主代理 TS AST 比较参数/body/type，独立reviewer只读核验；协调另将新块去export回填并删唯一import，整个bootstrap逐字还原。旧31豁免不提前撤销。

## 冻结测试读取适配与真实变异

按524089d条件授权，仅适配 `bootstrap.test.ts` 文档编辑器测试的切片组织：读取路径仍 `./bootstrap.ts`；起点仍 `const openOnlineDocumentEditor`；终点由迁走的 `type FormField` 改为紧邻被删块后的 `const displayTime`（旧12187）。新增起终点存在、唯一、有序、非空及原起锚绑定检查，防 `indexOf=-1` 静默误绿。原全部 expect 行逐字相同，其他读取/业务夹具不改。

主代理从 `git show 175be7d:apps/web/src/bootstrap.ts` 取旧editor切片，与新切片字节完全相同。实际扰动仍被新锚绑定的 bootstrap editor：`activeVersion = saved.currentVersion` 临时改为自赋值，运行指定测试，真实 Vitest exit1（1 failed、86 skipped），命中原版本更新断言；随后 apply_patch 完整还原，指定测试 exit0（1 passed、86 skipped）。日志 `/tmp/kingturf-3a-form-mutation-{red,restored}-2026-10-16.log`。这是每适配测试文件的真实红绿，不冒充 shared/forms 的直接单测；共享表单另有正文逐字比较与浏览器运行验证。

## CDP 旧产物基线与失败史

新增合成 session 的 customer:create 权限仅为了打开原表单；原业务测试夹具不改，stub仍仅允许既有精确GET，任何POST/未知API失败封闭。浏览器七场景独立于web114、API17099、Playwright。

新增探头经实际菜单进入概览→真实鼠标打开新建客户→Input填写名称/编号→验证值/required/minLength→点击取消并拒绝原生confirm、验证表单与值仍在→再次取消并接受confirm、验证close移DOM→返回客户路由。confirm预期先于click注册，严格同session/type/原提示，3500ms有界；未知dialog停止，不输出提示内容/fixture记录。**仅覆盖打开/填写/dirty取消两分支，不覆盖submit、文件上传、原生Esc。**

旧产物保持 `175be7d` 完整CI构建输出、尚未重建：首次 wyJgGp（Chrome PID23596，127.0.0.1:63874，preview2119447）真实exit1，因新建客户按钮属于概览而客户路由不可点击；没有改可见性/业务实现兜底，修正探头先走真实overview菜单。日志 `/tmp/kingturf-3a-form-old-cdp-2026-10-16.log`。第二次 6eDNFm 真实exit0，七场景通过，DOM32/viewport3/route25/text10/overflow10；route是重复断言次数，独立路由现为overview/customers/costing/quotes四种，不能回写旧六场景/三路由历史。日志 `/tmp/kingturf-3a-form-old-cdp2-2026-10-16.log`。两跑owned preview/process/profile清理均成功，第二跑网络blocked/unknownAPI/failedAPI皆0。

## 当前验证与回滚

独立源码/证据提交 `86e7026` 稳定干净HEAD完整 `pnpm ci:local` 已真实exit0，单调计时182105.292ms，日志 `/tmp/kingturf-3a-form-head-ci-2026-10-16.log`：API117文件17099、web9文件114、database68/domain14、原PG、纯JS4、预算11367/1898、结构0硬/31豁免、audit无已知漏洞，未并发browser/共享注入。完成后才开始locale。该提交body概述过切片，但未逐字列旧→新锚点；协调指出后在下一独立locale证据提交body补写并关联86e7026，不amend已测历史。

新产物重新build后，ck1Dbd（Chrome PID62652，127.0.0.1:55423，preview2130775）七场景真实exit0；32 DOM/3 viewport/25 route/10 text/10 overflow，与旧产物6eDNFm相同。网络blocked/unknownAPI/failedAPI皆0，owned preview/process/profile全部清理成功。日志 `/tmp/kingturf-3a-form-new-cdp-2026-10-16.log`；截图 `/tmp/kingturf-cdp-preflight-ck1Dbd-probes.png`，SHA256 `09c29344fb53686cf895efac7fe52fc65e1cc6adbc07b49532996baaa8ec4752`，主代理已查看。Chrome路径/版本/flags与旧通道相同，每跑新临时profile；旧6eDNFm PID6824/127.0.0.1:55462/preview2119594。截图仍是成本页结束状态，不冒充表单打开状态截图。

原web9文件114/114真实通过（`/tmp/kingturf-3a-form-web-2026-10-16.log`），重建预算JS11367/CSS1898 gzip（`/tmp/kingturf-3a-form-build-2026-10-16.log`），阈值12000/4000未改；capabilities39 direct/19 governed families通过；metrics已跑（`/tmp/kingturf-3a-form-metrics-2026-10-16.log`），bootstrap split16082→15821净−261，新模块265，总源文件172/52675行。度量的启发式巨函数不代替完整TS AST函数跨度实测。`/tmp/kingturf-3a-form-conservation-2026-10-16.log`保留全bootstrap回填、整块/切片/原expect一致及结构0硬/31旧豁免。补日志时一次apply_patch空hunk校验失败、无文件写入，修正patch后正常追加；无业务行为修正。

候选只读reviewer及协调均无阻塞，未并发DB/浏览器/共享树注入。新产物浏览器、web114、预算、capabilities、metrics已实测如上，完整CI随后对独立提交HEAD执行；旧HEAD CI不等同新源码CI。下一模块locale未启动，不提前3b。

本小步可独立 revert 回175be7d（源码/测试读取适配/新增探头同步撤），不得仅撤forms而留import。护栏175be7d单独保留。无新增依赖、后端/packages/SQL/workflow/生产/push/部署变更。Playwright配置与九spec冻结未执行，阶段5终验前全套真实补跑义务保持；评分/技术债状态不随提取上调。
