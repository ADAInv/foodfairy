// Cross-platform dev runner (Windows cmd.exe can't run two processes with "&").
// Builds the server once, then runs the API (:3000) and Vite (:5173) together.
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const node = process.execPath;
const tsc = join('node_modules', 'typescript', 'bin', 'tsc');
const vite = join('node_modules', 'vite', 'bin', 'vite.js');

const built = spawnSync(node, [tsc, '-p', 'tsconfig.server.json'], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

const kids = [
  spawn(node, ['--disable-warning=ExperimentalWarning', 'dist/server/index.js'], { stdio: 'inherit' }),
  spawn(node, [vite, '--config', 'client/vite.config.ts'], { stdio: 'inherit' })
];
const stop = () => { for (const k of kids) if (!k.killed) k.kill(); };
for (const k of kids) k.on('exit', (code) => { stop(); process.exit(code ?? 0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
