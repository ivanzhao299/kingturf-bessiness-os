import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { profileArgumentPattern } from './ownership.mjs';

test('owned Chrome argument matches exact profile, not neighbors or unrelated arguments', () => {
  const profile = 'D:\\Synthetic Temp\\kingturf-cdp-preflight-aB12';
  const pattern = profileArgumentPattern(profile);
  const rows = [
    [`chrome.exe "--user-data-dir=${profile}" --headless=new`, true],
    [`chrome.exe --user-data-dir="${profile}" --headless=new`, true],
    [`chrome.exe "--user-data-dir=${profile.toLowerCase()}"`, true],
    [`chrome.exe "--user-data-dir=${profile}-neighbor"`, false],
    [`chrome.exe "--user-data-dir=${profile}\\child"`, false],
    [`chrome.exe "--note=${profile}"`, false],
    [`chrome.exe "--user-data-dir=D:\\Other" "--note=${profile}"`, false],
  ];
  for (const [command, expected] of rows)
    assert.equal(new RegExp(pattern, 'i').test(command), expected);
  // Execute the exact .NET regex dialect used by cleanup against synthetic metadata only.
  // No process lookup, stop, or profile creation in this predicate test.
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const script = `$pattern=${quote(pattern)}; @(${rows.map(([command]) => `[regex]::IsMatch(${quote(command)}, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)`).join(';')}) | ConvertTo-Json -Compress`;
  const actual = JSON.parse(
    execFileSync(
      '/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: 10000 },
    ),
  );
  assert.deepEqual(
    actual,
    rows.map(([, expected]) => expected),
  );
});
