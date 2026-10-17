# 批次4 S3：CSP Report-Only设计与行为表

输入S2最终74c78c3，源码b8c1212全CI0/194043.303ms、最终74c78c3实际干净HEAD全CI0/203898.679ms，API122/17175、Web13/266/config23，协调独立确认后续派。沿[R7](harness-batch4-authorization-2026-10-17.md)仅实施S3/TD-SEC001 Report-Only与默认关闭强制开关，先本设计登记再独立行为提交；完成源码及最终证据实际干净HEAD完整CI0后停协调。S4只读影响报告另派，禁止Cookie/CSRF/Origin/sessionStorage/Bearer或会话夹具迁移。不开强制、不部署、不push/dispatch/workflow/生产/阶段5；TD-HYG002旧preview镜像构建问题只登记不修。

## 政策、理由与行为

候选公共策略（API/外层nginx/本地test-only预览逐token校验一致）：

`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'`

| 项                     | 证据/决定                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default/script self    | web index仅self module，main与bootstrap导入本地CSS/代码；不加unsafe-inline/unsafe-eval/script data/blob或广域来源                                                                             |
| style self             | 外置CSS原位；document-print.ts与commercial/quote-print.ts动态style、editor pagination CSSOM已知，先真实观察再记录。即使违例也不改业务、不盲加unsafe-inline；强制off，不能称强制策略已兼容打印 |
| img self data          | brand.ts的?inline WebP赋给img.src是明确data:image需求，只在img放data，不扩default/script/font等                                                                                               |
| connect/font self      | http.ts相对API，同源；字体是系统栈，无已知远程字体。Vite开发HMR不纳入本次built preview证明                                                                                                    |
| frame/object/base none | 静态web库存无iframe/object/embed/base，不因CSV data:text与Blob download扩大这些资源来源；弹出打印about:blank非iframe，继承及样式另记边界                                                      |
| form/ancestors self    | 应用form submit handler与同源UI，frame-ancestors沿SAMEORIGIN而非擅自DENY；策略不替代S4 CSRF                                                                                                   |

资料规则核实：[CSP3](https://www.w3.org/TR/CSP/)、[nginx headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html)、[CDP Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/)。Report-Only必须真实HTTP响应头，不能meta替代；事件不采report-sample。未配置report-uri/report-to/接收端，只有本地浏览器事件观察，不称生产报告通道已就绪；未来部署后一发布周期真实观察与强制启用须另授权。

| 层/模式       | 行为与开关                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API默认       | 统一complete/rejectOversized保S1三头、原状态/body/correlation/telemetry，新增content-security-policy-report-only；无强制header                                                                                                       |
| API预置强制   | parseEnvironment新增严格布尔CSP_ENFORCE，默认false、example只追加公开默认、compose仅透传；server传buildApp独立安全选项，非ApiDependencies业务端口。显式true时保RO并额外发同策略Content-Security-Policy，仅本地新测试验证，不生产启用 |
| 外层nginx默认 | 只改infra/nginx/erp.kingturf.cn.conf HTTPS proxy location /，现有assets/index/API所有proxy响应均在此加头；隐藏upstream两个CSP头后统一一个RO，避免API/outer叠加；S1三头旧重复风险不顺手处理                                           |
| 外层预置强制  | nginx文件中明确定义变量开关off与空强制值，只有未来显式on才填政策。独立于API env，不能假设CSP_ENFORCE能控制host nginx；本批默认off，绝不安装/reload                                                                                   |
| 内层nginx     | 不改container nginx，不依赖其server级add_header继承（其assets/index/location各有Cache-Control）；inner直连无HTML CSP是明确边界。outer /覆盖内层Cache-Control不影响后置outer CSP；HTTP301/ACME不宣称HTML策略覆盖                      |
| 本地CDP HTML  | opt-in test-only Vite preview配置用同一公共policy给真实built Document响应RO；常规preview不变，不用API JSON头冒充HTML。真实网络Document头断言＋首次导航前collector，并分离API/unit、本地nginx与浏览器证据                             |

RELIABILITY现workflow不安装/reload host nginx，仓库修改不自动生产生效。API=false/true分别控制直连API无/有强制头；外层隐藏两上游CSP头，故API=true但outer=off仍只有RO，outer=on才给所有代理响应额外强制头。四组合均本地检查，不把API开关称为公网强制开关。已有本地nginx:1.28-alpine镜像可用；计划仅--pull never/--network none本地临时nginx配置验证与HTTP响应检查，不构建镜像/拉依赖/读生产证书。若无法运行则如实阻塞该证据，不替换成已验证声明。真实host TLS部署配置不执行。

## 浏览器与发送合成边界

复用仓库自有CDP临时profile/随机回环debug端口/已安装Chrome/4173独占预览及自有进程清理；不Windows桌面UI、不sudo、不缓存Chromium/安全标志/防火墙。原网络未知/写默认拒绝不松。旧原29与其它探头不改断言，新增S3独立opt-in，不把旧草稿/只读夹具改为可发送。

- collector在Page首次navigate前addScriptToEvaluateOnNewDocument安装。采有效directive/disposition及去query/hash/用户信息的URL，data/blob仅scheme、inline/eval只枚举；不存token、inline代码、sample、完整report/payload。有限记录/计数，跨导航通过受控binding或分段读取避免丢登录页。真实违例只是观察记录，不作正常链失败；故意inline script小哨兵须有report事件且RO不阻止执行，单独phase，不混正常统计。负向collector缺绑定/非RO或缺HTML头须被工具测试抓住。
- 新发送session/doc完全合成，APPROVED+customerId，限定read/send权限。真实DOM登录表单（精确合成login POST）→工作台→打开在线文档→点击发送→GET精确connector→填表→POST精确合成UUID/send。网络独立断言202，DOM另断合成任务ID/排队文案，不声称UI显示HTTP码或客户送达。首导航后仅布尔核临时profile无kingturf.session，不预置storage/login bypass；必须由真实输入/点击完成login POST1→session GET→app-shell。不得直接fetch代替点击，也不真实API/PG/外发。
- 新fixture仅opt-in允许合成login、精确GET connector、精确POST该doc/send；严格校验method/path/JSON精确字段值/幂等头、缺postData拒绝，不输出payload/身份头。幂等键沿真实requestId随机生成，只验证合法UUID并绑定首次值与精确payload，不能固定随机数或改业务。原router只GET及原session fixtures不改。未知/变路径/其它POST/生产origin仍拒绝，真实负向证明。document-editor原探头断言send hidden，独立S3场景避免冲突。
- 原11 TS Playwright文件（原本地9命名＋production2）及runtime MJS/config一字不动，均未本批运行；阶段5前Linux Chrome可用后仍须补跑，不以CDP代替，不访问production补跑。

## 测试、期望纪律与停点

API新增默认RO/显式true/false/非法配置、三头/正常错误/413/correlation与原body/顺序保持测试；策略来源/无宽放/NGINX变量默认off与去重/配置透传/本地HTML测试。collector脱敏有界/真事件哨兵，send exact opt-in/router负向/真实DOM覆盖地图、独占清理与失败史。

完整CI前预盘旧严格oracle：S1 65文件76处、helper精确输出及S2 429完整响应受CSP新增影响，数量以实际AST盘点为准，不预填总数。只追加对应CSP期望，不弱化toEqual/调用生产helper生成oracle；独立test提交、逐处旧→新→D1S3映射与仅逆去CSP字段完整AST证明。S1 b02→59f9dfa历史固定SHA证明保留，S3另显式基线74c78c3/目标/唯一CSP字段白名单，不假称S1旧默认工具仍适用。无需先故意重跑已知6994红的整CI。

中间件≤800/完整函数≤200/AST≤5，G1/G2/G3不新增豁免；如必要基础设施门禁维护独立提交且声明身份+错类型真负向，不按名字skip。无SQL/新依赖/结构G3扩白。源码和最终完成docs分别在实际稳定干净HEAD完整CI0后交协调，SEC001仅RO段待批次验收，强制段不关闭。回滚独立按业务/期望/工具/文档后继链配套，保S1/S2与原回滚链，最终记录真实SHA/日志，不预填完成。
