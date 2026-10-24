# E1守恒候选与固定旧契约（2026-10-16）

授权310c1e2，实际验收基线b575b9c。只改authorization.ts的atomicCapability：首roles分支与末fallback都是同一个role模板，删首重复条件，使roles走原fallback；resource已是普通本地const，新增三个严格相等比较无getter/coercion副作用。所选模板才读取request.method一次，随后authorizeOneOf属性getter→fallback参数第二次method读取→以context为this调用→repository，均保持。不缓存action/method、不新增wrapper/预读、不改后续body/unsupported处理。既定AST由6降5，非改计数算法。

## 候选只读复核与旧新探针

只读独立复核无必要反例。以下完整函数旧新对照在修改业务前已真实Node退出0：773有限案例，5资源×7方法序列×2仓储存在状态×11错误注入＋3不匹配路径；getter动态GET→POST验证preferred read与fallback manage分别读取，auth属性/调用receiver、sentinel首错、path不匹配零method/auth/repo/body读取保持。精确轨迹：pathname→method1→authGetter→method2→authorize(this===context,role:read,authorization:manage)→repoGetter→unavailable。

边界：基线直接git show b575b9c取旧完整函数；候选由TS AST取原whenFalse，未将新行为反写旧oracle。domain/route dispatcher为固定stub，验证前置求值和unsupported回退轨迹，不冒充真实HTTP/PG或任意JS执行流证明；已有117 API/17099和完整CI另实跑。旧测试/fixtures冻结，探针不写DB、不含秘密。

## 可复跑探针（版本化证据，复制为临时.cjs执行）

在仓库根运行 `node /tmp/kingturf-e1-probe.cjs`；实现后追加 `--check-current` 校验当前整文件仅候选AST变化（忽略格式）。保留以下脚本，而非仅依赖临时日志。探针是证据代码，不接入业务生产模块/不增加API测试文件。

```javascript
const fs = require('node:fs');
const cp = require('node:child_process');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require(process.cwd() + '/node_modules/typescript');
const path = 'apps/api/src/routes/authorization.ts';
const old = cp.execFileSync('git', ['show', 'b575b9c:' + path], { encoding: 'utf8' });
const tree = ts.createSourceFile(path, old, ts.ScriptTarget.Latest, true);
let initializer;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'atomicCapability')
    initializer = node.initializer;
  node.forEachChild(find);
}
find(tree);
assert(ts.isConditionalExpression(initializer));
assert.equal(initializer.condition.getText(tree), "resource === 'roles'");
const candidate =
  old.slice(0, initializer.getStart(tree)) +
  initializer.whenFalse.getText(tree) +
  old.slice(initializer.end);
if (process.argv.includes('--check-current')) {
  const current = fs.readFileSync(path, 'utf8');
  assert.equal(
    ts
      .createPrinter()
      .printFile(ts.createSourceFile(path, candidate, ts.ScriptTarget.Latest, true)),
    ts.createPrinter().printFile(ts.createSourceFile(path, current, ts.ScriptTarget.Latest, true)),
  );
}
class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
function compile(source) {
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (name === '@kingturf/domain') return { DomainError };
      if (name === '@kingturf/types') return { DATA_SCOPES: ['SELF'] };
      if (name === './types.ts')
        return { defineRoute: (route) => route, dispatchRoutes: async () => null };
      throw new Error('unexpected import ' + name);
    },
  });
  return exports.dispatchAuthorizationRoutes;
}
const before = compile(old),
  after = compile(candidate);
async function run(fn, options) {
  const events = [];
  let reads = 0;
  const sentinel = new Error('sentinel');
  const fail = (where) => {
    if (options.fail === where) throw sentinel;
  };
  const body = { roleId: 'role', permissionId: 'permission', employeeId: 'employee' };
  const context = {
    authorization: { actor: {} },
    correlationId: 'probe',
    unavailable() {
      events.push('unavailable');
      return { statusCode: 503 };
    },
    parsers: {
      objectBody(value) {
        events.push(['bodyParser', value === body]);
        fail('bodyParser');
        return value;
      },
      allow() {
        events.push('allow');
        fail('allow');
      },
      uuid(value, field) {
        events.push(['uuid', field]);
        fail(field);
        return value;
      },
      string(value) {
        return value;
      },
      strings(value) {
        return value;
      },
    },
  };
  Object.defineProperty(context, 'authorizeOneOf', {
    get() {
      events.push('authGetter');
      fail('authGetter');
      return function (preferred, fallback) {
        events.push(['authorize', this === context, preferred, fallback]);
        fail('authorize');
      };
    },
  });
  Object.defineProperty(context, 'repository', {
    get() {
      events.push('repoGetter');
      fail('repoGetter');
      return options.repository ? {} : undefined;
    },
  });
  const request = {};
  Object.defineProperty(request, 'pathname', {
    get() {
      events.push('pathname');
      fail('pathname');
      return options.pathname;
    },
  });
  Object.defineProperty(request, 'method', {
    get() {
      events.push('method' + ++reads);
      fail('method' + reads);
      return options.methods[Math.min(reads - 1, options.methods.length - 1)];
    },
  });
  Object.defineProperty(request, 'body', {
    get() {
      events.push('bodyGetter');
      fail('bodyGetter');
      return body;
    },
  });
  try {
    const result = await fn(context, request);
    return { events, result: JSON.stringify(result) };
  } catch (error) {
    return {
      events,
      error: error === sentinel ? 'sameSentinel' : error.code + ':' + error.message,
    };
  }
}
(async () => {
  let count = 0;
  for (const resource of ['roles', 'permissions', 'grants', 'assignments', 'scope-grants']) {
    for (const methods of [
      ['GET'],
      ['POST'],
      ['PATCH'],
      ['DELETE'],
      [''],
      ['GET', 'POST'],
      ['POST', 'GET'],
    ]) {
      for (const repository of [false, true]) {
        for (const fail of [
          undefined,
          'method1',
          'authGetter',
          'method2',
          'authorize',
          'repoGetter',
          'bodyGetter',
          'bodyParser',
          'allow',
          'roleId',
          'employeeId',
        ]) {
          const options = { pathname: '/api/v1/' + resource, methods, repository, fail };
          assert.deepEqual(
            await run(after, options),
            await run(before, options),
            JSON.stringify(options),
          );
          count++;
        }
      }
    }
  }
  for (const pathname of ['/not-a-match', '/api/v1/unknown', '/api/v1/roles/not-uuid']) {
    const options = { pathname, methods: ['GET'], repository: true, fail: 'method1' };
    const current = await run(after, options);
    assert.deepEqual(current, await run(before, options));
    assert.deepEqual(current.events, ['pathname']);
    count++;
  }
  const trace = await run(after, {
    pathname: '/api/v1/roles',
    methods: ['GET', 'POST'],
    repository: false,
  });
  assert.deepEqual(trace.events.slice(0, 6), [
    'pathname',
    'method1',
    'authGetter',
    'method2',
    ['authorize', true, 'role:read', 'authorization:manage'],
    'repoGetter',
  ]);
  console.log(
    JSON.stringify({
      cases: count,
      sameGetterReceiverErrors: true,
      recursiveUnchangedContract: true,
      exactMixedMethodTrace: trace.events,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## 后续顺序

### 本轮实现验证与交接结果

固定证据10dffcc→源码d9f43f6→撤例外3231964。主代理真实773 --check-current通过，协调独立从本文提取脚本复跑773亦退出0，完整模块AST只有冗余roles分支删除；独立readonly终审无必要修正。原authorization路由2例/typecheck/lint0，撤例外后36结构自测0（含真实routes四G进程及同路径6/7拒绝），稳定干净HEAD3231964完整ci:local真实退出0/173.927秒，API117文件17099例/既有13PG/web114/预算11368字节JS与1898字节CSS gzip均通过。

豁免32→31＝原9G1＋22G2逐条保留，仅E1退出；当前authorization AST5，不改计数规则，不扩G3/G4/D5，不延期到期日。源改与撤例外分离可追溯；回滚需配对核源码和门禁，旧期限之后不能靠恢复过期豁免放行。前端实施为0，Chrome预检退出1及冻结源码读取特定完整搬移冲突已另落地图停报证据，不把launch叫E2E；最终文档HEAD另全CI后交接，不把源码CI冒作最终HEAD结果。

协调首次只读Node-e度量多右括号在模块执行前SyntaxError退出1，修正后0，无源码/DB写入；首次完整runChecks展示截断后计数复核0硬31软，并非门禁失败。主代理首次猜authorization-api.test.ts路径不存在，rg定位实际authorization-routes.test.ts后执行2例0；没有改旧测试期待掩盖失败。

先候选协调复核，再源码与撤E1分离提交；先固定旧表达式证据，改后同探针--check-current、旧API117/17099、完整CI真实0/干净/豁免32→31。撤掉必要门禁精确例外和失效自测，不改变G3/G4/31旧豁免或阈值。3的文本断言与Chrome前置阻断另落地图证据，E1先完成，不借阻断跳过E1验证，不启动前端实现或改测试冻结。
