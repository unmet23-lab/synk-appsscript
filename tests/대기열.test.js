/* 작업 대기열 — 차단자 표식 회귀.
 *
 * 이 검사가 지키는 것: **「열림」과 「지금 집을 수 있음」이 같은 모양이면 안 된다.**
 * 2026-08-12 실측 — 도구가 「열림 23」을 냈고 그중 지금 집을 수 있는 것은 3건뿐이었다. 나머지 20은
 * 유호님 답·선행·재료 0·시점·남의 점유로 **열자마자 막히는** 줄인데, 그 차이가 어디에도 안 보여
 * 새 세션이 P0 부터 차례로 열어 보다 시간을 태웠다(F368 과 같은 병 — 죽은 줄과 산 줄이 같은 모양).
 *
 * 탐지력은 픽스처가 진다. 실저장소에는 거짓양성만 검사한다(CLAUDE.md 가드 3맹점 ②).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 큐 = require(path.join(ROOT, 'tools', '대기열.js'));

// ───────────────────────────────── 탐지력 (픽스처)

test('🔑 표식을 읽는다 — 〖지금〗은 빈 문자열, 나머지는 그 차단자 이름', () => {
  assert.strictEqual(큐.차단('〖지금〗 **무엇** 어쩌고'), '');
  assert.strictEqual(큐.차단('〖⏳유호〗 **무엇** 어쩌고'), '⏳유호');
  assert.strictEqual(큐.차단('〖⛔선행〗 **무엇**'), '⛔선행');
  assert.strictEqual(큐.차단('〖 남이점유 〗 **무엇**'), '남이점유', '표식 안쪽 공백은 다듬어 읽는다');
});

test('☠️ 미표기는 null 이다 — 「모름」을 「지금 집을 수 있음」으로 세면 집으라고 부르고 그 자리에서 막힌다', () => {
  assert.strictEqual(큐.차단('**표식 없는 줄** 어쩌고'), null);
  assert.notStrictEqual(큐.차단('**표식 없는 줄**'), '', '미표기가 「지금 가능」과 같은 값이면 이 검사 전체가 무의미하다');
  assert.strictEqual(큐.차단(''), null);
  assert.strictEqual(큐.차단(null), null, '본문이 사라져도 「지금 가능」으로 떨어지면 안 된다');
});

test('☠️ 표식은 **줄머리에서만** 인정한다 — 본문 어딘가의 〖…〗 를 세면 남의 인용이 차단자가 된다', () => {
  assert.strictEqual(큐.차단('**무엇** — 앞선 줄이 〖지금〗 이라고 적었다'), null);
});

test('🔑 씨앗이 표식을 벗긴다 — 안 벗기면 제목이 밀려 보드 대조(누가 잡았나)가 통째로 어긋난다', () => {
  const 표식있음 = 큐.씨앗('〖⏳유호〗 **라디오24 Lane B — c11 소개정**');
  const 표식없음 = 큐.씨앗('**라디오24 Lane B — c11 소개정**');
  assert.strictEqual(표식있음, 표식없음);
  assert.ok(!표식있음.includes('⏳'), `씨앗에 표식이 남았다: ${표식있음}`);
});

test('🔑 굵은 제목이 없는 줄도 표식을 벗긴 뒤 자른다', () => {
  assert.ok(!큐.씨앗('〖지금〗 굵게 안 쓴 일감 줄이다').includes('〖'));
});

// ───────────────────────────────── 실저장소 (거짓양성만)

test('☠️ 열린 항목 전량이 차단자 표식을 갖는다 — 미표기는 「지금 가능」과 갈리지 않아 조용히 샌다', () => {
  const 전체 = 큐.항목들();
  if (전체 === null) { assert.fail('대기열 파일을 못 읽었다 — 검사가 0건을 돌고 초록을 내면 안 된다'); }
  assert.ok(전체.length > 0, '열린 항목이 0이다 — 분모 없는 초록이라 통과로 세지 않는다(F207)');

  const 미표기 = 전체.filter((it) => 큐.차단(it.본문) === null);
  assert.deepStrictEqual(
    미표기.map((it) => 큐.씨앗(it.본문)), [],
    `표식 없는 줄 ${미표기.length}/${전체.length}건 — `
    + `\`- [ ] \` 뒤에 〖${큐.집을수있음}〗·〖⏳유호〗·〖⛔선행〗·〖재료0〗·〖⏸시점〗·〖남이점유〗 중 하나를 단다`,
  );
});

test('🔑 분모를 함께 읽는다 — 열림 전량이 「지금 가능」이면 그건 표식이 아니라 기본값이 박힌 것이다', () => {
  const 전체 = 큐.항목들() || [];
  if (전체.length < 3) return;   // 줄이 몇 개 없으면 이 대조는 뜻이 없다
  const 지금 = 전체.filter((it) => 큐.차단(it.본문) === '');
  assert.notStrictEqual(지금.length, 전체.length,
    '열린 항목 전부가 〖지금〗 이다 — 표식이 판정이 아니라 붙여넣기가 됐을 때의 모양이다');
});

/* ── 집기 (F415) — 「재기 전에 선언한다」 손잡이 ────────────────────────────────
 *
 * 이 절이 지키는 것은 셋이고, 그중 첫째가 급소다:
 *   ① **디스크를 안 만진다** — 이 손잡이가 보드 파일을 직접 쓰면 `board-guard`(PreToolUse: Write)가
 *      안 돌아 겹침 판정이 통째로 우회된다. 그때의 증상은 적색이 아니라 **「선언이 잘 됐다」**라
 *      회귀가 아니면 아무도 못 본다. 그래서 픽스처 뿌리에서 CLI 를 돌리고 **보드 폴더가 그대로
 *      비어 있는지**를 잰다(로직만 require 하면 CLI·표준출력·파일 접촉을 다 건너뛴다 · 디자인가드 규약).
 *   ② 조인 키 `#Qnn` 은 **안 잘린다** — 제목이 아무리 길어도. 잘리면 점유 판정 ⓪이 눈이 먼다.
 *   ③ 상한은 board-guard 에서 **파생**한다 — 값을 두 곳에 적으면 갈라진다. */
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

/** 픽스처 뿌리 — 대기열 1줄 + 빈 보드 폴더. 실저장소를 안 건드린다. */
function 픽스처뿌리(줄) {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-큐집기-'));
  fs.mkdirSync(path.join(뿌리, 'docs', '_ops', '보드'), { recursive: true });
  fs.writeFileSync(path.join(뿌리, 'docs', '_ops', '작업대기열.md'), `## P1 무엇\n\n${줄}\n`, 'utf8');
  return 뿌리;
}
const 집기CLI = (뿌리, ...args) => execFileSync(process.execPath, [path.join(ROOT, 'tools', '대기열.js'), ...args], {
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: 뿌리, CLAUDE_CODE_HOST_SESSION_ID: 'local_abcd1234-zz' },
});
const 픽스처줄 = '- [ ] 〖지금〗 #Q99 **픽스처 일감** 어쩌고';

test('☠️ 집기는 보드 파일을 **안 쓴다** — 쓰면 board-guard 가 안 돌아 겹침 판정이 통째로 우회된다', () => {
  const 뿌리 = 픽스처뿌리(픽스처줄);
  const out = 집기CLI(뿌리, '--집기', '#Q99', '--파일', '`a.js` · talk 0');
  assert.match(out, /#Q99/, '조립한 줄이 안 나왔다');
  assert.deepStrictEqual(fs.readdirSync(path.join(뿌리, 'docs', '_ops', '보드')), [],
    '보드 폴더에 파일이 생겼다 — 이 손잡이가 프린터가 아니라 라이터가 됐다(가드 우회)');
});

test('🔑 조인 키 `#Qnn` 은 제목이 아무리 길어도 안 잘린다 (자르면 점유 판정 ⓪이 눈이 먼다)', () => {
  const 상한 = 큐.칸상한().값;
  const 항목 = { id: 99, 층: 'P1 무엇', 줄번호: 3, 본문: `〖지금〗 #Q99 **${'가'.repeat(2000)}**(꼬리)` };
  const 칸 = 큐.트랙칸(항목, 상한);
  assert.ok(칸.length <= 상한, `트랙 칸이 ${칸.length}자로 상한 ${상한} 을 넘었다 — board-guard 가 막는다`);
  assert.ok(칸.startsWith('**#Q99 '), `조인 키가 맨 앞에 없다: ${칸.slice(0, 20)}`);
  assert.ok(칸.includes('줄3'), '줄 참조(점유 신호 ②)가 사라졌다');
});

test('🔑 칸 상한은 board-guard 에서 **파생**한다 — 값을 두 곳에 적으면 갈라진다', () => {
  const r = 큐.칸상한();
  assert.strictEqual(r.출처, 'board-guard', `상한을 그 훅에서 못 읽었다(${r.출처}) — 폴백은 조용히 갈라진다`);
  assert.ok(r.값 > 0);
});

test('☠️ 이미 남이 잡은 줄은 **거절**한다 — 이 손잡이가 겹침을 부르는 통로가 되면 안 된다', () => {
  const 뿌리 = 픽스처뿌리(픽스처줄);
  fs.writeFileSync(path.join(뿌리, 'docs', '_ops', '보드', 'ffff0000.md'),
    ['# 보드 — ffff0000', '', '| 날짜 | 트랙 | 만질 파일 | 상태/다음 |', '|---|---|---|---|',
      '| 2026-08-14 | **#Q99 남의 트랙** | `a.js` · 이 줄 | 작업중 (`local_ffff0000`) |', ''].join('\n'), 'utf8');
  assert.throws(() => 집기CLI(뿌리, '--집기', '#Q99', '--파일', '`a.js`'),
    (e) => /이미 남이 잡았다/.test(String(e.stdout || '')), '남이 잡은 줄을 그대로 조립해 줬다');
});

test('☠️ `--파일` 이 비면 거절한다 — 빈 「만질 파일」 칸은 점유 판정 ③을 눈멀게 한다', () => {
  const 뿌리 = 픽스처뿌리(픽스처줄);
  assert.throws(() => 집기CLI(뿌리, '--집기', '#Q99'),
    (e) => /필요하다/.test(String(e.stdout || '')), '파일 칸 없이 줄을 조립해 줬다');
});

test('🔑 없는 번호는 열린 번호를 함께 알린다 (조용한 0건 금지)', () => {
  const 뿌리 = 픽스처뿌리(픽스처줄);
  assert.throws(() => 집기CLI(뿌리, '--집기', '#Q1', '--파일', 'x'),
    (e) => /열린 것: #Q99/.test(String(e.stdout || '')), '없는 번호에 대안을 안 준다');
});
