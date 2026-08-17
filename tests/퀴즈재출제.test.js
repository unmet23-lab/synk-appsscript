'use strict';
/**
 * 🔁 지난 퀴즈 되읽기 — 개인 퀴즈 출제가 **자기 결과**를 재료로 받는가 (대기열 #Q99 · 시트층 도달 2/5)
 *
 * ■ 왜 «실행» 검사인가
 *   시트층 도달 장부(`엔진_셋업확장.js` `수집도달_`)가 재는 것은 「지목한 파일의 코드에 탭 이름이
 *   실재하는가」까지다 — 소비자를 적어 두고 읽는 몸을 비워도 그 장부는 초록이다(설계 §8 「⚠ 천장」).
 *   그래서 여기서는 `aiStudioBatch_` 를 **가짜 의존으로 실제로 태워**, 모델에게 건네는 문자열이
 *   quiz_log 유무에 따라 정말 달라지는지를 잰다. 「읽는다」가 아니라 「다음에 줄 것이 바뀐다」가 과녁이다.
 *
 * ■ 이 시험이 틀릴 때의 모습 (대가를 함께 적는다)
 *   ①~⑤ 절 중 ① 만 재고 나머지는 의존이 없어 던진다 — 그래서 아래 `태우기` 는 예외를 삼킨다.
 *   그 삼킴이 ① 자체의 실패까지 가릴 수 있으므로, **잡힌 호출이 0건이면 실패로 떨어뜨린다**
 *   (미실행은 통과와 같은 모양이다 · F207). 분모를 늘 함께 단언하는 이유가 이것이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { engineSource } = require('./_engine-source');
/* 시트 흉내는 손으로 다시 짓지 않는다 — 공용 통로 하나다(#Q85 · F460). */
const { 시트흉내 } = require('./lib/시트흉내.js');
const { 코드만 } = require('./lib/소스검사.js');

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

/* 정본 값을 그대로 쓴다 — 시험이 헤더를 하드코딩하면 정본이 바뀔 때 검사만 조용히 낡는다. */
const QUIZ_LOG_HEADERS = JSON.parse(
  code.match(/const QUIZ_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const QUIZ_CONFIDENCE = JSON.parse(
  code.match(/const QUIZ_CONFIDENCE = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const 찍었다 = QUIZ_CONFIDENCE[2];   // '찍었어요' — 정본에서 뽑는다
const 확실 = QUIZ_CONFIDENCE[0];

const toDate_ = 불러오기('function toDate_(v)', '\n// [opt] 셀값', 'toDate_', {});
/* [v9.250 · #Q99 5/5] ① 절이 이제 `복귀창_` 도 부른다 — **가짜로 막지 않고 진짜를 태운다.**
 *   스텁으로 채우면 그 함수가 깨져도 이 시험이 초록이라, 여기서는 정본을 그대로 불러 쓴다.
 *   아래 가짜 `ss` 에는 exit_log 가 없어 `{맵:{}, 상한밖:0}` 로 떨어진다 = 종전과 같은 창(회귀 보존). */
const 복귀창_ = 불러오기('const 복귀_공백상한일', '// 최근 약점 로더', '복귀창_', { toDate_ });

const 날 = (n) => {
  const x = new Date(Date.now() - n * 86400000);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};
/** quiz_log 한 행 — 이름 붙은 칸만 받고 나머지는 정본 헤더 길이에 맞춰 채운다. */
const 행 = (o) => {
  const r = new Array(QUIZ_LOG_HEADERS.length).fill('');
  r[0] = 'QL-' + (o.id || Math.random().toString(36).slice(2, 8));
  r[1] = o.sid; r[2] = o.qid || 'Q-1'; r[3] = o.유형 === undefined ? '조사' : o.유형;
  r[4] = o.문제 === undefined ? '학교( ) 간다' : o.문제;
  r[5] = o.고른답 || '을'; r[6] = o.정답 || '에';
  r[7] = o.판정; r[8] = o.확신도 || '';
  r[9] = o.날 === undefined ? 날(1) : o.날; r[10] = new Date(); r[11] = 3; r[12] = 'v1';
  return o.폭 ? r.slice(0, o.폭) : r;
};

/**
 * `aiStudioBatch_` 를 실제로 태우고 **모델에게 건넨 것**을 돌려준다.
 * 잡히는 것: `aiCall_(시스템, 사용자)` 호출들 · `Logger.log` 줄들.
 */
function 태우기(옵션) {
  const o = 옵션 || {};
  const 학생들 = o.학생들 || [{ id: 'S1', lv: 3, fav: '', dream: '', pain: '' }];
  const 호출 = [];
  const 로그 = [];
  const ql = o.퀴즈행들
    ? 시트흉내({ 첫행: 1, 행들: [(o.퀴즈헤더 || QUIZ_LOG_HEADERS).slice()].concat(o.퀴즈행들) })
    : null;
  const ad = 시트흉내({ 첫행: 1, 행들: [['student_id', '날짜', '한문장', '퀴즈문제', '퀴즈정답해설']] });
  const ss = {
    getSheetByName: (n) => (n === 'quiz_log' ? ql : n === 'ai_daily' ? ad : null),
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar'
  };
  const fmt = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  const 배치 = 불러오기('function 퀴즈라벨_(', 'function welcomeStoryBatch_()', 'aiStudioBatch_', {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'KEY', setProperty: () => {}, deleteProperty: () => {} }) },
    Utilities: { formatDate: (dt, tz, f) => (f === 'yyyy-MM-dd' ? fmt(dt) : String(dt)), sleep: () => {} },
    Logger: { log: (m) => 로그.push(String(m)) },
    ensureSheet: (s, n) => (n === 'ai_daily' ? ad : 시트흉내({ 첫행: 1, 행들: [[]] })),
    aiStudents_: () => 학생들.map((s) => Object.assign({}, s)),
    aiWeakMap_: () => (o.약점 || {}),
    복귀창_,          // [#Q99 5/5] 정본 그대로 — exit_log 없는 가짜 ss 에선 빈 맵이라 창이 안 움직인다
    복귀_공백상한일: 180,
    aiCall_: (k, sys, usr) => { 호출.push({ 시스템: sys, 사용자: usr }); return { items: [] }; },
    AI_STUDIO_MAX_CALLS: 12,
    AI_DAILY_BATCH_SIZE: 15,
    toDate_,
    QUIZ_LOG_HEADERS,
    QUIZ_CONFIDENCE   // 확신도 3택의 정본 — 시험도 엔진도 같은 상수를 본다(리터럴 중복 0)
  });
  /* ②~⑤ 절은 의존이 없어 던진다 — ① 만 잰다. 삼킴이 ① 실패까지 가리지 않도록 분모를 아래에서 단언한다. */
  try { 배치(); } catch (e) { 로그.push('__던짐__ ' + (e && e.message ? e.message : String(e))); }
  assert.ok(호출.length >= 1,
    '① 절이 한 번도 모델을 안 불렀다 — 이 시험은 미실행이지 통과가 아니다: ' + 로그.join(' / '));
  return { 사용자: 호출[0].사용자, 시스템: 호출[0].시스템, 호출, 로그 };
}
/** 학생 한 명의 프롬프트 줄만 뽑는다(인덱스 i 로 시작하는 줄). */
const 줄 = (사용자, i) => 사용자.split('\n').find((l) => l.indexOf(i + '. ') === 0) || '';

/* ───────────────────────── 1. 행동이 바뀐다 ───────────────────────── */

test('[#Q99] quiz_log 가 있으면 개인 퀴즈 프롬프트가 실제로 달라진다 — 「읽는다」가 아니라 「다음에 줄 것이 바뀐다」', () => {
  const 학생들 = [{ id: 'S1', lv: 3, fav: '', dream: '', pain: '' }];
  const 없을때 = 태우기({ 학생들 });
  const 있을때 = 태우기({
    학생들,
    퀴즈행들: [행({ sid: 'S1', 유형: '조사', 판정: '오답', 날: 날(2) }),
      행({ sid: 'S1', 유형: '조사', 판정: '오답', 날: 날(3) })]
  });
  assert.ok(!없을때.사용자.includes('지난 퀴즈'),
    'quiz_log 가 없는데 「지난 퀴즈」 칸이 붙었다 — 없는 재료를 있다고 말한다');
  assert.ok(있을때.사용자.includes('지난 퀴즈: 틀림 조사 ×2'),
    '오답 2건이 재출제 재료로 안 실렸다: ' + 줄(있을때.사용자, 0));
  assert.notEqual(있을때.사용자, 없을때.사용자,
    '두 판의 프롬프트가 **글자 하나 안 달라졌다** — 읽어 놓고 다음에 줄 것을 안 바꾸면 도달이 아니다');
});

test('[#Q99] 시스템 프롬프트가 「다시 내라」고 지시한다 — 재료만 싣고 지시가 없으면 모델이 무시할 수 있다', () => {
  const r = 태우기({ 퀴즈행들: [행({ sid: 'S1', 판정: '오답' })] });
  assert.ok(/지난 퀴즈.*다시 낸다/.test(r.시스템), '재출제 지시가 시스템 프롬프트에 없다');
  assert.ok(r.시스템.includes('찍어서 맞힘'),
    '「찍어서 맞힘」 지시가 없다 — 채점상 «맞은 학생»이라 지시가 없으면 모델이 다시 낼 이유를 못 찾는다');
  assert.ok(/그대로 베끼지 말고|같은 문법의 새 문제/.test(r.시스템),
    '같은 문제를 그대로 다시 내지 말라는 못박기가 없다 — 재출제가 복사가 되면 학생은 답을 외운다');
});

/* ───────────────────────── 2. 세 갈래 채점의 원칙 ───────────────────────── */

test('[#Q99] 판정보류는 오답으로 뭉개지지 않는다 — 모르는 것과 틀린 것은 다르다', () => {
  const r = 태우기({ 퀴즈행들: [행({ sid: 'S1', 판정: '판정보류' })] });
  assert.ok(!r.사용자.includes('지난 퀴즈'),
    '판정보류가 재출제 재료가 됐다 — 정답 미등록 문항이 영원한 약점으로 둔갑한다(quizGrade_ 세 갈래 원칙)');
});

test('[#Q99] 「찍어서 맞힘」이 산다 — 오답만 보면 이 축이 통째로 죽는다', () => {
  const r = 태우기({ 퀴즈행들: [행({ sid: 'S1', 유형: '시제', 판정: '정답', 확신도: 찍었다 })] });
  assert.ok(r.사용자.includes('찍어서 맞힘 시제'),
    '정답+찍었어요가 재료가 아니다 — 첨삭(hw_feedback)엔 확신도 축이 아예 없어 이 학생은 어디서도 「맞은 학생」이다: '
      + 줄(r.사용자, 0));
});

test('[#Q99] 확신 있는 정답은 재료가 아니다 — 아는 것을 다시 내면 그 시간이 버려진다', () => {
  const r = 태우기({ 퀴즈행들: [행({ sid: 'S1', 판정: '정답', 확신도: 확실 })] });
  assert.ok(!r.사용자.includes('지난 퀴즈'), '확실하게 맞힌 문항이 재출제 재료가 됐다: ' + 줄(r.사용자, 0));
});

/* ───────────────────────── 3. 라벨 함정 ───────────────────────── */

test('[#Q99] 개인 퀴즈 5건이 「개인퀴즈 ×5」로 뭉치지 않는다 — 맞는 얼굴로 아무것도 안 말하는 라벨', () => {
  /* quizSweep_ 의 qMap AIQ 가지가 cat 을 '개인퀴즈' 로 박고, 카드는 개인 퀴즈를 **우선** 띄운다
   *   (Code.js `pq ? pq.q : q[0]`). 즉 활동 중인 학생의 응답은 대부분 이 유형이라, 유형만 믿으면
   *   재료가 통째로 무의미해진다. */
  const 문제들 = ['밥을 ( ) 먹었어요', '학교( ) 갔어요', '내일 ( ) 거예요', '책( ) 읽어요', '집( ) 있어요'];
  const r = 태우기({
    퀴즈행들: 문제들.map((q, i) => 행({ id: 'a' + i, sid: 'S1', qid: 'AIQ-' + 날(i + 1), 유형: '개인퀴즈', 문제: q, 판정: '오답', 날: 날(i + 1) }))
  });
  assert.ok(!r.사용자.includes('개인퀴즈'),
    '라벨이 유형 그대로 「개인퀴즈」다 — 무엇을 틀렸는지가 사라졌다: ' + 줄(r.사용자, 0));
  assert.ok(r.사용자.includes('밥을 ( ) 먹었어요'),
    '개인 퀴즈인데 문제 원문이 라벨로 안 쓰였다: ' + 줄(r.사용자, 0));
});

test('[#Q99] 문항 스냅샷이 빈 행은 버리되 **몇 건 버렸는지 말한다** — 조용한 손실은 「재료 없음」과 같은 모양이다', () => {
  const r = 태우기({
    퀴즈행들: [행({ sid: 'S1', 유형: '', 문제: '', 판정: '오답' }),
      행({ id: 'b', sid: 'S1', 유형: '', 문제: '', 판정: '오답' })]
  });
  const 줄들 = r.로그.filter((l) => l.indexOf('개인 퀴즈 재출제 재료') === 0);
  assert.equal(줄들.length, 1, '재료 분모 로그가 한 줄이 아니다: ' + JSON.stringify(r.로그));
  assert.ok(/버린 행 2건/.test(줄들[0]),
    'ai_daily 가 못 채운 행(quizSweep_ 이 스스로 적어 둔 한계)이 조용히 사라진다: ' + 줄들[0]);
});

/* ───────────────────────── 4. 0 은 분모와 함께 ───────────────────────── */

test('[#Q99] 재료 분모를 말한다 — 「재출제한다」가 재료 받은 학생 0명이어도 참이 되는 것을 막는다', () => {
  const r = 태우기({
    학생들: [{ id: 'S1', lv: 3 }, { id: 'S2', lv: 2 }, { id: 'S3', lv: 1 }],
    퀴즈행들: [행({ sid: 'S1', 판정: '오답' })]
  });
  const 줄1 = r.로그.find((l) => l.indexOf('개인 퀴즈 재출제 재료') === 0) || '';
  assert.ok(/대상 3명/.test(줄1) && /있는 1명/.test(줄1) && /없는 2명/.test(줄1),
    '합계=갈래+갈래 로 안 쪼갰다(유호 확정 08-14): ' + 줄1);
});

/* ───────────────────────── 5. 창·폭·상한 ───────────────────────── */

test('[#Q99] 14일 창 밖의 응답은 안 들어온다 — 약점맵과 같은 창(한 재료에 창 하나)', () => {
  const r = 태우기({ 퀴즈행들: [행({ sid: 'S1', 판정: '오답', 날: 날(20) })] });
  assert.ok(!r.사용자.includes('지난 퀴즈'), '20일 전 오답이 「지난 퀴즈」로 실렸다: ' + 줄(r.사용자, 0));
  const 안쪽 = 태우기({ 퀴즈행들: [행({ sid: 'S1', 판정: '오답', 날: 날(13) })] });
  assert.ok(안쪽.사용자.includes('지난 퀴즈'), '13일 전 오답이 창 밖으로 잘렸다 — 창이 14일이 아니다');
});

test('[#Q99] 구 시트 폭에서 안 죽는다 — 13열을 요구하면 ① 절이 통째로 죽는다(v9.209 의 1710 교훈)', () => {
  const r = 태우기({
    퀴즈헤더: QUIZ_LOG_HEADERS.slice(0, 11),
    퀴즈행들: [행({ sid: 'S1', 판정: '오답', 폭: 11 })]
  });
  assert.ok(r.사용자.includes('지난 퀴즈: 틀림 조사'),
    '11열 시트에서 재료를 못 만들었다(제출일·created_at 은 11열 안에 있다): ' + 줄(r.사용자, 0));
});

test('[#Q99] 한 학생 재료는 70자를 안 넘는다 — 재료가 늘어도 배치 프롬프트 토큰이 안 는다', () => {
  /* ⚠ 픽스처의 **모양**이 이 시험의 탐지력을 정한다(변이가 잡아낸 자리 · CLAUDE.md 맹점②).
   *   오답만 잔뜩 넣으면 라벨 2개(각 24자)라 합이 애초에 70 미만이고, 그러면 상한을 지워도
   *   초록이다 — 상한이 실제로 물리려면 **두 축이 다 차야** 한다: 오답 2 라벨 + 찍어서 맞힘 1 라벨.
   *   그리고 라벨은 앞 24자로 자르므로 **앞머리가 달라야** 별개 라벨이 된다(꼬리만 다르면 한 덩이로
   *   합쳐져 재료가 도로 짧아진다 — 두 번째 변이 구멍이 정확히 이 자리였다). */
  const 긴문제 = ' 문제 문장이 아주아주 길게 여기에 계속 이어집니다 그리고 더 이어집니다';
  const 앞 = ['첫째로', '둘째로', '셋째로', '넷째로'];
  const r = 태우기({
    퀴즈행들: [0, 1, 2].map((i) => 행({
      id: 'c' + i, sid: 'S1', qid: 'AIQ-' + 날(i + 1), 유형: '개인퀴즈', 문제: 앞[i] + 긴문제, 판정: '오답', 날: 날(i + 1)
    })).concat([행({
      id: 'c9', sid: 'S1', qid: 'AIQ-' + 날(9), 유형: '개인퀴즈', 문제: 앞[3] + 긴문제, 판정: '정답', 확신도: 찍었다, 날: 날(9)
    })])
  });
  const 재료 = (줄(r.사용자, 0).split('| 지난 퀴즈: ')[1] || '').split(' | 최애')[0];
  assert.ok(재료.length > 0, '재료가 아예 없다: ' + 줄(r.사용자, 0));
  assert.ok(재료.length <= 70, '재료가 70자를 넘었다(' + 재료.length + '자) — 상한이 안 걸렸다: ' + 재료);
});

/* ───────────────────────── 6. 범위 — 남의 자리를 안 민다 ───────────────────────── */

test('[#Q99] 강사 손메모 자리가 안 밀린다 — 약점 칸은 quiz_log 유무와 무관하게 같다', () => {
  /* v9.209 가 오류태그를 «첨삭 항목의 꼬리»로만 실은 이유가 이것이다: 소비처 셋이 slice(-2)·slice(-1)
   *   로 집으므로 항목을 늘리면 손메모가 밀려난다. 새 재료를 그 배열에 합류시키면 같은 사고가 난다. */
  const 약점 = { S1: ['조사: 을/를 혼동', '자주 틀리는 곳: 조사 ×3'] };
  const 없을때 = 줄(태우기({ 약점 }).사용자, 0).split(' | 지난 퀴즈')[0];
  const 있을때 = 줄(태우기({ 약점, 퀴즈행들: [행({ sid: 'S1', 판정: '오답' })] }).사용자, 0).split(' | 지난 퀴즈')[0];
  assert.equal(있을때, 없을때, '약점 칸이 바뀌었다 — 새 재료가 강사 손메모를 밀어냈다');
  assert.ok(없을때.includes('조사: 을/를 혼동'), '손메모가 애초에 안 실렸다 — 이 시험이 아무것도 안 재고 있다');
});

test('[#Q99] 재료를 읽는 곳은 ① 절 하나다 — 반 브리핑·연습 노트는 이 트랙의 과녁이 아니다', () => {
  const 배치 = 코드만(section('function aiStudioBatch_()', 'function welcomeStoryBatch_()'));
  const 부른곳 = (배치.match(/퀴즈오답맵_\(/g) || []).length;
  assert.equal(부른곳, 1, 'aiStudioBatch_ 안에서 퀴즈오답맵_ 호출이 ' + 부른곳 + '번이다 — 하나여야 한다');
  const 삼절 = 배치.indexOf('// ③');
  assert.ok(삼절 === -1 || 배치.indexOf('퀴즈오답맵_(') < 삼절,
    '③ 절(반 브리핑) 뒤에서 퀴즈오답맵_ 을 부른다 — 선언한 범위를 넘었다');
  const weak = 코드만(section('function aiWeakMap_(', 'function 퀴즈라벨_('));
  assert.ok(!weak.includes('quiz_log'),
    'aiWeakMap_ 이 quiz_log 를 읽는다 — 그러면 반 브리핑·연습 노트까지 같이 바뀐다(선언 범위 밖)');
});

/* ───────────────────────── 7. 장부와 코드가 갈리지 않는다 ───────────────────────── */

test('[#Q99] 도달 장부가 지목한 소비자가 실재한다 — 지목만 바꾸고 몸을 안 세우는 것을 막는다', () => {
  const 장부 = section('function 수집도달_()', 'function 시트도달상한_()');
  const m = 장부.match(/'quiz_log':\s*\{([^}]*)\}/);
  assert.ok(m, '수집도달_ 에 quiz_log 칸이 없다');
  assert.ok(/소비자:/.test(m[1]),
    'quiz_log 가 아직 «사유» 칸이다 — 소비자를 세웠으면 같은 커밋에서 장부도 바뀌어야 한다: ' + m[1]);
  const 지목 = (m[1].match(/소비자:\s*'([^']+)'/) || [])[1] || '';
  const [파일, 함수] = 지목.split(':');
  assert.ok(파일 && 함수, '소비자 지목이 «파일:함수» 꼴이 아니다: ' + 지목);
  const 몸 = require('node:fs').readFileSync(path.join(__dirname, '..', 파일), 'utf8');
  assert.ok(코드만(몸).includes('function ' + 함수),
    '지목한 함수가 그 파일에 없다: ' + 지목);
});
