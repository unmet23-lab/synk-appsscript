#!/usr/bin/env node
'use strict';
/**
 * 작업실 영상 정리 — 회사 미디어 버킷에서 30일 안의 어느 백업도 가리키지 않는 영상 객체를 고른다
 * (2026-11-17, 작업실 영상 클라우드 A1c · 11-16 유호님 「클라우드로 옮기기」).
 * 설계는 저장소 밖 .tmp/company-media-cloud-20261116/설계.md 5.7 · 16 · 17절에 있고, 운영 기록은
 * docs/마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md 「작업실 영상 클라우드」 절에 있다.
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
 *   - 지울 것이 객체의 20%를 넘는다. 유호님이 그 실행의 목록을 보신 뒤 --한번넘김 <실행 ID>로 한 번만 넘긴다.
 * 목록을 끝까지 읽지 못하면 실패로 끝난다(끝 코드 1).
 * 시각은 GCS 응답의 Date와 객체의 timeCreated로 잰다. PC 시계는 쓰지 않는다.
 * 백업 버킷에는 목록과 읽기만 한다. 미디어 버킷에는 목록, gc/runs/ 기록 한 장 새로 만들기, 그리고 지우기 실행일 때
 * ifGenerationMatch를 붙인 지우기만 한다. 다른 버킷과 다른 호출은 코드가 거절한다.
 * 기본은 미리 보기다. 지우려면 설정 파일의 "지우기": true와 --실행이 함께 있어야 한다. 데이터를 지우는 운영 변경이라
 * 첫 미리 보기 목록을 유호님께 보여 드리고 승인을 받은 뒤에 켠다.
 *
 * 설정과 상태는 공용 작업본의 .tmp/company-media-cloud-gc/에 둔다(프로젝트 번호와 후보 목록은 공개 저장소에 두지 않는다).
 *   config.json  {"projectNumber":"<번호>","tokenCommand":["<프로그램>","<인수>",…],"지우기":false}
 *                backupPrefix(기본 "company/production/")로 정기 백업 자리를 바꿀 수 있다.
 *   state.json   후보를 처음 본 시각(GCS 시각)
 *   runs/<실행 ID>.json  실행마다 남기는 기록(후보와 지운 것의 이름까지)
 *   lock         한 번에 하나만 돈다
 * 미디어 버킷의 gc/runs/<실행 ID>.json에는 멈추지 않고 끝난 실행만 숫자로 남긴다. 서버의 하루 대조가 이 기록이
 * 7일 넘게 없으면 경보(MEDIA_CLEANUP_STALE)를 올리므로, 계속 멈추는 것도 7일 안에 드러난다.
 *
 * 쓰는 법
 *   node tools/작업실영상정리.js [--json]                      미리 보기
 *   node tools/작업실영상정리.js --실행                        지우기(설정의 "지우기": true일 때만)
 *   node tools/작업실영상정리.js --한번넘김 <실행 ID> [--실행]  20%에 걸려 멈춘 그 실행의 후보를 한 번만 넘긴다
 *   시험용: --설정 <파일> --상태 <폴더> --끝점 http://127.0.0.1:<포트> --토큰-stdin
 * 끝 코드: 0 정상 · 3 멈춤 · 1 실패 · 2 쓰는 법이 틀림
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');

const DAY = 86400000;
const HOUR = 3600000;
const RULES = Object.freeze({
  createdMs: 3 * DAY, seenMs: 3 * DAY, backupStaleMs: 48 * HOUR, maxShare: 0.2,
  maxComplete: 4 << 20, maxReferenced: 8000, maxPages: 1000, maxJson: 32 << 20, timeoutMs: 60000, lockStaleMs: 2 * HOUR,
});
const OBJECT = /^studio-media\/[0-9a-f-]{36}\.(?:mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)(?:~[1-9][0-9]{0,3})?$/;
const MEDIA_BUCKET = /^synk-company-media-[0-9]{6,20}$/;
const GENERATION = /^[0-9]{1,20}$/;
const PROJECT = /^[0-9]{6,20}$/;
const COMPLETE = /\.media-complete$/;
const SCHEMA_V1 = 'synk-workspace-media-complete/v1';
const SCHEMA_V2 = 'synk-workspace-media-complete/v2';
const RUN_SCHEMA = 'synk-media-cloud-gc-run/v1';
const STATE_SCHEMA = 'synk-media-cloud-gc-state/v1';
const LIVE_ENDPOINT = 'https://storage.googleapis.com';
const REASONS = Object.freeze({
  COMPLETE_UNREADABLE: '완료 객체를 읽지 못했거나 꼴이 틀렸습니다',
  BACKUP_STALE: '정기 백업의 가장 최근 완료 객체가 48시간보다 오래되었습니다(백업이 멈춘 것 같습니다)',
  TOO_MANY: '지울 것이 객체의 20%를 넘습니다(목록을 보신 뒤 --한번넘김 <실행 ID>로 한 번만 넘깁니다)',
  OVERRIDE_INVALID: '--한번넘김에 준 실행이 20%에 걸려 멈춘 가장 최근 실행이 아니거나, 이미 넘겼거나, 그때 목록에 없던 것이 생겼습니다',
});

class Failure extends Error {
  constructor(code, exit = 1) { super(code); this.code = code; this.exit = exit; }
}
const key = (name, generation) => name + '#' + generation;
const iso = ms => new Date(ms).toISOString();

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

function takeLock(stateDir) {
  fs.mkdirSync(stateDir, { recursive: true });
  const file = path.join(stateDir, 'lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx', 0o600);
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      fs.closeSync(fd);
      return () => { try { fs.unlinkSync(file); } catch {} };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // 멈춘 실행이 남긴 잠금만 치운다(이 PC의 파일 시각으로 2시간). 잠금은 겹쳐 도는 것만 막고 지우기 판단에는 쓰지 않는다.
      let stale = false;
      try { stale = Date.now() - fs.statSync(file).mtimeMs > RULES.lockStaleMs; } catch {}
      if (!stale) throw new Failure('BUSY', 3);
      try { fs.unlinkSync(file); } catch {}
    }
  }
  throw new Failure('BUSY', 3);
}

function validReference(ref) {
  return !!ref && typeof ref === 'object' && typeof ref.bucket === 'string' && MEDIA_BUCKET.test(ref.bucket)
    && typeof ref.object === 'string' && OBJECT.test(ref.object) && typeof ref.generation === 'string' && GENERATION.test(ref.generation);
}

function runsOf(stateDir) {
  const dir = path.join(stateDir, 'runs');
  let names = [];
  try { names = fs.readdirSync(dir).filter(name => /^[0-9TZ]+-[0-9a-f]{6}\.json$/.test(name)).sort(); } catch {}
  // 실행 순서는 기록의 seq로 정한다(같은 초에 둔 실행도 순서가 갈린다). seq는 잠금 안에서 앞 기록의 가장 큰 값에 1을 더한다.
  return names.map(name => readJson(path.join(dir, name), null)).filter(Boolean).sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

async function run({ config, stateDir, endpoint = LIVE_ENDPOINT, token, execute = false, override = null, fetchImpl = fetch }) {
  if (!config || typeof config !== 'object' || typeof config.projectNumber !== 'string' || !PROJECT.test(config.projectNumber)) throw new Failure('CONFIG_INVALID', 2);
  const backupPrefix = config.backupPrefix === undefined ? 'company/production/' : config.backupPrefix;
  if (typeof backupPrefix !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9-]+)*\/$/.test(backupPrefix)) throw new Failure('CONFIG_INVALID', 2);
  if (execute && config['지우기'] !== true) throw new Failure('DELETE_NOT_ENABLED', 2);
  if (override !== null && !/^[0-9TZ]+-[0-9a-f]{6}$/.test(override)) throw new Failure('OVERRIDE_INVALID', 2);
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~+/=-]{10,4096}$/.test(token)) throw new Failure('TOKEN_INVALID', 2);
  const media = 'synk-company-media-' + config.projectNumber;
  const backup = 'synk-company-backups-' + config.projectNumber;
  const release = takeLock(stateDir);
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
    const stateFile = path.join(stateDir, 'state.json');
    const state = readJson(stateFile, { schema: STATE_SCHEMA, firstSeen: {} });
    if (!state || state.schema !== STATE_SCHEMA || !state.firstSeen || typeof state.firstSeen !== 'object') throw new Failure('STATE_UNREADABLE');
    let eligible = [];
    if (!reasons.length) {
      const firstSeen = {};
      for (const item of candidates) {
        const k = key(item.name, item.generation);
        firstSeen[k] = Number.isFinite(Date.parse(state.firstSeen[k] || '')) ? state.firstSeen[k] : iso(startedAt);
      }
      writeJson(stateFile, { schema: STATE_SCHEMA, updatedAt: iso(startedAt), firstSeen });
      eligible = candidates.filter(item => startedAt - Date.parse(firstSeen[key(item.name, item.generation)]) >= RULES.seenMs);
    }

    let overrode = null;
    if (!reasons.length && eligible.length > RULES.maxShare * valid.length) {
      // 넘길 수 있는 것은 20% 하나로만 멈춘 그 실행이다. 그 뒤로 지우기 실행이 없었고, 지금 지울 것이 모두 그때 목록에 있어야 한다.
      // 미리 보기로 넘겨 본 것은 쓴 것으로 치지 않는다.
      const runs = runsOf(stateDir), at = runs.findIndex(r => r.runId === override), stopped = at >= 0 ? runs[at] : null;
      const listed = new Set(stopped && Array.isArray(stopped.eligible) ? stopped.eligible : []);
      const allowed = !!stopped && stopped.status === 'stopped' && Array.isArray(stopped.reasons) && stopped.reasons.length === 1 && stopped.reasons[0] === 'TOO_MANY'
        && !runs.slice(at + 1).some(r => r.mode === 'delete') && eligible.every(item => listed.has(key(item.name, item.generation)));
      if (allowed) overrode = override;
      else reasons.push(override ? 'OVERRIDE_INVALID' : 'TOO_MANY');
    }

    const deleted = [], changed = [], failed = [];
    let kept = [];
    if (execute && !reasons.length && eligible.length) {
      // 지우기 직전에 이 실행이 시작된 뒤 생긴 완료 객체를 한 번 더 읽고, 새로 가리킨 객체는 지우지 않는다.
      await readCompletes();
      if (unreadable.length) reasons.push('COMPLETE_UNREADABLE');
      else {
        kept = eligible.filter(item => referenced.has(key(item.name, item.generation)));
        for (const item of eligible) {
          if (referenced.has(key(item.name, item.generation))) continue;
          const result = await gcs.remove(item.name, item.generation);
          (result === 'deleted' ? deleted : result === 'changed' ? changed : failed).push(key(item.name, item.generation));
        }
      }
    }

    const status = reasons.length ? 'stopped' : execute ? 'cleaned' : 'previewed';
    const earlier = runsOf(stateDir);
    const report = {
      schema: RUN_SCHEMA, runId, seq: earlier.length ? (earlier[earlier.length - 1].seq || 0) + 1 : 1, mode: execute ? 'delete' : 'preview', status, reasons, startedAt: iso(startedAt), overrode,
      objects: valid.length, strange, completes, latestComplete: latest ? { name: latest.name, at: iso(latest.created), schema: latest.schema } : null,
      latestIsV1: !!latest && latest.schema === SCHEMA_V1, referenced: referenced.size, unreadable,
      candidates: candidates.map(item => key(item.name, item.generation)), eligible: eligible.map(item => key(item.name, item.generation)),
      eligibleBytes: eligible.reduce((sum, item) => sum + item.size, 0), keptByNewBackup: kept.map(item => key(item.name, item.generation)), deleted, changed, failed,
    };
    writeJson(path.join(stateDir, 'runs', runId + '.json'), report);
    if (status !== 'stopped') {
      await gcs.record('gc/runs/' + runId + '.json', { schema: RUN_SCHEMA, runId, mode: report.mode, status, startedAt: report.startedAt,
        objects: valid.length, candidates: candidates.length, eligible: eligible.length, deleted: deleted.length, failed: failed.length });
    }
    if (failed.length) throw Object.assign(new Failure('DELETE_FAILED'), { report });
    return report;
  } finally { release(); }
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
  if (report.overrode) lines.push('  20% 멈춤을 실행 ' + report.overrode + '의 목록으로 한 번 넘겼습니다.');
  for (const reason of report.reasons) lines.push('  멈춤: ' + (REASONS[reason] || reason) + '.');
  return lines.join('\n');
}

function args(argv) {
  const out = { json: false, execute: false, override: null, config: null, state: null, endpoint: LIVE_ENDPOINT, tokenStdin: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => { if (i + 1 >= argv.length) throw new Failure('USAGE', 2); return argv[++i]; };
    if (a === '--json') out.json = true;
    else if (a === '--실행') out.execute = true;
    else if (a === '--한번넘김') out.override = value();
    else if (a === '--설정') out.config = value();
    else if (a === '--상태') out.state = value();
    else if (a === '--끝점') out.endpoint = value();
    else if (a === '--토큰-stdin') out.tokenStdin = true;
    else throw new Failure('USAGE', 2);
  }
  // 실제 GCS 말고는 이 PC 안의 시험 서버만 받는다.
  if (out.endpoint !== LIVE_ENDPOINT && !/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(out.endpoint)) throw new Failure('USAGE', 2);
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
    process.stderr.write('쓰는 법: node tools/작업실영상정리.js [--json] [--실행] [--한번넘김 <실행 ID>] [--설정 <파일>] [--상태 <폴더>]\n');
    return 2;
  }
  const home = path.join(공용작업본(path.resolve(__dirname, '..')), '.tmp', 'company-media-cloud-gc');
  const stateDir = path.resolve(options.state || home);
  const configFile = path.resolve(options.config || path.join(home, 'config.json'));
  try {
    const config = readJson(configFile, null);
    if (!config) throw new Failure('CONFIG_MISSING', 2);
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

module.exports = { run, describe, RULES, OBJECT, _storage: storage };
if (require.main === module) main().then(code => { process.exitCode = code; });
