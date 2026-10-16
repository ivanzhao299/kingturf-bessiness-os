# 3b CRM 域（2026-10-16，实施中）

现时状态（后补）：用户已明确批准方案B，R7独立授权 `47a8ee5`、能力读源独立修正 `36b1153` 均已提交，六权限误报阻塞解除；22门禁自测/真实六权限与路径变异及原39/19规则守恒见 `frontend-capability-runtime-graph-2026-10-16.md`。下文所有“待裁定/未改校验器/当前阻塞”是当时停止事实与设计史，保留而不冒作现状。当前3b候选进入源码独立提交/稳定干净HEAD完整CI收尾，尚未声称该域完成。门禁单项绿不是其提交HEAD完整CI；3b/3c顺序与原保护范围不变。

源码提交前度量后补：`/tmp/kingturf-3b-repo-metrics-2026-10-16.log` 为实际repo-metrics结果；bootstrap13757 split，巨石商业/治理仍待后续，原31豁免未撤、评分未更新。该旧脚本只计bootstrap日期内联现9处，library日期只是随真实DOM组迁出，不是3e日期收敛、也不能据此声称全前端日期总量减少。customer360Content/displayTime与原bootstrapView仍真实root桥接，未用空facade或死字面迎合测试。最终全量CI在源码独立提交后的稳定干净HEAD执行；本段不预填exit0。

## 输入与边界

3a源码末提交4406f3e/检查点d222560均稳定干净HEAD完整CI真实exit0；d222560单调171012.835ms，日志 `/tmp/kingturf-3a-checkpoint-head-ci-2026-10-16.log`。3a方法检查点无阻塞，按既有授权直接续3b，无新人工决策。基线采用d222560，与4406f3e业务源码完全相同；行号以本基线TS AST实测为准，不混用旧历史行号。

主代理唯一写入与串行验证。范围CRM controller/shell/records及真实最小共享壳/文档UI依赖；不启动commercial六组、governance、3e日期收敛/惰性God store、3f解析行为修复。无新依赖/后端/packages/SQL/infra/workflow/生产/push/部署。原web114/expect模式/业务fixtures/预算12000-4000冻结，必要读源组织逐处映射、非空/原锚绑定及实际变异红绿。原Playwright九spec仍未执行，阶段5前全部真实补跑义务保持。

## 只读候选与实施顺序

定位修正史：协调早次3b预检把导航工作区行号误标“af97961旧源”；随后直接git show双核，controller10220/shell12428/records13264/bootstrapView13709/replaceRouteView11654属于4406f3e/d222560，af97961实际分别10294/12618/13454/13899/11741。函数正文/跨度和风险不变，本步固定d222560真实oracle，不把错归属改写成未发生过，也不为此重复跑测试。

基线CrmController完整141行/AST3，可先连同实际依赖的CrmPermission/visibleCrmSections原文迁至crm纯类型/控制器，bootstrap保留原公开facade。保permissions与api receiver、Promise.all读序/赋值序、latest-wins selectionSequence/过时失败吞掉、CRUD刷新顺序；不将API业务验证或SQL逻辑前置到UI。

createCrmShell完整835/AST9、createCrmRecords444/AST9，**不得原样整块搬到新文件冒称达标**。主代理已完整读两个函数；readonly reviewer/scout提供跨度/闭包事实，算术误报835写成1835、141写成140已纠正，不采用错误数值。后续以原连续DOM组拆真实函数，逐完整函数≤200/AST≤5/文件≤800实测：

- sidebar共用viewportWidth/sidebarCollapsed闭包，resize与toggle/nav-parent必须读写同一状态，不复制布尔值、不缓存DOM/getter，不优化旧“下一次resize发现断连才移除”生命周期。
- utility/overview、模板下载库、在线文档contextual模块为共享壳职责，不能把整个文档UI误归CRM。按原DOM/append/API启动顺序分组；必要共享helper用真实模块或plain词法引用ports，不反向运行import bootstrap。ports仅传现有函数/不可变绑定引用，立即解构维持裸调用receiver；不预调用缓存/权限/存储，不传动态字段快照，不提前读取未选择分支getter。默认四参数读时点保留在真实bootstrap facade。
- records按原分页、客户列表、Customer360动作、lead行与列表拆分；事件仍闭包捕获相同shell/controller/employeeChoices，刷新仍原bootstrapView保存placeholder/焦点/选区→replaceRouteView→恢复，不强制CRM input身份不变。
- mountWorkspace的并行load、customers/employees引用复制到commercial时点、附加commercial/governance、locale/nav/listtools/insights、旧shell卸载及replaceChildren原序不动。replaceRouteView原先replacement visibility→replace→locale/sectionnav/listtools/insights/wholevisibility不动。

当前为实施输入，不预填新函数跨度/测试成功，不声称3b完成。每段移动须区分完整原文迁移和必要函数分解：后者核原连续语句/分支/捕获依赖与内联等价，不虚称整个835行原函数仍逐字相同。全部原公开绑定与真实facade、原expect字面和最小读取映射另逐项核验。

## 验证与回滚计划

用户明确确认筛选契约：CRM 输入可按原实现重建，验证值、焦点、选区恢复；商业 workspace、菜单和未参与重绘的成本 input 验证节点身份不变。不得升级为 CRM input 身份守恒要求。

补丁诊断史：首次 shell 大补丁未以完整 patch 开头而拒绝；随后类型迁移按名称而非源码顺序生成 hunk，找不到前移的 BusinessDocumentTemplate 而原子拒绝。两次均无文件改动；改为源码顺序、小段替换并检查完整首尾后应用。frame 首轮 typecheck 报 root 已迁走的 visibleCrmSections/APP_ROUTE_DESCRIPTIONS 本地 import 未使用，删除本地 import，保留原公开 re-export；不是业务修复。

实施中诊断：首控制器/权限原文迁移后原web114通过，typecheck真实exit2报原bootstrap四个type import（Lead/CustomerInput/LeadInput/CrmApi）已无本地使用；删除这些本地import但保留原公开type re-export，不用死引用迎合检查。该局部结果不是3b完成/完整CI；后续修后重验。

控制器局部修后typecheck/capabilities39-19通过，`/tmp/kingturf-3b-controller-conservation-2026-10-16.log`核class141/visible helper13/权限原文及整个bootstrap回填逐字相同；controller模块167split/AST3，types103/AST0，0硬/31。随后records分解落盘：customer-records243/AST5、lead-records225/AST4、records59/AST3，typecheck通过；当前尚待语句/捕获对拍与读源锚迁移，**未将此阶段旧contextual slice的indexOf=-1潜在误绿计作114通过**，完整web待实际锚点适配后再跑。bootstrapView原17行与customer360Content/displayTime保留真实root实现，通过plain词法引用ports给新records，不复制getter/状态或推进3e日期收敛。

落盘候选后机械核新模块800/200/5、原31豁免与70公开绑定、source oracle仍绑定真实实现；原web114、预算、capabilities、metrics、完整CDP相关探头（独立计数，非Playwright或真实权限矩阵）、独立只读复核；域提交后实际HEAD完整CI0/干净树。共享DB/浏览器/注入测试严格串行。单域源码提交及回滚基点d222560，源码尚未形成最终提交；3a五独立回滚点继续有效，不盲撤其共享依赖。

## 当前候选实测（未提交、非整域完成）

expect计数纠正：原 `/tmp/kingturf-3b-metrics-2026-10-16.log` 的429只统计matcher调用且receiver直接为expect(...)，遗漏27条 `.not` 和1条 `.resolves` 中间属性链，不是全部expect调用。协调独立AST计457后，主代理按callee为Identifier expect遍历旧d222560和当前文件，再沿属性/调用链取完整断言、removeComments printer规范化，457条全序列相同；旧429直连子集也相同，未改断言。复算成功日志 `/tmp/kingturf-3b-expect-count-correction3-2026-10-16.log` exit0；前两次诊断先误猜28条均not、再误猜余1条rejects，断言分别实报27与resolves而exit1，属于计量脚本假设纠正，未改业务或测试源码。现时计划及本页总计统一457；429仅保留为有明确限定的历史子集口径。

controller、records、frame、共享文档UI均已落盘。十个涉及TS模块（含原types）split行/AST/最长完整有body函数：types103/0/0，controller167/3/27（class整体141不是函数），customer-records243/5/90，lead-records225/4/112，record-ports17/0/0，records59/3/52，shell-frame370/5/174，contextual-documents461/5/106，document-library199/5/191，shell-types93/0/0。完整函数不重置内层计数；frame两个函数173/174，library191，均≤200。实际structure强制0/原31，bootstrap15243→13757 split，原70公开绑定和457个原expect调用（完整断言链）经TS规范化逐个等同。日志 `/tmp/kingturf-3b-metrics-2026-10-16.log`、`/tmp/kingturf-3b-structure-2026-10-16.log`。

守恒证明：`/tmp/kingturf-3b-records-conservation-2026-10-16.log` 对实际新helper在六唯一调用点受限内联；协调另独立纯内存重建d222560原records，规范化body均18457 UTF-16且相同。`/tmp/kingturf-3b-shell-conservation-2026-10-16.log` 对实际sidebar/overview/library/contextual及subject/bindings/cards/online/saved/button全部按唯一调用点展开，完整shellbody规范化35255 UTF-16相同；四默认参数、bootstrapView和六type声明逐字相同。不是声称必要分解后整835/444行原文件字节不变；plain引用/闭包/receiver另经主代理与独立reviewer核查。frame、library/contextual及装配均独立只读复核无语义阻塞。

仅 `bootstrap.test.ts` 读源组织适配，原expect调用/114用例/fixture未改：sidebar、brand从bootstrap→实际crm/shell-frame；下载库→frame+shared/document-library；嵌入文档→bootstrap+shared/contextual-documents+document-library；canonical shipment/cache→bootstrap+contextual；utility→frame+原navigation。各文件非空+原实际函数唯一锚；editor原切片保留，原contextual负向范围改为整个实际contextual模块（包含所有分解helper）+root shell尾及records facade+实际records前缀至原sectionHeader，各切片唯一有序非空，不再允许indexOf=-1误绿。原启动预算路径/阈值未改。

`/tmp/kingturf-3b-web-adapted-2026-10-16.log` 实际9文件114绿。四实际新目标变异（frame侧栏class、library版本文案、contextual在线点击插reload、records前缀插reload）各真实exit1，逐次完全恢复后9/114绿；日志 `/tmp/kingturf-3b-{frame,library,contextual,records}-{mutation-red,restored-green}-2026-10-16.log`。records变异同时触发原运行测试，5红，其余各1红。library变异恢复时单行缩进丢失，被reviewer指出后格式化，不是业务差异。早次 `/tmp/kingturf-3b-old-source-red-2026-10-16.log` 实际6红/108绿，但启动测试后即编辑了测试文件，可能混合读入时点，**不计为干净旧读取红的证明**；只采用后续四次稳定变异红绿。今后测试在返回真实退出码前不编辑文件。

build退出0，预算JS11367/CSS1898（阈值12000/4000），`/tmp/kingturf-3b-build-2026-10-16.log`。Windows授权CDP七场景通过，run UfL9kn、Chrome154.0.8037.99、PID56328/127.0.0.1:63681、自有preview2350088；日志 `/tmp/kingturf-3b-cdp-2026-10-16.log`、截图 `/tmp/kingturf-cdp-preflight-UfL9kn-probes.png`。DOM32/viewport3/route25/text10/overflow10，四不同路由overview/customers/costing/quotes，GET stub session5/customers5/cost6/quotes5/org5/detail2；blocked/unknown/failed均0，Chrome root/profile/preview全清理。仅synthetic GET stub，无真实账号/API/SQL、提交/上传/Esc/全权限矩阵/21业务视图覆盖；原Playwright九spec仍未执行，阶段5前真实全跑义务不变。

## 当前阻塞：能力清单读源授权

变异全部恢复并格式化后，最终局部复验原9/114、web typecheck/lint、doc-lint117、全仓format:check、git diff --check均真实通过；日志 `/tmp/kingturf-3b-final-local-web-2026-10-16.log`、`/tmp/kingturf-3b-format-2026-10-16.log`。能力阻塞独立复现日志 `/tmp/kingturf-3b-capabilities-blocked-2026-10-16.log` exit1；不重复运行明知会在同一门禁失败的全CI、不提交未经完整门禁的3b候选。

`pnpm verify:frontend-capabilities` 真实exit1：脚本 `scripts/verify_frontend_capability_manifest.mjs:5` 仅读取bootstrap，源码迁移后误报business-document:{audit,configure,manage,read,send,translate}六权限缺失。真实权限检查仍在document-library/contextual实现，未删除。已有524089d仅授权web测试/启动预算读源组织，未覆盖此脚本；不擅扩扫描、不加死字符串/注释、不倒搬业务逻辑迎合检查。需用户批准仅将此校验器读取范围扩至实际新web实现，并保留现有匹配规则/39能力与19路径、非空/绑定及真实新目标变异红绿。批准前不提交3b、不称完整CI通过，HEAD仍d222560；未push/部署/生产操作。

### 待裁定的最小读源方案（仅设计，未实施）

协调独立事实复核补充：原校验器实际 `wc -l` 为49行（口头51行不准确，以落盘文件为准）；计划4655/3683的既有适配授权限web测试与启动预算，“verify必须通过”是验收条件而非修改超范围脚本的授权。协调只读实跑原脚本exit1，恰六文档权限缺失、19路径无缺。协调的两个**纯内存候选探针**均对当前真实实现得到39/19：三个显式文件，以及入口静态运行时依赖图当前18个TS文件；图方案另在内存扰动library真实audit字面后断言仅audit缺失。此是独立候选实验，不是正式校验器已修改/CLI负向已完成，也不替代批准后的实际目标红绿验证。图原型首次因已有 `brand.webp?inline` 未归类静态资产而失败，识别已有资产扩展后通过；保留这段工具诊断史，不把它算业务失败或正式门禁变更。

当前建议更新为下表B（整批可持续方案），A保留为本次三个文件的最小备选；两者都待授权。B须额外排除声明文件，不能把type-only模块或未被入口依赖的文件用于补齐权限；当前18文件是本候选时点的独立探针计数，不冻结未来真实依赖图大小。此前只推荐A的会话表述由本补充取代，不变更授权事实。

供review的B方案伪diff（不是已落盘代码）：原 `const web = read(bootstrap)` 替换为 `const webSources = collectLocalRuntimeTsSources(bootstrap, webSrcRoot)`；两处 `!web.includes(quotedLiteral)` 仅替换为 `!webSources.some(source => source.includes(quotedLiteral))`。逐文件原带单引号includes规则不变，不跨文件拼接以免边界形成伪字面；原API输入、authorizeQuery正则、Set去重/排序、39能力、19路径、missing断言和输出口径全不动，不新增依赖，collector使用已有TypeScript。

collector以真实路径visited Set处理循环；AST区分运行时与纯type边，仅跟随本地runtime import、非type re-export和静态字面dynamic import。非字面dynamic import不覆盖，须在输出/证据明确说明，不能冒称全动态依赖。静态资源含现有query后缀按明确资产分类排除，不能用“任意未知扩展都跳过”掩盖TS解析错误；缺文件、空实现、越出websrc边界的本地TS引用须失败。源码是否调用某导入函数、字符串是否出现在注释等仍是原字面规则的已知局限，本次不顺便改规则。循环、边界、缺失与type-only/fixture/生成目录排除须独立负向核验；实际CLI/真实新目标变异仍列为批准后的待执行项。

本补充首次补丁因Prettier表格对齐后旧行不匹配而原子拒绝，无文件改动；改为在本节追加裁定要点，不据此声称已修改校验器。候选仍未提交，未启动3c。

六权限的新真实落点（当前格式化候选行号）：`shared/document-library.ts:140-158` 实际控制 configure/audit 管理面板及连接器/审计加载；`shared/contextual-documents.ts:69,122,320` 实际控制 manage 关联业务、引用数据与在线创建，`:396` 控制 read 已存文档读取，`:258-262,359-363` 在创建成功/打开成功回调的原时点分别读取 manage/send/translate/configure 给真实编辑器。configure 因而在两模块都有真实出现。原 bootstrap 仍静态 import 两模块并在 createCrmShell 中实际依次调用 appendDocumentLibrary/appendContextualDocuments（见当前 `bootstrap.ts:52-53,12188-12201`，以符号为准），不是孤立文件或伪造文案。原六权限在 root 的零出现是拆分结果，不是权限删除。

方案比较：

| 候选                                | 拟改范围                                                                                                                                                                                                             | 优点与限制                                                                                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A：显式三个真实目标（本次最小候选） | 校验器保留 bootstrap，仅读入另外两个实际模块 document-library/contextual-documents；同时验证入口中对应 runtime import 与模块导出的实际函数锚非空、唯一，文件缺失/解绑应报错                                          | 无需遍历仓库或引入模块解析策略；本次六权限足够且范围可逐行审阅。后续3c/3d继续拆分时仍须显式更新映射，不把本次授权扩成任意扫描；函数锚/静态依赖绑定只能证明源文件组织，不能声称证明运行可达或权限安全。                                |
| B：从入口构建本地TS静态依赖闭包     | 使用已有TypeScript AST，仅沿 bootstrap 的本地 runtime import、非type re-export、静态字符串 dynamic import；循环去重，排除 type-only、tests/spec/fixtures/生成物/外部包与非TS资源，限制解析到 apps/web/src 内真实文件 | 可随真正拆分自然覆盖，不需逐域改清单；但新增解析/扩展名及目录边界、静态动态导入策略与自测，改动显著大于A。仅为语法依赖闭包，不宣称调用可达性、动态拼接加载或真实授权矩阵覆盖。边界内无法解析的本地TS依赖须fail closed，不能悄悄跳过。 |
| 不采用：全仓/目录递归拼接           | 包括未被入口依赖的任意源码、测试、fixture或生成文件                                                                                                                                                                  | 会让无关字符串掩盖实际缺失；不作为候选，不为绿门禁倒搬逻辑或加入死常量/注释。                                                                                                                                                         |

A 的绑定应检查真实 import AST，不能把注释中的 import 文案认作依赖；可复用已有TypeScript开发依赖，不新增依赖。B 则需明确混合 type/value import、纯type re-export、资源 import、循环与越界解析的独立用例，不能只正向证明三个文件能拼接便启用。最终范围选择待用户裁定，协调不得代为扩大人工明确的适配范围，**A/B均未修改校验器或新增测试文件**。

无论选择A或B，下列冻结项不动：API输入仍只读取 `apps/api/src/app.ts`；原 authorizeQuery 正则、Set去重/排序、原39个能力与19条 governedPlatformPaths、带单引号 includes 字面规则、两次 missing 断言和输出口径均保持。不把本次适配升级为语义权限分析、后端全扫描或路径清单增删；仅替换 web 输入的组织方式并增加输入绑定失败检查。API/packages/业务逻辑/原web114/Playwright/预算及保护区零改。

拟执行验证（**尚未执行，不记绿**）：稳定候选上先实际39/19绿；再逐项临时替换实际新模块内 audit/configure/manage/read/send/translate 的全部匹配字面（configure需两个新模块同时替换），每项应令同一原 missingPermissions 断言真实exit非0且明确报告该权限，恢复后真实39/19绿。只在串行、无浏览器/DB/业务测试运行时变异，逐项恢复并核零残留；不得只变异校验器或副本来替代真实新落点负向。另核原19路径中一实际源字面被移除时原 missingPaths 仍失败/恢复绿，不修改API；先盘点该字面在输入闭包所有真实位置，避免重复出现造成假阴性。

读取边界另作独立负向：解绑/缺失/空目标必须报错；给未被入口依赖的测试/fixture/生成文件放置“补齐”字面不得令真实缺失通过（优先用内存或独立临时fixture，不污染原冻结用例）；B另测循环去重、静态dynamic import、type-only/资源/外部模块排除和解析越界失败。新辅助验证计数与原web114及CDP七场景分开。随后重验原web114、原结构31/预算和完整ci:local；仅通过后按原单域提交规则交付3b，不预先启动3c。
