import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wanted = JSON.parse(readFileSync(resolve(project, 'package.json'), 'utf8')).hyperframesCliVersion;
const cache = join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
const candidates = [resolve(project, 'node_modules/hyperframes')];
if (existsSync(cache)) candidates.push(...readdirSync(cache).map(name => join(cache, name, 'node_modules/hyperframes')));
let cli;
for (const folder of candidates) {
  try {
    const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
    const file = join(folder, 'bin/hyperframes.mjs');
    if (pkg.version === wanted && existsSync(file)) { cli = file; break; }
  } catch { /* A partial or unrelated npm cache entry is not an installed CLI. */ }
}
if (!cli) throw new Error(`HyperFrames ${wanted} is not installed. Stop and report; this wrapper never installs packages.`);
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd: project, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
