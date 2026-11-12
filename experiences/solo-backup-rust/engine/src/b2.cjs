'use strict';
const crypto = require('node:crypto');
const https = require('node:https');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HOST = /^s3\.((?:us-west|us-east|eu-central|ca-east)-\d{3})\.backblazeb2\.com$/;
function endpoint(value) {
  if (typeof value !== 'string' || value.length > 200) throw new Error('B2 버킷 화면의 Endpoint를 입력해 주세요.');
  const input = value.trim();
  // Reject URL-parser normalization of backslashes, userinfo or dot segments.
  const match = /^(?:https:\/\/)?(s3\.[a-z0-9-]+\.backblazeb2\.com)\/?$/.exec(input);
  if (!match || !HOST.test(match[1])) throw new Error('B2의 HTTPS S3 Endpoint만 연결할 수 있습니다.');
  return `https://${match[1]}`;
}
function provider({ endpoint: address, bucket, prefix }, vaultId) {
  const base = endpoint(address);
  if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(bucket)) throw new Error('B2 버킷 이름은 영문 소문자·숫자·하이픈 6~63자로 입력해 주세요.');
  if (!UUID.test(vaultId) || prefix !== `work-backup/${vaultId}`) throw new Error('클라우드 백업 경로를 확인할 수 없습니다.');
  return { type: 'b2', endpoint: base, bucket, prefix };
}
function repository(value, vaultId) {
  const p = provider(value, vaultId);
  return `s3:${p.endpoint}/${p.bucket}/${p.prefix}`;
}
function credentials(value) {
  if (!value || typeof value !== 'object') throw new Error('B2 연결 키를 입력해 주세요.');
  const { keyId, applicationKey } = value;
  if (typeof keyId !== 'string' || !/^[A-Za-z0-9_-]{8,256}$/.test(keyId) || typeof applicationKey !== 'string' || !/^[A-Za-z0-9/+_=-]{8,256}$/.test(applicationKey)) throw new Error('B2 keyID와 applicationKey의 형식을 확인해 주세요.');
  return { keyId, applicationKey };
}
function redact(message, secrets = []) {
  let result = String(message);
  const values = secrets.filter(v => typeof v === 'string' && v.length).flatMap(v => [v, encodeURIComponent(v)]).sort((a, b) => b.length - a.length);
  for (const value of values) result = result.split(value).join('[비밀값]');
  return result.slice(0, 1600);
}
function childOptions(p, key, stateDir, parentEnv, password) {
  const path = require('node:path'); const env = {};
  for (const [k, v] of Object.entries(parentEnv)) if (/^(SystemRoot|WINDIR|PATH|USERPROFILE|LOCALAPPDATA|APPDATA)$/i.test(k)) env[k] = v;
  Object.assign(env, { RESTIC_PASSWORD: password, RESTIC_PROGRESS_FPS: '1', RESTIC_CACHE_DIR: path.join(stateDir, 'cache'), TEMP: path.join(stateDir, 'temp'), TMP: path.join(stateDir, 'temp') });
  const args = [];
  if (p?.type === 'b2') {
    const region = HOST.exec(new URL(endpoint(p.endpoint)).hostname)[1];
    const c = credentials(key);
    Object.assign(env, { AWS_ACCESS_KEY_ID: c.keyId, AWS_SECRET_ACCESS_KEY: c.applicationKey, AWS_DEFAULT_REGION: region, AWS_EC2_METADATA_DISABLED: 'true' });
    args.push('-o', 's3.bucket-lookup=path', '-o', `s3.region=${region}`, '-o', 's3.retries=2');
  }
  return { env, args };
}
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest();
// HEAD only: do not create buckets, enumerate other buckets, follow redirects or
// return provider response bodies. The bucket-scoped key needs no ListBuckets.
async function probeBucket(p, key, { now = Date.now() } = {}) {
  const host = new URL(endpoint(p.endpoint)).hostname;
  if (!/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(p.bucket)) throw new Error('B2 버킷 이름이 올바르지 않습니다.');
  const c = credentials(key), region = HOST.exec(host)[1];
  const stamp = new Date(now).toISOString().replace(/[:-]|\.\d{3}/g, ''), day = stamp.slice(0, 8);
  const route = `/${p.bucket}`, digest = hash('');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${digest}\nx-amz-date:${stamp}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const scope = `${day}/${region}/s3/aws4_request`;
  const request = ['HEAD', route, '', canonicalHeaders, signedHeaders, digest].join('\n');
  const signing = hmac(hmac(hmac(hmac(`AWS4${c.applicationKey}`, day), region), 's3'), 'aws4_request');
  const signature = hmac(signing, `AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${hash(request)}`).toString('hex');
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, port: 443, method: 'HEAD', path: route, timeout: 20000,
      headers: { host, 'x-amz-date': stamp, 'x-amz-content-sha256': digest, authorization: `AWS4-HMAC-SHA256 Credential=${c.keyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` }
    }, response => {
      response.resume();
      if (response.statusCode !== 200) return reject(new Error(response.statusCode === 401 || response.statusCode === 403 ? 'B2 연결 키의 권한·만료·사용 한도를 확인해 주세요. 버킷 전체 Read and Write 권한이 필요합니다.' : response.statusCode === 404 ? 'B2 버킷을 찾지 못했습니다. 버킷 이름과 Endpoint를 확인해 주세요.' : `B2 연결 확인에 실패했습니다 (HTTP ${response.statusCode}). 잠시 뒤 다시 시도해 주세요.`));
      const serverTime = Date.parse(response.headers.date || '');
      if (!Number.isFinite(serverTime) || Math.abs(serverTime - now) > 300000) return reject(new Error('PC 시간과 B2 서버 시간이 맞지 않습니다. Windows 날짜·시간을 자동으로 맞춘 뒤 다시 시도해 주세요.'));
      resolve({ serverTime });
    });
    // A total deadline also bounds DNS/TLS establishment (socket timeout alone
    // does not cover every phase). Neither error text nor request carries keys out.
    const deadline = setTimeout(() => req.destroy(new Error('연결 시간 초과')), 25000);
    req.on('timeout', () => req.destroy(new Error('연결 시간 초과')));
    req.on('error', () => { clearTimeout(deadline); reject(new Error('B2에 연결하지 못했습니다. 인터넷 연결과 Windows 시간을 확인해 주세요.')); });
    req.on('close', () => clearTimeout(deadline));
    req.end();
  });
}
module.exports = { endpoint, provider, repository, credentials, redact, childOptions, probeBucket };
