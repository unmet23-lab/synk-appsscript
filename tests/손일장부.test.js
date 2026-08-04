// toil 장부 회귀 테스트. 실제 장부(docs/_ops/손일장부.md)는 건드리지 않는다.
//
// 지키려는 성질:
//   ① 주기 칸이 비면 기입을 **거부**한다 — 이 장부의 존재 이유가 주기다.
//      「없앤 손일」만 남으면 3년 뒤 「자동화 N종」이라는 숫자만 남고 그게 얼마나 아팠는지는 못 말한다.
//   ② 표를 깨뜨리는 입력('|')이 장부를 파싱 불가로 만들지 못한다.
//   ③ 새 행이 **표 안**에 들어간다(파일 끝이 아니라) — 아래 서술 문단이 있어도 안전해야 한다.
//   ④ bump-version --toil 의 형식 오류를 **채번 전에** 잡는다.
//      채번 뒤에 터지면 번호는 origin에 예약됐는데 기록은 없는 상태가 되고, 그 번호는 영영 빈다.
//   ⑤ rot-check 가 「기입 통로가 멈춤」을 임계 날짜로만 말하고 그 전에는 침묵한다.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'toil.js');
const T = require('../tools/toil.js');

// 표 아래에 서술 문단을 일부러 둔다 — 새 행이 파일 끝으로 가면 이 문단 뒤에 붙어 표가 끊긴다
const HEAD = [
  '# 손일 장부',
  '',
  '> 머리말이다. 손으로 고치지 않는다.',
  '',
  '| 버전 | 날짜 | 없앤 손일 | 주기 | 대체 장치 |',
  '|---|---|---|---|---|',
  '| v9.41 | 2026-07-23 | 번역 스크립트를 손으로 반복 실행 | 미상(소급) | 자동 배치 |',
  '| v9.175 | 2026-08-04 | 픽스처를 손으로 옮김 | 6개월 1회 | 저장소 직접 전송 |',
  '',
  '> 📌 위는 소급 기입이다.',
  '',
].join('\n');

function mkLedger() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'toil-')), '손일장부.md');
  fs.writeFileSync(f, HEAD, 'utf8');
  return f;
}

function run(ledger, args, expectFail = false) {
  try {
    return execFileSync(process.execPath, [TOOL, ...args], {
      encoding: 'utf8', stdio: 'pipe',
      env: { ...process.env, SYNK_TOIL_LEDGER: ledger },
    });
  } catch (e) {
    if (expectFail) return { failed: true, stderr: String(e.stderr || '') };
    throw e;
  }
}

const rowsOf = (ledger) =>
  fs.readFileSync(ledger, 'utf8').split('\n').filter((l) => /^\|\s*v\d+\.\d+\s*\|/.test(l.trim()));

test('add — 새 행이 표 안에 들어간다(아래 서술 문단 앞)', () => {
  const L = mkLedger();
  run(L, ['add', 'v9.180', '매주 출석표를 손으로 옮기던 일::주 1회::출석 폼 자동 집계']);
  const lines = fs.readFileSync(L, 'utf8').split('\n');
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3, '행이 하나 늘어야 한다');
  assert.ok(rows[2].includes('v9.180'));

  const lastRow = lines.findIndex((l) => l.includes('v9.180'));
  const note = lines.findIndex((l) => l.includes('📌'));
  assert.ok(lastRow > 0 && note > lastRow, '새 행은 서술 문단보다 **앞**에 있어야 표가 안 끊긴다');
});

test('주기 칸이 비면 거부한다 — 이 장부의 핵심 불변식', () => {
  const L = mkLedger();
  const r = run(L, ['add', 'v9.180', '무언가를 없앴다::::자동 배치'], true);
  assert.ok(r.failed, '주기가 비면 실패해야 한다');
  assert.strictEqual(rowsOf(L).length, 2, '거부됐으면 장부는 그대로여야 한다');
});

test('칸이 모자라면 거부한다 — 조용히 빈 칸으로 채우지 않는다', () => {
  const L = mkLedger();
  const r = run(L, ['add', 'v9.180', '없앤 손일만 적었다'], true);
  assert.ok(r.failed);
  assert.ok(/형식/.test(r.stderr), '무엇이 틀렸는지 알려야 한다');
  assert.strictEqual(rowsOf(L).length, 2);
});

test('버전 형식이 아니면 거부한다 — ID가 곧 버전이라 형식이 깨지면 행을 못 찾는다', () => {
  const L = mkLedger();
  const r = run(L, ['add', '9.180', 'a::b::c'], true);
  assert.ok(r.failed);
  assert.strictEqual(rowsOf(L).length, 2);
});

test("'|'가 든 입력이 표를 깨뜨리지 못한다", () => {
  const L = mkLedger();
  run(L, ['add', 'v9.181', '시트 A|B 열을 손으로 맞추던 일::월 1회::배치']);
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3);
  // 치환됐으면 셀 수는 그대로다(| 5개 = 셀 4칸 + 양끝)
  assert.strictEqual((rows[2].match(/\|/g) || []).length, 6, '셀 개수가 유지돼야 파서가 계속 읽는다');
});

test('parseSpec — 세 칸을 전부 요구하고 공백만인 칸도 거부한다', () => {
  assert.deepStrictEqual(
    T.parseSpec('손일::주 1회::배치'),
    { toil: '손일', cadence: '주 1회', device: '배치' }
  );
  assert.throws(() => T.parseSpec('손일::   ::배치'), /형식/);
  assert.throws(() => T.parseSpec(''), /형식/);
  assert.throws(() => T.parseSpec('a::b::c::d'), /형식/);
  // 회귀: 표 구분자가 든 설명은 **통과해야 한다**(구분자를 '|'로 두었을 때 정확히 여기가 깨졌다)
  assert.deepStrictEqual(
    T.parseSpec('시트 A|B 열을 맞추던 일::월 1회::배치'),
    { toil: '시트 A|B 열을 맞추던 일', cadence: '월 1회', device: '배치' }
  );
});

test('stats — 「미상(소급)」을 실측으로 세지 않는다', () => {
  // 실장부 실측에서 잡힌 결함: 완전일치로 세면 사유가 붙은 `미상(소급)`이 「잰 것」으로 분류된다.
  // 3년 뒤 "주기 실측 N건"이 거짓이 되는 자리라 접두 판정으로 못박는다.
  const rows = [
    { cadence: '주 1회' },
    { cadence: '미상' },
    { cadence: '미상(소급)' },
    { cadence: '  미상 — 이미 없애서 못 잼' },
    { cadence: '' },
  ];
  assert.deepStrictEqual(T.stats(rows), { total: 5, unknownCadence: 4, measured: 1 });
  assert.strictEqual(T.isUnknown('미상(소급)'), true);
  assert.strictEqual(T.isUnknown('월 1회'), false);
});

test('daysSinceLast — 마지막 날짜 기준, 빈 장부는 null(없음과 낡음을 가른다)', () => {
  const rows = [{ date: '2026-07-01' }, { date: '2026-08-04' }];
  assert.strictEqual(T.daysSinceLast(rows, new Date('2026-08-14T00:00:00')), 10);
  assert.strictEqual(T.daysSinceLast([], new Date('2026-08-14T00:00:00')), null,
    '한 줄도 없으면 「아직 안 쓰는 것」이지 부패가 아니다');
});

test('bump-version --toil — 형식 오류를 채번 전에 잡는다(git을 만지지 않는다)', () => {
  const B = require('../tools/bump-version.js');
  // 채번 로직에 닿으면 git fetch/tag가 돈다. 형식 오류는 그 앞에서 죽어야 한다.
  assert.throws(() => B.main(['--desc', 'x', '--toil', '주기가 없다::::배치']), /형식/,
    '채번 뒤에 터지면 번호는 예약됐는데 기록은 없는 상태가 된다');
});

test('rot-check toilSection — 임계 전에는 침묵, 넘으면 stale', () => {
  const R = require('../tools/rot-check.js');
  const L = mkLedger();

  const quiet = { ...process.env, SYNK_TOIL_LEDGER: L, SYNK_TOIL_IDLE_DAYS: '99999' };
  const loud = { ...process.env, SYNK_TOIL_LEDGER: L, SYNK_TOIL_IDLE_DAYS: '0' };

  const saved = { ...process.env };
  try {
    Object.assign(process.env, quiet);
    assert.strictEqual(R.toilSection().stale, false, '임계 안이면 조용해야 한다');
    Object.assign(process.env, loud);
    const s = R.toilSection();
    assert.strictEqual(s.stale, true, '임계를 넘으면 드러나야 한다');
    assert.strictEqual(s.count, 2);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test('장부가 없으면 부패가 아니다(present:false) — 없음과 낡음을 같은 모양으로 만들지 않는다', () => {
  const R = require('../tools/rot-check.js');
  const saved = process.env.SYNK_TOIL_LEDGER;
  try {
    process.env.SYNK_TOIL_LEDGER = path.join(os.tmpdir(), 'toil-없는파일-' + process.pid + '.md');
    assert.strictEqual(R.toilSection().present, false);
  } finally {
    if (saved === undefined) delete process.env.SYNK_TOIL_LEDGER; else process.env.SYNK_TOIL_LEDGER = saved;
  }
});
