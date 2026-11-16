#!/usr/bin/env node
'use strict';
/**
 * 작업실 영상 정리 — 회사 미디어 버킷에서 30일 안의 어느 백업도 가리키지 않는 영상 객체를 고른다
 * (2026-11-17, 작업실 영상 클라우드 A1c · 11-16 유호님 「클라우드로 옮기기」).
 * 설계는 저장소 밖 .tmp/company-media-cloud-20261116/설계.md 5.7 · 16 · 17 · 18절과 설계검토-a1c-Fable.md(잠금 L4 · 넘김 O2)에 있고,
 * 운영 기록은 docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md 「작업실 영상 클라우드」 절에 있다.
 *
 * 서버는 버킷에서 아무것도 지우지 않는다. 지우는 것은 이 도구 하나다. 근거는 백업 버킷의 완료 객체
 * (<스냅숏>.media-complete, deploy/backup-media.py가 백업마다 쓰고 버킷 수명 규칙으로 30일 뒤 사라진다)다.
 * v2 완료 객체는 그 백업이 가리킨 미디어 객체의 이름과 generation을 적는다.
 *
 * 지울 수 있는 객체는 아래를 모두 채운 것이다.
 *   - 이름이 studio-media/<uuid>.<확장자> 꼴이다(뒤에 ~숫자가 붙을 수 있다).
 *   - 만든 지 3일이 넘었다.
 *   - 백업 버킷 전체의 완료 객체 어디에도 그 이름과 generation이 없다.
 *   - 이 도구가 처음 후보로 본 지 3일이 지났다.
 * 아래 가운데 하나라도 걸리면 아무것도 지우지 않고 멈춘다(끝 코드 3).
 *   - 정기 백업 자리(기본 company/production/)의 가장 최근 완료 객체가 48시간보다 오래되었다(백업이 멈춘 것이다).
 *   - 완료 객체를 하나라도 읽지 못했거나 꼴이 틀렸다.
 *   - 지울 것이 객체의 20%를 넘는다.
 * 목록을 끝까지 읽지 못하면 실패로 끝난다(끝 코드 1).
 * 시각은 GCS 응답의 Date와 객체의 timeCreated로 잰다. PC 시계는 쓰지 않는다.
 * 백업 버킷에는 목록과 읽기만 한다. 미디어 버킷에는 목록, gc/runs/ 기록 한 장 새로 만들기, 그리고 지우기 실행일 때
 * ifGenerationMatch를 붙인 지우기만 한다. 다른 버킷과 다른 호출은 코드가 거절한다.
 * 기본은 미리 보기다. 지우려면 설정 파일의 "지우기": true와 --실행이 함께 있어야 한다. 데이터를 지우는 운영 변경이라
 * 첫 미리 보기 목록을 유호님께 보여 드리고 승인을 받은 뒤에 켠다.
 *
 * 20%에 걸려 멈춘 실행 R은 한 번 쓰는 승인으로만 넘긴다(Fable 설계 검토 O2).
 *   1. 유호님이 R의 목록을 보시고 승인하시면 `--승인 R`이 approvals/R.json(R의 목록을 옮겨 적은 것)을 만든다.
 *      R은 20% 하나로만 멈춘 실행이어야 한다. 이미 쓴 승인(approvals/used/)이나 무효가 된 승인(approvals/void/)의 R은 다시 승인하지 못한다.
 *   2. `--한번넘김 R --실행`은 모든 관문을 지난 뒤, 지우기 직전에 approvals/R.json을 approvals/used/R.json으로 옮긴다(rename).
 *      rename은 한 번만 성공하므로, 잠금이 뚫려도 승인은 한 번만 쓰인다. 옮긴 실행만 그 내용을 읽어 다시 검사하고,
 *      승인 목록과 지금 모든 규칙을 채운 것이 겹치는 것만 지운다. 승인이 넘기는 것은 20% 관문 하나다.
 *   3. 승인은 R이 멈춘 GCS 시각에서 3일이 지나면 무효다. 늦게 승인해도 만료는 늘지 않는다.
 *   4. 지울 것이 0개이거나 다른 이유로 멈춘 실행은 승인을 쓰지 않는다. 미리 보기(`--한번넘김 R`만)는 승인을 읽기만 한다.
 *   5. 어느 지우기 실행이든 지우기에 들어가기 전에 쓰지 않은 다른 승인을 모두 approvals/void/로 옮겨 무효로 한다.
 *      하나라도 못 옮기면 지우지 않고 멈춘다(APPROVAL_VOID_FAILED). 이 실행의 승인은 그 뒤에 쓴다.
 *   예전 판(O1)의 「R이 가장 최근에 멈춘 실행인가」는 보지 않는다. 승인이 따로 있고 3일 뒤 죽기 때문이다.
 *   지우기 실행은 runs/를 읽지 않는다. runs/를 읽는 것은 `--승인`의 R 한 장뿐이다.
 *
 * 설정과 상태는 공용 작업본의 .tmp/company-media-cloud-gc/에 둔다(프로젝트 번호와 후보 목록은 공개 저장소에 두지 않는다).
 *   config.json  {"projectNumber":"<번호>","tokenCommand":["<프로그램>","<인수>",…],"지우기":false}
 *                backupPrefix(기본 "company/production/")로 정기 백업 자리를 바꿀 수 있다.
 *   state.json   후보를 처음 본 시각(GCS 시각)과 버킷 이름. 마지막으로 적은 지 7일이 넘었으면 시계를 모두 다시 시작한다.
 *   runs/<실행 ID>.json  실행마다 남기는 기록(후보와 지운 것의 이름까지). 사람이 보는 장부다.
 *   approvals/   승인(위 1~5)
 * 한 번에 하나만 돈다. 잠금은 운영체제가 쥐는 이름 하나다(Windows 이름 있는 파이프, Linux 추상 소켓). 프로세스가 끝나거나 죽으면
 * 운영체제가 바로 놓으므로 「낡은 잠금」이 없다. 이름은 상태 폴더의 진짜 경로에서 만든다. `--승인`도 같은 잠금을 잡는다.
 * 미디어 버킷의 gc/runs/<실행 ID>.json에는 멈추지도 실패하지도 않은 실행만 숫자로 남긴다. 지우기를 켠 뒤에는 지우기 실행만 남기고,
 * 미리 보기는 남기지 않는다(손으로 돌린 미리 보기가 서버의 7일 경보 MEDIA_CLEANUP_STALE 시계를 되돌리지 않게).
 *
 * 쓰는 법
 *   node tools/작업실영상정리.js [--json]                      미리 보기
 *   node tools/작업실영상정리.js --실행                        지우기(설정의 "지우기": true일 때만)
 *   node tools/작업실영상정리.js --승인 <실행 ID>              20%에 걸려 멈춘 그 실행의 목록을 승인한다(유호님 승인 뒤)
 *   node tools/작업실영상정리.js --한번넘김 <실행 ID> [--실행] 그 승인으로 한 번만 넘긴다
 *   시험용: --설정 <파일> --상태 <폴더> --끝점 http://127.0.0.1:<포트> --토큰-stdin(--상태는 시험 끝점과 함께만 받는다)
 * 끝 코드: 0 정상 · 3 멈춤 · 1 실패 · 2 쓰는 법이 틀림
 */
const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');

const DAY = 86400000;
const HOUR = 3600000;
const RULES = Object.freeze({
  createdMs: 3 * DAY, seenMs: 3 * DAY, backupStaleMs: 48 * HOUR, maxShare: 0.2, approvalMs: 3 * DAY, stateFreshMs: 7 * DAY,
  maxComplete: 4 << 20, maxReferenced: 8000, maxPages: 1000, maxJson: 32 << 20, timeoutMs: 60000,
});
// 지울 수 있는 이름은 UUID 꼴(8-4-4-4-12)만이다(GPT GA3). 서버는 randomUUID로 이름을 짓는다.
const OBJECT = /^studio-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)(?:~[1-9][0-9]{0,3})?$/;
// 완료 객체의 가리킴은 서버와 backup-media.py가 받는 넓은 꼴로 읽는다. 이 꼴 밖의 가리킴이 있으면 그 완료 객체를 못 읽은 것으로 보고 멈춘다.
const REFERENCE = /^studio-media\/[0-9a-f-]{36}\.(?:mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)(?:~[1-9][0-9]{0,3})?$/;
const KEY = new RegExp('^' + OBJECT.source.slice(1, -1) + '#[0-9]{1,20}$');
const MEDIA_BUCKET = /^synk-company-media-[0-9]{6,20}$/;
const GENERATION = /^[0-9]{1,20}$/;
const PROJECT = /^[0-9]{6,20}$/;
const RUN_ID = /^[0-9TZ]+-[0-9a-f]{6}$/;
const COMPLETE = /\.media-complete$/;
const SCHEMA_V1 = 'synk-workspace-media-complete/v1';
const SCHEMA_V2 = 'synk-workspace-media-complete/v2';
const RUN_SCHEMA = 'synk-media-cloud-gc-run/v1';
const STATE_SCHEMA = 'synk-media-cloud-gc-state/v1';
const APPROVAL_SCHEMA = 'synk-media-cloud-gc-approval/v1';
const LIVE_ENDPOINT = 'https://storage.googleapis.com';
const REASONS = Object.freeze({
  COMPLETE_UNREADABLE: '완료 객체를 읽지 못했거나 꼴이 틀렸습니다',
  BACKUP_STALE: '정기 백업의 가장 최근 완료 객체가 48시간보다 오래되었습니다(백업이 멈춘 것 같습니다)',
  TOO_MANY: '지울 것이 객체의 20%를 넘습니다(목록을 보신 뒤 --승인 <실행 ID>로 승인하고 --한번넘김 <실행 ID>로 한 번만 넘깁니다)',
  OVERRIDE_INVALID: '--한번넘김에 준 실행의 승인이 없거나, 이미 썼거나, 무효가 되었거나, 그 실행이 멈춘 지 3일이 지났습니다',
  APPROVAL_VOID_FAILED: '쓰지 않은 다른 승인을 무효로 옮기지 못했습니다(그 파일을 잡고 있는 프로그램이 없는지 본 뒤 다시 돌립니다)',
});

class Failure extends Error {
  constructor(code, exit = 1) { super(code); this.code = code; this.exit = exit; }
}
const key = (name, generation) => name + '#' + generation;
const iso = ms => new Date(ms).toISOString();
const sha = text => crypto.createHash('sha256').update(text).digest('hex');

async function readLimited(res, limit) {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new Failure('STORAGE_RESPONSE_TOO_LARGE');
  const chunks = [];
  let size = 0;
  if (res.body) {
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > limit) throw new Failure('STORAGE_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

/** 두 버킷만 받는 GCS 호출. 백업 버킷은 GET만, 미디어 버킷은 목록 · gc/runs/ 새로 만들기 · studio-media/ 지우기만 한다. */
function storage({ token, endpoint, media, backup, fetchImpl = fetch, timeoutMs = RULES.timeoutMs }) {
  let date = NaN;
  const calls = [];
  async function call(method, bucket, url, { body, headers = {}, limit = RULES.maxJson } = {}) {
    if (bucket !== media && bucket !== backup) throw new Failure('BUCKET_REFUSED');
    if (bucket === backup && method !== 'GET') throw new Failure('BACKUP_BUCKET_READ_ONLY');
    calls.push([method, bucket]);
    let res;
    try {
      res = await fetchImpl(endpoint + url, { method, headers: { authorization: 'Bearer ' + token, ...headers }, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch { throw new Failure('STORAGE_REQUEST_FAILED'); }
    const at = Date.parse(res.headers.get('date') || '');
    if (Number.isFinite(at)) date = at;
    let data;
    try { data = await readLimited(res, limit); } catch (error) { throw error instanceof Failure ? error : new Failure('STORAGE_REQUEST_FAILED'); }
    return { status: res.status, data };
  }
  const objectPath = (bucket, name) => '/storage/v1/b/' + encodeURIComponent(bucket) + '/o/' + encodeURIComponent(name);
  return {
    calls,
    now: () => date,
    /** 쪽 토큰이 끝날 때까지 읽는다. 한 쪽이라도 실패하면 실패다. */
    async list(bucket, prefix, glob) {
      const items = [];
      let page = '';
      for (let i = 0; i < RULES.maxPages; i++) {
        const query = new URLSearchParams({ prefix, maxResults: '1000', fields: 'items(name,generation,size,timeCreated),nextPageToken' });
        if (glob) query.set('matchGlob', glob);
        if (page) query.set('pageToken', page);
        const { status, data } = await call('GET', bucket, '/storage/v1/b/' + encodeURIComponent(bucket) + '/o?' + query);
        if (status !== 200) throw new Failure('STORAGE_LIST_FAILED');
        let body;
        try { body = JSON.parse(data.toString('utf8')); } catch { throw new Failure('STORAGE_LIST_FAILED'); }
        if (!body || typeof body !== 'object' || (body.items !== undefined && !Array.isArray(body.items))) throw new Failure('STORAGE_LIST_FAILED');
        for (const item of body.items || []) if (item && typeof item.name === 'string' && item.name.startsWith(prefix)) items.push(item);
        page = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
        if (!page) return items;
      }
      throw new Failure('STORAGE_LIST_TOO_LONG');
    },
    async read(bucket, name, generation, limit) {
      return call('GET', bucket, objectPath(bucket, name) + '?alt=media&generation=' + generation, { limit });
    },
    async record(name, body) {
      if (!/^gc\/runs\/[0-9TZ]+-[0-9a-f]{6}\.json$/.test(name)) throw new Failure('RECORD_NAME_REFUSED');
      const query = new URLSearchParams({ uploadType: 'media', name, ifGenerationMatch: '0' });
      const { status } = await call('POST', media, '/upload/storage/v1/b/' + encodeURIComponent(media) + '/o?' + query,
        { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
      if (status !== 200) throw new Failure('RECORD_FAILED');
    },
    async remove(name, generation) {
      if (!OBJECT.test(name) || !GENERATION.test(generation)) throw new Failure('DELETE_NAME_REFUSED');
      const { status } = await call('DELETE', media, objectPath(media, name) + '?ifGenerationMatch=' + generation);
      if (status === 204 || status === 200) return 'deleted';
      if (status === 404 || status === 412) return 'changed';  // 이미 없거나 다른 generation이다 — 그대로 둔다
      return 'failed';
    },
  };
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw new Failure('STATE_UNREADABLE'); }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, file);
}

/** 잠금 이름: 상태 폴더의 진짜 경로(연결을 풀고, Windows에서는 소문자로)를 해시한다. 같은 폴더를 다른 철자로 불러도 같은 잠금이다. */
function lockName(stateDir) {
  let real;
  try { fs.mkdirSync(stateDir, { recursive: true }); real = fs.realpathSync.native(stateDir); } catch { throw new Failure('LOCK_FAILED'); }
  if (process.platform === 'win32') real = real.toLowerCase();
  const id = sha(real).slice(0, 32);
  if (process.platform === 'win32') return '\\\\.\\pipe\\synk-media-gc-' + id;
  if (process.platform === 'linux') return '\0synk-media-gc-' + id;
  throw new Failure('LOCK_UNSUPPORTED', 2);
}

/** 한 번에 하나만 돈다(Fable 설계 검토 L4). 운영체제가 이름 하나를 한 프로세스에게만 주고, 프로세스가 끝나거나 죽으면 바로 놓는다.
 *  listening을 받았을 때만 진행한다. EADDRINUSE는 BUSY, 그 밖의 모든 오류는 LOCK_FAILED다. 풀 때는 닫힘을 기다린다. */
async function takeLock(stateDir) {
  const name = lockName(stateDir);
  const server = net.createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => {
    const onError = error => { server.removeListener('listening', onListening); reject(new Failure(error && error.code === 'EADDRINUSE' ? 'BUSY' : 'LOCK_FAILED', error && error.code === 'EADDRINUSE' ? 3 : 1)); };
    const onListening = () => { server.removeListener('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(name);
  });
  let closing = null;
  return () => closing || (closing = new Promise(resolve => server.close(() => resolve())));
}

function validReference(ref) {
  return !!ref && typeof ref === 'object' && typeof ref.bucket === 'string' && MEDIA_BUCKET.test(ref.bucket)
    && typeof ref.object === 'string' && REFERENCE.test(ref.object) && typeof ref.generation === 'string' && GENERATION.test(ref.generation);
}

const approvalPaths = (stateDir, runId) => {
  const dir = path.join(stateDir, 'approvals');
  return { dir, file: path.join(dir, runId + '.json'), used: path.join(dir, 'used', runId + '.json'), voided: path.join(dir, 'void', runId + '.json') };
};
function validApproval(body, runId, media) {
  return !!body && typeof body === 'object' && body.schema === APPROVAL_SCHEMA && body.runId === runId && body.bucket === media
    && typeof body.stoppedAt === 'string' && Number.isFinite(Date.parse(body.stoppedAt))
    && Array.isArray(body.eligible) && body.eligible.length > 0 && body.eligible.every(item => typeof item === 'string' && KEY.test(item))
    && body.eligibleSha256 === sha(JSON.stringify(body.eligible));
}
/** 승인은 R이 멈춘 GCS 시각에서 3일까지 쓴다(Fable 설계 검토 O2 · 만료 기준). */
const notExpired = (body, now) => { const at = Date.parse(body.stoppedAt); return at <= now && now - at <= RULES.approvalMs; };
/** 승인 쓰기: rename이 먼저고 읽기가 나중이다. rename이 성공한 실행만 내용을 읽는다. 어떤 이유든 rename이 실패하면 null이다. */
function consumeApproval(stateDir, runId, rename = fs.renameSync) {
  const p = approvalPaths(stateDir, runId);
  try { fs.mkdirSync(path.dirname(p.used), { recursive: true }); rename(p.file, p.used); } catch { return null; }
  try { return JSON.parse(fs.readFileSync(p.used, 'utf8')); } catch { return {}; }  // 옮겼지만 못 읽으면 쓴 것으로 남기고 무효로 본다
}
/** 지우기에 들어가는 실행은 쓰지 않은 다른 승인(except 말고)을 모두 무효로 옮긴다(Fable 설계 검토 O2 8번).
 *  하나라도 못 옮기면 false다. 그때는 지우지 않는다(GPT 넷째 검수 — 남은 승인이 나중에 다시 쓰이지 않게). */
function voidApprovals(stateDir, except, rename = fs.renameSync) {
  const dir = path.join(stateDir, 'approvals');
  let names;
  try { names = fs.readdirSync(dir).filter(name => /^[0-9TZ]+-[0-9a-f]{6}\.json$/.test(name) && name !== except + '.json'); }
  catch (error) { return error.code === 'ENOENT'; }
  if (!names.length) return true;
  try { fs.mkdirSync(path.join(dir, 'void'), { recursive: true }); } catch { return false; }
  for (const name of names) {
    try { rename(path.join(dir, name), path.join(dir, 'void', name)); } catch (error) { if (error.code !== 'ENOENT') return false; }  // 이미 없으면 된 것이다
  }
  return true;
}

function bucketsOf(config) {
  if (!config || typeof config !== 'object' || typeof config.projectNumber !== 'string' || !PROJECT.test(config.projectNumber)) throw new Failure('CONFIG_INVALID', 2);
  return { media: 'synk-company-media-' + config.projectNumber, backup: 'synk-company-backups-' + config.projectNumber };
}

/** `--승인 R`: R이 20% 하나로만 멈춘 실행이면 그 목록을 approvals/R.json으로 옮겨 적는다. 네트워크를 쓰지 않는다. */
async function approve({ config, stateDir, runId }) {
  const { media } = bucketsOf(config);
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) throw new Failure('APPROVAL_SOURCE_INVALID', 2);
  const release = await takeLock(stateDir);
  try {
    const p = approvalPaths(stateDir, runId);
    if (fs.existsSync(p.used)) throw new Failure('APPROVAL_ALREADY_USED', 2);
    if (fs.existsSync(p.voided)) throw new Failure('APPROVAL_VOID', 2);
    let stopped = null;
    try { stopped = JSON.parse(fs.readFileSync(path.join(stateDir, 'runs', runId + '.json'), 'utf8')); } catch {}
    const ok = !!stopped && stopped.schema === RUN_SCHEMA && stopped.runId === runId && stopped.bucket === media && stopped.status === 'stopped'
      && Array.isArray(stopped.reasons) && stopped.reasons.length === 1 && stopped.reasons[0] === 'TOO_MANY'
      && typeof stopped.startedAt === 'string' && Number.isFinite(Date.parse(stopped.startedAt))
      && Array.isArray(stopped.eligible) && stopped.eligible.length > 0 && stopped.eligible.every(item => typeof item === 'string' && KEY.test(item));
    if (!ok) throw new Failure('APPROVAL_SOURCE_INVALID', 2);
    const expiresAt = iso(Date.parse(stopped.startedAt) + RULES.approvalMs);
    if (fs.existsSync(p.file)) return { status: 'already-approved', runId, eligible: stopped.eligible.length, expiresAt };
    const body = { schema: APPROVAL_SCHEMA, runId, bucket: media, stoppedAt: stopped.startedAt, eligible: stopped.eligible,
      eligibleSha256: sha(JSON.stringify(stopped.eligible)), approvedAt: new Date().toISOString() };  // approvedAt은 기록용(PC 시각)이고 판단에 쓰지 않는다
    // 반쯤 쓰인 승인이 보이지 않게 다 쓴 임시 파일을 하드 링크로 놓는다(이미 있으면 실패).
    fs.mkdirSync(p.dir, { recursive: true });
    const temporary = path.join(p.dir, '.' + runId + '-' + process.pid + '.new');
    fs.writeFileSync(temporary, JSON.stringify(body, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    try { fs.linkSync(temporary, p.file); } catch (error) {
      if (error.code === 'EEXIST') return { status: 'already-approved', runId, eligible: stopped.eligible.length, expiresAt };
      throw new Failure('APPROVAL_WRITE_FAILED');
    } finally { try { fs.unlinkSync(temporary); } catch {} }
    return { status: 'approved', runId, eligible: stopped.eligible.length, expiresAt };
  } finally { await release(); }
}

async function run({ config, stateDir, endpoint = LIVE_ENDPOINT, token, execute = false, override = null, fetchImpl = fetch, _rename = fs.renameSync }) {
  const { media, backup } = bucketsOf(config);
  const backupPrefix = config.backupPrefix === undefined ? 'company/production/' : config.backupPrefix;
  if (typeof backupPrefix !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9-]+)*\/$/.test(backupPrefix)) throw new Failure('CONFIG_INVALID', 2);
  if (execute && config['지우기'] !== true) throw new Failure('DELETE_NOT_ENABLED', 2);
  if (override !== null && !RUN_ID.test(override)) throw new Failure('OVERRIDE_INVALID', 2);
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~+/=-]{10,4096}$/.test(token)) throw new Failure('TOKEN_INVALID', 2);
  const release = await takeLock(stateDir);
  try {
    const gcs = storage({ token, endpoint, media, backup, fetchImpl });
    const objects = await gcs.list(media, 'studio-media/');
    const startedAt = gcs.now();
    if (!Number.isFinite(startedAt)) throw new Failure('STORAGE_DATE_MISSING');
    const runId = iso(startedAt).replace(/[-:]/g, '').replace(/\.[0-9]+Z$/, 'Z') + '-' + crypto.randomBytes(3).toString('hex');

    const referenced = new Set(), seen = new Set(), unreadable = [];
    let completes = 0, latest = null;
    async function readCompletes() {
      const items = (await gcs.list(backup, '', '**.media-complete')).filter(item => COMPLETE.test(item.name));
      for (const item of items) {
        const generation = String(item.generation || '');
        if (seen.has(key(item.name, generation))) continue;
        seen.add(key(item.name, generation));
        completes++;
        const created = Date.parse(item.timeCreated || '');
        let body = null;
        if (GENERATION.test(generation) && Number.isFinite(created)) {
          try {
            const { status, data } = await gcs.read(backup, item.name, generation, RULES.maxComplete);
            if (status === 200) body = JSON.parse(data.toString('utf8'));
          } catch (error) { if (error instanceof Failure && error.code !== 'STORAGE_RESPONSE_TOO_LARGE') throw error; }
        }
        const refs = body && body.schema === SCHEMA_V2 ? body.referenced : undefined;
        const good = !!body && typeof body === 'object' && ((body.schema === SCHEMA_V1 && body.referenced === undefined)
          || (body.schema === SCHEMA_V2 && Array.isArray(refs) && refs.length > 0 && refs.length <= RULES.maxReferenced && refs.every(validReference)));
        if (!good) { unreadable.push(item.name); continue; }
        for (const ref of refs || []) if (ref.bucket === media) referenced.add(key(ref.object, ref.generation));
        if (item.name.startsWith(backupPrefix) && (!latest || created > latest.created)) latest = { name: item.name, created, schema: body.schema };
      }
    }
    await readCompletes();

    const reasons = [];
    if (unreadable.length) reasons.push('COMPLETE_UNREADABLE');
    if (!latest || startedAt - latest.created > RULES.backupStaleMs) reasons.push('BACKUP_STALE');

    const valid = [], strange = [];
    for (const item of objects) {
      const generation = String(item.generation || '');
      if (OBJECT.test(item.name) && GENERATION.test(generation) && Number.isFinite(Date.parse(item.timeCreated || ''))) valid.push({ name: item.name, generation, created: Date.parse(item.timeCreated), size: Number(item.size) || 0 });
      else strange.push(item.name);
    }
    const candidates = valid.filter(item => startedAt - item.created > RULES.createdMs && !referenced.has(key(item.name, item.generation)));

    // 처음 본 시각은 멈추지 않은 회차에서만 적는다. 멈춘 회차의 후보는 근거가 모자라 시계를 시작하지 않는다.
    // 값은 「있던 값 아니면 지금」뿐이라 어떤 경우에도 앞당겨지지 않는다. 마지막으로 적은 지 7일이 넘었으면 모두 다시 시작한다(Fable P3 7).
    const stateFile = path.join(stateDir, 'state.json');
    const state = readJson(stateFile, { schema: STATE_SCHEMA, firstSeen: {} });
    if (!state || state.schema !== STATE_SCHEMA || !state.firstSeen || typeof state.firstSeen !== 'object') throw new Failure('STATE_UNREADABLE');
    if (state.bucket !== undefined && state.bucket !== media) throw new Failure('STATE_BUCKET_MISMATCH', 2);
    let eligible = [];
    if (!reasons.length) {
      const updated = Date.parse(state.updatedAt || '');
      const prior = Number.isFinite(updated) && updated <= startedAt && startedAt - updated <= RULES.stateFreshMs ? state.firstSeen : {};
      const firstSeen = {};
      for (const item of candidates) {
        const k = key(item.name, item.generation), was = Date.parse(prior[k] || '');
        firstSeen[k] = Number.isFinite(was) && was <= startedAt ? prior[k] : iso(startedAt);
      }
      writeJson(stateFile, { schema: STATE_SCHEMA, bucket: media, updatedAt: iso(startedAt), firstSeen });
      eligible = candidates.filter(item => startedAt - Date.parse(firstSeen[key(item.name, item.generation)]) >= RULES.seenMs);
    }

    // 한 번 넘김(O2): 승인이 있고 3일이 지나지 않았을 때만, 승인 목록에 있는 것만 지울 것으로 남긴다. 승인이 넘기는 것은 20% 관문 하나다.
    // approvalResult: kept(쓰지 않고 남음) · used(옮겨 쓰고 지우기로 감) · used-invalid(옮겼지만 내용이 맞지 않아 멈춤) · not-moved(옮기지 못해 멈춤)
    let overrode = null, notApproved = [], approval = null, approvalResult = null;
    if (!reasons.length && override) {
      try { approval = JSON.parse(fs.readFileSync(approvalPaths(stateDir, override).file, 'utf8')); } catch { approval = null; }
      if (!validApproval(approval, override, media) || !notExpired(approval, startedAt)) reasons.push('OVERRIDE_INVALID');
      else {
        const listed = new Set(approval.eligible);
        overrode = override;
        approvalResult = 'kept';
        notApproved = eligible.filter(item => !listed.has(key(item.name, item.generation)));
        eligible = eligible.filter(item => listed.has(key(item.name, item.generation)));
      }
    } else if (!reasons.length && eligible.length > RULES.maxShare * valid.length) reasons.push('TOO_MANY');

    const deleted = [], changed = [], failed = [];
    let kept = [];
    const runFile = path.join(stateDir, 'runs', runId + '.json');
    const reportOf = status => ({
      schema: RUN_SCHEMA, runId, bucket: media, mode: execute ? 'delete' : 'preview', status, reasons: [...reasons], startedAt: iso(startedAt),
      overrode, approvalSha256: overrode ? approval.eligibleSha256 : null, approvalResult, approvalUsed: approvalResult === 'used' || approvalResult === 'used-invalid',
      objects: valid.length, strange, completes, latestComplete: latest ? { name: latest.name, at: iso(latest.created), schema: latest.schema } : null,
      latestIsV1: !!latest && latest.schema === SCHEMA_V1, referenced: referenced.size, unreadable: [...unreadable],
      candidates: candidates.map(item => key(item.name, item.generation)), eligible: eligible.map(item => key(item.name, item.generation)),
      eligibleBytes: eligible.reduce((sum, item) => sum + item.size, 0), keptByNewBackup: kept.map(item => key(item.name, item.generation)),
      notApproved: notApproved.map(item => key(item.name, item.generation)),
      deleted: [...deleted], changed: [...changed], failed: [...failed],
    });
    if (execute && !reasons.length && eligible.length) {
      // 지우기 직전에 이 실행이 시작된 뒤 생긴 완료 객체를 한 번 더 읽고, 새로 가리킨 객체는 지우지 않는다.
      await readCompletes();
      if (unreadable.length) reasons.push('COMPLETE_UNREADABLE');
      else {
        kept = eligible.filter(item => referenced.has(key(item.name, item.generation)));
        let toDelete = eligible.filter(item => !referenced.has(key(item.name, item.generation)));
        // 지우기에 들어가기 전에 쓰지 않은 다른 승인을 모두 무효로 옮긴다. 다 옮기지 못하면 승인도 쓰지 않고 멈춘다.
        // 그다음 이 실행의 승인은 모든 관문을 지난 뒤, 지울 것이 있을 때만, 「지우는 중」 기록 바로 앞에서 쓴다.
        if (toDelete.length && !voidApprovals(stateDir, overrode, _rename)) reasons.push('APPROVAL_VOID_FAILED');
        else if (toDelete.length && overrode) {
          const used = consumeApproval(stateDir, overrode, _rename);
          if (!used || !validApproval(used, overrode, media) || !notExpired(used, startedAt) || used.eligibleSha256 !== approval.eligibleSha256) {
            approvalResult = used ? 'used-invalid' : 'not-moved';
            reasons.push('OVERRIDE_INVALID');
          } else {
            approvalResult = 'used';
            const listed = new Set(used.eligible);
            toDelete = toDelete.filter(item => listed.has(key(item.name, item.generation)));
          }
        }
        if (!reasons.length && toDelete.length) {
          // 지우기 전에 이 실행을 「지우는 중」으로 남기고, 지울 때마다 고쳐 쓴다. 도중에 끊겨도 지운 것이 남는다(GPT GA1).
          writeJson(runFile, reportOf('deleting'));
          try {
            for (const item of toDelete) {
              const result = await gcs.remove(item.name, item.generation);
              (result === 'deleted' ? deleted : result === 'changed' ? changed : failed).push(key(item.name, item.generation));
              writeJson(runFile, reportOf('deleting'));
            }
          } catch (error) {
            const report = reportOf('failed');
            writeJson(runFile, report);
            throw Object.assign(error, { report });
          }
        }
      }
    }

    const status = reasons.length ? 'stopped' : failed.length ? 'failed' : execute ? 'cleaned' : 'previewed';
    const report = reportOf(status);
    writeJson(runFile, report);
    // gc/runs/에는 멈추지도 실패하지도 않은 실행만 남긴다. 지우기를 켠 뒤에는 미리 보기를 남기지 않는다(Fable P2 3). 서버의 7일 경보가 그 기록을 본다.
    if (status === 'cleaned' || (status === 'previewed' && config['지우기'] !== true)) {
      try {
        await gcs.record('gc/runs/' + runId + '.json', { schema: RUN_SCHEMA, runId, mode: report.mode, status, startedAt: report.startedAt,
          objects: valid.length, candidates: candidates.length, eligible: eligible.length, deleted: deleted.length });
      } catch (error) { throw Object.assign(error, { report }); }  // 기록 올리기가 실패해도 무엇을 지웠는지는 보인다(Fable P2 5)
    }
    if (failed.length) throw Object.assign(new Failure('DELETE_FAILED'), { report });
    return report;
  } finally { await release(); }
}

function describe(report) {
  const lines = [];
  lines.push('작업실 영상 정리 — ' + (report.mode === 'delete' ? '지우기 실행' : '미리 보기(지우지 않았습니다)') + ' · 실행 ID ' + report.runId + ' · GCS 시각 ' + report.startedAt);
  lines.push('  미디어 버킷의 영상 객체는 ' + report.objects + '개입니다.' + (report.strange.length ? ' 이름이 규칙 밖인 객체 ' + report.strange.length + '개는 건드리지 않았습니다.' : ''));
  lines.push('  완료 객체 ' + report.completes + '개를 읽었고, 가리킨 객체는 ' + report.referenced + '개입니다.'
    + (report.latestComplete ? ' 정기 백업의 가장 최근 완료 객체는 ' + report.latestComplete.at + '에 생겼습니다.' : ' 정기 백업의 완료 객체가 없습니다.'));
  if (report.latestIsV1) lines.push('  가장 최근 완료 객체가 v1입니다. 그 백업은 미디어 버킷의 영상을 가리키지 않았습니다(가리킨 영상이 없으면 정상입니다).');
  lines.push('  후보는 ' + report.candidates.length + '개이고, 처음 본 지 3일이 지나 지울 것은 ' + report.eligible.length + '개(' + Math.round(report.eligibleBytes / 1048576) + 'MiB)입니다.');
  if (report.mode === 'delete') lines.push('  지운 것 ' + report.deleted.length + '개 · 그사이 바뀌어 둔 것 ' + report.changed.length + '개 · 새 백업이 가리켜 둔 것 ' + report.keptByNewBackup.length + '개 · 실패 ' + report.failed.length + '개입니다.');
  if (report.overrode) {
    // 승인이 실제로 어떻게 되었는지 그대로 말한다(카본 넷째 검수). 멈춘 실행에 「넘겼습니다」나 「남아 있습니다」를 잘못 붙이지 않는다.
    const R = '실행 ' + report.overrode + '의 승인';
    const said = {
      'used': R + '으로 20% 멈춤을 한 번 넘겼습니다. 그 승인은 썼습니다.',
      'used-invalid': R + '을 옮겼지만 내용이 맞지 않아 지우지 않고 멈췄습니다. 그 승인은 쓴 것으로 남아 다시 승인할 수 없습니다.',
      'not-moved': R + '을 옮기지 못해 지우지 않고 멈췄습니다. 다른 실행이 먼저 썼거나 그 파일을 잡고 있는 프로그램이 있습니다.',
    }[report.approvalResult] || (report.status === 'stopped' ? R + '으로 넘기려 했지만 다른 이유로 멈췄습니다. 승인은 쓰지 않고 남아 있습니다.'
      : report.mode === 'preview' ? R + '으로 넘겨 보았습니다. 승인은 쓰지 않고 남아 있습니다.'
      : R + ' 목록에 지금 지울 것이 없어 승인은 쓰지 않고 남겨 두었습니다.');
    const outside = report.notApproved && report.notApproved.length && report.status !== 'stopped' ? ' 그 목록에 없던 ' + report.notApproved.length + '개는 이번에 지우지 않았습니다.' : '';
    lines.push('  ' + said + outside);
  }
  for (const reason of report.reasons) lines.push('  멈춤: ' + (REASONS[reason] || reason) + '.');
  return lines.join('\n');
}

function args(argv) {
  const out = { json: false, execute: false, override: null, approve: null, config: null, state: null, endpoint: LIVE_ENDPOINT, tokenStdin: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => { if (i + 1 >= argv.length) throw new Failure('USAGE', 2); return argv[++i]; };
    if (a === '--json') out.json = true;
    else if (a === '--실행') out.execute = true;
    else if (a === '--한번넘김') out.override = value();
    else if (a === '--승인') out.approve = value();
    else if (a === '--설정') out.config = value();
    else if (a === '--상태') out.state = value();
    else if (a === '--끝점') out.endpoint = value();
    else if (a === '--토큰-stdin') out.tokenStdin = true;
    else throw new Failure('USAGE', 2);
  }
  // 실제 GCS 말고는 이 PC 안의 시험 서버만 받는다. 상태 폴더는 시험 서버와 함께만 바꿀 수 있다(Fable P3 6).
  if (out.endpoint !== LIVE_ENDPOINT && !/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(out.endpoint)) throw new Failure('USAGE', 2);
  if (out.state !== null && out.endpoint === LIVE_ENDPOINT) throw new Failure('USAGE', 2);
  if (out.approve !== null && (out.execute || out.override !== null)) throw new Failure('USAGE', 2);
  return out;
}

function tokenFrom(config, stdin) {
  if (stdin) return fs.readFileSync(0, 'utf8').split(/\r?\n/)[0].trim();
  const command = config && config.tokenCommand;
  if (!Array.isArray(command) || !command.length || !command.every(part => typeof part === 'string' && part)) throw new Failure('TOKEN_COMMAND_MISSING', 2);
  try {
    return execFileSync(command[0], command.slice(1), { encoding: 'utf8', timeout: RULES.timeoutMs, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
  } catch { throw new Failure('TOKEN_COMMAND_FAILED'); }
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try { options = args(argv); } catch {
    process.stderr.write('쓰는 법: node tools/작업실영상정리.js [--json] [--실행] [--승인 <실행 ID>] [--한번넘김 <실행 ID>] [--설정 <파일>]\n');
    return 2;
  }
  const home = path.join(공용작업본(path.resolve(__dirname, '..')), '.tmp', 'company-media-cloud-gc');
  const stateDir = path.resolve(options.state || home);
  const configFile = path.resolve(options.config || path.join(home, 'config.json'));
  try {
    const config = readJson(configFile, null);
    if (!config) throw new Failure('CONFIG_MISSING', 2);
    if (options.approve !== null) {
      const result = await approve({ config, stateDir, runId: options.approve });
      process.stdout.write(options.json ? JSON.stringify(result) + '\n'
        : (result.status === 'approved' ? '승인했습니다' : '이미 승인되어 있습니다') + ': 실행 ' + result.runId + '의 목록 ' + result.eligible + '개. 이 승인은 '
          + result.expiresAt + '(그 실행이 멈춘 GCS 시각에서 3일)까지 --한번넘김 ' + result.runId + ' --실행으로 한 번만 쓸 수 있습니다.\n');
      return 0;
    }
    const token = tokenFrom(config, options.tokenStdin);
    const report = await run({ config, stateDir, endpoint: options.endpoint, token, execute: options.execute, override: options.override });
    process.stdout.write(options.json ? JSON.stringify(report) + '\n' : describe(report) + '\n');
    return report.status === 'stopped' ? 3 : 0;
  } catch (error) {
    const code = error instanceof Failure ? error.code : 'UNEXPECTED';
    if (error.report) process.stdout.write(options.json ? JSON.stringify(error.report) + '\n' : describe(error.report) + '\n');
    process.stderr.write('SYNK_MEDIA_GC ' + code + '\n');
    return error instanceof Failure ? error.exit : 1;
  }
}

module.exports = { run, approve, describe, RULES, OBJECT, _storage: storage, _takeLock: takeLock, _consumeApproval: consumeApproval };
if (require.main === module) main().then(code => { process.exitCode = code; });
