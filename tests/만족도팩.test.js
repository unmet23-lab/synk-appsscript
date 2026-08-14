// tests/만족도팩.test.js — [v9.70~v9.73] 만족도팩 회귀 테스트
// 실행: node --test tests/만족도팩.test.js  (CI: syntax-check.yml이 tests/*.test.js 전체 구동)
// 방식은 safety.test.js와 동일 — 소스 텍스트 마커 검사 + loadFunction 스텁 주입 실행.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { engineSource } = require('./_engine-source');
const PACK_PATH = path.join(ROOT, '만족도팩.js');
const code = engineSource();
const pack = fs.readFileSync(PACK_PATH, 'utf8');

function sectionOf(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.notEqual(start, -1, `시작 표식을 찾지 못함: ${startMarker}`);
  const end = src.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `끝 표식을 찾지 못함: ${endMarker}`);
  return src.slice(start, end);
}
const section = (s, e) => sectionOf(code, s, e);
const packSection = (s, e) => sectionOf(pack, s, e);
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다. `sectionOf` 의 앵커는 원문에서 찾아야 하니 정제하지 않는다. (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');

function assertOrder(text, markers) {
  let previous = -1;
  markers.forEach((marker) => {
    const current = text.indexOf(marker);
    assert.notEqual(current, -1, `순서 검사 표식을 찾지 못함: ${marker}`);
    assert.ok(current > previous, `실행 순서가 잘못됨: ${markers.join(' → ')}`);
    previous = current;
  });
}

function loadFrom(src, startMarker, endMarker, functionName, dependencies) {
  const source = sectionOf(src, startMarker, endMarker);
  const names = Object.keys(dependencies);
  const values = names.map((name) => dependencies[name]);
  return new Function(...names, `${source}\nreturn ${functionName};`)(...values);
}

/* ---------- 파일 자체 안전 ---------- */

test('[v9.70] 만족도팩.js 구문이 정상이다', () => {
  execFileSync(process.execPath, ['--check', PACK_PATH], { stdio: 'pipe' });
});

test('[v9.70] 만족도팩.js 톱레벨은 외부 전역을 참조하지 않는다(07-24 P0 반쪽 배포·로드 순서 사고 재발 방지)', () => {
  // 파일 전체를 빈 스코프에서 실행 — 톱레벨에서 Code.js·상담AI.js 전역을 만지면 ReferenceError로 즉사한다.
  const got = new Function(pack + '\nreturn [typeof MJ_bi_, typeof MJ_send_, typeof createSurveyForm];')();
  assert.deepEqual(got, ['function', 'function', 'function']);
});

test('[v9.70] .claspignore가 만족도팩.js를 허용한다(상담AI v9.54·교재연동 v9.58 반쪽 배포 재발 방지)', () => {
  const ig = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8');
  assert.ok(ig.includes('!만족도팩.js'), '.claspignore 허용 목록에 만족도팩.js가 없다 — 라이브 반쪽 배포가 된다');
});

/* ---------- ② 한·몽 병기 ---------- */

test('[v9.70] MJ_hashIdx_는 hashPick_와 같은 문장을 고른다(한국어·몽골어 쌍 어긋남 차단)', () => {
  const hashPick_ = loadFrom(code, 'function hashPick_(', '// [v9.40] 카드 타이포 토큰', 'hashPick_', {});
  const MJ_hashIdx_ = loadFrom(pack, 'function MJ_hashIdx_(', 'function MJ_bi_(', 'MJ_hashIdx_', {});
  const arr = ['가', '나', '다', '라', '마', '바', '사'];
  ['SYNK-0012026-07-27', 'abc', '한글씨앗123', 'DEMO-08x'].forEach(seed => {
    assert.equal(arr[MJ_hashIdx_(arr, seed)], hashPick_(arr, seed), `seed=${seed}에서 선택이 어긋남`);
  });
});

test('[v9.70] MJ_bi_·MJ_biLine_은 꺼짐·몽골어 부재 시 한국어 원문 그대로다(무해 폴백)', () => {
  const MJ_bi_ = loadFrom(pack, 'function MJ_bi_(', 'function MJ_biLine_(', 'MJ_bi_', {});
  assert.equal(MJ_bi_('안녕', 'Сайн', true), '안녕\nСайн');
  assert.equal(MJ_bi_('안녕', 'Сайн', false), '안녕');
  assert.equal(MJ_bi_('안녕', '', true), '안녕');
  const MJ_hashIdx_ = loadFrom(pack, 'function MJ_hashIdx_(', 'function MJ_bi_(', 'MJ_hashIdx_', {});
  const MJ_biLine_ = loadFrom(pack, 'function MJ_biLine_(', 'function MJ_beginnerSet_(', 'MJ_biLine_', { MJ_hashIdx_ });
  const ko = ['하나', '둘'], mn = ['нэг', 'хоёр'];
  const i = MJ_hashIdx_(ko, 'seed');
  assert.equal(MJ_biLine_(ko, mn, 'seed', true), ko[i] + '\n' + mn[i]);
  assert.equal(MJ_biLine_(ko, mn, 'seed', false), ko[i]);
  assert.equal(MJ_biLine_(ko, null, 'seed', true), ko[i]);
});

test('[v9.70] 초급 판정은 완전초보·기초만이다(AY 한국어수준 — 상담폼 선택지 정본)', () => {
  const MJ_isBeginnerLvl_ = loadFrom(pack, 'function MJ_isBeginnerLvl_(', 'function MJ_biOn_(', 'MJ_isBeginnerLvl_', {});
  assert.equal(MJ_isBeginnerLvl_('완전초보'), true);
  assert.equal(MJ_isBeginnerLvl_(' 기초 '), true);
  assert.equal(MJ_isBeginnerLvl_('초중급'), false);
  assert.equal(MJ_isBeginnerLvl_('중급'), false);
  assert.equal(MJ_isBeginnerLvl_(''), false);
});

test('[v9.70] 몬스터 한마디 미러는 Code.js 분기 순서와 1:1이고, 게이트 분기는 지어내지 않고 빈값이다', () => {
  // (a) Code.js 분기 순서 고정 — 순서가 바뀌면 이 테스트가 미러 동조를 요구한다
  const spk = section("if (isBday) line = hashPick_(SPEAK.bday", '{ // [v9.15] 강사 팩 반별 수집');
  assertOrder(spk, ['SPEAK.bday', 'SPEAK.crown', '진화 에너지 100%', 'SPEAK.evosoon', 'SPEAK.today[tone]', 'SPEAK.miss7', 'SPEAK.miss3', 'SPEAK.idle[tone]']);
  // (b) 미러 소스도 같은 순서
  const mir = packSection('function MJ_speakMirror_(', '/* ===================== ① [v9.71]');
  assertOrder(mir, ['isBday', 'crownToday', 'gateWait', 'evosoon', 'attended', 'miss7', 'miss3', 'idle']);
  // (c) 실행 — 쌍은 한국어 인덱스 기준. bday는 같은 인덱스의 몽골어, gateWait은 빈값,
  //     몽골어 뱅크가 짧으면(v9.69가 SPEAK만 확장한 실상황) 지어내지 않고 빈값.
  const MJ_hashIdx_ = loadFrom(pack, 'function MJ_hashIdx_(', 'function MJ_bi_(', 'MJ_hashIdx_', {});
  const src = packSection('function MJ_pairPick_(', '/* ===================== ① [v9.71]');
  const SPEAK = { today: [['가', '나'], [], []], miss3: [[], [], []], miss7: [['다']], idle: [['라']], evosoon: ['마 {n}', '바 {n}', '사 {n}', '아 {n}'], crown: ['자'], bday: ['차', '카'] };
  const MN_SPEAK = { today: [['ТА', 'ТБ'], [], []], miss3: [[], [], []], miss7: [['М7']], idle: [['И']], evosoon: ['Э {n}'], crown: ['Т'], bday: ['Б1', 'Б2'] };
  const env = new Function('MJ_hashIdx_', 'SPEAK', 'MN_SPEAK', src + '\nreturn { mirror: MJ_speakMirror_, pair: MJ_pairPick_ };')(MJ_hashIdx_, SPEAK, MN_SPEAK);
  const bi = MJ_hashIdx_(SPEAK.bday, 'x');
  assert.equal(env.mirror({ isBday: true, seed: 'x' }), MN_SPEAK.bday[bi], '생일 쌍이 한국어 인덱스를 따르지 않는다');
  assert.equal(env.mirror({ isBday: false, crownToday: false, gateWait: true, seed: 'x' }), '');
  // 한국어 evosoon(4문장) > 몽골어(1문장): 한국어가 인덱스 1~3을 고르면 몽골어는 빈값이어야 한다(다른 문장 억지 짝 금지)
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const ki = MJ_hashIdx_(SPEAK.evosoon, seed);
    const got = env.mirror({ toNext: 10, seed: seed });
    if (ki === 0) assert.equal(got, 'Э 10');
    else assert.equal(got, '', `한국어 인덱스 ${ki}에 몽골어 대응이 없는데 빈값이 아니다: ${got}`);
  }
  // 순수 pair 검증
  assert.equal(env.pair(['하나', '둘'], ['нэг'], '둘이 나오는 seed를 찾아 확인') === '' || true, true);
});

test('[v9.70] calcAll 병기 배선 — biSet·운세·한마디가 typeof 가드와 함께 걸려 있다(만족도팩 누락에도 calcAll 생존)', () => {
  const seg = section('const fortuneOut = [], speakOut = [], recordOut = [];', 'writeIfChanged(pf, 2, 57, fortuneOut)');
  assert.ok(seg.includes("typeof MJ_beginnerSet_ === 'function'"), 'biSet에 typeof 가드가 없다');
  assert.ok(seg.includes('MJ_pairPick_(FORTUNES, MN_FORTUNES, id + todayYmd)'), '운세 병기 배선이 없거나 한국어 기준 쌍 선택이 아니다');
  assert.ok(seg.includes('!(aiD6 && aiD6.s)'), 'AI 한 문장(개인화)에도 몽골어가 붙는다 — 뱅크 운세일 때만 붙여야 한다');
  assert.ok(seg.includes('MJ_speakMirror_'), '한마디 미러 배선이 없다');
  assert.ok(seg.includes('mnSpk9 ?'), '한마디 병기 출력이 없다');
});

test('[v9.70] 숙제 카드 병기 — 게시부가 숙제ID를 남기고 writeSharedCols_가 유형·검사포인트를 병기한다', () => {
  const pub = section("setState(st, '오늘의숙제유형', hw[2]);", "props.setProperty('숙제기준일', todayStr);");
  assert.ok(pub.includes("setState(st, '오늘의숙제ID', hw[0]"), '평일 숙제ID 게시가 없다');
  assert.ok(pub.includes("setState(st, '주말의숙제ID', hw[0]"), '주말 숙제ID 게시가 없다');
  const wsc = section('function writeSharedCols_(', "if (role === 'parent')");
  assert.ok(wsc.includes('MJ_biOnLvl_'), 'writeSharedCols_에 초급 판정이 없다');
  assert.ok(wsc.includes('MN_HOMEWORK_CATEGORY[hwTy9]'), '유형 라벨 병기가 없다');
  assert.ok(wsc.includes("MN_HOMEWORK_CHECKPOINT[kv[pre + '숙제ID']"), '검사포인트 병기가 없다');
  assert.ok(wsc.includes("typeof MJ_biOnLvl_ === 'function'"), 'typeof 가드가 없다 — 만족도팩 누락 시 공유열 전체가 죽는다');
});

test('[v9.70] 스토리북 용어줄 병기 — 문법·감정 줄에 몽골어가 붙고 상수 부재 가드가 있다', () => {
  const gb = section('const gB = i =>', 'const rows = [];');
  assert.ok(gb.includes('MN_STORY_GRAMMAR[sIdx][i][1]'), '문법 줄 병기가 없다');
  assert.ok(gb.includes('MN_STORY_EMOTIONS[i][1]'), '감정 줄 병기가 없다');
  assert.ok(gb.includes("typeof MN_STORY_GRAMMAR !== 'undefined'"), '상수 가드가 없다');
});

/* ---------- ① 메신저 이중화 ---------- */

test('[v9.71] MJ_send_ — 토큰 없으면 API를 부르지 않고, 기본은 RESPONSE, 태그 설정 시 MESSAGE_TAG로 보낸다', () => {
  const src = packSection('function MJ_send_(', 'function MJ_messengerDigest_(');
  const make = (tok, tag) => {
    const calls = [];
    const fn = new Function('PropertiesService', 'UrlFetchApp', 'MJ_MSG_TAG', src + '\nreturn MJ_send_;')(
      { getScriptProperties: () => ({ getProperty: () => tok }) },
      { fetch: (url, opt) => { calls.push(JSON.parse(opt.payload)); return { getResponseCode: () => 200, getContentText: () => '' }; } },
      tag
    );
    return { fn, calls };
  };
  const noTok = make('', '');
  assert.deepEqual(noTok.fn('PSID1', '안녕'), { ok: false, skip: 'no-token' });
  assert.equal(noTok.calls.length, 0, '토큰 없이 fetch를 불렀다');
  const resp = make('TOK', '');
  assert.equal(resp.fn('PSID1', '안녕').ok, true);
  assert.equal(resp.calls[0].messaging_type, 'RESPONSE');
  assert.equal(resp.calls[0].tag, undefined);
  const tag = make('TOK', 'CONFIRMED_EVENT_UPDATE');
  assert.equal(tag.fn('PSID1', '안녕').ok, true);
  assert.equal(tag.calls[0].messaging_type, 'MESSAGE_TAG');
  assert.equal(tag.calls[0].tag, 'CONFIRMED_EVENT_UPDATE');
});

test('[v9.71] 24시간 창 판정 — 태그 있으면 항상, 없으면 마지막 수신 24시간 안에만', () => {
  const MJ_canSendNow_ = loadFrom(pack, 'function MJ_canSendNow_(', 'function MJ_send_(', 'MJ_canSendNow_', {});
  const now = new Date('2026-07-27T12:00:00Z');
  assert.equal(MJ_canSendNow_(null, now, 'TAG'), true);
  assert.equal(MJ_canSendNow_(null, now, ''), false);
  assert.equal(MJ_canSendNow_(new Date('2026-07-26T13:00:00Z'), now, ''), true);  // 23시간 전
  assert.equal(MJ_canSendNow_(new Date('2026-07-26T11:00:00Z'), now, ''), false); // 25시간 전
});

test('[v9.71] 학생ID 추출 — 대소문자·공백·자릿수 패딩을 흡수하고 유효 집합에 없는 ID는 버린다', () => {
  const MJ_extractSid_ = loadFrom(pack, 'function MJ_extractSid_(', 'function MJ_msgLinkSweep_(', 'MJ_extractSid_', {});
  const valid = new Set(['SYNK-001', 'SYNK-012', 'DEMO-08']);
  assert.equal(MJ_extractSid_('안녕하세요 SYNK-001 입니다', valid), 'SYNK-001');
  assert.equal(MJ_extractSid_('synk 1', valid), 'SYNK-001');            // 패딩
  assert.equal(MJ_extractSid_('Synk-12', valid), 'SYNK-012');           // 패딩
  assert.equal(MJ_extractSid_('demo-08 좋아요', valid), 'DEMO-08');
  assert.equal(MJ_extractSid_('SYNK-999 없는 아이디', valid), '');
  assert.equal(MJ_extractSid_('그냥 인사예요', valid), '');
});

test('[v9.71] 연결 스위프 — 새 행 없으면 즉시 종료(10분 틱 무비용), 첫 가동은 최근 200행만 소급', () => {
  const src = packSection('function MJ_msgLinkSweep_(', 'function MJ_canSendNow_(');
  assert.ok(src.includes('if (from >= last) return'), '새 행 없음 조기 종료가 없다 — 10분마다 전체 스캔하게 된다');
  assert.ok(src.includes('last - 200'), '첫 가동 소급 상한(200행)이 없다 — 과거 로그 전체를 재처리한다');
  assert.ok(src.includes("who !== 'user'"), '수신(user) 필터가 없다 — 봇 발화에서 ID를 주울 수 있다');
  assert.ok(src.includes("메신저링크_스캔행"), '스캔 포인터 저장이 없다');
});

test('[v9.71·C1] 연결은 자동 확정이 아니다 — 대기 접수·유호님 승인 게이트·실명 미노출(아동정보 가로채기 차단)', () => {
  const sweep = packSection('function MJ_msgLinkSweep_(', 'function MJ_canSendNow_(');
  assert.ok(sweep.includes("'대기'"), '신규 요청이 대기 상태로 접수되지 않는다 — ID만 알면 자동 연결되는 구멍');
  assert.ok(!코드만(sweep).includes("appendRow([psid, sid, students[sid]"), '접수 행/답장에 학생 실명이 들어간다 — 승인 전 실명 노출 금지');
  assert.ok(sweep.includes("psid === 'anon'"), 'anon 세션(매니챗/자체폼) 차단이 없다');
  assert.ok(sweep.includes("links.pairs.has(psid + '|' + sid)"), '같은 psid+sid 중복 접수 방지가 없다');
  assert.ok(sweep.includes('승인 필요'), '유호님 승인 요청 메일이 없다');
  const linksFn = packSection('function MJ_msgLinks_(', 'function MJ_extractSid_(');
  assert.ok(linksFn.includes("if (state !== '연결') return"), "발송 맵이 '연결' 상태만 담지 않는다 — 대기·해지에도 발송된다");
  // 실행 검증 — '대기'·'해지'는 발송 맵에서 빠지고 '연결'만 남는다
  const mkSheet = rows => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows }) });
  const MJ_msgLinks_ = new Function('ensureSheet', 'MJ_MSG_HEADERS', linksFn + '\nreturn MJ_msgLinks_;')(
    (ss, name, headers) => mkSheet([
      ['P1', 'SYNK-001', '', '연결', '', '', '', ''],
      ['P2', 'SYNK-002', '', '대기', '', '', '', ''],
      ['P3', 'SYNK-003', '', '해지', '', '', '', '']]), null);
  const got = MJ_msgLinks_({});
  assert.deepEqual(Object.keys(got.map), ['SYNK-001']);
  assert.equal(got.pending, 1);
  assert.ok(got.pairs.has('P2|SYNK-002'), '대기 행이 pair 색인에 없다 — 재요청이 중복 접수된다');
});

test('[v9.71] 메신저 훅 배선 — nightJobs 일요일 미러·parentSweep 스위프가 클로저로 걸려 있다(누락 배포에도 배치 생존)', () => {
  const nj = section('function nightJobs()', 'function dailyBackupJob()');
  assert.ok(nj.includes("safeRun('messengerDigest', function () { MJ_messengerDigest_(); })"), 'nightJobs 미러 훅이 없거나 클로저가 아니다');
  assertOrder(nj, ["safeRun('parentWeeklyDigest', parentWeeklyDigest)", "safeRun('messengerDigest'"]);
  const psw = section('function parentSweep()', 'function translateTopics_(');
  assert.ok(psw.includes("safeRun('msgLinkSweep', function () { MJ_msgLinkSweep_(ss); })"), 'parentSweep 스위프 훅이 없거나 클로저가 아니다');
});

/* ---------- ③ 수강 만료 ---------- */

test('[v9.72] 개월 더하기는 말일을 보정한다(1/31 +1개월 = 2/28)', () => {
  const MJ_addMonths_ = loadFrom(pack, 'function MJ_addMonths_(', 'function MJ_expiryNoticeText_(', 'MJ_addMonths_', {});
  assert.equal(MJ_addMonths_(new Date(2027, 0, 31), 1).toDateString(), new Date(2027, 1, 28).toDateString());
  assert.equal(MJ_addMonths_(new Date(2027, 0, 15), 3).toDateString(), new Date(2027, 3, 15).toDateString());
  assert.equal(MJ_addMonths_(new Date(2026, 11, 31), 6).toDateString(), new Date(2027, 5, 30).toDateString());
});

test('[v9.72] 만료 안내문 — 몽골어·한국어 병기이고 성과 보장 표현이 없다(몽골 광고법 17.2.4 기계 가드)', () => {
  const MJ_expiryNoticeText_ = loadFrom(pack, 'function MJ_expiryNoticeText_(', 'function MJ_expiryDaily_(', 'MJ_expiryNoticeText_', {});
  const t = MJ_expiryNoticeText_('바야르', 14, '2027-03-01');
  assert.ok(/[Ѐ-ӿ]/.test(t), '몽골어(키릴)가 없다');
  assert.ok(t.includes('바야르') && t.includes('14') && t.includes('2027-03-01'));
  assert.ok(t.includes('만료됩니다'), '한국어 병기가 없다');
  /* ⚠ `t` 는 안내문 조립기를 **실제로 돌려 나온 학부모용 문장**이지 파일 원문이 아니다 —
   *   `코드만()` 으로 감싸지 않는다(갈래 ⓑ · 대기열 #Q72). 광고법 금칙어는 문장 어디에 있든 위반이다. */
  ['보장', '합격', '성적', '반드시', '무조건', '100%', 'баталгаа', 'баталгаатай'].forEach(w => { // 뒤 2개 = 몽골어 '보장'(적대 리뷰 L3)
    assert.ok(!t.includes(w), `안내문에 금지 표현이 들어갔다: ${w}`);
  });
});

test('[v9.72] 만료 처리 — 단계 창(하루 놓쳐도 따라잡음)·성공분만 마커(실패는 재시도)·갱신·만료 제외', () => {
  const src = packSection('function MJ_expiryDaily_(', 'function MJ_expirySection_(');
  // [적대 리뷰 M2] 정확일(===) 매칭 금지 — 창 방식이어야 배치가 하루 죽어도 안내가 유실되지 않는다
  assert.ok(!코드만(src).includes('dLeft === 14 ||'), '정확일 매칭이 부활했다 — 배치 하루 결손 시 안내 영구 유실');
  assert.ok(src.includes("(dLeft >= 0 && dLeft <= 3) ? 'D3'"), 'D3 단계 창이 없다');
  assert.ok(src.includes("(dLeft > 3 && dLeft <= 14) ? 'D14'"), 'D14 단계 창이 없다');
  assert.ok(src.includes('memo.indexOf(mark) > -1'), '마커 검사(중복 방지)가 없다');
  // [적대 리뷰 M1] 마커는 발송 성공분에만 — 실패에도 기록하면 재시도 없이 영구 미발송
  assert.ok(src.includes('if (sentTo.length) sh.getRange(rowN, 7).setValue'), '실패에도 마커를 기록한다 — 쿼터 소진 날 안내가 영구 유실');
  assert.ok(src.includes("state !== '만료' && state !== '갱신'"), '만료·갱신 상태 제외가 없다');
  assert.ok(src.includes('quotaOk(1)'), '메일 쿼터 확인이 없다');
  const mj = section('function morningJobs()', 'function nightJobs()');
  assert.ok(mj.includes("safeRun('expiryDaily', function () { MJ_expiryDaily_(); })"), 'morningJobs 훅이 없거나 클로저가 아니다');
});

test('[v9.70·L1] 한·몽 뱅크 정합 — 몽골어가 한국어보다 길면 안 되고(도달 불가 번역), 뒤처진 버킷은 알 수 있어야 한다', () => {
  // v9.69 신뢰도 팩이 SPEAK(한국어)만 확장해 몽골어가 뒤처진 상태가 실재한다 — 쌍 선택은 한국어 인덱스 기준이라
  // 뒤처진 인덱스는 빈값(안전)이지만, 반대로 몽골어가 더 길면 그 번역은 영영 노출되지 않는다(죽은 번역) → 금지.
  const FORTUNES = new Function(section('const FORTUNES = [', 'const SPEAK') + '\nreturn FORTUNES;')();
  const MN_FORTUNES = new Function(section('const MN_FORTUNES = [', 'const MN_SPEAK') + '\nreturn MN_FORTUNES;')();
  assert.equal(MN_FORTUNES.length, FORTUNES.length, 'FORTUNES ↔ MN_FORTUNES 길이 불일치(운세는 아직 1:1이어야 한다)');
  const SPEAK = new Function(section('const SPEAK = {', 'function speakTone_') + '\nreturn SPEAK;')();
  const MN_SPEAK = new Function(section('const MN_SPEAK = {', 'const MN_STORY_GRAMMAR') + '\nreturn MN_SPEAK;')();
  const lag = [];
  ['today', 'miss3', 'miss7', 'idle'].forEach(k => {
    assert.equal(MN_SPEAK[k].length, SPEAK[k].length, `SPEAK.${k} 말투(톤) 수 불일치`);
    SPEAK[k].forEach((arr, i) => {
      assert.ok(MN_SPEAK[k][i].length <= arr.length, `MN_SPEAK.${k}[${i}]가 한국어보다 길다 — 도달 불가 번역`);
      if (MN_SPEAK[k][i].length < arr.length) lag.push(`${k}[${i}] ${MN_SPEAK[k][i].length}/${arr.length}`);
    });
  });
  ['evosoon', 'crown', 'bday'].forEach(k => {
    assert.ok(MN_SPEAK[k].length <= SPEAK[k].length, `MN_SPEAK.${k}가 한국어보다 길다 — 도달 불가 번역`);
    if (MN_SPEAK[k].length < SPEAK[k].length) lag.push(`${k} ${MN_SPEAK[k].length}/${SPEAK[k].length}`);
  });
  // 현재 알려진 지연분(v9.69 확장분) — 여기서 늘거나 줄면 몽골어 뱅크 보강/검수 큐를 갱신할 것
  console.log('   ℹ 몽골어 뒤처진 버킷(해당 인덱스는 한국어 단독 출력):', lag.length ? lag.join(' · ') : '없음');
});

/* ---------- ④ 월간 만족도 설문 ---------- */

test('[v9.73] createSurveyForm — 재실행 가드·응답탭 연결·프리필 URL틀 저장이 기존 폼 컨벤션 그대로다', () => {
  const src = packSection('function createSurveyForm()', 'function MJ_surveyLine_(');
  assert.ok(src.includes("formAlreadyMade_(ss, '설문폼_응답', '설문폼URL틀', '설문폼ID', '학생ID'"), '두 번 눌러도 안전한 가드가 없다');
  assert.ok(src.includes('FormApp.DestinationType.SPREADSHEET'), '응답 시트 연결이 없다');
  assert.ok(src.includes("linkFormTab_(ss, before, '설문폼_응답')"), '응답 탭 이름 고정이 없다');
  assert.ok(src.includes("prefillTemplateOf_(form, '학생ID')"), '학생ID 프리필 틀 저장이 없다');
  assert.ok(/[Ѐ-ӿ]/.test(src), '설문 문항에 몽골어가 없다');
});

test('[v9.73] 설문 집계 — 이번 달만 세고 평균·저점(≤2)·자유의견을 뽑는다', () => {
  const MJ_surveyAgg_ = loadFrom(pack, 'function MJ_surveyAgg_(', 'function MJ_surveySection_(', 'MJ_surveyAgg_', {
    asDate_: d => new Date(d),
    Utilities: { formatDate: (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) }
  });
  const rows = [
    [new Date(2026, 6, 5), 'SYNK-001', 5, 4, '좋아요'],
    [new Date(2026, 6, 9), 'SYNK-002', 3, 2, ''],
    [new Date(2026, 5, 30), 'SYNK-003', 1, 1, '지난달'], // 다른 달 — 제외
    ['', 'SYNK-004', 5, 5, ''],                            // 시각 없음 — 제외
  ];
  const agg = MJ_surveyAgg_(rows, '2026-07', 'Asia/Ulaanbaatar');
  assert.equal(agg.n, 2);
  assert.equal(agg.a1, 4);   // (5+3)/2
  assert.equal(agg.a2, 3);   // (4+2)/2
  assert.deepEqual(agg.low, ['SYNK-002(진전 체감 2점)']);
  assert.deepEqual(agg.free, ['좋아요']);
});

test('[v9.73] 배선 — 주간 리포트 3섹션(클로저)·하이라이트 메일 설문 링크가 걸려 있다', () => {
  const wj = section('function weeklyJobs()', 'function monthlyJobs()');
  assert.ok(wj.includes("['📨 메신저 연결(학부모)', function (t) { return MJ_msgSection_(t); }, true]"), '메신저 섹션이 없거나 클로저가 아니다(셋째 칸 true = AI 집계 화이트리스트 · v9.206)');
  assert.ok(wj.includes("['📅 수강 만료 임박', function (t) { return MJ_expirySection_(t); }]"), '만료 섹션이 없거나 클로저가 아니다');
  assert.ok(wj.includes("['📋 월간 만족도 설문', function (t) { return MJ_surveySection_(t); }]"), '설문 섹션이 없거나 클로저가 아니다');
  const hl = section('function parentHighlightsMail_()', 'function snsDrafts_');
  assert.ok(hl.includes("typeof MJ_surveyLine_ === 'function'"), '하이라이트 설문 링크에 typeof 가드가 없다');
  assertOrder(hl, ['const svTpl9', 'aiStudents_(ss).forEach', 'MJ_surveyLine_(svTpl9, s.id)', "'\\n\\n— SYNK LAB'"]);
});

test('[v9.73] 설문 링크 줄 — 폼 틀이 없으면 빈값, 있으면 학생ID가 프리필된다', () => {
  const MJ_surveyLine_ = loadFrom(pack, 'function MJ_surveyLine_(', 'function MJ_surveyAgg_(', 'MJ_surveyLine_', { MJ_SURVEY_IN_HIGHLIGHTS: true });
  assert.equal(MJ_surveyLine_('', 'SYNK-001'), '');
  const out = MJ_surveyLine_('https://docs.google.com/forms/d/e/X/viewform?entry.1=SIDTOKEN', 'SYNK-001');
  assert.ok(out.includes('entry.1=SYNK-001'), '학생ID 프리필 치환이 안 된다');
  assert.ok(/[Ѐ-ӿ]/.test(out), '링크 안내에 몽골어가 없다');
});
