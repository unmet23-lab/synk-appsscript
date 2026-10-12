#!/usr/bin/env node
// PATH 면접실의 영상과 음성 모델을 Google Cloud Storage 공개 버킷에 올린다(여러 번 돌려도 같다).
//
// 왜: synk.im(GitHub Pages)은 공개할 때마다 사이트 전체 캐시를 비운다. 직후 첫 방문자는 4K 영상(장면당 약 10MB)을
// 원본에서 초당 약 200KB로 받아 면접 준비가 60초를 넘겼다(10-12·10-13 재현). 큰 파일만 이 버킷에서 받는다.
//
// - 프로젝트: synk-path-media(공개 미디어 전용, 결제 unmet27 · 01864D-0E650C-40F3CB). 회사 운영 프로젝트와 떨어뜨려
//   예산(월 한도)과 자동 차단(tools/path-media-cap/)이 이 프로젝트 비용만 본다.
// - 버킷: synk-path-media(ASIA-NORTHEAST3 서울, 균일 접근, allUsers 읽기, CORS synk.im).
// - 영상: path/v2/interview/film/<sha256 앞 16자>/<파일 이름>. 음성 모델: path/v2/models/<모델 파일 묶음 해시 16자>/whisper-base/<파일>.
//   내용이 바뀌면 경로도 바뀌므로 브라우저에는 1년 캐시(immutable)를 건다. 공유 캐시는 막는다(private): public이면
//   구글 가장자리 캐시가 사본을 들고 있다가 월 한도로 버킷을 닫은 뒤에도 내준다(10-13 Age 헤더로 확인).
//   그때 public으로 올렸던 path/interview·path/models 객체는 아무 페이지도 가리키지 않는다(v2로 새로 올림).
// - 공개 묶음(tools/package-path-interview.mjs --pages)이 영상 목록 주소와 media-hosting.json을 같은 규칙으로 만든다.
//
// 사용: node tools/upload-path-media.mjs [--check]   (--check는 올리지 않고 공개 주소·CORS만 확인)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { WHISPER_PUBLIC_FILES } from '../experiences/path-vr/server.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PATH_VR = path.join(ROOT, 'experiences/path-vr');
export const PROJECT = 'synk-path-media';
export const BUCKET = 'synk-path-media';
export const LOCATION = 'ASIA-NORTHEAST3';
export const PUBLIC_BASE = `https://storage.googleapis.com/${BUCKET}/`;
export const PUBLIC_PREFIX = PUBLIC_BASE + 'path/';
export const CORS_ORIGINS = Object.freeze(['https://synk.im', 'https://www.synk.im']);
// 올린 객체마다 공개 확인 결과를 남긴다. 공개 묶음은 여기에 없는 주소를 영상 목록·모델 위치로 쓰지 않는다.
export const UPLOAD_RECEIPT = path.join(PATH_VR, 'qa/media-hosting-20261013/receipt.json');
const CORS = [{ origin: CORS_ORIGINS, method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Range'], maxAgeSeconds: 3600 }];
const CACHE = 'private, max-age=31536000, immutable';
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const md5b64 = (bytes) => crypto.createHash('md5').update(bytes).digest('base64');

export const mediaObjectName = (fileName, digest) => `path/v2/interview/film/${digest.slice(0, 16)}/${fileName}`;
export const mediaPublicUrl = (fileName, digest) => PUBLIC_BASE + mediaObjectName(fileName, digest);

// 영상 목록의 모든 원본(장면 src와 화질별 판)을 sha256과 함께 모은다.
export function manifestMedia(manifestPath = path.join(PATH_VR, 'interview/film/strict-manifest.json')) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const seen = new Map();
  for (const clip of manifest.clips) {
    for (const media of [clip, ...Object.values(clip.variants || {})]) {
      if (!media?.src || !media.sha256) continue;
      const file = path.resolve(PATH_VR, 'interview', media.src);
      const known = seen.get(file);
      if (known && known.sha256 !== media.sha256) throw new Error(`same file, two hashes: ${path.basename(file)}`);
      seen.set(file, { file, name: path.basename(file), sha256: media.sha256, object: mediaObjectName(path.basename(file), media.sha256), contentType: 'video/mp4' });
    }
  }
  return [...seen.values()];
}

// 음성 모델(whisper-base) 파일과 그 묶음 해시. transformers.js가 `${모델 바탕}whisper-base/<파일>`을 받는다.
export function modelFiles() {
  const files = WHISPER_PUBLIC_FILES.filter((file) => file.startsWith('models/whisper-base/')).sort();
  const rows = files.map((rel) => { const file = path.join(PATH_VR, rel); return { rel, file, sha256: sha256(fs.readFileSync(file)) }; });
  const revision = sha256(rows.map((row) => `${row.rel}\t${row.sha256}`).join('\n')).slice(0, 16);
  const type = (rel) => rel.endsWith('.json') ? 'application/json' : rel.endsWith('.onnx') ? 'application/octet-stream' : 'text/plain; charset=utf-8';
  return { revision, base: `${PUBLIC_PREFIX}v2/models/${revision}/`, files: rows.map((row) => ({ ...row, name: row.rel, object: `path/v2/models/${revision}/${row.rel.slice('models/'.length)}`, contentType: type(row.rel) })) };
}
export const modelBaseUrl = () => modelFiles().base;

async function main() {
  const check = process.argv.includes('--check');
  const films = manifestMedia();
  for (const item of films) if (sha256(fs.readFileSync(item.file)) !== item.sha256) throw new Error(`manifest sha256 does not match the file: ${item.name}`);
  const model = modelFiles();
  const objects = [...films, ...model.files].map((item) => ({ ...item, bytes: fs.statSync(item.file).size, url: PUBLIC_BASE + item.object }));
  const receipt = { at: new Date().toISOString(), project: PROJECT, bucket: BUCKET, location: LOCATION, corsOrigins: CORS_ORIGINS, modelBase: model.base, objects: [] };
  if (!check) {
    const policy = require(path.join(ROOT, 'tools/모델정책.js'));
    const api = async (method, url, body, headers = {}) => {
      const token = await policy.벌텍스토큰();
      const binary = body instanceof Uint8Array;
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, ...(body && !binary ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: binary ? body : body ? JSON.stringify(body) : undefined });
      const text = await response.text();
      return { status: response.status, json: text ? (() => { try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; } })() : null };
    };
    const base = 'https://storage.googleapis.com/storage/v1';
    let bucket = await api('GET', `${base}/b/${BUCKET}`);
    if (bucket.status === 404) {
      bucket = await api('POST', `${base}/b?project=${PROJECT}`, { name: BUCKET, location: LOCATION, storageClass: 'STANDARD', labels: { purpose: 'path-public-media' },
        iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'inherited' }, cors: CORS });
      if (bucket.status !== 200) throw new Error(`bucket create ${bucket.status}: ${JSON.stringify(bucket.json).slice(0, 400)}`);
      console.log('created bucket', BUCKET, 'in', LOCATION, 'project', PROJECT);
    } else if (bucket.status !== 200) throw new Error(`bucket read ${bucket.status}: ${JSON.stringify(bucket.json).slice(0, 300)}`);
    else if ((await api('PATCH', `${base}/b/${BUCKET}`, { cors: CORS })).status !== 200) throw new Error('bucket cors update failed');
    const iam = await api('GET', `${base}/b/${BUCKET}/iam?optionsRequestedPolicyVersion=3`); // 조건부 바인딩이 있어도 읽히게
    if (iam.status !== 200) throw new Error(`iam read ${iam.status}`);
    const labels = (await api('GET', `${base}/b/${BUCKET}?fields=labels`)).json?.labels || {};
    const viewer = (iam.json.bindings || []).find((b) => b.role === 'roles/storage.objectViewer' && !b.condition);
    // 월 한도를 넘겨 자동 차단이 닫아 둔 버킷은 열지 않는다(budget-capped 라벨 · tools/path-media-cap/).
    if (!viewer?.members?.includes('allUsers') && labels['budget-capped'] !== 'yes') {
      const bindings = iam.json.bindings || [];
      if (viewer) viewer.members.push('allUsers'); else bindings.push({ role: 'roles/storage.objectViewer', members: ['allUsers'] });
      const set = await api('PUT', `${base}/b/${BUCKET}/iam`, { ...iam.json, bindings });
      if (set.status !== 200) throw new Error(`iam set ${set.status}: ${JSON.stringify(set.json).slice(0, 400)}`);
      console.log('made objects publicly readable');
    }
    for (const item of objects) {
      const bytes = fs.readFileSync(item.file), md5 = md5b64(bytes);
      const existing = await api('GET', `${base}/b/${BUCKET}/o/${encodeURIComponent(item.object)}`);
      if (existing.status === 200 && existing.json.md5Hash === md5 && existing.json.cacheControl === CACHE) { item.uploaded = 'kept'; continue; }
      const boundary = 'synk' + crypto.randomBytes(12).toString('hex');
      const meta = JSON.stringify({ name: item.object, contentType: item.contentType, cacheControl: CACHE, metadata: { sha256: item.sha256, source: path.relative(ROOT, item.file).replace(/\\/g, '/') } });
      const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${item.contentType}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const up = await api('POST', `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart`, new Uint8Array(body), { 'Content-Type': `multipart/related; boundary=${boundary}` });
      if (up.status !== 200 || up.json.md5Hash !== md5) throw new Error(`upload ${item.name} ${up.status}: ${JSON.stringify(up.json).slice(0, 300)}`);
      item.uploaded = 'uploaded'; console.log('uploaded', item.object, item.bytes);
    }
  }
  // 공개 주소 확인: 로그인 없이 받히는지, synk.im 출처로 CORS가 붙는지, 범위 요청(206)이 되는지, 1년 캐시인지.
  for (const item of objects) {
    let head = await fetch(item.url, { method: 'HEAD' });
    for (let attempt = 0; head.status === 403 && attempt < 12; attempt++) { await new Promise((resolve) => setTimeout(resolve, 10000)); head = await fetch(item.url, { method: 'HEAD' }); }
    const ranged = await fetch(item.url, { headers: { Origin: 'https://synk.im', Range: 'bytes=0-15' } });
    const got = Buffer.from(await ranged.arrayBuffer());
    const row = { name: item.name, object: item.object, url: item.url, bytes: item.bytes, sha256: item.sha256, uploaded: item.uploaded || 'not-run', head: head.status, length: Number(head.headers.get('content-length')), cacheControl: head.headers.get('cache-control'), contentType: head.headers.get('content-type'), range: ranged.status, rangeBytes: got.length, acao: ranged.headers.get('access-control-allow-origin') };
    receipt.objects.push(row);
    if (row.head !== 200 || row.length !== item.bytes || row.range !== 206 || row.rangeBytes !== Math.min(16, item.bytes) || row.acao !== 'https://synk.im' || row.cacheControl !== CACHE) throw new Error('public check failed: ' + JSON.stringify(row));
  }
  fs.mkdirSync(path.dirname(UPLOAD_RECEIPT), { recursive: true });
  fs.writeFileSync(UPLOAD_RECEIPT, JSON.stringify(receipt, null, 1) + '\n');
  console.log(JSON.stringify({ bucket: BUCKET, objects: receipt.objects.length, bytes: receipt.objects.reduce((s, o) => s + o.bytes, 0), kept: receipt.objects.filter((o) => o.uploaded === 'kept').length, modelBase: model.base }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
