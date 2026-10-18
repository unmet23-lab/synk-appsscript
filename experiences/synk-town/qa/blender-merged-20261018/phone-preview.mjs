// Same-Wi-Fi phone preview for the merged-town QA (10-18, step ④).
// The Town server answers only 127.0.0.1 (bind address and Host check), so this
// script starts a fresh in-memory preview server on loopback and a relay on the
// PC's Wi-Fi address. The relay accepts only the same /24, rewrites Host and
// Origin for the preview server, adds a crypto.randomUUID shim (see SHIM) and a
// small measurement panel (phone-hud.js) to day.html, and appends what the panel
// posts to a JSON-lines file.
// Product files are not changed; stop it with Ctrl+C (or by ending the process).
//   node experiences/synk-town/qa/blender-merged-20261018/phone-preview.mjs [--ip=<Wi-Fi IPv4>] [--port=4389] [--out=<jsonl>]
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), town = path.resolve(here, '../..');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const lan = a => a.family === 'IPv4' && !a.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
const ip = args.ip || Object.values(os.networkInterfaces()).flat().find(lan)?.address;
if (!ip) throw Error('no private IPv4 address on this PC (join the Wi-Fi first, or pass --ip=)');
const port = Number(args.port || 4389);
const out = path.resolve(args.out || path.join(town, '../../.tmp/town-merged-20261018/phone-reports.jsonl'));
fs.mkdirSync(path.dirname(out), { recursive: true });

const { createStore, createServer } = await import(pathToFileURL(path.join(town, 'server.mjs')).href);
const inner = createServer({ previewEnabled: true, store: createStore({ lifeEnabled: true }) });
await new Promise(resolve => inner.listen(0, '127.0.0.1', resolve));
const innerHost = `127.0.0.1:${inner.address().port}`;

const subnet = ip.split('.').slice(0, 3).join('.') + '.';
const HUD = path.join(here, 'phone-hud.js'); // read per request, so panel edits need no restart
const TAG = '<script src="/__phone-hud.js" defer></script>';
// A LAN address over http is not a secure context, so crypto.randomUUID (which
// Town calls at start) is missing there; localhost and https have it. This shim
// runs before Town's scripts and only on this relay.
const SHIM = "if (globalThis.crypto && !crypto.randomUUID) crypto.randomUUID = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128; const h = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };\n";
const SHIM_TAG = '<script src="/__phone-shim.js"></script>';
// day-app.mjs opens the first day only on 127.0.0.1/localhost (a product guard).
// The relay adds its own Wi-Fi address to that list in the copy it serves, the
// way the QA harness patches day-scene.mjs (../blender-district-20261017/lib.cjs).
const PATCHES = {
  '/day-app.mjs': [["!['127.0.0.1', 'localhost'].includes(location.hostname)", `!['127.0.0.1', 'localhost', '${ip}'].includes(location.hostname)`]],
};
// The preview server's CSP has no 'wasm-unsafe-eval', no 'unsafe-eval' and no
// blob:, so the KTX2 transcoder (WebAssembly plus Emscripten glue that builds
// functions from strings, in a blob worker) and GLTFLoader's blob image URLs are
// blocked and the baked set fails back to v20. The QA harness never saw it: it
// opens pages with Playwright's bypassCSP. The relay widens only those sources.
const widenCsp = csp => csp
  .replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob:")
  .replace("connect-src 'self'", "connect-src 'self' blob: data:")
  .replace("img-src 'self'", "img-src 'self' blob: data:") + "; worker-src 'self' blob:";
for (const [file, list] of Object.entries(PATCHES)) {
  const body = fs.readFileSync(path.join(town, file), 'utf8');
  for (const [from] of list) if (!body.includes(from)) throw Error(`${file}: patch anchor missing (${from.slice(0, 40)})`);
}

const relay = http.createServer((req, res) => {
  const from = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (!from.startsWith(subnet)) { res.writeHead(403); return res.end(); }
  const route = req.url.split('?')[0];
  if (route === '/__phone-hud.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(HUD));
  }
  if (route === '/__phone-shim.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(SHIM);
  }
  if (route === '/__phone-report' && req.method === 'POST') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; if (body.length > 32768) req.destroy(); });
    req.on('end', () => {
      try { fs.appendFileSync(out, JSON.stringify({ at: new Date().toISOString(), from, ...JSON.parse(body) }) + '\n'); res.writeHead(204); }
      catch { res.writeHead(400); }
      res.end();
    });
    return;
  }
  const headers = { ...req.headers, host: innerHost };
  if (headers.origin) headers.origin = `http://${innerHost}`;
  const rewrite = route === '/day.html' || PATCHES[route];
  if (rewrite) delete headers['accept-encoding'];
  const upstream = http.request({ host: '127.0.0.1', port: inner.address().port, method: req.method, path: req.url, headers }, up => {
    if (up.headers['content-security-policy']) up.headers['content-security-policy'] = widenCsp(up.headers['content-security-policy']);
    if (!rewrite || up.statusCode !== 200 || req.method !== 'GET') { res.writeHead(up.statusCode, up.headers); up.pipe(res); return; }
    let text = '';
    up.setEncoding('utf8');
    up.on('data', chunk => { text += chunk; });
    up.on('end', () => {
      if (route === '/day.html') {
        const first = text.indexOf('<script');
        text = first >= 0 ? text.slice(0, first) + SHIM_TAG + text.slice(first) : SHIM_TAG + text;
        text = text.includes('</body>') ? text.replace('</body>', TAG + '</body>') : text + TAG;
      } else {
        for (const [from, to] of PATCHES[route]) text = text.replace(from, to);
      }
      const h = { ...up.headers }; delete h['content-length'];
      res.writeHead(200, h); res.end(text);
    });
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
relay.on('error', error => { console.error('phone relay:', error.code || error.message); process.exit(1); });
relay.listen(port, ip, () => {
  const base = `http://${ip}:${port}/day.html?play=walk`;
  console.log(JSON.stringify({ relay: `${ip}:${port}`, subnet: subnet + '0/24', reports: out,
    urls: { v20: base, merged: base + '&district=town-merged', wide: base + '&district=townwide-merged' } }, null, 1));
});
