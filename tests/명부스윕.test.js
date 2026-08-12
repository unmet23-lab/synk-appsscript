/* 명부 스윕 회귀 — profiles 가 사람 손 없이 `engine.learners` 에 닿는 통로 (E² · 철학정합 §3-E-2)
 *
 * 이 파일이 지키는 것은 「기능이 있는가」가 아니라 **「조용히 새지 않는가」**다. 스윕의 실패는 전부
 * 같은 얼굴을 하고 있다 — 아무 일도 안 일어나고, 아무 데도 안 남는다:
 *   ① 안 켰는데 켠 줄 안다   ② 학생 한 줄이 조용히 빠진다   ③ 알림이 한 번 울고 영영 침묵한다
 *   ④ 서버가 거절했는데 성공처럼 지나간다   ⑤ 네트워크가 느린 아침에 calcAll 이 통째로 죽는다
 *
 * 실행 검증(스텁 주입) + 소스 검사 2층. Apps Script 런타임 없이 돈다(tests/궤적.test.js 계보).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// SYNK_TEST_SRC_ROOT = 변이 실험용 이음매. 평소엔 실소스를 본다(실파일은 절대 안 건드린다 · F065·F067).
const ROOT = process.env.SYNK_TEST_SRC_ROOT || path.resolve(__dirname, '..');
const 배치 = fs.readFileSync(path.join(ROOT, '엔진_운영배치.js'), 'utf8');

/** 최상위 function 본문을 이름으로 잘라 온다(중괄호 깊이 추적 · 궤적.test.js 와 같은 꼴). */
function 함수본문(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.notEqual(i, -1, name + ' 함수를 못 찾았다');
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') { depth--; if (started && depth === 0) return src.slice(i, j + 1); }
  }
  assert.fail(name + ' 본문 끝을 못 찾았다');
}

/** 기본 profiles 판 — 1행 머리글 + 학생 2 + 강사 1(규칙 lib 몫이라 여기서 안 거른다). */
const 기본표 = () => ([
  ['user_id', '이름', '이름_몽골', 'role', 'class_name', '생일', 'email', '연락처'],
  ['SYNK-001', '바트', 'Бат', 'student', 'A반', '2005-03-01', '', '99112233'],
  ['SYNK-002', '사랑', 'Саран', 'student', 'A반', '2006-07-11', '', '88445566'],
  ['T-01', '김강사', '', 'teacher', 'A반', '', '', '01011112222'],
]);

const 속성기본 = { ROSTER_INGEST_URL: 'https://x.supabase.co/functions/v1/roster-ingest', ROSTER_INGEST_KEY: 'k', ROSTER_INGEST_ANON: 'a' };

/** 스텁 한 판을 세우고 `명부스윕_` 을 실행 가능한 함수로 돌려준다. */
function 판(옵션) {
  const o = 옵션 || {};
  const 표 = o.표 === undefined ? 기본표() : o.표;
  const 상태 = { 명부스윕_상태: o.기존서명 || '' };
  const 메일 = []; const 로그 = []; const 요청 = []; const 쓴상태 = [];
  const 스텁 = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (o.속성 === undefined ? 속성기본 : o.속성)[k] || null }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => (n === 'profiles' && 표 ? {
          getLastRow: () => 표.length,
          getRange: () => ({ getDisplayValues: () => 표.map((r) => r.slice()) }),
        } : null),
      }),
    },
    UrlFetchApp: {
      fetch: (url, opt) => {
        요청.push({ url, opt });
        if (o.던짐) throw new Error(o.던짐);
        return { getResponseCode: () => (o.코드 === undefined ? 200 : o.코드), getContentText: () => (o.응답 === undefined ? '{"ok":true}' : o.응답) };
      },
    },
    Logger: { log: (m) => 로그.push(String(m)) },
    ensureSheet: () => ({}),
    getState: (_st, k) => ({ val: 상태[k] || '' }),
    setState: (_st, k, v) => { 상태[k] = v; 쓴상태.push([k, v]); },
    adminMail: (제목, 본문) => 메일.push({ 제목, 본문 }),
  };
  const 이름들 = Object.keys(스텁);
  const fn = new Function(...이름들, 함수본문(배치, '명부스윕_') + '\nreturn 명부스윕_;')(...이름들.map((k) => 스텁[k]));
  return { fn, 상태, 메일, 로그, 요청, 쓴상태 };
}

/* ① 미배선 = 0초 스킵. 「아직 안 켠 것」과 「고장」은 다르다 — 안 켠 것은 소리 내지 않는다.
 *   세 칸을 하나씩 비워 본다: 한 칸만 검사하면 나머지 두 칸이 빈 채로 fetch 가 나간다. */
test('명부스윕 ① 속성 3칸 중 하나라도 비면 왕복도 알림도 상태 기록도 없다', () => {
  for (const 뺄것 of ['ROSTER_INGEST_URL', 'ROSTER_INGEST_KEY', 'ROSTER_INGEST_ANON']) {
    const 속성 = Object.assign({}, 속성기본); 속성[뺄것] = '';
    const p = 판({ 속성 });
    p.fn();
    assert.equal(p.요청.length, 0, 뺄것 + ' 가 비었는데 왕복이 나갔다');
    assert.equal(p.메일.length, 0, 뺄것 + ' 가 비었는데 알림이 울렸다 — 안 켠 것은 고장이 아니다');
    assert.equal(p.쓴상태.length, 0, 뺄것 + ' 가 비었는데 상태를 건드렸다');
  }
  // 공백만 든 칸도 빈 칸이다(속성 편집 중 스페이스 하나가 남는 것이 실제 사고 모양)
  const p = 판({ 속성: Object.assign({}, 속성기본, { ROSTER_INGEST_KEY: '   ' }) });
  p.fn();
  assert.equal(p.요청.length, 0, '공백만 든 시크릿으로 왕복이 나갔다');
});

/* ② 원천 제외는 DEMO- 와 통째로 빈 행 둘뿐이고, 나머지는 **표 원형** 그대로 간다.
 *   급소는 「번호 빈 행」이다 — 여기서 조용히 빼면 그 학생은 영원히 안 보인다(판정은 규칙 lib 몫). */
test('명부스윕 ② DEMO·빈 행만 빼고 표를 원형 그대로 싣는다 — 번호 빈 행은 안 숨긴다', () => {
  const 표 = 기본표();
  표.push(['DEMO-9', '시연', '', 'student', 'A반', '', '', '10000000']);
  표.push(['', '', '', '', '', '', '', '']);                       // 그리드 여백
  표.push(['', '번호없는학생', '', 'student', 'A반', '', '', '77001122']); // 진짜 문제 — 빠지면 안 된다
  const p = 판({ 표 });
  p.fn();
  assert.equal(p.요청.length, 1, '왕복이 안 나갔다');
  const 보낸 = JSON.parse(p.요청[0].opt.payload).표;
  assert.deepEqual(보낸[0], 표[0], '머리글이 원형이 아니다 — 서버가 열 자리를 못 세운다');
  assert.deepEqual(보낸.slice(1), [표[1], 표[2], 표[3], 표[6]],
    'DEMO·빈 행만 빠져야 한다 — 번호 빈 행을 숨기면 그 학생은 영원히 안 보이고, 강사 행 거르기는 규칙 lib 몫이다');
  // 표시값 그대로: 앞자리 0 이 살아 있어야 한다(getValues 로 바꾸면 숫자로 접혀 조용한 잠금이 된다)
  assert.equal(보낸[3][7], '01011112222', '연락처가 원문 표시값이 아니다');
  const h = p.요청[0].opt.headers;
  assert.equal(h['x-roster-ingest-key'], 'k', '좁은 시크릿 헤더가 빠졌다 — 서버는 401 로 답한다');
  assert.equal(h.apikey, 'a');
  assert.equal(h.Authorization, 'Bearer a');
  assert.equal(p.요청[0].opt.muteHttpExceptions, true, '4xx 에서 예외가 나면 본문을 못 읽어 사유가 사라진다');
});

/* ③ 알림은 상태가 바뀔 때 1회. 급소는 **서명이 개수가 아니라 이름**이라는 것 —
 *   개수 서명이면 A 가 고쳐지고 B 가 깨진 날 서명이 그대로라 B 는 영영 안 울린다. */
test('명부스윕 ③ 같은 문제는 1회만 울고, 해소되면 재무장하고, 이름이 바뀌면 다시 운다', () => {
  const 응답 = (번호들) => JSON.stringify({ ok: true, 문제들: 번호들.map((n, i) => ({ 줄: i + 2, 번호: n, 사유: '전화 형식' })) });

  const a = 판({ 응답: 응답(['SYNK-001']) });
  a.fn();
  assert.equal(a.메일.length, 1, '첫 문제에 안 울렸다');
  const 서명1 = a.상태.명부스윕_상태;
  a.fn();
  assert.equal(a.메일.length, 1, '같은 문제로 두 번 울었다 — 매일 도는 배치라 그 메일함이 곧 필터가 된다');

  // 개수는 그대로(1건)인데 사람이 바뀌었다 — 반드시 다시 울어야 한다
  const b = 판({ 응답: 응답(['SYNK-002']), 기존서명: 서명1 });
  b.fn();
  assert.equal(b.메일.length, 1, '개수만 같으면 침묵한다 — 서명이 이름이 아니라 개수다(B 는 영영 안 보인다)');
  assert.ok(b.상태.명부스윕_상태.includes('SYNK-002'), '서명에 사람이 안 담겼다');

  // 다 고쳐진 아침 — 상태를 비워 다음 문제에 다시 울도록 재무장한다
  const c = 판({ 응답: '{"ok":true}', 기존서명: 서명1 });
  c.fn();
  assert.equal(c.메일.length, 0, '문제가 없는데 울었다');
  assert.equal(c.상태.명부스윕_상태, '', '해소됐는데 낡은 서명이 남았다 — 다음 문제가 조용해진다');

  // 보낼 행이 0 인 아침에도 재무장은 돈다(여기서 조기 return 하면 낡은 서명이 굳는다)
  const d = 판({ 표: [기본표()[0]], 기존서명: 서명1 });
  d.fn();
  assert.equal(d.요청.length, 0, '보낼 행이 없는데 왕복이 나갔다');
  assert.equal(d.상태.명부스윕_상태, '', '행 0 인 아침에 낡은 서명이 굳었다');
});

/* ④ 비200·왕복실패는 **소리를 내되 던지지 않는다.** 조용히 지나가면 「명부가 안 선다」가 무증상이 된다. */
test('명부스윕 ④ 401·503·네트워크 실패를 사유와 함께 알리고, 스스로는 던지지 않는다', () => {
  const a = 판({ 코드: 401, 응답: '{"error":"unauthorized"}' });
  assert.doesNotThrow(() => a.fn());
  assert.equal(a.메일.length, 1, '401 이 조용히 지나갔다 — 시크릿이 어긋난 채 매일 아무 일도 안 일어난다');
  assert.ok(a.상태.명부스윕_상태.startsWith('http401'), '서명에 응답 코드가 안 담겼다');
  assert.ok(a.메일[0].본문.includes('unauthorized'), '서버가 준 사유가 알림에서 사라졌다');

  const b = 판({ 코드: 503, 응답: '{"error":"ingest_secret_unset"}' });
  b.fn();
  assert.ok(b.상태.명부스윕_상태.startsWith('http503'), '503(서버 시크릿 미설정)이 200 과 같은 모양이 됐다');

  const c = 판({ 던짐: 'DNS 실패' });
  assert.doesNotThrow(() => c.fn(), '왕복 실패가 예외로 새어 나갔다 — syncProfiles 가 통째로 죽는다');
  assert.equal(c.메일.length, 1, '왕복 실패가 조용히 지나갔다');
  assert.ok(c.상태.명부스윕_상태.startsWith('왕복실패'), '서명이 왕복실패를 구분하지 않는다');

  // 200 인데 본문이 JSON 이 아닌 경우 — 파싱 실패를 「문제 없음」으로 읽어도 던지지는 않는다
  const d = 판({ 응답: '<html>504 gateway</html>' });
  assert.doesNotThrow(() => d.fn(), '본문 파싱 실패가 예외로 새어 나갔다');
});

/* ⑤ 꼬리 순서 — 호출이 궤적갱신_ 뒤·calcAll 앞이고 **try 로 감싸져** 있다.
 *   감싸지 않으면 Supabase 가 느린 아침 한 번에 calcAll 이 통째로 건너뛰어진다(게이지·랭킹·진화 정지). */
test('명부스윕 ⑤ syncProfiles 꼬리에서 궤적갱신_ 뒤·calcAll 앞에, try 로 감싸 부른다', () => {
  const sync = 함수본문(배치, 'syncProfiles');
  const i궤적 = sync.indexOf('궤적갱신_(src)');
  const i스윕 = sync.indexOf('명부스윕_()');
  const icalc = sync.lastIndexOf('calcAll()');
  assert.notEqual(i스윕, -1, 'syncProfiles 가 명부스윕_ 를 안 부른다 — 만든 것과 도는 것은 다르다');
  assert.ok(i궤적 !== -1 && i궤적 < i스윕, '궤적갱신_ 보다 앞이다 — 자리가 밀렸다');
  assert.ok(i스윕 < icalc, 'calcAll 뒤로 밀렸다 — 그날 밤 집계가 스윕 전 상태를 본다');

  const 감쌌나 = (src) => /try\s*\{[^{}]*명부스윕_\(\)[^{}]*\}\s*catch/.test(src);
  assert.ok(감쌌나(sync), '명부스윕_ 호출이 try 밖이다 — 느린 아침 한 번에 calcAll 이 통째로 죽는다');
  // 탐지 픽스처 — 맨 호출을 통과시키면 이 검사는 영원히 초록이다
  assert.equal(감쌌나('궤적갱신_(src);\n명부스윕_();\ncalcAll();'), false, '탐지가 무력하다 — 감싸지 않은 호출을 통과시킨다');
  assert.equal(감쌌나('try { 명부스윕_(); } catch (e) {}'), true, '거짓양성 — 정상 형태를 위반으로 읽는다');
});
