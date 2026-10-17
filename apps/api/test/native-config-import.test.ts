import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('resolves the actual configuration package entry with native Node rather than Vitest remapping', () => {
  const code = `try {
    const config = await import('@kingturf/config');
    console.log(config.DEFAULT_LOGIN_RATE_LIMIT.failureLimit === 10 ? 'NATIVE_CONFIG_OK' : 'NATIVE_CONFIG_WRONG_DEFAULT');
  } catch (error) { console.log('NATIVE_CONFIG_ERROR:' + (error.code ?? 'UNKNOWN')); }`;
  const result = execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', code],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '' },
    },
  );
  expect(result.trim()).toBe('NATIVE_CONFIG_OK');
});
