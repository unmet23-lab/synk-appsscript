import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bundlePathApp, validatePathConfig, pathContentSecurityPolicy } from '../../tools/prepare-path-app-public.mjs';

const APP_ROOT = fileURLToPath(new URL('./', import.meta.url));
const FONT_ROOT = new URL('../../docs/브랜드_폰트/', import.meta.url);

// Inter Tight is the approved static Regular (400) file, not a variable font.
export const FONT_FILES = Object.freeze({
  '/assets/SUIT-Variable.woff2': new URL('SUIT/SUIT-Variable.woff2', FONT_ROOT),
  '/assets/InterTight.woff2': new URL('플랫폼_웹/InterTight-Regular.woff2', FONT_ROOT),
  '/assets/SUIT-LICENSE.txt': new URL('SUIT/LICENSE_OFL.txt', FONT_ROOT),
  '/assets/InterTight-LICENSE.txt': new URL('InterTight/OFL.txt', FONT_ROOT),
});

const HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

/** A local static preview. Request paths are never resolved against the disk. */
export function createServer({ root = APP_ROOT, appBundle = null, config = null } = {}) {
  const publicConfig = config ? validatePathConfig(config, { local: true, targetUrl: config.clients?.['path-app']?.redirectUri }) : null;
  const headers = { ...HEADERS, 'Content-Security-Policy': pathContentSecurityPolicy(publicConfig) + "; frame-ancestors 'none'" };
  const files = new Map([
    ['/', [path.join(root, 'index.html'), 'text/html; charset=utf-8']],
    ['/index.html', [path.join(root, 'index.html'), 'text/html; charset=utf-8']],
    ['/styles.css', [path.join(root, 'styles.css'), 'text/css; charset=utf-8']],
    ...['app.mjs', 'state.mjs', 'content.mjs'].map(name => [
      `/${name}`, [path.join(root, name), 'text/javascript; charset=utf-8'],
    ]),
    ...Object.entries(FONT_FILES).map(([route, file]) => [
      route, [file, route.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8'],
    ]),
  ]);

  return http.createServer(async (req, res) => {
    const send = (status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      res.writeHead(status, { ...headers, 'Content-Type': type, 'Content-Length': bytes.length, ...extra });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    };
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Method not allowed\n', undefined, { Allow: 'GET, HEAD' });

    const port = res.socket.localPort;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return send(403, 'Local preview only\n');

    // Keep the raw path: URL normalization must not turn /../app.mjs into an
    // allowed route. Encoded names, dot segments and backslashes stay unlisted.
    const pathname = (req.url ?? '').split('?', 1)[0];
    if (pathname === '/config.json' && publicConfig) return send(200, JSON.stringify(publicConfig), 'application/json; charset=utf-8');
    if (pathname === '/app.mjs' && appBundle) return send(200, appBundle, 'text/javascript; charset=utf-8');
    const file = files.get(pathname);
    if (!file) return send(404, 'Not found\n');
    try { return send(200, await readFile(file[0]), file[1]); }
    catch { return send(404, 'Not found\n'); }
  });
}

export async function serve({ port = Number(process.env.PATH_APP_PORT ?? 4326), root = APP_ROOT, configPath = null } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('PATH_APP_PORT must be an integer between 0 and 65535.');
  if (configPath && port !== 4326) throw new TypeError('Configured PATH preview requires registered port 4326.');
  let config = null;
  if (configPath) {
    const bytes = await readFile(configPath);
    if (bytes.length > 65536) throw new TypeError('PATH public configuration is too large.');
    const raw = JSON.parse(bytes.toString('utf8'));
    config = validatePathConfig(raw, { local: true, targetUrl: raw.clients?.['path-app']?.redirectUri });
  }
  const compiled = await bundlePathApp({ appRoot: root });
  const server = createServer({ root, appBundle: Buffer.from(compiled.bytes), config });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--config')) throw new TypeError('Usage: node experiences/path-app/server.mjs [--config <explicit-public-config.json>]');
    const server = await serve({ configPath: args[1] || null });
    console.log(`SYNK PATH: http://127.0.0.1:${server.address().port}/`);
    const stop = () => { server.close(); server.closeAllConnections(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? 'PATH preview port is already in use.' : error.message);
    process.exitCode = 1;
  }
}
