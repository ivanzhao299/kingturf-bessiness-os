# 3a 唯一现时检查点（2026-10-16）

本页是3a现时总表；**3a五个公共层源码小步均已稳定HEAD完整CI真实0，最后源码4406f3e，工作区已核干净**。各小步证据及计划§7保留当时“待CI/下一未开始”等历史措辞，由本表及各后补实测覆盖，不把历史时点当当前阻断。此处仅文档归并，归并HEAD再独立完整CI；不是批次3整体验收，3b–3f源码尚未实施，方法无阻塞后按原授权继续3b。

## 小步、CI与回滚

| 小步                 | 源码/证据SHA | 完整HEAD CI真实结果                                                   | 独立回滚基点                              |
| -------------------- | ------------ | --------------------------------------------------------------------- | ----------------------------------------- |
| C3先行护栏           | 175be7d      | exit0；主代理单调169277.626ms，协调命令元数据175385ms（来源不同并列） | 6d467e4；有新模块时不可单撤护栏冒称受保护 |
| form                 | 86e7026      | exit0/182105.292ms                                                    | 175be7d                                   |
| locale               | 66a2f2b      | exit0/171878.057ms                                                    | 86e7026                                   |
| CRM HTTP及必要纯类型 | 1a7c4a9      | exit0/174221.138ms                                                    | 66a2f2b                                   |
| 商业HTTP及必要纯类型 | af97961      | exit0/173798.915ms                                                    | 1a7c4a9                                   |
| navigation           | 4406f3e      | exit0/172428.191ms                                                    | af97961                                   |

完整日志：C3 `/tmp/kingturf-web-c3-head-ci-2026-10-16.log`；其余 `/tmp/kingturf-3a-{form,locale,crm-http,commercial-http,navigation}-head-ci-2026-10-16.log`。主代理耗时均实际Node单调时钟，非旧异常wall值，协调元数据口径另列。逐步证据：[form](frontend-3a-form-2026-10-16.md)、[locale](frontend-3a-locale-2026-10-16.md)、[CRM HTTP](frontend-3a-crm-http-2026-10-16.md)、[商业HTTP](frontend-3a-commercial-http-2026-10-16.md)、[navigation](frontend-3a-navigation-2026-10-16.md)。按逆序回滚；不盲撤E1、旧阶段或仍被依赖的C3。

## 守恒方法与实测

公开面口径说明：协调独立TS复算旧175be7d为69条顶层export声明、70个具名公开绑定；导航收尾为56条export声明、仍70个具名绑定。声明数因具名facade合并而下降，不是减少/增加公开符号。主代理另按type/value核47值+23类型，与旧相同，added/missing均空；不将69和70两口径混写。

各小步真实旧git对象→完整函数/类型逐字比对→回填整个bootstrap逐字同旧→原web114与预算/capabilities/metrics→新产物CDP→独立只读复核→独立提交→稳定HEAD完整CI。主代理唯一写入/串行PG与浏览器；协调和reviewer只读。

协调收尾独立读取五份原HEAD CI日志，均末行CI_EXIT=0、耗时与表一致、audit无已知漏洞；另逐项读取导航API117/17099、web9/114、database3/68、domain3/14、config1/4、types1/1全passed和七场景CDP/网络0/owned清理。此为原执行真实日志的独立核验，**不是协调并发重跑PG/浏览器**；3a方法无阻塞，归并HEAD全链后按原授权续3b。

3a收尾实测：bootstrap16082→15243 split行，净−839，仍巨石不撤豁免；七新TS模块共910 split行（含各文件末尾空项），最大forms265/AST4，62个有body函数完整跨度最大175；最大AST4、全部parse0。新增类型桥接仅为两HTTP工厂实际依赖，不提前3b/3c域迁移。原70公开绑定（47值/23类型）全部同名同类，真实facade不藏死代码。结构0硬/原31豁免（9G1+22G2），没有新白名单、G3/G4/D5放宽或函数大factory包装。

原web仍9文件114，API117文件17099，PG与CDP计数各自独立。最后局部预算JS11368/CSS1898 gzip，原阈值12000/4000与lazy bootstrap约束不变；capabilities39 direct/19 families。metrics源178文件52742 split行，新增模块/显式facade开销使全仓行数并非同步下降，不借bootstrap下降宣称全仓变小。评分只待整批实测。

## 源码读取适配地图

- form：bootstrap.test editorSource读bootstrap不变；起点openOnlineDocumentEditor不变，终点type FormField→紧邻const displayTime；锚唯一/有序/非空且旧新slice字节同，实际更新版本语句变异红→还原绿。86e7026 body仅概述，66a2f2b body已逐处补关联，不改历史。
- 商业HTTP：仅register-controls用例source读bootstrap→bootstrap+shared/commercial-http实际正文组合；两源非空、原工作台/新工厂唯一锚，原expect逐字同；旧读取红→组合绿→新cursor变异红→还原绿，映射入af97961 body。
- navigation：仅utility-bar用例source读bootstrap→bootstrap+shared/navigation实际正文组合；两源非空、原属性设置/唯一install锚，原expect逐字同；旧读取红→组合绿→新标题赋值变异红→还原绿，映射入导航提交body。
- locale/CRM HTTP零测试读取适配；所有原业务fixtures、其他web文件、预算路径/阈值均保持。并非全局拼全仓源码规避检查。

## 浏览器覆盖、失败与保护边界

收尾追加CI结果时一次apply_patch因格式化表格空格不匹配被原子拒绝，核git status仍干净、无文件写入；另一次生成patch含重复文件操作被整体拒绝，合并同文件hunk后正常更新。均未写入失败patch，不是源码/测试失败，无历史结果改写。

每跑Windows Chrome stable新临时profile、随机CDP回环端口、owned preview；全部API精确Fetch合成stub，未知失败封闭。3a最终七场景：工作台文本、真实打开填写/dirty取消确认两分支、CRM状态恢复/其他节点身份、冷热尺寸与四路由、成本迟到防绘制泄漏、360迟到与局部503。计数32 DOM/3 viewport/25 route/10 text/10 overflow；25是重复route断言而非25视图。未知/失败API与外域阻断计数0、owned资源清理成功；不覆盖submit/上传/原生Esc/所有API/21视图/真实账户安全矩阵，未并入Vitest或Playwright。

失败史保留：form首新探头点隐藏客户创建按钮失败后改真实overview导航；CRM初路径纠正及export引发格式对拍红；商业旧读取/变异红与一次prefer-includes提交门禁拒绝；导航旧读取/变异红均按预期还原，未绕过门禁/未提交变异。更早通道/六场景失败史仍在原证据，不回写。

无新依赖、后端/packages/SQL/infra/workflow/生产/push/部署；原Playwright配置与九spec冻结未执行，**阶段5终验前用户提供Linux Chrome或免交互权限后全套真实补跑**义务不变。BOUND001仅后续3f独立行为提交，其他BOUND/SEC/D1/N+1/4/5不动。3a方法无阻塞后按原授权继续3b，不重复索许可；此页不构成批次3人工验收。
