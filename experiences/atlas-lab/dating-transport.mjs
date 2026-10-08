// The dating backend stays private. HTTPS is terminated by one explicitly
// trusted reverse proxy, which replaces (never appends) these two headers.
import { isIP } from 'node:net';

const fail = (code) => { throw Object.assign(new Error(code), { status: 403, code }); };
const loopback = ip => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);

function normalizeIP(value) {
  if (typeof value !== 'string' || value !== value.trim() || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(normalized);
  if (!mapped) return normalized;
  return [parseInt(mapped[1], 16) >> 8, parseInt(mapped[1], 16) & 255,
    parseInt(mapped[2], 16) >> 8, parseInt(mapped[2], 16) & 255].join('.');
}

function readPublicOrigin(value) {
  if (typeof value !== 'string' || !/^https:\/\/[^\s/?#\\]+\/?$/.test(value))
    throw new TypeError('An exact HTTPS dating public origin is required.');
  let parsed;
  try { parsed = new URL(value); } catch { throw new TypeError('An exact HTTPS dating public origin is required.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password
    || parsed.pathname !== '/' || parsed.search || parsed.hash)
    throw new TypeError('An exact HTTPS dating public origin is required.');
  return parsed;
}

function localHost(req, normalizedSocket = false) {
  let url;
  try { url = new URL(`http://${req.headers.host}`); } catch { fail('origin-required'); }
  const isLoopback = normalizedSocket ? ip => ['127.0.0.1', '::1'].includes(normalizeIP(ip)) : loopback;
  if (!isLoopback(req.socket?.remoteAddress) || !isLoopback(req.socket?.localAddress)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || Number(url.port || 80) !== req.socket.localPort
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('local-host-required');
  return url;
}

function oneHeader(req, name, { optional = false } = {}) {
  const value = req.headers[name];
  let count = 0;
  for (let index = 0; index < (req.rawHeaders?.length || 0); index += 2)
    if (req.rawHeaders[index].toLowerCase() === name) count++;
  if (count > 1 || value === undefined && !optional || value !== undefined
    && (typeof value !== 'string' || !value || value.includes(',') || value !== value.trim())) fail('proxy-headers-invalid');
  return value;
}

function browserOrigin(req, expected, allowHead = false) {
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) fail('cross-site-request');
  if ((!['GET', ...(allowHead ? ['HEAD'] : [])].includes(req.method) || req.headers.origin) && req.headers.origin !== expected) fail('origin-required');
}

export function createDatingTransport({ mode = 'demo', publicOrigin, trustedProxyIPs } = {}) {
  if (!['demo', 'account'].includes(mode)) throw new TypeError('Choose demo or account transport explicitly.');
  if (publicOrigin === undefined) {
    if (trustedProxyIPs !== undefined) throw new TypeError('Trusted dating proxy addresses require a public origin.');
    return Object.freeze({ publicOrigin: null, trustedProxyIPs: Object.freeze([]), assertRequest(req, { serverToServer = false, publicResource = false } = {}) {
      if (publicResource) fail('public-transport-required');
      // Existing local lifecycle delivery has its own stricter transport and
      // credential contract; this preserves that independently verified path.
      if (serverToServer) return;
      browserOrigin(req, localHost(req).origin);
    } });
  }
  if (mode !== 'account') throw new TypeError('Public dating transport requires account mode.');
  const origin = readPublicOrigin(publicOrigin);
  if (!Array.isArray(trustedProxyIPs) || !trustedProxyIPs.length || trustedProxyIPs.length > 16)
    throw new TypeError('One to sixteen exact trusted dating proxy IP addresses are required.');
  const addresses = trustedProxyIPs.map(normalizeIP);
  if (addresses.some(ip => !ip || ip === '0.0.0.0' || ip === '::') || new Set(addresses).size !== addresses.length)
    throw new TypeError('Unique exact trusted dating proxy IP addresses are required.');
  const trusted = new Set(addresses);
  return Object.freeze({ publicOrigin: origin.origin, trustedProxyIPs: Object.freeze(addresses), assertRequest(req, { serverToServer = false, publicResource = false } = {}) {
    if (publicResource && serverToServer) fail('invalid-transport-context');
    if (!trusted.has(normalizeIP(req.socket?.remoteAddress))) fail('trusted-proxy-required');
    localHost(req, true);
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(oneHeader(req, 'host'))) fail('local-host-required');
    // A second forwarding dialect would create conflicting interpretations.
    if (req.headers.forwarded !== undefined || req.rawHeaders?.some((value, index) => index % 2 === 0 && value.toLowerCase() === 'forwarded')) fail('proxy-headers-invalid');
    if (oneHeader(req, 'x-forwarded-proto') !== 'https' || oneHeader(req, 'x-forwarded-host') !== origin.host) fail('forwarded-origin-required');
    oneHeader(req, 'origin', { optional: true });
    oneHeader(req, 'sec-fetch-site', { optional: true });
    if (publicResource) {
      // The public HTML callback is a top-level navigation from the identity
      // provider. Only the static public surface may cross this boundary;
      // authenticated API requests still require our exact browser origin.
      if (!['GET', 'HEAD'].includes(req.method)) fail('public-resource-method-forbidden');
    } else if (serverToServer) {
      if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) fail('lifecycle-browser-forbidden');
    } else browserOrigin(req, origin.origin, true);
  } });
}
