# 3a navigation（2026-10-16）

历史小步快照；唯一现时总表见[3a检查点](frontend-3a-checkpoint-2026-10-16.md)，后文“CI随后”等为提交时点。

基线 `af97961` 商业工厂稳定干净HEAD完整CI真实0/173798.915ms后启动。本步仅公共导航迁移，不开始CRM域拆分。

## 旧新映射与身份

旧bootstrap五段移至 `shared/navigation.ts`：AppRoute/两路由表；routeViewSelector；APP_ROUTES/appRouteFromHash；applyRouteVisibility；navigationDisposers/setAppRoute/installAppNavigation。新模块218 split行/AST4，无import/反向bootstrap依赖；十个原声明逐字相同，末尾仅给仍需原文件调用的描述表/Set/visibility/map/setRoute作真实内部export。bootstrap保留原公开五绑定facade，不新增其公共API。

WeakMap仅新模块创建一次，install与bootstrap旧shell卸载直接使用同一导入对象；保留原新shell install→旧shell disposer→replaceChildren顺序。APP_ROUTE_DESCRIPTIONS也仍供原shell文案/任务UI使用（并非只新导航使用），Set及visibility/setRoute各调用保持；只提前纯字面量表/Set/WeakMap分配，不freeze/复制/工厂重建，不改listener/AbortController/observer/事件/Promise/闭包时点。

证明 `/tmp/kingturf-3a-navigation-conservation-2026-10-16.log` 真实exit0：十声明与整bootstrap回填逐字一致；完整install94行/AST4、setRoute5/AST2、visibility12/AST3、hash4/AST2。所有3a七新模块均≤800/AST≤4；62个有body函数（含箭头/方法/回调）完整跨度最长175≤200。结构0硬/31原豁免。`/tmp/kingturf-3a-export-conservation-2026-10-16.log`另从175be7d旧AST核所有70公开绑定名称及type/value类别完全相同（47值/23类型）。

## 524089d 测试读取与真实变异

仅bootstrap.test的utility-bar标题用例：旧source单读bootstrap→组合原bootstrap（属性设置仍在）+新shared/navigation（实际标题赋值移入），原两个expect调用/字面逐字不改。两个read显式非空，原setAttribute锚存在、新install导出锚存在且唯一；标题赋值只在真实新导航，不留旧字符串兜底。预算路径与其他读取/切片/import不改。

指定用例1/86 skipped的真实日志 `/tmp/kingturf-3a-navigation-{old-read-red,read-green,mutation-red,mutation-restored}-2026-10-16.log`：未适配旧读取exit1→组合读取exit0→临时将新导航utilityContext.textContent赋值改空串、原用例exit1→apply_patch完整还原exit0。随后全web9文件114通过，未提交受控变异。纯文字oracle固有限制不冒称runtime全集覆盖；本次实际变异证明迁移后真实目标仍被检查。

## 运行验证与回滚

web114、typecheck、capabilities39/19、metrics通过；bootstrap15433→15243 split行，非测试源178文件52742行。构建预算11368/1898 gzip，12000/4000阈值与lazy约束不变。局部日志均 `/tmp/kingturf-3a-navigation-{web,metrics,build}-2026-10-16.log`。

新产物CDP Hq7DtC真实exit0：Chrome154.0.8037.99/PID42216/127.0.0.1:55217，owned preview2226348；七场景32 DOM/3 viewport/25 route/10 text/10 overflow全部通过，网络blocked/unknownAPI/failedAPI皆0，preview/process/profile全部清理。`/tmp/kingturf-3a-navigation-cdp-2026-10-16.log`及截图 `/tmp/kingturf-cdp-preflight-Hq7DtC-probes.png`。仅四路由合成stub，不是21视图/真实权限矩阵/Playwright，也不单凭此证明所有卸载分支；单map身份与顺序另由逐字/导入证明和独立review核验。

协调与只读reviewer均核实际五段/WeakMap单实例/原挂载与卸载顺序/读取绑定与真实变异，无阻塞，未运行测试或写入。提交后完整HEAD CI随后，不把af97961全链当本步结果。回滚本步至af97961，导航模块/原调用导入与facade/该test读取同步撤；前四小步保留。所有保护区/原31/Playwright补跑义务保持，整批3与评分债务未结案。
