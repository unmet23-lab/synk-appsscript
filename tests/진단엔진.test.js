'use strict';
/**
 * 급수 진단 엔진 — 사다리·기준판·최초 답 잠금·정답 비노출 (정본 = docs/급수진단_설계_v1.md §④~§⑥ · 실물 = 엔진_진단.js)
 *
 * ■ 이 시험이 막는 것
 *   ① 사다리가 안 잰 급에 급수를 붙인다(3급 미달인데 「2급」) → 시작점이 오염돼 8주 뒤 비교가 죽는다(§③-㉤).
 *   ② 둘째 제출이 첫 답을 덮는다 → 「어느 것이 최초 측정인가」가 사라진다(§⑥ 최초 제출 잠금).
 *   ③ 정답이 통로로 나간다 → 다음 회차 문항이 외워진다.
 *   ④ 기준판이 적은 여섯과 은행의 여섯이 다르다 → 판 번호가 거짓말을 한다(§⑤-㉡).
 *   ⑤ 웹앱에 HtmlService 화면이 생긴다 → 익명 브릿지로 171개 함수가 열린다(상담AI.js ⛔ 2026-08-03).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
// vm 안에서 만든 배열은 이 영역의 Array 와 프로토타입이 달라 strict deepEqual 이 «같은 구조인데 다르다»고 운다 — JSON 왕복으로 견준다
const 같다 = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

/* ── 가짜 시트 — appendRow·getRange(getValues/setValue/setValues)·getLastRow 만 ── */
function 가짜시트(headers) {
  const rows = [headers.slice()];
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => headers.length,
    setFrozenRows: () => {},
    appendRow: (r) => { rows.push(r.slice()); },
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = rows[r - 1 + i] || []; out.push(Array.from({ length: nc || 1 }, (_, j) => row[c - 1 + j] == null ? '' : row[c - 1 + j])); } return out; },
      setValue: (v) => { rows[r - 1][c - 1] = v; },
      setValues: (vals) => { vals.forEach((row, i) => row.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; })); },
    }),
  };
}
function 로드() {
  const 시트들 = {};
  const ss = { getSheetByName: (n) => 시트들[n] || null, insertSheet: (n) => (시트들[n] = 가짜시트([])), getSpreadsheetTimeZone: () => 'Asia/Ulaanbaatar' };
  const 메일 = [];
  const ctx = {
    console, 메일, 시트들,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: { createTextOutput: (t) => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: { formatDate: (d, tz, f) => (f === 'yyyyMMdd' ? '20261001' : '2026-10-01 10:00:00'), getUuid: (() => { let n = 0; return () => 'uuid' + String(++n).padStart(4, '0') + '-0000'; })(),
      computeDigest: () => [1, 2, 3, 4], DigestAlgorithm: { MD5: 1 }, Charset: { UTF_8: 1 } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Logger: { log: () => {} },
    MailApp: { sendEmail: (to, subject, body) => 메일.push({ to, subject, body }) },
    quotaOk: () => true,
    ensureSheet: (s, name, headers) => { if (!시트들[name]) 시트들[name] = 가짜시트(headers); return 시트들[name]; },
    aiCall_: () => { throw new Error('시험에서는 AI 를 안 부른다'); },
    GRAMMAR_BANK: [['G502', '-(으)면서', '', 3, 0, ''], ['G705', '-나 보다', '', 4, 0, '']],
    HW_ERROR_TAGS: ['조사:주격(이/가·은/는)', '오류없음'], AI_FEEDBACK_MODEL: 'test-model',
  };
  vm.createContext(ctx);
  ['contents_진단문항.js', '엔진_진단.js'].forEach((f) => new vm.Script(읽기(f).replace(/^'use strict';/, ''), { filename: f }).runInContext(ctx));
  // 톱레벨 const 는 컨텍스트 객체에 안 붙는다(함수만 붙는다) — 같은 컨텍스트의 스크립트는 그 렉시컬 환경을 나눠 쓰므로 여기서 꺼낸다
  vm.runInContext('globalThis.__X = { DIAG_Q_LV3, DIAG_Q_LV4, DIAG_LADDER, DIAG_GATE, DIAG_RULER_VER, DIAG_SESSION_HEADERS }', ctx);
  return Object.assign(ctx, ctx.__X);
}
const C = 로드();
const 정답들 = (급별, 급, 틀릴수) => 급별[급].map((q, i) => (i < 틀릴수 ? (q.정답 + 1) % 4 : q.정답));

/* ── ④ 기준판 ─────────────────────────────────────────────────────────────── */
test('기준판이 적은 급마다의 여섯이 은행의 여섯과 같다 · 사다리는 은행이 있는 급만', () => {
  const 은행 = { 3: C.DIAG_Q_LV3.map((g) => g[0]), 4: C.DIAG_Q_LV4.map((g) => g[0]) };
  const 적힌 = { 3: 'G502·G503·G504·G507·G508·G510', 4: 'G705·G708·G710·G711·G713·G714' };
  const src = 읽기('엔진_진단.js');
  Object.keys(은행).forEach((급) => {
    assert.ok(src.indexOf(적힌[급]) > -1, `${급}급 여섯이 DIAG_RULER_VER 주석에 없다`);
    같다(적힌[급].split('·').sort(), 은행[급].slice().sort(), `${급}급 기준판 여섯이 은행과 다르다 — 판 번호를 올리고 주석을 고쳐라`);
  });
  같다(C.DIAG_LADDER, [3, 4]);
  assert.equal(C.DIAG_GATE, 0.8);
});

/* ── 스냅샷 · 공개판 ───────────────────────────────────────────────────────── */
test('회차 셋의 스냅샷은 같은 문형·다른 문장이고 정답을 품는다 · 공개판엔 정답이 없다', () => {
  const s = [0, 1, 2].map((i) => C.진단스냅샷_(i));
  [3, 4].forEach((급) => {
    assert.equal(s[0].급별[급].length, 6);
    같다(s[0].급별[급].map((q) => q.문형), s[2].급별[급].map((q) => q.문형), '문형 목록이 회차마다 같다');
    const 문장 = new Set([].concat(...s.map((x) => x.급별[급].map((q) => q.문장))));
    assert.equal(문장.size, 18, `${급}급 세 회차 문장이 겹친다`);
    s[0].급별[급].forEach((q) => assert.ok(typeof q.정답 === 'number'));
  });
  assert.ok(s[0].쓰기지시문 && s[1].쓰기지시문 !== s[0].쓰기지시문);
  const 공개 = C.진단공개문항_(s[0].급별);
  assert.equal(JSON.stringify(공개).indexOf('정답'), -1, '공개판에 정답이 있다');
  assert.equal(공개[3].length, 6);
});

/* ── ① 사다리 ─────────────────────────────────────────────────────────────── */
test('사다리 — 3급 5/6 통과 · 4/6 미달은 「더 아래 · 안 쟀다」(급수 없음) · 4급 통과는 「4급 이상」', () => {
  const 급별 = C.진단스냅샷_(0).급별;
  let r = C.진단채점_(급별, { 3: 정답들(급별, 3, 1) });
  assert.equal(r.표본급수, 3); assert.equal(r.끝, false, '통과했는데 4급을 아직 안 답했다 — 끝이 아니다');
  r = C.진단채점_(급별, { 3: 정답들(급별, 3, 2) });
  assert.equal(r.표본급수, null); assert.equal(r.미측, true); assert.equal(r.끝, true);
  assert.equal(r.다음문형.length, 2, '틀린 둘이 「다음 자리」');
  r = C.진단채점_(급별, { 3: 정답들(급별, 3, 0), 4: 정답들(급별, 4, 0) });
  assert.equal(r.표본급수, 4); assert.equal(r.상한, true); assert.equal(r.끝, true);
  r = C.진단채점_(급별, { 3: 정답들(급별, 3, 0), 4: 정답들(급별, 4, 2) });
  assert.equal(r.표본급수, 3); assert.equal(r.끝, true); assert.equal(r.경로.length, 2);
  같다(r.다음문형, 급별[4].slice(0, 2).map((q) => q.문형), '멈춘 급(4급)의 틀린 문형이 다음 자리');
  r = C.진단채점_(급별, { 3: 정답들(급별, 3, 6) });
  assert.equal(r.표본급수, null); assert.equal(r.맞힌문형.length, 0);
});

test('오류로 뺀 문항은 분모에서 빠진다 — 여섯이 다섯이 되고 4/5 면 통과(§⑤-㉢)', () => {
  const 급별 = C.진단스냅샷_(0).급별;
  const 뺀 = ['3|' + 급별[3][0].문형];
  const 답 = 정답들(급별, 3, 2);            // 첫 둘을 틀렸는데 첫째는 뺀 문항
  const r = C.진단채점_(급별, { 3: 답 }, 뺀);
  assert.equal(r.경로[0].분모, 5); assert.equal(r.경로[0].맞힌, 4); assert.equal(r.경로[0].통과, true);
});

test('진단 문장 목록 — 은행의 문장 전부(급 둘 × 회차 셋 × 여섯)가 서로 다르고 정답은 안 낸다 · 자율일 굳히기의 제외 목록', () => {
  const 목록 = C.진단문장목록_();
  assert.equal(목록.length, 2 * 3 * 6);
  assert.equal(new Set(목록).size, 목록.length, '진단 문장이 겹친다 — 같은 문장이 두 회차에 있으면 외운 것을 잰다');
  목록.forEach((s) => assert.equal(typeof s, 'string'));
});

test('진단코드는 여섯 자리다', () => {
  assert.equal(C.진단코드_(0), '100000'); assert.equal(C.진단코드_(0.999999).length, 6);
  assert.match(C.진단코드_(), /^\d{6}$/);
});

/* ── ② 최초 답 잠금 · 멱등 · 사다리 순서 (가짜 시트로 흐름 전체) ──────────────── */
test('흐름 — 시작 → 3급 통과 → 4급 미달 → 쓰기 → 결과 · 둘째 제출은 «덧붙고» 첫 답이 잰다 · 같은 열쇠는 그대로', () => {
  const s = C.진단시작_({ 역할: '시작', 이메일: 'a@b.mn' });
  assert.equal(s.ok, true); assert.match(s.진단코드, /^\d{6}$/); assert.equal(s.시작급, 3);
  assert.equal(JSON.stringify(s.문항).indexOf('정답'), -1, '시작 응답에 정답이 실렸다');
  const 급별 = JSON.parse(C.시트들['진단세션'].rows[1][C.DIAG_SESSION_HEADERS.indexOf('문항스냅샷')]);
  assert.equal(C.진단답_({ 세션번호: s.세션번호, 급: 4, n: 0, 답: 0, 멱등열쇠: 'k0' }).error, 'ladder', '3급을 안 지나고 4급을 받으면 안 된다');
  // 3급 — 0번만 틀리고 나머지 다섯을 맞힌다(문항 하나씩 · 고른 순간 맞았는지 온다)
  let last;
  정답들(급별, 3, 1).forEach((v, n) => {
    last = C.진단답_({ 세션번호: s.세션번호, 급: 3, n, 답: v, 멱등열쇠: 'k3-' + n });
    if (n === 0) { assert.equal(last.맞음, false); assert.equal(last.남은, 5); assert.equal(last.급끝, false); assert.equal(last.통과, false); }
    assert.equal(JSON.stringify(last).indexOf('정답'), -1, '답 응답에 정답 자리가 실렸다');
  });
  assert.equal(last.급끝, true); assert.equal(last.통과, true); assert.equal(last.맞힌, 5); assert.equal(last.다음급, 4);
  assert.equal(last.끝, false); assert.equal(last.첫시도, true);
  정답들(급별, 4, 3).forEach((v, n) => { last = C.진단답_({ 세션번호: s.세션번호, 급: 4, n, 답: v, 멱등열쇠: 'k4-' + n }); });
  assert.equal(last.통과, false); assert.equal(last.끝, true); assert.equal(last.표본급수, 3);
  // 둘째 답(3급 0번을 이번엔 맞게) — 첫 답이 잰다
  const 다시 = C.진단답_({ 세션번호: s.세션번호, 급: 3, n: 0, 답: 급별[3][0].정답, 멱등열쇠: 'k3-0-again' });
  assert.equal(다시.첫시도, false); assert.ok(다시.안내); assert.equal(다시.맞음, false, '맞았는지도 첫 답 기준이다');
  const 답들 = JSON.parse(C.시트들['진단세션'].rows[1][C.DIAG_SESSION_HEADERS.indexOf('답')]);
  assert.equal(답들[3].length, 2); assert.equal(답들[3][0].시도, 1); assert.equal(답들[3][1].시도, 2, '둘째는 덧붙는다 — 첫 답이 안 바뀐다');
  assert.equal(답들[3][0].답[0], (급별[3][0].정답 + 1) % 4, '첫 답이 그대로다'); assert.equal(답들[3][1].답[0], 급별[3][0].정답);
  assert.equal(C.진단답_({ 세션번호: s.세션번호, 급: 3, n: 0, 답: 급별[3][0].정답, 멱등열쇠: 'k3-0-again' }).중복, true, '같은 열쇠는 저장한 결과 그대로');
  assert.equal(C.진단쓰기_({ 세션번호: s.세션번호, 문장: '어제 친구를 만나서 영화를 봤어요.' }).상태, '대기');
  const r = C.진단결과_({ 진단코드: s.진단코드 });
  assert.equal(r.표본급수, 3); assert.equal(r.쓰기.상태, '대기'); assert.equal(r.쓰기.카드, null);
  assert.equal(JSON.stringify(r).indexOf('"정답"'), -1, '결과에 정답이 실렸다');
  assert.equal(r.다음문형.length, 3);
  assert.ok(r.다음문형.every((g) => g.이름), '문형은 이름으로 나간다');
  assert.equal(C.진단안할래_({ 세션번호: s.세션번호, 사유: '수업료' }).ok, true);
  assert.match(String(C.시트들['진단세션'].rows[1][C.DIAG_SESSION_HEADERS.indexOf('상태')]), /안할래:수업료/);
});

test('연락 통로가 하나도 없으면 시작하지 않는다 · 잇기 — 진단코드로 학생번호를 채우고 시작점을 «하나» 못박는다', () => {
  assert.equal(C.진단시작_({}).error, 'contact-required');
  const s1 = C.진단시작_({ 역할: '시작', 전화: '010-1111-2222' });
  const 급별 = JSON.parse(C.시트들['진단세션'].rows[C.시트들['진단세션'].rows.length - 1][C.DIAG_SESSION_HEADERS.indexOf('문항스냅샷')]);
  정답들(급별, 3, 2).forEach((v, n) => C.진단답_({ 세션번호: s1.세션번호, 급: 3, n, 답: v, 멱등열쇠: 'x' + n }));   // 미달 → 끝 → 잰시각
  const r = C.진단잇기_('S001', { 진단코드: s1.진단코드 }, new Date('2026-11-20'));
  assert.equal(r.ok, true); assert.equal(r.시작점, s1.세션번호);
  const 다시 = C.진단잇기_('S001', { 전화: '01011112222' }, new Date('2026-11-21'));
  assert.equal(다시.유지, true, '이미 못박은 시작점은 안 바꾼다');
  // 중간 진단 — 못박은 기준판을 쓴다
  const s2 = C.진단시작_({ 역할: '중간', 학생번호: 'S001' });
  assert.equal(s2.기준판, C.DIAG_RULER_VER);
  assert.equal(C.진단잇기_('S002', { 진단코드: s1.진단코드 }).이은수, 0, '남의 학생 번호가 이미 있는 세션은 안 덮는다');
});

/* ── ③⑤ 통로 ─────────────────────────────────────────────────────────────── */
test('JSON 통로 — 상담AI 웹훅보다 앞에서 갈라지고, 진단 엔진에 HtmlService 가 0 이다', () => {
  const 상담 = 읽기('상담AI.js');
  const post = 상담.indexOf('function doPost(e)'), raw = 상담.indexOf("const raw = e && e.postData", post), 분기 = 상담.indexOf("e.parameter.p === '진단'", post);
  assert.ok(분기 > post && 분기 < raw, '진단 분기가 본문 파싱보다 뒤에 있다(상담 인증에 막힌다)');
  const get = 상담.indexOf('function doGet(e)');
  assert.ok(상담.indexOf("p.p === '진단'", get) > get, 'doGet 에 진단 갈래가 없다');
  const 진단 = 읽기('엔진_진단.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal((진단.match(/HtmlService/g) || []).length, 0, '진단 엔진이 HtmlService 를 부른다 — 익명 브릿지가 열린다');
  const out = C.진단API_({ parameter: { p: '진단', op: 'result', code: '000000' } }, 'get');
  같다(JSON.parse(out.t), { ok: false, error: 'no-session' });
  같다(JSON.parse(C.진단API_({ parameter: { p: '진단' }, postData: { contents: '{"op":"nope"}' } }, 'post').t), { ok: false, error: 'bad-op' });
});

test('GET 진단 링크는 결과만 읽는다 — 여섯 쓰기 동작·미지 동작·빈 동작은 호출 0', () => {
  const c = 로드();
  const get = 읽기('상담AI.js').match(/function doGet\(e\) \{[\s\S]*?\n\}/);
  assert.ok(get, '실제 doGet을 찾지 못했다');
  new vm.Script(get[0]).runInContext(c);
  const 호출 = [];
  const 쓰기들 = { start: '진단시작_', answer: '진단답_', write: '진단쓰기_', decline: '진단안할래_', why: '진단멈춘까닭_', fix: '진단고침_' };
  Object.entries(쓰기들).forEach(([op, fn]) => { c[fn] = () => { 호출.push(op); return { ok: true }; }; });
  c.진단결과_ = (입력) => { 호출.push('result'); return { ok: true, code: 입력.진단코드 }; };
  for (const op of [...Object.keys(쓰기들), 'nope', '']) {
    const out = c.doGet({ parameter: { p: '진단', op, email: 'synthetic@example.invalid', session: 'synthetic-session', text: '합성 답' } });
    같다(JSON.parse(out.t), { ok: false, error: 'bad-op' }, `GET ${op}가 거절되지 않았다`);
  }
  같다(호출, [], '읽기 요청이 진단 쓰기 함수를 호출했다');
  같다(Object.keys(c.시트들), [], '읽기 요청이 진단 시트를 만들었다');
  같다(JSON.parse(c.doGet({ parameter: { p: '진단', op: 'result', code: '123456' } }).t), { ok: true, code: '123456' });
  같다(호출, ['result']);
});

test('POST의 기존 진단 동작은 유지하고 다른 HTTP 메서드는 호출 없이 거절한다', () => {
  const c = 로드();
  const 호출 = [];
  const 동작들 = { start: '진단시작_', answer: '진단답_', write: '진단쓰기_', result: '진단결과_', decline: '진단안할래_', why: '진단멈춘까닭_', fix: '진단고침_' };
  Object.entries(동작들).forEach(([op, fn]) => { c[fn] = () => { 호출.push(op); return { ok: true, op }; }; });
  for (const op of Object.keys(동작들)) {
    const out = c.진단API_({ parameter: { p: '진단', op: 'nope' }, postData: { contents: JSON.stringify({ op }) } }, 'post');
    같다(JSON.parse(out.t), { ok: true, op }, `POST ${op}가 기존 동작으로 연결되지 않았다`);
  }
  같다(호출, Object.keys(동작들));
  호출.length = 0;
  for (const method of ['head', 'put', 'patch', 'delete', 'options', '', undefined]) {
    for (const op of Object.keys(동작들)) {
      const out = c.진단API_({ parameter: { p: '진단', op }, postData: { contents: JSON.stringify({ op }) } }, method);
      같다(JSON.parse(out.t), { ok: false, error: 'bad-method' });
    }
  }
  같다(호출, [], '지원하지 않는 메서드가 진단 함수를 호출했다');
});

test('배선 — 골격에 진단세션 · 밤 배치에 쓰기 태깅 · .clasp.json 과 ENGINE_FILES 에 새 파일', () => {
  const 셋업 = 읽기('엔진_셋업확장.js');
  assert.match(셋업, /\[DIAG_SESSION_TAB_, DIAG_SESSION_HEADERS, 수집표식_\]/);
  assert.match(셋업, /safeRun\('diagWriteBatch', diagWriteBatch_\)/);
  const cj = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8'));
  ['엔진_진단.js', '엔진_자율일.js', 'contents_1기차시.js'].forEach((f) => assert.ok(cj.filePushOrder.indexOf(f) > -1, `${f} 가 filePushOrder 에 없다`));
});

/* ── [vNEXT] ㉠-1 「다음 자리」 층 — 브랜드 v2 ㉠-1 · 기억 teaching-toward-the-ruler-kills-it ──
 *   ① 칸 둘은 끝에만 는다(뒤 칸이 «적재되는 척» 사라지지 않게 시작 행 폭 = 헤더 폭)
 *   ② 「무엇이 멈추게 했나」는 학생이 쓴 한 줄만 — 안 쓰면 빈칸(36문항에서 지어내지 않는다)
 *   ③ 「이 자리, 맞아요?」 고침은 옆에 남고 관측(다음문형)은 그대로 · 다음 자리는 문형 번호에 묶여 나간다(㉮ 기계 완료 조건)
 *   ④ 카드 메일이 「첫 주 숙제」로 자를 향해 가르치지 않는다 */
test('[㉠-1] 칸 둘은 «끝에만» 는다 — 멈춘까닭·학생고침이 마지막이고, 시작 행의 폭이 헤더 폭과 같다', () => {
  const H = C.DIAG_SESSION_HEADERS;
  같다(H.slice(-2), ['멈춘까닭', '학생고침']);
  const s = C.진단시작_({ 역할: '시작', 이메일: 'w@b.mn' });
  const rows = C.시트들['진단세션'].rows;
  assert.equal(rows[rows.length - 1].length, H.length, '시작 행 폭 ≠ 헤더 폭 — 뒤 칸이 적재되는 척 사라진다');
  const r = C.진단결과_({ 세션번호: s.세션번호 });
  assert.equal(r.멈춘까닭, '', '아직 아무것도 안 썼는데 빈칸이 아니다'); assert.equal(r.고침, null);
});

test('[㉠-1] 「무엇이 멈추게 했나」 — 학생이 쓴 한 줄만 결과에 실리고, 안 쓰면 비어 있다(36문항에서 지어내지 않는다)', () => {
  const s = C.진단시작_({ 역할: '시작', 이메일: 'why@b.mn' });
  assert.equal(C.진단멈춘까닭_({ 세션번호: s.세션번호, 한줄: '  회사가  바빠서   멈췄어요 ' }).남김, true);
  assert.equal(C.진단결과_({ 세션번호: s.세션번호 }).멈춘까닭, '회사가 바빠서 멈췄어요', '학생이 쓴 글이 그대로(공백만 접어서) 나가야 한다');
  const s2 = C.진단시작_({ 역할: '시작', 이메일: 'quiet@b.mn' });
  assert.equal(C.진단멈춘까닭_({ 세션번호: s2.세션번호, 한줄: '' }).남김, false);
  assert.equal(C.진단결과_({ 세션번호: s2.세션번호 }).멈춘까닭, '');
  assert.equal(C.진단멈춘까닭_({ 세션번호: 'DS-없음' }).error, 'no-session');
});

test('[㉠-1] 「이 자리, 맞아요?」 — 고침은 옆에 남고 관측(다음문형)은 그대로다 · 판정은 둘뿐 · 다음 자리는 문형 번호에 묶여 나간다', () => {
  const s = C.진단시작_({ 역할: '시작', 이메일: 'fix@b.mn' });
  const rows = C.시트들['진단세션'].rows;
  const 급별 = JSON.parse(rows[rows.length - 1][C.DIAG_SESSION_HEADERS.indexOf('문항스냅샷')]);
  정답들(급별, 3, 2).forEach((v, n) => C.진단답_({ 세션번호: s.세션번호, 급: 3, n, 답: v, 멱등열쇠: 'f3-' + n }));   // 3급에서 둘 틀림 → 미달 · 다음문형 둘
  const 전 = C.진단결과_({ 세션번호: s.세션번호 });
  assert.equal(전.다음문형.length, 2); assert.equal(전.고침, null);
  assert.ok(전.다음문형.every((g) => /^G\d{3}$/.test(g.번호) && g.이름), '「다음 자리」가 문형 번호+이름으로 안 나간다(㉮ 기계 완료 조건)');
  assert.equal(C.진단고침_({ 세션번호: s.세션번호, 판정: '글쎄요' }).error, 'bad-verdict');
  assert.equal(C.진단고침_({ 세션번호: s.세션번호, 판정: '아니에요', 한줄: '이건 아는 건데 급해서 눌렀어요' }).ok, true);
  const 후 = C.진단결과_({ 세션번호: s.세션번호 });
  같다(후.다음문형, 전.다음문형, '고침이 관측을 지웠다 — 기록은 덧붙이기만 한다');
  assert.equal(후.고침.판정, '아니에요'); assert.equal(후.고침.한줄, '이건 아는 건데 급해서 눌렀어요');
  같다(후.고침.다음문형, 전.다음문형.map((g) => g.번호), '무엇에 대한 고침인지(그때의 다음문형)가 같이 남아야 한다');
});

test('[㉠-1] 카드 메일 — 「첫 주 숙제」로 자를 향해 가르치지 않는다 · 멈춘 까닭은 쓴 사람에게만 · 결핍 낱말 0', () => {
  const H = C.DIAG_SESSION_HEADERS;
  const 행 = (멈춘까닭) => {
    const r = H.map(() => '');
    r[H.indexOf('진단코드')] = '123456'; r[H.indexOf('문항스냅샷')] = JSON.stringify(C.진단스냅샷_(0).급별); r[H.indexOf('답')] = '{}';
    r[H.indexOf('쓰기문장')] = '어제 영화를 봤어요.'; r[H.indexOf('멈춘까닭')] = 멈춘까닭;
    return r;
  };
  const ai = { 태그: ['오류없음'], 교정문: '', 규칙: '' };
  C.메일.length = 0;
  C.진단카드메일_('a@b.mn', 행(''), ai);
  C.진단카드메일_('a@b.mn', 행('군대 다녀와서 잊었어요'), ai);
  assert.equal(C.메일.length, 2);
  assert.ok(!/첫 주 숙제/.test(C.메일[0].body), '「첫 주 숙제」가 남아 있다 — 진단이 재는 여섯을 편들어 가르치면 자가 죽는다(대응표 §②-㉡)');
  assert.match(C.메일[0].body, /그 자리가 오는 주에/);
  assert.ok(!/멈춘 까닭/.test(C.메일[0].body), '안 쓴 사람에게 멈춘 까닭 줄이 나갔다 — 지어낸 것이 된다');
  assert.match(C.메일[1].body, /전에 멈춘 까닭 — 당신이 쓴 것: 「군대 다녀와서 잊었어요」/);
  assert.ok(!/아직|부족|틀렸|못 /.test(C.메일[1].body), '결핍 낱말이 메일에 있다');
  assert.equal(/첫 주 숙제/.test(읽기('엔진_진단.js').replace(/\/\*[\s\S]*?\*\//g, '')), false, '엔진 코드 어디에도 「첫 주 숙제」가 없어야 한다');
});

test('[㉠-1] 학생이 쓴 글은 셀안전_ 를 지나 시트에 들어간다 — `=` 로 시작하는 한 줄이 수식이 되지 않는다(profiles 의 v9.153 구멍과 같은 자리)', () => {
  const 본문 = 읽기('엔진_진단.js');
  const 쓰기 = 본문.slice(본문.indexOf('function 진단칸쓰기_('), 본문.indexOf('function 진단시작_('));
  assert.match(쓰기, /셀안전_\(/, '진단칸쓰기_ 가 셀안전_ 를 안 지난다 — 학생 한 줄이 시트 수식이 된다');
  /* 직기입(setValue)이 진단칸쓰기_ 밖에 있어도 «남의 글»(입력·시트에서 읽은 문자열)을 쓰면 안 된다 — 잇기의 학생번호·'✓' 는 우리 값이라 그대로 둔다 */
  const 밖 = 본문.split('\n').filter((l) => /\.setValue\(/.test(l) && !/소독\(값들\[n\]\)/.test(l));
  assert.ok(밖.every((l) => !/입력|한줄|문장|사유/.test(l)), '진단칸쓰기_ 밖의 직기입이 남의 글을 쓴다 — 소독은 한 통로에서만 산다:\n' + 밖.join('\n'));
  // 런타임 — 문맥에 셀안전_ 를 끼우면 그 함수를 타고, 빼면 원문 그대로다(시험 문맥 기본)
  C.셀안전_ = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v);
  try {
    const s = C.진단시작_({ 역할: '시작', 이메일: 'inj@b.mn' });
    C.진단멈춘까닭_({ 세션번호: s.세션번호, 한줄: '=1+1' });
    const rows = C.시트들['진단세션'].rows;
    assert.equal(rows[rows.length - 1][C.DIAG_SESSION_HEADERS.indexOf('멈춘까닭')], "'=1+1", '수식 문자가 소독 없이 들어갔다');
  } finally { delete C.셀안전_; }
});

test('[㉠-1] JSON 통로에 why·fix 가 있다 — 화면이 그 둘을 부른다', () => {
  const s = C.진단시작_({ 역할: '시작', 이메일: 'api@b.mn' });
  const why = JSON.parse(C.진단API_({ parameter: { p: '진단' }, postData: { contents: JSON.stringify({ op: 'why', session: s.세션번호, text: '돈이 없어서요' }) } }, 'post').t);
  assert.equal(why.ok, true);
  const fix = JSON.parse(C.진단API_({ parameter: { p: '진단' }, postData: { contents: JSON.stringify({ op: 'fix', session: s.세션번호, verdict: '맞아요' }) } }, 'post').t);
  assert.equal(fix.ok, true);
  const r = C.진단결과_({ 세션번호: s.세션번호 });
  assert.equal(r.멈춘까닭, '돈이 없어서요'); assert.equal(r.고침.판정, '맞아요');
});
