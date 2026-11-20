// A-F3a 供应链加固自测（node --test，审计 A3/A4）：.github/workflows 内全部
// 第三方 GitHub Action 引用必须钉 full-length commit SHA；一方 `actions/*` 前缀
// 按 GitHub 官方建议可保留移动主版本 tag。由 ci.yml 的 quality job 显式执行
// `node --test tests/workflows/`，防止后续会话把 SHA 钉扎退化回 tag。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOWS_DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));
const FIRST_PARTY_OWNER = 'actions';
const FULL_SHA = /^[0-9a-f]{40}$/;

function shaPinningViolations() {
  const violations = [];
  const files = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();
  assert.ok(files.length > 0, `${WORKFLOWS_DIR} 未发现 workflow 文件：路径解析可能已失效`);
  for (const file of files) {
    const lines = readFileSync(join(WORKFLOWS_DIR, file), 'utf8').split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*(?:-\s+)?uses:\s*([^\s#]+)/);
      if (!match) return;
      const ref = match[1];
      const at = ref.lastIndexOf('@');
      assert.ok(at > 0, `${file}:${index + 1}: uses 引用缺少 @：${ref}`);
      const repository = ref.slice(0, at);
      const version = ref.slice(at + 1);
      if (repository.split('/')[0] === FIRST_PARTY_OWNER) return;
      if (!FULL_SHA.test(version)) {
        violations.push(
          `${file}:${index + 1}: 第三方 action ${repository} 必须钉 40 位 commit SHA（当前为 @${version}）`,
        );
      }
    });
  }
  return violations;
}

test('A-F3a：全部第三方 workflow action 引用钉 full-length commit SHA', () => {
  assert.deepEqual(shaPinningViolations(), []);
});
