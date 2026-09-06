'use strict';
/**
 * 학생ID 종단 — 소급 불가 넷 중 appsscript 몫 회귀 (2026-09-02)
 *   설계 = docs/학생ID_종단_설계.md §5㉠·㉡ · 판정 = docs/_ops/심문결과/학생ID_종단_설계_v1-전건판정.md Ⅰ-1·Ⅰ-3·Ⅲ-1·Ⅲ-2·Ⅳ-1
 *
 * ■ 지키는 것 여섯
 *   ① 카운터가 «없으면»(키 없음·빈칸) 발급 0건 — 자기초기화 금지(판정 Ⅰ-3). 세우기가 심은 숫자 0 은 «없음»이 아니다(교착 방지).
 *   ② 세우기는 멱등 — 두 번 = 같은 값 · 절대 낮추지 않는다.
 *   ③ 발급은 카운터를 «행에 쓰기 전»에 올린다 — 소스 순서 + 실행(행 쓰기가 죽어도 카운터는 올라가 있다 · 번호는 비지 겹치지 않는다).
 *   ④ EXIT_LOG_HEADERS 정본 한 곳 + 8칸(v9.312 끝에 이름_몽골) — 골격·런타임 둘 다 그 상수 · 소비자(복귀창_ r[3]) 가 안 흔들린다.
 *   ⑤ 재입학 뒤 둘째 퇴소 행이 생긴다(시트 흉내) · 같은 아침 재실행은 두 줄을 안 만든다 · 쓰는 자리 = 급감 가드 뒤·행 삭제 앞.
 *   ⑥ 종료사유 드롭다운 값 여섯(결정.md 08-30) · 500행 1회 적용.
 *
 * ■ 왜 «실행» 검사인가 — 「setState 가 setValue 보다 앞에 있다」는 소스 순서만 보면 `setState(…, 0)` 같은 죽은 호출도
 *   초록이다. 그래서 채번은 가짜 시트로 **실제로 태워** 카운터 값과 시트 값을 함께 읽는다(F207 · 미실행은 통과와 같은 모양).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { engineSource } = require('./_engine-source');
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
function 불러오기(src, 이름들, 의존) {
  const n = Object.keys(의존);
  return new Function(...n, `${src}\nreturn { ${이름들.join(', ')} };`)(...n.map((k) => 의존[k]));
}
const 배열상수 = (name) => JSON.parse(code.match(new RegExp('const ' + name + ' = (\\[[^\\]]*\\]);'))[1].replace(/'/g, '"'));

const EXIT_LOG_HEADERS = 배열상수('EXIT_LOG_HEADERS');
const EXIT_REASONS_ = 배열상수('EXIT_REASONS_');

/* Code.js 공용 유틸을 정본 그대로 태운다 — 스텁이면 getState/setState 가 깨져도 이 시험이 초록이다. */
const 유틸 = 불러오기(
  section('function ensureSheet(ss, name, headers)', 'function writeIfChanged(') +
  section('function getState(st, key)', '/* --- PL 채번'),
  ['ensureSheet', 'getState', 'setState'], {});
const { writeIfChanged } = 불러오기(section('function writeIfChanged(sheet, row, col, values)', '/* [v9.157]'),
  ['writeIfChanged'], { 행소독_: (v) => v });

/* ───────────────────────── 채번 하네스 ───────────────────────── */

const CONSULT = 'CONSULT-ID', ENGINE = 'ENGINE-ID';
const 폭 = 60; // BH = 60열

/** 상담시트 흉내 — 2행 헤더(이름(한국어)·처리상태) · 3행부터 학생. 학생ID 는 60열(BH). */
function 상담시트(학생들) {
  const hdr = new Array(폭).fill('');
  hdr[0] = '이름(한국어)'; hdr[5] = '처리상태';
  const rows = [new Array(폭).fill(''), hdr];
  (학생들 || []).forEach((s) => {
    const r = new Array(폭).fill('');
    r[0] = s.이름 === undefined ? '' : s.이름; r[5] = s.상태 || ''; r[59] = s.id || '';
    rows.push(r);
  });
  return 시트흉내({ 첫행: 1, 행들: rows });
}
const 학생ID열 = (consult) => consult.data.slice(2).map((r) => r[59] || '');

function 속성흉내(초기) {
  const 통 = Object.assign({}, 초기 || {});
  return {
    통,
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(통, k) ? 통[k] : null),
    setProperty: (k, v) => { 통[k] = String(v); },
    deleteProperty: (k) => { delete 통[k]; },
  };
}

/**
 * 채번 함수들을 실제로 태울 판.
 * @param o {consult, appState(행들: [['key','value'], ...]), 활성: 'engine'|'consult'|null, 속성, exitLog}
 */
function 채번판(o) {
  const consult = o.consult || 상담시트([]);
  const st = 시트흉내({ 첫행: 1, 행들: [['key', 'value']].concat(o.appState || []) });
  const ex = o.exitLog || null;
  const 엔진 = {
    getId: () => ENGINE,
    getSheetByName: (n) => (n === 'app_state' ? st : n === 'exit_log' ? ex : null),
    insertSheet: (n) => { throw new Error('시트를 새로 만들면 안 된다: ' + n); },
  };
  const 상담북 = {
    getId: () => CONSULT,
    getSheetByName: (n) => (n === '상담데이터입력' ? consult : null),
    insertSheet: (n) => { throw new Error('상담시트에 탭을 만들면 안 된다(app_state 두 벌 사고): ' + n); },
  };
  const 활성 = o.활성 === undefined ? 'engine' : o.활성;
  const 속성 = o.속성 || 속성흉내();
  const 로그 = [], 메일 = [];
  const src = section('const 학생ID_열_ = 60;', '\n/* 상담시트 설치형 onEdit') + '\n' +
    section('function 학생ID카운터세우기()', '/* ═══');
  const fns = 불러오기(src,
    ['학생ID_발급_', '학생ID카운터세우기', '학생ID현황_', '학생ID_카운터_', '학생ID_스캔_', '학생ID_엔진시트_'], {
      CONSULT_SHEET_ID: CONSULT,
      SpreadsheetApp: {
        openById: (id) => { if (id === CONSULT) return 상담북; if (id === ENGINE) return 엔진; throw new Error('없는 시트 ' + id); },
        getActiveSpreadsheet: () => (활성 === 'engine' ? 엔진 : 활성 === 'consult' ? 상담북 : null),
      },
      PropertiesService: { getScriptProperties: () => 속성 },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
      Logger: { log: (...a) => 로그.push(a.map(String).join(' ')) },
      adminMail: (s, b) => 메일.push({ s, b }),
      EXIT_LOG_HEADERS,
      ensureSheet: 유틸.ensureSheet, getState: 유틸.getState, setState: 유틸.setState,
    });
  const 카운터 = () => fns.학생ID_카운터_(st);
  return Object.assign({ consult, st, 속성, 로그, 메일, 카운터 }, fns);
}

/* ───────────────── ① 카운터 없음 → 발급 0건 (자기초기화 금지) ───────────────── */

test('① 카운터 키가 없으면 발급 0건 — 시트에 아무것도 안 쓰고, 로그·원장 알림으로 「먼저 세워라」', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: '바트', 상태: '반배정' }, { 이름: '사라', 상태: '앱편입' }]) });
  assert.deepEqual(판.학생ID_발급_(), [], '카운터가 없는데 발급했다 — 상담시트만 보고 번호를 뽑으면 되돌아가는 사고가 그대로다');
  assert.deepEqual(학생ID열(판.consult), ['', ''], '카운터 없이 시트에 번호를 썼다');
  assert.equal(판.카운터(), null, '발급 경로가 카운터를 스스로 심었다 — reservePlIds 의 자기초기화를 베꼈다(판정 Ⅰ-3)');
  assert.ok(판.로그.some((l) => /발급 중단/.test(l) && /카운터 세우기/.test(l)), '「먼저 세워라」 로그가 없다: ' + 판.로그.join(' / '));
  assert.equal(판.메일.length, 1, '원장 알림이 0통 또는 여러 통이다');
  assert.match(판.메일[0].b, /바트\(3행\)/, '알림에 발급 대기 학생이 없다 — 무엇이 멈췄는지 원장이 모른다');
  판.학생ID_발급_();
  assert.equal(판.메일.length, 1, '같은 상태인데 두 번째 알림이 갔다 — 매 아침·매 편집마다 오면 곧 안 읽힌다');
});

test('① 키는 있는데 값이 빈칸이면 «없음»이다 — 유실을 정상으로 읽지 않는다', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: '바트', 상태: '반배정' }]), appState: [['학생ID_최종번호', '']] });
  assert.deepEqual(판.학생ID_발급_(), []);
  assert.deepEqual(학생ID열(판.consult), ['']);
});

test('① 발급 대상이 0건이면 카운터를 «보지도» 않는다 — 상담시트 편집마다 엔진 시트를 여는 비용을 안 낸다', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: '바트', 상태: '신규접수' }]) });
  assert.deepEqual(판.학생ID_발급_(), []);
  assert.equal(판.메일.length, 0, '발급할 것이 없는데 「카운터 없음」 알림을 보냈다');
});

test('① 세우기가 심은 숫자 0 은 유효한 바닥이다 — 학생 0명인 학원이 첫 번호를 뽑을 수 있다(교착 방지)', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: '바트', 상태: '반배정' }]) });
  assert.match(판.학생ID카운터세우기(), /= 0 /, '빈 상담시트에서 0 을 심지 않았다');
  assert.equal(판.카운터(), 0);
  const 발급 = 판.학생ID_발급_();
  assert.deepEqual(발급.map((x) => x.id), ['SYNK-001'], '바닥 0 에서 첫 번호가 SYNK-001 이 아니다');
  assert.equal(판.카운터(), 1);
});

/* ───────────────── ① 문맥 — 상담시트 트리거에서 엔진 시트를 되찾는다 ───────────────── */

test('① 활성 시트가 «상담시트»인 문맥(onConsultEdit)에서는 적어 둔 엔진 ID 로 연다 — 없으면 멈추고, 상담시트에 탭을 안 만든다', () => {
  const 속성 = 속성흉내();
  const 막힘 = 채번판({ consult: 상담시트([{ 이름: '바트', 상태: '반배정' }]), appState: [['학생ID_최종번호', 5]], 활성: 'consult', 속성 });
  assert.deepEqual(막힘.학생ID_발급_(), [], '엔진 ID 를 모르는데 발급했다 — 어느 app_state 를 읽었나');
  assert.ok(막힘.로그.some((l) => /엔진 시트/.test(l)), '왜 멈췄는지(엔진 시트 못 찾음) 로그가 없다');
  // 아침 배치(엔진 문맥)가 한 번 돌면 ID 가 적힌다
  const 아침 = 채번판({ consult: 상담시트([]), appState: [['학생ID_최종번호', 5]], 활성: 'engine', 속성 });
  아침.학생ID_엔진시트_();
  assert.equal(속성.통.ENGINE_SS_ID, ENGINE, '엔진 문맥에서 엔진 시트 ID 를 안 적어 둔다');
  // 그 다음 상담시트 트리거는 같은 카운터를 쓴다
  const 열림 = 채번판({ consult: 상담시트([{ 이름: '바트', 상태: '반배정' }]), appState: [['학생ID_최종번호', 5]], 활성: 'consult', 속성 });
  assert.deepEqual(열림.학생ID_발급_().map((x) => x.id), ['SYNK-006']);
  assert.equal(열림.카운터(), 6);
});

/* ───────────────── ② 세우기 멱등 · 절대 낮추지 않는다 ───────────────── */

test('② 세우기 — 없을 때만 상담시트 최대값으로 심고, 두 번째는 「이미 있음(값)」으로 수렴한다', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: 'a', 상태: '반배정', id: 'SYNK-003' }, { 이름: 'b', 상태: '앱편입', id: 'SYNK-007' }, { 이름: 'c', 상태: '반배정' }]) });
  const 첫 = 판.학생ID카운터세우기();
  assert.match(첫, /✅/); assert.match(첫, /= 7 /);
  assert.equal(판.카운터(), 7);
  const 둘 = 판.학생ID카운터세우기();
  assert.match(둘, /이미 있음\(7\)/, '두 번째 실행이 다시 심었다');
  assert.equal(판.카운터(), 7);
  assert.deepEqual(학생ID열(판.consult), ['SYNK-003', 'SYNK-007', ''], '세우기가 상담시트에 썼다 — 세우기는 카운터만 만진다');
});

test('② 세우기는 절대 낮추지 않는다 — 카운터(12) > 시트 최대(7)여도 그대로', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: 'a', 상태: '반배정', id: 'SYNK-007' }]), appState: [['학생ID_최종번호', 12]] });
  assert.match(판.학생ID카운터세우기(), /이미 있음\(12\)/);
  assert.equal(판.카운터(), 12, '카운터가 시트 최대값으로 «내려갔다» — 번호가 되돌아간다');
});

test('② 시트 최대(9) > 카운터(3)면 세우기는 안 올리고(한 판정엔 자 하나), 발급이 max() 로 따라잡는다', () => {
  const 판 = 채번판({ consult: 상담시트([{ 이름: 'a', 상태: '반배정', id: 'SYNK-009' }, { 이름: 'b', 상태: '반배정' }]), appState: [['학생ID_최종번호', 3]] });
  assert.match(판.학생ID카운터세우기(), /이미 있음\(3\)/);
  assert.equal(판.카운터(), 3);
  assert.deepEqual(판.학생ID_발급_().map((x) => x.id), ['SYNK-010'], 'max(카운터, 시트 최대)+1 이 아니다');
  assert.equal(판.카운터(), 10);
});

/* ───────────────── ③ 카운터를 «행에 쓰기 전»에 올린다 ───────────────── */

test('③ 소스 순서 — 발급 안에서 setState(카운터) 가 setValue(id) 보다 앞이다', () => {
  const 발급 = 코드만(section('function 학생ID_발급_()', '\n/* 상담시트 설치형 onEdit'));
  const i올림 = 발급.indexOf('setState(st, 학생ID_카운터키_');
  const i기입 = 발급.indexOf('.setValue(id)');
  assert.ok(i올림 !== -1, '발급이 카운터를 안 올린다');
  assert.ok(i기입 !== -1, '발급이 시트에 안 쓴다');
  assert.ok(i올림 < i기입, '카운터 갱신이 행 쓰기 «뒤»에 있다 — 쓰는 도중 죽으면 같은 번호가 다음 실행에 다시 나온다(v1 의 거꾸로 된 순서)');
  assert.ok(!/reservePlIds|point_logs_archive/.test(발급), '아카이브 자기초기화 선례를 베꼈다');
  assert.equal((발급.match(/학생ID_최대번호_\(consult\)/g) || []).length, 1, '시트 스캔은 «올리기» 한 자리에서만');
});

test('③ 실행 — 행 쓰기가 죽어도 카운터는 이미 올라가 있다 · 다음 실행은 그 번호를 «버리고» 뒤에서 뽑는다(번호는 비지, 겹치지 않는다)', () => {
  const consult = 상담시트([{ 이름: 'a', 상태: '반배정', id: 'SYNK-005' }, { 이름: 'b', 상태: '반배정' }, { 이름: 'c', 상태: '앱편입' }]);
  let 죽여 = true;
  const 원 = consult.getRange.bind(consult);
  consult.getRange = (r, c, n, w) => {
    const rg = 원(r, c, n, w);
    if (죽여 && c === 60 && n === undefined) rg.setValue = () => { throw new Error('시트 쓰기 실패(흉내)'); };
    return rg;
  };
  const 판 = 채번판({ consult, appState: [['학생ID_최종번호', 5]] });
  assert.throws(() => 판.학생ID_발급_(), /시트 쓰기 실패/);
  assert.equal(판.카운터(), 7, '행 쓰기가 죽었는데 카운터가 안 올라가 있다 — 실패의 방향이 「겹침」쪽이다');
  assert.deepEqual(학생ID열(consult), ['SYNK-005', '', ''], '죽은 쓰기가 시트에 남았다');
  죽여 = false;
  const 재시도 = 판.학생ID_발급_();
  assert.deepEqual(재시도.map((x) => x.id), ['SYNK-008', 'SYNK-009'], '버린 번호(006·007)를 재사용했다 — 구멍이 아니라 겹침으로 간다');
  assert.equal(판.카운터(), 9);
});

test('③ 게이트는 그대로 — 이미 있는 ID·무명·다른 처리상태에는 발급하지 않고, 이름표 조립은 학생ID_포맷_ 하나', () => {
  const 판 = 채번판({ consult: 상담시트([
    { 이름: 'a', 상태: '반배정', id: 'SYNK-002' }, { 이름: '', 상태: '반배정' }, { 이름: 'c', 상태: '신규접수' }, { 이름: 'd', 상태: '앱편입' }]),
    appState: [['학생ID_최종번호', 2]] });
  assert.deepEqual(판.학생ID_발급_().map((x) => [x.row, x.id]), [[6, 'SYNK-003']]);
  assert.deepEqual(학생ID열(판.consult), ['SYNK-002', '', '', 'SYNK-003']);
});

/* ───────────────── ④ EXIT_LOG_HEADERS 정본 한 곳 · 8칸 · 소비자 불변 ───────────────── */

test('④ EXIT_LOG_HEADERS — 정본 한 곳 · 8칸 · 옛 7칸은 자리 그대로 · 새 칸(v9.312 이름_몽골)은 «끝에»', () => {
  assert.equal((code.match(/const EXIT_LOG_HEADERS = \[/g) || []).length, 1, '헤더 정본이 두 곳이다');
  assert.deepEqual(EXIT_LOG_HEADERS, ['student_id', '이름', '반', '퇴소감지일', '재원일수', '종료사유', '종료일', '이름_몽골']);
  assert.equal(EXIT_LOG_HEADERS.indexOf('퇴소감지일'), 3, '소비자(복귀창_ r[3])가 집는 자리가 밀렸다');
  const 골격 = section('function sheetSkeleton_()', 'function bootstrapSynk()');
  assert.ok(/\['exit_log', EXIT_LOG_HEADERS[,\]]/.test(골격), '골격이 헤더 정본 상수를 쓰지 않는다');
  assert.ok(!코드만(골격).includes("['exit_log', ['student_id'"), '골격에 리터럴 사본이 남았다');
  const sync = 코드만(section('function syncProfiles()', 'function dailyBackup()'));
  assert.ok(!sync.includes("'exit_log', ['student_id'"), 'syncProfiles 에 리터럴 사본이 남았다 — 두 벌은 갈린다');
  assert.ok(sync.includes('exitLog시트_(SpreadsheetApp.getActiveSpreadsheet())'), 'syncProfiles 가 헤더보정·드롭다운 통로(exitLog시트_)를 안 지난다');
  const 준비 = 코드만(section('function exitLog시트_(ss)', 'function exitLog기록자_('));
  assert.ok(/헤더보정_\(sh, EXIT_LOG_HEADERS\)/.test(준비), '라이브 5칸 시트에 이름표를 안 붙인다 — ensureSheet 는 시트가 없을 때만 헤더를 쓴다');
  // 소비자 — 복귀창_ 은 여전히 r[3](퇴소감지일)을 읽고, 폭 5 는 7 안에 든다
  const 복귀 = 코드만(section('function 복귀창_(ss)', 'function aiWeakMap_('));
  assert.ok(/toDate_\(r\[3\]\)/.test(복귀), '복귀창_ 이 퇴소감지일을 r[3] 에서 안 읽는다 — 소비자가 흔들렸다');
  const m = 복귀.match(/getRange\(2, 1, sh\.getLastRow\(\) - 1, (\d+)\)/);
  assert.ok(m && Number(m[1]) <= EXIT_LOG_HEADERS.length, '복귀창_ 읽기 폭이 헤더 폭을 넘는다');
});

test('④ 학생ID현황_ 은 읽기 전용 — 셋을 세어 돌려주고 시트에 아무것도 안 쓴다', () => {
  const ex = 시트흉내({ 첫행: 1, 행들: [EXIT_LOG_HEADERS.slice(), ['SYNK-001', '', '', '2026-08-01', 30, '', '']] });
  const 판 = 채번판({ consult: 상담시트([{ 이름: 'a', 상태: '반배정', id: 'SYNK-004' }, { 이름: 'b', 상태: '반배정', id: 'SYNK-009' }, { 이름: 'c', 상태: '신규접수' }]),
    appState: [['학생ID_최종번호', 9]], exitLog: ex });
  const 전 = JSON.stringify([판.consult.data, 판.st.data, ex.data]);
  const out = 판.학생ID현황_();
  assert.match(out, /① 상담시트 BH 학생ID 보유 행 = 2건 \(최대 번호 9\)/);
  assert.match(out, /② exit_log 행 = 1건/);
  assert.match(out, /③ app_state\[학생ID_최종번호\] = 9 · 다음 학생 = SYNK-010/);
  assert.equal(JSON.stringify([판.consult.data, 판.st.data, ex.data]), 전, '현황이 시트를 바꿨다 — 읽기 전용이 아니다');
  assert.ok(판.로그.some((l) => l.indexOf('🔎 학생ID 현황') === 0), 'Logger 에도 같은 것을 안 남긴다');
  const 없음 = 채번판({ consult: 상담시트([]) });
  assert.match(없음.학생ID현황_(), /③ app_state\[학생ID_최종번호\] = 없음 → 발급이 멈춰 있다/);
});

test('④ 메뉴 배선 — 세우기·현황이 시트 메뉴에 있고 래퍼가 실재한다', () => {
  const menu = section('function onOpen()', 'addToUi();');
  assert.ok(menu.includes("'menuStudentIdCounterInit'"), '메뉴에 「학생ID 카운터 세우기」가 없다 — 세우는 손이 편집기뿐이면 유호님이 못 누른다');
  assert.ok(menu.includes("'menuStudentIdStatus'"), '메뉴에 「학생ID 현황」이 없다');
  assert.ok(/function menuStudentIdCounterInit\(\) \{ menuRun_\(학생ID카운터세우기\); \}/.test(code));
  assert.ok(/function menuStudentIdStatus\(\) \{ menuRun_\(학생ID현황_\); \}/.test(code));
  assert.ok(/^function 학생ID카운터세우기\(\)/m.test(code), '세우기 이름에 밑줄이 붙었다 — 편집기 ▶ 목록에서 사라진다');
});

/* ───────────────── ⑤ 재입학 뒤 둘째 퇴소 행 ───────────────── */

const 사건 = 불러오기(section('function exitLog기록자_(exitSh)', '\nfunction syncProfiles()'), ['exitLog기록자_', '퇴소사건필요_'], {});

test('⑤ 재입학 뒤 다시 퇴소하면 «새 줄»이 생기고(append), 같은 아침 재실행·안 돌아온 사람은 두 줄을 안 만든다', () => {
  const ex = 시트흉내({ 첫행: 1, 행들: [EXIT_LOG_HEADERS.slice()] });
  const 적기 = (sid, 날) => writeIfChanged(ex, ex.getLastRow() + 1, 1, [[sid, '이름', '반', 날, 30, '', '']]);
  const 행수 = () => ex.getLastRow() - 1;
  // 첫 아침 — 명부에 있던 학생(keep 에 행)이 퇴소
  let keep = { S1: { created_at: '2026-02-01' } };
  assert.equal(사건.퇴소사건필요_('S1', 사건.exitLog기록자_(ex), keep), true, '첫 사건인데 안 적는다');
  적기('S1', '2026-06-01');
  assert.equal(행수(), 1);
  // 같은 아침 재실행 — 행은 이미 지워졌다(keep 에 없다)
  keep = {};
  assert.equal(사건.퇴소사건필요_('S1', 사건.exitLog기록자_(ex), keep), false, '같은 아침 재실행이 둘째 줄을 만든다(멱등 깨짐)');
  // 몇 달 뒤에도 안 돌아온 사람 — 여전히 안 적는다
  assert.equal(사건.퇴소사건필요_('S1', 사건.exitLog기록자_(ex), { S2: {} }), false, '안 돌아온 사람인데 새 사건이 생긴다');
  // 재입학(명부 재진입 → profiles 행 생성) 뒤 다시 퇴소 — 새 줄
  keep = { S1: { created_at: '2026-02-01' } };
  assert.equal(사건.퇴소사건필요_('S1', 사건.exitLog기록자_(ex), keep), true, '복학 뒤 재퇴소가 영영 안 적힌다 — 옛 exitedIds 영구 차단 그대로다(판정 Ⅳ-1)');
  적기('S1', '2026-10-01');
  assert.equal(행수(), 2, '둘째 사건이 새 줄이 아니다');
  assert.deepEqual(ex.data.slice(1).map((r) => r[0]), ['S1', 'S1']);
  assert.deepEqual(ex.data.slice(1).map((r) => String(r[3] instanceof Date ? r[3].getMonth() + 1 : r[3])), ['6', '10'], '두 사건의 퇴소감지일이 다르지 않다');
  assert.equal(사건.exitLog기록자_(ex).size, 1, '기록자 집합이 학생이 아니라 줄을 센다');
});

test('⑤ syncProfiles — 사건은 퇴소사건필요_ 로 가르고, 쓰는 자리는 급감 가드 «뒤» · 행 삭제 «바로 앞»이며, 8칸으로 append 한다', () => {
  const body = 코드만(section('function syncProfiles()', 'function dailyBackup()'));
  assert.ok(body.includes('퇴소사건필요_(userId, exitedIds, keep)'), '둘째 사건 규칙(학생 + 마지막 사건 이후)을 안 쓴다');
  assert.ok(!/if \(!exitedIds\.has\(String\(userId\)\)\) \{/.test(body), '옛 영구 차단(exitedIds 에 있으면 영영 건너뜀)이 되살아났다');
  const i가드 = body.indexOf("'동기화보류_상태'");
  const i쓰기 = body.indexOf('writeIfChanged(exitSh,');
  const i삭제 = body.indexOf('.forEach(rn => dst.deleteRow(rn))');
  assert.ok(i가드 !== -1 && i쓰기 !== -1 && i삭제 !== -1, '앵커를 못 찾았다');
  assert.ok(i가드 < i쓰기, '사건 기입이 급감 가드 «앞»에 있다 — 보류된 아침마다 같은 사건이 한 줄씩 는다');
  assert.ok(i쓰기 < i삭제, '사건 기입이 행 삭제 «뒤»에 있다 — 사이에서 죽으면 사건이 사라진다(안 적힌 사건은 못 되돌린다)');
  assert.ok(/퇴소사건\.push\(\[userId, row\[0\] \|\| '', row\[3\] \|\| '',\s*Utilities\.formatDate\([\s\S]*?'yyyy-MM-dd'\), tenureDays, '', '',\s*row\[1\] \|\| ''\]\)/.test(body),
    '사건 행이 8칸(종료사유·종료일 빈칸 · 끝에 이름_몽골 = 상담시트 B)이 아니다 — 폭이 다르면 writeIfChanged 가 다른 폭으로 쓴다');
  assert.ok(body.includes('퇴소본것[String(userId)]'), '같은 실행 안 중복 행(상담시트 중복 id) 방어가 없다');
});

/* ───────────────── ⑥ 드롭다운 여섯 · 500행 1회 ───────────────── */

test('⑥ 종료사유 목록 = 졸업·중도이탈·휴학·이사·미정·기타 여섯(결정.md 08-30) · 「늘리기만」 규약이 적혀 있다', () => {
  assert.deepEqual(EXIT_REASONS_, ['졸업', '중도이탈', '휴학', '이사', '미정', '기타']);
  assert.equal((code.match(/const EXIT_REASONS_ = \[/g) || []).length, 1, '목록이 두 곳이다');
  const 머리 = section('const EXIT_LOG_HEADERS = [', 'function exitLog시트_(');
  assert.ok(/늘리는 것은 안전하고/.test(머리) && /소급 마이그레이션/.test(머리), '「늘리기만 · 고치기 금지」 규약 주석이 없다');
  assert.ok(/비어 있으면 읽는 쪽은 퇴소감지일을 쓴다/.test(section('EXIT_KEEP_COLS_ = [', 'const EXIT_LOG_HEADERS')), '종료일 빈칸 규칙이 헤더 옆에 없다');
});

test('⑥ exitLog시트_ — 라이브 5칸 시트에 이름표 둘을 붙이고, 종료사유 열(6)에 여섯 값 드롭다운을 500행 «1회» 건다', () => {
  const sh = 시트흉내({ 첫행: 1, 행들: [['student_id', '이름', '반', '퇴소감지일', '재원일수'], ['SYNK-001', '바트', 'A', '2026-06-01', 30]] });
  const 검증 = [];
  const 원 = sh.getRange.bind(sh);
  Object.assign(sh, {
    getMaxColumns: () => 26, insertColumnsAfter: () => {}, insertRowsAfter: () => {},
    getRange: (r, c, n, w) => Object.assign(원(r, c, n, w), { setDataValidation: (rule) => { 검증.push({ r, c, n, rule }); } }),
  });
  const st = 시트흉내({ 첫행: 1, 행들: [['key', 'value']] });
  const ss = { getSheetByName: (n) => (n === 'exit_log' ? sh : n === 'app_state' ? st : null), insertSheet: () => { throw new Error('없는 시트를 만들었다'); } };
  const 규칙 = [];
  const SpreadsheetApp = { newDataValidation: () => ({
    requireValueInList: (list, dd) => { 규칙.push({ list: list.slice(), dd }); return { setAllowInvalid: (v) => { 규칙[규칙.length - 1].allow = v; return { build: () => 규칙[규칙.length - 1] }; } }; },
  }) };
  const { exitLog시트_ } = 불러오기(section('const EXIT_LOG_HEADERS = [', 'function exitLog기록자_('), ['exitLog시트_'], {
    SpreadsheetApp, ensureSheet: 유틸.ensureSheet, getState: 유틸.getState, setState: 유틸.setState,
    헤더보정_: 불러오기(section('function 헤더보정_(sh, HEADERS)', '/* 기존 hw_feedback'), ['헤더보정_'], {}).헤더보정_,
  });
  assert.equal(exitLog시트_(ss), sh);
  assert.deepEqual(sh.data[0], EXIT_LOG_HEADERS, '5칸 시트에 종료사유·종료일 이름표가 안 붙었다 — 새 칸이 조용히 버려진다');
  assert.deepEqual(sh.data[1].slice(0, 5), ['SYNK-001', '바트', 'A', sh.data[1][3], 30], '헤더 치유가 기존 행을 건드렸다');
  assert.equal(검증.length, 1);
  assert.deepEqual([검증[0].r, 검증[0].c, 검증[0].n], [2, 6, 500], '드롭다운이 종료사유 열(6) 2행부터 500행이 아니다');
  assert.deepEqual(규칙[0].list, EXIT_REASONS_);
  assert.equal(규칙[0].allow, true, '거부(setAllowInvalid false)면 기계가 빈 종료사유로 append 하는 행이 막힐 수 있다 — 경고만');
  assert.equal(유틸.getState(st, '퇴소사유검증판').val, 'v1');
  exitLog시트_(ss);
  assert.equal(검증.length, 1, '판이 같은데 검증을 다시 걸었다 — 매일 500행 setDataValidation 은 낭비다');
});
