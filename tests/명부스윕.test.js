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
const crypto = require('node:crypto');

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
        getSheetByName: (n) => {
          if (n === 'profiles' && 표) {
            return {
              getLastRow: () => 표.length,
              getRange: () => ({ getDisplayValues: () => 표.map((r) => r.slice()) }),
            };
          }
          if (n === 'groups' && o.조표) {
            return {
              getLastRow: () => o.조표.length + 1,   // +1 = 머리글 행(스윕은 2행부터 읽는다)
              getRange: () => ({ getValues: () => o.조표.map((r) => r.slice()) }),
            };
          }
          return null;
        },
        getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar',
      }),
    },
    /* 조·좌석 동봉의 경계 스텁 — 시즌 판정 자체는 실물(Code.js) 몫이고, 여기서 재는 것은
     * 스윕의 이음(현 시즌만 · DEMO 제외 · [[sid,조,좌석]] 문자열)이다. */
    seasonLabelOf_: () => (o.시즌 === undefined ? 'S1' : o.시즌),
    seasonKeyOf_: (v) => String(v == null ? '' : v),
    GROUPS_HEADERS: ['시즌', 'class_name', 'student_id', '이름', '조', '좌석', '확정', '편성일', '편성근거', '고정'],
    UrlFetchApp: {
      fetch: (url, opt) => {
        요청.push({ url, opt });
        if (o.던짐) throw new Error(o.던짐);
        return { getResponseCode: () => (o.코드 === undefined ? 200 : o.코드), getContentText: () => (o.응답 === undefined ? '{"ok":true,"문제들":[],"막힘":[]}' : o.응답) };
      },
    },
    Logger: { log: (m) => 로그.push(String(m)) },
    ensureSheet: () => ({}),
    getState: (_st, k) => ({ val: 상태[k] || '' }),
    setState: (_st, k, v) => { 상태[k] = v; 쓴상태.push([k, v]); },
    adminMail: (제목, 본문) => 메일.push({ 제목, 본문 }),
  };
  // 서명 접기는 **실물**을 태운다 — 스텁으로 대신하면 「해시로 갈랐다」를 검사가 증명하지 못한다.
  스텁.Utilities = {
    DigestAlgorithm: { MD5: 'MD5' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest: (_alg, s) => Array.from(crypto.createHash('md5').update(String(s), 'utf8').digest())
      .map((b) => (b > 127 ? b - 256 : b)),   // Apps Script 는 **부호 있는** 바이트를 준다
  };
  const 이름들 = Object.keys(스텁);
  const 소스 = 함수본문(배치, '접기_') + '\n' + 함수본문(배치, '명부스윕_') + '\nreturn 명부스윕_;';
  const fn = new Function(...이름들, 소스)(...이름들.map((k) => 스텁[k]));
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
  const 응답 = (번호들) => JSON.stringify({ ok: true, 막힘: [], 문제들: 번호들.map((n, i) => ({ 줄: i + 2, 번호: n, 사유: '전화 형식' })) });

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
  // 개수 부분은 **같고** 접힌 부분만 다르다 = 개수 서명이었다면 정확히 여기서 침묵했을 판이다
  assert.equal(b.상태.명부스윕_상태.split('#')[0], 서명1.split('#')[0], '픽스처가 개수를 바꿔버려 이 검사가 무의미해졌다');
  assert.notEqual(b.상태.명부스윕_상태, 서명1, '사람이 바뀌었는데 서명이 같다');

  // 다 고쳐진 아침 — 상태를 비워 다음 문제에 다시 울도록 재무장한다
  const c = 판({ 응답: '{"ok":true,"문제들":[],"막힘":[]}', 기존서명: 서명1 });
  c.fn();
  assert.equal(c.메일.length, 0, '문제가 없는데 울었다');
  assert.equal(c.상태.명부스윕_상태, '', '해소됐는데 낡은 서명이 남았다 — 다음 문제가 조용해진다');

  // 보낼 행이 0 인 아침에도 재무장은 돈다(여기서 조기 return 하면 낡은 서명이 굳는다)
  const d = 판({ 표: [기본표()[0]], 기존서명: 서명1 });
  d.fn();
  assert.equal(d.요청.length, 0, '보낼 행이 없는데 왕복이 나갔다');
  assert.equal(d.상태.명부스윕_상태, '', '행 0 인 아침에 낡은 서명이 굳었다');
});

/* ③-b 🔴 서명은 **자르면 안 된다**(①배포 검수 P2). 앞이 길게 같고 뒤만 다른 두 판은
 *   `slice(0, 900)` 아래서 같은 서명이 됐다 — 뒤쪽에서 새로 깨진 학생은 영영 안 울린다.
 *   개수 서명과 **같은 병**이 길이 축으로 재발한 것이라, 회귀도 같은 모양으로 못박는다. */
test('명부스윕 ③-b 긴 목록의 «뒤쪽» 변화도 서명을 가른다 — 잘림이 아니라 접힘이다', () => {
  const 많이 = (끝) => JSON.stringify({
    ok: true, 막힘: [],
    문제들: Array.from({ length: 120 }, (_, i) => ({ 줄: i + 2, 번호: 'SYNK-' + String(i).padStart(3, '0'), 사유: '전화 형식' }))
      .concat([{ 줄: 999, 번호: 끝, 사유: '전화 형식' }]),
  });
  const a = 판({ 응답: 많이('SYNK-AAA') }); a.fn();
  const b = 판({ 응답: 많이('SYNK-BBB'), 기존서명: a.상태.명부스윕_상태 }); b.fn();

  assert.ok(a.상태.명부스윕_상태.length < 200, '서명이 app_state 칸을 위협할 만큼 길다');
  assert.notEqual(b.상태.명부스윕_상태, a.상태.명부스윕_상태,
    '앞 900자가 같으면 뒤가 달라도 같은 서명이다 — 뒤쪽에서 새로 깨진 학생이 영영 안 울린다');
  assert.equal(b.메일.length, 1, '뒤쪽만 바뀐 판에 재알림이 안 갔다');
  // 같은 판을 다시 보내면 같은 서명 — 접기가 안정적이어야 1회 알림이 성립한다
  const c = 판({ 응답: 많이('SYNK-AAA'), 기존서명: a.상태.명부스윕_상태 }); c.fn();
  assert.equal(c.메일.length, 0, '같은 판인데 서명이 흔들려 매일 운다');
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
});

/* ④-b 🔴 **200 은 성공이 아니다 — 봉투를 봐야 성공이다**(①배포 검수 P1 3키 · fail closed).
 *   앞선 판은 파싱 실패를 `{}` 로 접어 오류 배열이 전부 비었고, 그 결과 **어제의 문제 서명이
 *   경고 없이 지워졌다.** 명부는 안 섰는데 배치는 성공한 얼굴을 한다.
 *   ⚠ 이 회귀가 처음에 `doesNotThrow` 만 봤다 — 「안 죽는다」는 「일했다」가 아니다. */
test('명부스윕 ④-b 200 인데 우리 봉투가 아니면 실패로 달고, 옛 서명을 지우지 않는다', () => {
  const 옛서명 = 'p1/b0/r0/c0#deadbeefcafe';
  for (const [이름, 응답] of [
    ['프록시 HTML', '<html>504 gateway timeout</html>'],
    ['빈 몸통', ''],
    ['ok:false', '{"ok":false,"error":"db_down"}'],
    ['ok 는 true 인데 배열이 없다', '{"ok":true}'],
    ['배열 자리에 딴것', '{"ok":true,"문제들":"없음","막힘":[]}'],
  ]) {
    const p = 판({ 응답, 기존서명: 옛서명 });
    assert.doesNotThrow(() => p.fn(), 이름 + ': 예외가 새어 나갔다');
    assert.ok(p.상태.명부스윕_상태.startsWith('http200_봉투아님'),
      이름 + ': 200 을 성공으로 읽었다 — 붓기가 돌았는지 모르는데 「문제 없음」이 됐다');
    assert.notEqual(p.상태.명부스윕_상태, '', 이름 + ': 옛 문제 서명이 조용히 지워졌다');
    assert.equal(p.메일.length, 1, 이름 + ': 아무도 모른다');
  }
  // 정상 봉투는 그대로 통과해야 한다 — 거짓양성이면 매일 아침 헛경보가 온다
  const ok = 판({ 응답: '{"ok":true,"문제들":[],"막힘":[],"읽은행":3,"넣음":2}', 기존서명: 옛서명 });
  ok.fn();
  assert.equal(ok.상태.명부스윕_상태, '', '정상 봉투인데 실패로 읽었다(거짓양성)');
  assert.equal(ok.메일.length, 0, '정상인데 알림이 갔다');
});

/* ④-c profiles 시트 부재는 「보낼 게 없다」가 아니라 **고장**이다.
 *   조용히 지나가면 명부가 몇 달째 안 서 있어도 아무 데도 안 남는다(F207). */
test('명부스윕 ④-c profiles 시트가 없으면 실패로 달고 알린다 — 「행 0」과 구분한다', () => {
  const 없음 = 판({ 표: null, 기존서명: '' });
  assert.doesNotThrow(() => 없음.fn(), '시트 부재가 예외로 새어 나가 syncProfiles 를 죽인다');
  assert.equal(없음.요청.length, 0);
  assert.ok(없음.상태.명부스윕_상태.startsWith('왕복실패'), '시트 부재가 「문제 없음」이 됐다');
  assert.equal(없음.메일.length, 1, '명부가 통째로 안 읽혔는데 아무도 모른다');

  // 시트는 있고 학생만 0행(머리글만) — 개원 전 정상 상태다. 여기서 울리면 매일 헛경보다.
  const 빈판 = 판({ 표: [기본표()[0]] });
  빈판.fn();
  assert.equal(빈판.메일.length, 0, '학생 0행(개원 전 정상)에 경보가 울렸다');
  assert.equal(빈판.상태.명부스윕_상태, '', '학생 0행이 고장으로 기록됐다');

  /* 🔴 「머리글만」과 「통째로 빈 탭」은 다르다(검수 P1 03006c6e68a0) — 시트가 지워지거나 새로
   *   만들어지면 명부가 통째로 사라진 아침인데 옛 오류만 조용히 지워졌다. */
  for (const [이름, 표] of [['탭이 통째로 빔', []], ['머리글 행이 빈 칸뿐', [['', '', '', '', '', '', '', ''], 기본표()[1]]]]) {
    const p = 판({ 표, 기존서명: '' });
    assert.doesNotThrow(() => p.fn(), 이름 + ': 예외가 새어 나갔다');
    assert.equal(p.상태.명부스윕_상태, '왕복실패', 이름 + ': 「문제 없음」이 됐다 — 머리글만 있는 정상과 구분이 안 된다');
    assert.equal(p.메일.length, 1, 이름 + ': 명부가 사라졌는데 아무도 모른다');
  }
});

/* ④-d 🔴 실패 **서명에 응답 본문을 섞지 않는다**(검수 P2 6fc6c72a930e). 프록시 오류 페이지에는
 *   요청ID·시각이 박혀 있어, 섞으면 서명이 매 아침 달라져 「1회 알림」이 통째로 무너진다. */
test('명부스윕 ④-d 같은 실패는 본문이 매번 달라도 한 번만 운다 — 서명은 분류다', () => {
  const 판마다다름 = (n) => '<html>504 gateway · req-id=' + n + ' · 2026-08-12T0' + n + ':00:00Z</html>';
  const a = 판({ 응답: 판마다다름(1) }); a.fn();
  const b = 판({ 응답: 판마다다름(2), 기존서명: a.상태.명부스윕_상태 }); b.fn();
  assert.equal(b.메일.length, 0, '같은 실패인데 본문이 달라 또 울었다 — 매일 아침 오는 경보는 곧 필터가 된다');
  assert.equal(b.상태.명부스윕_상태, a.상태.명부스윕_상태, '실패 서명에 본문이 섞였다');
  assert.ok(a.메일[0].본문.includes('req-id=1'), '본문에서까지 사라지면 원인을 못 찾는다');

  // 401 도 같은 축 — 서버가 사유 문구를 바꿔도 한 번만 운다
  const c = 판({ 코드: 401, 응답: '{"error":"unauthorized","t":1}' }); c.fn();
  const d = 판({ 코드: 401, 응답: '{"error":"unauthorized","t":2}', 기존서명: c.상태.명부스윕_상태 }); d.fn();
  assert.equal(d.메일.length, 0, '401 서명에 본문이 섞여 매번 운다');
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

/* ⑥ 조·좌석 동봉(숙제서클 §10-3 · talk 20260814100000). 스냅샷 의미라 새는 방향이 둘이다:
 *   지난 시즌 행이 섞이면 옛 조가 되살아나고, 미편성을 안 실으면 서버가 못 비운다. */
test('명부스윕 ⑥ groups 의 현 시즌 행만 [[sid,조,좌석]] 로 싣는다 — 지난 시즌·DEMO 는 뺀다', () => {
  const p = 판({
    조표: [
      ['S1', 'A반', 'SYNK-001', '바트', 1, 2, '확정', '', '', ''],
      ['S0', 'A반', 'SYNK-009', '옛시즌', 3, 4, '확정', '', '', ''],   // 지난 시즌 — 스냅샷 아님
      ['S1', 'A반', 'DEMO-9', '시연', 2, 1, '', '', '', ''],
      ['S1', 'A반', 'SYNK-002', '사랑', 2, 3, '', '', '', ''],
    ],
  });
  p.fn();
  assert.equal(p.요청.length, 1, '왕복이 안 나갔다');
  const 보낸 = JSON.parse(p.요청[0].opt.payload).조편성;
  assert.deepEqual(보낸, [['SYNK-001', '1', '2'], ['SYNK-002', '2', '3']],
    '현 시즌·실학생만 문자열로 실려야 한다 — 지난 시즌이 섞이면 옛 조가 서버에서 되살아난다');
});

test('명부스윕 ⑥-b 시트 없음·미편성이면 빈 스냅샷을 싣는다 — 키를 빼면 서버가 못 비운다', () => {
  const 없음 = 판({});
  없음.fn();
  assert.deepEqual(JSON.parse(없음.요청[0].opt.payload).조편성, [],
    'groups 시트가 없을 때 조편성 키가 안 실렸다 — 재편성 전 학생의 옛 조가 영영 남는다');
  const 미편성 = 판({ 조표: [] });
  미편성.fn();
  assert.deepEqual(JSON.parse(미편성.요청[0].opt.payload).조편성, [], '빈 groups 가 빈 스냅샷이 아니다');
});

test('명부스윕 ⑥-c 조편성문제는 알림 사유·서명에 든다 — 서버만 알고 사람이 모르면 안 고쳐진다', () => {
  const 응답 = JSON.stringify({
    ok: true, 문제들: [], 막힘: [],
    조편성문제: [{ 줄: 3, 번호: 'SYNK-002', 사유: '조·좌석이 1~20 정수가 아니다(조=0 좌석=3)' }],
  });
  const p = 판({ 응답 });
  p.fn();
  assert.equal(p.메일.length, 1, '조편성문제가 있는데 알림이 안 울렸다');
  assert.match(p.메일[0].본문, /조 편성에 못 실린 행/, '알림 본문에 조 편성 블록이 없다');
  assert.match(p.메일[0].본문, /SYNK-002/, '어느 학생인지 이름으로 안 부른다 — 찾는 왕복이 「나중에」가 된다');
  assert.match(p.상태.명부스윕_상태, /\/g1#/, '서명이 조편성문제를 안 센다 — 다음 날 같은 문제가 조용해진다');
});
