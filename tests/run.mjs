import { build } from 'rolldown';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
const directory = await mkdtemp(join(tmpdir(), 'concepts-tests-'));
try {
  const file = join(directory, 'tests.mjs');
  await build({ input: 'tests/all.test.ts', platform: 'node',
    transform: { define: { 'import.meta.env.DEV': 'false' } },
    output: { file, format: 'esm' } });
  const result = spawnSync(process.execPath, ['--test', file], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
