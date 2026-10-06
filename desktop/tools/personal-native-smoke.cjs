'use strict';
// Hidden real Electron with unconfigured synthetic local public configuration.
// Starts only loopback fixture servers and never calls an identity provider.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..'), report = { at: new Date().toISOString(), synthetic: true, checks: [] };
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-personal-smoke-'));
  const config = path.join(directory, 'public.json');
  await fs.writeFile(config, JSON.stringify({ version: 1, supabaseUrl: 'https://synthetic.invalid', supabasePublishableKey: 'sb_publishable_synthetic', clients: {} }));
  const servers = [];
  try {
    for (const [id, folder, port] of [['path', 'path-vr', 4292], ['rehearsal', 'conversation-rehearsal', 4297], ['family-album', 'family-album', 4298]]) {
      const { createServer } = await import('../../experiences/' + folder + '/server.mjs');
      const server = createServer({ port, accountConfig: { version: 1 } });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); servers.push(server);
      const result = await new Promise(resolve => {
        const child = spawn(require('electron'), [path.join(root, 'src/product-main.cjs'), '--synk-product-preview=' + id, '--synk-smoke', '--auth-config=' + config], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = ''; const timer = setTimeout(() => child.kill(), 30000);
        child.stdout.on('data', chunk => { output += chunk; });
        child.on('error', () => { clearTimeout(timer); resolve({ ok: false, clientId: id, error: 'SPAWN_FAILED' }); });
        child.on('close', code => { clearTimeout(timer); const line = output.split(/\r?\n/).find(value => value.startsWith('SYNK_PRODUCT_SMOKE ')); resolve(line ? JSON.parse(line.slice('SYNK_PRODUCT_SMOKE '.length)) : { ok: false, clientId: id, error: 'NO_SMOKE_RESULT', exitCode: code }); });
      });
      report.checks.push(result);
    }
  } finally {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    const resolved = path.resolve(directory); if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('synk-personal-smoke-')) throw Error('Unsafe fixture path');
    await fs.rm(resolved, { recursive: true, force: true });
    report.ok = report.checks.length === 3 && report.checks.every(item => item.ok);
    await fs.mkdir(path.join(root, 'artifacts'), { recursive: true }); await fs.writeFile(path.join(root, 'artifacts/personal-native-20261006.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); if (!report.ok) process.exitCode = 1;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
