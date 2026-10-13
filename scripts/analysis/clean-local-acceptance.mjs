import { realpath } from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(repositoryRoot, '.local-acceptance');
const expectedParent = resolve(repositoryRoot);
const targetParent = resolve(target, '..');

if (targetParent !== expectedParent || target === repositoryRoot || target === resolve('/'))
  throw new Error(`Refusing unsafe cleanup target: ${target}`);

let existing;
try {
  existing = await realpath(target);
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log('No .local-acceptance directory exists.');
    process.exit(0);
  }
  throw error;
}

if (existing !== target) throw new Error(`Refusing non-canonical cleanup target: ${existing}`);
await rm(target, { recursive: true, force: false });
console.log(`Removed ${target}`);
