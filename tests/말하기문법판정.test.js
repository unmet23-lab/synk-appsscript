'use strict';
/**
 * 🎙 말하기 문법 판정 — **말한 것이 진화·연습 노트에 닿는가** (대기열 #Q99 · 시트층 도달 3/5)
 *
 * ■ 왜 «실행» 검사인가
 *   시트층 도달 장부(`엔진_셋업확장.js` `수집도달_`)가 재는 것은 「지목한 파일의 코드에 탭 이름이
 *   실재하는가」까지다 — 소비자를 적어 두고 읽는 몸을 비워도 그 장부는 초록이다(설계 §8 「⚠ 천장」).
 *   그래서 여기서는 `masteryFromVoice_` 를 **가짜 의존으로 실제로 태워**, ①모델에게 건네는 문장이
 *   전사문 유무에 따라 달라지는지 ②`mastery_log` 의 «상태» 칸이 실제로 바뀌는지를 잰다.
 *   「읽는다」가 아니라 **「다음에 줄 것이 바뀐다」**가 과녁이다.
 *
 * ■ 이 시험이 틀릴 때의 모습 (대가를 함께 적는다)
 *   가짜 `aiCall_` 이 늘 같은 답을 주므로, **판정의 «질»은 여기서 못 잰다** — 재는 것은 배선과
 *   불변식뿐이다. 그래서 아래 검사들은 전부 「무엇이 들어가고 무엇이 남는가」만 묻는다.
 *   그리고 호출이 0건이면 **실패로 떨어뜨린다** — 미실행은 통과와 같은 모양이다(F207).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { engineSource } = require('./_engine-source');
const { 시트흉내 } = require('./lib/시트흉내.js');
const { 코드만 } = require('./lib/소스검사.js');

const ROOT = path.join(__dirname, '..');
const 교재 = fs.readFileSync(path.join(ROOT, '교재연동.js'), 'utf8');
const 엔진 = engineSource();

/* 정본 값은 전부 소스에서 뽑는다 — 시험이 숫자·헤더를 손으로 베끼면 정본이 바뀔 때
 * **검사만 조용히 낡는다**(그때 빨개지는 것이 아니라 엉뚱한 것을 재기 시작한다). */
const VOICE_LOG_HEADERS = JSON.parse(엔진.match(/const VOICE_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const MASTERY_LOG_HEADERS = JSON.parse(엔진.match(/const MASTERY_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const 상한 = Number(교재.match(/const TB_VOICE_JUDGE_MAX_PER_RUN = (\d+);/)[1]);
const 글자상한 = Number(교재.match(/const TB_JUDGE_TEXT_CAP = (\d+);/)[1]);

/** 엔진 정본 함수 하나를 «진짜로» 꺼낸다(스텁으로 대신하면 시험이 내 상상을 잰다). */
function 엔진함수(머리, 이름, 의존) {
  const s = 엔진.indexOf(머리);
  assert.notEqual(s, -1, `엔진에서 ${머리} 를 못 찾았다`);
  const e = 엔진.indexOf('\nfunction ', s + 머리.length);
  const n = Object.keys(의존 || {});
  return new Function(...n, `${엔진.slice(s, e)}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}

/* 판정 대상은 `GRAMMAR_BANK` 의 G2xx·G3xx 뿐이다 — 픽스처 뱅크도 그 규칙을 따른다.
 * (실뱅크를 끌어오지 않는 이유: 이 시험의 과녁은 «어떤 문법이냐»가 아니라 배선이다.) */
const 가짜뱅크 = [['G201', '이에요/예요'], ['G202', '있어요/없어요'], ['G301', '-(으)러 가다'], ['G999', '범위 밖']];

/* 판정관 **둘 다** 이 조각 안에 있다 — 쓰는 통로(`masteryApply_`)를 공유하게 만든 판이라,
 * 말하기만 재고 쓰기를 안 재면 그 공유가 쓰기를 깨뜨려도 초록이다(리팩터의 전형적 사각). */
const 교재조각 = 교재.slice(교재.indexOf('function masteryFromFeedback_('));

const fmt = (dt, tz, f) => {
  const p = (n) => String(n).padStart(2, '0');
  const 날 = dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
  return f === 'yyyy-MM-dd' ? 날 : 날 + ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes());
};
const 날 = (n) => fmt(new Date(Date.now() - n * 86400000), null, 'yyyy-MM-dd');
/* `dstr` 은 엔진 정본을 쓴다 — 「어제 근거인가」 판정이 시험의 손짐작이면 승격 가드를 잰 게 아니다. */
const dstr = 엔진함수('function dstr(v, tz, fmt)', 'dstr', { Utilities: { formatDate: fmt } });

/** voice_log 한 행 — 이름 붙은 칸만 받고 나머지는 정본 헤더 길이에 맞춰 채운다. */
const 음성행 = (o) => {
  const r = new Array(VOICE_LOG_HEADERS.length).fill('');
  r[0] = o.sid; r[1] = o.제출일 || 날(1); r[2] = o.미션 || 'M1';
  r[4] = 'FID-' + (o.sid || 'x');
  r[6] = o.전사 === undefined ? '학교에 가요' : o.전사;
  r[7] = o.상태 === undefined ? '완료' : o.상태;
  r[8] = o.도장 === undefined ? '2026-08-16 23:10' : o.도장;
  return o.폭 ? r.slice(0, o.폭) : r;
};
/** mastery_log 한 행 — 상태·출처·근거일을 골라 놓는다. */
const 숙달행 = (o) => [o.sid, o.gid, o.상태 || '연습', o.첫기록일 || 날(3), '', o.출처 || 'AI첨삭',
  o.근거일 === undefined ? new Date(Date.now() - 86400000) : o.근거일];

/**
 * `masteryFromVoice_` 를 실제로 태우고, 모델에 건넨 것과 mastery_log 의 «남은 모양»을 돌려준다.
 * @param {{음성행들?:Array, 숙달행들?:Array, 응답?:object|Function, 마크?:string}} 옵션
 */
function 태우기(옵션) {
  const o = 옵션 || {};
  const 호출 = [], 로그 = [], 메일 = [], 속성 = Object.assign({ CLAUDE_API_KEY: 'KEY' }, o.속성 || {});
  if (o.마크 !== undefined) 속성['문법판정_음성마크'] = o.마크;
  const vl = 시트흉내({ 첫행: 1, 행들: [VOICE_LOG_HEADERS.slice()].concat(o.음성행들 || []) });
  const ml = 시트흉내({ 첫행: 1, 행들: [MASTERY_LOG_HEADERS.slice()].concat(o.숙달행들 || []) });
  /* hw_feedback 은 4열까지만 읽힌다(제출문 = D열) — 쓰기 판정 경로를 태울 때만 채운다. */
  const fb = o.첨삭행들 ? 시트흉내({ 첫행: 1, 행들: [['id', 'student_id', '제출일', '제출문']].concat(o.첨삭행들) }) : null;
  const ss = {
    getSheetByName: (n) => (n === 'voice_log' ? vl : n === 'mastery_log' ? ml : n === 'hw_feedback' ? fb : null),
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar'
  };
  const 의존 = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (속성[k] === undefined ? null : 속성[k]),
      setProperty: (k, v) => { 속성[k] = String(v); },
      /* [#Q106] 벽 시계를 «지우는» 축까지 흉내 낸다 — 이 칸이 없으면 `판정벽지움_` 의 try 가
       *   조용히 삼켜, 시계가 안 지워지는 결함이 회귀에서 통과로 보인다(맹점 ④). */
      deleteProperty: (k) => { delete 속성[k]; }
    }) },
    Utilities: { formatDate: fmt },
    Logger: { log: (m) => 로그.push(String(m)) },
    adminMail: (제목, 몸) => 메일.push({ 제목, 몸 }),
    /* 픽스처 시트는 이미 정본 폭이라 치유는 무동작이다 — 치유 자체는 `tests/수집.test.js` 몫. */
    헤더보정_: () => {},
    ensureSheet: (s, n) => (n === 'mastery_log' ? ml : 시트흉내({ 첫행: 1, 행들: [[]] })),
    aiCall_: (k, sys, usr) => {
      호출.push({ 시스템: sys, 사용자: usr });
      const r = typeof o.응답 === 'function' ? o.응답(호출.length, usr) : (o.응답 || { used: [], wrong: [] });
      if (r instanceof Error) throw r;
      return r;
    },
    GRAMMAR_BANK: 가짜뱅크,
    MASTERY_LOG_HEADERS,
    VOICE_LOG_HEADERS,
    TB_VOICE_JUDGE_MAX_PER_RUN: 상한,
    TB_JUDGE_TEXT_CAP: 글자상한,
    TB_JUDGE_MAX_PER_RUN: Number(교재.match(/const TB_JUDGE_MAX_PER_RUN = (\d+);/)[1]),
    dstr
  };
  const n = Object.keys(의존);
  const 판정관 = new Function(...n, `${교재조각}\nreturn { masteryFromVoice_, masteryFromFeedback_ };`)(...n.map((k) => 의존[k]));
  (o.쓰기 ? 판정관.masteryFromFeedback_ : 판정관.masteryFromVoice_)(ss);
  const 숙달 = ml.data.slice(1).filter((r) => r && r[0]).map((r) => ({ sid: r[0], gid: r[1], 상태: r[2], 출처: r[5] }));
  return { 호출, 로그, 메일, 숙달, 속성, 마크: 속성['문법판정_음성마크'], 벽: 속성['문법판정_벽_음성'] };
}

/* ───────────────────────── 1. 행동이 바뀐다 ───────────────────────── */

test('[#Q99] 전사문이 있으면 판정관에게 «학생이 말한 문장»이 실제로 건네진다', () => {
  const r = 태우기({ 음성행들: [음성행({ sid: 'S1', 전사: '저는 학교에 가요' })] });
  assert.equal(r.호출.length, 1, '전사문이 있는데 모델을 한 번도 안 불렀다 — 미실행이지 통과가 아니다: ' + r.로그.join(' / '));
  assert.ok(r.호출[0].사용자.includes('저는 학교에 가요'), '건넨 문자열에 전사문이 없다');
  assert.ok(r.호출[0].사용자.includes('G201=이에요/예요'), '문법 목록이 뱅크에서 파생되지 않았다');
  assert.ok(!r.호출[0].사용자.includes('G999'), '판정 범위(G2xx·G3xx) 밖 문법이 실렸다');
});

test('[#Q99] 전사가 아직 없거나 실패한 행은 재료가 아니다 — 부르지 않는다', () => {
  const r = 태우기({ 음성행들: [
    음성행({ sid: 'S1', 전사: '', 상태: '대기' }),
    음성행({ sid: 'S2', 전사: '뭐라고 말함', 상태: '실패: 인식 결과 없음' })
  ] });
  assert.equal(r.호출.length, 0, '전사 전·실패 행을 학습 재료로 읽었다');
});

test('[#Q99] 판정관 지문이 «말한 것을 기계가 옮긴 글»임을 밝힌다 — 안 밝히면 구어를 오류로 센다', () => {
  const r = 태우기({ 음성행들: [음성행({ sid: 'S1' })] });
  const 시 = r.호출[0].시스템;
  assert.ok(/말한 것을 기계가 글로 옮긴/.test(시), '전사문이라는 사실을 지문이 안 말한다');
  assert.ok(/구어/.test(시) && /오류로 보지 않는다/.test(시), '구어 특징을 오류에서 빼라는 지시가 없다');
});

/* ─────────── 2. 남는 모양 — 진화 게이트는 되돌릴 수 없다 ─────────── */

test('[유호 08-27 §7-④] 말하기 근거 **단독**으로 «다른 날 2회» 올바르면 도달한다 (말하기 학원의 축 — 단독승격 열림)', () => {
  const r = 태우기({
    음성행들: [음성행({ sid: 'S1' })],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI음성' })],
    응답: { used: ['G201'], wrong: [] }
  });
  assert.deepEqual(r.숙달.map((x) => x.상태), ['도달'],
    '어제·오늘 말하기 둘 다 올바른데 «도달»로 안 올라갔다 — 단독승격이 안 열렸다(교재연동 AI음성 단독승격 true)');
  // ⚠ 방벽은 남아 있다: «같은 날» 2회는 여전히 도달 아님(다음 테스트가 지킨다) · ASR 다듬음 표본 검증은 개원 전 큐 Q9
});

test('[#Q99] 쓰기 근거가 앞에 있으면 말하기가 «도달»을 만든다 — 가드는 말하기를 막는 장치가 아니다', () => {
  const r = 태우기({
    음성행들: [음성행({ sid: 'S1' })],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI첨삭' })],
    응답: { used: ['G201'], wrong: [] }
  });
  assert.deepEqual(r.숙달.map((x) => x.상태), ['도달'],
    '쓰기(어제)+말하기(오늘) 두 근거인데 승격이 안 됐다 — 가드가 말하기를 통째로 죽였다');
});

test('[#Q99] 처음 보는 문법은 «연습»으로 입장하고 출처가 말하기로 남는다', () => {
  const r = 태우기({ 음성행들: [음성행({ sid: 'S1' })], 응답: { used: ['G202'], wrong: ['G301'] } });
  assert.deepEqual(r.숙달, [
    { sid: 'S1', gid: 'G202', 상태: '연습', 출처: 'AI음성' },
    { sid: 'S1', gid: 'G301', 상태: '연습', 출처: 'AI음성(오류)' }
  ]);
});

test('[#Q99] 모델이 지어낸 문법 ID 는 안 들어온다', () => {
  const r = 태우기({ 음성행들: [음성행({ sid: 'S1' })], 응답: { used: ['G777', 'G999'], wrong: [] } });
  assert.deepEqual(r.숙달, [], '뱅크 밖 ID 가 mastery_log 에 적혔다');
});

test('[#Q99] 이미 «도달»인 문법은 어떤 근거가 와도 안 내려온다 — 단방향 상향(v9.59)', () => {
  const r = 태우기({
    음성행들: [음성행({ sid: 'S1' })],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '도달', 출처: 'AI첨삭' })],
    응답: { used: [], wrong: ['G201'] }   // 말로는 틀렸다 — 그래도 강등은 없다
  });
  assert.deepEqual(r.숙달, [{ sid: 'S1', gid: 'G201', 상태: '도달', 출처: 'AI첨삭' }],
    '도달한 문법의 상태·출처가 새 근거에 덮였다 — 강등 없는 규칙이 공용 통로에서 깨졌다');
});

test('[#Q99] 같은 날 두 번은 «도달»이 아니다 — 우연 1회 방지 규칙(v9.59)이 공용 통로에서도 산다', () => {
  const r = 태우기({
    음성행들: [음성행({ sid: 'S1' })],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI첨삭', 근거일: new Date() })],
    응답: { used: ['G201'], wrong: [] }
  });
  assert.deepEqual(r.숙달.map((x) => x.상태), ['연습'], '같은 날 근거 두 개로 승격했다');
});

/* ── 2-b. 쓰는 통로를 공유시킨 판이라 **쓰기 판정**도 함께 잰다 (리팩터의 사각) ── */

test('[#Q99] 쓰기 판정은 그대로 돈다 — 제출문이 판정관에게 가고, 이 층은 단독으로 «도달»까지 간다', () => {
  const r = 태우기({
    쓰기: true,
    첨삭행들: [['F1', 'S1', 날(0), '저는 학생이에요']],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI첨삭' })],
    응답: { used: ['G201'], wrong: [] }
  });
  assert.equal(r.호출.length, 1, '쓰기 판정이 모델을 안 불렀다 — 리팩터가 그 경로를 끊었다: ' + r.로그.join(' / '));
  assert.ok(r.호출[0].사용자.includes('저는 학생이에요'), '건넨 문자열에 제출문이 없다');
  assert.deepEqual(r.숙달.map((x) => x.상태), ['도달'],
    '쓰기 근거 둘(어제·오늘)인데 승격이 안 됐다 — 말하기 가드가 쓰기까지 잠갔다');
});

/* ─────────── 3. 스트림 — 같은 전사를 두 번 먹지 않는다 ─────────── */

test('[#Q99] 워터마크가 전진해 같은 전사를 두 번 안 먹는다 (두 번 먹으면 한 근거가 「다른 날 2회」로 둔갑한다)', () => {
  const 행들 = [음성행({ sid: 'S1', 도장: '2026-08-16 23:10' })];
  const 첫판 = 태우기({ 음성행들: 행들, 응답: { used: ['G201'], wrong: [] } });
  assert.equal(첫판.마크, '2026-08-16 23:10', '워터마크가 안 찍혔다');
  const 둘째판 = 태우기({ 음성행들: 행들, 마크: 첫판.마크, 응답: { used: ['G201'], wrong: [] } });
  assert.equal(둘째판.호출.length, 0, '이미 먹은 전사를 다시 모델에 보냈다');
});

test('[#Q99] 전사일시가 Date 로 되받아져도 스트림이 산다 (월키 Date 오염 계열)', () => {
  const 도장 = new Date(2026, 7, 16, 23, 10);
  const r = 태우기({ 음성행들: [음성행({ sid: 'S1', 도장: 도장 })], 응답: { used: ['G201'], wrong: [] } });
  assert.equal(r.호출.length, 1, 'Date 로 저장된 도장을 못 읽어 행이 통째로 빠졌다');
  assert.equal(r.마크, '2026-08-16 23:10', '워터마크가 문자열 한 모양으로 안 눕혀졌다 — 사전순 비교가 시간순이 아니게 된다');
});

test('[#Q99] 전사는 끝났는데 도장이 없는 행 — 조용히 버리지 않고 분모로 말한다', () => {
  const r = 태우기({ 음성행들: [음성행({ sid: 'S1', 도장: '' }), 음성행({ sid: 'S2' })] });
  assert.ok(r.로그.some((l) => /전사일시가 없어 못 읽은 행 1건/.test(l)),
    '못 읽은 행이 「전사 대기」와 같은 모양으로 사라졌다: ' + r.로그.join(' / '));
});

test('[#Q99] 🔒 판정에 실패한 학생이 있으면 워터마크가 그 앞에서 선다 — 실패는 격리하되 재료는 안 버린다', () => {
  const 행들 = [
    음성행({ sid: 'S1', 도장: '2026-08-16 23:01' }),
    음성행({ sid: 'S2', 도장: '2026-08-16 23:02' }),
    음성행({ sid: 'S3', 도장: '2026-08-16 23:03' })
  ];
  const r = 태우기({ 음성행들: 행들, 응답: (n) => (n === 2 ? new Error('429') : { used: ['G201'], wrong: [] }) });
  assert.equal(r.호출.length, 3, '학생 단위 격리가 안 돼 뒤 학생까지 죽었다');
  assert.equal(r.마크, '2026-08-16 23:01', '실패한 S2 의 도장을 넘어 전진했다 — 그 전사문은 다시 못 읽힌다');
  const 다음판 = 태우기({ 음성행들: 행들, 마크: r.마크, 응답: { used: ['G201'], wrong: [] } });
  assert.ok(다음판.호출.some((c) => c.사용자.includes('학생이 말한 문장')) && 다음판.호출.length === 2,
    '다음 밤에 실패했던 학생이 다시 안 온다: 호출 ' + 다음판.호출.length + '건');
});

/* ─────────── 3-2. 벽의 «만료» (#Q106) ───────────
 * 위 검사는 벽이 **선다**를 재고, 여기는 그 벽이 **영원히 서지는 않는다**를 잰다. 둘은 한 쌍이다 —
 * 한쪽만 있으면 처방이 반대쪽 병(영구 유실 / 영구 정지)으로 넘어가도 초록이다.
 * 재료로는 못 잰다(미개원 · voice_log 0행)이므로 탐지력은 전부 픽스처가 진다(가드 맹점 ②). */
const 창 = Number(교재.match(/const TB_JUDGE_WALL_RECOVERY_MS = (\d+) \* 86400000;/)[1]) * 86400000;
const 벽시계 = (자리, 전) => ({ '문법판정_벽_음성': 자리 + '|' + (Date.now() - 전) });
const 실패행들 = [
  음성행({ sid: 'S1', 도장: '2026-08-16 23:01' }),
  음성행({ sid: 'S2', 도장: '2026-08-16 23:02' }),
  음성행({ sid: 'S3', 도장: '2026-08-16 23:03' })
];
const S2실패 = (n) => (n === 2 ? new Error('내용 필터') : { used: ['G201'], wrong: [] });

test('[#Q106] 🔒 창 «안»에서는 벽이 그대로 선다 — 1~6밤은 재시도라 일시 실패가 스스로 낫는다', () => {
  const r = 태우기({ 음성행들: 실패행들, 응답: S2실패, 속성: 벽시계('S2@2026-08-16 23:02', 창 - 86400000) });
  assert.equal(r.마크, '2026-08-16 23:01', '창이 안 지났는데 실패한 학생을 넘어갔다 — 그 전사문이 영구 유실이다');
  assert.equal(r.메일.length, 0, '아직 안 버렸는데 버렸다고 통보했다');
});

test('[#Q106] 🔴 창이 지나면 그 학생을 버리고 워터마크가 넘어간다 — 영구 실패 하나가 스트림을 영영 막던 자리', () => {
  const r = 태우기({ 음성행들: 실패행들, 응답: S2실패, 속성: 벽시계('S2@2026-08-16 23:02', 창 + 86400000) });
  assert.equal(r.마크, '2026-08-16 23:03',
    `🔴 벽이 안 내려갔다 — 그 뒤 학생 전원이 무기한 미판정이다(마크 ${r.마크})`);
  assert.equal(r.벽, undefined, '벽이 내려갔는데 시계가 남았다 — 다음 벽이 남의 시계를 물려받는다');
});

test('[#Q106] ⏭ 버릴 땐 **말한다** — 조용히 넘기면 재료가 사라지는데 아무 화면도 안 바뀐다', () => {
  const r = 태우기({ 음성행들: 실패행들, 응답: S2실패, 속성: 벽시계('S2@2026-08-16 23:02', 창 + 86400000) });
  assert.equal(r.메일.length, 1, '버렸는데 통보가 0건이다: ' + r.로그.join(' / '));
  assert.ok(r.메일[0].제목.includes('S2') && /건너뜀|건너뛴/.test(r.메일[0].제목), '제목이 누구를 버렸는지 안 말한다: ' + r.메일[0].제목);
  assert.ok(r.로그.some((l) => l.includes('⏭') && l.includes('S2')), '로그에도 안 남았다: ' + r.로그.join(' / '));
});

test('[#Q106] ☠️ 벽이 «바뀌면» 시계는 0 에서 다시 간다 — 옛 시계를 물려받으면 엉뚱한 학생을 버린다', () => {
  /* 저장된 자리는 S1 인데 이번 밤의 벽은 S2 다(S1 이 나은 뒤 S2 가 막기 시작한 모양). */
  const r = 태우기({ 음성행들: 실패행들, 응답: S2실패, 속성: 벽시계('S1@2026-08-16 23:01', 창 * 3) });
  assert.equal(r.마크, '2026-08-16 23:01', '🔴 남의 시계로 S2 를 첫 밤에 버렸다');
  assert.ok(String(r.벽).startsWith('S2@'), `새 벽의 자리를 안 적었다: ${r.벽}`);
  assert.equal(r.메일.length, 0);
});

test('[#Q106] ☠️ 깨진 시계는 «새 벽»으로 읽는다 — 못 읽는 값을 「오래됐다」로 접으면 그 밤에 즉시 버린다', () => {
  for (const 값 of ['', '쓰레기', 'S2@2026-08-16 23:02|', 'S2@2026-08-16 23:02|NaN', 'S2@2026-08-16 23:02|' + (Date.now() + 86400000)]) {
    const r = 태우기({ 음성행들: 실패행들, 응답: S2실패, 속성: { '문법판정_벽_음성': 값 } });
    assert.equal(r.마크, '2026-08-16 23:01', `깨진 시계(${값})로 학생을 버렸다 — 틀릴 때 방향은 「지연」이어야 한다`);
    assert.equal(r.메일.length, 0, `깨진 시계(${값})로 통보까지 냈다`);
  }
});

test('[#Q106] 🔑 벽이 아예 없으면 시계를 지운다 — 안 지우면 나중에 같은 자리에 선 벽이 첫 밤에 만료된다', () => {
  const r = 태우기({ 음성행들: 실패행들, 속성: 벽시계('S2@2026-08-16 23:02', 창 * 2) });
  assert.equal(r.마크, '2026-08-16 23:03', '실패가 0인데 워터마크가 안 갔다');
  assert.equal(r.벽, undefined, `벽이 없는데 시계가 남았다: ${r.벽}`);
});

test('[#Q99] 밤당 학생 상한에 걸려도 «같은 도장»은 통째로 담는다 — 경계에서만 새는 유실을 만들지 않는다', () => {
  const 행들 = [];
  for (let i = 0; i <= 상한; i++) 행들.push(음성행({ sid: 'S' + i, 도장: '2026-08-16 23:10' }));
  행들.push(음성행({ sid: 'Z', 도장: '2026-08-16 23:20' }));
  const r = 태우기({ 음성행들: 행들 });
  assert.equal(r.호출.length, 상한 + 1, '동률 도장 무리를 중간에서 잘랐다 — 못 담은 행이 워터마크 뒤로 영영 사라진다');
  assert.equal(r.마크, '2026-08-16 23:10', '워터마크가 담지도 않은 다음 무리까지 넘어갔다');
});

/* ─────────── 4. 배선 — 장부의 지목이 실물과 맞는가 ─────────── */

test('[#Q99] 야간 오케스트레이터가 전사 **뒤에** 이 판정을 부른다 (그날 전사분이 그날 판정에 들어간다)', () => {
  /* 🔴 **함수 «정의»를 호출부로 읽지 않는다**(변이가 잡은 구멍 · 08-17). 앞판은 파일 전체에서
   *   `masteryFromVoice_(ss)` 를 찾았는데, 그 문자열은 `function masteryFromVoice_(ss) {` 안에도
   *   있다 — 야간 배치에서 호출을 통째로 지워도 정의가 남아 **초록**이었다. 그래서 과녁을
   *   오케스트레이터 «몸»으로 좁히고, 정의 줄이 그 안에 없음을 분모로 함께 못박는다. */
  const 몸통 = 코드만(교재);
  const s = 몸통.indexOf('function 교재연동Nightly()');
  assert.notEqual(s, -1, '야간 오케스트레이터를 못 찾았다');
  const 몸 = 몸통.slice(s, 몸통.indexOf('\nfunction ', s + 10));
  assert.ok(!/function\s+masteryFromVoice_/.test(몸), '자른 구간에 함수 정의가 들어왔다 — 이 검사의 분모가 거짓이다');
  const 전사 = 몸.indexOf('voiceTranscribe_(ss)');
  const 판정 = 몸.indexOf('masteryFromVoice_(ss)');
  assert.ok(전사 > -1, '야간 오케스트레이터가 전사를 안 부른다');
  assert.ok(판정 > -1, '야간 오케스트레이터가 말하기 판정을 안 부른다 — 배선이 없으면 도달도 없다');
  assert.ok(전사 < 판정, '말하기 판정이 전사보다 앞이다 — 그날 밤 전사분이 하루를 기다린다');
});

test('[#Q99] 도달 장부가 이 함수를 지목하고, 래칫이 함께 내려갔다', () => {
  const { 읽다 } = require('../tools/lib/시트도달.js');
  const r = 읽다(ROOT);
  assert.deepEqual(r.위반, [], '시트층 도달 장부에 위반이 있다');
  assert.equal(r.장부['voice_log'].소비자, '교재연동.js:masteryFromVoice_');
  assert.ok(r.셈.도달0목록.indexOf('voice_log') === -1, 'voice_log 가 아직 도달 0 목록에 있다');
  /* 래칫은 «측정»과 맞물려야 의미가 있다 — 상한만 내리고 실물이 안 따라오면 다음 세션이 빨강을 본다. */
  assert.equal(r.상한.도달0, r.셈.도달0,
    `상한(${r.상한.도달0})과 실측(${r.셈.도달0})이 어긋난다 — 갚았으면 그 자리에서 상한도 내린다`);
});
