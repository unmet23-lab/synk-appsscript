'use strict';
/**
 * 자율일 묶음 — 「그날 실제로 배정한 묶음」이 자인가 (정본 = docs/자율일_설계_v1.md · 실물 = contents_1기차시.js · 엔진_자율일.js)
 *
 * ■ 이 시험이 막는 것 — 전부 «조용히» 새는 자리다
 *   ① 차시 표가 바뀌었는데 판 번호가 안 올랐다 → 옛 묶음이 무엇을 겨눴는지 복원이 안 된다(심문 1회차 아스트라 P0).
 *   ② 진단이 재는 여섯이 4차시까지 안 지나간다 → 중간 진단(12-20)이 안 배운 것을 잰다(대응표 §③).
 *   ③ 묶음 항목 수가 상한을 넘거나, 이월이 «더하기»가 된다 → 어려워하는 학생에게 부담이 쌓인다(아스트라 P1).
 *   ④ 재료가 모자란 날을 조용히 메운다 → 우리 고장이 학생 게으름으로 기록된다(설계 §④ 공급 실패).
 *   ⑤ 제출 «행 수»로 완주를 센다 → 같은 문장 세 번이 완주가 된다(아스트라 P1).
 *   ⑥ 진단 문항을 굳히기에 쓴다 → 자가 죽는다(memory teaching-toward-the-ruler-kills-it).
 *
 * ■ 리터럴을 안 쓴다 — 문형 번호·급수는 뱅크와 진단 은행에서 뽑아 대조한다(진단문항.test.js 규약).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
// vm 안에서 만든 배열은 이 영역의 Array 와 프로토타입이 달라 strict deepEqual 이 «같은 구조인데 다르다»고 운다 — JSON 왕복으로 견준다
const 같다 = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { engineSource, ROOT } = require('./_engine-source');

const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

/* ── 실물 태우기(순수 함수만 · 시트 없음) ─────────────────────────────────── */
function 로드() {
  const ctx = { console, Utilities: { formatDate: () => '2026-12-12', computeDigest: () => [1, 2, 3], DigestAlgorithm: {}, Charset: {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }, Logger: { log: () => {} } };
  vm.createContext(ctx);
  ['contents_1기차시.js', 'contents_진단문항.js', '엔진_자율일.js'].forEach((f) => {
    new vm.Script(읽기(f).replace(/^'use strict';/, ''), { filename: f }).runInContext(ctx);
  });
  // 톱레벨 const 는 컨텍스트 객체에 안 붙는다(함수만 붙는다) — 같은 컨텍스트의 스크립트는 그 렉시컬 환경을 나눠 쓰므로 여기서 꺼낸다
  vm.runInContext('globalThis.__X = { COHORT1_WEEKS, COHORT1_WEEKS_VER, COHORT1_ALL_GRAMMAR, COHORT1_STYLE_ITEMS, COHORT1_BUNDLE_SIZE, DIAG_Q_LV4, AUTO_ASSIGN_HEADERS }', ctx);
  return Object.assign(ctx, ctx.__X);
}
const C = 로드();

const 뱅크 = (() => {
  const 엔진 = engineSource();
  const s = 엔진.indexOf('const GRAMMAR_BANK = [');
  assert.notEqual(s, -1, 'GRAMMAR_BANK 를 못 찾았다');
  const e = 엔진.indexOf('\n];', s);
  const m = {};
  [...엔진.slice(s, e).matchAll(/\[\s*'(G\d+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,/g)].forEach((r) => { m[r[1]] = { 이름: r[2], 도입급: Number(r[4]) }; });
  assert.ok(Object.keys(m).length > 50, '뱅크 파싱이 얕다');
  return m;
})();

const 주 = (n) => C.COHORT1_WEEKS.filter((w) => w.차시 === n)[0];
const 일자 = (s) => new Date(s + 'T00:00:00Z');

/* ── ① 차시 표 ────────────────────────────────────────────────────────────── */
test('차시 표는 8행이고 차시 1~8 순이며 자율일 = 토요일 + 1일이다', () => {
  assert.equal(C.COHORT1_WEEKS.length, 8);
  C.COHORT1_WEEKS.forEach((w, i) => {
    assert.equal(w.차시, i + 1);
    assert.equal((일자(w.일) - 일자(w.토)) / 86400000, 1, `${w.차시}차시 자율일이 토요일 다음 날이 아니다`);
    assert.equal(일자(w.토).getUTCDay(), 6, `${w.차시}차시 정규일이 토요일이 아니다`);
  });
  assert.equal(C.COHORT1_WEEKS[0].토, '2026-12-05', '첫 수업 12-05(판매 설계 §⑨ · 유호 확정 09-07)');
  assert.equal(C.COHORT1_WEEKS[7].일, '2027-01-24', '끝 진단 01-24(시즌 끝)');
});

test('판 번호 = 표의 지문 — 표가 바뀌면 COHORT1_WEEKS_VER 도 올라야 한다', () => {
  const 지문 = crypto.createHash('sha256').update(JSON.stringify(C.COHORT1_WEEKS)).digest('hex').slice(0, 16);
  const 판 = { 'c1w-2026-09-07': '2381a4cd95fb1015' };
  assert.ok(판[C.COHORT1_WEEKS_VER], `모르는 판 번호 ${C.COHORT1_WEEKS_VER} — 이 표에 (판, 지문) 한 줄을 더해라`);
  assert.equal(지문, 판[C.COHORT1_WEEKS_VER],
    `차시 표가 바뀌었는데 판 번호가 그대로다(지문 ${지문}) — COHORT1_WEEKS_VER 를 올리고 이 표에 새 지문을 적어라. 옛 묶음은 옛 판을 쥔다`);
});

test('문형이 전부 뱅크에 실재하고, 열둘 목록 = 표의 문형 합집합이다', () => {
  const 합 = [];
  C.COHORT1_WEEKS.forEach((w) => w.문형.forEach((g) => { assert.ok(뱅크[g], `${g} 이 뱅크에 없다`); 합.push(g); }));
  같다([...합].sort(), [...C.COHORT1_ALL_GRAMMAR].sort());
  assert.equal(new Set(합).size, 12, '문형이 겹치거나 열둘이 아니다');
});

test('진단이 재는 4급 여섯이 4차시까지 전부 지나간다(중간 진단이 배운 것만 잰다 · 대응표 §③)', () => {
  const 진단여섯 = C.DIAG_Q_LV4.map((g) => g[0]);
  const 넷까지 = [].concat(...C.COHORT1_WEEKS.filter((w) => w.차시 <= 4).map((w) => w.문형));
  진단여섯.forEach((g) => assert.ok(넷까지.indexOf(g) > -1, `${g} 이 4차시까지 안 나온다`));
  const 셋까지 = [].concat(...C.COHORT1_WEEKS.filter((w) => w.차시 <= 3).map((w) => w.문형));
  assert.equal(진단여섯.filter((g) => 셋까지.indexOf(g) > -1).length, 4, '중간 진단 시점에 배운 진단 문형은 넷이다(대응표 §③ 3과)');
});

test('주 유형은 넷 중에서만 · 필수진단 주에만 진단 회차가 있다 · 1차시만 문형없음 · 8차시만 전체복습', () => {
  const 허용 = ['일반', '문형없음', '전체복습', '필수진단'];
  C.COHORT1_WEEKS.forEach((w) => {
    w.유형.forEach((t) => assert.ok(허용.indexOf(t) > -1, `${w.차시}차시 유형 ${t}`));
    assert.equal(!!w.진단, w.유형.indexOf('필수진단') > -1, `${w.차시}차시 진단 칸과 유형이 어긋난다`);
  });
  같다(C.COHORT1_WEEKS.filter((w) => w.유형.indexOf('문형없음') > -1).map((w) => w.차시), [1]);
  같다(C.COHORT1_WEEKS.filter((w) => w.유형.indexOf('전체복습') > -1).map((w) => w.차시), [8]);
  assert.equal(주(3).진단, '중간'); assert.equal(주(8).진단, '끝');
});

/* ── 재료 ───────────────────────────────────────────────────────────────── */
const 문항 = (i, 목표) => ({ 문장: `문장 ${i} ___ 해요.`, 보기: ['가', '나', '다', '라'], 정답: i % 4, 판: 'ai:test', 목표 });
const 가득 = (w) => ({
  굳히기문항: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 문항(i, w.문형[i % 2])),
  낭독: [{ 문장: '문장 A', 목표: w.문형[0] }, { 문장: '문장 B', 목표: w.문형[1] }],
  답하기: [{ 물음: '물음 A', 목표: w.문형[0] }, { 물음: '물음 B', 목표: w.문형[1] }],
  오답행: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: 'Q' + i, 문형: i <= 2 ? w.문형[0] : 'G5' + i, 반복: i, t: i, 문항: { 문장: 'q' + i } })),
});
const 종류수 = (b) => b.항목.reduce((m, a) => { m[a.종류] = (m[a.종류] || 0) + 1; return m; }, {});

/* ── ③④ 묶음 ────────────────────────────────────────────────────────────── */
test('일반 주 묶음 — 굳히기 8 · 낭독 2 · 답하기 2 · 오답 ≤5 · 공급 정상 · 항목ID 가 안 겹친다', () => {
  const w = 주(2);
  const b = C.자율일묶음_(w, 'S1', 가득(w));
  assert.equal(b.배정ID, 'S1|2026-12-13');
  assert.equal(b.차시판, C.COHORT1_WEEKS_VER, '묶음이 그때 판 번호를 제 안에 박는다');
  같다(b.목표, ['G713', 'G714']);
  같다(종류수(b), { 굳히기: 8, 낭독: 2, 답하기: 2, 오답: 5 });
  assert.equal(b.공급상태, '정상');
  assert.equal(new Set(b.항목.map((a) => a.항목ID)).size, b.항목.length, '항목ID 가 겹친다');
  b.항목.forEach((a) => assert.ok(a.항목ID.indexOf(b.배정ID + '#') === 0, '항목ID 는 배정ID 로 시작한다(제출이 묶음을 가리키는 열쇠)'));
  b.항목.filter((a) => a.종류 === '굳히기').forEach((a) => assert.ok(a.문항 && a.문항.판, '굳히기 문항에 판이 박힌다'));
});

test('오답 자리 — 그 주 문형이 든 것 먼저, 그다음 반복 많은 것 · 상한 5 · 남는 것은 버리지 않고 다음 주로', () => {
  const w = 주(2);
  const 고른 = C.자율일오답고르기_(가득(w).오답행, w.문형, 5);
  assert.equal(고른.length, 5);
  같다(고른.slice(0, 2).map((x) => x.id), ['Q2', 'Q1'], '그 주 문형이 든 둘이 먼저(그 안에서 반복 많은 순)');
  같다(고른.slice(2).map((x) => x.id), ['Q7', 'Q6', 'Q5'], '나머지는 반복 많은 순');
  같다(C.자율일오답고르기_([], w.문형, 5), []);
});

test('이월은 «더하기»가 아니라 «자리 차지» — 이월 3 + 새 오답 7 이어도 오답 자리는 5 다', () => {
  const w = 주(4);
  const 재료 = 가득(w);
  재료.이월 = [1, 2, 3].map((i) => ({ 종류: '오답', 목표: 'G713', 문항: { 문장: '이월 ' + i }, 원오답: { 이월: 'S1|2026-12-20#굳히기' + i } }));
  const b = C.자율일묶음_(w, 'S1', 재료);
  const 오답 = b.항목.filter((a) => a.종류 === '오답');
  assert.equal(오답.length, 5);
  assert.equal(오답.filter((a) => a.이월).length, 3, '이월이 앞자리를 차지한다');
  assert.equal(오답.filter((a) => !a.이월).length, 2, '새 오답은 남은 자리만');
  assert.ok(오답.every((a) => a.원오답), '오답 항목마다 원오답 고리가 남는다(심문 A2)');
});

test('재료가 모자라면 «공급실패» 를 이름으로 남기고 조용히 메우지 않는다', () => {
  const w = 주(2);
  const 재료 = 가득(w);
  재료.굳히기문항 = 재료.굳히기문항.slice(0, 6);
  const b = C.자율일묶음_(w, 'S1', 재료);
  assert.equal(종류수(b).굳히기, 6);
  assert.match(b.공급상태, /^공급실패:굳히기 6\/8/);
  const 빈 = C.자율일묶음_(주(1), 'S1', {});
  assert.equal(빈.공급상태, '공급실패:전부');
  assert.equal(빈.항목.length, 0);
});

test('1차시(문형없음) 목표는 요목 열쇠 · 굳히기는 COHORT1_STYLE_ITEMS 가 채워져야 나온다(지금 0 = 설계 §⑨-7)', () => {
  const b = C.자율일묶음_(주(1), 'S1', { 낭독: [{ 문장: 'a' }, { 문장: 'b' }], 답하기: [{ 물음: 'a' }, { 물음: 'b' }] });
  같다(b.목표, ['요목:말투두벌']);
  assert.equal(C.COHORT1_STYLE_ITEMS.length === 0, /굳히기 0\/8/.test(b.공급상태), '말투 두 벌 문항이 비어 있으면 굳히기 공급실패로 보인다');
});

test('필수진단 주 — 진단 항목이 «필수»로 든다 · 8차시 전체복습 목표는 그 학생이 놓친 문형 셋(없으면 열둘 순환)', () => {
  const b3 = C.자율일묶음_(주(3), 'S1', 가득(주(3)));
  const 진단 = b3.항목.filter((a) => a.종류 === '진단');
  assert.equal(진단.length, 1); assert.equal(진단[0].회차, '중간');
  const w8 = 주(8);
  const 재료8 = { 굳히기문항: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 문항(i)), 낭독: [{ 문장: 'a' }, { 문장: 'b' }], 답하기: [{ 물음: 'a' }, { 물음: 'b' }], 전체복습문형: ['G724', 'G705'] };
  const b8 = C.자율일묶음_(w8, 'S1', 재료8);
  같다(b8.목표, ['G724', 'G705']);
  assert.equal(b8.항목.filter((a) => a.종류 === '진단')[0].회차, '끝');
  const b8b = C.자율일묶음_(w8, 'S1', Object.assign({}, 재료8, { 전체복습문형: [] }));
  같다(b8b.목표, C.COHORT1_ALL_GRAMMAR.slice(0, 3));
  assert.ok(b8.항목.filter((a) => a.종류 === '굳히기').every((a) => ['G724', 'G705'].indexOf(a.목표) > -1), '굳히기 목표가 복습 문형에서 돈다');
});

/* ── ⑤ 완주 ─────────────────────────────────────────────────────────────── */
test('완주는 «항목이 찼는가»로 센다 — 같은 항목 세 번 제출해도 하나 · 다섯 갈래', () => {
  const w = 주(2);
  const b = C.자율일묶음_(w, 'S1', 가득(w));
  const 전부 = b.항목.map((a) => ({ 항목ID: a.항목ID }));
  assert.equal(C.자율일완주_(b, 전부).판정, '완주');
  const 하나만세번 = [1, 2, 3].map(() => ({ 항목ID: b.항목[0].항목ID }));
  const r = C.자율일완주_(b, 하나만세번);
  assert.equal(r.판정, '부분'); assert.equal(r.찬수, 1, '행 수가 아니라 항목 수');
  assert.equal(r.항목수, b.항목.length);
  assert.equal(C.자율일완주_(b, []).판정, '빈날');
  assert.equal(C.자율일완주_({ 공급상태: '공급실패:전부', 항목: [] }, 전부).판정, '공급실패');
  // 일부 공급 실패는 채운 만큼이 분모다(설계 §③-㉢)
  const 재료 = 가득(w); 재료.굳히기문항 = 재료.굳히기문항.slice(0, 6);
  const b6 = C.자율일묶음_(w, 'S1', 재료);
  assert.equal(C.자율일완주_(b6, b6.항목.map((a) => ({ 항목ID: a.항목ID }))).판정, '완주');
});

test('미집계 종류(talk 답이 없는 낭독·답하기)는 분모에서 빠지고, 그 사실이 판정에 남는다', () => {
  const w = 주(2);
  const b = C.자율일묶음_(w, 'S1', 가득(w));
  const 글만 = b.항목.filter((a) => a.종류 !== '낭독' && a.종류 !== '답하기').map((a) => ({ 항목ID: a.항목ID }));
  const r = C.자율일완주_(b, 글만, { 미집계: ['낭독', '답하기'] });
  assert.equal(r.판정, '완주'); 같다(r.미집계, ['낭독', '답하기']);
  assert.equal(r.항목수, b.항목.length - 4);
  assert.equal(C.자율일완주_(b, 글만).판정, '부분', '미집계를 안 주면 말하기 넷이 빈 항목이다');
});

test('월요일 한 줄 — 공급 실패가 있으면 그것이 먼저 온다 · 빈 날은 이름으로', () => {
  const 줄 = C.자율일한줄_([{ 이름: '바트', 판정: '완주' }, { 이름: '사란', 판정: '빈날' }, { 이름: '뭉흐', 판정: '공급실패' }, { 이름: '오윤', 판정: '부분(지각)' }], '2026-12-13');
  assert.ok(줄.indexOf('공급 실패 1(뭉흐)') > -1 && 줄.indexOf('공급 실패') < 줄.indexOf('완주'), 줄);
  assert.ok(줄.indexOf('빈 날 1(사란)') > -1, 줄);
  assert.ok(줄.indexOf('부분 1') > -1, '(지각) 꼬리가 붙어도 부분으로 센다');
});

/* ── ⑥ 자를 향해 가르치지 않는다 · 배선 ────────────────────────────────────── */
test('굳히기는 진단 문항을 «절대» 안 쓴다 — 엔진_자율일.js 가 진단 은행을 부르지 않는다', () => {
  const src = 읽기('엔진_자율일.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal((src.match(/진단문항급_|진단문항_\(|DIAG_Q_LV/g) || []).length, 0, '자율일 엔진이 진단 문항에 손을 댔다 — 자가 죽는다');
});

test('배선 — 골격에 자율일배정 · 토요일 밤 묶음 · 월 07시 판정 · 화요일 재집계가 실제로 걸려 있다', () => {
  const 셋업 = 읽기('엔진_셋업확장.js');
  assert.match(셋업, /\[AUTO_ASSIGN_TAB_, AUTO_ASSIGN_HEADERS, 수집표식_\]/, '골격에 자율일배정이 없다');
  const nightStart = 셋업.indexOf('function nightJobs(');
  const weeklyStart = 셋업.indexOf('function weeklyJobs(');
  assert.ok(nightStart > -1 && weeklyStart > nightStart);
  const night = 셋업.slice(nightStart, weeklyStart), weekly = 셋업.slice(weeklyStart, weeklyStart + 3000);
  assert.match(night, /safeRun\('sundayBundle', sundayBundleBatch_\)/, '토요일 밤 묶음이 밤 배치에 안 걸렸다');
  assert.match(night, /safeRun\('sundayBundleJudge', sundayBundleJudge_\)/, '화요일 재집계가 밤 배치에 안 걸렸다');
  assert.match(weekly, /safeRun\('sundayBundleJudge', sundayBundleJudge_\)/, '월요일 판정이 weeklyJobs(월 07시)에 안 걸렸다');
  assert.equal(AUTO_HEADERS_OK(), true);
});
function AUTO_HEADERS_OK() {
  const H = C.AUTO_ASSIGN_HEADERS;
  ['배정ID', 'student_id', '자율일', '차시판', '항목', '공급상태', '완주판정', '빈항목', '미집계'].forEach((n) => assert.ok(H.indexOf(n) > -1, `헤더 ${n} 없음`));
  return new Set(H).size === H.length;
}
