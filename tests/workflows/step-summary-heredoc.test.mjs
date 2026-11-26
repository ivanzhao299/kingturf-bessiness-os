// TD-GATE-006 静态守卫（node --test）：.github/workflows 下全部 .yml/.yaml 中，
// 无引号 heredoc（<<EOF、<<-EOF 等定界符未加引号）的正文里不允许出现未转义
// 反引号。无引号 heredoc 正文会做命令替换——反引号（含单引号里的反引号）会被
// shell 当作命令执行，Markdown 步骤摘要里的 `digest` 因此变成空输出加
// "command not found"。修复方式：改用 printf（参考 release.yml 的
// "Publish release summary" 步骤），或给定界符加引号（<<'EOF'）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOWS_DIR = fileURLToPath(new URL('../../.github/workflows/', import.meta.url));

// 无引号 heredoc 开始：<<（可选 -）后第一个 token 未被引号或反斜杠包裹；
// <<<（here-string）不是 heredoc，用负向后行排除；'EOF'、"EOF"、\EOF 均视为已加引号。
const HEREDOC_START = /(?<!<)<<(-)?\s*(?:'([^']*)'|"([^"]*)"|\\(\S+)|([A-Za-z_][A-Za-z0-9_-]*))/;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 无引号 heredoc 正文里，反引号是否未转义（\` 为字面反引号，安全；'`' 里的反引号
// 在 heredoc 内没有引用语义，同样会被执行，必须计为违规）。
function lineHasUnescapedBacktick(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '\\') {
      index += 1; // 转义对（\`、\\ 等）整体跳过
      continue;
    }
    if (line[index] === '`') return true;
  }
  return false;
}

// 逐行扫描：返回每个「无引号 heredoc 且正文含未转义反引号」的块
// [{ startLine, delimiter, backtickLines }]。结束行允许前导空白（YAML 块标量
// 在源文本里带缩进，实际脚本执行时由 YAML 剥离）。
function unquotedHeredocBackticks(lines) {
  const findings = [];
  let current = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (current) {
      if (new RegExp(`^[ \\t]*${escapeRegExp(current.delimiter)}[ \\t]*$`).test(line)) {
        if (current.backtickLines.length > 0) findings.push(current);
        current = null;
        continue;
      }
      if (lineHasUnescapedBacktick(line)) current.backtickLines.push(index + 1);
      continue;
    }
    const match = line.match(HEREDOC_START);
    if (!match) continue;
    // 'EOF' / "EOF" / \EOF：定界符已加引号，正文不做展开
    if (match[2] !== undefined || match[3] !== undefined || match[4] !== undefined) continue;
    current = { startLine: index + 1, delimiter: match[5], backtickLines: [] };
  }
  if (current && current.backtickLines.length > 0) findings.push(current);
  return findings;
}

export { unquotedHeredocBackticks };

test('TD-GATE-006：workflow 无引号 heredoc 正文不得含未转义反引号', () => {
  const violations = [];
  const files = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();
  assert.ok(files.length > 0, `${WORKFLOWS_DIR} 未发现 workflow 文件：路径解析可能已失效`);
  for (const file of files) {
    const lines = readFileSync(join(WORKFLOWS_DIR, file), 'utf8').split('\n');
    for (const finding of unquotedHeredocBackticks(lines)) {
      violations.push(
        `${file}:${finding.startLine}: 无引号 heredoc <<${finding.delimiter} 的正文含未转义反引号` +
          `（行 ${finding.backtickLines.join('、')}）；修复：改用 printf（参考 release.yml 的` +
          ` "Publish release summary" 步骤）或给定界符加引号 <<'${finding.delimiter}'`,
      );
    }
  }
  assert.deepEqual(violations, []);
});

test('扫描器语义：单引号内反引号计入；quoted heredoc、转义反引号、here-string 不计', () => {
  // 无引号 heredoc：正文两行反引号 → 一条违规，行号齐全
  assert.deepEqual(
    unquotedHeredocBackticks(['cat >> f <<EOF', '- API: `sha-a`', '- Web: `sha-b`', 'EOF']),
    [{ startLine: 1, delimiter: 'EOF', backtickLines: [2, 3] }],
  );
  // 单引号里的反引号在无引号 heredoc 内同样被执行 → 计入
  assert.deepEqual(unquotedHeredocBackticks(['cat >> f <<EOF', "- API: '`sha'`", 'EOF']), [
    { startLine: 1, delimiter: 'EOF', backtickLines: [2] },
  ]);
  // <<- 无引号形式同样计入
  assert.deepEqual(unquotedHeredocBackticks(['cat <<EOF-2', '`x`', 'EOF-2']), [
    { startLine: 1, delimiter: 'EOF-2', backtickLines: [2] },
  ]);
  // quoted heredoc（<<'EOF' / <<"EOF" / <<\EOF）正文反引号安全 → 不计
  assert.deepEqual(unquotedHeredocBackticks(["cat <<'EOF'", '`x`', 'EOF']), []);
  assert.deepEqual(unquotedHeredocBackticks(['cat <<"EOF"', '`x`', 'EOF']), []);
  assert.deepEqual(unquotedHeredocBackticks(['cat <<\\EOF', '`x`', 'EOF']), []);
  // 转义反引号 \` 是字面反引号 → 不计
  assert.deepEqual(unquotedHeredocBackticks(['cat <<EOF', '- API: \\`sha\\`', 'EOF']), []);
  // <<< here-string 不是 heredoc；其后文件里的反引号行不得误报
  assert.deepEqual(unquotedHeredocBackticks(['IFS=, read -ra N <<< "$X"', '`x`']), []);
  // quoted heredoc 结束后的普通行反引号不误报
  assert.deepEqual(unquotedHeredocBackticks(["cat <<'EOF'", 'py', 'EOF', 'echo `late`']), []);
});
