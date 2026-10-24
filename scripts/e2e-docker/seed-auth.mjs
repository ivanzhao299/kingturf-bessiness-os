import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Extract the actual CLI binding, not a copy of its URL. All fetches below are real local HTTP.
export async function verifySeedAuthentication(
  users,
  signal,
  onRequest = () => {
    /* Optional cancellation proof. */
  },
) {
  const source = await readFile(new URL('../seed_p1_demo.mjs', import.meta.url), 'utf8');
  const ast = ts.createSourceFile(
    'seed_p1_demo.mjs',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const matches = ast.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'login',
  );
  assert.equal(matches.length, 1);
  const requests = [];
  const realFetch = async (url, init) => {
    assert.equal(new URL(url).origin, 'http://127.0.0.1:3000');
    const pending = fetch(url, {
      ...init,
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    onRequest();
    const result = await pending;
    requests.push({
      path: new URL(url).pathname,
      noCookie: !new Headers(init?.headers).has('cookie'),
      setCookie: result.headers.has('set-cookie'),
    });
    return result;
  };
  const login = new vm.Script(`(${matches[0].getText(ast)})`).runInNewContext({
    assert,
    fetch: realFetch,
    baseUrl: 'http://127.0.0.1:3000',
  });
  for (const user of [users.admin, users.approver]) {
    const token = await login(user.login, user.password);
    assert.equal(typeof token, 'string');
    assert(token.length > 0);
    const session = await fetch('http://127.0.0.1:3000/api/v1/auth/session', {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).employeeId, user.employeeId);
  }
  assert.deepEqual(
    requests,
    [0, 1].map(() => ({ path: '/api/v1/auth/token-login', noCookie: true, setCookie: false })),
  );
}
