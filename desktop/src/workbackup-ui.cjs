'use strict';
// 엔진 화면 파일 내주기(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md 2.2 「화면 파일」 · 「내주는 규칙(F12)」, 2026-11-26).
// 깔린 엔진의 `<InstallLocation>\resources\ui\` 아래 파일 가운데 자원 목록 `resources\manifest.json`의 files에 `ui/<이름>`으로 적힌 것만,
// 크기와 SHA-256이 맞을 때만, 확장자별 MIME으로 내준다. 목록의 꼴은 엔진 scripts/stage-resources.cjs · src-tauri/src/bundle.rs와 같다:
//   {"version":1,"appVersion":"0.8.0",...,"files":{"<상대 이름>":{"size":<수>,"sha256":"<64자>"},...}}
// 설치 폴더에 30분 안의 `.installing` 표식이 있으면 내주지 않는다(엔진 platform.rs INSTALLING · INSTALLING_FOR).
// 호스트를 새로 띄울 때마다 목록을 다시 읽고(load), hello.version과 목록의 appVersion이 다르면 싣지 않는다.
// 시험: desktop/tests/workbackup-view.test.cjs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ORIGIN = 'workbackup-ui://app';
const MANIFEST_MAX = 16 * 1024 * 1024;
const FILE_MAX = 16 * 1024 * 1024;
const INSTALLING = '.installing';
const INSTALLING_FOR = 30 * 60000;
const HEX64 = /^[a-f0-9]{64}$/;
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
/* 이름 조각: 글자 · 숫자 · 점 · 밑줄 · 붙임표만. 점만 있는 조각(. ..)은 안 된다 */
const PART = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,128}$/;
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
});

const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/* `ui/a/b.js` 꼴의 이름에서 `a/b.js`. 역사선 · 빈 조각 · 점 조각이면 null */
function uiName(key) {
  if (typeof key !== 'string' || !key.startsWith('ui/') || key.includes('\\') || key.length > 512) return null;
  const rest = key.slice(3), parts = rest.split('/');
  return parts.length && parts.every(p => PART.test(p)) ? rest : null;
}
/* 내줄 꼴(MIME 표)이 있는 확장자인가 */
const served = name => Object.hasOwn(MIME, path.posix.extname(name).toLowerCase());

/* 주소의 길을 목록 이름으로. workbackup-ui://app/ 밖, 이상한 인코딩 · 넘기 · 역사선이면 null */
function requestName(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'workbackup-ui:' || u.host !== 'app' || u.username || u.password || u.port) return null;
  let p;
  try { p = decodeURIComponent(u.pathname); } catch { return null; }
  if (/[\\\u0000-\u001f%]/.test(p) || /%2f|%5c/i.test(u.pathname)) return null;
  if (p === '/' || p === '') return 'index.html';
  if (!p.startsWith('/')) return null;
  const parts = p.slice(1).split('/');
  return parts.every(x => PART.test(x)) ? parts.join('/') : null;
}

/* 설치 폴더의 표식이 30분 안에 생긴 것인가 */
async function installing(location, fsImpl, now) {
  try { const stat = await fsImpl.stat(path.win32.join(location, INSTALLING)); return now() - stat.mtimeMs < INSTALLING_FOR; }
  catch { return false; }
}

const insideOf = (child, root) => { const c = path.win32.resolve(child).toLowerCase(), r = path.win32.resolve(root).toLowerCase().replace(/\\+$/, ''); return c.startsWith(r + '\\'); };

function createWorkbackupUi({ fsImpl = fs.promises, now = Date.now, join = path.win32.join } = {}) {
  /* 지금 실은 목록 하나. load가 바꾼다. 세대가 다른(늦게 끝난 앞) 읽기는 목록을 바꾸지 않는다(GPT workbackup-solio-one-be-20261127 A7) */
  let loaded = null, generation = 0;

  /* 설치 폴더의 목록을 다시 읽는다. 'ok' · 'missing' · 'invalid' · 'version' · 'installing' · 'stale'(뒤에 온 load · unload가 앞섰다) */
  async function load(location, version) {
    const mine = ++generation;
    loaded = null;
    const set = await readSet(location, version);
    if (mine !== generation) return 'stale';
    if (typeof set === 'string') return set;
    loaded = set;
    return 'ok';
  }

  /* 목록 하나를 읽어 내줄 꼴로. 상태 낱말이나 { location, root, version, files } */
  async function readSet(location, version) {
    if (typeof location !== 'string' || !path.win32.isAbsolute(location) || typeof version !== 'string' || !VERSION.test(version)) return 'invalid';
    if (await installing(location, fsImpl, now)) return 'installing';
    const file = join(location, 'resources', 'manifest.json');
    let value;
    try {
      const stat = await fsImpl.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MANIFEST_MAX) return 'invalid';
      value = JSON.parse(String(await fsImpl.readFile(file, 'utf8')).replace(/^﻿/, ''));
    } catch (error) { return error?.code === 'ENOENT' ? 'missing' : 'invalid'; }
    if (!isPlain(value) || !isPlain(value.files)) return 'invalid';
    if (value.appVersion !== version) return 'version';
    const files = new Map();
    for (const [key, entry] of Object.entries(value.files)) {
      if (!key.startsWith('ui/')) continue;
      const name = uiName(key);
      if (!name || !isPlain(entry) || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > FILE_MAX || typeof entry.sha256 !== 'string' || !HEX64.test(entry.sha256)) return 'invalid';
      // 내줄 꼴(MIME 표)이 없는 확장자는 목록에 있어도 내주지 않는다
      if (served(name)) files.set(name, { size: entry.size, sha256: entry.sha256 });
    }
    if (!files.has('index.html')) return 'invalid';
    return { location, root: join(location, 'resources', 'ui'), version, files };
  }

  /* 주소 하나에 답한다. { status, mime, body }. 목록 밖 · 해시 다름 · 표식 · 넘기는 404 · 503이다 */
  async function respond(url) {
    const miss = status => ({ status, mime: 'text/plain; charset=utf-8', body: Buffer.alloc(0) });
    const set = loaded;
    if (!set) return miss(503);
    const name = requestName(url);
    if (!name || !set.files.has(name)) return miss(404);
    if (await installing(set.location, fsImpl, now)) return miss(503);
    const entry = set.files.get(name), file = join(set.root, ...name.split('/'));
    try {
      const stat = await fsImpl.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.size) return miss(404);
      // 실제 경로가 화면 폴더 안이어야 한다(연결점을 따라 다른 곳으로 나가지 않는다)
      const [real, realRoot] = await Promise.all([fsImpl.realpath(file), fsImpl.realpath(set.root)]);
      if (!insideOf(real, realRoot)) return miss(404);
      const body = await fsImpl.readFile(file);
      if (body.length !== entry.size || crypto.createHash('sha256').update(body).digest('hex') !== entry.sha256) return miss(404);
      return { status: 200, mime: MIME[path.posix.extname(name).toLowerCase()], body };
    } catch { return miss(404); }
  }

  /* Electron protocol.handle의 처리기. 머리글은 내용 꼴과 저장 금지뿐이다. 엔진 화면의 CSP는 index.html의 meta를 그대로 쓴다 */
  async function handle(request) {
    const answer = await respond(request?.url);
    return new Response(answer.status === 200 ? answer.body : null, { status: answer.status, headers: { 'content-type': answer.mime, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' } });
  }

  return { load, respond, handle, unload: () => { generation++; loaded = null; }, version: () => loaded?.version || null };
}

module.exports = { createWorkbackupUi, requestName, uiName, ORIGIN, INSTALLING, INSTALLING_FOR, MIME };
