import { spawnSync } from 'node:child_process';

// Always select the D1 API for this artifact, including builds on Windows.
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const bundle = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DATA_BACKEND: 'cloudflare' }
});
process.exit(bundle.status ?? 1);
