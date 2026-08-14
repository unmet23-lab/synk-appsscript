/* 뉴스적재 회귀 — `tools/뉴스적재.js`.
 *
 * 무엇을 지키나 (유호 확정 2026-08-12 「수신자 교체」):
 *   BootBrief 의 출구를 텔레그램에서 바탕화면 누적 로그로 옮겼다. 이 통로가 조용히 망가지면
 *   증상은 **「파일이 안 늘어난다」 하나뿐**이고, 예약 작업 로그는 그래도 `OK` 를 찍는다
 *   (옛 구조가 정확히 그 모양이었다 — 6번 `OK` 인데 읽은 사람 0명).
 *
 * 분모: 이 파일이 지는 몫은 셋이다.
 *   ① 순수 로직(가르기·합치기·구획만들기·줄끝·로그찾기) — **픽스처가 탐지력을 진다.**
 *   ② 왕복 — 임시 폴더에 실제로 두 번 적재해 「위가 최신 · 아래가 안 사라짐」을 확인한다.
 *   ③ repo 밖(진짜 바탕화면) — CI 에선 **skip 으로 드러낸다.** fail 이 아니다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const M = require('../tools/뉴스적재.js');
const { 줄끝, 시각표기, 구획만들기, 가르기, 합치기, 로그찾기, 로그이름, 머리 } = M;

/* ── ① 순수 로직 ─────────────────────────────────────────────── */

test('줄끝: CRLF 가 하나라도 있으면 CRLF 로 판정한다(F046 과 같은 함정)', () => {
  assert.strictEqual(줄끝('a\nb\n'), '\n');
  assert.strictEqual(줄끝('a\r\nb\n'), '\r\n');
  assert.strictEqual(줄끝(''), '\n');
  assert.strictEqual(줄끝(null), '\n');
});

test('시각표기: 요일까지 한국어로 붙인다', () => {
  // 2026-08-12 는 수요일
  assert.strictEqual(시각표기(new Date(2026, 7, 12, 9, 5)), '2026-08-12 (수) 09:05');
  assert.strictEqual(시각표기(new Date(2026, 7, 16, 23, 59)), '2026-08-16 (일) 23:59');
});

test('구획만들기: 요약이 비어도 조용한 빈 구획을 만들지 않는다', () => {
  const c = 구획만들기('2026-08-12 (수) 09:05', '   ', '');
  assert.match(c, /요약 없음/);
  assert.ok(!/### 원시/.test(c), '원시가 없으면 원시 절도 없다');
});

test('구획만들기: 원시를 요약과 함께 남긴다(설계 ②)', () => {
  const c = 구획만들기('2026-08-12 (수) 09:05', '- 비자 정책 바뀜', '- 제목A :: http://a\n- 제목B :: http://b');
  assert.match(c, /^---\n/);
  assert.match(c, /## 2026-08-12 \(수\) 09:05/);
  assert.match(c, /- 비자 정책 바뀜/);
  assert.match(c, /### 원시/);
  assert.match(c, /제목B :: http:\/\/b/);
});

test('가르기: 머리와 구획을 첫 `---` 에서 가른다', () => {
  const 파일 = 머리 + 구획만들기('t1', 'A', '') + 구획만들기('t2', 'B', '');
  const { 머리: h, 구획들 } = 가르기(파일);
  assert.match(h, /# SYNK 시장 뉴스/);
  assert.strictEqual(구획들.length, 2);
  assert.match(구획들[0], /## t1/);
  assert.match(구획들[1], /## t2/);
});

test('가르기: 구획이 없는(머리만 있는) 파일도 안 깨진다', () => {
  const { 머리: h, 구획들 } = 가르기(머리);
  assert.strictEqual(구획들.length, 0);
  assert.match(h, /# SYNK 시장 뉴스/);
});

test('합치기: 새 구획이 맨 위에 오고 옛 구획은 순서대로 아래에 남는다', () => {
  let 파일 = 합치기('', 구획만들기('t1', 'A', ''), {}).내용;
  파일 = 합치기(파일, 구획만들기('t2', 'B', ''), {}).내용;
  파일 = 합치기(파일, 구획만들기('t3', 'C', ''), {}).내용;
  const { 구획들 } = 가르기(파일);
  assert.deepStrictEqual(구획들.map((c) => /## (t\d)/.exec(c)[1]), ['t3', 't2', 't1']);
  assert.strictEqual((파일.match(/# SYNK 시장 뉴스/g) || []).length, 1, '머리는 한 번만');
});

test('합치기: 상한을 넘기면 뒤에서 버리고 **버린 수를 돌려준다**(설계 ③ — 조용한 절단 금지)', () => {
  let 파일 = '';
  for (let i = 1; i <= 3; i += 1) 파일 = 합치기(파일, 구획만들기(`t${i}`, 'x', ''), { 상한: 3 }).내용;
  assert.strictEqual(가르기(파일).구획들.length, 3);

  const r = 합치기(파일, 구획만들기('t4', 'x', ''), { 상한: 3 });
  assert.strictEqual(r.버린수, 1, '넘친 1개를 버렸다고 말해야 한다');
  const 남은 = 가르기(r.내용).구획들.map((c) => /## (t\d)/.exec(c)[1]);
  assert.deepStrictEqual(남은, ['t4', 't3', 't2'], '가장 오래된 t1 이 빠진다');
});

test('합치기: 상한 안이면 버린수 0 (분모를 0 으로 오보하지 않는다)', () => {
  const r = 합치기(머리, 구획만들기('t1', 'x', ''), { 상한: 60 });
  assert.strictEqual(r.버린수, 0);
});

test('로그찾기: 번호를 뗀 이름으로 찾는다(운영자료가 번호를 다시 매겨도 새 파일을 안 만든다)', () => {
  assert.strictEqual(로그찾기(['01_기타.pdf', `07_${로그이름}`]), `07_${로그이름}`);
  assert.strictEqual(로그찾기([로그이름]), 로그이름);
  assert.strictEqual(로그찾기(['01_기타.pdf']), null);
});

/* ── ② 왕복: 실제 파일로 두 번 적재 ──────────────────────────── */

test('왕복: 두 번 적재해도 옛 구획이 사라지지 않고 줄끝이 보존된다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-뉴스-'));
  const 파일 = path.join(방, 로그이름);
  try {
    // 1회차 — 새 파일(CRLF 로 굽는다)
    const a = 합치기('', 구획만들기('2026-08-12 (수) 09:05', '- 첫날', '- 원시1 :: http://1'), {});
    fs.writeFileSync(파일, a.내용.replace(/\r?\n/g, '\r\n'), 'utf8');

    // 2회차 — 기존을 읽어 얹는다
    const 기존 = fs.readFileSync(파일, 'utf8');
    assert.strictEqual(줄끝(기존), '\r\n', '1회차가 CRLF 로 구워졌다');
    const b = 합치기(기존, 구획만들기('2026-08-13 (목) 09:05', '- 둘째날', ''), {});
    fs.writeFileSync(파일, b.내용.replace(/\r?\n/g, 줄끝(기존)), 'utf8');

    const 최종 = fs.readFileSync(파일, 'utf8');
    assert.strictEqual(줄끝(최종), '\r\n', '2회차가 줄끝을 안 갈아엎었다');
    assert.match(최종, /첫날/, '옛 구획이 살아 있다');
    assert.match(최종, /둘째날/);
    assert.match(최종, /원시1/, '원시도 살아 있다');
    const 순서 = 가르기(최종).구획들.map((c) => /## (\S+)/.exec(c)[1]);
    assert.deepStrictEqual(순서, ['2026-08-13', '2026-08-12'], '위가 최신');
  } finally {
    fs.rmSync(방, { recursive: true, force: true });
  }
});

/* ── ③ repo 밖: CI 에선 skip 으로 드러낸다 ───────────────────── */

test('예약 작업 스크립트가 텔레그램이 아니라 이 통로를 부른다', (t) => {
  const ps = path.join(os.homedir(), '.hermes', 'scripts', 'synk-boot-brief.ps1');
  if (!fs.existsSync(ps)) return t.skip(`repo 밖 스크립트가 없다(CI) — ${ps}`);
  const src = fs.readFileSync(ps, 'utf8');
  assert.match(src, /뉴스적재\.js/, 'BootBrief 가 적재 통로를 부른다');

  /* 🔴 **주석을 코드로 세지 않는다.** 첫 판은 글자만 봐서, 「옛 출구는 텔레그램이었다」고
   *    설명하는 주석 한 줄에 빨개졌다(실측). 판정은 **호출 형태**로 한다 —
   *    전체 줄 주석을 걷어낸 뒤, 호출 연산자가 붙은 것만 발송으로 인정한다. */
  /* ⚠ 대상은 **PowerShell 스크립트**다 — `코드만()`(JS 렉서)으로 감싸지 않는다(갈래 ⓒ 비JS · #Q72).
   *   PowerShell 주석은 `#` 이라 아래 한 줄이 그 몫을 진다(SQL·CSS 제거기를 안 합치는 것과 같은 갈래). */
  const 코드 = src.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.ok(
    !/&\s*\$hermes[^\n]*send\b/.test(코드),
    '텔레그램 발송이 남아 있으면 유호 확정(수신자 교체)과 어긋난다'
  );
  assert.match(코드, /&\s*\$node\s+\$tool/, '적재는 node 통로로 부른다');
  assert.ok(
    코드.indexOf('Set-Content $stamp') > 코드.indexOf('$tool'),
    '도장은 적재 뒤에 찍혀야 한다 — 앞에 찍으면 실패해도 12시간 동안 재시도가 막힌다'
  );
});
