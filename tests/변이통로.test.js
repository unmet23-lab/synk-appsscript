/* 변이 공용 통로 회귀 — 「변이 N/N」이 **검증된 숫자**인지 지킨다 (F477 · F470 · 그 앞 3건).
 *
 * 이 회귀가 지키는 불변식은 하나다: **미적용·미측정은 판정이 아니다.**
 * 다섯 번의 사고가 전부 「안 쟀다」를 「통과」·「구멍」 중 하나로 접어서 났고, 접힌 쪽은
 * 언제나 초록이라 눈에 안 띄었다. 그래서 여기서 못박는 것은 «세 번째 칸이 살아 있는가» 다.
 *
 *   ① 탐지력은 **픽스처가 진다** — 임시 소스·임시 시험을 만들어 그 위에서 잰다.
 *      실저장소엔 거짓양성 검사만 건다(맹점 ② — 버그가 아직 있을 것을 요구하는 회귀 금지).
 *   ② **사람이 실제로 쓰는 표기로** 검사한다(맹점 ①) — 이 저장소 작업본은 CRLF 다
 *      (`core.autocrlf=true` · 추적 .js 72중 CRLF 63 · 순LF 0). 그래서 CRLF 픽스처가 기준판이고
 *      LF 는 곁가지다. 반대로 깔면 F477 을 재현조차 못 한다.
 *   ③ **자기 처방을 막지 않는다**(F103) — 통로가 시키는 대로 쓴 변이는 실제로 적용돼야 한다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 변이 = require(path.join(__dirname, '..', 'tools', '변이.js'));

/* ── 픽스처 ──────────────────────────────────────────────────────────────
 * 사람이 실제로 쓰는 모양 그대로다 — 줄끝을 인자로 받아 **같은 내용의 CRLF/LF 두 판**을 만든다.
 * 그래야 「LF 에선 되는데 CRLF 에선 조용히 안 되던」 그 자리가 분모에 들어온다. */
function 픽스처(eol) {
  return ['function 문턱(n) {', '  if (n > 10) {', '    return "초과";', '  }', '  return "정상";', '}', 'module.exports = { 문턱 };', ''].join(eol);
}

function 판만들기(eol, { 시험내용 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '변이통로-'));
  const 소스 = path.join(dir, '대상.js');
  const 시험 = path.join(dir, '대상.test.js');
  fs.writeFileSync(소스, 픽스처(eol));
  fs.writeFileSync(시험, 시험내용 || [
    "const t = require('node:test'); const a = require('node:assert');",
    `const { 문턱 } = require(${JSON.stringify(소스)});`,
    "t.test('초과를 잡는다', () => { a.strictEqual(문턱(11), '초과'); });",
    "t.test('정상을 통과시킨다', () => { a.strictEqual(문턱(1), '정상'); });",
    '',
  ].join('\n'));
  return { dir, 소스, 시험 };
}

const 치우기 = (dir) => fs.rmSync(dir, { recursive: true, force: true });

/* ── ㉠ 조용한 미적용: 이 통로의 존재 이유 ────────────────────────────── */

test('CRLF 소스에 `\\n` 찾기를 줘도 적용된다 — F477 이 난 바로 그 자리', () => {
  const 원문 = 픽스처('\r\n');
  const r = 변이.적용(원문, 'if (n > 10) {\n    return "초과";', 'if (n > 999) {\n    return "초과";');
  assert.strictEqual(r.상태, '적용', '호출부는 늘 \\n 으로 쓴다 — 줄끝 번역은 통로가 진다');
  assert.notStrictEqual(r.변이본, 원문, '적용이라 했으면 바이트가 반드시 달라야 한다');
  assert.ok(r.변이본.includes('n > 999'), '실제로 그 자리가 바뀌어야 한다');
  assert.ok(/\r\n/.test(r.변이본), '원본의 줄끝(CRLF)이 보존돼야 한다 — 안 그러면 파일 전체가 변이가 된다');
});

test('LF 소스에서도 같은 찾기가 그대로 먹는다 — 호출부가 줄끝을 몰라도 된다', () => {
  const r = 변이.적용(픽스처('\n'), 'if (n > 10) {', 'if (n > 999) {');
  assert.strictEqual(r.상태, '적용');
  assert.ok(!/\r/.test(r.변이본), 'LF 판에 CR 을 들여오면 안 된다');
});

test('못 찾으면 «적용» 이 아니라 «못찾음» 이다 — 통과로 접히는 순간이 사고다', () => {
  const r = 변이.적용(픽스처('\r\n'), '있지도 않은 문자열', '무엇이든');
  assert.strictEqual(r.상태, '못찾음');
  assert.strictEqual(r.변이본, undefined, '못 찾았으면 변이본을 만들면 안 된다');
});

test('두 곳 이상 맞으면 «모호» — 어디를 망가뜨렸는지 모른 채 나온 숫자는 측정이 아니다', () => {
  const r = 변이.적용(픽스처('\r\n'), 'return', '반환');
  assert.strictEqual(r.상태, '모호');
  assert.ok(r.횟수 >= 2, `실제로 여러 번 맞아야 이 검사가 뜻이 있다 (횟수=${r.횟수})`);
});

test('찾기와 바꾸기가 같으면 «모호» — 바이트가 안 변한 판을 초록으로 세지 않는다', () => {
  const r = 변이.적용(픽스처('\r\n'), 'if (n > 10) {', 'if (n > 10) {');
  assert.strictEqual(r.상태, '모호');
});

test('줄끝 판정이 실제 파일 모양을 따른다', () => {
  assert.strictEqual(변이.줄끝(픽스처('\r\n')), '\r\n');
  assert.strictEqual(변이.줄끝(픽스처('\n')), '\n');
});

/* ── ㉡ 세는 층 / ㉢ 0건 실행 ──────────────────────────────────────────── */

test('분모를 못 뽑으면 0 이 아니라 null — 「모름」과 「0」은 다른 상태다', () => {
  const r = 변이.분모뽑기('아무 요약도 없는 출력');
  assert.strictEqual(r.전체, null);
  assert.strictEqual(r.실패, null);
});

test('TAP 요약에서 분모와 실패 이름을 뽑는다 — 판정이 아니라 이름·분모 전용', () => {
  const r = 변이.분모뽑기(['not ok 1 - 초과를 잡는다', '# tests 2', '# pass 1', '# fail 1'].join('\n'));
  assert.strictEqual(r.전체, 2);
  assert.strictEqual(r.실패, 1);
  assert.deepStrictEqual(r.실패이름, ['초과를 잡는다']);
});

/* ③의 실제 얼굴은 「0건 실행」이 아니라 **「전부 skip」**이다 — 실측 2026-08-15에서 배웠다.
 * skip 은 `# tests` 분모에 그대로 세므로(통과1+skip1 → tests=2) 전체만 보면 정상과 구별이 안 된다.
 * 사고 원문: 「변이시험 사본은 git init 안 하면 skip」 — 재료가 없어 통째로 건너뛴 판이 초록이었다. */
test('전부 skip 은 «미측정» 이다 — exit 0 · 분모도 정상이라 통과와 모양이 완전히 같다(F207)', () => {
  const { dir, 시험 } = 판만들기('\r\n');
  try {
    const 정상 = 변이.시험돌리기([시험], {});
    assert.strictEqual(정상.미측정, null, '멀쩡한 판을 미측정이라 하면 이 통로는 하루 만에 꺼진다(F103)');

    const 스킵판 = 판만들기('\r\n', {
      시험내용: [
        "const t = require('node:test'); const a = require('node:assert');",
        "t.test('가', { skip: '재료가 없다' }, () => { a.ok(1); });",
        "t.test('나', { skip: '재료가 없다' }, () => { a.ok(1); });",
        '',
      ].join('\n'),
    });
    try {
      const r = 변이.시험돌리기([스킵판.시험], {});
      assert.strictEqual(r.상태코드, 0, '전제 확인 — 전부 skip 은 exit 0 이다(그래서 위험하다)');
      assert.ok(r.전체 > 0, `전제 확인 — skip 도 분모에 센다(전체=${r.전체})`);
      assert.ok(r.미측정, '통과 0 · 실패 0 이면 아무것도 검증되지 않았다 — 초록으로 접으면 ③이 재발한다');
    } finally { 치우기(스킵판.dir); }
  } finally { 치우기(dir); }
});

/* ── 미측정 판정 그 자체 ───────────────────────────────────────────────
 * 이 두 칸은 **자기변이가 뚫고 나온 구멍**이다(M8·M10 — 1차 실행에서 「구멍 2」로 나왔다).
 * 판정이 `시험돌리기` 안에 박혀 있어 spawn 시나리오를 꾸미지 않고는 못 쟀다 — 순수 함수로
 * 떼어내고서야 물렸다. 「못 재는 자리」를 남겨 두면 그 자리는 영원히 초록이다. */

const 정상요약 = { 전체: 2, 통과: 2, 실패: 0, 건너뜀: 0, 실패이름: [] };

test('exit 과 TAP 이 어긋나면 미측정 — 판정층과 세는층 중 어느 쪽도 못 믿는다 (자기변이 M8)', () => {
  const r = 변이.미측정판정({ 적색: true, 상태코드: 1, 오류: null, 요약: { ...정상요약, 통과: 2, 실패: 0 } });
  assert.ok(r, 'exit≠0 인데 실패 0건이면 시험 밖에서 죽은 것이다 — 포획으로 세면 거짓 숫자가 된다');
  assert.match(r, /시험 밖에서 죽었다/);

  const 거꾸로 = 변이.미측정판정({ 적색: false, 상태코드: 0, 오류: null, 요약: { ...정상요약, 통과: 1, 실패: 1 } });
  assert.ok(거꾸로, 'exit=0 인데 실패가 잡히는 반대 방향도 같은 무게로 막는다');
});

test('멀쩡한 판을 미측정이라 하지 않는다 — 따를 수 없는 경보는 꺼진다(F103)', () => {
  assert.strictEqual(변이.미측정판정({ 적색: false, 상태코드: 0, 오류: null, 요약: 정상요약 }), null);
  assert.strictEqual(
    변이.미측정판정({ 적색: true, 상태코드: 1, 오류: null, 요약: { 전체: 2, 통과: 1, 실패: 1, 건너뜀: 0, 실패이름: ['가'] } }),
    null, '변이가 잡혀 빨개진 정상적인 포획 판이다',
  );
  assert.strictEqual(
    변이.미측정판정({ 적색: true, 상태코드: 1, 오류: null, 요약: { 전체: 2, 통과: 0, 실패: 2, 건너뜀: 0, 실패이름: ['가', '나'] } }),
    null, '변이가 전 검사를 빨갛게 만든 판도 통과 0 이지만 정당한 포획이다 — 통과 0 «만» 으로 접으면 안 된다',
  );
});

test('기준선이 미측정이면 변이를 한 건도 안 돌린다 (자기변이 M10)', () => {
  const { dir, 소스 } = 판만들기('\r\n');
  try {
    /* 시험 경로 오타 — 가장 흔한 실제 모양이다. 시험이 한 건도 안 돌았는데 변이를 계속 돌면
     * 「전부 구멍」이라는 새빨간 거짓 숫자가 나온다(㉢ 계열).
     * ⚠ NODE_TEST_CONTEXT 를 심는 방식은 여기서 못 쓴다 — `시험돌리기` 가 그걸 **언제나 지우기**
     *   때문이다(그게 이 통로의 계약이다). 조건을 심을 수 없다는 사실 자체가 그 계약의 증거다. */
    assert.throws(
      () => 변이.변이검사({
        시험: [path.join(dir, '없는시험.test.js')], 조용히: true,
        변이들: [{ 이름: 'a', 파일: 소스, 찾기: 'n > 10', 바꾸기: 'n > 999' }],
      }),
      /기준선이 미측정이다/,
      '기준선을 못 쟀으면 그 판의 모든 숫자가 무의미하다 — 변이를 도는 것 자체가 거짓 숫자를 만든다',
    );
  } finally { 치우기(dir); }
});

/* ── 통합: 세 칸이 각각 제 판정을 받는가 ──────────────────────────────── */

test('포획·구멍·미적용이 각각 제 칸으로 간다 — 두 갈래로 접히지 않는다', () => {
  const { dir, 소스, 시험 } = 판만들기('\r\n');
  try {
    const r = 변이.변이검사({
      시험: [시험],
      조용히: true,
      변이들: [
        { 이름: '문턱을 올린다(회귀가 잡아야 한다)', 파일: 소스, 찾기: 'n > 10', 바꾸기: 'n > 999' },
        { 이름: '아무도 안 보는 자리(구멍)', 파일: 소스, 찾기: 'module.exports', 바꾸기: 'globalThis.안봄 = 1; module.exports' },
        { 이름: '안 맞는 찾기(미적용)', 파일: 소스, 찾기: '없는문자열', 바꾸기: 'x' },
      ],
    });
    assert.strictEqual(r.포획, 1, '문턱 변이는 회귀가 빨개져야 한다');
    assert.strictEqual(r.구멍, 1, '아무 검사도 안 보는 변이는 구멍으로 나와야 한다');
    assert.strictEqual(r.미적용, 1, '안 맞은 건은 포획도 구멍도 아니다');
    assert.strictEqual(r.분모, 3, '세 칸의 합이 분모다');
    const 포획줄 = r.줄들.find((x) => x.판정 === '포획');
    assert.ok(포획줄.빨개진검사.length > 0, '어느 검사가 빨개졌는지 이름으로 남아야 한다(건수만 세면 다른 이유와 구별이 안 된다)');
  } finally { 치우기(dir); }
});

test('변이 뒤 소스가 바이트까지 원복된다', () => {
  const { dir, 소스, 시험 } = 판만들기('\r\n');
  const 원본 = fs.readFileSync(소스);
  try {
    변이.변이검사({
      시험: [시험], 조용히: true,
      변이들: [{ 이름: 'a', 파일: 소스, 찾기: 'n > 10', 바꾸기: 'n > 999' }],
    });
    assert.deepStrictEqual(fs.readFileSync(소스), 원본, '변이본이 남으면 다음 세션이 그걸 진짜 코드로 읽는다');
  } finally { 치우기(dir); }
});

test('기준선이 적색이면 변이를 한 건도 안 돌리고 멈춘다 — 그 판의 숫자는 이미 무의미하다', () => {
  const { dir, 소스, 시험 } = 판만들기('\r\n', {
    시험내용: ["const t = require('node:test'); const a = require('node:assert');", "t.test('원래 빨간 검사', () => { a.strictEqual(1, 2); });", ''].join('\n'),
  });
  try {
    assert.throws(
      () => 변이.변이검사({ 시험: [시험], 조용히: true, 변이들: [{ 이름: 'a', 파일: 소스, 찾기: 'n > 10', 바꾸기: 'n > 999' }] }),
      /기준선이 이미 적색/,
      '기준선을 같은 통로로 돌리는 것이 「세는 층이 죽었다」의 유일한 탐지기다',
    );
  } finally { 치우기(dir); }
});

test('미적용이 있으면 보고가 «N/N» 을 만들지 않는다 — 분모가 거짓말하는 표기를 원천에서 없앤다', () => {
  const { dir, 소스, 시험 } = 판만들기('\r\n');
  const 찍힌것 = [];
  const 원래 = console.log;
  console.log = (s) => 찍힌것.push(String(s));
  try {
    변이.변이검사({
      시험: [시험],
      변이들: [
        { 이름: '잡히는 것', 파일: 소스, 찾기: 'n > 10', 바꾸기: 'n > 999' },
        { 이름: '안 맞는 것', 파일: 소스, 찾기: '없는문자열', 바꾸기: 'x' },
      ],
    });
  } finally { console.log = 원래; 치우기(dir); }
  const 보고 = 찍힌것.join('\n');
  assert.ok(/미적용 1/.test(보고), '미적용 건수를 반드시 드러내야 한다');
  assert.ok(!/변이 1\/1/.test(보고), '미적용이 있는데 「1/1」로 적으면 그게 F477 이 난 모양 그대로다');
});

/* ── 실저장소: 거짓양성만 ─────────────────────────────────────────────── */

test('실저장소 — 통로가 로드되고 공개 면이 그대로 있다(거짓양성 검문만)', () => {
  for (const 이름 of ['변이검사', '적용', '맞춰보기', '줄끝', '시험돌리기', '분모뽑기']) {
    assert.strictEqual(typeof 변이[이름], 'function', `${이름} 이 공개 면에서 사라지면 호출부가 조용히 옛 손하네스로 되돌아간다`);
  }
});

test('계획이 스스로 돌면 CLI 가 이름을 대고 막는다 — 맞는 판이 실패로 읽히던 자리', () => {
  /* 🔴 2026-08-15 실측. 머리말 「쓰는 법」은 계획 안에서 `변이검사()` 를 부르라고 가르쳤는데
     CLI 는 `module.exports` 를 기대한다 — 한 파일에 계약이 둘 있었다. 그 모양으로 돌리면
     계획을 require 할 때 제대로 돌아 **「변이 8/8」이 멀쩡히 찍히고**, 그 뒤 CLI 가 빈 계획으로
     또 불러 스택 트레이스가 붙는다. 숫자는 맞는데 화면이 틀린 자리라, 읽는 사람은 그 판을
     실패로 접는다 — 그게 이 통로가 없애려던 바로 그 오독이다. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '변이계획-'));
  const 계획 = path.join(dir, '자기호출계획.js');
  fs.writeFileSync(계획, "'use strict';\n// exports 없이 아무것도 안 내놓는 계획\n");
  try {
    const r = require('node:child_process').spawnSync(process.execPath,
      [path.join(__dirname, '..', 'tools', '변이.js'), 계획], { encoding: 'utf8' });
    assert.notStrictEqual(r.status, 0, '빈 계획인데 0 으로 끝났다 — 미측정이 통과로 접힌다');
    const 말 = `${r.stderr || ''}${r.stdout || ''}`;
    assert.match(말, /변이검사/, '무엇이 잘못됐는지(계획이 스스로 부른다) 이름을 안 댄다');
    assert.equal(/at Object\.<anonymous>/.test(말), false,
      '스택 트레이스로 죽는다 — 사용자는 이걸 「변이가 실패했다」로 읽는다');
  } finally { 치우기(dir); }
});

test('머리말 「쓰는 법」이 CLI 와 같은 계약을 가르친다 — 계약이 둘이면 갈라진다', () => {
  const 소스 = fs.readFileSync(path.join(__dirname, '..', 'tools', '변이.js'), 'utf8');
  const 머리말 = 소스.slice(0, 소스.indexOf('*/') + 2);
  assert.match(머리말, /module\.exports\s*=/, '머리말이 exports 형을 안 가르친다');
  assert.equal(/^\s*\*\s*변이검사\(\{/m.test(머리말), false,
    '머리말이 아직 「계획 안에서 변이검사() 를 부르라」고 가르친다 — CLI 계약과 갈라진다');
});
