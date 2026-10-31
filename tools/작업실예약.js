#!/usr/bin/env node
'use strict';
/* 작업실 예약 등록(2026-10-21) — 1일 1편 편 폴더의 인스타 릴스·유튜브 쇼츠 판을 회사 작업실(workspace.synk.im)의 SNS 게시 원고로
 * 올리고 슬롯 시각에 예약한 뒤, 유호님이 휴대폰에서 누를 검토 링크를 만든다. 서버는 그 링크 승인 전에는 보내지 않는다.
 *
 *   node tools/작업실예약.js <편 폴더>                     미리 보기 — 어느 판을 어느 계정으로 무엇을 보낼지(서버는 읽기만)
 *   node tools/작업실예약.js <편 폴더> --실행 [--텔레그램]   등록하고, --텔레그램이면 검토 링크를 유호님께 보낸다
 *   node tools/작업실예약.js --대기열 [--실행] [--텔레그램]   docs/마케팅 아래 준비.json에 「작업실등록」: true를 단 「올릴 준비」 편 가운데 아직 안 한 것
 *                                                        (사람 없는 정기 작업 「SYNK 예약큐」가 30분마다 부른다 — tools/예약큐예약/)
 *   node tools/작업실예약.js 상태 <편 폴더> --캐시           예약큐 서버 캐시로 게시결과.json을 맞춘다(서버에 묻지 않는다 — Claude 세션은 이것)
 *   node tools/작업실예약.js 상태 <편 폴더>                 서버에 직접 물어 맞춘다(--저장안함)
 *   node tools/작업실예약.js 취소 <편 폴더>                 등록을 거둔다(원고 취소·예약 작업 취소·검토 링크 폐기) — 고쳐서 다시 올릴 때 먼저
 *   node tools/작업실예약.js 자격                          작업실 자동화 계정(이메일·비밀번호)을 Windows 자격 보관소에 넣는다 — 유호님이 직접 입력
 *   영어 이름도 받는다: credential(자격) · status(상태) · cancel(취소). 명령도 편 폴더도 아니면 자격을 읽기 전에 받은 글자를 보이고 멈춘다.
 *   공통: --주소 <작업실 주소>(기본 https://workspace.synk.im) · --언어없이 · --AI표시없이 · --첫댓글빼고 · --json
 *
 * 등록 순서(관문이 늘 먼저): 원본 영상 올리기 → 원고 저장(판마다 계정·제목·문구·옵션) → 「잠금」 필수 검토 링크 → 사내 승인 → 시각별 예약
 * → 예약이 모두 「검토 대기」인지 확인(아니면 바로 취소) → 유호님 검토 링크(이 일정 그대로) → 잠금 링크 폐기 → 요건이 유호님 링크 하나인지 확인.
 * 잠금 링크를 예약보다 먼저 만들어, 예약이 생기는 순간부터 서버가 검토 승인을 기다린다(필수 검토가 걸린 원고는 이후 판도 계속 필수 —
 * social-review.mjs requirement). 사내 승인은 자동화 계정이 하지만 그것만으로는 보내지 않고, 실제로 보내게 하는 것은 유호님 링크 승인뿐이다.
 * 검토 링크는 가진 사람이 승인할 수 있는 열쇠라 저장소에 적지 않는다 — %LOCALAPPDATA%\synk\작업실예약\에만 두고 텔레그램으로 보낸다.
 * 10-26 유호님 「검토 링크 하나로 같은 영상 판 함께 승인」: 링크 기록에 「함께」(작업실 판과 같은 원본 영상의 페북 · 틱톡 · 텔레그램 판 —
 * 승인되면 14시 게시 작업이 묻지 않고 건다)와 「따로」(다른 렌더 · 글 판 — 「올려」를 따로 받는다)를 적고, 텔레그램 승인 요청에 두 줄로 보인다.
 *
 * 서버로 보내는 판: 인스타 릴스(@yuhobuilds·@synkbrief·@synk.mn)와 유튜브 쇼츠(@yuhobuilds·@synkbrief·@synkkorean) 가운데 작업실에
 * 자동 게시로 연결된 계정만. 못 보내는 판(페이스북 페이지 영상·샤오훙수·틱톡·네이버·티스토리, 연결 전 계정)은 지금처럼 14시 게시 세션이 크롬으로 한다.
 * 올리기 전 검사(tools/올리기전검사.js)가 「고칠 것」 없이 끝났고 그 뒤 영상이 바뀌지 않았어야 등록한다.
 * 서버가 아직 못 보내는 칸이 있으면 그 판은 등록하지 않는다: 유튜브 언어 칸(서버 옵션 language — 다음 회사 릴리스), 인스타 AI 정보 표시(madeWithAi),
 * 인스타 첫 댓글(서버가 못 단다 — 캡션에 넣는다). 각각 --언어없이 · --AI표시없이 · --첫댓글빼고로 알고 넘길 수 있다.
 * 유튜브 고정 댓글과 표지 그림은 서버가 못 한다 — 게시결과.json 「후속」에 남겨 게시 뒤 손으로 한다. 인스타 표지는 판의 「표지시각」(초)이 있으면 그 장면.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { createHash, randomUUID } = require('node:crypto');
const 묶음 = require('./lib/게시묶음.js');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 헤르메스 = require('./lib/헤르메스보내기.js');

const ORIGIN = 'https://workspace.synk.im';
const CREDENTIAL = 'SYNK/SNS/workspace-automation';
const FORMAT = { instagram: 'reel', youtube: 'shorts' };
const MAX_BYTES = 100 * 1024 * 1024;
const TIMEZONE = 'Asia/Seoul';
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const LOCAL_DIR = process.env.SYNK_WORKSPACE_LINK_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '작업실예약');
const HERMES = path.join(process.env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
const TELEGRAM = 'telegram:6017495834';

// ── 자격 ──
function credentialScript(mode, input) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'sns-자격.ps1'), mode, CREDENTIAL],
    { input, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 });
  if (mode === 'get' && r.status === 3) return null;
  if (r.status !== 0) throw new Error(`Windows 자격 보관소 ${mode} 실패: ${String(r.stderr || '').trim() || r.status}`);
  return String(r.stdout || '');
}

function readCredential() {
  if (process.platform !== 'win32') return null;
  const raw = credentialScript('get');
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value.email || !value.password) throw new Error('작업실 자동화 자격에 이메일·비밀번호가 없습니다.');
  return value;
}

// 유호님이 터미널에서 직접 입력한다(Claude는 비밀번호를 넣지 않는다). 비밀번호는 화면에 보이지 않고 보관소에만 들어간다.
function saveCredentialInteractive() {
  const script = [
    "$ErrorActionPreference='Stop'",
    "$email=Read-Host '작업실 자동화 계정 이메일'",
    "$secure=Read-Host '비밀번호' -AsSecureString",
    '$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))',
    "$json=@{email=$email.Trim();password=$plain} | ConvertTo-Json -Compress",
    `$json | & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '${path.join(__dirname, 'sns-자격.ps1').replace(/'/g, "''")}' set '${CREDENTIAL}'`,
    "Write-Host ''; Write-Host '저장했습니다. 이제 Claude가 이 계정으로 작업실에 원고를 올립니다.'",
  ].join('; ');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('자격을 저장하지 못했습니다.');
}

// ── 작업실 API ──
class Workspace {
  // base는 시험용(서버가 아는 출처와 실제 접속 주소가 다를 때). 보통은 origin과 같다.
  constructor(origin, { fetchImpl = fetch, base = origin } = {}) { this.origin = origin.replace(/\/+$/, ''); this.base = base.replace(/\/+$/, ''); this.fetch = fetchImpl; this.cookie = null; this.csrf = null; }

  async login({ email, password }) {
    const r = await this.fetch(this.base + '/api/login', { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', origin: this.origin },
      body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(30000) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(`작업실 로그인 실패(${r.status}): ${data.error || data.message || ''}`.trim()), { status: r.status });
    const cookie = (r.headers.getSetCookie?.() || [r.headers.get('set-cookie') || '']).map((c) => c.split(';')[0]).find((c) => c.startsWith('synk_company_session='));
    if (!cookie || !data.csrfToken) throw new Error('작업실 로그인 응답에 세션이 없습니다.');
    this.cookie = cookie; this.csrf = data.csrfToken;
    return data.user;
  }

  // 이미 만든 세션(시험·임시)으로 시작한다. CSRF는 /api/me가 돌려준다.
  async useSession(value) {
    this.cookie = value.startsWith('synk_company_session=') ? value : `synk_company_session=${value}`;
    const me = await this.get('/api/me');
    this.csrf = me.csrfToken;
    if (!this.csrf) throw new Error('세션에 CSRF가 없습니다.');
    return me.user;
  }

  headers(extra = {}) {
    return { cookie: this.cookie, origin: this.origin, 'x-csrf-token': this.csrf || '', ...extra };
  }

  async parse(r, label) {
    const text = await r.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
    if (!r.ok) throw Object.assign(new Error(`${label} 실패(${r.status}): ${data.error || data.message || ''}`.trim()), { status: r.status, data });
    return data;
  }

  async get(p) {
    const r = await this.fetch(this.base + p, { headers: this.headers(), redirect: 'error', signal: AbortSignal.timeout(60000) });
    return this.parse(r, p);
  }

  async post(p, body) {
    const r = await this.fetch(this.base + p, { method: 'POST', redirect: 'error', headers: this.headers({ 'content-type': 'application/json' }), body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    return this.parse(r, p);
  }

  async upload(file, label) {
    const size = fs.statSync(file).size;
    const r = await this.fetch(this.base + '/api/social/media', { method: 'POST', redirect: 'error', duplex: 'half',
      headers: this.headers({ 'content-type': 'video/mp4', 'content-length': String(size), 'x-file-name': encodeURIComponent(path.basename(file)), 'x-version-label': encodeURIComponent(label.slice(0, 90)) }),
      body: Readable.toWeb(fs.createReadStream(file)), signal: AbortSignal.timeout(15 * 60000) });
    return this.parse(r, '영상 올리기');
  }
}

async function connect({ origin = ORIGIN, session = process.env.SYNK_WORKSPACE_SESSION, fetchImpl } = {}) {
  const ws = new Workspace(origin, { fetchImpl });
  if (session) { await ws.useSession(session); return ws; }
  const credential = readCredential();
  if (!credential) throw Object.assign(new Error('작업실 자동화 자격이 없습니다 — 유호님이 `node tools/작업실예약.js 자격`으로 한 번 넣어 주셔야 합니다.'), { code: 'NO_CREDENTIAL' });
  await ws.login(credential);
  return ws;
}

// ── 계획 ──
const { handleOf } = 묶음;

// sns-계정.json의 계정 키 → 작업실 채널. 연결된 채널은 capability.connection에 실제 핸들·외부 ID가 있다.
function matchChannel(account, platform, channels) {
  const mine = channels.filter((c) => c.platform === platform && c.active !== false);
  const want = handleOf(account?.handle || account?.expectedHandle);
  const hits = mine.filter((c) => {
    const conn = c.capability?.connection || {};
    if (account?.expectedChannelId && conn.integrationId === account.expectedChannelId) return true;
    return want && [conn.profile, c.name, c.url].some((v) => handleOf(v) === want);
  });
  return hits.length === 1 ? { channel: hits[0] } : { channel: null, reason: hits.length ? `작업실에 ${account?.handle} 채널이 ${hits.length}개 있다` : `작업실에 ${account?.handle || '이 계정'} 채널이 없다` };
}

// 검사 기록과 지금 파일이 같은지(크기·수정 시각). 다르면 다시 검사해야 한다.
function checkedFile(prep, rel, file) {
  const record = prep.검사;
  if (!record) return '올리기 전 검사 기록이 없다 — node tools/올리기전검사.js <편 폴더>';
  if (record.결과 === '고칠 것') return '올리기 전 검사에 「고칠 것」이 남아 있다';
  const row = (record.파일 || []).find((f) => f.경로 === rel);
  if (!row) return '이 영상은 올리기 전 검사를 거치지 않았다';
  const stat = fs.statSync(file);
  if (row.바이트 !== stat.size || row.수정 !== new Date(stat.mtimeMs).toISOString()) return '검사 뒤 영상이 바뀌었다 — 다시 검사';
  return null;
}

function planBundle(bundle, workspace, opts = {}) {
  const prep = bundle.prep;
  const channels = workspace.channels || [];
  const rows = [];
  for (const plate of 묶음.plates(bundle)) {
    const row = { account: plate.account, platform: plate.platform, time: plate.time, eligible: false, reasons: [], notes: [], plate };
    rows.push(row);
    if (!FORMAT[plate.platform]) { row.reasons.push('서버가 받지 않는 판 — 크롬'); continue; }
    const { channel, reason } = matchChannel(bundle.accounts[plate.account], plate.platform, channels);
    if (!channel) { row.reasons.push(reason); continue; }
    row.channel = { id: channel.id, name: channel.name };
    const cap = channel.capability || {};
    if (!cap.canPublish || cap.mode !== 'automatic') { row.reasons.push(`자동 게시 연결 전(${cap.reason || cap.mode || '연결 없음'})`); continue; }
    if (!channel.canPublish) row.reasons.push('자동화 계정이 이 채널의 관리자가 아니다(사내 승인·예약 권한 없음)');
    const supported = new Set(cap.options || []);
    const v = plate.video;
    if (!v?.exists) { row.reasons.push('영상 파일이 없다'); continue; }
    if (v.reduced) row.reasons.push('화질 낮춘 사본만 있다 — 원본을 적는다');
    const size = fs.statSync(v.path).size;
    if (size > MAX_BYTES) row.reasons.push(`영상이 ${(size / 1048576).toFixed(1)}MiB — 작업실은 100MiB까지`);
    const rel = 묶음.rel(bundle, v.path);
    const unchecked = checkedFile(prep, rel, v.path);
    if (unchecked) row.reasons.push(unchecked);
    const at = Date.parse(plate.time || '');
    if (!Number.isFinite(at)) row.reasons.push('시각이 없다');
    else if (at < Date.now() + 10 * 60000) row.reasons.push('시각이 10분 안이거나 지났다 — 슬롯을 옮긴다');
    const t = plate.texts;
    if (!t.caption) row.reasons.push('게시글이 없다');
    const options = {};
    if (plate.platform === 'youtube') {
      if (!t.title) row.reasons.push('유튜브 제목이 없다');
      Object.assign(options, { privacy: 'public', madeForKids: false, notifySubscribers: true });
      if (plate.kids !== false) row.reasons.push(plate.kids === true ? '아동용으로 적혀 있다 — 자동 등록하지 않는다' : '「아동용」 칸이 없다');
      if (plate.ai === null) row.reasons.push('「AI표시」 칸이 없다'); else options.madeWithAi = plate.ai;
      const langs = { language: plate.language, audioLanguage: plate.audioLanguage };
      if (!LANG.test(langs.language || '') || !LANG.test(langs.audioLanguage || '')) row.reasons.push('유튜브 언어·영상 언어 칸이 없다');
      else if (supported.has('language') && supported.has('audioLanguage')) Object.assign(options, langs);
      else if (opts.withoutLanguage) row.notes.push('언어 칸은 서버가 아직 못 보내 빈 채로 올라간다(--언어없이)');
      else row.reasons.push('서버가 아직 유튜브 언어 칸을 못 보낸다 — 다음 회사 릴리스 뒤(--언어없이로 넘길 수 있음)');
      const category = bundle.accounts[plate.account]?.categoryId;
      if (category && supported.has('categoryId')) options.categoryId = String(category);
      if (t.pinnedComment) row.notes.push('고정 댓글은 게시 뒤 손으로(API에 고정 기능 없음)');
      if (plate.cover) row.notes.push('유튜브 표지 그림은 서버가 못 올린다 — 첫 화면이 표지');
    } else {
      options.shareToFeed = true;
      if (plate.ai === null) row.reasons.push('「AI표시」 칸이 없다');
      else if (plate.ai === true) {
        if (supported.has('madeWithAi')) options.madeWithAi = true;
        else if (opts.withoutAiLabel) row.notes.push('AI 정보 표시는 서버가 아직 못 켠다 — 표시 없이 올라간다(--AI표시없이)');
        else row.reasons.push('서버가 아직 인스타 AI 정보 표시를 못 켠다 — 다음 회사 릴리스 뒤(--AI표시없이로 넘길 수 있음)');
      }
      if (t.firstComment) {
        if (opts.withoutFirstComment) row.notes.push('첫 댓글은 빼고 올린다(--첫댓글빼고) — 게시 뒤 손으로 달 수 있다');
        else row.reasons.push('첫 댓글은 서버가 못 단다 — 질문·해시태그를 캡션으로 옮기거나 --첫댓글빼고');
      }
      const coverAt = Number(plate.raw.표지시각);
      if (Number.isFinite(coverAt) && coverAt >= 0) options.thumbnailTimestamp = Math.round(coverAt * 1000);
      else if (plate.cover) row.notes.push('인스타 표지는 「표지시각」(영상 안 초)이 없어 첫 장면 — 따로 만든 표지 그림은 서버가 못 올린다');
    }
    row.variant = { channelId: channel.id, title: plate.platform === 'youtube' ? t.title : (prep.제목 || bundle.name).slice(0, 300), text: t.caption || '', format: FORMAT[plate.platform], options };
    row.video = { path: v.path, rel, size };
    row.eligible = row.reasons.length === 0;
  }
  return rows;
}

// ── 기록 ──
function stateFile(bundle) { return path.join(bundle.dir, '게시', '작업실.json'); }
function cancelMarker(bundle) { return path.join(bundle.dir, '게시', '작업실_자동등록중지.json'); }
function readState(bundle) { try { return 묶음.readJson(stateFile(bundle)); } catch { return null; } }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }

// 등록·취소는 편 하나를 공유하는 모든 프로세스에서 직렬화한다. 주인 없는 잠금도 자동으로 지우지 않는다.
async function withBundleLock(bundle, action) {
  const file = path.join(bundle.dir, '게시', '작업실_처리중.lock');
  let fd;
  try { fd = fs.openSync(file, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw Object.assign(new Error('이 편을 다른 작업이 처리 중이거나 중단된 잠금이 남아 있다 — 실행 중인 작업과 서버 상태를 확인한다'), { code: 'BUSY' });
    throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, 시작: new Date().toISOString() }));
    fs.closeSync(fd); fd = null;
    return await action();
  } finally {
    if (fd != null) fs.closeSync(fd);
    fs.unlinkSync(file);
  }
}

function localLinkFile(bundle) { return path.join(LOCAL_DIR, `${bundle.name}.json`); }

const STATUS = (job) => (job.status === 'scheduled' && job.reviewWaiting ? '승인 대기' : job.status === 'scheduled' ? '예약됨'
  : job.status === 'published' ? '게시됨' : ['publishing', 'accepted', 'processing'].includes(job.status) ? '보내는 중'
    : job.status === 'missed' ? '놓침' : job.status === 'unknown' ? '확인 필요' : job.status === 'manual' ? '손으로' : ['cancelled', 'skipped', 'expired'].includes(job.status) ? '취소됨' : '실패');

// 게시결과.json의 그 계정 줄만 바꾼다(크롬으로 올린 다른 판 줄은 그대로).
function mergeResults(bundle, rows) {
  const file = path.join(bundle.dir, '게시', '게시결과.json');
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const result = raw === null ? {} : JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (!result || typeof result !== 'object' || Array.isArray(result) || (result.판 != null && !Array.isArray(result.판)) || (result.추가게시 != null && !Array.isArray(result.추가게시))) throw new Error('게시결과.json 모양이 달라 건드리지 않았다');
  const list = Array.isArray(result.판) ? result.판 : [];
  const { postIdOf } = require('./lib/게시성과판정.js');
  const keyOf = p => postIdOf(p.주소)?.key || p.주소 || null;
  for (const value of rows) {
    const row = require('./lib/게시성과연결.js').identity(bundle.name, value);
    const all = [list, result.추가게시 || []].flatMap(rows => rows.map((p, i) => ({ p, i, rows })));
    const sameJob = all.filter(({ p }) => p.계정 === row.계정 && row.작업 && p.작업 === row.작업);
    const samePost = all.filter(({ p }) => p.계정 === row.계정 && keyOf(row) && keyOf(p) === keyOf(row));
    if (samePost.some(({ p }) => p.작업 && row.작업 && p.작업 !== row.작업)) throw new Error('같은 게시 주소의 작업ID가 달라 건드리지 않았다');
    // 추가게시도 같은 게시물로 찾는다. 주소·작업ID가 모두 빈 계획 줄만 마지막 대안이다.
    const candidates = sameJob.length ? sameJob : samePost.length ? samePost : all.filter(({ p, rows }) => rows === list && p.계정 === row.계정 && !p.주소 && !p.작업);
    if (candidates.length > 1) throw new Error('같은 계정의 여러 게시 결과가 있어 작업ID로 하나를 확인해야 한다');
    const hit = candidates[0];
    if (hit) {
      if (keyOf(hit.p) && keyOf(row) && keyOf(hit.p) !== keyOf(row)) throw new Error('같은 작업ID의 게시 주소가 달라 건드리지 않았다');
      // 예약큐와 같은 보호(10-28 상태 --캐시가 B8 두 판을 「승인 대기」로 내림): 검토 링크를 승인해도 서버는 내보내는 순간까지 reviewWaiting을
      // 남기니 「승인」을 적은 「예약됨」은 내리지 않고, 게시물 ID까지 적힌 「게시됨」(공개를 직접 확인한 판)은 서버가 무엇으로 내려도 그대로 둔다.
      const keep = (hit.p.상태 === '예약됨' && hit.p.승인 && row.상태 === '승인 대기') || (hit.p.상태 === '게시됨' && hit.p.게시물ID && row.상태 !== '게시됨');
      hit.rows[hit.i] = require('./lib/게시성과연결.js').identity(bundle.name, { ...hit.p, ...row, ...(keep ? { 상태: hit.p.상태 } : {}) });
    } else list.push(row);
  }
  const next = JSON.stringify({ ...result, 판: list }, null, 2) + '\n';
  if (raw !== null && raw.replace(/\r\n/g, '\n') === next) return;
  if ((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) !== raw) throw new Error('게시결과가 바뀌어 상태 쓰기를 멈췄다');
  const temp = file + `.상태-${process.pid}.tmp`;
  fs.writeFileSync(temp, next.replace(/\n/g, /\r\n/.test(raw || '') ? '\r\n' : '\n'), { flag: 'wx' });
  fs.renameSync(temp, file);
}

async function sendTelegram(text) {
  const r = 헤르메스.보내기(HERMES, TELEGRAM, text);
  if (!r.ok) throw Object.assign(new Error('텔레그램 보내기 실패: ' + r.error), { delivery: r.delivery });
  if (r.note) console.error(r.note);
}

// 알림은 편과 실패 단계별로 보관한다. 원고 결과가 불확실해진 경우는 앞선 업로드 실패와 별도로 알린다.
function failureNoticeFile(dir, kind) {
  const resolved = fs.realpathSync(dir);
  const key = createHash('sha256').update(process.platform === 'win32' ? resolved.toLowerCase() : resolved).digest('hex');
  return path.join(LOCAL_DIR, '등록실패알림', `${key}-${kind}.sqlite`);
}
function noticeKind(dir, error) {
  return error.code === 'UNCERTAIN' || fs.existsSync(path.join(dir, '게시', '작업실.json')) ? '확인필요' : '일시실패';
}
const sqliteBusy = error => error?.errcode === 5 || /database is locked/i.test(error?.message || '');
function openNotice(file, busyMs = 0) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file);
  try {
    db.exec(`PRAGMA busy_timeout=${busyMs}; PRAGMA synchronous=FULL`);
    // sent: 0=아직 시도 안 함, 1=전송 확인, 2=시도 기록 확정·결과 미확인. 기존 0/1 기록은 그대로 읽는다.
    db.exec('CREATE TABLE IF NOT EXISTS notice (id INTEGER PRIMARY KEY CHECK(id=1), message TEXT NOT NULL, sent INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS notice_claim (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL)');
    return db;
  }
  catch (error) { db.close(); throw error; }
}
async function dispatchFailureNotice(file, send = sendTelegram) {
  if (!fs.existsSync(file)) return false;
  let db, started = false, notice, token;
  try {
    db = openNotice(file);
    db.exec('BEGIN IMMEDIATE'); started = true;
    notice = db.prepare('SELECT message, sent FROM notice WHERE id=1').get();
    if (!notice || notice.sent) {
      db.exec('COMMIT'); started = false;
      if (notice?.sent === 2) console.error('  ! 알림 전송 결과 미확인 — 중복 방지를 위해 자동 재전송하지 않는다');
      return false;
    }
    token = randomUUID();
    db.prepare('INSERT INTO notice_claim (id, token) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET token=excluded.token').run(token);
    db.prepare('UPDATE notice SET sent=2 WHERE id=1').run();
    // 외부 전송보다 먼저 확정한다. 여기서부터 종료·응답 유실이 나도 같은 알림을 자동으로 다시 보내지 않는다.
    db.exec('COMMIT'); started = false;
  } catch (error) {
    if (started) { db.exec('ROLLBACK'); started = false; }
    if (sqliteBusy(error)) return false;
    throw error;
  } finally { db?.close(); }

  const finish = sent => {
    const result = openNotice(file, 5000);
    try {
      // 등록 성공으로 초기화된 뒤 새 실패가 생겼어도 옛 전송의 완료·실패가 새 기록을 바꾸지 못하게 한다.
      result.prepare('UPDATE notice SET sent=? WHERE id=1 AND sent=2 AND EXISTS (SELECT 1 FROM notice_claim WHERE id=1 AND token=?)').run(sent, token);
    } finally { result.close(); }
  };
  try { await send(notice.message); }
  catch (error) {
    if (error?.delivery === 'not-started') {
      try { finish(0); }
      catch (recordError) {
        throw Object.assign(new Error(`알림 전송을 시작하지 못했고 재시도 기록도 복구하지 못했다 — 자동 재전송하지 않는다: ${error.message} / 기록: ${recordError.message}`),
          { code: 'NOTICE_RETRY_BLOCKED', cause: error, recordError });
      }
      throw error;
    }
    throw Object.assign(new Error(`알림 전송 결과 미확인 — 중복 방지를 위해 자동 재전송하지 않는다: ${error?.message || error}`), { code: 'NOTICE_UNCERTAIN', cause: error });
  }
  try { finish(1); }
  catch (error) { throw Object.assign(new Error(`알림은 보냈지만 결과 기록을 마치지 못했다 — 자동 재전송하지 않는다: ${error.message}`), { code: 'NOTICE_UNCERTAIN', cause: error }); }
  return true;
}
async function notifyFailureOnce(dir, error, send = sendTelegram) {
  const file = failureNoticeFile(dir, noticeKind(dir, error));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `[작업실 등록 실패] ${path.basename(dir)}\n${String(error.message).slice(0, 300)}\n「오늘 편 게시」 세션이 기록과 작업실 원고를 확인합니다.`;
  let db;
  try { db = openNotice(file); db.prepare('INSERT OR IGNORE INTO notice (id, message, sent) VALUES (1, ?, 0)').run(text); }
  catch (e) { if (sqliteBusy(e)) return false; throw e; }
  finally { db?.close(); }
  return dispatchFailureNotice(file, send);
}
async function resendFailureNotices(send = sendTelegram) {
  const dir = path.join(LOCAL_DIR, '등록실패알림');
  let names;
  try { names = fs.readdirSync(dir).filter(name => /^[a-f0-9]{64}-(일시실패|확인필요)\.sqlite$/.test(name)); }
  catch (e) { if (e.code === 'ENOENT') return 0; throw e; }
  let sent = 0;
  for (const name of names) {
    try { if (await dispatchFailureNotice(path.join(dir, name), send)) sent++; }
    catch (error) { console.error(`  ! 등록 실패 알림을 처리하지 못했다: ${error.message}`); }
  }
  return sent;
}
async function clearFailureNotice(dir) {
  for (const kind of ['일시실패', '확인필요']) {
    const file = failureNoticeFile(dir, kind);
    if (!fs.existsSync(file)) continue;
    const deadline = Date.now() + 190000;
    for (;;) {
      let db;
      try { db = openNotice(file); db.prepare('DELETE FROM notice WHERE id=1').run(); break; }
      catch (error) {
        if (!sqliteBusy(error) || Date.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 200));
      } finally { db?.close(); }
    }
  }
}

const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ');

// ── 등록 ──
async function register(bundle, ws, rows, opts = {}) {
  return withBundleLock(bundle, () => registerLocked(bundle, ws, rows, opts));
}

async function registerLocked(bundle, ws, rows, opts = {}) {
  const prep = bundle.prep;
  const eligible = rows.filter((r) => r.eligible);
  if (!eligible.length) throw new Error('서버로 보낼 판이 없다');
  // 기록이 있으면(성공·실패 모두) 다시 만들지 않는다 — 다시 올리려면 `취소`가 서버 원고를 거두고 기록을 옮긴 뒤에.
  const old = readState(bundle);
  if (fs.existsSync(stateFile(bundle)) && !old?.postId) throw Object.assign(new Error('이전 등록의 결과가 불확실하다 — 작업실 원고와 기록을 확인하기 전에는 다시 등록하지 않는다'), { code: 'UNCERTAIN' });
  if (old?.postId) throw Object.assign(new Error(`이미 작업실에 등록한 편이다(원고 ${old.postId}${old.실패 ? ` · 실패: ${old.실패.이유}` : ''}) — 상태는 \`상태\`, 다시 올리려면 \`취소\` 뒤에`), { code: 'ALREADY' });
  const state = { 도구: 'tools/작업실예약.js', 작업실: ws.origin, 시작: new Date().toISOString(), 자산: {}, 판: [] };
  if (opts.queue && fs.existsSync(cancelMarker(bundle))) throw Object.assign(new Error('취소한 편의 자동 등록이 중지되어 있다'), { code: 'CANCELLED' });
  // 첫 외부 요청 전에 독점 기록을 남긴다. 응답을 잃거나 프로세스가 죽어도 자동 재등록하지 않는다.
  const claim = JSON.stringify({ ...state, 등록중: true }, null, 2) + '\n';
  fs.writeFileSync(stateFile(bundle), claim, { flag: 'wx' });
  // ① 원본 영상(같은 파일은 한 번)
  try {
    for (const row of eligible) {
      if (!state.자산[row.video.rel]) {
        const { asset } = await ws.upload(row.video.path, `${bundle.name} · ${path.basename(row.video.path)}`);
        state.자산[row.video.rel] = asset.id;
      }
      row.variant.media = [{ assetId: state.자산[row.video.rel] }];
    }
  } catch (error) {
    // 이 단계는 아직 원고 요청 전이다. 우리가 쓴 기록 그대로일 때만 거두어 재시도를 허용한다.
    if (fs.readFileSync(stateFile(bundle), 'utf8') === claim) fs.unlinkSync(stateFile(bundle));
    throw error;
  }
  // ② 원고
  let post;
  try {
    ({ post } = await ws.post('/api/social/posts', { title: (prep.제목 || bundle.name).slice(0, 300), body: '', language: 'ko', purpose: String(prep.역할 || '').slice(0, 2000),
      category: '1일 1편', campaignId: '', variants: eligible.map((r) => r.variant) }));
    if (!post?.id) throw new Error('응답에 원고 ID가 없다');
  } catch (error) {
    throw Object.assign(new Error(`원고 생성 결과가 불확실하다 — 작업실에서 원고를 확인한다: ${error.message}`), { code: 'UNCERTAIN', cause: error });
  }
  state.postId = post.id;
  writeJson(stateFile(bundle), state); // 여기서 멈춰도 다음 실행이 같은 원고를 다시 만들지 않게
  // 대기열이 아닌 명시적 등록만 취소 표식을 해제한다. 원고 기록을 쓴 뒤라 중단되어도 재등록하지 않는다.
  if (!opts.queue && fs.existsSync(cancelMarker(bundle))) fs.unlinkSync(cancelMarker(bundle));
  const jobs = [];
  let lock, review;
  try {
    // ③ 잠금 링크 — 예약보다 먼저. 이 순간부터 이 원고는 검토 승인 없이는 보내지 않는다.
    lock = await ws.post(`/api/social/posts/${post.id}/review-links`, { revision: post.revision, expiresInHours: 1, required: true, label: '잠금(자동 등록 중 — 다음 링크로 바뀜)' });
    if (!lock.requirement?.required) throw new Error('잠금 링크가 필수 검토로 걸리지 않았다');
    // ④ 사내 승인(자동화 계정) — 이것만으로는 보내지 않는다
    ({ post } = await ws.post(`/api/social/posts/${post.id}/action`, { revision: post.revision, action: 'approve', note: '1일 1편 자동 등록 — 유호님 검토 링크 승인 전에는 보내지 않습니다.' }));
    // ⑤ 시각별 예약
    const byTime = new Map();
    for (const row of eligible) { const key = new Date(Date.parse(row.time)).toISOString(); byTime.set(key, [...(byTime.get(key) || []), row]); }
    for (const [scheduledAt, group] of byTime) {
      const r = await ws.post(`/api/social/posts/${post.id}/action`, { revision: post.revision, action: 'schedule', mode: 'fixed', scheduledAt, timezone: TIMEZONE, channelIds: group.map((g) => g.channel.id) });
      jobs.push(...r.jobs);
    }
    const open = jobs.filter((j) => j.reviewWaiting !== true);
    if (open.length) throw new Error(`검토 대기가 아닌 예약이 있다(${open.map((j) => j.id).join(', ')}) — 모두 취소한다`);
    // ⑥ 유호님 검토 링크 — 이 일정 그대로. 마지막 슬롯 뒤 하루까지 열어 둔다(1~168시간).
    const last = Math.max(...jobs.map((j) => Date.parse(j.scheduledAt)));
    const hours = Math.min(168, Math.max(24, Math.ceil((last - Date.now()) / 3600000) + 24));
    review = await ws.post(`/api/social/posts/${post.id}/review-links`, { revision: post.revision, expiresInHours: hours, required: true, label: '유호님 승인' });
    // ⑦ 잠금 링크 폐기(일정이 바뀌어 이미 쓸 수 없지만 목록을 깨끗이)
    await ws.post(`/api/social/review-links/${lock.link.id}/revoke`, { revision: lock.link.revision }).catch(() => {});
    const check = await ws.get(`/api/social/posts/${post.id}/review`);
    const requirement = check.requirement || review.requirement || {};
    if (!requirement.required || requirement.ready) throw new Error('검토 요건이 걸려 있지 않다 — 작업실에서 이 원고를 확인한다');
    const detail = await ws.get(`/api/social/posts/${post.id}`);
    const waiting = (detail.jobs || []).filter((j) => j.status === 'scheduled');
    if (waiting.some((j) => j.reviewWaiting !== true)) throw new Error('승인 전인데 검토를 기다리지 않는 예약이 있다');
  } catch (error) {
    // 원고를 만든 뒤 어디서든 막히면 원고째 거둔다(예약 작업도 함께 취소). 실패 기록은 작업실.json에 남겨 정기 작업이 같은 편을 30분마다 다시 올리지 않게 하고,
    // 사람이 `취소`로 기록을 옮긴 뒤에야 다시 등록한다.
    await cancelPost(ws, post.id, '자동 등록 중 확인 실패로 취소').catch(() => {});
    state.실패 = { 시각: new Date().toISOString(), 이유: error.message };
    writeJson(stateFile(bundle), state);
    throw error;
  }
  state.링크 = { id: review.link.id, 만료: review.link.expiresAt };
  state.판 = eligible.map((row) => {
    const job = jobs.find((j) => j.channelId === row.channel.id);
    return { 계정: row.account, 채널: row.channel.id, 작업: job?.id || null, 시각: row.time, 영상: row.video.rel };
  });
  state.끝 = new Date().toISOString();
  writeJson(stateFile(bundle), state);
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  writeJson(localLinkFile(bundle), { 편: bundle.name, 제목: prep.제목 || bundle.name, 원고: post.id, 링크: review.url, 만료: review.link.expiresAt, 만듦: state.끝, 보냄: false,
    판: eligible.map((row) => ({ 계정: row.account, 시각: row.time })), ...companions(rows) });
  mergeResults(bundle, eligible.map((row) => ({ 계정: row.account, 상태: '승인 대기', 시각: row.time, 방법: '작업실', 작업: state.판.find((p) => p.계정 === row.account)?.작업 || null,
    ...(row.notes.length ? { 후속: row.notes } : {}) })));
  return { post, jobs, url: review.url, expiresAt: review.link.expiresAt, rows: eligible };
}

// ws 대신 jobs(예약큐 캐시의 서버 작업 목록)를 주면 서버에 묻지 않고 그것으로 옮긴다 — Claude 세션은 운영 서버를 직접 읽지 않는다.
async function status(bundle, ws, { save = true, jobs = null } = {}) {
  const state = readState(bundle);
  if (!state?.postId) return null;
  const detail = jobs ? { jobs } : await ws.get(`/api/social/posts/${state.postId}`);
  const rows = (state.판 || []).map((p) => {
    const job = (detail.jobs || []).find((j) => j.id === p.작업) || (!jobs && (detail.jobs || []).find((j) => j.channelId === p.채널));
    return { 계정: p.계정, 상태: job ? STATUS(job) : '작업 없음', 시각: job?.scheduledAt ? new Date(job.scheduledAt).toISOString() : p.시각, 방법: '작업실', 작업: job?.id || p.작업,
      원고ID: state.postId, ...(job?.publishedAt ? { 게시관측시각: job.publishedAt } : {}),
      ...(job?.publicationUrl ? { 주소: job.publicationUrl } : {}), ...(job?.message ? { 서버: String(job.message).slice(0, 200) } : {}) };
  });
  if (save) mergeResults(bundle, rows);
  return { postId: state.postId, rows };
}

// 원고를 지금 판(revision)으로 다시 읽어 취소한다 — 예약 작업이 모두 취소된다.
async function cancelPost(ws, postId, note) {
  const detail = await ws.get(`/api/social/posts/${postId}`);
  if (detail.post?.status === 'draft' && !(detail.jobs || []).some((j) => j.status === 'scheduled')) return detail;
  return ws.post(`/api/social/posts/${postId}/action`, { revision: detail.post.revision, action: 'cancel', note });
}

// 등록을 거둔다: 서버 원고를 취소(예약 작업도 함께)하고 유호님 링크를 폐기한다. 고칠 일이 생겨 다시 올릴 때 먼저 한다.
async function cancel(bundle, ws) {
  return withBundleLock(bundle, () => cancelLocked(bundle, ws));
}

async function cancelLocked(bundle, ws) {
  const state = readState(bundle);
  if (!state?.postId) {
    if (fs.existsSync(stateFile(bundle))) throw Object.assign(new Error('등록 결과가 불확실해 자동으로 지우지 않았다 — 작업실 원고와 기록을 확인한다'), { code: 'UNCERTAIN' });
    return null;
  }
  // 서버 취소 또는 후처리가 실패해도 자동 대기열이 이 편을 되살리지 못하게 먼저 표시한다.
  try { fs.writeFileSync(cancelMarker(bundle), JSON.stringify({ 중지: true, 시각: new Date().toISOString() }) + '\n', { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await cancelPost(ws, state.postId, '편을 고쳐 다시 올리려고 등록을 거둠');
  const review = await ws.get(`/api/social/posts/${state.postId}/review`);
  for (const link of review.links || []) if (!link.revokedAt) await ws.post(`/api/social/review-links/${link.id}/revoke`, { revision: link.revision }).catch(() => {});
  const at = new Date().toISOString();
  fs.renameSync(stateFile(bundle), path.join(bundle.dir, '게시', `작업실_취소_${at.replace(/[:.]/g, '')}.json`));
  fs.rmSync(localLinkFile(bundle), { force: true });
  mergeResults(bundle, (state.판 || []).map((p) => ({ 계정: p.계정, 상태: '취소됨', 방법: '작업실', 작업: p.작업 })));
  return { postId: state.postId, at };
}

// ── 대기열 ──
// 07시 작업이 올리기 전 검사를 마치고 준비.json에 「작업실등록」: true를 단 편만 — 아직 고치는 중인 편이 먼저 올라가지 않게.
function readyFolders(root) {
  const out = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(root, e.name);
    if (!fs.existsSync(path.join(dir, '게시', '준비.json')) || fs.existsSync(path.join(dir, '게시', '작업실.json')) || fs.existsSync(cancelMarker({ dir }))) continue;
    try {
      const prep = 묶음.readJson(path.join(dir, '게시', '준비.json'));
      if (prep.작업실등록 === true && prep.상태 === '올릴 준비' && prep.검사 && prep.검사.결과 !== '고칠 것') out.push(dir);
    } catch { /* 깨진 준비.json은 건너뛴다 — 예약큐가 보인다 */ }
  }
  return out;
}

// 다른 작업본에서 직접 지정한 편을 조용히 공용 판으로 바꾸면 낡은 원고가 올라갈 수 있어 멈춘다.
function sharedBundle(dir, action = '등록') {
  const repo = 묶음.repoOf(dir), main = 공용작업본(repo);
  const rel = path.relative(path.join(repo, 'docs', '마케팅'), path.resolve(dir));
  const inMarketing = rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  if (main !== repo && inMarketing) throw Object.assign(new Error(`워크트리 편의 ${action}은 공용 편 경로를 확인해 명시한다: ${path.join(main, 'docs', '마케팅', rel)}`), { code: 'WORKTREE_BUNDLE' });
  return 묶음.load(dir);
}

// 예약큐 정기 작업이 남긴 서버 캐시(tools/lib/작업실읽기.cjs 모양)의 작업 목록.
function cachedJobs() {
  const file = path.join(process.env.SYNK_QUEUE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '예약큐'), '서버.json');
  try { return { jobs: require('./lib/작업실읽기.cjs').다듬기(묶음.readJson(file)).jobs, file }; } catch { return null; }
}

function printPlan(bundle, rows) {
  console.log(`작업실 예약 · ${bundle.name}`);
  for (const r of rows) {
    console.log(`  ${r.eligible ? '→ 서버' : '· 그대로'} ${r.account}${r.channel ? `(${r.channel.name})` : ''} · ${r.time ? kst(r.time) : '시각 없음'}${r.video ? ` · ${path.basename(r.video.path)} ${(r.video.size / 1048576).toFixed(1)}MiB` : ''}`);
    for (const why of r.reasons) console.log(`      - ${why}`);
    for (const note of r.notes) console.log(`      · ${note}`);
    if (r.eligible) console.log(`      옵션 ${JSON.stringify(r.variant.options)}`);
  }
}

const FLAGS = new Set(['--실행', '--텔레그램', '--json', '--대기열', '--저장안함', '--언어없이', '--AI표시없이', '--첫댓글빼고', '--캐시', '--주소']);

// 첫 인자를 명령 이름으로 맞춘다. 터미널에 따라 한글이 다른 꼴(NFD)로 넘어올 수 있어 NFC로 맞추고, 치기 쉬운 영어 이름도 받는다.
const 명령별칭 = { credential: '자격', status: '상태', cancel: '취소' };
function 명령이름(arg) {
  const s = String(arg ?? '').normalize('NFC');
  return 명령별칭[s.toLowerCase()] || s;
}
const 코드포인트 = (s) => [...String(s)].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

function args(argv) {
  const unknown = argv.filter((a) => a.startsWith('--') && !FLAGS.has(a));
  if (unknown.length) throw Object.assign(new Error(`모르는 인자: ${unknown.join(' ')}`), { code: 'USAGE' });
  const at = argv.indexOf('--주소');
  if (at > -1 && (!argv[at + 1] || argv[at + 1].startsWith('--') || !/^https?:\/\//.test(argv[at + 1]))) throw Object.assign(new Error('--주소 뒤에는 작업실 주소(https://…)를 준다'), { code: 'USAGE' });
  return { run: argv.includes('--실행'), telegram: argv.includes('--텔레그램'), json: argv.includes('--json'), queue: argv.includes('--대기열'), noSave: argv.includes('--저장안함'),
    withoutLanguage: argv.includes('--언어없이'), withoutAiLabel: argv.includes('--AI표시없이'), withoutFirstComment: argv.includes('--첫댓글빼고'),
    // --주소 값만 뺀다. 10-22까지는 --주소가 없을 때(at = -1) 첫 인자(0번)를 늘 빼서 「자격」·「상태」·편 폴더가 사라졌다.
    origin: at > -1 ? argv[at + 1] : ORIGIN, rest: argv.filter((a, i) => !a.startsWith('--') && !(at > -1 && i === at + 1)) };
}

async function handleOne(dir, ws, o) {
  const bundle = sharedBundle(dir);
  const workspace = await ws.get('/api/social/workspace');
  const rows = planBundle(bundle, workspace, o);
  if (!o.json) printPlan(bundle, rows);
  if (!o.run) return { bundle: bundle.name, rows: rows.map(({ plate, ...r }) => r) };
  if (!rows.some((r) => r.eligible)) return { bundle: bundle.name, registered: false };
  const done = await register(bundle, ws, rows, o);
  // 알림 표식 정리 실패는 이미 성공한 등록을 실패로 바꾸지 않는다.
  try { await clearFailureNotice(bundle.dir); } catch (error) { console.error(`  ! 등록 실패 알림 표식을 정리하지 못했다: ${error.message}`); }
  console.log(`  등록 끝 · 원고 ${done.post.id} · 예약 ${done.jobs.length}개 모두 검토 대기 · 링크 만료 ${kst(done.expiresAt)}`);
  // 등록 뒤 일(텔레그램·기록 올리기)이 막혀도 등록은 된 것이다 — 따로 잡아 다음 회차가 이어 하게 한다.
  if (o.telegram) await sendLink(localLinkFile(bundle));
  else console.log(`  검토 링크는 ${localLinkFile(bundle)}에 있다(저장소에 넣지 않는다)`);
  // 공용 작업본에서 정기 작업이 돌았으면 그 편 기록(작업실.json·게시결과.json, 링크 열쇠 없음)만 곧바로 올린다. 워크트리에서는 하지 않는다.
  try {
    const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
    const rels = ['작업실.json', '게시결과.json'].map((name) => 묶음.rel(bundle, path.join(bundle.dir, '게시', name)));
    const pushed = 장부올리기글(await 장부올리기(rels, `chore(작업실 예약): ${bundle.name} 등록 — 유호님 검토 링크 승인 대기`, { 저장소: bundle.repo }), '편 기록');
    if (pushed) console.log('  ' + pushed);
  } catch (error) { console.error(`  ! 편 기록 올리기 실패(작업본에 남음 — 다음 올리기에 같이): ${error.message}`); }
  return { bundle: bundle.name, registered: true, postId: done.post.id };
}

// 검토 링크 승인 하나로 함께 거는 판(유호님 10-26 「검토 링크 하나로 같은 영상 판 함께 승인」): 작업실에 올린 판과 같은 원본 영상 파일을
// 그대로 쓰는 페북 · 틱톡 · 텔레그램 판. 다른 렌더(현지어 판 · 끝 말 바꾼 틱톡판)와 블로그 · X · 링크드인 같은 글 판은 「올려」를 따로 받는다.
const CARRIED = new Set(['facebook', 'tiktok', 'telegram']);
function companions(rows) {
  const sent = new Set(rows.filter((r) => r.eligible && r.video).map((r) => path.resolve(r.video.path)));
  const out = { 함께: [], 따로: [] };
  for (const r of rows) {
    if (r.eligible) continue;
    const file = r.plate?.video?.path ? path.resolve(r.plate.video.path) : null;
    (CARRIED.has(r.platform) && file && sent.has(file) ? out.함께 : out.따로).push({ 계정: r.account, 시각: r.time || null });
  }
  return out;
}

// 이 PC에 둔 링크 기록 하나를 텔레그램으로 보내고 「보냄」을 적는다. 실패하면 「보냄: false」로 남아 다음 회차(resendPending)가 다시 보낸다.
async function sendLink(file) {
  let record;
  try { record = 묶음.readJson(file); } catch { return false; }
  if (record.보냄 || Date.parse(record.만료) <= Date.now()) return false;
  const lines = (record.판 || []).map((p) => `· ${p.계정} ${kst(p.시각)}`).join('\n');
  const list = (xs) => xs.map((p) => `${p.계정}${p.시각 ? ` ${kst(p.시각)}` : ''}`).join(' · ');
  const more = [
    ...(record.함께?.length ? [`승인하시면 같은 영상으로 함께 걸어요: ${list(record.함께)}`] : []),
    ...(record.따로?.length ? [`「올려」를 따로 받는 판: ${list(record.따로)}`] : []),
  ];
  try {
    await sendTelegram(`[승인 요청] ${record.제목 || record.편}\n${lines}${more.length ? `\n${more.join('\n')}` : ''}\n\n검토 링크(누르기 전에는 올라가지 않아요):\n${record.링크}`);
  } catch (error) {
    console.error(`  ! 텔레그램 보내기 실패 — 다음 회차에 다시 보낸다: ${error.message}`);
    return false;
  }
  writeJson(file, { ...record, 보냄: true, 보낸때: new Date().toISOString() });
  console.log(`  텔레그램으로 검토 링크를 보냈다 · ${record.편}`);
  return true;
}

// 지난 회차에 등록은 됐는데 링크를 못 보낸 편(만료 전)을 다시 보낸다.
async function resendPending() {
  let names = [];
  try { names = fs.readdirSync(LOCAL_DIR).filter((n) => n.endsWith('.json')); } catch { return 0; }
  let sent = 0;
  for (const name of names) if (await sendLink(path.join(LOCAL_DIR, name))) sent += 1;
  return sent;
}

async function main() {
  const argv = process.argv.slice(2);
  const o = args(argv);
  const 명령 = 명령이름(o.rest[0]);
  if (명령 === '자격') { saveCredentialInteractive(); return; }
  if (명령 === '상태' && argv.includes('--캐시')) {
    const cached = cachedJobs();
    if (!cached) { console.log('예약큐 서버 캐시가 없다 — 정기 작업 「SYNK 예약큐」가 아직 안 돌았다'); process.exitCode = 1; return; }
    const r = await status(sharedBundle(o.rest[1], '상태 확인'), null, { save: !o.noSave, jobs: cached.jobs });
    if (!r) { console.log('작업실에 등록한 기록이 없다'); return; }
    for (const row of r.rows) console.log(`  ${row.계정} · ${row.상태} · ${kst(row.시각)}${row.주소 ? ` · ${row.주소}` : ''}`);
    return;
  }
  // 명령도 편 폴더도 아니면 자격을 읽기 전에 멈춘다 — 그대로 가면 「자격이 없습니다」로 보여 까닭을 가렸다.
  if (!o.queue && o.rest[0] && !['상태', '취소'].includes(명령) && !fs.existsSync(o.rest[0])) {
    throw Object.assign(new Error(`모르는 명령이거나 없는 편 폴더다: ${JSON.stringify(o.rest[0])} (${코드포인트(o.rest[0])}) — 자격은 \`node tools/작업실예약.js credential\``), { code: 'USAGE' });
  }
  // 등록할 편이 없는 회차는 자격·서버를 읽지 않는다. 이미 등록했으나 못 보낸 검토 링크는 그대로 이어 보낸다.
  const queueDirs = o.queue && !['상태', '취소'].includes(명령)
    ? readyFolders(path.join(공용작업본(묶음.repoOf(process.cwd())), 'docs', '마케팅')) : null;
  if (queueDirs && o.run && o.telegram) await resendFailureNotices();
  if (queueDirs && !queueDirs.length) {
    if (o.run && o.telegram) await resendPending();
    console.log('등록할 편이 없다');
    return;
  }
  const target = ['상태', '취소'].includes(명령) ? sharedBundle(o.rest[1], 명령 === '상태' ? '상태 확인' : '취소') : null;
  const ws = await connect({ origin: o.origin });
  if (명령 === '상태') {
    const r = await status(target, ws, { save: !o.noSave });
    if (!r) { console.log('작업실에 등록한 기록이 없다'); return; }
    for (const row of r.rows) console.log(`  ${row.계정} · ${row.상태} · ${kst(row.시각)}${row.주소 ? ` · ${row.주소}` : ''}`);
    return;
  }
  if (명령 === '취소') {
    const r = await cancel(target, ws);
    console.log(r ? `  작업실 원고 ${r.postId}의 예약과 검토 링크를 거뒀다 — 고친 뒤 다시 등록한다` : '작업실에 등록한 기록이 없다');
    return;
  }
  // 지난 회차에 등록은 됐는데 텔레그램을 못 보낸 링크부터 다시 보낸다.
  if (o.queue && o.run && o.telegram) await resendPending();
  const dirs = o.queue ? readyFolders(path.join(공용작업본(묶음.repoOf(process.cwd())), 'docs', '마케팅')) : o.rest.slice(0, 1);
  if (!dirs.length) { console.log(o.queue ? '등록할 편이 없다' : '사용: node tools/작업실예약.js <편 폴더> [--실행] [--텔레그램]'); if (!o.queue) process.exitCode = 2; return; }
  const results = [];
  for (const dir of dirs) {
    try { results.push(await handleOne(dir, ws, o)); } catch (error) {
      console.error(`  ✗ ${path.basename(dir)}: ${error.message}`);
      results.push({ bundle: path.basename(dir), error: error.message });
      process.exitCode = 1;
      if (o.queue && o.run && o.telegram && error.code !== 'ALREADY') await notifyFailureOnce(dir, error).catch(e => console.error(`  ! 등록 실패 알림을 처리하지 못했다: ${e.message}`));
    }
  }
  if (o.json) console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = error.code === 'NO_CREDENTIAL' ? 3 : error.code === 'USAGE' ? 2 : 1; });

module.exports = { Workspace, connect, planBundle, register, handleOne, status, cancel, matchChannel, checkedFile, readyFolders, sharedBundle, cachedJobs, sendLink, resendPending, notifyFailureOnce, resendFailureNotices, clearFailureNotice, companions, 명령이름, STATUS, LOCAL_DIR, mergeResults };
