# 前端3e③：全runtime日期formatter收敛（2026-10-16）

输入：3e②源码580cc72实际干净HEAD完整CI0/179498.691ms；完成docs382d7f0另实际干净HEAD完整CI0/178385.802ms（`/tmp/kingturf-3e-lazy-382d7f0-head-ci-2026-10-16.log`），结束HEAD不变/树空，之后才开始本子步。

## 范围与守恒

统一的是全apps/web/src运行时代码，不是仅把bootstrap grep归零。原12个内联toLocale（5日期、7日期时间）加CRM标题Intl共13调用，跨10个消费者，全部移到`shared/business-date.ts`三原语；纯13 split/完整函数7/AST1，无顶层Date/Intl实例、缓存或新依赖。标题调用保`businessHeadingDateFormatter().format(new Date())`，即Intl构造先于Date，原year numeric/month long/day numeric/weekday short不变；其余Date仍在原call site。

| 语义      | 消费者及次数                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| 日期5     | cost-matrix-ledger、complaint-rows、online-editor-workspace各1，contextual-documents2                                |
| 日期时间7 | business-format/displayTime、document-library、document-print、online-editor-version-history各1，cost-matrix-detail3 |
| 标题1     | crm/shell-frame原Intl.DateTimeFormat                                                                                 |

保zh-CN、运行环境默认时区、Date无效值原生结果/异常、原`时间未知`/`—`/空字符串回退。contextual两个new Date分处原JSON属性求值，未合并；cost detail三个条件保对calculatedAt/occurredAt的重复getter读取，不缓存textValue。shared模块不回依赖消费者。root bootstrap为749 split行，文件字节与382d7f0完全相同，70公开不变；不触TD-BOUND003/004、SEC、D1或其它旧bug。

## 已执行验证

**当前补记**：日期候选独立只读最终审无阻塞；各消费者getter次数依完整逆AST证明，不冒称新16测试逐一动态覆盖；原生错误栈因helper多一层不作字节守恒声明。新47 `iPmHGc`真实0/分类168/54/92/188/69，原fixture29 `zgfYy0`真实0/80/47/69/142/56，与日期前各自计数完全一致。两run网络blocked/unknown/failed fulfillment均0，自有preview3694188/3694508、root/profile清理全真；日志`/tmp/kingturf-3e-date-browser{47,29}-2026-10-16.log`。下方“排队/待跑浏览器”是前一候选时态，源码提交及稳定干净HEAD全CI仍待执行。

- 未适配任何旧测试先实际163/11全绿（`/tmp/kingturf-3e-date-unadapted-tests-2026-10-16.log`）。新增16契约后179/12绿，type/lint/gate0/29及build0：三时区×四时间（含DST/闰日/非法值）原生对拍、Date receiver/唯一locale实参、Intl每次fresh且构造先后/原options、falsy不触formatter、原生heading非法日期异常。测试只改本进程TZ并在finally还原，不读真实配置。
- `/tmp/kingturf-3e-date-proof.mjs`真实0：逆展开5/7/1共13调用后，10完整消费者文件含原imports、所有函数/条件/回调/求值顺序AST全等382d7f0；root字节同、原bootstrap457完整断言链同、原其余11测试文件字节同。不是只比较字符串替换次数。
- 唯一源码适配是在`readDocumentSupportSources`添加new helper实际唯一非空锚点，不改任何原断言/夹具。真实behavior变异把日期错用日期时间，10失败169成功；还原179成功。真实binding变异扰动new export锚点，2失败177成功；还原179成功。日志`/tmp/kingturf-3e-date-{behavior,binding}-{red,restored}-2026-10-16.log`，不删失败史。
- runtime全树locale方法搜索现在只命中business-date三实现（date/dateTime/Intl各1）；Date构造/默认时区没有移入helper或模块缓存。独立scout实施前13调用定位/求值风险核验无阻塞，候选最终只读审和浏览器/完整CI待真实补记。

量度352源/57461行（前351/57442）；149测试/66599行（前148/66504）。root749/完整158/AST3/格式5、API4129/buildApp3598不变。构建bootstrap-Bdk3P2o9.js/index-D3XM1o64.js，登录gzip JS11368/CSS1898，workspace仍deferred。日期统一不触后台、依赖、workflow、评分或Playwright9spec/config。

浏览器当前排队串行运行扩展47与原fixture29，不能预填成功。源码提交/实际干净HEAD全CI、完成docs全CI及回滚SHA待随后补；前置回滚382d7f0，后继3f须核依赖后才能独立revert。日期完成后继续已授权轻量HTTP/storage解析3f，畸形行为先登记/单独提交，3f后整批人工验收。
