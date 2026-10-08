import { request } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Probe the local listener with the configured public Host. No public request,
// credentials, model call or database mutation is needed for readiness.
export async function checkCompanyHealth({ env = process.env, timeoutMs = 4000 } = {}) {
  let origin, port;
  try {
    origin = new URL(env.SYNK_COMPANY_ORIGIN);
    port = Number(env.SYNK_COMPANY_PORT || 4191);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash
      || !Number.isInteger(port) || port < 1 || port > 65535) return false;
  } catch { return false; }
  return await new Promise(resolveResult => {
    const finish = value => { clearTimeout(timer); resolveResult(value); };
    const req = request({ hostname: '127.0.0.1', port, path: '/api/health', method: 'GET',
      headers: { Host: origin.host, Accept: 'application/json' } }, res => {
      let raw = '', bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 4096) { res.destroy(); finish(false); return; }
        raw += chunk.toString('utf8');
      });
      res.on('error', () => finish(false));
      res.on('end', () => {
        try {
          const body = JSON.parse(raw);
          finish(res.statusCode === 200 && body.ok === true && body.ready === true
            && body.app === 'synk-company' && body.workspaceIntegration === true);
        } catch { finish(false); }
      });
    });
    const timer = setTimeout(() => { req.destroy(); finish(false); }, timeoutMs);
    req.on('error', () => finish(false));
    req.end();
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const healthy = await checkCompanyHealth();
  console.log(healthy ? 'SYNK company health: ready' : 'SYNK company health: unavailable');
  process.exitCode = healthy ? 0 : 1;
}
