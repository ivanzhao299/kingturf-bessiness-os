# Source 授权回放旧分页夹具与增量 R7（2026-10-17）

## 失败事实与封存候选

41bf26a后原PG producer未改，实际命令`NODE_ENV=test DATABASE_URL=<private guarded loopback> pnpm --filter @kingturf/api exec vitest run test/authorization-http-postgres.integration.test.ts`，实际exit0/5.87s、19/19；原guard、随机owned schema/loopback API及afterAll清理/输出样本保持。日志`/tmp/kingturf-docker-source-original-producer-2026-10-17.log`。只回放该次真实样本，不合成替代真实授权业务DTO。

仅会话候选把旧token login/session分支替共享installSyntheticLogin，原modeSession身份/权限复制附加固定合成proof，业务payload引用与全部goto后原操作/断言不改，增加session样本存在守卫。样本中的Bearer session不是浏览器restore证明：API session-carrier:115–131/auth:190–228、原producer:92–107/247/343/559；固定proof只供shape。原ESLint/Prettier0。

命令同[逐spec工具](../evidence/playwright-docker-spec-replay-2026-10-17.md)首节，spec=source-nested-authorization.spec.ts：`source-adapt-green-1`实际PW1/8907ms、host1/14281ms；`source-confirm-failure-1`实际PW1/8937ms、host1/14318ms，均**2过1败**。denied/masked过，authorized原`.collection-case-card`可定位但hidden，原5s可见断言失败；截图显示“本页部分业务数据暂不可用”。两轮guard/只读PG同一性通过，owned三清理true；原HTML/截图/trace独立留各目录。不读取/输出auth trace/原完整fixture payload。

只读独立核查与主代理静态核证：authorized有ar:read，collections依赖ar-open-items（commercial/store/route-dependencies:23,59–74）；commercial-http:14–43将应收按cursor读，api-response-parser:20–26强制nextCursor为string|null。旧spec通用`{items:[]}`无该字段；未ready panel由route-dom/route-state及style.css:5101–5102隐藏。该链足以解释候选，不是产品应跳过ready或删断言的证明，尚未以修正干预验证因果。

首次候选已用apply_patch精确还原与41bf26a原spec字节同；独立封存[auth补丁](../evidence/playwright-source-auth-candidate-2026-10-17.patch)，SHA256 `f137e53020b4235ae019fdb08809dd210203b1ee9f9b7a7a61fc6f8d1af597be`，`git apply --check`真实0。未完成变异/整文件绿，不能计适配交付。

## 原始人类裁定

主代理本会话直接收到，非协调推断：

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_7652a1df412c4d42b66e572bb09ebeb7\",0]","question":"source 授权浏览器首轮两次均为 2 过 1 败：authorized 身份的催收卡片被隐藏。原真实 PG 生产器 19/19 通过；只读核查发现该身份的催收页依赖应收游标页，而旧合成拦截器对 /api/v1/ar-open-items 只回 {items: []}，缺少解析器必填 nextCursor。是否允许仅给这一个合成响应补 nextCursor: null，保留原 PG 业务样本、全部 UI 断言、权限和其余网络响应，并做缺字段真变异？不改产品。","answer":"允许这一处合成分页修正（推荐）"}]
</send_user_message_question_reply>

仅该一个合成应收endpoint补nextCursor:null，不改items/生产器/权限/其它响应/原UI assert；先本R7独立docs，后恢复同一auth候选并独立字段修正，缺字段真实源变异红→还原绿、会话fixture真变异，独立提交/回滚。TD-TEST-015新增/55顶层项：当前已授待实施，不提前关闭。Workspace字段与成本提示仍另待裁，不套本授权；B首轮在A首轮留证后独立继续，第二完整轮须A+B全绿，C禁，最后稳定干净HEAD实际全CI必跑。不push/部署/workflow/依赖/SQL/产品变更，不扩一般阶段5。

## 后继：获准应收字段独立修正

R7 8e4666b后，f646958精确恢复封存auth候选（内存git diff与patch trimEnd全同），该提交只保已实测2过1败，不冒充全绿。后只新增path严格等于/api/v1/ar-open-items的合成空页分支，原items=[]加nextCursor:null，未给所有未知API泛加字段。

`source-cursor-positive-1` 原3例通过，PW0/3394ms、host0/8656ms；真源仅该分支删nextCursor，`source-cursor-missing-red-1` PW1/8847ms、host1/14305ms，原authorized卡又hidden、2过1败。完整close/owned清理后立即还原，`source-cursor-restored-1`原3例通过，PW0/3355ms、host0/8457ms。每次owned三清理true，红原截图/trace/HTML独立保留。此干预支持本失败来自旧夹具游标缺字段，不归责产品/S4认证。

原从首goto至文件末全业务动作/条件/断言字节同；PG producer/样本没有再生成或修改，员工/权限/三种payload保持。原ESLint/format实际0，父f646958为字段独立回滚点（中间c629569仅B接线设计docs）；TD-TEST-015字段实施验证完成，整文件auth真实变异尚待完成，不提前标适配全交付。Workspace/成本失败不扩大许可，B可独立首轮、第二轮仍禁，最后HEAD全CI必跑。

## 后继：会话真实变异与首轮交付

字段独立ea2a647后，只真实源向replaySession副本加固定旧token字段，`source-old-token-red-1`三例均在原shell可见断言红，PW1/18222ms、host1/23778ms。完整close/owned清理后apply_patch立即还原，`source-auth-restored-1`原三种mode全部过，PW0/3361ms、host0/8382ms。owned三清理true，三红原HTML/截图/trace独立保留。最终spec与ea2a647同，变异未提交。

PG producer产物在字段/认证变异前后SHA256同为`98af404786319420cf03f655116df93667044371578e7892fe0df837fcd54eed`，未改原PG业务样本/权限/其它响应或goto后的业务断言。两类真红绿完成；TD-TEST-015只旧应收合成字段缺口关闭实施项，不称全部A/B/整体验收。B真实API/自然Cookie另跑，合成proof不是其安全证据。A8首轮全部试过，6份全绿、成本与Workspace各一败（字段仍待裁），第二完整轮禁、C禁；最后稳定干净HEAD完整CI仍实际必跑。
