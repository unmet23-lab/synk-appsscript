'use strict';
/**
 * 🗣 대화 문법 판정 — **자유 대화에서 스스로 쓴 문장이 진화·연습 노트에 닿는가** (#Q99 · 시트층 도달 4/5)
 *
 * ■ 왜 «실행» 검사인가
 *   시트층 도달 장부(`엔진_셋업확장.js` `수집도달_`)가 재는 것은 「지목한 파일의 코드에 탭 이름이
 *   실재하는가」까지다 — 소비자를 적어 두고 읽는 몸을 비워도 그 장부는 초록이다(설계 §8 「⚠ 천장」).
 *   그래서 여기서는 `masteryFromTalk_` 를 **가짜 의존으로 실제로 태워**, ①모델에게 건네는 것이
 *   학생문인지 ②`mastery_log` 의 «상태» 칸이 실제로 바뀌는지 ③포인터가 재료를 버리지 않는지를 잰다.
 *   「읽는다」가 아니라 **「다음에 줄 것이 바뀐다」**가 과녁이다.
 *
 * ■ 이 판이 특히 조심하는 것 — 이 칸의 사유는 «이미 서 있는 배선»을 가리켰다
 *   `talkBatch_` 는 이미 `talkHistory_` 로 이 탭을 읽는다(답장 맥락). 그러니 「talk_log 를 읽는
 *   코드가 있나」로 재면 이 트랙은 **짓기 전에도 초록**이다. 그래서 아래 검사는 하나도 «읽는가»를
 *   묻지 않고, 전부 «mastery_log 가 바뀌는가 / 포인터가 어디 서는가»만 묻는다.
 *
 * ■ 이 시험이 틀릴 때의 모습 (대가를 함께 적는다)
 *   가짜 `aiCall_` 이 늘 같은 답을 주므로 **판정의 «질»은 여기서 못 잰다** — 재는 것은 배선과
 *   불변식뿐이다. 그리고 호출이 0건이면 **실패로 떨어뜨린다** — 미실행은 통과와 같은 모양이다(F207).
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
const TALK_LOG_HEADERS = JSON.parse(엔진.match(/const TALK_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const MASTERY_LOG_HEADERS = JSON.parse(엔진.match(/const MASTERY_LOG_HEADERS = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
const 상한 = Number(교재.match(/const TB_TALK_JUDGE_MAX_PER_RUN = (\d+);/)[1]);
const 글자상한 = Number(교재.match(/const TB_JUDGE_TEXT_CAP = (\d+);/)[1]);

/** 엔진 정본 함수 하나를 «진짜로» 꺼낸다(스텁으로 대신하면 시험이 내 상상을 잰다). */
function 엔진함수(머리, 이름, 의존) {
  const s = 엔진.indexOf(머리);
  assert.notEqual(s, -1, `엔진에서 ${머리} 를 못 찾았다`);
  const e = 엔진.indexOf('\nfunction ', s + 머리.length);
  const n = Object.keys(의존 || {});
  return new Function(...n, `${엔진.slice(s, e)}\nreturn ${이름};`)(...n.map((k) => 의존[k]));
}

/* 판정 대상은 `GRAMMAR_BANK` 의 G2xx·G3xx 뿐이다 — 픽스처 뱅크도 그 규칙을 따른다. */
const 가짜뱅크 = [['G201', '이에요/예요'], ['G202', '있어요/없어요'], ['G301', '-(으)러 가다'], ['G999', '범위 밖']];

/* 판정관 **셋 다** 이 조각 안에 있다 — 쓰는 통로(`masteryApply_`)를 공유하게 만든 판이라,
 * 대화만 재고 나머지를 안 재면 그 공유가 쓰기를 깨뜨려도 초록이다(리팩터의 전형적 사각). */
const 교재조각 = 교재.slice(교재.indexOf('function masteryFromFeedback_('));

const fmt = (dt, tz, f) => {
  const p = (n) => String(n).padStart(2, '0');
  const 날짜 = dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
  return f === 'yyyy-MM-dd' ? 날짜 : 날짜 + ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes());
};
const 날 = (n) => fmt(new Date(Date.now() - n * 86400000), null, 'yyyy-MM-dd');
/* `dstr` 은 엔진 정본을 쓴다 — 「어제 근거인가」 판정이 시험의 손짐작이면 승격 가드를 잰 게 아니다. */
const dstr = 엔진함수('function dstr(v, tz, fmt)', 'dstr', { Utilities: { formatDate: fmt } });

/** talk_log 한 행 — 이름 붙은 칸만 받고 나머지는 정본 헤더 길이에 맞춰 채운다. */
const 대화행 = (o) => {
  const r = new Array(TALK_LOG_HEADERS.length).fill('');
  r[0] = 'TK-' + (o.sid || 'x') + '-' + (o.턴 || 1);
  r[1] = o.sid;
  r[2] = o.턴 || 1;
  r[3] = o.문장 === undefined ? '저는 학교에 가요' : o.문장;
  r[4] = o.답 === undefined ? '좋아요! 오늘은 뭐 했어요?' : o.답;
  r[6] = o.제출일 || 날(1);
  return o.폭 ? r.slice(0, o.폭) : r;
};
/** mastery_log 한 행 — 상태·출처·근거일을 골라 놓는다. */
const 숙달행 = (o) => [o.sid, o.gid, o.상태 || '연습', o.첫기록일 || 날(3), '', o.출처 || 'AI첨삭',
  o.근거일 === undefined ? new Date(Date.now() - 86400000) : o.근거일];

/** 읽기는 그대로 통과시키고 **쓰기만** 던지는 껍데기 — 시트 쓰기 실패(할당량·락·6분 초과)를 흉내 낸다. */
function 쓰기폭발시트(sh) {
  return Object.assign(Object.create(Object.getPrototypeOf(sh) || Object.prototype), sh, {
    getRange: (...a) => {
      const r = sh.getRange(...a);
      return Object.assign(Object.create(Object.getPrototypeOf(r) || Object.prototype), r, {
        setValues: () => { throw new Error('가짜 시트 쓰기 실패'); },
        setValue: () => { throw new Error('가짜 시트 쓰기 실패'); }
      });
    }
  });
}

/**
 * `masteryFromTalk_` 를 실제로 태우고, 모델에 건넨 것과 mastery_log 의 «남은 모양»을 돌려준다.
 * @param {{대화행들?:Array, 숙달행들?:Array, 응답?:object|Function, 포인터?:string, 쓰기?:boolean}} 옵션
 */
function 태우기(옵션) {
  const o = 옵션 || {};
  const 호출 = [], 로그 = [], 속성 = Object.assign({ CLAUDE_API_KEY: 'KEY' }, o.속성 || {});
  if (o.포인터 !== undefined) 속성['문법판정_대화포인터'] = String(o.포인터);
  /* 🔴 폭은 **헤더가 정한다** — 실측(내 첫 픽스처가 여기서 틀렸다): 데이터 행만 짧게 잘라도
   *   `getLastColumn` 은 13열 헤더를 보고 13을 돌려주므로 «좁은 시트»가 안 만들어진다. 그때 재는 것은
   *   폭 가드가 아니라 「짧은 행이 빈칸으로 패딩되는가」(계약 ⑥)라, 통과해도 뜻이 다르다.
   *   구 8열 시트는 헤더도 8열이므로, 좁은 시트를 흉내 내려면 헤더까지 함께 자른다. */
  const 헤더 = o.헤더폭 ? TALK_LOG_HEADERS.slice(0, o.헤더폭) : TALK_LOG_HEADERS.slice();
  const tl = 시트흉내({ 첫행: 1, 행들: [헤더].concat(o.대화행들 || []) });
  const ml = 시트흉내({ 첫행: 1, 행들: [MASTERY_LOG_HEADERS.slice()].concat(o.숙달행들 || []) });
  /* hw_feedback 은 4열까지만 읽힌다(제출문 = D열) — 쓰기 판정 경로를 태울 때만 채운다. */
  const fb = o.첨삭행들 ? 시트흉내({ 첫행: 1, 행들: [['id', 'student_id', '제출일', '제출문']].concat(o.첨삭행들) }) : null;
  const ss = {
    getSheetByName: (n) => (n === 'talk_log' ? tl : n === 'mastery_log' ? ml : n === 'hw_feedback' ? fb : null),
    getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar'
  };
  const 의존 = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (속성[k] === undefined ? null : 속성[k]),
      setProperty: (k, v) => { 속성[k] = String(v); }
    }) },
    Utilities: { formatDate: fmt },
    Logger: { log: (m) => 로그.push(String(m)) },
    헤더보정_: () => {},
    /* `쓰기폭발` — `masteryApply_` 의 **시트 쓰기만** 던지게 한다(읽기는 그대로).
     *   AI 호출 실패는 이미 `응답: new Error()` 로 재고 있는데, 그 «뒤» 쓰기가 던지는 축은
     *   안 재고 있었다 — 커서를 먼저 찍으면 그 행들이 영구 미판정이 되는 자리다. */
    ensureSheet: (s, n) => (n === 'mastery_log' ? (o.쓰기폭발 ? 쓰기폭발시트(ml) : ml) : 시트흉내({ 첫행: 1, 행들: [[]] })),
    aiCall_: (k, sys, usr) => {
      호출.push({ 시스템: sys, 사용자: usr });
      const r = typeof o.응답 === 'function' ? o.응답(호출.length, usr) : (o.응답 || { used: [], wrong: [] });
      if (r instanceof Error) throw r;
      return r;
    },
    GRAMMAR_BANK: o.뱅크 || 가짜뱅크,
    MASTERY_LOG_HEADERS,
    TALK_LOG_HEADERS,
    TB_TALK_JUDGE_MAX_PER_RUN: 상한,
    TB_JUDGE_TEXT_CAP: 글자상한,
    TB_JUDGE_MAX_PER_RUN: Number(교재.match(/const TB_JUDGE_MAX_PER_RUN = (\d+);/)[1]),
    dstr
  };
  const n = Object.keys(의존);
  const 판정관 = new Function(...n, `${교재조각}\nreturn { masteryFromTalk_, masteryFromFeedback_ };`)(...n.map((k) => 의존[k]));
  /* 던진 예외는 **삼키지 말고 돌려준다** — 야간 오케스트레이터가 함수별 try 로 삼키는 그 자리를
   *   흉내 내되, 시험은 「던졌나」와 「그때 커서가 어디 섰나」를 둘 다 봐야 한다. */
  let 예외 = null;
  try { (o.쓰기 ? 판정관.masteryFromFeedback_ : 판정관.masteryFromTalk_)(ss); } catch (e) { 예외 = e; }
  if (예외 && !o.쓰기폭발) throw 예외; // 폭발을 안 시켰는데 던졌다 = 진짜 결함이니 감추지 않는다
  const 숙달 = ml.data.slice(1).filter((r) => r && r[0]).map((r) => ({ sid: r[0], gid: r[1], 상태: r[2], 출처: r[5] }));
  return { 호출, 로그, 숙달, 속성, 예외, 포인터: 속성['문법판정_대화포인터'] };
}

/* ───────────────────────── 1. 재료가 실제로 건네진다 ───────────────────────── */

test('[#Q99] 학생문이 있으면 판정관에게 «학생이 대화에서 쓴 문장»이 실제로 건네진다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1', 문장: '어제 친구랑 시장에 갔어요' })] });
  assert.equal(r.호출.length, 1, '학생문이 있는데 모델을 한 번도 안 불렀다 — 미실행이지 통과가 아니다: ' + r.로그.join(' / '));
  assert.ok(r.호출[0].사용자.includes('어제 친구랑 시장에 갔어요'), '건넨 문자열에 학생문이 없다');
  assert.ok(r.호출[0].사용자.includes('G201=이에요/예요'), '문법 목록이 뱅크에서 파생되지 않았다');
  assert.ok(!r.호출[0].사용자.includes('G999'), '판정 범위(G2xx·G3xx) 밖 문법이 실렸다');
});

test('[#Q99] AI 답장은 판정 입력에 안 실린다 — 모방을 학생 실력으로 세면 안 된다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1', 문장: '학교에 가요', 답: '잘했어요! 「학교에 가요」가 맞아요' })] });
  assert.equal(r.호출.length, 1);
  assert.ok(!r.호출[0].사용자.includes('잘했어요'), 'AI 답장이 판정 입력에 섞였다 — 답장의 올바른 형태가 학생 실력으로 세어진다');
});

test('[#Q99] 지문이 «자유 대화»임을 밝힌다 — 안 밝히면 판정관이 작문 과제의 잣대를 댄다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })] });
  const sys = r.호출[0].시스템;
  assert.match(sys, /대화/, '지문이 이 문장의 출처를 안 밝힌다');
  assert.match(sys, /구어체|채팅/, '채팅의 특징(구어·줄임)을 오류로 보지 말라는 지시가 없다');
  assert.match(sys, /되받아|모방|애매하면 제외/, '직전 답장을 되받아 쓴 것일 수 있다는 경고가 없다');
});

test('[#Q99] 학생문이 빈 행은 재료가 아니다 — 부르지 않는다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1', 문장: '' })] });
  assert.equal(r.호출.length, 0, '학생문이 없는데 모델을 불렀다(빈 프롬프트에 돈을 쓴다)');
});

test('[#Q99] 폭이 학생문(D열)에 못 미치는 시트는 즉시 반환한다 — 재료 0 과 「대화 없는 밤」을 안 섞는다', () => {
  const r = 태우기({ 헤더폭: 3, 대화행들: [대화행({ sid: 'S1', 폭: 3 })] });
  assert.equal(r.호출.length, 0, '학생문 열이 없는데 판정을 시도했다');
  assert.equal(r.포인터, undefined, '읽지도 못한 시트에서 포인터가 전진했다 — 나중에 치유돼도 그 행은 커서 뒤다');
});

test('[#Q99] 구 8열 시트는 그대로 판정된다 — 학생문은 D열이라 치유를 기다릴 필요가 없다', () => {
  const r = 태우기({ 헤더폭: 8, 대화행들: [대화행({ sid: 'S1', 문장: '시장에 갔어요', 폭: 8 })] });
  assert.equal(r.호출.length, 1, '구 8열 시트에서 판정이 안 돌았다 — 읽는 자가 치유를 기다리면 그 밤은 통째로 빈다');
  assert.ok(r.호출[0].사용자.includes('시장에 갔어요'));
});

/* ───────────────────── 2. 다음에 줄 것이 바뀐다(mastery_log) ───────────────────── */

test('[#Q99] 첫 근거는 «연습»으로 입장하고 출처가 AI대화로 남는다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })], 응답: { used: ['G201'], wrong: [] } });
  assert.deepEqual(r.숙달, [{ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI대화' }]);
});

test('🔒 [#Q99] 대화 근거 «단독»으로는 다른 날 2회여도 «도달» 승격을 안 시킨다', () => {
  const r = 태우기({
    대화행들: [대화행({ sid: 'S1' })],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI대화' })],
    응답: { used: ['G201'], wrong: [] }
  });
  assert.equal(r.숙달[0].상태, '연습',
    '대화만으로 도달까지 갔다 — 직전 답장이 올바른 형태를 보여준 층이라 모방과 습득이 구분되지 않는다(강등 없는 게이트)');
});

test('[#Q99] 대화 → 쓰기로 층이 겹치면 승격한다(의도된 통과 — 쓰기 확인이 있다)', () => {
  const r = 태우기({
    쓰기: true,
    첨삭행들: [['F1', 'S1', 날(0), '저는 학생이에요']],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '연습', 출처: 'AI대화' })],
    응답: { used: ['G201'], wrong: [] }
  });
  assert.equal(r.숙달[0].상태, '도달', '쓰기 확인이 겹쳤는데 승격이 막혔다 — 대화 가드가 쓰기까지 잠갔다');
});

test('[#Q99] 이미 «도달»인 칸은 대화에서 틀려도 안 내려간다(단방향 상향)', () => {
  const r = 태우기({
    대화행들: [대화행({ sid: 'S1' })],
    숙달행들: [숙달행({ sid: 'S1', gid: 'G201', 상태: '도달', 출처: 'AI첨삭' })],
    응답: { used: [], wrong: ['G201'] }
  });
  assert.equal(r.숙달[0].상태, '도달', '강등이 생겼다 — 진화 게이트가 오늘의 채팅 한 줄로 내려간다');
});

test('[#Q99] 목록 밖 ID 는 버린다 — 판정관이 지어낸 문법이 진화에 실리지 않는다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })], 응답: { used: ['G999', 'G404', 'G202'], wrong: [] } });
  assert.deepEqual(r.숙달.map((x) => x.gid), ['G202'], '범위 밖·존재하지 않는 ID 가 기록됐다');
});

test('[#Q99] 뱅크를 못 읽으면 아무것도 판정하지 않는다 — 지어낸 ID 차단이 죽은 채로 돌면 안 된다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })], 뱅크: [] });
  assert.equal(r.호출.length, 0, '뱅크가 빈데 모델을 불렀다');
  assert.equal(r.숙달.length, 0);
});

/* ───────────────────── 3. 포인터가 재료를 버리지 않는다 ───────────────────── */

test('[#Q99] 성공하면 포인터가 읽은 행만큼 전진한다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' }), 대화행({ sid: 'S2' })] });
  assert.equal(r.포인터, '3', `헤더 1 + 2행을 읽었으면 포인터는 3이다(받은 값: ${r.포인터})`);
});

test('[#Q99] 판정에 실패한 학생이 있으면 포인터가 «그 학생의 첫 행 앞»에서 선다', () => {
  const r = 태우기({
    대화행들: [대화행({ sid: 'S1' }), 대화행({ sid: 'S2' }), 대화행({ sid: 'S3' })],
    응답: (n) => (n === 2 ? new Error('벤더 500') : { used: ['G201'], wrong: [] })
  });
  assert.equal(r.호출.length, 3, '한 학생이 실패했는데 나머지가 안 돌았다 — 격리가 아니라 중단이다');
  assert.equal(r.포인터, '2', `실패한 S2 의 행(3행) 앞인 2에서 서야 한다(받은 값: ${r.포인터}) — 전진하면 그 문장은 커서 뒤라 영구 누락이다`);
  assert.deepEqual(r.숙달.map((x) => x.sid), ['S1', 'S3'], '실패는 격리되고 나머지는 기록돼야 한다');
});

test('[#Q99] 첫 학생부터 실패하면 포인터는 아예 안 움직인다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })], 응답: () => new Error('벤더 500') });
  assert.equal(r.포인터, undefined, '전부 실패인데 포인터가 전진했다 — 그 밤의 재료가 통째로 사라진다');
});

test('[#Q99] 학생 상한에 걸리면 «그 앞 행»에서 멈추고 포인터도 그 앞에 선다', () => {
  const 행들 = [];
  for (let i = 0; i <= 상한; i++) 행들.push(대화행({ sid: 'S' + i })); // 상한 + 1 명
  const r = 태우기({ 대화행들: 행들 });
  assert.equal(r.호출.length, 상한, `상한 ${상한} 명만 판정해야 한다(받은 값: ${r.호출.length})`);
  assert.equal(r.포인터, String(1 + 상한), `상한 밖 학생의 행을 넘어가면 그 문장은 영구 누락이다(받은 값: ${r.포인터})`);
  assert.match(r.로그.join(' '), new RegExp('상한 밖 1행'), '상한 밖 행 수를 분모로 안 적었다 — 0 은 분모와 함께 읽는다');
});

test('[#Q99] 포인터가 탭 끝 밖이면 되감는다 — wipe·시연 종료 뒤에도 산다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })], 포인터: 99 });
  assert.equal(r.호출.length, 0);
  assert.equal(r.포인터, '2', `끝 행(2)으로 되감아야 다음 밤부터 다시 읽힌다(받은 값: ${r.포인터})`);
});

test('[#Q99] 같은 학생의 여러 턴은 한 번의 판정으로 묶인다 — 학생당 호출 1회', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1', 턴: 1, 문장: '가나' }), 대화행({ sid: 'S1', 턴: 2, 문장: '다라' })] });
  assert.equal(r.호출.length, 1, '같은 학생을 턴마다 따로 불렀다 — 비용이 턴 수에 비례한다');
  assert.ok(r.호출[0].사용자.includes('가나') && r.호출[0].사용자.includes('다라'), '묶인 문장 중 하나가 빠졌다');
});

/* ───────────────────── 4. 배선 — 야간에 실제로 돈다 ───────────────────── */

test('[#Q99] 야간 오케스트레이터가 대화 판정을 «STT 앞»에서 부른다', () => {
  /* 🔴 3/5 가 변이로 잡은 구멍: 함수 «정의»를 호출부로 읽으면 배선을 지워도 초록이다.
   *   그래서 `교재연동Nightly` 의 **몸통만** 잘라 그 안에서 찾는다(정의는 이 조각에 없다). */
  const s = 교재.indexOf('function 교재연동Nightly()');
  assert.notEqual(s, -1, '야간 오케스트레이터를 못 찾았다');
  const 몸 = 코드만(교재.slice(s, 교재.indexOf('\nfunction ', s + 10)));
  const 대화 = 몸.indexOf('masteryFromTalk_(ss)');
  const 쓰기 = 몸.indexOf('masteryFromFeedback_(ss)');
  const 전사 = 몸.indexOf('voiceTranscribe_(ss)');
  assert.ok(대화 > -1, '대화 판정이 야간 오케스트레이터에 안 붙었다 — 함수만 있고 아무도 안 부르면 도달이 아니다');
  assert.ok(쓰기 > -1 && 전사 > -1, '기준으로 삼을 두 호출부가 사라졌다 — 이 검사가 낡았다');
  assert.ok(대화 > 쓰기, '대화 판정이 쓰기 판정보다 앞이다(순서 근거가 바뀌었으면 이 검사도 같이 고쳐라)');
  assert.ok(대화 < 전사, '대화 판정이 STT 뒤로 밀렸다 — 6분 예산이 깎인 뒤라 굶는다(말하기 상한을 10 으로 낮춘 그 자리)');
});

test('[#Q99] 실패해도 야간의 다음 칸이 돈다 — try/catch 로 격리돼 있다', () => {
  const s = 교재.indexOf('function 교재연동Nightly()');
  const 몸 = 코드만(교재.slice(s, 교재.indexOf('\nfunction ', s + 10)));
  assert.match(몸, /try \{ masteryFromTalk_\(ss\); \} catch/, '대화 판정이 격리 없이 불린다 — 여기서 터지면 그 밤의 나머지가 통째로 멈춘다');
});

test('[#Q99] 로그가 분모와 함께 나온다 — 「닿는다」가 학생 0명이어도 참이 되는 것을 막는다', () => {
  const r = 태우기({ 대화행들: [대화행({ sid: 'S1' })], 응답: { used: ['G201'], wrong: [] } });
  const 줄 = r.로그.join(' ');
  assert.match(줄, /새 행 \d+행/, '분모(새 행 수)가 없다');
  assert.match(줄, /학생 \d+명 = 판정 \d+ \+ 실패 \d+/, '학생 수를 판정·실패로 갈라 적지 않았다');
  assert.match(줄, /신규 기록 \d+/, '실제로 기록된 수가 없다 — 「돌았다」와 「닿았다」가 같은 모양이 된다');
});

/* ─────────── 4-b. 쓰기가 던져도 재료를 안 버린다 (①배포 검수 P1 `bfe9cce47844`) ───────────
 *
 * 🔴 위 4절이 재던 「실패」는 전부 **AI 호출** 실패다. 그 아래 `masteryApply_` 의 시트 쓰기가
 *   던지는 축은 안 재고 있었고, 그 자리에서 포인터가 **쓰기보다 먼저** 찍히고 있었다 —
 *   야간 오케스트레이터가 예외를 삼키는 동안 포인터만 전진해 그 문장은 커서 뒤로 넘어간다.
 *   오류뱅크 커서가 v9.211·v9.212 에서 두 번 고친 병과 같은 모양이고, 새는 방향은 **조용한 유실**이라
 *   평소 초록으로는 원리상 안 보인다(그래서 픽스처가 탐지력을 진다 · 가드 맹점 ②). */

test('[P1] 시트 쓰기가 던지면 포인터가 안 움직인다 — 삼켜진 예외 뒤로 문장이 영구 미판정이 되면 안 된다', () => {
  const r = 태우기({
    대화행들: [대화행({ sid: 'S1' }), 대화행({ sid: 'S2' })],
    응답: { used: ['G201'], wrong: [] },
    쓰기폭발: true
  });
  assert.ok(r.예외, '쓰기가 안 던졌다 — 이 시험이 재려던 상황이 아예 안 만들어졌다(미실행은 통과와 같은 모양이다)');
  assert.equal(r.포인터, undefined,
    '쓰기가 던졌는데 포인터가 전진했다 — 그 행들은 커서 뒤라 다시 못 읽힌다(영구 미판정)');
});

test('[P1] 쓰기가 던져도 판정 자체는 돌았다 — 「포인터가 안 움직였다」가 «아무것도 안 했다»와 갈린다', () => {
  const r = 태우기({
    대화행들: [대화행({ sid: 'S1' })],
    응답: { used: ['G201'], wrong: [] },
    쓰기폭발: true
  });
  assert.equal(r.호출.length, 1, '판정 호출이 0건이면 포인터가 안 선 이유가 «재료 0» 일 수도 있다 — 축이 갈려야 한다');
});

test('[P1] 판정관 셋이 «쓰기 → 커서» 순서를 함께 지킨다 — 순서가 갈리면 갈린 쪽이 조용히 샌다', () => {
  /* 같은 불변식을 세 함수가 각자 적는 자리라, 넷째 판정관이 붙는 날 순서만 뒤집혀도 초록이다.
   *   그래서 «소스 순서»를 직접 못박는다 — 실행 검사는 그 함수를 태울 때만 재기 때문이다. */
  const 판정관들 = [
    ['masteryFromFeedback_', '문법판정_포인터'],
    ['masteryFromVoice_', '문법판정_음성마크'],
    ['masteryFromTalk_', '문법판정_대화포인터']
  ];
  /* 🔴 **「마지막 찍기가 뒤에 있나」로 물으면 안 된다** — 변이가 그 구멍을 잡아냈다(2/4 → 4/4):
   *   앞에 한 줄을 «더» 넣어도 뒤의 진짜 줄이 그대로라 `lastIndexOf` 비교는 초록이다. 실제로 위험한
   *   모양이 정확히 그것이다(중복 찍기). 그래서 **찍기 전부**를 보고, 물음을 바꾼다:
   *     「쓰기까지 흘러갈 수 있는 찍기가 있나」 = 찍기와 쓰기 사이에 `return` 이 없으면 위반.
   *   되감기·조기반환 자리(`if (from > last) { …; return; }`)는 쓰기에 도달하지 않으므로 정당하고,
   *   이 물음이 그 둘을 정확히 가른다. */
  const 몸 = 코드만(교재); // 주석 안의 낱말이 순서 판정을 뒤집지 못하게 벗긴 몸으로만 본다
  for (const [이름, 커서] of 판정관들) {
    const s = 몸.indexOf('function ' + 이름 + '(');
    assert.notEqual(s, -1, `${이름} 를 못 찾았다`);
    const e = 몸.indexOf('\nfunction ', s + 1);
    const 구간 = 몸.slice(s, e === -1 ? undefined : e);
    const 적용 = 구간.indexOf('masteryApply_(');
    assert.notEqual(적용, -1, `${이름} 가 공용 쓰기 통로를 안 쓴다`);

    const 찍기들 = [];
    for (let i = 구간.indexOf("setProperty('" + 커서 + "'"); i !== -1;
         i = 구간.indexOf("setProperty('" + 커서 + "'", i + 1)) 찍기들.push(i);
    assert.ok(찍기들.length, `${이름} 에서 커서 ${커서} 를 찍는 자리를 못 찾았다`);
    assert.ok(찍기들.some((i) => i > 적용),
      `${이름}: 쓰기(masteryApply_) «뒤»에 커서(${커서})를 찍는 자리가 없다 — 전진이 아예 안 되면 같은 재료를 매일 다시 태운다`);

    for (const i of 찍기들.filter((i) => i < 적용)) {
      assert.ok(구간.slice(i, 적용).includes('return'),
        `${이름}: 쓰기까지 흘러가는 자리에서 커서(${커서})를 «먼저» 찍는다(${i}) — `
        + '쓰기가 던지면 야간이 예외를 삼키는 동안 커서만 전진해 그 재료는 영구 미판정이다');
    }
  }
});

/* ───────────────────── 5. 장부가 이 배선을 가리킨다 ───────────────────── */

test('[#Q99] 도달 장부의 talk_log 칸이 이 판정관을 지목하고, 래칫이 함께 내려갔다', () => {
  const { 읽다 } = require('../tools/lib/시트도달.js');
  const r = 읽다(ROOT);
  assert.deepEqual(r.위반, [], '도달 장부에 위반이 있다: ' + JSON.stringify(r.위반));
  assert.deepEqual(r.장부['talk_log'], { 소비자: '교재연동.js:masteryFromTalk_', 층: '제품' },
    'talk_log 칸이 이 판정관을 안 가리킨다 — 코드만 세우고 장부를 안 고치면 화면은 계속 빚으로 센다');
  assert.equal(r.셈.도달0, r.상한.도달0,
    `래칫에 슬랙이 생겼다(실측 ${r.셈.도달0} · 상한 ${r.상한.도달0}) — 빚을 갚았으면 상한도 같은 커밋에서 내려라`);
  assert.ok(!r.셈.도달0목록.includes('talk_log'), 'talk_log 가 아직 도달 0 목록에 있다');
});
