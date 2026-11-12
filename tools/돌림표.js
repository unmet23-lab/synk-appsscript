#!/usr/bin/env node
'use strict';
/* LAB 돌림표(2026-11-10 LAB 하루 두 편 · 39계정 — 설계 1 · 2 · 3 · 4 · 21 · 22, docs/마케팅/LAB_하루두편_설계_20261110/README.md).
 *
 *   node tools/돌림표.js [--부터 YYYY-MM-DD] [--일수 5] [--json] [--준비무시] [--예비씀] [--다시 | --다시모두] [--쓰기]
 *       계정마다(현지 날짜 · 칸) 어느 원본의 어느 판본이 나갈지 셈해 보인다. --쓰기면 빈 칸의 판을 그 원본 편 게시/준비.json 「판」에
 *       더한다(판에 「돌림」: true). 이미 있는 판(예약 · 게시 · 만든 사람이 단 판 · 안 건 돌림 판)은 그대로 둔다. --다시면 아직 안 건 돌림 판 가운데
 *       지난 판 · 무효 판만 빼고 다시 셈한다(11-12 P2-모2 — staleWhy: 판 시각이 지났다 · 그 계정 · 칸이 닫혔다 · 판본 검수가 안 서 있다 ·
 *       판 영상 · 파일이 판본과 다르다 · 그 칸을 다른 편이 표에 잡았다 · 같은 칸에 다른 편의 나가는 판이 있다 — --장부의 「같은 칸 두 번」).
 *       시각이 남은 유효한 안 건 판은 제자리에 둔다 — 지난 판 하나 때문에 돌린
 *       --다시가 남은 판까지 지우고 내일부터 다시 짜서 하루~사흘씩 밀던 것(11-12 뉴질랜드 판 하나에 캐나다 · 미국 하루, 호주 사흘).
 *       --다시모두는 예전 --다시다(안 건 돌림 판을 모두 빼고 다시 셈 — 원장의 칸 · 셈 규칙을 바꾼 뒤 통째로 다시 짤 때). 셈 규칙은 tools/lib/돌림.js 머리말.
 *   node tools/돌림표.js --장부 [--부터 …] [--일수 …] [--json]
 *       게시 장부 — LAB 판 전부를 계정 · 현지 날짜 · 칸 · 원본 · 판본 지문 · 상태 · 게시물 ID로 한 표에(같은 칸이 두 번 걸렸는지도).
 *   node tools/돌림표.js --묶음 [--부터 …] [--일수 …] [--json]
 *       같은 언어 묶음표(같은 플랫폼에서 같은 말로 올리는 계정들 — 돌림 ⑥)와 겹침 확인: 이미 있는 판 + 이번 셈에서 같은 원본이 24시간 안에
 *       두 계정에 가거나 같은 파일이 두 계정에 가는 짝, 나라별판이 같은 파일인 원본, 같은 판본 키를 둘이 쓰는 묶음. 하나라도 있으면 종료 1.
 *   node tools/돌림표.js --점검 [--json]   비상 정지 점검(14시 회차가 걸기 전) — 씨앗이 사흘 안에 올린 원본(과 사흘이 지났어도 안 나간 돌림 판이 남았거나 이번 셈 — 같은 범위의 --쓰기 — 에서 판을 받을 원본)의 씨앗 24시간 평소 대비 배수, 숫자가 있는 씨앗의 과반이 0.3배 밑이면 「급락」(종료 1) · 숫자를 볼 씨앗이 없으면 「판정 불가」
 *   node tools/돌림표.js --멈춤 <편 폴더 이름> --까닭 "<까닭>"
 *       비상 정지(설계 3) — 그 원본의 준비.json 「돌림」.멈춤을 적고 아직 안 건 돌림 판을 뺀다. 이미 예약된 판은 목록으로 보인다
 *       (공개 전 예약을 다른 매일 판 편으로 바꿔 거는 것은 상시 승인 안, 공개된 글을 지우거나 비공개로 돌리는 것은 여쭌다).
 *   공통: --폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅>(시험용) · --지금 <ISO>(시험용)
 *
 * 원본 편의 준비.json 「돌림」:
 *   {"형식": "이야기"|"노래"|"퀴즈"(21:00 칸은 11-10 밤부터 노래 — 퀴즈는 예비 형식), "쓸날": "YYYY-MM-DD"(그날부터 · 동결 뒤 — 설계 20.
 *    노래 원본은 쓸날 = 21:00 노래 칸을 여는 날이 있어야 판을 받는다 — 없으면 셈에서 빼고 모든 명령의 맨 위에 「! 쓸날 없는 노래 원본 N」으로 알린다,
 *    11-12: 셈 전체를 멈추던 것), "멈춤": null|{"날","까닭"}, "예비": false,
 *    "연재"?: {"이름": "<연재 이름>", "차례": <숫자>}(차례 고정 — 한 계정은 그 연재의 앞 차례를 받은 뒤에만 다음 차례를 받는다. 돌림 ⑦ —
 *    한글 노래 여섯 곡처럼 앞 곡의 글자를 안다고 보고 만든 것. 앞 차례의 그 계정 판본이 검수 전이면 건너뛰지 않고 기다린다),
 *    "이미받음"?: ["<계정>" | {"계정": "<계정>", "때": "<ISO 시각>"}…](그 원본을 편 폴더 기록 없이 다른 길로 이미 올린 계정 — 다시 받지 않는다.
 *    「때」를 적은 씨앗 계정은 씨앗 첫 판으로 센다. 원장에 없는 계정이면 셈을 멈춘다),
 *    "틀"?, "무대"?(⑯ 퀴즈 — 개그 무대), "같은이야기"?: ["<편 폴더 이름>"…](같은 이야기를 다른 폴더로 낸 편 — 그 편이 나간 계정은
 *    이 원본을 다시 받지 않는다. 11-10 지마: 영어 · 간체 · 버마어 판이 LAB_지마_20261102로 나갔다. 없는 이름이면 셈을 멈춘다),
 *    "판본": {"<판본 키>": {"언어", "파일", "표지"?, "글"(그 판본 글 정본 — 뜻 검사 지문),
 *    "원고": {"<플랫폼>": "<원고.json 또는 게시글 .txt>"}, "검수": {"뜻": {"결과": "통과", "지문"}, "글자": {"결과": "통과", "지문"}, …}}}}
 *   판본 키는 계정의 rotationVersion, 없으면 countryCode(나라마다 첫 2초 카드 · 끝 카드 · 썸네일 · 끝 질문이 다르다 — 설계 6).
 *   판본이 돌림에 드는 조건(설계 22): 파일이 있고, sns-계정.json labRotation.판본검수(기본 뜻 · 글자)가 모두 「통과」이며
 *   글자 검사의 지문 = 지금 영상 SHA-256, 뜻 검사의 지문 = 지금 「글」 파일 SHA-256 — 글을 고치면 뜻 검수가, 영상을 다시 렌더하면 글자
 *   검수가 저절로 무효가 된다. 11-11부터 둘을 더 본다(versionState): 판본 지도가 있는 편은 글.json이 원천(판본 글 · 지도 · 원고)과 같아야 하고
 *   (원고를 고치고 「node tools/판본글잇기.js 뽑기」를 안 돌린 판본은 빠진다 — 고친 글이 뜻 검수 통과를 달고 나가지 않게), 원고에 게시글
 *   「고칠 것」(상대 날짜 · 첫 125자 해시태그 · 유튜브 동영상 언어가 그 판 말이 아님 …)이나 빠진 원고 파일이 없어야 한다 — 원고 하나의
 *   고칠 것이 올리기 전 검사에서 그 원본 편 전체를 막기 때문에 그 판본만 뺀다(tools/lib/판본잇기.js 글낡음 · 원고고칠것).
 *   판본검수에 「현지어」를 넣으면(11-11 Fable 5.2 끝 판 검수 P2-4) 현지어 대조 기록(tools/현지어대조.js --판본 … --기록 — 지문 = 「글」 파일)도
 *   조건이 된다: 게시글 줄(제목 · 본문 · 고정 댓글)은 뜻 검사 시험지에 안 실려 현지어 대조만 본다. 넣기 전에는 올리기 전 검사 ⑩이 기록이
 *   없거나 낡은 판본을 확인할 것(rotation-local)으로 보인다(localCheckState).
 * 계정(sns-계정.json): LAB이고 dailyLine · dailyFormats가 있는 계정. rotationSeed는 씨앗(먼저 올림). 씨앗이 아닌 계정은
 * publicProfileComplete가 true이고 postRouteVerified가 true여야 칸을 받는다(설계 4 · 5). postRouteVerified 「첫판」은 첫 판 시험 —
 * 판 하나만 받고, 그 판을 플랫폼 예약 목록에서 확인해 true로 바꾸면 나머지 칸이 열린다. dailyFrom 「미정」은 아직 안 연 계정(칸 없음),
 * dailyTimesFrom 「미정」은 마지막 칸만 연 계정, dailyFormatsFrom {"노래": "미정"}은 그 형식 칸을 닫아 둔 계정(나라별 계정은 이야기 칸부터
 * 연다). --준비무시는 준비 · 「미정」을 풀고 셈만 해 본다(--쓰기와 함께 못 쓴다).
 * 걸린 판(예약됨 · 게시됨 · 거는 중 · 작업실 승인 대기 — 다른 작업본이 게시 장부 표에 잡은 것까지)은 --다시 · --멈춤에도 지우지 않는다.
 * 같은 언어 묶음은 계정의 languageGroup, 없으면 language다(같은 플랫폼 안에서만 묶는다). 나라 칸(countryCode)은 그 계정이 겨누는 나라 하나 —
 * 나라를 겨누지 않는 계정(@synkkorean — 전 세계 · 영어)은 countryCode를 비우고 rotationVersion · audience를 적는다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('./lib/계정시간.js');
const 돌림 = require('./lib/돌림.js');
const 장부 = require('./게시장부.js');
const 잇기 = require('./lib/판본잇기.js');
const { 미디어경로 } = require('./lib/공용작업본.js');

const REPO = path.resolve(__dirname, '..');
const argValue = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const has = (name) => process.argv.includes(name);
const ROOT = argValue('--폴더') ? path.resolve(argValue('--폴더')) : path.join(REPO, 'docs', '마케팅');
const DONE = new Set(['예약됨', '게시됨']);
const GONE = new Set(['보류', '취소됨', '지움']);
const CACHE_DIR = process.env.SYNK_ROTATION_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '돌림표');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

// 다 쓰고 바꿔 넣는다 — 쓰다 실패해 빈 파일이 남지 않게(현장 노트 git 「공용 문서를 쓰다 실패하면 빈 파일이 남는다」).
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// 영상 SHA-256 — 경로 · 크기 · 수정 시각이 같으면 지난 값을 쓴다(판본이 수십 개라 매번 다 읽지 않게).
let shaCache = null;
function sha256(file) {
  const st = fs.statSync(file);
  const key = `${path.resolve(file)}|${st.size}|${st.mtimeMs}`;
  if (!shaCache) shaCache = readJson(path.join(CACHE_DIR, '지문.json')) || {};
  if (!shaCache[key]) {
    shaCache[key] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    shaCache.__dirty = true;
  }
  return shaCache[key];
}
function saveShaCache() {
  if (!shaCache?.__dirty) return;
  delete shaCache.__dirty;
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); writeJson(path.join(CACHE_DIR, '지문.json'), shaCache); } catch { /* 캐시는 없어도 된다 */ }
}

// 편 폴더 기준 경로 — 이 작업본에 없으면 공용 작업본의 같은 경로(워크트리에는 git 밖 판본 영상이 없다 — 미디어경로)
const resolveIn = (dir, p) => (p ? 미디어경로(path.isAbsolute(p) ? p : path.join(dir, p)) : null);
const relIn = (dir, file) => path.relative(dir, file).split(path.sep).join('/');

// 원장의 칸 · 여는 날 꼴(11-11 Fable 5.2 끝 판 검수 P2-13) — 여는 날 · 형식 열쇠는 글자 그대로 견주므로 꼴이 틀리면(「2026-11-3」 · 열쇠 「노래 」)
// 종료 0으로 조용히 칸이 닫히거나 열린다. 틀린 원장으로는 셈하지 않는다(tools/lib/계정시간.js checkLedger).
function checkLedgerShape(accounts) {
  const problems = T.checkLedger(accounts);
  if (problems.length) throw new Error(`계정 원장(sns-계정.json)의 칸 · 여는 날 꼴이 틀렸다 — 고친 뒤 다시 돌린다:\n  - ${problems.join('\n  - ')}`);
}

function loadLedger() {
  const ledger = readJson(path.join(ROOT, 'sns-계정.json')) || {};
  return { ledger, accounts: ledger.accounts || {}, cfg: ledger.labRotation || {} };
}

// 돌림 계정 — LAB · dailyLine · dailyFormats. 씨앗이 아니면 프로필 · 경로가 준비돼야 칸을 받는다. postRouteVerified 「첫판」은 첫 판 시험(판 하나만).
// notReady는 칸을 못 받는 계정과 까닭(시작 날 「미정」까지), closedStory는 dailyTimesFrom 「미정」이라 앞 칸이 닫힌 계정.
// ignoreReady(--준비무시)는 준비 · 「미정」을 풀고 셈만 해 본다 — 까닭은 원장 값 그대로 적는다.
function rotationAccounts(accounts, { ignoreReady = false } = {}) {
  const out = {};
  const notReady = [];
  const closedStory = [];
  const open = (v) => (ignoreReady && v === T.PENDING ? undefined : v);
  for (const [key, a] of Object.entries(accounts)) {
    if (a.brand !== 'LAB' || !a.dailyLine || !Array.isArray(a.dailyFormats)) continue;
    const trial = !a.rotationSeed && a.postRouteVerified === 장부.TRIAL;
    const why = [];
    if (a.dailyBlocked) why.push(`막힘 — ${a.dailyBlocked}`);
    if (!a.rotationSeed) {
      if (a.publicProfileComplete !== true) why.push('프로필 빈 칸(publicProfileComplete)');
      if (a.postRouteVerified !== true && !trial) why.push(`예약 경로 확인 전(${a.postRoute || '경로 없음'})`);
    }
    const blocked = why.length && !(ignoreReady && !a.dailyBlocked) ? why.join(' · ') : null;
    if (T.notStarted(a)) why.push('시작 날 미정(dailyFrom)');
    if (why.length) notReady.push({ account: key, why });
    else {
      const label = (s) => `${s.time} ${s.format || ''}`.trim();
      const closed = a.dailyTimesFrom === T.PENDING ? T.allSlots(a).slice(0, -1).map(label) : [];
      for (const s of T.allSlots(a)) if (s.format && a.dailyFormatsFrom?.[s.format] === T.PENDING && !closed.includes(label(s))) closed.push(label(s));
      if (closed.length) closedStory.push({ account: key, closed });
    }
    out[key] = { platform: a.platform, language: a.language || null, group: a.languageGroup || a.language || null, versionKey: a.rotationVersion || a.countryCode || null,
      timeZone: a.timeZone, dailyTimes: a.dailyTimes, dailyFormats: a.dailyFormats, dailyFrom: open(a.dailyFrom), dailyTimesFrom: open(a.dailyTimesFrom),
      dailyFormatsFrom: a.dailyFormatsFrom && typeof a.dailyFormatsFrom === 'object' ? Object.fromEntries(Object.entries(a.dailyFormatsFrom).map(([f, v]) => [f, open(v)])) : undefined,
      seed: Boolean(a.rotationSeed), trial: trial && !ignoreReady, blocked };
  }
  return { rotation: out, notReady, closedStory };
}

// 판본이 돌림에 드는지(설계 22) — 파일 · 검수 결과 · 지문. 검수가 다 맞은 뒤에 둘을 더 본다(11-11 Fable 검수):
//  · key(판본 키)를 주면, 판본 지도가 있는 편의 글.json이 원천(판본 글 · 지도 · 원고)과 같은가 — 원고를 고치고 「뽑기」를 안 돌리면 글.json
//    지문이 그대로라 고친 글이 뜻 검수 「통과」를 달고 나간다. accounts(원장 계정들)는 글.json 「나라」 칸을 같은 원장으로 뽑으려고 받는다.
//  · 원고의 게시글 「고칠 것」(상대 날짜 · 첫 125자 …) — 원고 하나의 고칠 것이 올리기 전 검사에서 그 원본 편 전체(다른 계정 판까지)를 막으니
//    그 판본만 돌림에서 뺀다.
//  · key를 주면, 판본 지도가 있는 편의 영상이 지금 원천으로 구운 것인가(렌더.json — 글 · 영상 · 자산 지문). 아래 본문.
// 「글」 파일 지문으로 묶는 검수 — 글을 고치면 저절로 무효가 된다. 나머지(글자 …)는 영상 지문으로 묶는다.
const 글지문검수 = new Set(['뜻', '현지어']);

// 판본의 현지어 대조 기록 상태(11-11 P2-4) — 판본검수에 「현지어」가 아직 없는 동안 올리기 전 검사 ⑩이 확인할 것으로 보이는 데 쓴다.
function localCheckState(dir, v) {
  const r = v?.검수?.현지어;
  if (!r) return { ok: false, why: '현지어 대조 기록이 없다' };
  if (r.결과 !== '통과') return { ok: false, why: `현지어 대조 「${r.결과 || '결과 없음'}」` };
  const text = resolveIn(dir, v.글);
  if (!text || !fs.existsSync(text)) return { ok: false, why: '현지어 대조한 글 파일이 없다(판본 「글」)' };
  if (r.지문 !== sha256(text)) return { ok: false, why: '현지어 대조 뒤 글이 바뀌었다' };
  return { ok: true, why: null, 판정줄: Array.isArray(r.판정줄) ? r.판정줄 : [] };
}

// 이미 걸린(공개 전) 돌림 판의 판본이 걸린 뒤 무효가 됐거나 다시 구워졌는가(11-11 — 시험관 넷으로 다시 받은 뜻 검사에서 걸린 판 셋이 떨어졌는데
// 아무 도구도 알리지 않았다: 올리기 전 검사 ⑩의 고칠 것은 다 걸린 편이라 예약큐가 안 보고, 걸기의 지문 대조는 걸 때 한 번뿐이다).
// 그대로 두면 검수 안 된 영상이 예약대로 공개된다. row = 그 계정의 게시결과 줄(「지문」 = 걸 때의 판 영상 SHA-256).
// → null(문제 없음 · 판본을 모름) 또는 { key, why, changed(걸린 영상이 지금 판본 영상과 다름), text?(걸린 뒤 게시글이 바뀜) }. 예약큐 경고 · 올리기 전 검사 ⑩이 쓴다.
// 게시글(11-11 밤 Fable 5.2 다시 검수 P1-팔1): 걸린 뒤 제목 · 본문 · 댓글만 고치고 뜻 검사를 다시 통과하면 판본 상태는 「든다」로 돌아오고 영상 지문도
// 그대로라 위 둘이 다 조용한데, 플랫폼 예약에는 떨어졌던 옛 글이 걸려 있다. 걸 때 줄에 적은 「게시글지문」(tools/게시장부.js postTextSha)과 지금 글을 견준다.
function bookedVersionProblem(dir, prep, plate, row, { required = ['뜻', '글자'], accounts = null } = {}) {
  if (!plate || !plate.돌림 || !row) return null;
  const a = accounts?.[plate.계정];
  const key = a ? a.rotationVersion || a.countryCode : null;
  const v = key ? prep?.돌림?.판본?.[key] : null;
  if (!v) return null;
  const st = versionState(dir, v, required, key, { accounts });
  const changed = Boolean(row.지문 && st.sha && row.지문 !== st.sha);
  // 판본 상태를 못 읽은 것(unreadable — 깨진 파일)은 「걸린 뒤 바뀜」이 아니다(11-12 P1-지1): 걸린 영상이 달라진 것이 보이면(changed) 그쪽이 먼저다
  if (!st.ready) return { key, why: st.why, changed, ...(st.unreadable && !changed ? { unreadable: true, file: null } : {}) };
  if (changed) return { key, why: '건 뒤에 판본 영상을 다시 구웠다(걸린 영상은 옛 판)', changed };
  const text = bookedTextProblem(dir, plate, row);
  if (text) return { key, why: text.why, changed: false, text: true, ...(text.unreadable ? { unreadable: true, file: text.file } : {}) };
  return null;
}

// 걸린 판의 게시글이 걸 때와 다른가 → null(같음 · 걸 때 지문을 안 적은 옛 줄) 또는 { why, unreadable?, file? }.
// 「바뀜」과 「못 읽음」은 다른 일이다(11-12 P1-지1): 바뀜은 예약에 옛 글이 걸려 있다는 뜻(공개 전에 내린다), 못 읽음(unreadable — file = 못 읽은 파일)은
// 견줄 수 없다는 뜻이다 — 조용히 넘기지 않되 「내려라」로 알리지 않는다(예약큐 · 올리기 전 검사 ⑩이 다른 줄 · 다른 코드로 보인다). 읽는 것은 그 계정 판의 글뿐이다.
function bookedTextProblem(dir, plate, row) {
  if (!row || !row.게시글지문) return null;
  let now;
  try { now = 장부.postTextSha(dir, plate.계정); } catch (e) {
    const file = e && e.file ? e.file : null;
    return { unreadable: true, file, why: `건 뒤의 게시글을 읽지 못해 걸 때 글과 견줄 수 없다(${String(e.message).split('\n')[0].slice(0, 200)})` };
  }
  return now === row.게시글지문 ? null : { why: '건 뒤에 게시글(제목 · 본문 · 댓글)을 고쳤다(예약에는 옛 글이 걸려 있다)' };
}

// 편 폴더들의 뜻 검사 기록(시험관 수 확인용) — 판본마다 다시 읽지 않게 뿌리(docs/마케팅)별로 잠깐 들고 있는다. 준비.json들의 크기 · 고친 때가
// 바뀌면 다시 읽고, 그 확인도 1초에 한 번만 한다(예약큐 · 돌림 셈이 한 번에 판본 수십 개를 본다).
const 뜻기록곳간 = new Map();
function 뜻기록들(뿌리) {
  const 뜻검사 = require('./뜻검사.js');
  const now = Date.now();
  const hit = 뜻기록곳간.get(뿌리);
  if (hit && now - hit.at < 1000) return hit.기록;
  let sig = '';
  try {
    for (const d of fs.readdirSync(뿌리, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      try { const s = fs.statSync(path.join(뿌리, d.name, '게시', '준비.json')); sig += `${d.name}:${s.size}:${s.mtimeMs};`; } catch { /* 준비.json 없는 폴더 */ }
    }
  } catch { /* 뿌리를 못 읽으면 기록 없음 */ }
  if (hit && hit.sig === sig) { hit.at = now; return hit.기록; }
  const 기록 = 뜻검사.지난기록(뿌리);
  뜻기록곳간.set(뿌리, { at: now, sig, 기록 });
  return 기록;
}
/** 들고 있던 뜻 검사 기록을 버린다(시험 — 같은 프로세스에서 준비.json을 고치고 곧바로 다시 볼 때) */
function 뜻기록비우기() { 뜻기록곳간.clear(); }

// 뜻기록(지난 뜻 검사 기록 배열)을 주면 편 폴더들을 읽지 않고 그것으로 시험관 수를 본다 — 안 주면 dir의 윗 폴더(docs/마케팅)에서 읽는다.
function versionState(dir, v, required, key = null, { accounts = null, 뜻기록 = null } = {}) {
  if (!v) return { ready: false, why: '판본 없음' };
  const file = resolveIn(dir, v.파일);
  if (!file || !fs.existsSync(file)) return { ready: false, why: `영상 없음(${v.파일 || '파일 칸 없음'})` };
  const sha = sha256(file);
  for (const name of required) {
    const r = v.검수?.[name];
    if (!r || r.결과 !== '통과') return { ready: false, why: `${name} 검수 ${r?.결과 || '전'}`, sha };
    if (글지문검수.has(name)) {
      const text = resolveIn(dir, v.글);
      if (!text || !fs.existsSync(text)) return { ready: false, why: `${name} 검수할 글 파일 없음(판본 「글」)`, sha };
      if (r.지문 !== sha256(text)) return { ready: false, why: `${name} 검수 뒤 글이 바뀜`, sha };
    } else if (r.지문 !== sha) return { ready: false, why: `${name} 검수 뒤 영상이 바뀜`, sha };
  }
  // 뜻 검사를 넷이어야 할 때 넷보다 적은 시험관으로 통과한 판본은 돌림에 못 든다(11-11 Fable 5.2 다시 검수 P1-넷1). 올리기 전 검사 ⑩이 「확인할 것」
  // (rotation-examiners)으로만 보이던 동안, 14시 회차가 그렇게 통과한 여섯 판을 걸었고 셋이 넷 시험에서 떨어져 공개 전에 내렸다(11-11).
  // 넷이어야 했는지는 그 기록을 받은 때의 셈으로 본다(tools/뜻검사.js 시험관모자람 — 뒤에 다른 편이 통과해도 저절로 넉넉해지지 않는다).
  if (key && required.includes('뜻')) {
    let lack = null;
    try {
      const 편 = path.basename(dir);
      const 기록 = Array.isArray(뜻기록) ? 뜻기록 : 뜻기록들(path.dirname(dir));
      const 자기 = 기록.find((r) => r.편 === 편 && r.판본 === key);
      lack = require('./뜻검사.js').시험관모자람(v.검수.뜻, { 언어: v.언어, 틀: 자기?.틀 || null, 편, 판본: key, 기록 });
    } catch (e) {
      return { ready: false, unreadable: true, why: `뜻 검수 시험관 수를 확인하지 못함(${String(e.message).split('\n')[0].slice(0, 120)})`, sha };
    }
    if (lack) return { ready: false, why: `뜻 검수 시험관 ${lack.수}명(${lack.시험관.join(' · ')})으로 통과 — 넷이어야 한다(${lack.까닭.join(' · ')}). node tools/뜻검사.js 판본 <편 폴더> ${key}로 넷에게 다시 받는다`, sha };
  }
  if (key) {
    // 판본 지도가 있는 편인데 준비.json 판본의 「글」이 지도가 뽑는 글.json이 아니면 아래 두 관문(글 낡음 · 렌더 낡음)이 이 판본을 볼 수 없다 — 닫는다
    // (11-11 밤 Fable 5.2 다시 검수 P1-렌1: 「볼 것 없음」으로 넘겨, 판본렌더.mjs가 렌더.json에 적어 주던 꼴을 옮겨 적으면 두 관문이 꺼졌다)
    let link;
    try { link = 잇기.이음문제(dir, key, v); } catch (e) {
      return { ready: false, unreadable: true, why: `판본 지도를 못 읽음(${String(e.message).split('\n')[0].slice(0, 120)})`, sha };
    }
    if (link) return { ready: false, why: link, sha };
    let stale;
    try { stale = 잇기.글낡음(dir, key, v, accounts ? { 원장: { accounts } } : {}); } catch (e) {
      return { ready: false, unreadable: true, why: `판본 글을 뽑지 못함(${String(e.message).split('\n')[0].slice(0, 120)})`, sha };
    }
    if (stale) return { ready: false, why: '원고 · 판본 글을 고친 뒤 글.json을 다시 뽑지 않음(node tools/판본글잇기.js 뽑기 → 뜻 검사 다시)', sha };
    // 영상이 지금 원천(판본 글 · 원본 그림 · 소리 · 틀)으로 구운 것인가(11-11 Fable 5.2 끝 판 검수 P1-3) — 렌더 기록(렌더.json)의 글 · 영상 · 자산
    // 지문을 지금 것과 견준다. 화면 글을 고치고 뜻 검사만 다시 받은 판본(옛 글 영상), 원본 그림을 고친 뒤 다시 굽지 않은 판본(옛 그림 영상 —
    // 11-10 「지마」 일곱 판본)은 글자 검수 지문이 그대로여도 돌림에 못 든다. 렌더 기록이 없어도 못 든다.
    let render;
    try { render = 잇기.렌더낡음(dir, key, v, { 영상지문: sha }); } catch (e) {
      return { ready: false, unreadable: true, why: `렌더 기록을 못 읽음(${String(e.message).split('\n')[0].slice(0, 120)})`, sha };
    }
    if (render) return { ready: false, why: render, sha };
  }
  const fixes = 잇기.원고고칠것(dir, v);
  // 원고를 못 읽는 것뿐이면(깨진 JSON · 병합 충돌 표식) 「못 읽음」이다 — 판본이 돌림에 못 드는 것은 같지만, 걸린 판의 알림은 「바뀜」과 가른다(unreadable)
  if (fixes.length) return { ready: false, ...(fixes.every((x) => /원고를 못 읽는다/.test(x)) ? { unreadable: true } : {}), why: `원고 고칠 것 — ${fixes[0]}${fixes.length > 1 ? ` 밖 ${fixes.length - 1}` : ''}`, sha };
  return { ready: true, sha, file };
}

// 편 폴더 전부 — LAB 편의 판(있는 칸) · 돌림 원본.
function loadPieces(accounts, cfg) {
  const required = Array.isArray(cfg.판본검수) && cfg.판본검수.length ? cfg.판본검수 : ['뜻', '글자'];
  const pieces = [];
  for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const dir = path.join(ROOT, d.name);
    const prep = readJson(path.join(dir, '게시', '준비.json'));
    if (!prep || prep.브랜드 !== 'LAB') continue;
    const result = readJson(path.join(dir, '게시', '게시결과.json')) || {};
    // 한 편은 한 계정에 한 번만 나가니(돌림 ③) 게시결과는 계정으로 맞춘다 — 게시결과 「시각」은 실제로 나간 때라 판 시각과 다를 수 있다.
    // 한 계정에 줄이 여럿이면(작업실 길은 다시 걸 때마다 줄을 더한다 — 취소됨 · 취소됨 · 예약됨) 뒤에서부터 읽어 걸려 있는 줄이나 거둔 줄
    // (보류 · 지움)을 먼저 만나면 그 줄, 없으면 마지막 줄(게시 장부 rowOf) — 거둔 예약(예약됨 → 보류)은 나가지 않는 판이다.
    const stateOf = (plate) => 장부.rowOf(result.판, plate.계정);
    const original = prep.돌림 && 돌림.FORMATS.includes(prep.돌림.형식) ? prep.돌림 : null;
    // 버린 편은 꼴 검사 · 판본 상태를 보지 않는다 — 원장에서 빠진 계정이 버린 편의 이미받음에 남아 있어도 돌림표 전체가 죽지 않게(11-11 Fable 검수)
    const dead = /^버림/.test(String(prep.상태 || ''));
    if (original && !dead) checkOriginal(d.name, original, accounts);
    // 쓸날 없는 노래 원본은 셈에서 뺀다(waiting — originalsOf가 거른다: 판을 받지 않는다). 11-12: 던져서 돌림표의 모든 명령을 세우던 것 —
    // 여는 날이 아직 미정인 노래 원본(만드는 중 · 검수 중) 하나가 그날 나라별 돌림 전체를 세웠다. main이 맨 위에 알린다(waitingLine).
    // 11-12 저녁: 셈에서 빼지 않고 먼 날짜(WAIT_DAY)로 넘긴다 — 빼면 연재의 그 차례가 「없는 차례」가 되어 다음 차례가 먼저 달린다(originalsOf).
    // 빈 문자열 · 「미정」도 기다림이다(원장이 dailyFrom에 쓰는 글자 — 노래 원본이 아니어도 「미정」은 기다린다).
    const waiting = !original || dead ? null
      : original.쓸날 === READY_PENDING ? (original.형식 === '노래' ? '노래 원본에 「돌림」.쓸날이 없다' : '「돌림」.쓸날이 「미정」이다')
        : original.형식 === '노래' && !original.쓸날 ? '노래 원본에 「돌림」.쓸날이 없다' : null;
    const versions = {};
    if (original && !dead) for (const [k, v] of Object.entries(original.판본 || {})) versions[k] = versionState(dir, v, required, k, { accounts });
    pieces.push({ name: d.name, dir, prep, result, stateOf, original, versions, dead, waiting });
  }
  return pieces;
}

// 「돌림」.연재 · 이미받음 · 쓸날의 꼴 — 틀리면 조용히 넘기지 않는다(이름 하나 틀리면 차례가 풀리거나 이미 올린 계정에 또 나간다).
function checkOriginal(name, original, accounts) {
  // 쓸날 — 날짜 꼴이 아니면 「그날부터」 셈(글자 비교)이 틀어진다. 노래 원본은 쓸날이 있어야 판을 받는다: 씨앗 계정의 21:00 칸은 닫혀 있지 않아,
  // 쓸날 없는 노래 원본을 그대로 셈에 넣으면 --쓰기가 씨앗의 빈 21:00 칸(D+4 · D+5)에 바로 달고, 그 뒤 07 · 15시 제작 회차가 그날 줄 편을 만들면
  // 같은 칸에 두 번 걸린다(11-11 Fable 검수 — 제작 절차 「LAB 하루 두 편」 10 ⑤: 쓸날 = 21:00 노래 칸을 여는 날). 그런 원본은 여기서 던지지 않고
  // loadPieces가 「기다림」으로 적어 셈에서 뺀다(11-12 — 던지면 만들던 노래 원본 하나가 돌림표의 모든 명령을 세운다).
  // 빈 문자열 · 「미정」은 「아직 안 정함」이다(11-12 저녁 — 던지면 돌림표가 다시 선다): 꼴 검사에서 빼고 loadPieces가 기다림으로 본다. 틀린 날짜는 계속 던진다.
  const day = original.쓸날;
  const valid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === String(d);
  if (day !== undefined && day !== null && day !== '' && day !== READY_PENDING && !(() => { try { return valid(day); } catch { return false; } })()) {
    throw new Error(`${name}: 「돌림」.쓸날은 YYYY-MM-DD 꼴이다(${day})`);
  }
  const s = original.연재;
  if (s !== undefined && s !== null && !(typeof s === 'object' && typeof s.이름 === 'string' && s.이름.trim() && Number.isFinite(s.차례))) {
    throw new Error(`${name}: 「돌림」.연재는 {"이름": "<연재 이름>", "차례": <숫자>} 꼴이다`);
  }
  if (original.이미받음 !== undefined && !Array.isArray(original.이미받음)) throw new Error(`${name}: 「돌림」.이미받음은 계정 목록(배열)이다`);
  for (const x of original.이미받음 || []) {
    const key = typeof x === 'string' ? x : x && x.계정;
    if (!key || !accounts[key]) throw new Error(`${name}: 「돌림」.이미받음의 계정 「${key}」가 계정 원장에 없다 — 이름을 고친다(조용히 넘기면 이미 올린 계정에 또 나간다)`);
    if (x && typeof x === 'object' && x.때 !== undefined && !Number.isFinite(Date.parse(x.때))) throw new Error(`${name}: 「돌림」.이미받음 ${key}의 「때」는 ISO 시각이다(${x.때})`);
  }
}

// 기다리는 원본(쓸날 없는 노래 원본 · 쓸날 「미정」)은 빼지 않고 쓸날을 먼 날짜로 넘긴다(11-12 다시 검수 3 — 갈래 I): 어느 칸도 그 날짜에 못 미쳐 판을 받지 않고
// (--준비무시 · --다시모두 · --예비씀도 쓸날은 풀지 않는다), 연재 차례표에는 남아 뒤 차례가 그 차례를 건너뛰지 않는다. 빼던 동안에는 1번째만 쓸날이 비면
// 2번째가 먼저 달리고 뒤에 1번째에 쓸날을 적으면 2 → 3 → 1이 됐다.
const WAIT_DAY = '9999-12-31';
const READY_PENDING = '미정';
function originalsOf(pieces) {
  return pieces.filter((p) => p.original && !p.dead).map((p) => ({
    id: p.name, format: p.original.형식, stopped: Boolean(p.original.멈춤), spare: Boolean(p.original.예비),
    readyFrom: p.waiting ? WAIT_DAY : p.original.쓸날 || null, ...(p.waiting ? { waiting: true } : {}), versions: p.versions,
    series: p.original.연재 ? { id: p.original.연재.이름.trim(), order: p.original.연재.차례 } : null,
  }));
}

// 표에 적힌, 다른 작업본까지 걸려 있는 판 — `${편}|${계정}` → 상태, `${계정}|${현지 날짜}|${칸}` → 편
function holdsOf() {
  const byPlate = new Map();
  const byCell = new Map();
  for (const h of 장부.registryHolds(ROOT)) { byPlate.set(`${h.piece}|${h.account}`, h.state); byCell.set(h.key, h.piece); }
  return { byPlate, byCell };
}

// --다시가 빼는 안 건 돌림 판인가(11-12 P2-모2) — 지난 판 · 무효 판이면 까닭 글, 시각이 남은 유효한 판이면 null(제자리에 둔다).
// 유효 = 판 시각이 아직 안 지났고, 그 계정이 지금도 칸을 받는 돌림 계정이며 그 현지 날짜에 그 칸이 열려 있고, 그 계정 판본의 검수가 서 있고,
// 판의 파일 · 지문이 지금 판본과 같고, 그 칸을 다른 편이 게시 장부 표에 잡고 있지 않고, 같은 칸에 다른 편의 나가는 판(손으로 단 안 건 판 · 작업실 판처럼
// 표에 줄이 없는 것까지 — shared = cellOwners)이 없다. now가 없으면(--지금 없이 lib로 부름) 시각은 보지 않는다.
const slashed = (x) => String(x || '').split(String.fromCharCode(92)).join('/');
function staleWhy(piece, plate, { rotation = {}, now = null, cells = new Map(), shared = new Map() } = {}) {
  const at = Date.parse(plate.시각 || '');
  if (!Number.isFinite(at)) return '판 시각을 읽을 수 없다';
  if (Number.isFinite(now) && at <= now) return '판 시각이 지났다';
  if (!piece.original || piece.dead) return '돌림 원본이 아니다';
  if (piece.waiting) return piece.waiting;
  const a = rotation[plate.계정];
  if (!a || a.blocked) return `칸을 받는 돌림 계정이 아니다${a && a.blocked ? `(${a.blocked})` : '(준비 전 · 원장에 없음)'}`;
  const day = T.localDate(at, T.tzOf(a));
  const slot = T.slotFor(plate.시각, a);
  if (!T.slotsOn(a, day).some((x) => x.time === slot.time && x.format)) return `현지 ${day} ${slot.time} 칸이 닫혀 있다`;
  // 쓸날을 미룬 뒤 그 앞 날짜에 남은 판(11-12 — 걸기 · 올리기 전 검사 ⑩과 같은 셈: 게시 장부 readyDayWhy)
  const early = 장부.readyDayWhy(piece.prep, plate, a);
  if (early) return early;
  const v = piece.versions?.[a.versionKey];
  if (!v) return `판본 ${a.versionKey || '(키 없음)'}이 없다`;
  if (!v.ready) return `판본 ${a.versionKey}: ${v.why || '검수가 서 있지 않다'}`;
  const file = piece.original.판본?.[a.versionKey]?.파일;
  if (file && slashed(file) !== slashed(plate.파일)) return `판 파일이 판본 ${a.versionKey}의 파일과 다르다`;
  if (plate.지문 && v.sha && plate.지문 !== v.sha) return `판 영상이 바뀌었다(판본 ${a.versionKey} 지문 다름)`;
  const other = cells.get(`${plate.계정}|${day}|${slot.time}`);
  if (other && other !== piece.name) return `그 칸을 ${other}가 잡고 있다`;
  // 같은 칸 두 번 — 칸 표에 줄이 없는 상대(손으로 단 안 건 판 · 작업실 판 · 칸 표 전에 걸린 판)도 --장부와 같은 기준으로 본다(cellOwners)
  const also = [...(shared.get(`${plate.계정}|${day}|${slot.time}`) || [])].filter((n) => n !== piece.name);
  if (also.length) return `같은 칸에 ${also.join(' · ')}의 판이 있다(같은 칸 두 번)`;
  return null;
}

/** 칸마다 그 칸에 나가는 판을 둔 편들 — `계정|현지 날짜|칸` → Set<편 이름>. 버린 편 · 나가지 않는 판(보류 · 취소됨 · 지움)은 뺀다(--장부의
 *  「같은 칸 두 번」과 같은 기준). staleWhy가 「같은 칸에 다른 편의 판이 있는 안 건 돌림 판」을 무효로 보는 데 쓴다 — 돌림 계정의 판만 본다. */
function cellOwners(pieces, rotation) {
  const out = new Map();
  for (const piece of pieces) {
    if (piece.dead) continue;
    for (const plate of piece.prep.판 || []) {
      const a = rotation[plate.계정];
      const at = Date.parse(plate.시각 || '');
      if (!a || !Number.isFinite(at) || GONE.has(piece.stateOf(plate)?.상태)) continue;
      const key = `${plate.계정}|${T.localDate(at, T.tzOf(a))}|${T.slotFor(plate.시각, a).time}`;
      if (!out.has(key)) out.set(key, new Set());
      out.get(key).add(piece.name);
    }
  }
  return out;
}

// 이미 있는 판 — 버린 편은 칸을 차지하지 않는다. 나가지 않는 판(보류 · 취소됨 · 지움)은 칸은 비우되, 돌림 원본이면 그 계정이 그 원본을 이미
// 받은 것으로 남긴다(gone — 게시결과는 계정으로 맞추니 같은 원본을 다시 주면 옛 줄이 새 판을 가린다). 걸린 판(예약됨 · 게시됨 · 거는 중 ·
// 작업실 승인 대기 — holds: 다른 작업본이 표에 잡은 것까지)은 --다시 · 멈춤에도 남는다. --다시면 아직 안 건 돌림 판 가운데 지난 판 · 무효 판만
// 뺀다(stale — staleWhy가 까닭을 주는 판). stale을 안 주면 안 건 돌림 판을 모두 뺀다(--다시모두 · 예전 --다시).
function existingPlates(pieces, { replan = false, stopped = new Set(), holds = new Map(), stale = null } = {}) {
  const out = [];
  for (const piece of pieces) {
    if (piece.dead) continue;
    const plated = new Set();
    for (const plate of piece.prep.판 || []) {
      plated.add(plate.계정);
      const row = piece.stateOf(plate);
      const elsewhere = holds.get(`${piece.name}|${plate.계정}`) || null;
      const base = { original: piece.original ? piece.name : null, account: plate.계정, time: plate.시각, generated: Boolean(plate.돌림), piece: piece.name, state: row?.상태 || elsewhere || null,
        file: piece.original ? plateSha(piece, plate) : null };
      if (!elsewhere && GONE.has(row?.상태)) { if (piece.original) out.push({ ...base, booked: false, gone: true }); continue; }
      const booked = 장부.held(row) || Boolean(elsewhere);
      if (plate.돌림 && !booked && (stopped.has(piece.name) || (replan && (!stale || stale(piece, plate))))) continue;
      out.push({ ...base, booked });
    }
    if (!piece.original) continue;
    // 판은 빠졌는데 게시결과 줄만 남은 계정(--다시가 취소된 돌림 판을 뺀 뒤) — 그 원본을 이미 받았다. 걸려 있고 시각이 있으면 칸도 찼다.
    for (const account of new Set((piece.result.판 || []).map((r) => r && r.계정).filter(Boolean))) {
      if (plated.has(account)) continue;
      const row = 장부.rowOf(piece.result.판, account);
      const base = { original: piece.name, account, generated: false, piece: piece.name, state: row?.상태 || null };
      if (장부.held(row)) {
        const timed = Number.isFinite(Date.parse(row.시각 || ''));
        out.push({ ...base, time: timed ? row.시각 : null, booked: true, gone: !timed });
      } else if (GONE.has(row?.상태)) out.push({ ...base, time: null, booked: false, gone: true });
    }
    // 같은 이야기를 다른 편 폴더로 낸 적이 있는 원본(「돌림」.같은이야기 — 11-10 지마: 영어 · 간체 · 버마어 판이 LAB_지마_20261102로
    // @synkkorean · 샤오훙수 · 버마어 틱톡에 나갔다). 그 편이 나간(또는 걸린) 계정은 이 원본을 이미 받았다 — 칸은 차지하지 않는다.
    for (const name of [].concat(piece.original.같은이야기 || [])) {
      const sib = pieces.find((p) => p.name === name);
      if (!sib) throw new Error(`${piece.name}의 「돌림」.같은이야기 「${name}」 편 폴더가 없다 — 이름을 고친다(조용히 넘기면 같은 이야기가 그 계정에 또 나간다)`);
      const accounts = new Set([...(sib.prep.판 || []).map((p) => p && p.계정), ...(sib.result.판 || []).map((r) => r && r.계정)].filter(Boolean));
      for (const account of accounts) {
        const row = 장부.rowOf(sib.result.판, account);
        if (row && !장부.held(row) && GONE.has(row.상태)) continue; // 그 편이 나가지 않은 계정(취소됨 · 지움)
        if (plated.has(account) || out.some((x) => x.original === piece.name && x.account === account)) continue;
        // seenAt — 그 편이 그 계정에 걸린 때(씨앗 계정이면 씨앗 첫 판으로 센다 — tools/lib/돌림.js)
        const seenAt = row && 장부.held(row) ? (row.시각 || (sib.prep.판 || []).find((p) => p && p.계정 === account)?.시각 || null) : null;
        out.push({ original: piece.name, account, generated: false, piece: name, state: '같은 이야기(다른 편)', time: null, seenAt, booked: false, gone: true });
      }
    }
    // 편 폴더 기록 없이 다른 길로 이미 올린 계정(「돌림」.이미받음 — 11-10 한글 노래: @synkkorean에 이미 있다) — 다시 받지 않는다.
    for (const x of piece.original.이미받음 || []) {
      const account = typeof x === 'string' ? x : x.계정;
      if (plated.has(account) || out.some((y) => y.original === piece.name && y.account === account)) continue;
      out.push({ original: piece.name, account, generated: false, piece: piece.name, state: '이미 받음(다른 길)', time: null, seenAt: (typeof x === 'object' && x.때) || null, booked: false, gone: true });
    }
  }
  return out;
}

// 판 파일의 지문(같은 언어 묶음의 같은 파일 확인 — 돌림 ⑥). 돌림 판은 돌림표가 적은 지문, 손으로 단 판은 파일을 읽는다(없으면 null).
function plateSha(piece, plate) {
  if (plate.지문) return plate.지문;
  const file = resolveIn(piece.dir, plate.파일);
  try { return file && fs.statSync(file).isFile() ? sha256(file) : null; } catch { return null; }
}

// 같은 언어 묶음표와 겹침 확인(돌림 ⑥) — 묶음, 같은 판본 키를 둘이 쓰는 묶음, 원본마다 나라별판이 같은 파일인 짝, 판 겹침(이미 있는 판 + 이번 셈).
function sameLanguageReport(run) {
  const bundles = 돌림.bundlesOf(run.rotation).map((b) => ({ platform: b.platform, group: b.group,
    members: b.accounts.map((k) => ({ account: k, version: run.rotation[k].versionKey, language: run.rotation[k].language, timeZone: run.rotation[k].timeZone, seed: run.rotation[k].seed })) }));
  const sharedKeys = [];
  const sameFiles = [];
  for (const b of bundles) {
    const byKey = new Map();
    for (const m of b.members) byKey.set(m.version, [...(byKey.get(m.version) || []), m.account]);
    for (const [version, accounts] of byKey) if (accounts.length > 1) sharedKeys.push({ platform: b.platform, group: b.group, version, accounts });
    for (const o of run.originals) {
      const seen = new Map(); // 지문 → 판본 키
      for (const key of byKey.keys()) {
        const sha = o.versions?.[key]?.sha;
        if (!sha) continue;
        if (seen.has(sha)) sameFiles.push({ original: o.id, platform: b.platform, group: b.group, versions: [seen.get(sha), key] });
        else seen.set(sha, key);
      }
    }
  }
  return { bundles, sharedKeys, sameFiles, overlaps: 돌림.overlaps(run.result.plates, run.rotation, run.cfg.셈 || {}) };
}
const overlapLine = (o) => `${o.original}: ${o.a} · ${o.b}(${o.platform} · ${o.group}${o.hours !== null ? ` · ${o.hours}시간` : ''}${o.sameFile ? ' · 같은 파일' : ''})`;

function firstPlateValue(prep, key) {
  for (const p of prep.판 || []) if (p[key] !== undefined) return p[key];
  return undefined;
}

// 칸 하나 → 판(그 원본 편 준비.json에 더할 꼴)
function plateFor(cell, piece, account, versionKey) {
  const v = piece.original.판본[versionKey];
  const manuscript = v.원고?.[account.platform] || null;
  const plate = { 계정: cell.account, 파일: v.파일, 시각: cell.time, 언어: account.language || undefined, 돌림: true };
  if (v.표지) plate.표지 = v.표지;
  if (manuscript) plate[/\.json$/i.test(manuscript) ? '원고' : '게시글'] = manuscript;
  const ai = firstPlateValue(piece.prep, 'AI표시');
  if (ai !== undefined) plate.AI표시 = ai;
  const sha = piece.versions[versionKey]?.sha;
  if (sha) plate.지문 = sha;
  return plate;
}

function todayKst(now) { return T.localDate(now, 'Asia/Seoul'); }

function runPlan(opts) {
  const { accounts, cfg } = loadLedger();
  checkLedgerShape(accounts);
  const { rotation, notReady, closedStory } = rotationAccounts(accounts, { ignoreReady: opts.ignoreReady });
  const pieces = loadPieces(accounts, cfg);
  const originals = originalsOf(pieces);
  const stopped = new Set(originals.filter((o) => o.stopped).map((o) => o.id));
  const holds = holdsOf();
  const shared = cellOwners(pieces, rotation);
  const stale = opts.replanAll ? null : (piece, plate) => staleWhy(piece, plate, { rotation, now: opts.now, cells: holds.byCell, shared });
  const existing = existingPlates(pieces, { replan: opts.replan, stopped, holds: holds.byPlate, stale });
  const result = 돌림.plan({ accounts: rotation, originals, existing, from: opts.from, days: opts.days, cfg: cfg.셈 || {}, useSpares: opts.useSpares, now: opts.now });
  saveShaCache();
  const waiting = pieces.filter((p) => p.waiting).map((p) => ({ piece: p.name, why: p.waiting }));
  return { accounts, rotation, notReady, closedStory, holds, pieces, originals, existing, result, cfg, shared, waiting };
}

// 셈에서 뺀 원본(쓸날 없는 노래 원본)을 알리는 줄 — 모든 명령의 맨 위에 찍는다(--json이면 표준 오류로: 표준 출력은 JSON만).
function waitingLine(run) {
  if (!run.waiting.length) return null;
  // 「셈에서 뺐다」 = 판을 받지 않는다. 11-12 저녁부터 연재 차례표에는 남는다(뒤 차례가 이 차례를 건너뛰지 않는다) — 줄 머리는 14시 지시문이 옮겨 적는 글이라 그대로 둔다.
  const songs = run.waiting.filter((w) => !/미정/.test(w.why));
  const pending = run.waiting.filter((w) => /미정/.test(w.why));
  const lines = [];
  if (songs.length) {
    lines.push(`! 쓸날 없는 노래 원본 ${songs.length} — 셈에서 뺐다(이 원본들은 판을 받지 않는다): ${songs.map((w) => w.piece).join(' · ')} — `
      + '21:00 노래 칸을 여는 날을 「돌림」.쓸날(YYYY-MM-DD)에 적는다(node tools/판본글잇기.js 돌림 <편 폴더> 전부 --형식 노래 --쓸날 <날짜> · 제작 절차 「LAB 하루 두 편」 10 ⑤). 연재 원본이면 뒤 차례도 이 원본을 기다린다');
  }
  if (pending.length) lines.push(`! 쓸날 「미정」인 원본 ${pending.length} — 판을 받지 않는다: ${pending.map((w) => w.piece).join(' · ')} — 여는 날이 정해지면 「돌림」.쓸날(YYYY-MM-DD)에 적는다`);
  return lines.join('\n');
}

function writePlates(run, opts) {
  const byPiece = new Map();
  for (const cell of run.result.cells) {
    if (!cell.original || cell.taken) continue;
    if (!byPiece.has(cell.original)) byPiece.set(cell.original, []);
    byPiece.get(cell.original).push(cell);
  }
  const holds = holdsOf(); // 셈하는 동안 다른 작업본이 잡았을 수 있어 표를 다시 읽는다
  const written = [];
  const skipped = [];
  const dropped = []; // --다시 · 멈춤이 뺀 판과 까닭
  for (const piece of run.pieces) {
    const cells = byPiece.get(piece.name);
    const halted = Boolean(piece.original?.멈춤);
    const removeUnbooked = opts.replan || halted;
    if (!cells && !removeUnbooked) continue;
    const file = path.join(piece.dir, '게시', '준비.json');
    const fresh = readJson(file); // 셈하는 동안 다른 칸이 바뀌었을 수 있어 다시 읽고 판만 바꾼다
    if (!fresh) continue;
    // 걸린 판(예약됨 · 게시됨 · 거는 중 · 작업실 승인 대기 — 다른 작업본이 표에 잡은 것까지)은 지우지 않는다 — 게시결과도 지금 것을 다시 읽는다
    const rows = readJson(path.join(piece.dir, '게시', '게시결과.json'))?.판 || [];
    const heldNow = (p) => 장부.held(장부.rowOf(rows, p.계정)) || holds.byPlate.has(`${piece.name}|${p.계정}`);
    // --다시는 지난 판 · 무효 판만 뺀다(P2-모2) — 셈(existingPlates)이 뺀 판과 같은 판단이어야 한다. 멈춘 원본 · --다시모두는 안 건 돌림 판을 모두 뺀다.
    const dropWhy = (p) => {
      if (!p.돌림 || !removeUnbooked || heldNow(p)) return null;
      if (halted) return '멈춘 원본';
      if (opts.replanAll) return '--다시모두';
      // 나가지 않는 판(보류 · 취소됨 · 지움 줄)은 시각이 남아 있어도 뺀다 — 셈은 이 판을 「그 계정이 그 원본을 받은 것」으로만 세고 칸은 비운다(existingPlates)
      const state = 장부.rowOf(rows, p.계정)?.상태;
      if (GONE.has(state)) return `나가지 않는 판(${state})`;
      return staleWhy(piece, p, { rotation: run.rotation, now: opts.now, cells: holds.byCell, shared: run.shared });
    };
    const keep = [];
    for (const p of fresh.판 || []) { const why = dropWhy(p); if (why) dropped.push({ piece: piece.name, account: p.계정, time: p.시각, why }); else keep.push(p); }
    const already = new Set(keep.map((p) => p.계정));
    const add = [];
    for (const c of cells || []) {
      const other = holds.byCell.get(`${c.account}|${c.day}|${c.slot}`);
      if (already.has(c.account)) { skipped.push({ piece: piece.name, account: c.account, why: '이 편에 그 계정 판이 이미 있다' }); continue; }
      if (other && other !== piece.name) { skipped.push({ piece: piece.name, account: c.account, why: `그 칸(${c.day} ${c.slot})을 ${other}가 잡고 있다` }); continue; }
      add.push(plateFor(c, piece, run.rotation[c.account], run.rotation[c.account].versionKey));
      already.add(c.account);
    }
    const removed = (fresh.판 || []).length - keep.length;
    if (!add.length && !removed) continue;
    fresh.판 = [...keep, ...add];
    writeJson(file, fresh);
    written.push({ piece: piece.name, added: add.length, removed });
  }
  return { written, skipped, dropped };
}

function ledgerRows(run, opts) {
  const rows = [];
  const lastDay = 돌림.addDays(opts.from, opts.days - 1);
  for (const piece of run.pieces) {
    for (const plate of piece.prep.판 || []) {
      const a = run.accounts[plate.계정];
      const ms = Date.parse(plate.시각 || '');
      if (!a || a.brand !== 'LAB' || !Number.isFinite(ms)) continue;
      const tz = T.tzOf(a);
      const day = T.localDate(ms, tz);
      if (day < opts.from || day > lastDay) continue;
      const r = piece.stateOf(plate) || {};
      const elsewhere = 장부.held(r) ? null : run.holds?.byPlate.get(`${piece.name}|${plate.계정}`) || null;
      const slot = T.slotFor(plate.시각, a);
      rows.push({ 계정: plate.계정, 플랫폼: a.platform, 현지날짜: day, 칸: slot.time || T.localTime(ms, tz), 형식: slot.format || null, 시각: plate.시각,
        원본: piece.name, 판본: plate.파일 || null, 지문: plate.지문 || r.지문 || null, 상태: elsewhere ? `${elsewhere}(다른 작업본)` : r.상태 || (piece.dead ? '버린 편' : '건 전'),
        게시물ID: r.게시물ID || r.작업 || null, 주소: r.주소 || null, 돌림: Boolean(plate.돌림) });
    }
  }
  rows.sort((x, y) => x.현지날짜.localeCompare(y.현지날짜) || x.계정.localeCompare(y.계정) || String(x.칸).localeCompare(String(y.칸)));
  // 같은 칸 두 번(나가지 않는 판 말고)
  const seen = new Map();
  const doubles = [];
  for (const r of rows) {
    if (GONE.has(r.상태) || r.상태 === '버린 편') continue;
    const k = `${r.계정}|${r.현지날짜}|${r.칸}`;
    if (seen.has(k) && seen.get(k) !== r.원본) doubles.push(`${k} — ${seen.get(k)} · ${r.원본}`);
    else seen.set(k, r.원본);
  }
  // 같은 언어 묶음 겹침(돌림 ⑥) — 이 기간의 나가는 판 가운데 같은 원본이 24시간 안에, 또는 같은 파일로 같은 묶음 두 계정에 걸린 짝.
  // 같은 이야기를 다른 편 폴더로 낸 판(「돌림」.같은이야기 — @synkkorean의 영어판 등)은 그 원본의 판으로 짝을 짓는다(11-11 P3-5: 폴더 이름으로만
  // 짝을 지어 다른 폴더로 나간 판과는 못 맞췄다 — 셈과 --묶음은 봤다).
  const alias = new Map();
  for (const piece of run.pieces) if (piece.original && !piece.dead) for (const sib of [].concat(piece.original.같은이야기 || [])) alias.set(sib, piece.name);
  const live = rows.filter((r) => !GONE.has(r.상태) && r.상태 !== '버린 편');
  const sameLanguage = 돌림.overlaps(live.map((r) => ({ original: alias.get(r.원본) || r.원본, account: r.계정, ms: Date.parse(r.시각), file: r.지문 })), run.rotation, run.cfg.셈 || {});
  return { rows, doubles, sameLanguage };
}

function stopPiece(name, why, now) {
  const file = path.join(ROOT, name, '게시', '준비.json');
  const prep = readJson(file);
  if (!prep?.돌림) { console.error(`${name}: 돌림 원본이 아니다(준비.json 「돌림」 없음)`); process.exit(2); }
  const rows = readJson(path.join(ROOT, name, '게시', '게시결과.json'))?.판 || [];
  const holds = holdsOf().byPlate;
  // 걸린 판(예약됨 · 게시됨 · 거는 중 · 작업실 승인 대기 — 다른 작업본이 표에 잡은 것까지)은 남긴다. 지우면 플랫폼에 걸린 예약이 장부에서 사라진다.
  const heldState = (p) => { const row = 장부.rowOf(rows, p.계정); return 장부.held(row) ? row.상태 : holds.get(`${name}|${p.계정}`) || null; };
  const plates = (prep.판 || []).filter((p) => p.돌림);
  const claiming = plates.filter((p) => heldState(p) === 장부.CLAIM);
  const booked = plates.filter((p) => heldState(p) && heldState(p) !== 장부.CLAIM && Date.parse(p.시각) > now);
  prep.돌림.멈춤 = { 날: todayKst(now), 까닭: why };
  const before = (prep.판 || []).length;
  prep.판 = (prep.판 || []).filter((p) => !(p.돌림 && !heldState(p)));
  writeJson(file, prep);
  return { removed: before - prep.판.length, booked, claiming };
}

// 비상 정지 점검(설계 3) — 14시 게시 회차가 걸기 전에 돌린다. 씨앗이 지난 사흘 안에 올린 원본마다 씨앗 판의 24시간 「평소 대비 배수」
// (게시/성과.json 자동판정 — tools/게시성과.js가 3시간마다 쓴다)를 본다. 실제로 나간 씨앗 판(예약됨 · 게시됨이고 시각이 지난 판)만 세고,
// 숫자가 있는 씨앗의 과반이 0.3배 밑이면 「급락」(→ --멈춤), 숫자가 아직 올 때가 아니면(나간 지 40시간 안) 「판정 전」, 숫자를 볼 씨앗이
// 하나도 없으면(숫자를 못 읽는 플랫폼 · 씨앗 판이 안 나감) 「판정 불가」 — 눈으로 본다. 줄마다 「판정할 수 있는 씨앗 n/N」을 적는다.
// 「고칠 실수」(댓글 · 시험관이 짚은 오류)와 「대상국 큰 사건」(재난 · 애도일)은 회차가 따로 본다.
function checkStops(run, now, { days = 3, low = 0.3, waitHours = 40 } = {}) {
  const out = [];
  for (const piece of run.pieces.filter((p) => p.original && !p.original.멈춤 && !p.dead)) {
    const seedPlates = (piece.prep.판 || []).filter((pl) => run.accounts[pl.계정]?.rotationSeed && Number.isFinite(Date.parse(pl.시각 || '')));
    if (!seedPlates.length) continue;
    const stateOf = (pl) => piece.stateOf(pl)?.상태 || null;
    const isOut = (pl) => DONE.has(stateOf(pl)) && Date.parse(pl.시각) <= now;
    const outPlates = seedPlates.filter(isOut);
    const first = Math.min(...(outPlates.length ? outPlates : seedPlates).map((pl) => Date.parse(pl.시각)));
    const pending = (piece.prep.판 || []).filter((pl) => pl.돌림 && Date.parse(pl.시각 || '') > now).length;
    // 이번 셈에서 이 원본이 새로 받을 판(같은 회차의 --쓰기가 달 판) — 14시 회차는 --점검 → --쓰기 차례라, 이것을 안 보면 옛 원본에 판을 처음
    // 다는 날은 점검이 「원본 0」으로 지나가고 가장 이른 판은 다음 날 점검 전에 공개된다(11-11 Fable 5.2 끝 판 검수 P2-1 — 11-11 첫 판 15개)
    const planned = (run.result?.cells || []).filter((c) => c.original === piece.name).length;
    // 사흘 창 — 씨앗이 사흘 안에 올린 원본. 사흘이 지났어도 아직 안 나간 돌림 판이 있거나 이번 셈에서 판을 받으면 본다(11-11 Fable 검수: 오래된
    // 원본을 뒤늦게 나라별로 돌릴 때 그 원본이 점검에서 통째로 빠졌다 — 씨앗 숫자가 급락이던 원본이면 걸기 전에 멈출 수 있어야 한다)
    if (first > now || (now - first > days * 86400000 && !pending && !planned)) continue;
    const perf = readJson(path.join(piece.dir, '게시', '성과.json'))?.자동판정?.판 || [];
    const rows = seedPlates.map((pl) => {
      const out1 = isOut(pl);
      const ageH = Math.round((now - Date.parse(pl.시각)) / 360000) / 10;
      const m = out1 ? perf.find((x) => x.계정 === pl.계정)?.시점?.['24시간']?.평소대비?.배수 : null;
      const multiple = Number.isFinite(m) ? m : null;
      return { account: pl.계정, state: stateOf(pl) || '건 전', out: out1, ageH, multiple, low: multiple !== null && multiple < low, late: out1 && multiple === null && ageH >= waitHours };
    });
    const known = rows.filter((r) => r.multiple !== null);
    const lows = known.filter((r) => r.low);
    const waiting = rows.filter((r) => r.out && r.multiple === null && !r.late);
    const verdict = known.length ? (lows.length * 2 > known.length ? '급락' : '괜찮음') : waiting.length ? '판정 전' : '판정 불가';
    out.push({ piece: piece.name, format: piece.original.형식, seededAt: T.isoAt(first, 'Asia/Seoul'), pending, planned, verdict, known: known.length, seeds: rows.length, rows });
  }
  return out;
}

function printPlan(run, opts) {
  const { result, notReady, rotation } = run;
  const filled = result.cells.filter((c) => c.original && !c.taken);
  const empty = result.cells.filter((c) => !c.original && !c.taken);
  console.log(`LAB 돌림표 · ${opts.from}부터 ${opts.days}일 · 돌림 계정 ${Object.keys(rotation).length} · 원본 ${run.originals.length}(${돌림.FORMATS.map((f) => `${f} ${run.originals.filter((o) => o.format === f).length}`).join(' · ')})`);
  console.log(`새로 채울 칸 ${filled.length} · 빈 칸 ${empty.length} · 이미 찬 칸 ${result.cells.filter((c) => c.taken).length}`);
  for (const day of result.range) {
    const today = result.cells.filter((c) => c.day === day && !c.taken);
    if (!today.length) continue;
    console.log(`\n${day}`);
    for (const format of 돌림.FORMATS) {
      const list = today.filter((c) => c.format === format).sort((x, y) => rotation[x.account].platform.localeCompare(rotation[y.account].platform) || x.account.localeCompare(y.account));
      if (!list.length) continue;
      console.log(`  ${format}: ` + list.map((c) => `${c.account} ${c.original ? `← ${c.original}` : `· ${c.why}`}`).join(' | '));
    }
  }
  const why = new Map();
  for (const c of empty) why.set(c.why, (why.get(c.why) || 0) + 1);
  if (why.size) console.log(`\n빈 칸 까닭: ${[...why].map(([w, n]) => `${w} ${n}`).join(' · ')}`);
  const real = opts.ignoreReady ? '(--준비무시 — 셈만 해 본 것) 실제로는 ' : '';
  if (notReady.length) console.log(`${real}칸을 못 받는 계정 ${notReady.length}: ${notReady.map((x) => `${x.account}(${x.why.join(' · ')})`).join(' · ')}`);
  if (run.closedStory.length) console.log(`${real}닫힌 칸이 있는 계정 ${run.closedStory.length}(dailyTimesFrom · dailyFormatsFrom 「미정」): ${run.closedStory.map((x) => `${x.account}(${x.closed.join(' · ')})`).join(' · ')}`);
  const lang = sameLanguageReport(run);
  console.log(`같은 언어 묶음 ${lang.bundles.length}(${lang.bundles.map((b) => `${b.platform} ${b.group} ${b.members.length}곳`).join(' · ') || '없음'}) · 판 겹침 ${lang.overlaps.length} · 같은 파일인 나라별판 ${lang.sameFiles.length}${lang.overlaps.length || lang.sameFiles.length ? ' — node tools/돌림표.js --묶음' : ''}`);
  const notVersion = run.originals.flatMap((o) => Object.entries(o.versions).filter(([, v]) => !v.ready).map(([k, v]) => `${o.id}/${k} ${v.why}`));
  if (notVersion.length) console.log(`돌림에 못 드는 판본 ${notVersion.length}: ${notVersion.slice(0, 30).join(' · ')}${notVersion.length > 30 ? ' …' : ''}`);
}

function main() {
  const now = argValue('--지금') ? Date.parse(argValue('--지금')) : Date.now();
  if (!Number.isFinite(now)) { console.error('--지금은 ISO 시각으로 준다'); process.exit(2); }
  const from = argValue('--부터') || 돌림.addDays(todayKst(now), 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { console.error('--부터는 YYYY-MM-DD'); process.exit(2); }
  const days = Math.max(1, Math.min(60, Number(argValue('--일수') || 5) || 5));
  const opts = { from, days, now, ignoreReady: has('--준비무시'), useSpares: has('--예비씀'), replan: has('--다시') || has('--다시모두'), replanAll: has('--다시모두') };
  if (opts.ignoreReady && has('--쓰기')) {
    console.error('--준비무시는 셈만 해 보는 길이다 — --쓰기와 함께 쓰지 않는다(준비 안 된 계정 · 시작 날 「미정」 칸에 판이 써진다). 원장 값을 고친 뒤 --쓰기.');
    process.exit(2);
  }
  if (has('--멈춤')) {
    const name = argValue('--멈춤');
    const why = argValue('--까닭');
    if (!name || !why) { console.error('--멈춤 <편 폴더 이름> --까닭 "<까닭>"'); process.exit(2); }
    const r = stopPiece(name, why, now);
    console.log(`${name} 멈춤 — 안 건 돌림 판 ${r.removed}개를 뺐다.`);
    if (r.booked.length) console.log(`이미 예약된 판 ${r.booked.length}개는 플랫폼 예약을 다른 매일 판 편으로 바꿔 건다(공개 전이면 상시 승인 안): ${r.booked.map((p) => `${p.계정} ${p.시각}`).join(' · ')}`);
    if (r.claiming.length) console.log(`거는 중인 판 ${r.claiming.length}개는 그 플랫폼 예약 목록부터 읽는다(node tools/게시장부.js 걸던것) — 걸렸으면 「끝」 뒤 위와 같이 바꿔 걸고, 안 걸렸으면 「풀기」 뒤 --멈춤을 다시 돌려 뺀다: ${r.claiming.map((p) => `${p.계정} ${p.시각}`).join(' · ')}`);
    console.log('빈 칸은 node tools/돌림표.js --예비씀 --쓰기 로 다시 채운다(예비편 · 다른 원본).');
    return;
  }
  const run = runPlan(opts);
  const held = waitingLine(run);
  if (held) (has('--json') ? console.error : console.log)(held);
  if (has('--점검')) {
    const list = checkStops(run, now);
    if (has('--json')) { console.log(JSON.stringify(list, null, 2)); } else {
      console.log(`비상 정지 점검(설계 3) · ${T.isoAt(now, 'Asia/Seoul').slice(0, 16)} · 씨앗이 사흘 안에 올렸거나 돌림 판이 남았거나 이번 셈에서 판을 받을 원본 ${list.length}`);
      const seedCell = (r) => `${r.account} ${!r.out ? `안 나감(${r.state})` : r.multiple !== null ? `${r.multiple}배${r.low ? '↓' : ''}` : r.late ? `24시간 숫자 없음(${r.ageH}시간)` : `24시간 숫자 전(${r.ageH}시간)`}`;
      for (const x of list) console.log(`  ${x.verdict === '급락' || x.verdict === '판정 불가' ? '!' : '·'} ${x.verdict} · ${x.piece}(${x.format}) · 씨앗 ${x.seededAt.slice(5, 16)} · 판정할 수 있는 씨앗 ${x.known}/${x.seeds} · 남은 돌림 판 ${x.pending} · 이번 셈에서 달 판 ${x.planned} · `
        + x.rows.map(seedCell).join(', '));
      if (list.some((x) => x.verdict === '급락')) console.log('  급락 원본은 node tools/돌림표.js --멈춤 <편> --까닭 "씨앗 24시간 평소의 0.3배 밑" 뒤 --예비씀 --쓰기(판정할 수 있는 씨앗이 하나뿐이면 그 씨앗 글을 먼저 눈으로 본다)');
      if (list.some((x) => x.verdict === '판정 불가')) console.log('  판정 불가 원본은 씨앗 판에 24시간 숫자가 없다(숫자를 못 읽는 플랫폼이거나 씨앗 판이 안 나갔다) — 씨앗 글의 조회 · 댓글을 눈으로 보고 나쁘면 --멈춤, 괜찮으면 그대로 간다. 씨앗 판이 안 나갔으면 씨앗부터 다시 건다');
      console.log('  사람 눈으로 더 볼 것: 고칠 실수(댓글 · 시험관 지적) · 대상국 큰 사건(재난 · 애도일 — 그날 칸의 나라)');
    }
    if (list.some((x) => x.verdict === '급락')) process.exitCode = 1;
    return;
  }
  if (has('--묶음')) {
    const lang = sameLanguageReport(run);
    const bad = lang.overlaps.length + lang.sameFiles.length + lang.sharedKeys.length;
    if (has('--json')) console.log(JSON.stringify({ from, days, ...lang }, null, 2));
    else {
      console.log(`같은 언어 묶음(같은 플랫폼에서 같은 말로 올리는 계정) ${lang.bundles.length} — 같은 원본은 24시간 안에 둘이 받지 않고, 같은 파일은 날이 달라도 둘이 받지 않는다`);
      for (const b of lang.bundles) console.log(`  ${b.platform} · ${b.group}(${b.members.length}): ${b.members.map((m) => `${m.account}[${m.version || '판본 키 없음'}${m.language !== b.group ? ` · 판 ${m.language}` : ''}${m.seed ? ' · 씨앗' : ''}]`).join(' · ')}`);
      console.log(`같은 판본 키를 둘이 쓰는 묶음 ${lang.sharedKeys.length}${lang.sharedKeys.length ? `: ${lang.sharedKeys.map((s) => `${s.platform} ${s.group} ${s.version}(${s.accounts.join(' · ')})`).join(' · ')} — 계정마다 나라별판 키를 따로 둔다` : ''}`);
      console.log(`나라별판이 같은 파일인 원본 ${lang.sameFiles.length}${lang.sameFiles.length ? `: ${lang.sameFiles.map((s) => `${s.original} ${s.versions.join(' = ')}`).join(' · ')} — 첫 카드 · 그 나라 예문 · 끝 질문 · 표지를 나라마다 다르게 다시 만든다(배속 · 색만 바꾸지 않는다)` : ''}`);
      console.log(`판 겹침(이미 있는 판 + ${from}부터 ${days}일 셈 · 24시간 안이거나 같은 파일) ${lang.overlaps.length}${lang.overlaps.length ? `: ${lang.overlaps.map(overlapLine).join(' · ')}` : ''}`);
    }
    if (bad) process.exitCode = 1;
    return;
  }
  if (has('--장부')) {
    const { rows, doubles, sameLanguage } = ledgerRows(run, opts);
    if (has('--json')) { console.log(JSON.stringify({ from, days, rows, doubles, sameLanguage }, null, 2)); if (doubles.length || sameLanguage.length) process.exitCode = 1; return; }
    console.log(`LAB 게시 장부 · ${from}부터 ${days}일 · 판 ${rows.length}`);
    console.log('| 현지 날짜 | 칸 | 계정 | 원본 | 상태 | 게시물 ID | 지문 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.현지날짜} | ${r.칸}${r.형식 ? ` ${r.형식}` : ''} | ${r.계정} | ${r.원본} | ${r.상태} | ${r.게시물ID || '—'} | ${r.지문 ? r.지문.slice(0, 10) : '—'} |`);
    if (doubles.length) { console.log(`\n! 같은 칸 두 번: ${doubles.join(' · ')}`); process.exitCode = 1; }
    if (sameLanguage.length) { console.log(`\n! 같은 언어 묶음 겹침: ${sameLanguage.map(overlapLine).join(' · ')}`); process.exitCode = 1; }
    return;
  }
  if (has('--json')) {
    console.log(JSON.stringify({ from, days, cells: run.result.cells.map(({ ms, ...c }) => c), notReady: run.notReady, closedStory: run.closedStory, waiting: run.waiting, sameLanguage: sameLanguageReport(run),
      versions: Object.fromEntries(run.originals.map((o) => [o.id, Object.fromEntries(Object.entries(o.versions).map(([k, v]) => [k, { ready: v.ready, why: v.why || null }]))])) }, null, 2));
  } else printPlan(run, opts);
  if (has('--쓰기')) {
    const { written, skipped, dropped } = writePlates(run, opts);
    console.log(written.length ? `\n준비.json에 썼다: ${written.map((w) => `${w.piece} +${w.added}${w.removed ? ` −${w.removed}` : ''}`).join(' · ')}` : '\n더할 판 없음');
    if (dropped.length) console.log(`뺀 안 건 돌림 판 ${dropped.length}: ${dropped.map((d) => `${d.piece} ${d.account} ${String(d.time || '').slice(0, 16)}(${d.why})`).join(' · ')}`);
    if (skipped.length) console.log(`건너뛴 판 ${skipped.length}: ${skipped.map((s) => `${s.piece} ${s.account}(${s.why})`).join(' · ')}`);
  }
}

module.exports = { rotationAccounts, versionState, bookedVersionProblem, bookedTextProblem, localCheckState, loadPieces, existingPlates, staleWhy, cellOwners, ledgerRows, plateFor, checkStops, holdsOf, sameLanguageReport, 뜻기록들, 뜻기록비우기 };
if (require.main === module) main();
