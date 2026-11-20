#!/usr/bin/env node
'use strict';
/* 작업실 예약 등록(2026-10-21) — 1일 1편 편 폴더의 인스타 릴스·유튜브 쇼츠 판을 회사 작업실(workspace.synk.im)의 SNS 게시 원고로
 * 올리고 슬롯 시각에 예약한 뒤, 유호님이 휴대폰에서 누를 검토 링크를 만든다. 서버는 그 링크 승인 전에는 보내지 않는다.
 *
 *   node tools/작업실예약.js <편 폴더>                     미리 보기 — 어느 판을 어느 계정으로 무엇을 보낼지(서버는 읽기만)
 *   node tools/작업실예약.js <편 폴더> --실행 [--텔레그램]   등록하고, --텔레그램이면 검토 링크를 유호님께 보낸다(앞선 등록이 끝난 편이면 남은 판을 새 등록으로)
 *   node tools/작업실예약.js --대기열 [--실행] [--텔레그램]   docs/마케팅 아래 준비.json에 「작업실등록」: true를 단 「올릴 준비」·「완성」 편 가운데 아직 안 한 것
 *                                                        (사람 없는 정기 작업 「SYNK 예약큐」가 30분마다 부른다 — tools/예약큐예약/)
 *   node tools/작업실예약.js 상태 <편 폴더> --캐시           예약큐 서버 캐시로 게시결과.json을 맞춘다(서버에 묻지 않는다 — Claude 세션은 이것)
 *   node tools/작업실예약.js 상태 <편 폴더>                 서버에 직접 물어 맞춘다(--저장안함)
 *   node tools/작업실예약.js 취소 <편 폴더>                 등록을 거둔다(원고 취소·예약 작업 취소·검토 링크 폐기) — 고쳐서 다시 올릴 때 먼저
 *   node tools/작업실예약.js 자격                          작업실 자동화 계정(이메일·비밀번호)을 Windows 자격 보관소에 넣는다 — 유호님이 직접 입력
 *   node tools/작업실예약.js 게시주소 [--실행]              예약큐 캐시로 게시가 끝난 작업실 판의 공개 주소를 게시결과에 적는다(쓰기는 운영 사본 · 예약큐 정기 작업 ③, 11-18)
 *   영어 이름도 받는다: credential(자격) · status(상태) · cancel(취소) · published(게시주소). 명령도 편 폴더도 아니면 자격을 읽기 전에 받은 글자를 보이고 멈춘다.
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
 * 11-13부터 SNS 두 브랜드(synkbrief · yuhobuilds, 슬롯 11-14부터) 편은 최종 확인(컷 전수) 통과 기록(게시/최종확인.json — tools/최종확인.js)이 있고
 * 그 뒤 영상이 그대로여야 등록한다. 14시 게시 회차가 그 확인 없이 여섯 편을 승인 · 예약했던 일(11-13) 때문이다.
 * 서버가 아직 못 보내는 칸이 있으면 그 판은 등록하지 않는다: 유튜브 언어 칸(서버 옵션 language — 다음 회사 릴리스), 인스타 AI 정보 표시(madeWithAi),
 * 인스타 첫 댓글(서버가 못 단다 — 캡션에 넣는다). 각각 --언어없이 · --AI표시없이 · --첫댓글빼고로 알고 넘길 수 있다.
 * 유튜브 고정 댓글과 표지 그림은 서버가 못 한다 — 게시결과.json 「후속」에 남긴다. 고정 댓글은 그날 20:52 스레드 예약 작업이 ego로 달고(11-03), 표지는 첫 화면. 인스타 표지는 판의 「표지시각」(초)이 있으면 그 장면.
 *
 * 기록(11-20부터 편 하나에 등록 여럿): 게시/작업실.json은 늘 「지금 등록」 하나다 — 상태 · 취소 · 대기열 · 다른 자리 확인은 이 파일만 읽는다.
 * 앞선 등록이 끝났으면(완료 기록이고 서버의 그 원고 작업이 모두 게시됨 · 취소됨) 편 경로를 준 새 등록이 그 기록을 게시/작업실_끝_<시각>.json으로
 * 옮기고 새 작업실.json을 쓴다. 취소가 작업실_취소_<시각>.json으로 옮기는 것과 같은 꼴이다. 다른 자리(공용 작업본 · origin)에 남은 옛 작업실.json은
 * 이 편 폴더의 끝 · 취소 기록과 원고 번호가 같으면 거둔 것으로 본다. 게시결과에 이미 걸렸거나 거둔 계정 판은 보내지 않는다. 대기열은 다시 등록하지 않는다.
 * 게시결과 줄에는 올린 영상의 SHA-256을 「지문」으로 적는다 — 걸린 뒤 판본을 다시 구우면 예약큐가 「걸린 뒤 바뀜」으로 알린다(tools/돌림표.js bookedVersionProblem).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const { probeUploadTracks, probeUploadProblemSync, uploadBitrateProblem, hasInspectionHash } = require('./lib/upload-audio-bitrate.cjs');
const 묶음 = require('./lib/게시묶음.js');
const 최종확인 = require('./lib/최종확인.js');
const { 공용작업본 } = require('./lib/공용작업본.js');
const 헤르메스 = require('./lib/헤르메스보내기.js');
const 실패알림 = require('./lib/등록실패알림.js');
const 텔레그램한번 = require('./lib/텔레그램_한번보내기.js');

const ORIGIN = 'https://workspace.synk.im';
const CREDENTIAL = 'SYNK/SNS/workspace-automation';
const FORMAT = { instagram: 'reel', youtube: 'shorts' };
const MAX_BYTES = 100 * 1024 * 1024;
const TIMEZONE = 'Asia/Seoul';
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const LOCAL_DIR = process.env.SYNK_WORKSPACE_LINK_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '작업실예약');
// MSIX 앱 안과 Windows 예약 작업이 같은 outbox를 읽어야 한다. AppData 가상화를 피한다.
const FAILURE_DIR = process.env.SYNK_WORKSPACE_LINK_DIR ? path.join(LOCAL_DIR, '등록실패알림') : path.join(os.homedir(), '.synk', '작업실예약', '등록실패알림');
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

  async upload(file, label, inspectedSha256) {
    const before = fs.statSync(file, { bigint: true });
    const problem = uploadBitrateProblem(await probeUploadTracks(file));
    if (problem) throw Error(problem);
    const { fingerprint } = await import('./영상사전검사.mjs');
    const source = await fingerprint(file, MAX_BYTES);
    const after = fs.statSync(file, { bigint: true });
    if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].some(key => before[key] !== after[key]) ||
        (inspectedSha256 && source.sha256 !== inspectedSha256.toLowerCase())) throw Error('검사 뒤 영상이 바뀌었다 — 다시 검사');
    const r = await this.fetch(this.base + '/api/social/media', { method: 'POST', redirect: 'error', duplex: 'half',
      headers: this.headers({ 'content-type': 'video/mp4', 'content-length': String(source.byteSize), 'x-file-name': encodeURIComponent(path.basename(file)), 'x-version-label': encodeURIComponent(label.slice(0, 90)) }),
      body: Readable.toWeb(fs.createReadStream(file)), signal: AbortSignal.timeout(15 * 60000) });
    const data = await this.parse(r, '영상 올리기');
    if (data.asset?.sha256 !== source.sha256) throw Error('작업실이 받은 영상이 오디오 검사본과 다르다 — 다시 검사');
    return data;
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

// 옛 「확인할 것」 기록도 실제 예약 계획에 넣을 파일에서 오디오를 다시 잰다.
function checkedFile(prep, rel, file) {
  const record = prep.검사;
  if (!record) return '올리기 전 검사 기록이 없다 — node tools/올리기전검사.js <편 폴더>';
  const row = (record.파일 || []).find((f) => f.경로 === rel);
  if (!row) return '이 영상은 올리기 전 검사를 거치지 않았다 — 다시 검사';
  const stat = fs.statSync(file);
  if (row.바이트 !== stat.size || row.수정 !== new Date(stat.mtimeMs).toISOString()) return '검사 뒤 영상이 바뀌었다 — 다시 검사';
  if (!hasInspectionHash(row.sha256)) return '검사한 원본의 SHA-256 기록이 없다 — 다시 검사';
  if (record.결과 === '고칠 것') {
    const audio = row?.오디오비트레이트;
    return (Array.isArray(audio) && uploadBitrateProblem(audio)) || '올리기 전 검사에 「고칠 것」이 남아 있다';
  }
  return probeUploadProblemSync(file);
}

// 게시결과.json의 「판」 줄(파일이 없으면 빈 줄). 읽지 못하면 이미 걸린 판을 가릴 수 없으니 던진다.
function resultRows(bundle) {
  const file = path.join(bundle.dir, '게시', '게시결과.json');
  if (!fs.existsSync(file)) return [];
  let result;
  try { result = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (error) {
    throw new Error(`게시결과.json을 읽지 못해 이미 걸린 판인지 가릴 수 없다(${String(error.message).slice(0, 120)})`);
  }
  return Array.isArray(result?.판) ? result.판 : [];
}

// 그 계정 판이 게시결과에서 이미 걸렸거나(예약됨 · 게시됨 · 거는 중 · 작업이 있는 승인 대기) 거둔(보류 · 지움) 줄이면 그 줄 — 게시 장부와 같은 읽기
function takenRow(results, account) {
  const 장부 = require('./게시장부.js');
  const row = 장부.rowOf(results, account);
  return row && (장부.held(row) || 장부.WITHDRAWN.has(row.상태)) ? row : null;
}

function planBundle(bundle, workspace, opts = {}) {
  const prep = bundle.prep;
  const channels = workspace.channels || [];
  const rows = [];
  const fileChecks = new Map();
  // 11-13 최종 확인(컷 전수) 관문 — SNS 두 브랜드 편은 통과 기록이 있고 그 뒤 영상이 그대로여야 등록한다(tools/lib/최종확인.js)
  const finalProblem = 최종확인.problem(bundle);
  let results = [], resultsProblem = null;
  try { results = resultRows(bundle); } catch (error) { resultsProblem = error.message; }
  for (const plate of 묶음.plates(bundle)) {
    const row = { account: plate.account, platform: plate.platform, time: plate.time, eligible: false, reasons: [], notes: [], plate };
    rows.push(row);
    if (!FORMAT[plate.platform]) { row.reasons.push('서버가 받지 않는 판 — 크롬'); continue; }
    // 앞선 등록이 끝난 편에 판을 더 걸 때(11-20) 이미 나간 판 · 다른 길로 걸린 판을 다시 보내지 않는다
    if (resultsProblem) row.reasons.push(resultsProblem);
    const taken = resultsProblem ? null : takenRow(results, plate.account);
    if (taken) { row.taken = true; row.reasons.push(`게시결과에 이미 「${taken.상태}」 줄이 있다(${taken.방법 === '작업실' ? '작업실' : '다른 길'}) — 다시 보내지 않는다`); continue; }
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
    if (!fileChecks.has(rel)) fileChecks.set(rel, checkedFile(prep, rel, v.path));
    const unchecked = fileChecks.get(rel);
    if (unchecked) row.reasons.push(unchecked);
    if (finalProblem) row.reasons.push(finalProblem);
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
// opts.작업줄만(11-18 「게시주소」): 같은 계정 · 같은 작업ID 줄이 정확히 하나일 때만 그 줄을 바꾸고, 같은 게시물 줄이나 빈 계획 줄로 넘어가거나
// 새 줄을 덧붙이지 않는다(없거나 둘이면 던진다 — 고른 뒤 다시 등록으로 작업ID가 바뀐 판에 옛 작업 줄을 덧붙이지 않게, GPT 검수 GA1).
function mergeResults(bundle, rows, opts = {}) {
  const file = path.join(bundle.dir, '게시', '게시결과.json');
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const result = raw === null ? {} : JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (!result || typeof result !== 'object' || Array.isArray(result) || (result.판 != null && !Array.isArray(result.판)) || (result.추가게시 != null && !Array.isArray(result.추가게시))) throw new Error('게시결과.json 모양이 달라 건드리지 않았다');
  const list = Array.isArray(result.판) ? result.판 : [];
  // 같은 게시물인가는 게시성과연결 postOfRow · samePost 하나로 본다(설계 검토 다시 보기 — 주소, 없으면 게시물ID + 플랫폼. 게시물ID만 있는 줄 · 플랫폼이
  // 다른 같은 ID도 가린다, 4회차 GA1 · GA4). 둘 다 게시물을 가리키는데 같은 게시물이 아니면 다르다
  const { postOfRow, samePost } = require('./lib/게시성과연결.js');
  const { WITHDRAWN } = require('./게시장부.js');
  const differs = (a, b) => Boolean(postOfRow(a) && postOfRow(b) && !samePost(a, b));
  for (const value of rows) {
    const row = require('./lib/게시성과연결.js').identity(bundle.name, value);
    const all = [list, result.추가게시 || []].flatMap(rows => rows.map((p, i) => ({ p, i, rows })));
    const sameJob = all.filter(({ p }) => p.계정 === row.계정 && row.작업 && p.작업 === row.작업);
    const sameRows = all.filter(({ p }) => p.계정 === row.계정 && samePost(p, row));
    if (sameRows.some(({ p }) => p.작업 && row.작업 && p.작업 !== row.작업)) throw new Error('같은 게시 주소의 작업ID가 달라 건드리지 않았다');
    // 추가게시도 같은 게시물로 찾는다. 주소·작업ID가 모두 빈 계획 줄만 마지막 대안이다.
    const candidates = opts.작업줄만 ? sameJob : sameJob.length ? sameJob : sameRows.length ? sameRows : all.filter(({ p, rows }) => rows === list && p.계정 === row.계정 && !p.주소 && !p.작업);
    if (opts.작업줄만 && candidates.length !== 1) throw new Error(`같은 계정 · 작업ID 줄이 ${candidates.length}개라 건드리지 않았다(새 줄을 만들지 않는다)`);
    if (candidates.length > 1) throw new Error('같은 계정의 여러 게시 결과가 있어 작업ID로 하나를 확인해야 한다');
    const hit = candidates[0];
    if (hit) {
      if (differs(hit.p, row)) throw new Error('같은 작업ID의 게시 주소가 달라 건드리지 않았다');
      // 예약큐와 같은 보호(10-28 상태 --캐시가 B8 두 판을 「승인 대기」로 내림): 검토 링크를 승인해도 서버는 내보내는 순간까지 reviewWaiting을
      // 남기니 「승인」을 적은 「예약됨」은 내리지 않고, 게시물 ID까지 적힌 「게시됨」(공개를 직접 확인한 판)은 서버가 무엇으로 내려도 그대로 둔다.
      // 거둔 줄(보류 · 지움)은 서버가 무엇이든 상태를 그대로 둔다 — 상태 · 상태 --캐시가 지운 판을 「게시됨」으로 되살리지 않게(설계 검토 다시 보기 N1)
      const keep = (hit.p.상태 === '예약됨' && hit.p.승인 && row.상태 === '승인 대기') || (hit.p.상태 === '게시됨' && hit.p.게시물ID && row.상태 !== '게시됨')
        || WITHDRAWN.has(hit.p.상태);
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
function existingFailureNoticeFiles() {
  const folders = [FAILURE_DIR];
  if (!process.env.SYNK_WORKSPACE_LINK_DIR) {
    const appData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const packages = path.join(appData, 'Packages');
    let names = [];
    try { names = fs.readdirSync(packages).filter(name => /^(OpenAI\.Codex_|Claude_|Anthropic\.Claude_)/i.test(name)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const name of names) folders.push(path.join(packages, name, 'LocalCache', 'Local', 'synk', '작업실예약', '등록실패알림'));
    folders.push(path.join(LOCAL_DIR, '등록실패알림'));
  }
  const files = new Map(), physical = new Map(), conflicts = new Set();
  for (const folder of folders) {
    let names;
    try { names = fs.readdirSync(folder).filter(name => /^[a-f0-9]{64}-(일시실패|확인필요)\.sqlite$/.test(name)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const name of names) {
      const file = path.join(folder, name), stat = fs.statSync(file, { bigint: true });
      const id = `${stat.dev}:${stat.ino}`;
      if (physical.has(name) && physical.get(name) !== id) { conflicts.add(name); files.delete(name); continue; }
      if (conflicts.has(name)) continue;
      if (!files.has(name)) { files.set(name, file); physical.set(name, id); }
    }
  }
  return { files, conflicts };
}
function failureNoticeFile(dir, kind) {
  const resolved = fs.realpathSync(dir);
  const key = createHash('sha256').update(process.platform === 'win32' ? resolved.toLowerCase() : resolved).digest('hex');
  const name = `${key}-${kind}.sqlite`;
  const { files, conflicts } = existingFailureNoticeFiles();
  if (conflicts.has(name)) throw new Error(`실패 알림 ${name}의 기록이 여러 위치에 있다 — 중복 전송 전에 대조해야 한다`);
  return files.get(name) || path.join(FAILURE_DIR, name);
}
function noticeKind(dir, error) {
  return error.code === 'UNCERTAIN' || fs.existsSync(path.join(dir, '게시', '작업실.json')) ? '확인필요' : '일시실패';
}
async function sendFailureTelegram(text, delivery) { return 텔레그램한번.send(text, delivery); }
sendFailureTelegram.identity = () => 텔레그램한번.identity(TELEGRAM);
async function notifyFailureOnce(dir, error, send = sendFailureTelegram) {
  const file = failureNoticeFile(dir, noticeKind(dir, error));
  const text = `[작업실 등록 실패] ${path.basename(dir)}\n발생: ${kst(new Date().toISOString())} (KST)\n${String(error.message).slice(0, 300)}\n「오늘 편 게시」 세션이 기록과 작업실 원고를 확인합니다.`;
  실패알림.enqueue(file, text);
  return (await 실패알림.dispatch(file, send)) > 0;
}
async function resendFailureNotices(send = sendFailureTelegram) {
  const { files, conflicts } = existingFailureNoticeFiles();
  let sent = 0;
  const errors = [];
  for (const name of conflicts) errors.push(new Error(`실패 알림 ${name}의 여러 기록을 대조해야 한다`));
  for (const file of files.values()) {
    try { sent += await 실패알림.dispatch(file, send); }
    catch (error) { sent += Number.isSafeInteger(error.sent) ? error.sent : 0; errors.push(error); console.error(`  ! 등록 실패 알림을 처리하지 못했다: ${error.message}`); }
  }
  if (errors.length) throw Object.assign(new AggregateError(errors, `등록 실패 알림 ${sent}건 확인·${errors.length}개 기록이 전송 대기 기록에 남아 있다`), { sent });
  return sent;
}
async function clearFailureNotice(dir) {
  const errors = [];
  for (const kind of ['일시실패', '확인필요']) {
    try { 실패알림.clear(failureNoticeFile(dir, kind)); } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, '일부 실패 회차 표식을 초기화하지 못했다 — 전송 기록은 보존했다');
}

const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ');

// ── 등록 ──
async function register(bundle, ws, rows, opts = {}) {
  return withBundleLock(bundle, () => registerLocked(bundle, ws, rows, opts));
}

// 앞선 등록이 끝났나(11-20 — 편 하나에 등록 여럿) → { ok, why }. 실패 · 등록 중이 아닌 완료 기록이고, 서버의 그 원고 작업이 모두 게시됨 · 취소됨이며
// 기록의 판마다 서버에 작업이 있어야 끝난 것이다. 서버를 못 읽으면 던진다(끝났다고 치지 않는다).
const FINISHED = new Set(['게시됨', '취소됨']);
async function finishedRegistration(ws, old) {
  if (old.실패) return { ok: false, why: `실패한 등록이다(${old.실패.이유}) — \`취소\`로 기록을 옮긴 뒤에` };
  if (old.등록중 || !old.끝) return { ok: false, why: '등록을 마치지 못한 기록이다 — 작업실 원고와 기록을 확인한다' };
  if (!Array.isArray(old.판) || !old.판.length) return { ok: false, why: '기록에 판이 없다' };
  const detail = await ws.get(`/api/social/posts/${old.postId}`);
  const jobs = detail.jobs || [];
  const who = (j) => old.판.find((p) => p.작업 === j.id || p.채널 === j.channelId)?.계정 || j.channelId;
  const live = jobs.filter((j) => !FINISHED.has(STATUS(j)));
  if (live.length) return { ok: false, why: `끝나지 않은 작업이 있다(${live.map((j) => `${who(j)} ${STATUS(j)}`).join(' · ')})` };
  const missing = old.판.filter((p) => !jobs.some((j) => (p.작업 ? j.id === p.작업 : j.channelId === p.채널)));
  if (missing.length) return { ok: false, why: `서버에 작업이 없는 판이 있다(${missing.map((p) => p.계정).join(' · ')})` };
  return { ok: true, why: null };
}

async function registerLocked(bundle, ws, rows, opts = {}) {
  const prep = bundle.prep;
  const eligible = rows.filter((r) => r.eligible);
  if (!eligible.length) throw new Error('서버로 보낼 판이 없다');
  // 기록이 있으면 다시 만들지 않는다 — 다시 올리려면 `취소`가 서버 원고를 거두고 기록을 옮긴 뒤에. 끝난 등록(모든 작업이 게시됨 · 취소됨)만 새 등록이 옮긴다.
  const oldRaw = fs.existsSync(stateFile(bundle)) ? fs.readFileSync(stateFile(bundle), 'utf8') : null;
  const old = readState(bundle);
  if (oldRaw !== null && !old?.postId) throw Object.assign(new Error('이전 등록의 결과가 불확실하다 — 작업실 원고와 기록을 확인하기 전에는 다시 등록하지 않는다'), { code: 'UNCERTAIN' });
  // 게시결과에 이미 걸렸거나 거둔 계정 판은 보내지 않는다 — 계획을 짠 뒤 다른 길로 걸렸거나, 끝난 등록의 판을 그대로 다시 넘겨도 두 번 나가지 않게
  const results = resultRows(bundle);
  const taken = eligible.map((r) => [r.account, takenRow(results, r.account)]).filter(([, t]) => t);
  if (taken.length) throw Object.assign(new Error(`게시결과에 이미 걸렸거나 거둔 판이 있다(${taken.map(([a, t]) => `${a} ${t.상태}`).join(' · ')}) — 다시 보내지 않는다`), { code: 'ALREADY' });
  if (old?.postId) {
    const already = (why) => Object.assign(new Error(`이미 작업실에 등록한 편이다(원고 ${old.postId}${why ? ` · ${why}` : ''}) — 상태는 \`상태\`, 다시 올리려면 \`취소\` 뒤에`), { code: 'ALREADY' });
    if (opts.queue) throw already(old.실패 ? `실패: ${old.실패.이유}` : null); // 대기열은 첫 등록만 한다 — 판을 더 거는 것은 편 경로를 준 손 등록
    const finished = await finishedRegistration(ws, old);
    if (!finished.ok) throw already(finished.why);
  }
  const 곁기록 = 다른자리등록(bundle, { 끝난: old?.postId || null });
  if (곁기록) throw Object.assign(new Error(`${곁기록.이름}에 이 편의 작업실 기록이 있다(${곁기록.경로}) — 두 번 등록하지 않는다. 상태 · 취소는 운영 사본의 도구와 편 경로로 부른다`), { code: 'ALREADY' });
  const state = { 도구: 'tools/작업실예약.js', 작업실: ws.origin, 시작: new Date().toISOString(), 자산: {}, 판: [] };
  if (opts.queue && fs.existsSync(cancelMarker(bundle))) throw Object.assign(new Error('취소한 편의 자동 등록이 중지되어 있다'), { code: 'CANCELLED' });
  // 끝난 앞 등록은 작업실_끝_<시각>.json으로 옮긴다(취소 기록과 같은 꼴). 확인한 뒤 기록이 바뀌었으면 옮기지 않는다.
  let archived = null;
  if (old?.postId) {
    if (fs.readFileSync(stateFile(bundle), 'utf8') !== oldRaw) throw Object.assign(new Error('앞선 등록 기록이 확인하는 사이 바뀌었다 — 다시 부른다'), { code: 'UNCERTAIN' });
    archived = `작업실_끝_${state.시작.replace(/[:.]/g, '')}.json`;
    fs.renameSync(stateFile(bundle), path.join(bundle.dir, '게시', archived));
  }
  // 첫 외부 요청 전에 독점 기록을 남긴다. 응답을 잃거나 프로세스가 죽어도 자동 재등록하지 않는다.
  const claim = JSON.stringify({ ...state, 등록중: true }, null, 2) + '\n';
  fs.writeFileSync(stateFile(bundle), claim, { flag: 'wx' });
  // ① 원본 영상(같은 파일은 한 번). 작업실이 받은 영상의 SHA-256을 게시결과 줄 「지문」으로 적는다(걸린 뒤 바뀜을 예약큐가 견준다)
  const shas = {};
  try {
    for (const row of eligible) {
      if (!state.자산[row.video.rel]) {
        const inspected = prep.검사?.파일?.find(f => f.경로 === row.video.rel);
        const { asset } = await ws.upload(row.video.path, `${bundle.name} · ${path.basename(row.video.path)}`, inspected?.sha256);
        state.자산[row.video.rel] = asset.id;
        shas[row.video.rel] = String(asset.sha256 || inspected?.sha256 || '').toLowerCase() || null;
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
    return { 계정: row.account, 채널: row.channel.id, 작업: job?.id || null, 시각: row.time, 영상: row.video.rel, ...(shas[row.video.rel] ? { 지문: shas[row.video.rel] } : {}) };
  });
  state.끝 = new Date().toISOString();
  writeJson(stateFile(bundle), state);
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  writeJson(localLinkFile(bundle), { 편: bundle.name, 제목: prep.제목 || bundle.name, 원고: post.id, 링크: review.url, 만료: review.link.expiresAt, 만듦: state.끝, 보냄: false,
    판: eligible.map((row) => ({ 계정: row.account, 시각: row.time })), ...companions(rows) });
  mergeResults(bundle, eligible.map((row) => ({ 계정: row.account, 상태: '승인 대기', 시각: row.time, 방법: '작업실', 작업: state.판.find((p) => p.계정 === row.account)?.작업 || null,
    ...(shas[row.video.rel] ? { 지문: shas[row.video.rel] } : {}), ...(row.notes.length ? { 후속: row.notes } : {}) })));
  return { post, jobs, url: review.url, expiresAt: review.link.expiresAt, rows: eligible, archived };
}

// 서버 작업 찾기(11-18 설계 검토 D2) — 작업실.json의 판 줄 {계정, 채널, 작업}과 원고 postId로 고른다. 예약큐 캐시에는 모든 원고의 작업이
// 들어 있으니 작업ID에 더해 원고 · 채널까지 같아야 그 판의 작업이다. → { job } · 캐시에 없으면 { job: null } · 어긋나면 { job: null, 막힘 }
function jobOf(state, plate, jobs) {
  const job = (jobs || []).find((j) => j && plate && j.id === plate.작업);
  if (!job) return { job: null };
  if (job.postId !== state?.postId || job.channelId !== plate.채널) {
    return { job: null, 막힘: `${plate.계정}: 서버 작업 ${String(plate.작업).slice(0, 8)}의 원고 · 채널이 작업실.json과 다르다(원고 ${job.postId === state?.postId ? '같음' : '다름'} · 채널 ${job.channelId === plate.채널 ? '같음' : '다름'})` };
  }
  return { job };
}

// ws 대신 jobs(예약큐 캐시의 서버 작업 목록)를 주면 서버에 묻지 않고 그것으로 옮긴다 — Claude 세션은 운영 서버를 직접 읽지 않는다.
// 캐시 길은 원고 · 채널까지 맞는 작업만 쓰고(jobOf), 캐시에 없는 작업(14일 창 밖)은 「작업 없음」으로 쓰지 않고 막힘으로 돌려준다(설계 검토 D6).
async function status(bundle, ws, { save = true, jobs = null } = {}) {
  const state = readState(bundle);
  if (!state?.postId) return null;
  const detail = jobs ? null : await ws.get(`/api/social/posts/${state.postId}`);
  const rows = [], 막힘 = [];
  for (const p of state.판 || []) {
    let job;
    if (jobs) {
      const found = jobOf(state, p, jobs);
      if (!found.job) { 막힘.push(found.막힘 || `${p.계정}: 캐시에 작업 ${String(p.작업 || '').slice(0, 8)}이 없다 — 이 줄은 쓰지 않았다`); continue; }
      job = found.job;
    } else job = (detail.jobs || []).find((j) => j.id === p.작업) || (detail.jobs || []).find((j) => j.channelId === p.채널);
    rows.push({ 계정: p.계정, 상태: job ? STATUS(job) : '작업 없음', 시각: job?.scheduledAt ? new Date(job.scheduledAt).toISOString() : p.시각, 방법: '작업실', 작업: job?.id || p.작업,
      원고ID: state.postId, ...(job?.publishedAt ? { 게시관측시각: job.publishedAt } : {}),
      ...(job?.publicationUrl ? { 주소: job.publicationUrl } : {}), ...(job?.message ? { 서버: String(job.message).slice(0, 200) } : {}) });
  }
  if (save && rows.length) mergeResults(bundle, rows);
  return { postId: state.postId, rows, 막힘 };
}

// 게시가 끝난 작업실 판의 공개 주소를 게시결과에 적을 줄(11-18). synkbrief · yuhobuilds 인스타 줄이 게시 뒤에도 「승인 대기」 · 주소 없음으로 남아
// 게시 성과 판정이 편 폴더를 못 찾았다. 세 회차 검수 뒤 설계 검토로 다시 짰다(.tmp/검수/설계검토_게시성과편연결_20261118.md).
// 신원은 등록 도구가 잠금 안에서만 쓰는 작업실.json에서 읽는다 — 게시결과 줄은 사람과 여러 도구가 고쳐 믿지 않는다(D1). 판 줄마다
//   ① 서버 작업이 그 원고 · 그 채널의 그 작업이고(jobOf) 「게시됨」이며, 공개 주소가 게시물로 읽히고 그 플랫폼이 서버 채널 플랫폼과 같다
//   ② 같은 원고를 쓰는 작업실.json이 이 편 하나다(편 폴더를 복사한 경우 — ctx.같은원고, D5)
//   ③ 게시결과에서 그 계정 · 작업 줄이 정확히 하나이고, 그 줄이 도구가 적는 중간 상태(또는 주소 없는 게시됨)이며, 주소 · 게시물ID가 없거나 같은 게시물이다
//   ④ 그 계정의 줄(rowOf)이 거둔 줄(보류 · 지움)이 아니다 — 지움 줄을 게시됨으로 되살리지 않는다(D3)
// 일 때만 {계정, 상태 게시됨, 작업, 주소, 게시관측시각}을 낸다. 시각 · 원고ID · 승인 · 서버 메시지는 건드리지 않는다. 이미 「게시됨」 + 같은 게시물이면 넘어간다.
// 같은 게시물이 작업ID 없는 다른 줄(손 연결이 남긴 추가게시)에도 있으면 판 줄을 채우고 「중복」으로 알린다(D7). → { rows, 막힘, 중복 }
const 채울상태 = new Set(['승인 대기', '예약됨', '보내는 중', '확인 필요', '작업 없음', '게시됨']);
function publishedPlan(bundle, cache, { 같은원고 = () => 1 } = {}) {
  const { postIdOf } = require('./lib/게시성과판정.js');
  const { rowOf, WITHDRAWN } = require('./게시장부.js');
  const out = { rows: [], 막힘: [], 중복: [] };
  const state = readState(bundle);
  if (!state?.postId || !Array.isArray(state.판)) return out;
  const file = path.join(bundle.dir, '게시', '게시결과.json');
  const result = fs.existsSync(file) ? 묶음.readJson(file) : {};
  const 판 = Array.isArray(result?.판) ? result.판 : [];
  const all = [...판, ...(Array.isArray(result?.추가게시) ? result.추가게시 : [])].filter((r) => r && typeof r === 'object');
  const { samePost } = require('./lib/게시성과연결.js');
  const sameAs = (r, id) => samePost(r, { 주소: null, 게시물ID: id.externalId, 플랫폼: id.platform });
  let 원고수 = null;
  const 판줄 = state.판.filter((p) => p && typeof p === 'object');
  for (const plate of state.판) {
    if (!plate || typeof plate.계정 !== 'string' || typeof plate.작업 !== 'string' || !plate.작업) continue;
    // 한 작업실.json 안에서 같은 작업 · 같은 채널은 판 줄 하나에만 있어야 한다(4회차 GA5 — 두 계정 줄에 같은 주소를 주지 않게)
    const 겹침 = 판줄.filter((p) => p !== plate && (p.작업 === plate.작업 || (plate.채널 && p.채널 === plate.채널)));
    if (겹침.length) { out.막힘.push(`${plate.계정}: 작업실.json에서 같은 작업 · 채널이 다른 판 줄(${겹침.map((p) => p.계정).join(', ')})에도 있다 — 사람이 본다`); continue; }
    const found = jobOf(state, plate, cache?.jobs);
    if (found.막힘) { out.막힘.push(found.막힘); continue; }
    const job = found.job;
    if (!job || job.status !== 'published') continue;
    const id = postIdOf(job.publicationUrl);
    if (!id) { out.막힘.push(`${plate.계정}: 서버는 게시됨인데 공개 주소를 게시물로 읽지 못했다(${job.publicationUrl || '주소 없음'})`); continue; }
    const channel = (cache?.channels || []).find((c) => c && c.id === job.channelId);
    if (!channel || channel.platform !== id.platform) { out.막힘.push(`${plate.계정}: 공개 주소(${id.platform})가 서버 채널(${channel?.platform || '모름'})과 플랫폼이 다르다`); continue; }
    const mine = all.filter((r) => r.계정 === plate.계정 && r.작업 === plate.작업);
    // 이미 「게시됨」 + 같은 게시물 주소면 넘어간다 — 주소 없이 게시물ID만 있는 게시됨 줄은 주소를 채운다(4회차 GA3)
    if (mine.length === 1 && mine[0].상태 === '게시됨' && postIdOf(mine[0].주소)?.key === id.key) continue;
    if (원고수 === null) 원고수 = 같은원고(state.postId);
    if (원고수 !== 1) { out.막힘.push(`${plate.계정}: 같은 원고(${String(state.postId).slice(0, 8)})의 작업실.json이 ${원고수}개 편에 있다 — 어느 편인지 보고 손으로 고친다`); continue; }
    if (mine.length !== 1) { out.막힘.push(`${plate.계정}: 게시결과에 작업 ${plate.작업.slice(0, 8)} 줄이 ${mine.length}개라 건드리지 않았다(새 줄을 만들지 않는다)`); continue; }
    const row = mine[0];
    if (!채울상태.has(row.상태)) { out.막힘.push(`${plate.계정}: 작업 줄이 「${row.상태 || '상태 없음'}」이라 게시됨으로 바꾸지 않는다`); continue; }
    if ((row.주소 || row.게시물ID) && !sameAs(row, id)) { out.막힘.push(`${plate.계정}: 작업 줄에 다른 게시물이 적혀 있다 — 주소가 달라 건드리지 않았다`); continue; }
    const cur = rowOf(판, plate.계정);
    if (cur && WITHDRAWN.has(cur.상태)) { out.막힘.push(`${plate.계정}: 그 계정 줄이 「${cur.상태}」(거둔 판)인데 서버는 게시됨이다 — 사람이 본다`); continue; }
    out.rows.push({ 계정: plate.계정, 상태: '게시됨', 작업: job.id, 주소: job.publicationUrl, ...(job.publishedAt ? { 게시관측시각: job.publishedAt } : {}) });
    if (all.some((r) => r !== row && r.계정 === plate.계정 && !r.작업 && sameAs(r, id))) out.중복.push(`${plate.계정}: 같은 게시물이 작업ID 없는 줄에도 있다 — 중복 정리 필요`);
  }
  return out;
}

// 잠금 안에서 부른다 — 작업실.json · 게시결과를 다시 읽어 위 조건을 다시 본 뒤(D5 · 다시 등록 사이), 줄마다 기존 병합(mergeResults)에 「작업줄만」으로 넘긴다.
// 병합은 읽은 뒤 파일이 바뀌었거나 같은 게시물을 다른 작업ID 줄이 쓰면 다시 막는다. 줄 하나가 막혀도 그 편의 다른 줄은 한다.
// → { 고침: [{계정, 주소}], 막힘: [까닭], 중복: [까닭] }
function applyPublished(bundle, cache, ctx = {}) {
  const plan = publishedPlan(bundle, cache, ctx);
  const 고침 = [];
  for (const row of plan.rows) {
    try { mergeResults(bundle, [row], { 작업줄만: true }); 고침.push({ 계정: row.계정, 주소: row.주소 }); }
    catch (error) { plan.막힘.push(`${row.계정}: ${error.message}`); }
  }
  return { 고침, 막힘: plan.막힘, 중복: plan.중복 };
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
// 상태는 「올릴 준비」·「완성」으로 시작하면 받는다(11-02: 「올릴 준비 — 완성(관문 못 넘음)」 synkbrief 편과 「완성」 yuhobuilds 편이
// 같음 비교에 걸려 한 번도 등록되지 않아 매일 판이 비었다). 등록해도 유호님 검토 승인 전에는 보내지 않는다.
const READY_STATE = /^(올릴 준비|완성)/;
function readyFolders(root) {
  const out = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(root, e.name);
    if (!fs.existsSync(path.join(dir, '게시', '준비.json')) || fs.existsSync(path.join(dir, '게시', '작업실.json')) || fs.existsSync(cancelMarker({ dir }))) continue;
    try {
      const prep = 묶음.readJson(path.join(dir, '게시', '준비.json'));
      if (prep.작업실등록 === true && READY_STATE.test(String(prep.상태 || '')) && prep.검사 && prep.검사.결과 !== '고칠 것'
        && !(최종확인.required(prep) && !최종확인.OPEN.has(최종확인.read({ dir })?.결과))) out.push(dir); // 최종 확인 전 편은 대기열에 넣지 않는다(11-13)
    } catch { /* 깨진 준비.json은 건너뛴다 — 예약큐가 보인다 */ }
  }
  return out;
}

// 운영 사본(origin 판만 따라감, tools/운영사본.js)인가 — 가리지 못하면 아니라고 본다(옛 동작: 공용 작업본 기준).
function 운영사본에서(repo) {
  try { return require('./운영사본.js').운영사본인가(repo); } catch { return false; }
}

// 이 저장소의 운영 사본 경로(없으면 null)
function 운영사본경로(repo) {
  try { return require('./운영사본.js').찾기(repo).운영사본 || null; } catch { return null; }
}

// 다른 작업본에서 직접 지정한 편을 조용히 공용 판으로 바꾸면 낡은 원고가 올라갈 수 있어 멈춘다.
// 11-03부터 운영 사본이 있으면 등록 · 상태 · 취소는 운영 사본의 편으로만 받는다 — origin 판이고, 등록 잠금 · 기록이 한 자리라 같은 편을 두 번 등록할 틈이 없다(git 밖 영상은 묶음의 mediaRoot = 공용 작업본).
function sharedBundle(dir, action = '등록') {
  const repo = 묶음.repoOf(dir), main = 공용작업본(repo);
  const rel = path.relative(path.join(repo, 'docs', '마케팅'), path.resolve(dir));
  const inMarketing = rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  if (inMarketing && !운영사본에서(repo)) {
    const ops = 운영사본경로(repo);
    // 공용 작업본에서 등록하고 못 올린 옛 기록 — 운영 사본엔 없으니 그 자리에서 상태를 보고 거둘 수 있어야 한다(실제 예약이 살아 있다). 새 등록은 여전히 막는다
    const 옛기록 = main === repo && action !== '등록' && ops && fs.existsSync(stateFile({ dir })) && !fs.existsSync(stateFile({ dir: path.join(ops, 'docs', '마케팅', rel) }));
    if (옛기록) return 묶음.load(dir);
    if (ops) throw Object.assign(new Error(`편의 ${action}은 운영 사본의 도구와 편 경로로 부른다: node "${path.join(ops, 'tools', '작업실예약.js')}" "${path.join(ops, 'docs', '마케팅', rel)}"`), { code: 'WORKTREE_BUNDLE' });
    if (main !== repo) throw Object.assign(new Error(`워크트리 편의 ${action}은 공용 편 경로를 확인해 명시한다: ${path.join(main, 'docs', '마케팅', rel)}`), { code: 'WORKTREE_BUNDLE' });
  }
  return 묶음.load(dir);
}

// 공용 작업본 쪽 같은 편에 등록 기록이나 자동 등록 중지 표식이 있나 — 공용 작업본에서 등록하고 못 올린 기록은 운영 사본에 안 보인다(11-03 세 편).
function 공용쪽기록(bundleName, main) {
  const dir = path.join(main, 'docs', '마케팅', bundleName);
  return fs.existsSync(stateFile({ dir })) || fs.existsSync(cancelMarker({ dir }));
}

// 이 편이 다른 자리에 이미 등록돼 있나 — 공용 작업본 · 운영 사본 · origin 가운데 어디든 살아 있는 작업실.json이 있으면 그 자리 이름을 준다.
// 등록은 어느 작업본 경로로 불러도 한 번이어야 한다(두 번이면 같은 계정에 두 번 나간다). 이 편 폴더의 취소 · 끝 기록과 같은 원고는 이미 거둔 것으로 본다.
// 끝난 = 새 등록이 곧 작업실_끝_으로 옮길 앞 등록의 원고 번호(11-20 — 다른 자리에 남은 그 옛 기록이 새 등록을 막지 않게).
function 다른자리등록(bundle, { 끝난 = null } = {}) {
  if (!bundle.repo) return null;
  const rel = `docs/마케팅/${bundle.name}/게시/작업실.json`;
  const 거둠 = new Set(끝난 ? [끝난] : []);
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(path.join(bundle.dir, '게시')).filter((f) => /^작업실_(취소|끝)_.*\.json$/.test(f)); } catch { /* 게시 폴더 없음 */ }
  for (const f of 이름들) { try { const id = 묶음.readJson(path.join(bundle.dir, '게시', f)).postId; if (id) 거둠.add(id); } catch { /* 깨진 취소 기록은 세지 않는다 */ } }
  // 원고 번호가 없는 기록(등록 중 독점 기록 · 깨진 파일)은 산 것으로 본다 — 등록 결과가 불확실하면 두 번 등록하지 않는다
  const 살아있나 = (글) => { try { const id = JSON.parse(String(글).trimStart()).postId; return !id || !거둠.has(id); } catch { return true; } };
  const 자리 = [['공용 작업본', 공용작업본(bundle.repo)]];
  try { const f = require('./운영사본.js').찾기(bundle.repo); if (f.운영사본) 자리.push(['운영 사본', f.운영사본]); } catch { /* 저장소 밖 · 가리킴 없음 */ }
  for (const [이름, 뿌리] of 자리) {
    if (path.resolve(뿌리).toLowerCase() === path.resolve(bundle.repo).toLowerCase()) continue;
    const file = path.join(뿌리, ...rel.split('/'));
    if (fs.existsSync(file) && 살아있나(fs.readFileSync(file, 'utf8'))) return { 이름, 경로: file };
  }
  const r = spawnSync('git', ['-c', 'core.quotepath=false', 'show', `refs/remotes/origin/master:${rel}`], { cwd: bundle.repo, encoding: 'utf8', windowsHide: true });
  if (r.status === 0 && 살아있나(r.stdout)) return { 이름: 'origin', 경로: rel };
  return null;
}

// 「기록 없음」을 곧이듣지 않게 — 이 자리엔 없어도 다른 자리에 등록 기록이 있으면 실제 예약이 살아 있을 수 있다. 그 자리를 알리고 실패로 끝낸다.
function 기록없음(bundle) {
  const 곁 = 다른자리등록(bundle);
  if (!곁) { console.log('작업실에 등록한 기록이 없다'); return; }
  console.error(`이 자리에는 작업실 기록이 없지만 ${곁.이름}에 있다(${곁.경로}) — 실제 예약이 살아 있을 수 있다. 공용 작업본 기록이면 그 편 경로로 상태 · 취소를 부르고, origin 기록이면 운영 사본이 받은 뒤 다시 부른다`);
  process.exitCode = 1;
}

// 대기열 — 운영 사본에서 돌면 그 사본(origin 판)의 편을 보고, 공용 작업본 쪽에 기록이 있는 편은 뺀다(두 번 등록하지 않게). 그 밖에서는 공용 작업본의 편.
function queueFolders(repo) {
  const main = 공용작업본(repo);
  if (main === repo || !운영사본에서(repo)) return readyFolders(path.join(main, 'docs', '마케팅'));
  return readyFolders(path.join(repo, 'docs', '마케팅')).filter((dir) => !공용쪽기록(path.basename(dir), main));
}

// 「게시주소」 — docs/마케팅의 모든 편에서 게시가 끝난 작업실 판의 주소를 예약큐 캐시로 게시결과에 적는다(11-18). 예약큐 정기 작업이
// 서버를 읽은 바로 뒤에 부른다(tools/예약큐예약/run-hidden.py ③). 쓰기는 운영 사본에서만 하고(상태 --캐시와 같은 까닭 — 기록이 한 자리),
// 다른 자리에서는 미리 보기만 한다. 편 하나가 막혀도 나머지는 하고, 막힌 편은 까닭과 함께 돌려준다. 고칠 줄이 있는 편만 잠근다(고칠 것 없는
// 편을 잠가 그사이 등록 · 취소가 BUSY로 멈추지 않게). cache = { jobs, channels }(예약큐 캐시).
async function fillPublished(repo, cache, { run = false } = {}) {
  const root = path.join(repo, 'docs', '마케팅');
  const out = { 고침: [], 막힘: [], 중복: [], 쓴파일: [] };
  const listDirs = () => { try { return fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(root, e.name)); } catch { return null; } };
  const dirs = listDirs();
  if (!dirs) return out;
  // 같은 원고를 쓰는 작업실.json 수(D5) — 처음 한 번 세고, 쓰는 편은 잠금 안에서 폴더를 다시 훑어 다시 센다(그사이 편 폴더를 복사했을 때)
  const 원고수 = () => { const m = new Map(); for (const dir of listDirs() || []) { const st = readState({ dir }); if (st?.postId) m.set(st.postId, (m.get(st.postId) || 0) + 1); } return m; };
  const first = 원고수();
  for (const dir of dirs) {
    const bundle = { dir, name: path.basename(dir) };
    let r;
    try {
      const pre = publishedPlan(bundle, cache, { 같은원고: (id) => first.get(id) || 0 });
      if (!run || !pre.rows.length) r = { 고침: pre.rows.map((x) => ({ 계정: x.계정, 주소: x.주소 })), 막힘: pre.막힘, 중복: pre.중복 };
      else r = await withBundleLock(bundle, async () => applyPublished(bundle, cache, { 같은원고: (id) => 원고수().get(id) || 0 }));
    } catch (error) { out.막힘.push({ 편: bundle.name, 까닭: error.message }); continue; }
    for (const why of r.막힘) out.막힘.push({ 편: bundle.name, 까닭: why });
    for (const why of r.중복) out.중복.push({ 편: bundle.name, 까닭: why });
    if (!r.고침.length) continue;
    if (run) out.쓴파일.push(path.relative(repo, path.join(dir, '게시', '게시결과.json')).split(path.sep).join('/'));
    out.고침.push(...r.고침.map((x) => ({ 편: bundle.name, 계정: x.계정, 주소: x.주소 })));
  }
  return out;
}

// 「게시주소」를 쓸 수 있는 자리인가(GA4) — 운영 사본이거나, 운영 사본 가리킴을 확실히 읽었는데 없는 PC일 때만. 가리지 못하면(오류) 쓰지 않는다.
function 게시주소쓰기자리(repo) {
  let 운영;
  try { 운영 = require('./운영사본.js'); } catch (error) { return { ok: false, why: `운영사본.js를 읽지 못했다 — ${error.message}` }; }
  let f;
  try { f = 운영.찾기(repo); } catch (error) { return { ok: false, why: `운영 사본 가리킴을 읽지 못했다 — ${String(error.message).split('\n')[0]}` }; }
  if (!f.운영사본) return { ok: true };
  if (운영.운영사본인가(repo)) return { ok: true };
  return { ok: false, why: `쓰기는 운영 사본의 정기 작업이 한다(${f.운영사본})` };
}
const 게시주소_캐시한도ms = 2 * 3600_000;

// 예약큐 정기 작업이 남긴 서버 캐시(tools/lib/작업실읽기.cjs 모양)의 작업 목록.
function cachedJobs() {
  const file = path.join(process.env.SYNK_QUEUE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '예약큐'), '서버.json');
  // 채널 · 읽은 때는 「게시주소」가 쓴다(채널 플랫폼 대조 · 낡은 캐시 건너뛰기, 11-18)
  try { const d = require('./lib/작업실읽기.cjs').다듬기(묶음.readJson(file)); return { jobs: d.jobs, channels: d.channels, checkedAt: d.checkedAt, file }; } catch { return null; }
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
const 명령별칭 = { credential: '자격', status: '상태', cancel: '취소', published: '게시주소' };
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
  console.log(`  등록 끝 · 원고 ${done.post.id} · 예약 ${done.jobs.length}개 모두 검토 대기 · 링크 만료 ${kst(done.expiresAt)}${done.archived ? ` · 끝난 앞 등록은 게시/${done.archived}로 옮김` : ''}`);
  // 등록 뒤 일(텔레그램·기록 올리기)이 막혀도 등록은 된 것이다 — 따로 잡아 다음 회차가 이어 하게 한다.
  if (o.telegram) await sendLink(localLinkFile(bundle));
  else console.log(`  검토 링크는 ${localLinkFile(bundle)}에 있다(저장소에 넣지 않는다)`);
  // 공용 작업본에서 정기 작업이 돌았으면 그 편 기록(작업실.json·게시결과.json, 링크 열쇠 없음)만 곧바로 올린다. 워크트리에서는 하지 않는다.
  await 편기록올리기(bundle, ['작업실.json', '게시결과.json', '작업실_자동등록중지.json', ...(done.archived ? [done.archived] : [])], `chore(작업실 예약): ${bundle.name} 등록 — 유호님 검토 링크 승인 대기`);
  return { bundle: bundle.name, registered: true, postId: done.post.id };
}

// 편 기록을 곧바로 올린다(도구 안에서 — 실패해도 등록 · 취소를 실패로 바꾸지 않는다). 파일도 없고 추적도 안 된 경로는 뺀다(git add가 멈춘다).
async function 편기록올리기(bundle, names, message) {
  try {
    const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
    const 있는길 = names.filter((name) => {
      const file = path.join(bundle.dir, '게시', name);
      return fs.existsSync(file) || spawnSync('git', ['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', file], { cwd: bundle.repo, windowsHide: true }).status === 0;
    });
    const rels = 있는길.map((name) => 묶음.rel(bundle, path.join(bundle.dir, '게시', name)));
    const pushed = 장부올리기글(await 장부올리기(rels, message, { 저장소: bundle.repo }), '편 기록');
    if (pushed) console.log('  ' + pushed);
  } catch (error) { console.error(`  ! 편 기록 올리기 실패(작업본에 남음 — 다음 올리기에 같이): ${error.message}`); }
}

// 운영 사본에서 부른 상태 · 취소의 기록을 올린다 — 안 올리면 그 사본만 고쳐져 세션 워크트리 · origin과 어긋난다(공용 작업본 · 워크트리는 세션이 제 커밋에 올린다).
async function 운영사본기록올리기(bundle, names, message) {
  if (운영사본에서(bundle.repo)) await 편기록올리기(bundle, names, message);
}

// 검토 링크 승인 하나로 함께 거는 판(유호님 10-26 「검토 링크 하나로 같은 영상 판 함께 승인」): 작업실에 올린 판과 같은 원본 영상 파일을
// 그대로 쓰는 페북 · 틱톡 · 텔레그램 판. 다른 렌더(현지어 판 · 끝 말 바꾼 틱톡판)와 블로그 · X · 링크드인 같은 글 판은 「올려」를 따로 받는다.
const CARRIED = new Set(['facebook', 'tiktok', 'telegram']);
function companions(rows) {
  const sent = new Set(rows.filter((r) => r.eligible && r.video).map((r) => path.resolve(r.video.path)));
  const out = { 함께: [], 따로: [] };
  for (const r of rows) {
    if (r.eligible || r.taken) continue; // 이미 걸렸거나 나간 판은 승인 요청에 적지 않는다
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
  if (명령 === '게시주소') {
    const cached = cachedJobs();
    if (!cached) {
      const why = '예약큐 서버 캐시가 없다 — 정기 작업 「SYNK 예약큐」가 아직 안 돌았다(이번은 건너뛴다)';
      console.log(o.json ? JSON.stringify({ 건너뜀: why, 고침: [], 막힘: [], 중복: [], 쓴파일: [] }, null, 2) : why);
      return;
    }
    // 서버 읽기(②)가 실패해 캐시가 낡았으면 그 캐시로 쓰지 않는다(GA10)
    const age = Date.now() - Date.parse(cached.checkedAt || '');
    if (!(age <= 게시주소_캐시한도ms)) {
      const why = `예약큐 서버 캐시가 낡았다(읽은 때 ${cached.checkedAt || '모름'}) — 이번은 건너뛴다`;
      console.log(o.json ? JSON.stringify({ 건너뜀: why, 고침: [], 막힘: [], 중복: [], 쓴파일: [] }, null, 2) : why); // --json은 늘 JSON으로(GA4)
      return;
    }
    const repo = 묶음.repoOf(process.cwd());
    // 쓰기는 운영 사본에서만(운영 사본이 없는 PC는 이 자리) — 세션 작업본은 미리 보기로 본다. 가리지 못하면 쓰지 않는다(GA4)
    const 자리 = o.run ? 게시주소쓰기자리(repo) : { ok: false };
    const run = o.run && 자리.ok;
    if (o.run && !run) console.log(`${자리.why} — 여기서는 미리 보기만 한다`);
    const r = await fillPublished(repo, cached, { run });
    if (r.막힘.length) process.exitCode = 1;
    // 쓴 파일은 출력 꼴(--json)과 상관없이 올린다(GA3 — 다음 회차는 이미 고친 줄을 건너뛰어 다시 올리지 않는다)
    if (run && r.쓴파일.length) {
      try {
        const { 장부올리기, 장부올리기글 } = require('./lib/장부올리기.js');
        const pushed = await 장부올리기(r.쓴파일, `chore(작업실 예약): 게시가 끝난 판 ${r.고침.length}개의 공개 주소를 게시결과에 적음 — ${[...new Set(r.고침.map((x) => x.편))].slice(0, 4).join(', ')}`, { 저장소: repo });
        r.올리기 = 장부올리기글(pushed, '게시 주소') || null;
        // 못 올렸으면 실패로 끝낸다(GA6) — 쓴 줄은 다음 회차가 이미 고친 줄로 건너뛰니, 다음 장부 올리기나 세션 올리기가 함께 가져간다
        if (['실패', '멈춤'].includes(pushed?.결과)) process.exitCode = 1;
      } catch (error) { r.올리기 = `게시 주소 기록 올리기 실패(작업본에 남음 — 다음 올리기에 같이): ${error.message}`; process.exitCode = 1; }
    }
    if (o.json) { console.log(JSON.stringify(r, null, 2)); return; }
    console.log(`게시가 끝난 작업실 판 ${r.고침.length}개${run ? ' 게시결과에 적음' : '(미리 보기)'}${r.막힘.length ? ` · 막힌 곳 ${r.막힘.length}` : ''}${r.중복.length ? ` · 중복 정리 필요 ${r.중복.length}` : ''}`);
    for (const x of r.고침) console.log(`  ${x.편} · ${x.계정} · ${x.주소}`);
    for (const x of r.막힘) console.log(`  ! ${x.편}: ${x.까닭}`);
    for (const x of r.중복) console.log(`  ~ ${x.편}: ${x.까닭}`);
    if (r.올리기) console.log('  ' + r.올리기);
    return;
  }
  if (명령 === '상태' && argv.includes('--캐시')) {
    const cached = cachedJobs();
    if (!cached) { console.log('예약큐 서버 캐시가 없다 — 정기 작업 「SYNK 예약큐」가 아직 안 돌았다'); process.exitCode = 1; return; }
    const target = sharedBundle(o.rest[1], '상태 확인');
    const r = await status(target, null, { save: !o.noSave, jobs: cached.jobs });
    if (!r) { 기록없음(target); return; }
    for (const row of r.rows) console.log(`  ${row.계정} · ${row.상태} · ${kst(row.시각)}${row.주소 ? ` · ${row.주소}` : ''}`);
    for (const why of r.막힘 || []) console.log(`  ! ${why}`);
    if (r.막힘?.length) process.exitCode = 1;
    if (!o.noSave) await 운영사본기록올리기(target, ['게시결과.json'], `chore(작업실 예약): ${target.name} 상태 맞춤`);
    return;
  }
  // 명령도 편 폴더도 아니면 자격을 읽기 전에 멈춘다 — 그대로 가면 「자격이 없습니다」로 보여 까닭을 가렸다.
  if (!o.queue && o.rest[0] && !['상태', '취소'].includes(명령) && !fs.existsSync(o.rest[0])) {
    throw Object.assign(new Error(`모르는 명령이거나 없는 편 폴더다: ${JSON.stringify(o.rest[0])} (${코드포인트(o.rest[0])}) — 자격은 \`node tools/작업실예약.js credential\``), { code: 'USAGE' });
  }
  // 등록할 편이 없는 회차는 자격·서버를 읽지 않는다. 이미 등록했으나 못 보낸 검토 링크는 그대로 이어 보낸다.
  const queueDirs = o.queue && !['상태', '취소'].includes(명령)
    ? queueFolders(묶음.repoOf(process.cwd())) : null;
  // 이미 전송 요청돼 보관된 실패 알림은 검토 링크 알림 설정과 관계없이 이어 보낸다.
  if (queueDirs && o.run) {
    try { await resendFailureNotices(); }
    catch (error) { console.error(`  ! ${error.message}`); process.exitCode = 1; }
  }
  if (queueDirs && !queueDirs.length) {
    if (o.run && o.telegram) await resendPending();
    console.log('등록할 편이 없다');
    return;
  }
  const target = ['상태', '취소'].includes(명령) ? sharedBundle(o.rest[1], 명령 === '상태' ? '상태 확인' : '취소') : null;
  const ws = await connect({ origin: o.origin });
  if (명령 === '상태') {
    const r = await status(target, ws, { save: !o.noSave });
    if (!r) { 기록없음(target); return; }
    for (const row of r.rows) console.log(`  ${row.계정} · ${row.상태} · ${kst(row.시각)}${row.주소 ? ` · ${row.주소}` : ''}`);
    if (!o.noSave) await 운영사본기록올리기(target, ['게시결과.json'], `chore(작업실 예약): ${target.name} 상태 맞춤`);
    return;
  }
  if (명령 === '취소') {
    const r = await cancel(target, ws);
    if (!r) { 기록없음(target); return; }
    console.log(`  작업실 원고 ${r.postId}의 예약과 검토 링크를 거뒀다 — 고친 뒤 다시 등록한다`);
    await 운영사본기록올리기(target, ['작업실.json', `작업실_취소_${r.at.replace(/[:.]/g, '')}.json`, '작업실_자동등록중지.json', '게시결과.json'], `chore(작업실 예약): ${target.name} 등록 거둠`);
    return;
  }
  // 지난 회차에 등록은 됐는데 텔레그램을 못 보낸 링크부터 다시 보낸다.
  if (o.queue && o.run && o.telegram) await resendPending();
  const dirs = o.queue ? queueFolders(묶음.repoOf(process.cwd())) : o.rest.slice(0, 1);
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

module.exports = { Workspace, connect, planBundle, register, handleOne, status, cancel, matchChannel, checkedFile, readyFolders, queueFolders, 다른자리등록, sharedBundle, cachedJobs, sendLink, resendPending, notifyFailureOnce, resendFailureNotices, clearFailureNotice, checkFailureTelegram: () => 텔레그램한번.check(TELEGRAM), companions, 명령이름, STATUS, LOCAL_DIR, FAILURE_DIR, mergeResults, jobOf, publishedPlan, applyPublished, fillPublished, 게시주소쓰기자리 };
