const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const findTests = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? findTests(path) : entry.name.endsWith('.test.ts') ? [path] : [];
});

const tests = findTests('src');
if (!tests.length) throw new Error('No test files found');

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
