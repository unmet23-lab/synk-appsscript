// Minimal AWS SigV4 request for B2's S3-compatible API — used by operator tools
// and tests to observe exactly what a key can do (HeadBucket, Put, Delete with
// and without versionId). Never returns or logs credentials.
import crypto from 'node:crypto';

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// A socket that B2 closed while idle fails before any response; only that case
// is retried, so the status codes this tool reports are B2's own answers.
export async function s3Request(opts) {
  for (let i = 0; ; i++) {
    try { return await s3Once({ ...opts, now: new Date() }); }
    catch (e) { if (i >= (opts.retries ?? 2) || !(e?.name === 'TypeError' || e?.name === 'TimeoutError')) throw e; await new Promise((ok) => setTimeout(ok, 1000 * 2 ** i)); }
  }
}

async function s3Once({ endpoint, region, keyId, secret, method, bucket, key = '', query = {}, body, headers = {}, fetchImpl = fetch, timeoutMs = 60000, now = new Date() }) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || !/^s3\.[a-z]+-[a-z]+-\d{3}\.backblazeb2\.com$/.test(url.host)) throw new Error('S3_ENDPOINT_INVALID');
  const payload = body === undefined ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(body);
  const path = '/' + enc(bucket) + (key ? '/' + key.split('/').map(enc).join('/') : '');
  const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(String(query[k] ?? ''))}`).join('&');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const day = amzDate.slice(0, 8);
  const payloadHash = sha256hex(payload);
  const signed = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  for (const [k, v] of Object.entries(headers)) signed[k.toLowerCase()] = String(v);
  const names = Object.keys(signed).sort();
  const canonical = [method, path, qs, names.map((k) => `${k}:${signed[k].trim()}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const key4 = hmac(hmac(hmac(hmac('AWS4' + secret, day), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', key4).update(toSign).digest('hex');
  const send = { ...signed }; delete send.host; // fetch sets Host itself (same value as signed)
  send.authorization = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const res = await fetchImpl(`${url.origin}${path}${qs ? '?' + qs : ''}`, { method, headers: send,
    body: ['GET', 'HEAD', 'DELETE'].includes(method) ? undefined : payload, signal: AbortSignal.timeout(timeoutMs) });
  const text = method === 'HEAD' ? '' : await res.text();
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] || null;
  return { status: res.status, code, headers: Object.fromEntries(res.headers), body: text.slice(0, 2000) };
}
