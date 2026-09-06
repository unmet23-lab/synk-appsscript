'use strict';
/**
 * ↩️ 돌아온 학생의 «재료 창» — `exit_log` 가 다음에 줄 것을 바꾸는가 (대기열 #Q99 · 시트층 도달 5/5)
 *
 * ■ 왜 «실행» 검사인가
 *   도달 장부(`엔진_셋업확장.js` `수집도달_`)가 재는 것은 「지목한 파일의 코드에 탭 이름이 실재하는가」
 *   까지다 — 소비자를 적어 두고 읽는 몸을 비워도 초록이다(설계 §8 「⚠ 천장」). 그래서 여기서는
 *   `aiStudioBatch_` 와 `aiWeakMap_` 를 **가짜 의존으로 실제로 태워**, 모델에게 건네는 문자열이
 *   `exit_log` 유무에 따라 정말 달라지는지를 잰다.
 *
 * ■ 이 칸은 「exit_log 를 읽는 코드가 있나」로 물으면 **짓기 전에도 초록**이었다
 *   — `syncProfiles` 가 중복 append 를 막으려고 이미 A열을 되읽기 때문이다(그래서 08-16 사유의
 *   「읽는 자리가 0이다」는 표현부터 틀렸다). 그 읽기는 산출을 안 바꾼다. 그래서 이 파일의 검사는
 *   하나도 «읽는가»로 두지 않고 전부 **«프롬프트가 달라지는가 / 창이 어디에 서는가»**로 물었다.
 *
 * ■ 이 시험이 틀릴 때의 모습 (대가를 함께 적는다)
 *   `aiStudioBatch_` 는 ①~④ 중 ① 만 의존이 채워져 나머지는 던진다 → `태우기` 가 예외를 삼킨다.
 *   그 삼킴이 ① 자체의 실패까지 가리므로 **잡힌 호출이 0건이면 실패로 떨어뜨린다**(미실행은 통과와
 *   같은 모양이다 · F207). 분모를 늘 함께 단언하는 이유가 이것이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');

const code = engineSource();

function section(시작, 끝) {
  const s = code.indexOf(시작);
  assert.notEqual(s, -1, `시작 표식을 찾지 못함: ${시작}`);
  const e = code.indexOf(끝, s + 시작.length);
  assert.notEqual(e, -1, `끝 표식을 찾지 못함: ${끝}`);
  return code.slice(s, e);
}
function 불러오기(시작, 끝, 이름, 의존) {
  const src = section(시작, 끝);
  const n = Object.keys(의존);
  return new Function(...n, `${src}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}

const QUIZ_LOG_HEADERS = JSON.parse(
  code.match(/const QUIZ_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const QUIZ_CONFIDENCE = JSON.parse(
  code.match(/const QUIZ_CONFIDENCE = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
/* [2026-09-02 · 학생ID 종단 ㉡] exit_log 헤더는 정본(엔진_운영배치.js EXIT_LOG_HEADERS · 8칸 · v9.312 끝에 이름_몽골)에서 뜬다 — 손 사본 5칸이면
 *   정본이 늘어도 이 픽스처는 옛 모양으로 초록이라, 「끝에 붙였으니 r[3] 은 안 흔들린다」를 재는 자가 없다. */
const EXIT_LOG_HEADERS = JSON.parse(
  code.match(/const EXIT_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));

const toDate_ = 불러오기('function toDate_(v)', '\n// [opt] 셀값', 'toDate_', {});
/* 정본을 그대로 태운다 — 스텁으로 채우면 그 함수가 깨져도 이 시험이 초록이다. */
const 복귀창_ = 불러오기('const 복귀_공백상한일', '// 최근 약점 로더', '복귀창_', { toDate_ });
const 공백상한일 = Number(code.match(/const 복귀_공백상한일 = (\d+);/)[1]); // 리터럴을 시험에 두 번 안 적는다
const aiWeakMap_ = 불러오기(
  'function aiWeakMap_(ss, 복귀)', 'function 오류뱅크전진_(', 'aiWeakMap_', { toDate_ });

const 날 = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};

/** exit_log 한 행 — 정본 헤더 8칸(student_id·이름·반·퇴소감지일·재원일수·종료사유·종료일·이름_몽골). 종료사유·종료일은 사람이 적는 칸이라 빈다. */
const 퇴소행 = (sid, 며칠전, 재원 = 60) => {
  const r = new Array(EXIT_LOG_HEADERS.length).fill('');
  r[0] = sid; r[3] = 날(며칠전); r[4] = 재원;
  return r;
};
/** student_errors 한 행 — 로더가 보는 8칸만 채운다(r0 날짜 · r1 학생ID · r3 유형 · r4 메모 · r7 상태). */
const 오류행 = (sid, 며칠전, 유형 = '조사', 메모 = '을/를') => {
  const r = new Array(8).fill('');
  r[0] = 날(며칠전); r[1] = sid; r[3] = 유형; r[4] = 메모; r[7] = '';
  return r;
};
/** quiz_log 한 행 — 정본 헤더 폭에 맞춘다. */
const 퀴즈행 = (sid, 며칠전, 판정 = '오답') => {
  const r = new Array(QUIZ_LOG_HEADERS.length).fill('');
  r[0] = 'QL-' + sid + 며칠전; r[1] = sid; r[2] = 'Q-1'; r[3] = '조사'; r[4] = '학교( ) 간다';
  r[5] = '을'; r[6] = '에'; r[7] = 판정; r[8] = QUIZ_CONFIDENCE[0];
  r[9] = 날(며칠전); r[10] = new Date(); r[11] = 3; r[12] = 'v1';
  return r;
};

const 탭 = (헤더, 행들) => 시트흉내({ 첫행: 1, 행들: [헤더].concat(행들 || []) });

/**
 * `aiStudioBatch_` ① 절을 실제로 태우고 모델에게 건넨 것·로그를 돌려준다.
 * `퇴소들` 이 없으면 exit_log 탭 자체가 없다 — 종전(창 안 움직임)과 같은 판이다.
 */
function 태우기(옵션) {
  const o = 옵션 || {};
  const 학생들 = o.학생들 || [{ id: 'S1', lv: 3, fav: '', dream: '', pain: '' }];
  const 호출 = [], 로그 = [];
  const ql = o.퀴즈행들 ? 탭(QUIZ_LOG_HEADERS.slice(), o.퀴즈행들) : null;
  const el = o.퇴소들 ? 탭(EXIT_LOG_HEADERS.slice(), o.퇴소들) : null;
  const ad = 탭(['student_id', '날짜', '한문장', '퀴즈문제', '퀴즈정답해설']);
  /* `오류들` 을 주면 **약점맵도 정본을 태운다** — 그래야 「호출부가 창을 약점맵에 넘기는가」가 재진다.
   * 스텁으로 두면 그 배선을 끊어도 프롬프트가 안 변해 변이가 통째로 안 잡힌다(실측: 변이 ⑧ 구멍). */
  const se = o.오류들 ? 탭(['날짜', '학생ID', '', '유형', '메모', '', '', '상태'], o.오류들) : null;
  const ss = {
    getSheetByName: (n) => (n === 'quiz_log' ? ql : n === 'exit_log' ? el
      : n === 'student_errors' ? se : n === 'ai_daily' ? ad : null),
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar'
  };
  const fmt = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  const 배치 = 불러오기('function 퀴즈라벨_(', 'function welcomeStoryBatch_()', 'aiStudioBatch_', {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'KEY', setProperty: () => {}, deleteProperty: () => {} }) },
    Utilities: { formatDate: (dt, tz, f) => (f === 'yyyy-MM-dd' ? fmt(dt) : String(dt)), sleep: () => {} },
    Logger: { log: (m) => 로그.push(String(m)) },
    ensureSheet: (s, n) => (n === 'ai_daily' ? ad : 탭([])),
    aiStudents_: () => 학생들.map((s) => Object.assign({}, s)),
    aiWeakMap_: o.오류들 ? aiWeakMap_ : () => (o.약점 || {}),
    복귀창_,
    복귀_공백상한일: 공백상한일,
    aiCall_: (k, sys, usr) => { 호출.push({ 시스템: sys, 사용자: usr }); return { items: [] }; },
    AI_STUDIO_MAX_CALLS: 12,
    AI_DAILY_BATCH_SIZE: 15,
    toDate_,
    QUIZ_LOG_HEADERS,
    QUIZ_CONFIDENCE
  });
  try { 배치(); } catch (e) { 로그.push('__던짐__ ' + (e && e.message ? e.message : String(e))); }
  assert.ok(호출.length >= 1,
    '① 절이 한 번도 모델을 안 불렀다 — 이 시험은 미실행이지 통과가 아니다: ' + 로그.join(' / '));
  return { 사용자: 호출[0].사용자, 로그, 호출 };
}

/** 약점맵을 실제로 태운다 — student_errors 만 있는 판(hw_feedback 은 없다). */
function 약점재기(오류들, 퇴소들) {
  const se = 탭(['날짜', '학생ID', '', '유형', '메모', '', '', '상태'], 오류들);
  const el = 퇴소들 ? 탭(EXIT_LOG_HEADERS.slice(), 퇴소들) : null;
  const ss = { getSheetByName: (n) => (n === 'student_errors' ? se : n === 'exit_log' ? el : null) };
  return aiWeakMap_(ss, 퇴소들 ? 복귀창_(ss) : undefined);
}

/* ───────────────────── 1. 행동이 바뀐다 (도달의 정의) ───────────────────── */

test('[#Q99 5/5] exit_log 가 있으면 돌아온 학생의 프롬프트가 실제로 달라진다', () => {
  const 학생들 = [{ id: 'S1', lv: 3, fav: '', dream: '', pain: '' }];
  const 퀴즈행들 = [퀴즈행('S1', 40), 퀴즈행('S1', 41)]; // 통상 14일 창 **밖**
  const 없을때 = 태우기({ 학생들, 퀴즈행들 });
  const 있을때 = 태우기({ 학생들, 퀴즈행들, 퇴소들: [퇴소행('S1', 30)] });

  assert.ok(!없을때.사용자.includes('지난 퀴즈'),
    '창 밖 재료가 실렸다 — 통상 학생의 14일 창이 깨졌다(이 판의 안전판)');
  assert.ok(있을때.사용자.includes('지난 퀴즈'),
    '돌아온 학생인데 창이 안 넓어졌다 — exit_log 를 읽고도 다음에 줄 것이 안 바뀌면 도달이 아니다');
  assert.notEqual(있을때.사용자, 없을때.사용자,
    '두 판의 프롬프트가 **글자 하나 안 달라졌다** — 「읽는다」는 도달이 아니다(설계 §5)');
});

test('[#Q99 5/5] 호출부가 창을 «약점맵에도» 넘긴다 — 배선 한 가닥만 빠져도 여기서 빨개진다', () => {
  /* 🔴 이 검사가 없어서 변이 ⑧(`aiWeakMap_(ss, 복귀All_())` → `aiWeakMap_(ss)`)이 **구멍**으로 났다.
   *   함수를 따로 태우는 검사(아래)는 함수가 옳은지만 재고, 호출부가 그걸 **넘기는지**는 안 잰다.
   *   여기서는 약점맵도 정본을 태워, 모델이 받는 「약점:」 칸이 exit_log 유무로 갈리는지 본다. */
  const 학생들 = [{ id: 'S1', lv: 3, fav: '', dream: '', pain: '' }];
  const 오류들 = [오류행('S1', 40, '조사', '을/를')]; // 통상 14일 창 **밖**
  const 없을때 = 태우기({ 학생들, 오류들 });
  const 있을때 = 태우기({ 학생들, 오류들, 퇴소들: [퇴소행('S1', 30)] });
  assert.ok(!없을때.사용자.includes('을/를'), '창 밖 약점이 실렸다 — 통상 학생의 14일 창이 깨졌다');
  assert.ok(있을때.사용자.includes('을/를'),
    '호출부가 약점맵에 창을 안 넘겼다 — 같은 학생이 퀴즈 재료와 약점 재료에서 다른 사람이 된다');
});

test('[#Q99 5/5] 약점맵도 같은 창을 쓴다 — 한 학생이 두 산출에서 다른 사람이 되지 않는다', () => {
  const 오류들 = [오류행('S1', 40)];
  assert.deepEqual(약점재기(오류들), {},
    '통상 판에서 40일 전 오류가 들어왔다 — 14일 창이 깨졌다');
  const 넓힌판 = 약점재기(오류들, [퇴소행('S1', 30)]);
  assert.ok((넓힌판.S1 || []).length >= 1,
    '돌아온 학생의 떠나기 전 약점이 여전히 창 밖이다 — 개인 퀴즈가 급수 로테이션으로 떨어진다');
});

/* ───────────────────── 2. 창이 서는 자리 (안전판) ───────────────────── */

test('[#Q99 5/5] 통상 학생은 창이 안 움직인다 — 남의 창까지 넓히면 재료가 낡는다', () => {
  const 넓힌판 = 약점재기([오류행('S2', 40)], [퇴소행('S1', 30)]);
  assert.deepEqual(넓힌판, {},
    '퇴소 이력이 없는 S2 의 창까지 넓어졌다 — 컷이 학생별이 아니라 전역으로 내려갔다');
});

test('[#Q99 5/5] 창은 «넓어지기»만 한다 — 오늘 나갔다 온 사람도 통상 창을 잃지 않는다', () => {
  /* Math.min 안전판. 이게 없으면 퇴소가 오늘일 때 컷이 «오늘-14일»보다 **뒤로** 갈 수 있고,
   * 그러면 넓히려던 코드가 거꾸로 자른다 — 겉모습은 「재료 없음」과 똑같다. */
  const 판 = 약점재기([오류행('S1', 3)], [퇴소행('S1', 0)]);
  assert.ok((판.S1 || []).length >= 1, '창이 좁아져 3일 전 오류가 사라졌다 — 넓히려다 잘랐다');
});

test('[#Q99 5/5] 퇴소감지일이 «미래»여도 창이 안 좁아진다 — 안전판이 실제로 일하는 자리', () => {
  /* 🔑 이걸 안 재면 `Math.min` 은 **변이로 증명할 수 없는 줄**이 된다(지우고 돌려도 초록).
   *   좁아짐이 실제로 나려면 컷이 앞으로 당겨져야 하고, 그건 퇴소감지일이 오늘보다 뒤일 때다 —
   *   시트 날짜 칸은 사람이 손으로 적는 자리라 이 값은 실제로 들어올 수 있다. */
  const 판 = 약점재기([오류행('S1', 12)], [퇴소행('S1', -5)]);
  assert.ok((판.S1 || []).length >= 1,
    '미래 퇴소일이 컷을 앞으로 당겨 12일 전 오류를 잘랐다 — 안전판 없이는 통상 창까지 좁아진다');
});

test(`[#Q99 5/5] 공백이 ${공백상한일}일을 넘으면 안 넓힌다 — 너무 낡은 약점은 그 사람의 지금이 아니다`, () => {
  const 판 = 약점재기([오류행('S1', 공백상한일 + 40)], [퇴소행('S1', 공백상한일 + 30)]);
  assert.deepEqual(판, {}, '공백 상한을 넘었는데도 창이 넓어졌다');
  const 안 = 복귀창_({ getSheetByName: () => 탭(EXIT_LOG_HEADERS.slice(),
    [퇴소행('S1', 공백상한일 + 30)]) });
  assert.equal(안.상한밖, 1, '상한 밖으로 뺀 사람을 안 세었다 — 조용히 빠지면 「재료 없음」과 구분이 안 된다');
  assert.deepEqual(안.맵, {}, '상한 밖인데 맵에 남았다');
});

test('[#Q99 5/5] 두 번 나갔다 온 사람은 «마지막» 퇴소가 창을 정한다', () => {
  const sh = 탭(EXIT_LOG_HEADERS.slice(),
    [퇴소행('S1', 100), 퇴소행('S1', 20)]);
  const r = 복귀창_({ getSheetByName: () => sh });
  const 마지막 = new Date(날(20)).getTime();
  assert.ok(Math.abs(r.맵.S1 - 마지막) < 86400000,
    '오래된 퇴소가 창을 정했다 — 더 최근일수록 창이 좁고, 좁은 쪽이 옳다');
});

/* ───────────────────── 3. 분모 (0 은 분모와 함께 읽는다) ───────────────────── */

test('[#Q99 5/5] 분모를 말한다 — 「창을 넓힌다」가 넓힌 사람 0명이어도 참이 되는 것을 막는다', () => {
  const r = 태우기({
    학생들: [{ id: 'S1', lv: 3 }, { id: 'S2', lv: 2 }],
    퇴소들: [퇴소행('S1', 30), 퇴소행('S9', 30)] // S9 = 안 돌아온 사람(명부 밖)
  });
  const 줄 = r.로그.find((l) => l.indexOf('복귀 재료 창:') === 0);
  assert.ok(줄, '복귀 재료 창 분모를 한 줄도 안 적었다: ' + r.로그.join(' / '));
  assert.ok(/창 넓힌 복귀 1명/.test(줄), '돌아온 사람 수가 틀렸다(명부와의 교집합이어야 한다): ' + 줄);
  assert.ok(/통상 1명/.test(줄), '통상 학생 수가 틀렸다: ' + 줄);
  assert.ok(/퇴소 이력 2명/.test(줄),
    '퇴소 이력 분모가 빠졌다 — 명부 밖 퇴소자까지 세어야 「돌아온 1명」의 뜻이 선다: ' + 줄);
});

test('[#Q99 5/5] exit_log 가 없으면 종전과 글자 하나 안 달라진다 — 회귀 보존', () => {
  const 학생들 = [{ id: 'S1', lv: 3, fav: '', dream: '', pain: '' }];
  const 퀴즈행들 = [퀴즈행('S1', 2)];
  const 없을때 = 태우기({ 학생들, 퀴즈행들 });
  const 빈판 = 태우기({ 학생들, 퀴즈행들, 퇴소들: [] });
  assert.equal(빈판.사용자, 없을때.사용자,
    'exit_log 가 비었는데 프롬프트가 달라졌다 — 미개원(0행)에서 조용히 다른 것을 내고 있다');
});

/* ───────────────────── 4. 장부와 몸이 함께 간다 ───────────────────── */

test('[#Q99 5/5] 도달 장부의 지목이 실물과 맞는다 — 지목만 바꾸고 몸을 안 세우는 것을 막는다', () => {
  const 장부 = section('function 수집도달_()', 'function 시트도달상한_()');
  const m = 장부.match(/'exit_log':\s*\{\s*소비자:\s*'([^']+)'/);
  assert.ok(m, "장부의 exit_log 칸이 아직 {사유} 다 — 갚았으면 {소비자, 층} 이어야 한다");
  const [파일, 함수] = m[1].split(':');
  assert.ok(new RegExp('function\\s+' + 함수 + '\\s*\\(').test(code),
    `지목한 소비자 ${함수} 가 저장소에 없다`);
  assert.equal(파일, '엔진_콘텐츠AI.js');
  assert.ok(/복귀창_\(ss\)/.test(code), '읽는 몸(복귀창_)이 호출되는 자리가 없다');
  assert.ok(/getSheetByName\('exit_log'\)/.test(code),
    'exit_log 를 여는 자리가 주석 밖(코드)에 없다 — 장부 검사 ③ 이 잡는 그 구멍');
});
