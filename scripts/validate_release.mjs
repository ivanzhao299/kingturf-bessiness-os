import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'ivanzhao299/kingturf-bessiness-os';
const commitPattern = /^[0-9a-f]{40}$/;
const isCommitSha = (value) =>
  typeof value === 'string' && value.length === 40 && commitPattern.test(value);
const origins = new Set([
  `https://github.com/${repository}`,
  `https://github.com/${repository}.git`,
  `git@github.com:${repository}.git`,
]);

export function assertDispatch(input) {
  if (input.repository !== repository || input.workflowRef !== 'refs/heads/main')
    throw new Error('Production releases must use the canonical repository main workflow');
  if (!isCommitSha(input.sha))
    throw new Error('Release input must be an exact lowercase 40-character commit SHA');
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

// The injectable Git runner is for local fixtures; the CLI always uses the real origin.
export function validateRelease(input, runGit = git) {
  assertDispatch(input);
  if (!isCommitSha(input.controlSha))
    throw new Error('Release control must use an exact commit SHA');
  const remoteUrls = runGit(['remote', 'get-url', '--all', 'origin']).trim().split('\n');
  if (remoteUrls.length !== 1 || !origins.has(remoteUrls[0]))
    throw new Error('Release origin is not the canonical GitHub repository');
  if (runGit(['rev-parse', '--verify', 'HEAD']) !== input.controlSha)
    throw new Error('Release control checkout does not match the workflow commit');

  runGit([
    'fetch',
    '--no-tags',
    '--no-recurse-submodules',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
  ]);
  const mainSha = runGit(['rev-parse', '--verify', 'refs/remotes/origin/main']);
  if (!isCommitSha(mainSha)) throw new Error('Trusted main did not resolve to a commit SHA');
  for (const sha of [input.controlSha, input.sha]) {
    try {
      if (
        runGit(['cat-file', '-t', sha]) !== 'commit' ||
        runGit(['rev-parse', '--verify', `${sha}^{commit}`]) !== sha
      )
        throw new Error('Not a canonical commit');
      runGit(['merge-base', '--is-ancestor', sha, mainSha]);
    } catch {
      throw new Error('Release and control commits must exist in trusted main history');
    }
  }
  return { commit_sha: input.sha, control_sha: input.controlSha, main_sha: mainSha };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = validateRelease({
      sha: process.env.RELEASE_SHA,
      controlSha: process.env.RELEASE_CONTROL_SHA,
      repository: process.env.GITHUB_REPOSITORY,
      workflowRef: process.env.GITHUB_REF,
    });
    // Only fixed keys and verified hexadecimal values reach the Actions output file.
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        Object.entries(result)
          .map(([key, value]) => `${key}=${value}\n`)
          .join(''),
      );
    console.log(JSON.stringify(result));
  } catch {
    console.error('Release validation failed; no deployment is authorized');
    process.exitCode = 1;
  }
}
