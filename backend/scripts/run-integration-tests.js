// Runs *.integration.ts against a running backend + local Supabase.
// Skips (exit 0) when the backend isn't reachable so CI without a DB stays green.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const base = process.env.API_URL || 'http://127.0.0.1:5000';
fetch(`${base}/api/auth/me`).then(() => {
  const tests = readdirSync('src/integration').filter((file) => file.endsWith('.integration.ts')).map((file) => join('src/integration', file));
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...tests], { stdio: 'inherit', env: { ...process.env, API_URL: base } });
  process.exit(result.status ?? 1);
}).catch(() => { console.log(`Backend not reachable at ${base}; skipping integration tests.`); process.exit(0); });
