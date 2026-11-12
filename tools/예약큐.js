#!/usr/bin/env node
'use strict';
/* 1일 1편 예약 큐 (2026-10-20). 읽기만 한다(--알림의 텔레그램 한 통 말고는 아무것도 바꾸지 않는다).
 *
 * 브랜드마다 앞으로 며칠이 예약으로 채워져 있는지를 편 폴더의 게시/준비.json·게시/게시결과.json에서 모아 보여 준다.
 * 유호님 10-20 「1일 1편 업로드가 기준인데 만약이란게 있는거잖아 … 4일치를 미리 만들어서 업로드 예약을 걸어놓는거」.
 *
 *   node tools/예약큐.js [--일수 5] [--json] [--폴더 <편 폴더들이 있는 곳, 기본 docs/마케팅>] [--오늘 YYYY-MM-DD(시험용)]
 *   node tools/예약큐.js --서버읽기 [--알림]   회사 서버를 읽기 전용으로 읽어 캐시에 두고 대조한다(AI 없는 정기 작업이 부른다).
 *                                           --알림이면 대조 경고·검사 「고칠 것」 편이 있을 때만 텔레그램 한 통(10-30부터 승인 대기는 빼고 앱에서)
 *                                           (같은 날 같은 내용은 한 번)
 *   공통: --서버캐시 <파일>(기본 %LOCALAPPDATA%\synk\예약큐\서버.json)
 *
 * 준비.json(편 폴더 게시/): {"브랜드","날짜"(만든 날),"슬롯"(올릴 날 YYYY-MM-DD),"성격":"시의성"|"상시",
 *   "역할"(10-21~22 옛 편에만 — 편 줄에 보이기만 한다),"시한"(시의성이면 늦어도 올릴 날),"상태","제목","판":[{"계정","파일","시각"}],
 *   "검사":{"결과","파일":[{"경로","바이트","수정"}]}(tools/올리기전검사.js가 남긴다)}
 * 게시결과.json(같은 폴더): {"판":[{"계정","상태":"승인 대기"|"예약됨"|"게시됨"|"실패"|"보류","시각","주소","방법":"작업실"?,"작업"?}]}
 * 한 편은 판이 모두 예약됨·게시됨이면 「채움」, 일부만이면 「일부」, 하나도 없으면 「승인 대기」다. 작업실 판의 「승인 대기」(유호님이 검토 링크를
 * 누르기 전)는 서버가 보내지 않으니 채움이 아니다. 올리기 전 검사가 「고칠 것」이거나 검사 뒤 영상이 바뀐 편은 「고칠 것」(✗)으로 보인다.
 * 비축 일수는 내일부터 이어서 「채움」인 날 수다. SYNK SHIFT는 판 계정이 shift- 로 시작하는 것을 따로 센다. 계정별 줄은 판 계정마다 같은 셈이다.
 * 서버 대조(10-21): 작업실(회사 서버) 캐시가 있으면 ① 작업실로 건 판은 서버 예약 작업의 실제 상태(승인 대기·예약됨·게시됨·실패)로 바꿔 보고,
 * 게시결과에는 있는데 서버에 그 작업이 없으면 「예약됨인데 서버에 없음」 ② 크롬으로 건 판은 슬롯 시각 2시간 뒤에도 채널 수집기가 본 공개 게시물
 * (그 계정 채널, 시각 ±6시간)이 없으면 「슬롯이 지났는데 나가지 않음」을 띄운다. 크롬 예약은 공개 전에는 API로 볼 수 없어 슬롯 전에는 대조하지 않는다.
 * 10-23 한 주 역할 없앰(결정 10-23): 역할 수를 한 주 목표(옛 3-1-2-1)와 견주지 않는다. 옛 편 준비.json의 「역할」은 편 줄에 그대로 보인다.
 * --json에서 roleGoal·roles·roleIssues는 빠졌다(저장소 안에서 읽는 곳 없음, 10-23 확인).
 * 10-26 매일 판 · 비축 목표 4일(유호님 「하루에 모든 계정에 하나씩 … 며칠 전에 이미 예약으로 준비해 둬야 해」, 결정 10-26):
 * sns-계정.json 계정의 dailyLine(07시가 하루 한 편을 만드는 「줄」)·dailyBlocked(막혀 셈에서 뺌)·dailyOff(매일 판 밖)를 읽어
 * 줄 표를 낸다. 줄의 비축 = 내일부터 그 줄의 (막힘 아닌) 모든 계정이 예약·게시인 날 수, 맨 위 비축은 줄 비축의 최솟값이다.
 * dailyDays(예: "월수금")가 있는 계정은 그 요일에만 올린다 — 다른 요일의 빈 칸은 「쉼」(–)으로 비축에 들고 빈 칸이 아니다
 * (10-28 yuhobuilds 주 3편 — 유호님 「그렇게 바꿔」). 쉬는 날에 편이 있으면 그 편대로 세고, 보류 판뿐이면 쉼이다.
 * 요일 글자가 아닌 dailyDays는 줄을 조용히 멈추게 하니 exit 2로 막는다.
 * 블로그 판(naver-blog·tistory)은 쇼츠 주소가 공개 뒤에야 생겨 영상 뒤에 거니, 같은 편의 영상 판이 예약·게시면 채움으로 센다.
 * 10-29 오늘 빈 계정(유호님 「오늘 올라간것처럼 전부 1일 1 업로드 지켜줘야해」): 빈 칸 · 비축 알림은 내일부터만 봐서 두 채널 줄이
 * 며칠째 오늘 칸을 비운 채 지나가도 아무 데도 안 떴다. 오늘 칸이 채움(예약·게시)이 아닌 계정을 「오늘 빈 계정」 줄로 보이고,
 * --알림은 17시 · 21시 뒤 한 번씩 남은 계정을 「[오늘 빈 계정]」 한 통으로 보낸다(막혀 셈에서 뺀 계정도 같이 적는다).
 * 11-10 LAB 줄은 비축 목표 5일(유호님 「5일치 영상을 미리 만들어서」 — LAB 하루 두 편 설계 20). 다른 줄은 4일 그대로.
 * --알림은 21시 뒤 하루 한 번 비축이 그 줄 목표(LAB 5일 · 그 밖 4일)보다 모자라면 빈 칸을 한 통으로 보내고(10-23 「비축 모자람 알리지 않음」을 되돌림),
 * 같은 날 같은 계정에 두 편 · 작업실 검토 링크가 승인 전에 만료되거나 24시간 안에 만료되면 경고에 넣는다(링크 자체는 읽지도 적지도 않는다).
 * 11-11 Fable 5.2 끝 판 검수 P2-9 · P3-9(돌림 판 · 나라별 계정 표기):
 *   · 편 줄 · 검사 「고칠 것」 목록(--json fix · --알림)은 준비.json 「슬롯」만이 아니라 판이 든 날(그 계정 현지 날짜)로도 뽑는다 — 돌림 원본은
 *     슬롯이 씨앗이 나간 옛 날이라, 판 날 줄(「이날 판(슬롯 …)」)이 없으면 돌림 판이 「고칠 것」이어도 어느 편 · 무슨 까닭인지 안 보였다.
 *   · 검사 기록(「검사」.파일)에 없는 판 영상(또는 기록 줄의 「판」에 없는 계정)이 아직 걸 판이면 「검사 뒤 판이 더해짐 — 다시 검사」.
 *   · 첫 판 시험 계정(원장 postRouteVerified 「첫판」)은 한 줄(판 없음 · 걸림 · 나감)로 보이고, 그 계정만 있는 줄 · 그 계정 줄의 비축은 세지
 *     않는다(「첫 판 시험」). 첫 판이 나갔는데 원장이 그대로면 경고.
 *   · 보류 칸이 낀 날은 ◐(○ 아님), 경고 글의 날짜는 그 계정 현지 날짜(한국 날짜와 다르면 한국 시각을 덧붙임), 오늘 칸 가운데 그 계정 현지
 *     시각으로 이미 지나 채울 수 없는 칸은 「오늘 빈 계정」이 아니라 「오늘 지난 빈 칸」으로 따로 보인다.
 *   node tools/예약큐.js --계정표   계정 전수 표(계정 · 매일 무엇이 · 올리는 길 · 며칠 앞서 · 막힌 것)를 마크다운으로
 *   시험용: --지금 <YYYY-MM-DDTHH:MM+09:00>(지금 시각과 오늘을 함께 정한다)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handleOf, VIDEO, load: 묶음읽기, plates: 묶음판 } = require('./lib/게시묶음.js');
const { 공용작업본 } = require('./lib/공용작업본.js');
const { uploadBitrateProblem, probeUploadProblemSync, hasInspectionHash } = require('./lib/upload-audio-bitrate.cjs');
const { aestheticBlock } = require('./lib/미학관문.js');
const T = require('./lib/계정시간.js');
const { rowOf, TRIAL, WITHDRAWN } = require('./게시장부.js');
const { bookedVersionProblem } = require('./돌림표.js');

const REPO = path.resolve(__dirname, '..');
const argValue = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const ROOT = argValue('--폴더') ? path.resolve(argValue('--폴더')) : path.join(REPO, 'docs', '마케팅');
const BRANDS = ['LAB', 'synkbrief', 'yuhobuilds', 'SHIFT'];
const DONE = new Set(['예약됨', '게시됨']);
const STATE_DIR = process.env.SYNK_QUEUE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '예약큐');
// --폴더로 다른 곳(시험 등)을 보면 이 PC의 작업실 캐시는 그 편들과 상관없으니, --서버캐시를 따로 줄 때만 읽는다.
const CACHE = argValue('--서버캐시') ? path.resolve(argValue('--서버캐시')) : argValue('--폴더') ? null : path.join(STATE_DIR, '서버.json');
const GRACE_MS = 2 * 3600000;
const WINDOW_MS = 6 * 3600000;
const LOOKBACK_DAYS = 3;
const LEAD = 4; // 비축 목표(일) — 07시가 D+4 편을 만든다(제작 절차 0)
const LAB_LEAD = 5; // LAB 줄의 비축 목표(11-10 — 하루 두 편 · 39계정 설계 20: 원본 5일 · 판본 5일)
const leadOf = (line) => (String(line || '').startsWith('LAB') ? LAB_LEAD : LEAD);
const RESERVE_ALERT_HOUR = 21; // 비축 알림은 그날 슬롯이 나간 뒤 한 번
const BLOG = new Set(['naver-blog', 'tistory']);
const LINE_ORDER = ['LAB 영어', 'LAB 몽골', 'LAB 두 채널', 'LAB 나라별', 'synkbrief', 'yuhobuilds'];
// 작업실 검토 링크 기록(tools/작업실예약.js LOCAL_DIR). 만료 시각과 편 이름만 읽는다. --폴더로 다른 곳을 보면 따로 줄 때만.
const LINK_DIR = process.env.SYNK_WORKSPACE_LINK_DIR
  || (argValue('--폴더') ? null : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', '작업실예약'));
// 시험은 SYNK_HERMES_EXE=file:<경로>로 보내는 대신 파일에 적는다.
const HERMES = process.env.SYNK_HERMES_EXE || path.join(process.env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
const TELEGRAM = 'telegram:6017495834';

function kstDate(ms = Date.now()) {
  return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// 그 계정이 그날 쉬는지(dailyDays에 그 요일이 없으면 쉼). 쉬는 날의 보류 판은 나가지도 채울 것도 없으니 쉼으로 본다.
const offDay = (a, day) => Boolean(a?.dailyDays) && !String(a.dailyDays).includes('일월화수목금토'[new Date(day + 'T00:00:00Z').getUTCDay()]);
const resting = (list, a, day) => offDay(a, day) && list.every((p) => p.state === '보류');

// 하루 두 칸 계정(11-09 유호님 「두 편으로」 — LAB 몽골, 11-10 LAB 39계정 「하루 두 편」): sns-계정.json dailyTimes(timeZone의 현지 시각 목록)
// · dailyFormats(칸 형식) · dailyTimesFrom(그날부터 앞 칸) · dailyFrom(그날부터 줄 — 「미정」이면 시작 전). 날짜 · 시각 계산은 tools/lib/계정시간.js.
// 그 계정은 칸마다 따로 센다 — 맨 끝 칸이 원래 칸(계정 이름 그대로), 앞 칸은 「<계정> 이야기」(형식이 없으면 「<계정> 13시」)이고,
// 판은 현지 시각이 가장 가까운 칸에 든다. 칸이 안 열린 날은 쉼(–)이라 비축 · 빈 칸 · 알림에 안 든다. 날짜는 그 계정의 현지 날짜다.
const extraSlots = (key, a) => {
  const slots = T.allSlots(a);
  return slots.length > 1 ? slots.slice(0, -1).map((s) => ({ key: T.slotKey(key, a, s), time: s.time })) : [];
};
const slotOpen = (a, day, time) => T.slotsOn(a, day).some((s) => s.time === time);
const lastSlot = (a) => { const slots = T.allSlots(a); return slots[slots.length - 1].time; };
// 첫 판 시험 계정(원장 postRouteVerified 「첫판」 — tools/게시장부.js가 판 하나만 걸게 막는다). 씨앗 계정은 아니다.
const isTrial = (a) => Boolean(a) && !a.rotationSeed && a.postRouteVerified === TRIAL;

// 그 칸에 판이 아직 들 수 있는 마지막 순간(11-11 Fable 5.2 검수 P3-9) — 판은 현지 시각이 가장 가까운 칸에 들고(T.slotFor) 늦게 손으로
// 올린 판은 실제 시각 날로 세니, 앞 칸은 다음 칸과의 가운데까지, 맨 끝 칸(칸 시각이 없는 하루 한 칸 계정도)은 그 계정의 현지 자정까지다.
// 한국보다 앞선 시간대(뉴질랜드 · 호주)는 한국 14시에 현지 13:00 칸이 이미 지나 있다.
function cellUntil(a, day, time) {
  const tz = T.tzOf(a);
  const end = T.zonedMs(addDays(day, 1), '00:00', tz);
  const times = T.allSlots(a).map((s) => s.time).filter(Boolean);
  const next = time ? times[times.indexOf(time) + 1] : null;
  if (!next || !times.includes(time)) return end;
  const at = T.zonedMs(day, time, tz);
  return at + (T.zonedMs(day, next, tz) - at) / 2;
}

// 경고 글의 날짜(11-11 Fable 5.2 검수 P3-9) — 그 계정의 현지 날짜(계정별 줄 · 칸과 같은 날). 한국 날짜와 다르면 한국 시각을 덧붙인다
// (멕시코 현지 11-12 13:00은 한국 11-13 04:00). 한국 시각 계정은 예전 글 그대로다.
function whenText(at, account) {
  const local = T.localDate(at, T.tzOf(account));
  const korea = kstDate(at);
  return local === korea ? local : `${local}(현지 날짜, 한국 ${korea.slice(5)} ${T.localTime(at, T.DEFAULT_TZ)})`;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
}

function slotOf(prep) {
  if (prep.슬롯) return String(prep.슬롯).slice(0, 10);
  const first = (prep.판 || []).map((p) => p.시각).filter(Boolean).sort()[0];
  return first ? kstDate(Date.parse(first)) : null;
}

// 올리기 전 검사 기록과 지금 영상이 같은지. 검사 기록의 경로는 그 편이 든 저장소 기준이다.
function checkOf(prep, needsBooking) {
  const record = prep.검사;
  if (!record) return { result: '검사 전', stale: false };
  const repo = path.resolve(ROOT, '..', '..');
  const shared = 공용작업본(repo), legacy = [];
  let result = record.결과 || '검사 전';
  for (const f of record.파일 || []) {
    let file = path.join(repo, f.경로);
    if (shared !== repo && !fs.existsSync(file)) file = path.join(shared, f.경로);
    let stat;
    try { stat = fs.statSync(file, { throwIfNoEntry: false }); } catch { return { result, stale: true }; }
    if (stat && (stat.size !== f.바이트 || new Date(stat.mtimeMs).toISOString() !== f.수정)) return { result, stale: true };
    if (!VIDEO.test(f.경로)) continue;
    if (needsBooking && (!stat || !hasInspectionHash(f.sha256))) return { result, stale: true };
    if (Array.isArray(f.오디오비트레이트)) {
      if (uploadBitrateProblem(f.오디오비트레이트)) result = '고칠 것';
    } else if (needsBooking) legacy.push(file);
  }
  // 이미 게시된 이력을 다시 스캔하지 않는다. 아직 예약할 옛 파일만 실제 소리로 판정한다.
  if (result !== '고칠 것' && legacy.some(file => probeUploadProblemSync(file))) result = '고칠 것';
  return { result, stale: false };
}

// ⑱이 맹검과 견줄 판 영상 — 올리기 전 검사(tools/올리기전검사.js의 videos)와 같은 묶음: 돌림 아닌 판의 있는 영상. 검사 기록(「검사」.파일)은
// 이미 나간 씨앗 판을 다시 재지 않아 빠지므로, 돌림 원본에 판을 단 뒤 다시 검사하면 판본 영상만 남는다 — 그 기록으로 보면 씨앗 영상을
// 맹검한 기록이 「판 영상이 아니다」로 헛막힌다(11-11 Fable 5.2 검수 P1-1, 「화날때」). 묶음을 못 읽으면 예전처럼 검사 기록의 영상(저장소에
// 없으면 공용 작업본)으로 본다.
function videosOf(prep, pieceDir) {
  if (pieceDir) {
    try {
      const list = [...new Set(묶음판(묶음읽기(pieceDir)).filter((p) => p.video && p.video.exists && !p.raw?.돌림).map((p) => p.video.path))];
      // 빈 목록이면 못 읽은 것과 같이 본다(11-11 Fable 5.2 다시 검수 P3-6) — --폴더가 저장소 꼴이 아니면 묶음이 판 경로를 못 찾아 빈 목록이 되고,
      // 그대로 쓰면 맹검한 영상이 「판 영상이 아니다」로 헛막힌다
      if (list.length) return list;
    } catch { /* 아래 검사 기록 */ }
  }
  const repo = path.resolve(ROOT, '..', '..');
  const shared = 공용작업본(repo);
  return (prep.검사?.파일 || []).filter((f) => VIDEO.test(f.경로 || '')).map((f) => {
    const own = path.join(repo, f.경로);
    return shared !== repo && !fs.existsSync(own) ? path.join(shared, f.경로) : own;
  });
}

// 검사 뒤 더해진 판(11-11 Fable 5.2 검수 P2-9) — 아직 걸 판(pending: 준비.json 「판」 번호)의 영상이 검사 기록(「검사」.파일)에 없거나, 기록 줄에
// 「판」(그 영상을 쓴 계정) 목록이 있는데 그 계정이 없으면 그 판은 검사 뒤에 달린 것이다(돌림표 --쓰기가 판을 단 뒤 올리기 전 검사를 다시
// 안 돌림 — 그 판의 글 · 언어 · 판본 검수는 아무도 안 봤다). 기록 경로는 checkOf처럼 이 저장소 · 공용 작업본(그리고 묶음이 본 뿌리) 기준의
// 절대 경로로 풀어 판 영상과 맞춘다. 판 영상이 없으면(판만 달고 판본을 아직 안 만듦) 판 「원본」 · 「파일」을 묶음과 같은 세 자리로 풀어 본다.
// 이미 나간 판은 검사가 다시 재지 않으니(올리기전검사.js outAlready) 보지 않는다. 블로그 · 영상 없는 판은 영상 기록이 없어 보지 않는다.
function addedAfterCheck(prep, pieceDir, pending) {
  if (!prep.검사 || !pending.size) return [];
  let bundle, list;
  try { bundle = 묶음읽기(pieceDir); list = 묶음판(bundle); } catch { return []; }
  const repo = path.resolve(ROOT, '..', '..');
  const bases = [...new Set([repo, 공용작업본(repo), bundle.repo, bundle.mediaRoot].filter(Boolean))];
  const norm = (f) => { const r = path.resolve(f); return process.platform === 'win32' ? r.toLowerCase() : r; };
  const recorded = new Map();
  for (const f of prep.검사.파일 || []) if (f && f.경로) for (const b of bases) recorded.set(norm(path.join(b, f.경로)), f);
  const piece = path.relative(bundle.repo, bundle.dir);
  const out = [];
  for (const p of list) {
    if (!pending.has(p.index) || p.blog || !p.video) continue;
    const raw = p.raw?.원본 || p.raw?.파일;
    const tries = p.video.exists || typeof raw !== 'string' || path.isAbsolute(raw) ? [p.video.path]
      : bases.flatMap((b) => [path.join(b, raw), path.join(b, piece, raw), path.join(b, piece, '게시', raw)]);
    const f = tries.map((t) => recorded.get(norm(t))).find(Boolean);
    if (!f || (Array.isArray(f.판) && !f.판.includes(p.account))) out.push(p.account);
  }
  return [...new Set(out)];
}

// 돌림 원본의 나라 판본 영상(「돌림」.판본) — ⑱이 맹검한 영상으로 받는다(tools/lib/미학관문.js 바뀐영상, 11-10 지마 저녁 그림 고침)
function 판본영상of(prep, pieceDir) {
  const repo = path.resolve(ROOT, '..', '..');
  const shared = 공용작업본(repo);
  return Object.values(prep.돌림?.판본 || {}).filter((v) => v && v.파일).map((v) => {
    const own = path.resolve(pieceDir, v.파일);
    return shared !== repo && !fs.existsSync(own) ? path.join(shared, path.relative(repo, own)) : own;
  });
}

const 헤르메스 = require('./lib/헤르메스보내기.js');

// 판 계정 키(sns-계정.json) → 서버 채널 id들. 핸들이나 유튜브 채널 ID로 맞춘다.
function channelsFor(account, accounts, server) {
  const a = accounts[account];
  if (!a || !server) return [];
  const want = handleOf(a.handle || a.expectedHandle);
  return server.channels.filter((c) => c.platform === a.platform && ((a.expectedChannelId && c.externalId === a.expectedChannelId)
    || (want && [c.handle, c.name, c.url].some((v) => handleOf(v) === want)))).map((c) => c.id);
}

function serverState(job) {
  if (job.status === 'scheduled') return job.reviewWaiting ? '승인 대기' : '예약됨';
  if (['publishing', 'accepted', 'processing'].includes(job.status)) return '예약됨';
  if (job.status === 'published') return '게시됨';
  if (job.status === 'unknown') return '확인 필요';
  if (job.status === 'manual') return '손으로';
  return '실패';
}

function collect(server, accounts, now) {
  const items = [];
  // 판본이 돌림에 드는 조건(검수 갈래) — 걸린 판의 판본이 걸린 뒤 무효가 됐는지 볼 때 쓴다(tools/돌림표.js bookedVersionProblem)
  const rotationCfg = (readJson(path.join(ROOT, 'sns-계정.json')) || {}).labRotation || {};
  const required = Array.isArray(rotationCfg.판본검수) && rotationCfg.판본검수.length ? rotationCfg.판본검수 : ['뜻', '글자'];
  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = path.join(ROOT, dir.name, '게시');
    const prep = readJson(path.join(base, '준비.json'));
    if (!prep || !prep.브랜드) continue;
    const result = readJson(path.join(base, '게시결과.json')) || {};
    // 한 계정에 줄이 여럿이면(작업실 길은 다시 걸 때마다 줄을 더한다) 뒤에서부터 읽어 걸려 있는 줄이나 거둔 줄(보류 · 지움)을 먼저 만나면
    // 그 줄, 없으면 마지막 줄 — 게시 장부 · 돌림표와 같은 읽기(rowOf). 마지막 줄만 보면 「예약됨 · (다른 작업의) 취소됨」 꼴이 빈 칸으로 읽혀
    // 한 번 더 걸게 되고, 첫 걸린 줄만 보면 거둔 예약(예약됨 → 보류)이 채움으로 읽힌다.
    const done = new Map();
    for (const account of new Set((result.판 || []).map((p) => p && p.계정).filter(Boolean))) done.set(account, rowOf(result.판, account));
    // 아직 걸 판(준비.json 「판」 번호) — 예약 · 게시 · 거둔 판(보류 · 지움)이 아니고 시각이 안 지난 판.
    // 「지움」(공개한 판을 지움)도 거둔 판이다(11-11 P3-3) — rowOf는 거둔 줄로 읽는데 여기서만 걸 판으로 세어 「슬롯이 지났는데 예약도 게시도 안 됨」이 났다
    const pending = new Set((prep.판 || []).flatMap((p, i) => (p && !DONE.has(done.get(p.계정)?.상태) && !WITHDRAWN.has(done.get(p.계정)?.상태)
      && !(Date.parse(p.시각) < now) ? [i] : [])));
    const needsBooking = pending.size > 0;
    const check = checkOf(prep, needsBooking);
    const added = addedAfterCheck(prep, path.join(ROOT, dir.name), pending);
    // ⑱ 미학 맹검(11-08 유호님 「그냥 지금부터 걸어」) — 준비.json 「검사」가 ⑱ 전에 남은 기록이어도, 아직 걸 판이 남은 편은
    // 지금의 게시/미학맹검.json으로 다시 본다(11-08 14시 회차가 옛 검사 기록만 보고 맹검 없는 비축 편을 건 뒤).
    const aesthetic = needsBooking ? aestheticBlock({ dir: path.join(ROOT, dir.name), prep }, videosOf(prep, path.join(ROOT, dir.name)), { 판본영상: 판본영상of(prep, path.join(ROOT, dir.name)) }) : null;
    const groups = { [prep.브랜드]: [], SHIFT: [] };
    for (const p of prep.판 || []) (String(p.계정 || '').startsWith('shift-') ? groups.SHIFT : groups[prep.브랜드]).push(p);
    for (const [brand, plates] of Object.entries(groups)) {
      if (!plates.length) continue;
      const warnings = [];
      const states = plates.map((p) => {
        const local = done.get(p.계정) || {};
        const at = Date.parse(p.시각 || local.시각 || '');
        // 거둔 판(보류 · 지움)은 이 표에서 모두 「보류」다 — 걸 판 · 빈 칸 · 지난 슬롯 셈이 한 가지로 본다
        let state = WITHDRAWN.has(local.상태) ? '보류' : local.상태;
        let url = local.주소 || null;
        let unseen = false; // 서버 수집기가 그 채널을 보는데 슬롯 뒤 공개 게시물이 없다(업로드표 「!」)
        if (server && local.방법 === '작업실') {
          const job = server.jobs.find((j) => j.id === local.작업);
          // 게시물 ID까지 적힌 「게시됨」은 공개를 직접 확인한 판 — 서버가 「확인 필요」로 내려도 그대로 둔다(10-27 관용구 퀴즈 #6 유튜브: AI 표시 비교 오판으로 unknown).
          const confirmed = local.상태 === '게시됨' && local.게시물ID;
          // 검토 링크를 승인해도 서버는 내보내는 순간까지 reviewWaiting을 남긴다 — 게시결과에 「승인」을 적은 「예약됨」은 예약됨으로 센다(10-27 E4 · B8).
          const approved = local.상태 === '예약됨' && local.승인;
          if (job && !confirmed) { state = serverState(job); if (approved && state === '승인 대기') state = '예약됨'; url = job.publicationUrl || url; }
          else if (!job && ['승인 대기', '예약됨'].includes(local.상태)) {
            warnings.push(`예약됨인데 서버에 없음: ${p.계정} · ${dir.name}`);
            state = '서버에 없음';
          }
        } else if (server && state === '예약됨' && Number.isFinite(at) && at + GRACE_MS < now) {
          const ids = channelsFor(p.계정, accounts, server);
          const seen = ids.length ? server.posts.find((post) => ids.includes(post.channelId) && Math.abs(Date.parse(post.publishedAt) - at) <= WINDOW_MS) : null;
          if (seen) { state = '게시됨'; url = url || seen.url; } else if (ids.length) { unseen = true; warnings.push(`슬롯이 지났는데 나가지 않음: ${p.계정} · ${whenText(at, accounts[p.계정])} · ${dir.name}`); }
        }
        // 작업실 줄 뒤에 거둔 줄을 덧붙인 판(11-11 P3-4) — 거둔 줄에는 「방법: 작업실」이 없어 위 서버 대조를 건너뛴다. 그 계정의 앞선 작업실
        // 줄의 작업이 서버에 살아 있으면(예약 · 승인 대기 · 게시됨) 장부는 거뒀는데 글은 나간다 — 서버 상태로 보이고 알린다.
        if (server && WITHDRAWN.has(local.상태)) {
          const before = (result.판 || []).filter((r) => r && r.계정 === p.계정 && r !== local && r.방법 === '작업실' && r.작업).pop();
          const job = before ? server.jobs.find((j) => j.id === before.작업) : null;
          const alive = job ? serverState(job) : null;
          if (alive && ['승인 대기', '예약됨', '게시됨'].includes(alive)) {
            warnings.push(`거둔 판(${local.상태})인데 작업실 서버에는 ${alive}: ${p.계정} · ${dir.name} — 작업실에서 그 작업을 취소하거나(node tools/작업실예약.js 상태), 걸어 둘 판이면 게시결과의 ${local.상태} 줄을 뺀다`);
            state = alive;
            url = job.publicationUrl || url;
          }
        }
        // 걸린(공개 전) 돌림 판의 판본이 걸린 뒤 무효가 됐거나 다시 구워졌으면 알린다(11-11) — 걸 때는 통과였어도 그 뒤 판본 글 · 영상을 고쳤거나
        // 다시 받은 검수에서 떨어지면, 그대로 둔 예약이 검수 안 된 영상을 공개한다. 다 걸린 편은 「검사 고칠 것」에 안 잡혀 이 줄이 유일한 알림이다.
        if (p.돌림 && ['예약됨', '거는 중'].includes(local.상태) && Number.isFinite(at) && at > now) {
          let stale = null;
          try { stale = bookedVersionProblem(path.join(ROOT, dir.name), prep, p, local, { required, accounts }); } catch { /* 판본을 못 읽으면 넘긴다 */ }
          // 게시글 · 판본 상태를 못 읽어 견줄 수 없는 것은 「바뀜」이 아니다(11-12 P1-지1) — 다른 줄로 보이고 「내려라」를 말하지 않는다(걸린 뒤 바뀜은 묻지 않고 내리는 걸음이다)
          if (stale && stale.unreadable) warnings.push(`걸린 돌림 판의 ${stale.text ? '게시글을' : '판본 상태를'} 읽지 못함: ${p.계정} · ${dir.name} · 공개 ${whenText(at, accounts[p.계정])} — 판본 ${stale.key}: ${stale.why}. 예약은 내리지 않는다 — ${stale.file ? `${stale.file}을(를)` : '그 파일을'} 읽히게 고친 뒤 예약 큐를 다시 본다(읽힌 뒤에 「걸린 뒤 바뀜」이 뜨면 그때 내린다)`);
          else if (stale) warnings.push(`걸린 돌림 판의 판본이 걸린 뒤 바뀜: ${p.계정} · ${dir.name} · 공개 ${whenText(at, accounts[p.계정])} — 판본 ${stale.key}: ${stale.why}. 공개 전에 그 플랫폼 예약을 내리고 「게시장부 끝 --상태 실패 --확인」 → 「돌림표 --다시 --쓰기」 → 고친 판으로 다시 건다`);
        }
        // 게시 장부 잠금(11-10, tools/게시장부.js) — 2시간 넘은 「거는 중」은 끊긴 회차다: 그 플랫폼 예약 목록부터 읽고 닫는다
        if (local.상태 === '거는 중' && now - Date.parse(local.거는중 || 0) > GRACE_MS) {
          warnings.push(`거는 중이 2시간 넘음: ${p.계정} · ${dir.name} — 그 플랫폼 예약 목록부터 읽고 node tools/게시장부.js 끝 · 풀기`);
        }
        if (Number.isFinite(at) && at + GRACE_MS < now && at > now - LOOKBACK_DAYS * 86400000 && !DONE.has(state) && state !== '보류') {
          warnings.push(`슬롯이 지났는데 예약도 게시도 안 됨: ${p.계정} · ${whenText(at, accounts[p.계정])} · ${dir.name}`);
        }
        // 슬롯을 놓쳐 다른 날 손으로 올린 판은 게시결과의 실제 시각으로 센다(10-27 — 10-26 22:00 간체 판이 10-27 01:14에 나갔는데 10-26 칸에 잡혀 10-27 칸이 비어 보였다).
        const posted = DONE.has(state) && !local.방법?.startsWith?.('작업실') && Number.isFinite(Date.parse(local.시각 || '')) ? local.시각 : null;
        return { account: p.계정, platform: accounts[p.계정]?.platform || null, time: posted || p.시각 || null, state: state || null, method: local.방법 || null, url, unseen,
          ...(p.돌림 ? { rotation: true } : {}) };
      });
      // 검사 뒤 판이 더해진 편은 「다시 검사」 — 까닭에 그 판 계정을 적는다(검사 뒤 영상이 바뀐 것과 함께면 둘 다)
      const plus = added.filter((a) => plates.some((p) => p.계정 === a));
      items.push({
        brand, folder: dir.name, title: prep.제목 || dir.name, slot: slotOf(prep),
        kind: prep.성격 || null, role: prep.역할 || null, deadline: prep.시한 || null,
        state: pieceState(states),
        failed: states.filter((s) => s.state === '실패').length,
        check: check.stale || plus.length ? '다시 검사' : aesthetic ? '고칠 것' : check.result,
        checkWhy: plus.length ? `검사 뒤 ${check.stale ? '영상 바뀜 · ' : ''}판이 더해짐(${plus.join(', ')})` : !check.stale && aesthetic ? aesthetic : null,
        ...(plus.length ? { added: plus } : {}),
        plates: states, warnings,
      });
    }
  }
  return items;
}

// 판들의 상태로 본 편(또는 그날 판들)의 상태 — 모두 예약 · 게시면 채움, 일부면 일부, 모두 보류면 보류, 아니면 승인 대기
function pieceState(states) {
  const filled = states.filter((s) => DONE.has(s.state)).length;
  const held = states.filter((s) => s.state === '보류').length;
  return filled === states.length ? '채움' : filled ? '일부' : held === states.length ? '보류' : '승인 대기';
}

const fixNeeded = (x) => x.state !== '채움' && ['고칠 것', '다시 검사'].includes(x.check);
// 판이 든 날 — 그 계정의 현지 날짜(timeZone, 없으면 한국 시각).
const dayOf = (plate, item, accounts = {}) => (plate.time && Number.isFinite(Date.parse(plate.time)) ? T.localDate(Date.parse(plate.time), T.tzOf(accounts[plate.account])) : item.slot);
// 아직 걸 판(예약 · 게시 · 보류 아님)이 든 날들(그 계정 현지 날짜, 겹침 없이 차례대로)
const pendingDays = (item, accounts) => [...new Set(item.plates.filter((p) => !DONE.has(p.state) && p.state !== '보류').map((p) => dayOf(p, item, accounts)).filter(Boolean))].sort();

// 매일 판의 줄(sns-계정.json dailyLine). 막힌 계정(dailyBlocked)은 줄에 적되 셈에서 뺀다. dailyFrom이 「미정」인 계정(11-10 LAB 나라별 —
// 5일치 비축을 건 날 연다)은 「시작 전」으로 따로 보이고 셈에서 뺀다.
function dailyLines(accounts) {
  const lines = new Map();
  for (const [key, a] of Object.entries(accounts)) {
    if (!a.dailyLine) continue;
    if (!lines.has(a.dailyLine)) lines.set(a.dailyLine, { line: a.dailyLine, accounts: [], blocked: [], pending: [] });
    if (a.dailyBlocked) lines.get(a.dailyLine).blocked.push({ account: key, reason: a.dailyBlocked });
    else if (T.notStarted(a)) lines.get(a.dailyLine).pending.push(key);
    else lines.get(a.dailyLine).accounts.push(key);
  }
  const rank = (l) => (LINE_ORDER.includes(l) ? LINE_ORDER.indexOf(l) : LINE_ORDER.length);
  return [...lines.values()].sort((x, y) => rank(x.line) - rank(y.line) || x.line.localeCompare(y.line));
}
const blockedAccounts = (accounts) => dailyLines(accounts).flatMap((l) => l.blocked.map((b) => ({ ...b, line: l.line })));
// 시작 전 계정과 아직 못 여는 까닭(설계 4 · 5 — 씨앗이 아니면 프로필 · 예약 경로가 확인돼야 돌림표가 칸을 준다).
function pendingAccounts(accounts) {
  return dailyLines(accounts).flatMap((l) => l.pending.map((key) => {
    const a = accounts[key];
    const why = [];
    if (!a.rotationSeed && a.publicProfileComplete !== true) why.push('프로필');
    if (!a.rotationSeed && a.postRouteVerified !== true) why.push('예약 경로');
    return { account: key, line: l.line, platform: a.platform, why };
  }));
}

// 계정별: 판 계정마다 그 날 판이 예약·게시됐는지. 매일 판 계정은 비어 있어도 줄을 낸다.
function accountRows(items, range, accounts = {}) {
  const rows = new Map();
  const rowOf = (account, brand) => {
    if (!rows.has(account)) rows.set(account, { account, brand, line: accounts[account]?.dailyLine || null, byDay: Object.fromEntries(range.map((d) => [d, []])) });
    return rows.get(account);
  };
  // 블로그 판은 영상이 공개된 뒤 쇼츠 주소를 넣어 거니, 같은 편(폴더)의 영상 판이 예약·게시면 그 블로그 칸도 채움으로 본다(10-26).
  // SHIFT 블로그 판은 collect가 따로 떼어 SHIFT 줄로 두니 편 폴더로 맞춘다.
  const videoDone = new Set(items.flatMap((x) => (x.plates.some((p) => !BLOG.has(p.platform) && DONE.has(p.state)) ? [x.folder] : [])));
  for (const item of items) {
    for (const plate of item.plates) {
      if (!plate.account) continue;
      const day = dayOf(plate, item, accounts);
      if (!day || !range.includes(day)) continue;
      const done = DONE.has(plate.state) || (BLOG.has(plate.platform) && videoDone.has(item.folder));
      // 보류 판(버린 편)은 나가지 않으니 그 편의 옛 「고칠 것」 검사로 그날 칸을 막지 않는다(10-30 B2 보류 + 같은 날 B15).
      rowOf(plate.account, item.brand).byDay[day].push({ state: plate.state, done, folder: item.folder, fix: plate.state !== '보류' && fixNeeded(item),
        title: item.title, time: plate.time, url: plate.url, unseen: plate.unseen, platform: plate.platform });
    }
  }
  // 시작 전(dailyFrom 「미정」) 계정은 판이 없으면 줄을 내지 않는다(「시작 전」 한 줄로 따로 보인다).
  for (const [key, a] of Object.entries(accounts)) if (a.dailyLine && !a.dailyBlocked && !T.notStarted(a)) rowOf(key, a.dailyLine.startsWith('LAB') ? 'LAB' : a.dailyLine);
  // 하루 두 칸 계정은 앞 칸을 줄로 떼어 낸다(「lab-instagram 이야기」) — 판은 현지 시각이 가장 가까운 칸에, 그 칸이 아직 안 열린 날은 쉼.
  for (const row of [...rows.values()]) {
    const a = accounts[row.account];
    if (!a?.dailyLine) continue;
    // 줄이 안 열린 날(dailyFrom 앞)은 원래 칸도 쉼
    row.closed = range.filter((d) => !T.slotsOn(a, d).length);
    const extras = extraSlots(row.account, a);
    if (!extras.length) continue;
    row.base = row.account;
    row.slot = lastSlot(a);
    for (const x of extras) {
      const sub = { account: x.key, base: row.account, slot: x.time, brand: row.brand, line: row.line, byDay: Object.fromEntries(range.map((d) => [d, []])), closed: [] };
      for (const d of range) {
        if (!slotOpen(a, d, x.time)) { sub.closed.push(d); continue; }
        const keep = [];
        for (const p of row.byDay[d]) (T.slotFor(p.time, a).time === x.time ? sub.byDay[d] : keep).push(p);
        row.byDay[d] = keep;
      }
      rows.set(x.key, sub);
    }
  }
  // 닫힌 칸(11-10): 그 줄의 칸이 그날 안 열렸으면 쉼 — 마지막 칸(21:00 노래)을 dailyFormatsFrom 「미정」으로 닫아 둔 나라별 계정은 원래 줄도 쉼이다.
  // 첫 판 시험 계정(postRouteVerified 「첫판」)은 판이 달린 날만 칸이고 나머지는 쉼 — 첫 판을 확인해 true로 바꾸기 전에는 채울 칸이 아니다
  // (「만든 편 없음」으로 알리면 19:30 후보를 고르라는 뜻이 되는데, 이 칸은 확인을 기다리는 칸이다).
  for (const row of rows.values()) {
    const a = accounts[row.base || row.account];
    if (!a?.dailyLine) continue;
    const slot = row.base ? row.slot : lastSlot(a);
    const trial = isTrial(a);
    if (trial) row.trial = true;
    row.closed = [...new Set([...(row.closed || []), ...range.filter((d) => !slotOpen(a, d, slot) || (trial && !row.byDay[d].length))])];
  }
  for (const row of rows.values()) {
    row.off = range.filter((d) => (row.closed || []).includes(d) || resting(row.byDay[d], accounts[row.base || row.account], d));
    row.reserve = 0;
    for (const d of range.slice(1)) {
      if (row.byDay[d].some((p) => p.done) || row.off.includes(d)) row.reserve += 1; else break;
    }
    // 첫 판 시험 계정은 판이 달린 날 말고는 모두 쉼이라 위 셈이 「다 찼다」로 나온다 — 비축으로 세지 않는다(11-11 Fable 5.2 검수 P2-9)
    if (row.trial) row.reserve = null;
  }
  const order = (r) => (r.line ? LINE_ORDER.indexOf(r.line) + 1 || LINE_ORDER.length + 1 : LINE_ORDER.length + 2);
  return [...rows.values()].sort((a, b) => order(a) - order(b) || BRANDS.indexOf(a.brand) - BRANDS.indexOf(b.brand) || a.account.localeCompare(b.account));
}

// 한 계정 한 날 — 채움(예약·게시) · 만듦(올릴 준비·승인 대기 등) · 고칠 것 · 보류뿐 · 빔
function cellState(list) {
  if (!list.length) return '빔';
  if (list.some((p) => p.done)) return '채움';
  if (list.every((p) => p.state === '보류')) return '보류';
  if (list.some((p) => p.fix)) return '고칠 것';
  return '만듦';
}

// 줄 표: 줄마다 날짜별로 그 줄 계정들이 어떤지, 비축(내일부터 모든 계정 채움인 날 수), 만듦(내일부터 모든 계정에 편이 있는 날 수).
function lineRows(accountList, range, accounts) {
  const byAccount = new Map(accountList.map((r) => [r.account, r]));
  // 막힌 계정만 있는 줄은 셈하지 않는다(막힘 목록에만 보인다).
  return dailyLines(accounts).filter((l) => l.accounts.length).map((l) => {
    const byDay = {};
    // 하루 두 칸 계정은 칸마다 따로 센다(앞 시각 칸 「<계정> 12시」 → 원래 칸 순서) — 칸이 아직 안 열린 날은 쉼
    const keys = l.accounts.flatMap((a) => [...extraSlots(a, accounts[a]).map((x) => x.key), a]);
    for (const d of range) {
      const cells = Object.fromEntries(keys.map((k) => {
        const row = byAccount.get(k);
        const list = row?.byDay[d] || [];
        const cfg = accounts[row?.base || k];
        return [k, (row?.closed || []).includes(d) || resting(list, cfg, d) ? '쉼' : cellState(list)];
      }));
      const all = Object.values(cells);
      const states = all.filter((s) => s !== '쉼');
      // ○은 모든 칸에 나갈 편이 있을 때만 — 보류 칸(버린 편, 새 편 칸)이 끼면 빈 칸이 있는 날이라 ◐(11-11 Fable 5.2 검수 P3-9)
      const mark = !all.length ? '·' : !states.length ? '–' : states.every((s) => s === '채움') ? '●' : states.some((s) => s === '고칠 것') ? '✗'
        : states.every((s) => s === '빔') ? '·' : states.every((s) => s === '보류') ? '×' : states.every((s) => s === '채움' || s === '만듦') ? '○' : '◐';
      byDay[d] = { mark, cells };
    }
    const run = (ok) => { let n = 0; for (const d of range.slice(1)) { if (ok(byDay[d])) n += 1; else break; } return n; };
    // 첫 판 시험 계정만 있는 줄은 판이 달린 날 말고 모두 쉼(–)이라 비축 · 만듦이 「다 찼다」로 나온다 — 세지 않는다(null, 맨 위 비축 · 비축 알림 밖).
    // 그 계정들은 「첫 판 시험」 한 줄로 따로 보인다(11-11 Fable 5.2 검수 P2-9 — 판 0인 15곳이 「LAB 나라별 – – – – – 5일」로 보였다)
    const trial = l.accounts.every((a) => isTrial(accounts[a]));
    // 하루 두 칸 계정의 칸 이름(빈 칸 글이 「이야기 · 21:00 칸마다 한 편」, 형식이 없으면 「12:00 · 21:00 칸마다 한 편」을 쓰게) — 한 칸 계정은 넣지 않는다.
    // 「노래」 칸은 형식 이름 대신 시각으로 적는다 — 노래는 제작 회차가 만드는 칸이 아니다(씨앗의 21:00 칸은 노래 칸을 열기 전까지 지금 줄 편이
    // 채우고, 연 뒤에는 돌림표가 노래를 단다). 「노래 칸마다 한 편」이라고 쓰면 몽골 21:00에 노래를 만들라는 말로 읽힌다(11-11 Fable 검수).
    const times = Object.fromEntries(l.accounts.flatMap((a) => {
      const slots = T.allSlots(accounts[a]);
      if (slots.length < 2) return [];
      const name = (s) => (s.format && s.format !== '노래' ? s.format : s.time);
      return [...extraSlots(a, accounts[a]).map((x, i) => [x.key, name(slots[i])]), [a, name(slots[slots.length - 1])]];
    }));
    return { line: l.line, accounts: l.accounts, byDay, times, lead: leadOf(l.line), ...(trial ? { trial: true } : {}),
      reserve: trial ? null : run((x) => x.mark === '●' || x.mark === '–'),
      made: trial ? null : run((x) => Object.values(x.cells).every((s) => s === '채움' || s === '만듦' || s === '쉼')) };
  });
}

// 첫 판 시험 계정(원장 postRouteVerified 「첫판」)마다 첫 판이 어디까지 왔나 — 판 없음 · 걸기 전(판은 달렸는데 안 걸림) · 걸림(예약됨 · 거는 중) ·
// 나감(게시됨 — 공개 글을 확인하고 원장을 true로). 범위와 상관없이 모든 편에서 그 계정 판을 찾고(보류 판은 뺀다), 가장 앞선 판 하나를 보인다.
const TRIAL_RANK = { '판 없음': 0, '걸기 전': 1, 걸림: 2, 나감: 3 };
function trialAccounts(items, accounts, now) {
  const stage = (s) => (s === '게시됨' ? '나감' : s === '예약됨' || s === '거는 중' ? '걸림' : '걸기 전');
  return Object.entries(accounts).filter(([, a]) => a.dailyLine && isTrial(a)).sort(([x], [y]) => x.localeCompare(y)).map(([key, a]) => {
    const found = items.flatMap((x) => x.plates.filter((p) => p.account === key && p.state !== '보류').map((p) => ({
      state: stage(p.state), plate: p.state || null, folder: x.folder, day: dayOf(p, x, accounts), time: p.time || null })));
    found.sort((x, y) => TRIAL_RANK[y.state] - TRIAL_RANK[x.state] || String(x.day).localeCompare(String(y.day)));
    const best = found[0];
    if (!best) return { account: key, line: a.dailyLine, state: '판 없음' };
    const at = Date.parse(best.time || '');
    return { account: key, line: a.dailyLine, ...best, passed: Number.isFinite(at) && at < now };
  });
}

// 같은 날 같은 계정에 두 편(블로그 · 보류 판은 뺀다) — 계정마다 하루 한 편(결정 10-23 ①).
function doubleBookings(accountList) {
  const out = [];
  for (const row of accountList) {
    for (const [day, list] of Object.entries(row.byDay)) {
      const folders = [...new Set(list.filter((p) => p.state !== '보류').map((p) => p.folder))];
      // 하루 두 칸 계정은 칸마다 따로 센다 — 같은 칸(시각)에 두 편일 때만
      if (folders.length > 1 && !/(naverblog|tistory)$/.test(row.account)) out.push(`같은 ${row.slot ? `칸(${row.slot})` : '날'} 두 편: ${row.account} · ${day} · ${folders.join(', ')}`);
    }
  }
  return out;
}

// 작업실 검토 링크가 승인 전에 만료됐거나 24시간 안에 만료되는 편. 링크 기록에서 편 이름과 만료 시각만 읽는다.
function linkWarnings(items, now) {
  if (!LINK_DIR) return [];
  let names = [];
  try { names = fs.readdirSync(LINK_DIR).filter((n) => n.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const name of names) {
    const record = readJson(path.join(LINK_DIR, name));
    const until = Date.parse(record?.만료 || '');
    if (!record?.편 || !Number.isFinite(until)) continue;
    const waiting = items.some((x) => x.folder === record.편 && x.plates.some((p) => p.method === '작업실' && p.state === '승인 대기'));
    if (!waiting) continue;
    if (until <= now) out.push(`검토 링크가 승인 전에 만료: ${record.편} — 14시 게시 작업이 \`node tools/작업실예약.js 취소\` 뒤 다시 등록`);
    else if (until - now < 24 * 3600000) out.push(`검토 링크가 24시간 안에 만료(${new Date(until + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ')}): ${record.편}`);
  }
  return out;
}

async function loadServer(live) {
  if (live) {
    const 읽기 = require('./lib/작업실읽기.cjs');
    const data = await 읽기.읽기();
    const file = CACHE || path.join(STATE_DIR, '서버.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ version: 1, ...data }));
    return data;
  }
  if (!CACHE) return null;
  const cached = readJson(CACHE);
  if (!cached) return null;
  try { return require('./lib/작업실읽기.cjs').다듬기(cached); } catch { return null; }
}

function build(today, days, server, accounts, now) {
  const range = Array.from({ length: days }, (_, k) => addDays(today, k));
  const items = collect(server, accounts, now);
  const report = { today, range, brands: {}, unslotted: items.filter((x) => !x.slot) };
  for (const brand of BRANDS) {
    const mine = items.filter((x) => x.brand === brand && x.slot);
    const byDay = Object.fromEntries(range.map((d) => [d, mine.filter((x) => x.slot === d)]));
    // 그 브랜드의 매일 판 계정이 모두 쉬는 요일이면 빈 날도 비축에 든다(dailyDays).
    const daily = Object.values(accounts).filter((a) => a.dailyLine && !a.dailyBlocked && (a.dailyLine.startsWith('LAB') ? 'LAB' : a.dailyLine) === brand);
    const off = range.filter((d) => daily.length && daily.every((a) => resting(byDay[d], a, d)));
    let reserve = 0;
    for (const d of range.slice(1)) {
      if (byDay[d].some((x) => x.state === '채움') || off.includes(d)) reserve += 1; else break;
    }
    const late = mine.filter((x) => x.deadline && x.state !== '채움' && x.deadline < (x.slot || today));
    // 판 날(11-11 Fable 5.2 검수 P2-9): 슬롯은 그날이 아닌데(돌림 원본은 씨앗이 나간 옛 날, 슬롯 없는 편 포함) 판이 그날(그 계정 현지 날짜) 든 편 —
    // 그날 판만 추려 그 판들의 상태로 편 줄을 하나 더 낸다. 브랜드 표 · 브랜드 비축(byDay)은 그대로 슬롯으로 센다.
    const plateDays = Object.fromEntries(range.map((d) => [d, items.filter((x) => x.brand === brand && x.slot !== d).flatMap((x) => {
      const plates = x.plates.filter((p) => dayOf(p, x, accounts) === d);
      return plates.length ? [{ ...x, plates, state: pieceState(plates), failed: plates.filter((p) => p.state === '실패').length, plateDay: true }] : [];
    })]));
    report.brands[brand] = { reserve, byDay, late, off, plateDays };
  }
  report.accounts = accountRows(items, range, accounts);
  report.lead = LEAD;
  report.lines = lineRows(report.accounts, range, accounts);
  report.blocked = blockedAccounts(accounts);
  report.pending = pendingAccounts(accounts);
  report.trial = trialAccounts(items, accounts, now);
  // 첫 판 시험 계정만 있는 줄(비축 null)은 맨 위 비축에 넣지 않는다
  const counted = report.lines.filter((l) => l.reserve !== null);
  report.reserve = counted.length ? Math.min(...counted.map((l) => l.reserve)) : null;
  const today0 = todayCells(report, accounts, now);
  report.todayGaps = today0.open;
  report.todayPassed = today0.passed;
  // 보류 편은 나가지 않으니 검사가 「고칠 것」이어도 세지 않는다(10-23 — 알림이 고칠 것 하나만으로도 나가게 되면서).
  // 슬롯이 지났어도(돌림 원본 · 옮긴 판) 아직 걸 판이 오늘부터 든 편은 든다(11-11 Fable 5.2 검수 P2-9) — days는 그 판들의 날.
  report.fix = items.map((x) => ({ x, days: pendingDays(x, accounts).filter((d) => d >= today) }))
    .filter(({ x, days }) => fixNeeded(x) && x.state !== '보류' && ((x.slot && x.slot >= today) || days.length))
    .map(({ x, days }) => ({ ...x, days }));
  // 첫 판이 나갔는데 원장이 그대로 「첫판」이면 다음 판이 안 걸린다(게시 장부가 판 하나만 잡게 막는다)
  const trialOut = report.trial.filter((t) => t.state === '나감').map((t) => `첫 판이 나갔는데 원장이 아직 「${TRIAL}」: ${t.account} · ${t.day} · ${t.folder} — 공개 글을 로그인 없이 확인하고 sns-계정.json postRouteVerified를 true로`);
  report.warnings = [...new Set([...items.flatMap((x) => x.warnings), ...doubleBookings(report.accounts), ...linkWarnings(items, now), ...trialOut])];
  report.server = server ? { checkedAt: server.checkedAt, ageHours: server.checkedAt ? Math.round((now - Date.parse(server.checkedAt)) / 360000) / 10 : null } : null;
  return report;
}

function mark(list) {
  if (!list.length) return '·';
  if (list.some((x) => x.state === '채움')) return '●';
  if (list.some((x) => x.state === '일부')) return '◐';
  if (list.every((x) => x.state === '보류')) return '×';
  if (list.some((x) => x.state !== '보류' && fixNeeded(x))) return '✗';
  return '○';
}

function accountMark(list) {
  if (!list.length) return '·';
  if (list.some((p) => p.done)) return '●';
  if (list.every((p) => p.state === '보류')) return '×';
  if (list.some((p) => p.fix)) return '✗';
  return '○';
}

const WHY = { 빔: '만든 편 없음', 만듦: '승인·예약 전', '고칠 것': '검사 고칠 것', 보류: '보류 — 나가지 않아 새 편 칸' };

// 줄마다 내일~D+4에서 채움이 아닌 칸 — 「10-29 만든 편 없음 · 10-30 lab-tiktok 승인·예약 전」
function gapsOf(line, range) {
  const out = [];
  for (const d of range.slice(1, (line.lead || LEAD) + 1)) {
    const live = Object.entries(line.byDay[d]?.cells || {}).filter(([, s]) => s !== '쉼');
    const notDone = live.filter(([, s]) => s !== '채움');
    if (!notDone.length) continue;
    const kinds = [...new Set(notDone.map(([, s]) => s))];
    const whole = notDone.length === live.length && kinds.length === 1;
    // 하루 두 칸이 열린 날 통째로 비면 칸마다 한 편이 필요하다는 것을 함께 적는다(「만든 편 없음(12:00 · 21:00 칸마다 한 편)」)
    const order = (x) => (x === '이야기' ? 0 : x === '퀴즈' ? 1 : 2);
    const times = [...new Set(live.map(([k]) => line.times?.[k]).filter(Boolean))].sort((x, y) => order(x) - order(y) || x.localeCompare(y));
    out.push(`${d.slice(5)} ${whole ? WHY[kinds[0]] + (times.length > 1 ? `(${times.join(' · ')} 칸마다 한 편)` : '') : notDone.map(([a, s]) => `${a} ${WHY[s]}`).join(', ')}`);
  }
  return out;
}

// 오늘 칸이 채움(예약·게시)도 쉼도 아닌 계정 — 줄 순서대로 [{line, account, state, why}]. 막힌 계정은 줄에 없으니 여기도 없다.
// open은 아직 채울 수 있는 칸(「오늘 빈 계정」), passed는 그 계정 현지 시각으로 칸이 이미 지나 판이 더는 그 칸에 들 수 없는 칸이다
// (cellUntil — 11-11 Fable 5.2 검수 P3-9: 한국보다 앞선 시간대는 14시에 현지 13:00 칸이 지나 있는데 「오늘 빈 계정」으로 떠 채우라고 했다).
function todayCells(report, accounts = {}, now = Date.now()) {
  const d = report.range[0];
  const rows = new Map(report.accounts.map((r) => [r.account, r]));
  const open = [], passed = [];
  for (const l of report.lines) {
    for (const [account, state] of Object.entries(l.byDay[d]?.cells || {})) {
      if (state === '채움' || state === '쉼') continue;
      const row = rows.get(account);
      const a = accounts[row?.base || account];
      const gone = Boolean(a) && now >= cellUntil(a, d, row?.base ? row.slot : lastSlot(a));
      (gone ? passed : open).push({ line: l.line, account, state, why: WHY[state] });
    }
  }
  return { open, passed };
}
// 「LAB 두 채널 — lab-cn-xiaohongshu 만든 편 없음, lab-mm-tiktok 만든 편 없음 · yuhobuilds — …」
function todayGapText(gaps) {
  const lines = [...new Set(gaps.map((g) => g.line))];
  return lines.map((line) => `${line} — ${gaps.filter((g) => g.line === line).map((g) => `${g.account} ${g.why}`).join(', ')}`);
}

// 편 줄의 검사 글 — 「검사 뒤 영상 바뀜(다시 검사)」 · 「검사 뒤 판이 더해짐(계정) — 다시 검사」 · 「검사 고칠 것(까닭)」
function checkText(x) {
  if (x.check === '다시 검사') return x.checkWhy ? ` · ${x.checkWhy} — 다시 검사` : ' · 검사 뒤 영상 바뀜(다시 검사)';
  return { 통과: '', '검사 전': ' · 검사 전' }[x.check] ?? ` · 검사 ${x.check}${x.checkWhy ? `(${x.checkWhy})` : ''}`;
}

// 「첫 판 시험 15곳 — 판 없음 13 · 걸림(예약됨) 1 · 나감(게시됨 — 확인하고 원장을 true로) 1 — 판 없음: … · 걸림: lab-mx-youtube(11-12 편) · 나감: …」
function trialText(trial) {
  const by = (s) => trial.filter((t) => t.state === s);
  const counts = [`판 없음 ${by('판 없음').length}`, ...(by('걸기 전').length ? [`판 달림(걸기 전) ${by('걸기 전').length}`] : []),
    `걸림(예약됨) ${by('걸림').length}`, `나감(게시됨 — 확인하고 원장을 true로) ${by('나감').length}`];
  const where = (t) => `${t.account}(${String(t.day || '').slice(5)} ${t.folder}${t.plate && !['예약됨', '게시됨'].includes(t.plate) ? ` ${t.plate}` : ''}${t.state === '걸림' && t.passed ? ' · 시각 지남 — 공개 확인' : ''})`;
  const names = [['판 없음', (t) => t.account], ['걸기 전', where], ['걸림', where], ['나감', where]]
    .filter(([s]) => by(s).length).map(([s, f]) => `${s}: ${by(s).map(f).join(', ')}`);
  return `첫 판 시험 ${trial.length}곳(원장 postRouteVerified 「${TRIAL}」 — 판 하나만 걸고, 나간 판을 확인하면 true로) — ${counts.join(' · ')} — ${names.join(' · ')}`;
}

function print(report) {
  const { range } = report;
  if (report.lines.length) {
    console.log(`비축 ${report.reserve === null ? '– (셈할 줄 없음 — 첫 판 시험 줄뿐)' : `${report.reserve}일`} / 목표 ${report.lead}일(LAB 줄 ${LAB_LEAD}일) · 매일 판 줄 · ● 모든 계정 예약·게시  ○ 모든 계정에 편(승인·예약 전 있음)  ◐ 빈 계정 있음  ✗ 고칠 것  · 빔  – 쉬는 요일`);
    console.log('줄'.padEnd(12) + range.map((d) => d.slice(5)).join('  ') + '  비축  만듦');
    for (const l of report.lines) console.log(l.line.padEnd(12) + range.map((d) => l.byDay[d].mark.padEnd(5)).join('  ') + (l.reserve === null ? '  첫 판 시험(비축 셈 밖)' : `  ${l.reserve}일   ${l.made}일`));
    if (report.todayGaps.length) console.log(`  오늘(${report.today.slice(5)}) 빈 계정: ${todayGapText(report.todayGaps).join(' · ')}`);
    if (report.todayPassed?.length) console.log(`  오늘(${report.today.slice(5)}) 지난 빈 칸(그 계정 현지 시각으로 칸이 지나 채울 수 없음): ${todayGapText(report.todayPassed).join(' · ')}`);
    for (const l of report.lines) { const gaps = gapsOf(l, range); if (gaps.length) console.log(`  ${l.line} 빈 칸: ${gaps.join(' · ')}`); }
  }
  if (report.blocked.length) console.log(`  막혀 셈에서 뺀 계정: ${report.blocked.map((b) => `${b.account}(${b.reason})`).join(' · ')}`);
  if (report.pending.length) {
    const count = (list, f) => [...list.reduce((m, x) => m.set(f(x), (m.get(f(x)) || 0) + 1), new Map())].map(([k, n]) => `${k} ${n}`).join(' · ');
    const waiting = report.pending.filter((p) => p.why.length);
    console.log(`  시작 전(dailyFrom 「미정」 — 5일치 비축을 건 날 연다) ${report.pending.length}곳: ${count(report.pending, (p) => `${p.line} ${p.platform}`)}`
      + (waiting.length ? ` · 아직 못 엶: ${count(waiting.flatMap((p) => p.why.map((w) => ({ w }))), (x) => `${x.w} 확인 전`)}(node tools/돌림표.js가 계정마다 보인다)` : ''));
  }
  if (report.trial?.length) console.log(`  ${trialText(report.trial)}`);
  console.log(`예약 큐 · 오늘 ${report.today} · ● 채움  ◐ 일부  ○ 승인 대기  ✗ 고칠 것(검사)  × 보류(게시결과 「보류」)  · 빔`);
  console.log('브랜드'.padEnd(12) + range.map((d) => d.slice(5)).join('  ') + '  비축');
  for (const brand of BRANDS) {
    const b = report.brands[brand];
    console.log(brand.padEnd(12) + range.map((d) => (b.off.includes(d) ? '–' : mark(b.byDay[d])).padEnd(5)).join('  ') + `  ${b.reserve}일`);
  }
  if (report.accounts.length) {
    console.log(`계정별 · ● 예약·게시  ○ 승인 대기·준비  ✗ 고칠 것  · 빔  – 쉬는 요일`);
    for (const row of report.accounts) console.log(row.account.slice(0, 22).padEnd(23) + range.map((d) => (row.off.includes(d) ? '–' : accountMark(row.byDay[d])).padEnd(5)).join('  ') + (row.reserve === null ? '  첫판' : `  ${row.reserve}일`));
  }
  const head = (d, brand, x) => `  ${d} ${brand} ${x.state}${x.failed ? ` (실패 ${x.failed})` : ''} · ${x.title} · ${x.kind || '성격 없음'}${x.role ? ` · 역할 ${x.role}` : ''}${x.deadline ? ` · 시한 ${x.deadline}` : ''} · ${x.folder}`;
  for (const brand of BRANDS) {
    for (const d of range) {
      for (const x of report.brands[brand].byDay[d]) {
        const plates = x.plates.filter((p) => p.method === '작업실' || p.state === '승인 대기' || p.state === '서버에 없음');
        console.log(head(d, brand, x) + `${checkText(x)}${plates.length ? ` · ${plates.map((p) => `${p.account} ${p.state || '—'}`).join(', ')}` : ''}`);
      }
      // 판 날 줄 — 상태는 그날 판들로, 끝에 그날 판을 모두(돌림 판은 「돌림」) 적는다
      for (const x of report.brands[brand].plateDays?.[d] || []) {
        console.log(head(d, brand, x) + `${checkText(x)} · 이날 판(슬롯 ${x.slot || '없음'}): ${x.plates.map((p) => `${p.account}${p.rotation ? '(돌림)' : ''} ${p.state || '—'}`).join(', ')}`);
      }
    }
    for (const x of report.brands[brand].late) console.log(`  ! ${brand} 시한 넘김: ${x.title}(시한 ${x.deadline}, 슬롯 ${x.slot})`);
  }
  for (const x of report.unslotted) console.log(`  ? 슬롯 없음: ${x.brand} · ${x.title} · ${x.folder}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);
  console.log(report.server ? `서버 대조: ${report.server.checkedAt ? report.server.checkedAt.replace('T', ' ').slice(0, 16) + 'Z' : '시각 모름'} 읽음(${report.server.ageHours}시간 전)`
    : '서버 대조 없음 — 작업실 캐시가 없다(정기 작업 「SYNK 예약큐」가 node tools/예약큐.js --서버읽기 --알림으로 채운다)');
}

function send(text) {
  if (HERMES.startsWith('file:')) { fs.appendFileSync(HERMES.slice(5), text + '\n---\n'); return; }
  const r = 헤르메스.보내기(HERMES, TELEGRAM, text);
  if (!r.ok) throw new Error('텔레그램 보내기 실패: ' + r.error);
  if (r.note) console.error(r.note);
}

// 비축이 목표(4일)보다 모자라면 21시 뒤 하루 한 번 빈 칸을 한 통으로(10-26 — 10-23 「비축 모자람 알리지 않음」을 되돌림).
function reserveAlert(report, now) {
  if (!report.lines.length) return { sent: false, reason: 'no-lines' };
  // 첫 판 시험 계정만 있는 줄(비축 null)은 셈 밖이다 — null < 5가 참이 되지 않게 따로 뺀다
  const short = report.lines.filter((l) => l.reserve !== null && l.reserve < (l.lead || report.lead));
  if (!short.length) return { sent: false, reason: 'enough' };
  if (Number(new Date(now + 9 * 3600000).toISOString().slice(11, 13)) < RESERVE_ALERT_HOUR) return { sent: false, reason: 'before-hour' };
  const stateFile = path.join(STATE_DIR, '비축알림.json');
  if ((readJson(stateFile) || {}).day === report.today) return { sent: false, reason: 'same-today' };
  const text = [`[비축] ${report.today} · 목표 ${report.lead}일(LAB 줄 ${LAB_LEAD}일) · 지금 ${report.reserve}일`,
    ...short.map((l) => `${l.line} ${l.reserve}일 — ${gapsOf(l, report.range).join(' · ') || '--일수가 짧아 내일부터 칸을 못 봄'}`),
    '「만든 편 없음」은 19:30 후보에서 번호를 골라 주시면 07시가 만들고, 「승인·예약 전」은 검토 링크 승인이나 14시 「올려」로 채워져요'].join('\n');
  send(text);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ day: report.today, sentAt: new Date(now).toISOString() }));
  return { sent: true, text };
}

// 오늘 빈 계정이 남으면 17시(채울 시간이 남을 때) · 21시(슬롯 시각) 뒤 한 번씩 한 통으로(10-29).
const TODAY_ALERT_HOURS = [17, 21];
function todayAlert(report, now) {
  // 그 계정 현지 시각으로 이미 지난 칸(todayPassed — 11-11 P3-9)은 채우라고 하지 않고 「놓침」 한 줄로만 적는다
  const passed = report.todayPassed || [];
  if (!report.todayGaps.length && !passed.length) return { sent: false, reason: 'filled' };
  const hour = Number(new Date(now + 9 * 3600000).toISOString().slice(11, 13));
  const window = [...TODAY_ALERT_HOURS].reverse().find((h) => hour >= h);
  if (window === undefined) return { sent: false, reason: 'before-hour' };
  const stateFile = path.join(STATE_DIR, '오늘빈계정알림.json');
  const last = readJson(stateFile) || {};
  if (last.day === report.today && last.window === window) return { sent: false, reason: 'same-window' };
  const text = [`[오늘 빈 계정] ${report.today} · ${report.todayGaps.length}곳이 아직 예약·게시 전${passed.length ? ` · 현지 시각이 지난 빈 칸 ${passed.length}곳` : ''}`,
    ...todayGapText(report.todayGaps),
    ...(passed.length ? [`현지 시각이 지나 채울 수 없는 칸(놓침): ${todayGapText(passed).join(' · ')}`] : []),
    ...(report.blocked.length ? [`막혀 못 올리는 계정: ${report.blocked.map((b) => `${b.account}(${b.reason})`).join(' · ')}`] : []),
    ...(report.todayGaps.length ? ['오늘 안에 채워요 — 관문을 못 넘은 칸은 가장 나은 판으로(제작 절차 「매일 한 편」), 「승인·예약 전」은 검토 링크 승인이나 「올려」로'] : [])].join('\n');
  send(text);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ day: report.today, window, sentAt: new Date(now).toISOString() }));
  return { sent: true, text };
}

// 대조 경고·검사 「고칠 것」 편이 있을 때만 텔레그램으로. 같은 날 같은 내용은 다시 보내지 않는다(AI 없음).
// 비축 모자람은 reserveAlert가 따로 하루 한 번 보낸다.
// 10-30 유호님 「당분간은 텔레그램으로 검수승인(게시물관련)안해도 돼」 — 승인 대기 계정 · 검토 링크 만료 줄은 텔레그램에 넣지 않는다
// (승인은 노트북 앱 세션에서 받는다). 두 줄은 예약 큐 출력 · report.warnings에는 그대로 남아 세션이 본다.
// 「걸린 돌림 판의 판본이 걸린 뒤 바뀜」(11-11)도 텔레그램에 넣지 않는다 — 판본을 고치는 세션 · 14시 게시 회차가 예약 큐 출력에서 보고 바꿔 거는 일이다.
// 「걸린 돌림 판의 게시글을 · 판본 상태를 읽지 못함」(11-12)도 같다 — 원고 파일을 고치는 세션이 본다.
const APPROVAL_WARNING = /^(검토 링크가 |걸린 돌림 판의 )/;
function alert(report) {
  const warnings = report.warnings.filter((w) => !APPROVAL_WARNING.test(w));
  // SHIFT 판을 품은 편은 브랜드 줄과 SHIFT 줄 두 번 나오니 폴더로 한 번만 적는다. 까닭(맹검 · 검사 뒤 바뀜 · 판 더해짐)이 있으면 괄호에,
  // 슬롯이 지난 편(돌림 원본 · 옮긴 판)은 아직 걸 판의 날도 괄호에 적는다(11-11 Fable 5.2 검수 P2-9 — 어느 편 · 무슨 까닭인지).
  const fix = [...new Map(report.fix.map((x) => [x.folder, x])).values()].map((x) => {
    const why = x.check === '다시 검사' ? `${x.checkWhy || '검사 뒤 영상 바뀜'} — 다시 검사` : x.checkWhy;
    const days = !x.slot || x.slot < report.today ? (x.days || []).map((d) => d.slice(5)) : [];
    const extra = [why, days.length ? `판 ${days.join(', ')}` : null].filter(Boolean);
    return extra.length ? `${x.folder}(${extra.join(' · ')})` : x.folder;
  });
  if (!warnings.length && !fix.length) return { sent: false, reason: 'nothing' };
  const lines = [
    `[게시 큐] ${report.today}`,
    ...warnings.slice(0, 8).map((w) => `! ${w}`),
    ...(fix.length ? [`검사 「고칠 것」 편: ${fix.join(' · ')}`] : []),
  ];
  const text = lines.join('\n');
  const stateFile = path.join(STATE_DIR, '알림.json');
  const last = readJson(stateFile) || {};
  const key = `${report.today}|${text}`;
  // 그날 보낸 내용을 모두 기억한다 — 마지막 하나만 두면 A → A·B → A처럼 내용이 바뀌었다 돌아올 때 A가 다시 나간다(10-23 GPT 검수).
  const sentToday = last.day === report.today && Array.isArray(last.keys) ? last.keys : (last.key ? [last.key] : []);
  if (sentToday.includes(key)) return { sent: false, reason: 'same-today' };
  send(text);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const keys = [...sentToday.filter((k) => k.startsWith(`${report.today}|`)), key];
  fs.writeFileSync(stateFile, JSON.stringify({ day: report.today, key, keys, sentAt: new Date().toISOString() }));
  return { sent: true, text };
}

// ── 계정 전수 표(--계정표) ──
// 작업실(회사 서버)이 자동 게시로 올리는 판 — tools/작업실예약.js 머리말의 여섯 계정.
const WORKSPACE_PUBLISH = new Set(['lab-youtube', 'lab-instagram', 'synkbrief-instagram', 'synkbrief-youtube', 'yuhobuilds-instagram', 'yuhobuilds-youtube']);
// 플랫폼마다 올리는 길과 며칠 앞서 예약되는지. 11-10 조사(docs/마케팅/LAB_하루두편_설계_20261110/게시경로.md 1 · 8절)로 고침: 틱톡 10일은
// 공식 블로그, Business Suite 75일 · 샤오훙수 14일은 원문을 못 읽은 바깥 정리라 꼬리를 달고, 텔레그램 · 샤오훙수는 걸어 본 실측을 적는다.
const ROUTE = {
  workspace: ['작업실 자동(검토 링크 승인 뒤 서버가 올림)', '7일(링크 수명 = 슬롯+24시간, 최대 168시간)'],
  youtube: ['유튜브 스튜디오 예약 또는 tools/sns-발행.js', '제한 없음(공식 근거 못 찾음)'],
  instagram: ['Meta Business Suite 예약(ego)', '75일(바깥 정리 — 확인 전)'],
  facebook: ['Meta Business Suite 예약(ego)', '75일(바깥 정리 — 확인 전)'],
  tiktok: ['TikTok Studio 예약(그 계정 ego 프로필)', '10일'],
  xiaohongshu: ['크리에이터 센터 定时发布(ego)', '실측 4일 앞까지(14일은 바깥 정리)'],
  'naver-blog': ['네이버 예약 발행(Aside) — 첫 예약 확인 전, 막히면 붙여넣기 판', '확인 전'],
  tistory: ['티스토리 예약 발행(Aside)', '확인 전'],
  telegram: ['텔레그램 웹 예약 메시지(ego)', '실측 3일 앞까지'],
  threads: ['스레드 웹 예약(ego)', '로그인 뒤 확인'],
  x: ['X 웹 예약(ego)', '로그인 뒤 확인'],
  linkedin: ['링크드인 웹 예약(ego)', '로그인 뒤 확인'],
  'naver-clip': ['네이버 앱 전용 — 웹 올리기 없음(10-26 확인)', '—'],
  rutube: ['러튜브 스튜디오(손)', '확인 전'],
};
const LINE_WHAT = { 'LAB 영어': 'LAB 영어 편', 'LAB 몽골': 'LAB 몽골 편', 'LAB 나라별': 'LAB 나라별 돌림 판', synkbrief: 'synkbrief 편', yuhobuilds: 'yuhobuilds 편' };
// 돌림 계정(11-10)의 예약 경로 이름(sns-계정.json postRoute) → ROUTE 키
const ROUTE_OF = { workspace: 'workspace', 'youtube-studio': 'youtube', 'tiktok-studio': 'tiktok', 'meta-business-suite': 'instagram', 'telegram-web': 'telegram',
  'xhs-creator': 'xiaohongshu', 'douyin-creator': 'douyin', 'vk-web': 'vk', 'rutube-studio': 'rutube' };
ROUTE.douyin = ['더우인 크리에이터 센터 定时发布(ego) — 첫 예약 확인 전', '확인 전'];
ROUTE.vk = ['VK 커뮤니티 예약 글(ego) — 첫 예약 확인 전', '확인 전'];

function accountTable(accounts) {
  const what = (key, a) => {
    const slots = T.allSlots(a).filter((s) => s.time);
    const from = (v, label) => (v ? ` · ${v === T.PENDING ? `${label} 미정` : `${label ? `${label} ` : ''}${v.slice(5)}부터`}` : '');
    // 칸 시각은 그 계정 현지 시각(timeZone) — 하루 한 칸 · 시간대가 없으면 적지 않는다(옛 계정)
    const times = slots.length > 1 || a.timeZone ? ` 하루 ${slots.length}편(${slots.map((s) => `${s.time}${s.format ? ` ${s.format}` : ''}`).join(' · ')}${a.timeZone ? ` ${a.timeZone}` : ''}`
      + `${from(a.dailyTimesFrom, a.timeZone ? '앞 칸' : '')}${Object.entries(a.dailyFormatsFrom || {}).map(([f, v]) => from(v, `${f} 칸`)).join('')}${from(a.dailyFrom, '시작')}${a.language ? ` · ${a.language}` : ''})` : '';
    if (a.dailyLine === 'LAB 두 채널') return (a.platform === 'xiaohongshu' ? 'LAB 두 채널 판(간체)' : 'LAB 두 채널 판(버마어)') + times;
    const base = (LINE_WHAT[a.dailyLine] || a.dailyLine) + times + (a.dailyDays ? `(${[...String(a.dailyDays)].join(' · ')})` : '');
    return BLOG.has(a.platform) ? `${base}의 블로그 글` : base;
  };
  const readiness = (a) => {
    if (a.dailyBlocked) return `막힘 — ${a.dailyBlocked}`;
    const why = [];
    if (a.brand === 'LAB' && Array.isArray(a.dailyFormats) && !a.rotationSeed) {
      if (a.publicProfileComplete !== true) why.push('프로필 확인 전');
      if (a.postRouteVerified !== true) why.push('예약 경로 확인 전');
    }
    if (T.notStarted(a)) why.unshift('시작 전');
    return why.length ? why.join(' · ') : '—';
  };
  const rows = Object.entries(accounts).map(([key, a]) => {
    const routeKey = a.postRoute ? ROUTE_OF[a.postRoute] : null;
    // 원장에 예약 경로(postRoute)가 적힌 계정은 그 길을 보인다 — lab-instagram은 작업실 여섯 계정에 들지만 실제로는 Business Suite로 건다(11-10 조사)
    const [route, ahead] = (routeKey && ROUTE[routeKey]) || (WORKSPACE_PUBLISH.has(key) ? ROUTE.workspace : (ROUTE[a.platform] || ['—', '—']));
    const handle = String(a.handle || a.expectedHandle || '').replace(/\|/g, '/');
    if (a.dailyLine) return { key, order: 0, cells: [key, handle, what(key, a), route, ahead, readiness(a)] };
    return { key, order: 1, cells: [key, handle, '매일 판 밖', route, ahead, a.dailyOff || '정하지 않음'] };
  });
  const lineRank = (key) => { const l = accounts[key].dailyLine; return l ? (LINE_ORDER.indexOf(l) + 1 || 99) : 100; };
  rows.sort((x, y) => x.order - y.order || lineRank(x.key) - lineRank(y.key) || x.key.localeCompare(y.key));
  const daily = rows.filter((r) => r.order === 0);
  const pending = daily.filter((r) => r.cells[5].startsWith('시작 전')).length;
  return [`계정 ${rows.length}개 · 매일 판 ${daily.filter((r) => r.cells[5] === '—').length} · 막힘 ${daily.filter((r) => r.cells[5] !== '—' && !r.cells[5].startsWith('시작 전')).length}`
    + `${pending ? ` · 시작 전 ${pending}` : ''} · 매일 판 밖 ${rows.length - daily.length}`, '',
    '| 계정 | 핸들 | 매일 무엇이 | 올리는 길 | 며칠 앞서 | 막힌 것 · 까닭 |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.cells.join(' | ')} |`)].join('\n');
}

async function main() {
  // 기본은 5일(오늘 + 4일). --알림은 LAB 줄 비축 목표(5일)를 다 봐야 하니 --일수를 안 주면 오늘 + 5일을 본다(11-10)
  const days = Math.max(1, Number(argValue('--일수')) || (process.argv.includes('--알림') ? LAB_LEAD + 1 : 5));
  const accounts = (readJson(path.join(ROOT, 'sns-계정.json')) || {}).accounts || {};
  // 요일 글자가 아닌 dailyDays(「MWF」 등)는 모든 날을 쉼으로 만들어 그 줄이 조용히 멈추니 막는다.
  const badDays = Object.entries(accounts).filter(([, a]) => a.dailyDays !== undefined && !/^[일월화수목금토]+$/.test(String(a.dailyDays)));
  if (badDays.length) { console.error(`dailyDays는 요일 글자로만 적는다(예: "월수금"): ${badDays.map(([k, a]) => `${k}=${JSON.stringify(a.dailyDays)}`).join(', ')}`); process.exit(2); }
  if (process.argv.includes('--계정표')) { console.log(accountTable(accounts)); return; }
  // 시험용 --지금은 시각까지, --오늘은 그날 정오(한국 시각)를 지금으로 본다.
  const given = argValue('--지금') ? Date.parse(argValue('--지금')) : NaN;
  if (argValue('--지금') && !Number.isFinite(given)) { console.error('--지금은 YYYY-MM-DDTHH:MM+09:00 꼴로 준다'); process.exit(2); }
  const today = argValue('--오늘') || (Number.isFinite(given) ? kstDate(given) : kstDate());
  if (!isDay(today)) { console.error('--오늘은 실제 있는 날짜를 YYYY-MM-DD로 준다'); process.exit(2); }
  const now = Number.isFinite(given) ? given : argValue('--오늘') ? Date.parse(`${today}T12:00:00+09:00`) : Date.now();
  let server = null;
  try { server = await loadServer(process.argv.includes('--서버읽기')); } catch (error) {
    if (process.argv.includes('--서버읽기')) { console.error(`서버 읽기 실패: ${error.message}`); process.exitCode = 1; }
  }
  const report = build(today, days, server, accounts, now);
  if (process.argv.includes('--알림')) { report.alert = alert(report); report.reserveAlert = reserveAlert(report, now); report.todayAlert = todayAlert(report, now); }
  // 30분 정기 작업(--서버읽기)마다 앞뒤 1주 업로드표를 새로 쓴다(10-30 유호님 「1주일 앞뒤로 … o x 표시로 가시성 좋게 업로드 스케줄표」).
  // 표가 깨져도 대조 · 알림은 그대로 간다.
  if (process.argv.includes('--서버읽기') && !argValue('--폴더')) {
    const say = process.argv.includes('--json') ? console.error : console.log; // --json의 표준 출력은 JSON만
    try { say(`업로드표: ${require('./lib/업로드표.js').쓰기(build(addDays(today, -7), 15, server, accounts, now), { accounts, now, today })}`); }
    catch (error) { console.error(`업로드표 못 씀: ${error.message}`); }
  }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  print(report);
  if (report.alert?.sent || report.reserveAlert?.sent || report.todayAlert?.sent) console.log('텔레그램으로 알렸다');
}

// tools/업로드표.js가 같은 셈을 앞뒤 1주로 다시 쓴다.
module.exports = { build, loadServer, readJson, kstDate, addDays, ROOT, REPO, STATE_DIR };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
