#!/usr/bin/env node
// PATH 면접실 영상을 Google Cloud Storage 공개 버킷에 올린다(여러 번 돌려도 같다).
//
// 왜: synk.im(GitHub Pages)은 공개할 때마다 사이트 전체 캐시를 비운다. 직후 첫 방문자는 4K 영상(장면당 약 10MB)을
// 원본에서 초당 약 200KB로 받아 면접 준비가 60초를 넘겼다(10-12·10-13 재현). 영상만 이 버킷에서 받는다.
//
// - 버킷: synk-public-media(ASIA-NORTHEAST3 서울, 균일 접근, allUsers 읽기). 결제 계정·프로젝트는
//   tools/모델정책.js가 붙인 계정(결정 표 10-08: unmet27@gmail.com · synk-bake-unmet27).
// - 경로: path/interview/film/<sha256 앞 16자>/<파일 이름> — 내용이 바뀌면 경로도 바뀌므로 1년 캐시(immutable)를 건다.
// - CORS: synk.im만. 3D 방이 영상 프레임을 그래픽(WebGL)으로 쓰므로 재생기가 crossOrigin='anonymous'로 받는다.
// - 공개 묶음(tools/package-path-interview.mjs --pages)이 영상 목록의 주소를 같은 규칙으로 바꾼다.
//
// 사용: node tools/upload-path-media.mjs [--check]   (--check는 올리지 않고 공개 주소·CORS만 확인)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PATH_VR = path.join(ROOT, 'experiences/path-vr');
export const BUCKET = 'synk-public-media';
export const LOCATION = 'ASIA-NORTHEAST3';
export const PUBLIC_BASE = `https://storage.googleapis.com/${BUCKET}/`;
export const CORS_ORIGINS = Object.freeze(['https://synk.im', 'https://www.synk.im']);
export const mediaObjectName = (fileName, sha256) => `path/interview/film/${sha256.slice(0, 16)}/${fileName}`;
export const mediaPublicUrl = (fileName, sha256) => PUBLIC_BASE + mediaObjectName(fileName, sha256);

// 영상 목록의 모든 원본(장면 src와 화질별 판)을 sha256과 함께 모은다.
export function manifestMedia(manifestPath = path.join(PATH_VR, 'interview/film/strict-manifest.json')) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const seen = new Map();
  for (const clip of manifest.clips) {
    for (const media of [clip, ...Object.values(clip.variants || {})]) {
      if (!media?.src || !media.sha256) continue;
      const file = path.resolve(path.dirname(path.join(PATH_VR, 'interview/film-player.mjs')), media.src);
      const name = path.basename(file);
      const known = seen.get(file);
      if (known && known.sha256 !== media.sha256) throw new Error(`same file, two hashes: ${name}`);
      seen.set(file, { file, name, sha256: media.sha256 });
    }
  }
  return [...seen.values()];
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const md5b64 = (bytes) => crypto.createHash('md5').update(bytes).digest('base64');

async function main() {
  const check = process.argv.includes('--check');
  const media = manifestMedia();
  for (const item of media) {
    const bytes = fs.readFileSync(item.file);
    if (sha256(bytes) !== item.sha256) throw new Error(`manifest sha256 does not match the file: ${item.name}`);
    item.bytes = bytes.length; item.md5 = md5b64(bytes); item.object = mediaObjectName(item.name, item.sha256); item.url = mediaPublicUrl(item.name, item.sha256);
  }
  const receipt = { at: new Date().toISOString(), bucket: BUCKET, location: LOCATION, corsOrigins: CORS_ORIGINS, objects: [] };
  if (!check) {
    const policy = require(path.join(ROOT, 'tools/모델정책.js'));
    const project = policy.벌텍스프로젝트();
    const auth = async () => ({ Authorization: `Bearer ${await policy.벌텍스토큰()}` });
    const api = async (method, url, body, headers = {}) => {
      const response = await fetch(url, { method, headers: { ...(await auth()), ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined });
      const text = await response.text();
      return { status: response.status, json: text ? (() => { try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; } })() : null };
    };
    const base = 'https://storage.googleapis.com/storage/v1';
    let bucket = await api('GET', `${base}/b/${BUCKET}`);
    if (bucket.status === 404) {
      bucket = await api('POST', `${base}/b?project=${encodeURIComponent(project)}`, {
        name: BUCKET, location: LOCATION, storageClass: 'STANDARD',
        iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'inherited' },
        cors: [{ origin: CORS_ORIGINS, method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Range'], maxAgeSeconds: 3600 }],
      });
      if (bucket.status !== 200) throw new Error(`bucket create ${bucket.status}: ${JSON.stringify(bucket.json).slice(0, 400)}`);
      console.log('created bucket', BUCKET, 'in', LOCATION, 'project', project);
    } else if (bucket.status !== 200) throw new Error(`bucket read ${bucket.status}: ${JSON.stringify(bucket.json).slice(0, 300)}`);
    else {
      const patched = await api('PATCH', `${base}/b/${BUCKET}`, { cors: [{ origin: CORS_ORIGINS, method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Range'], maxAgeSeconds: 3600 }] });
      if (patched.status !== 200) throw new Error(`bucket cors ${patched.status}`);
    }
    const iam = await api('GET', `${base}/b/${BUCKET}/iam`);
    if (iam.status !== 200) throw new Error(`iam read ${iam.status}`);
    const bindings = iam.json.bindings || [];
    const viewer = bindings.find((b) => b.role === 'roles/storage.objectViewer');
    if (!viewer?.members?.includes('allUsers')) {
      if (viewer) viewer.members.push('allUsers'); else bindings.push({ role: 'roles/storage.objectViewer', members: ['allUsers'] });
      const set = await api('PUT', `${base}/b/${BUCKET}/iam`, { ...iam.json, bindings });
      if (set.status !== 200) throw new Error(`iam set ${set.status}: ${JSON.stringify(set.json).slice(0, 400)}`);
      console.log('made objects publicly readable');
    }
    for (const item of media) {
      const existing = await api('GET', `${base}/b/${BUCKET}/o/${encodeURIComponent(item.object)}`);
      if (existing.status === 200 && existing.json.md5Hash === item.md5 && existing.json.cacheControl === 'public, max-age=31536000, immutable') { item.uploaded = 'kept'; continue; }
      const boundary = 'synk' + crypto.randomBytes(12).toString('hex');
      const meta = JSON.stringify({ name: item.object, contentType: 'video/mp4', cacheControl: 'public, max-age=31536000, immutable', metadata: { sha256: item.sha256, source: path.relative(ROOT, item.file).replace(/\\/g, '/') } });
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`),
        fs.readFileSync(item.file), Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const up = await api('POST', `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart`, new Uint8Array(body), { 'Content-Type': `multipart/related; boundary=${boundary}` });
      if (up.status !== 200 || up.json.md5Hash !== item.md5) throw new Error(`upload ${item.name} ${up.status}: ${JSON.stringify(up.json).slice(0, 300)}`);
      item.uploaded = 'uploaded';
      console.log('uploaded', item.object, item.bytes);
    }
  }
  // 공개 주소 확인: 로그인 없이 받히는지, synk.im 출처로 CORS가 붙는지, 범위 요청(206)이 되는지.
  for (const item of media) {
    let head = await fetch(item.url, { method: 'HEAD' });
    for (let attempt = 0; head.status === 403 && attempt < 12; attempt++) { // 새 공개 권한이 퍼지는 동안
      await new Promise((resolve) => setTimeout(resolve, 10000));
      head = await fetch(item.url, { method: 'HEAD' });
    }
    const ranged = await fetch(item.url, { headers: { Origin: 'https://synk.im', Range: 'bytes=0-1023' } });
    const buf = Buffer.from(await ranged.arrayBuffer());
    const row = { name: item.name, object: item.object, url: item.url, bytes: item.bytes, sha256: item.sha256, uploaded: item.uploaded || 'not-run', head: head.status, length: Number(head.headers.get('content-length')), cacheControl: head.headers.get('cache-control'), contentType: head.headers.get('content-type'), range: ranged.status, rangeBytes: buf.length, acao: ranged.headers.get('access-control-allow-origin') };
    receipt.objects.push(row);
    if (row.head !== 200 || row.length !== item.bytes || row.range !== 206 || row.rangeBytes !== 1024 || row.acao !== 'https://synk.im' || !/immutable/.test(row.cacheControl || '')) throw new Error('public check failed: ' + JSON.stringify(row));
  }
  const out = path.join(PATH_VR, 'qa/media-hosting-20261013/receipt.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(receipt, null, 1) + '\n');
  console.log(JSON.stringify({ bucket: BUCKET, objects: receipt.objects.length, bytes: receipt.objects.reduce((s, o) => s + o.bytes, 0), kept: receipt.objects.filter((o) => o.uploaded === 'kept').length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
