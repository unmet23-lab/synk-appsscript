/* 보드낡음 회귀 — 「마감한 주인의 줄이 말하는 일감이 이미 끝났는지」를 기계가 대조한다 (F374).
 *
 * 앞선 두 벌이 **탐지**를 세웠다: F368 `tests/보드주인.test.js` 가 「주인이 없다」를,
 * `tests/보드수거.test.js` 가 「거두는 손」을. 남은 구멍은 **🎫 그 자체의 낡음**이었다 —
 * 실측 7건 중 2건이 이미 나간 일감인데 표에서는 산 것과 글자 하나 다르지 않았고, 처방은
 * 「직접 열어라」뿐이라 모든 세션이 같은 확인을 다시 했다(철학 ㉡ 이 금지하는 그 모양).
 *
 * 여기서 못박는 것 여섯:
 *   ① **증거지 판정이 아니다** — 문장에 「낡았다」가 없어야 한다. 저장소도 의도도 문구로는
 *      안 갈리므로(F374 함정 ①) 기계는 재료만 놓고 집을지는 사람이 정한다.
 *   ② **영수증 해시를 일감으로 세지 않는다** — 상태 칸 해시의 대부분은 주인이 «해낸 것»이라
 *      언제나 HEAD 조상이다. 안 자르면 13줄 중 11줄이 빨개졌다(첫 실행 실측) = 늘 참인 경고.
 *   ③ **「만지는 파일」 칸은 안 본다** — 거기 실재하는 건 정상이다. 넣으면 전 줄이 참이 된다.
 *   ④ **못 잼과 0건을 가른다**(F207·F364) — 형제 저장소 부재·장부 못 읽음은 「깨끗함」이 아니다.
 *   ⑤ **세션 지문은 커밋이 아니다** — `local_c52dcbed` 를 해시로 세면 지문마다 거짓 신호가 뜬다.
 *   ⑥ **탐지력은 픽스처가 진다** — 실저장소엔 거짓양성 불변식만 건다(가드 맹점 ②).
 *      실저장소가 「낡은 줄 N건」을 내야 한다고 요구하면 그 줄이 정리되는 날 회귀가 빨개진다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const 낡음 = require(path.join(REPO, 'tools', 'lib', '보드낡음.js'));
const 보드 = require(path.join(REPO, 'tools', 'lib', '보드.js'));

/* 사람이 실제로 쓰는 표기 그대로다(가드 맹점 ①) — 아래는 이 저장소에 실제로 났던 줄을 줄인 것. */
const 티켓줄 = '| 2026-08-12 | **⓪ 재검수→배포** | 검수 장부·Code.js | ✅재검수1 0건 · 🎫**다음=`--commit deadbee` 재검수**→배포 |';
const 신설줄 = '| 2026-08-11 | **G1 순수 로직 — `lib/멘탈게이지.js`(5칸 판정)** | **talk 신설만** + 회귀 | ▶**다음**(미착수) — 게이지=연출 |';
const 영수증줄 = '| 2026-08-12 | **철학 ㉠ 폐번** | docs/SYNK_철학.md | ▶작업중 (`local_528aebb5`) — ✅v1.5 `deadbee` · ▶다음=훅 정리 제안 판정 대기 |';

function 임시작업공간() {
  const 밖 = fs.mkdtempSync(path.join(os.tmpdir(), 'board-stale-'));
  const as = path.join(밖, 'SYNK-appsscript');
  fs.mkdirSync(path.join(as, 'docs', '_ops'), { recursive: true });
  return { 밖, as };
}

/** 형제 저장소를 «있게» 만든다 — 없을 때(못잼)와 갈라 재려면 두 모양이 다 필요하다. */
function 형제세우기(밖) {
  const talk = path.join(밖, 'SYNK-talk');
  fs.mkdirSync(path.join(talk, 'lib'), { recursive: true });
  return talk;
}

/* ── ① 경로 — 「그 파일이 이미 있는가」 ─────────────────────────── */

test('☠️ 신설 일감이 말하는 경로가 형제에 **이미 있으면** 증거로 낸다 (실측 de44763a 자리)', () => {
  const { 밖, as } = 임시작업공간();
  fs.writeFileSync(path.join(형제세우기(밖), 'lib', '멘탈게이지.js'), '//\n');
  const ev = 낡음.증거(신설줄, as);
  assert.equal(ev.경로.실재.length, 1);
  assert.equal(ev.경로.실재[0].저장소, 'talk', '어느 저장소에서 찾았는지까지 말해야 사람이 대조할 수 있다');
  assert.equal(ev.경로.못잼.length, 0);
});

test('☠️ 그 경로가 **아직 없으면** 「없다」로 낸다 — 신설 일감이 살아 있다는 뜻이다', () => {
  const { 밖, as } = 임시작업공간();
  형제세우기(밖);
  const ev = 낡음.증거(신설줄, as);
  assert.equal(ev.경로.실재.length, 0);
  assert.equal(ev.경로.없음.length, 1);
  assert.equal(ev.경로.못잼.length, 0);
});

test('🔑 형제 저장소가 **없으면** 「없다」가 아니라 «못 쟀다»다 (F207·F364)', () => {
  const { as } = 임시작업공간(); // 형제를 안 세운다
  const ev = 낡음.증거(신설줄, as);
  assert.equal(ev.경로.없음.length, 0, '못 잰 것을 「없다」로 접으면 산 일감을 죽은 것처럼 보이게 한다');
  assert.equal(ev.경로.못잼.length, 1);
  assert.match(낡음.말들(ev).join('\n'), /못 쟀다/);
});

test('☠️ 「만지는 파일」 칸의 경로는 **안 센다** — 거기 실재하는 것은 정상이다', () => {
  const { 밖, as } = 임시작업공간();
  fs.mkdirSync(path.join(as, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(as, 'tools', '있는것.js'), '//\n');
  형제세우기(밖);
  const 줄 = '| 2026-08-12 | **어떤 트랙** | `tools/있는것.js` 편집 | ▶다음=이어서 |';
  const ev = 낡음.증거(줄, as);
  assert.equal(ev.경로.실재.length, 0, '이 칸까지 세면 모든 줄이 참이 되고, 전부 참인 경고는 안 읽힌다');
});

test('☠️ 홑이름·묶음표기는 안 센다 — 어느 저장소인지 못 가르면 남의 파일로 「있다」를 낸다', () => {
  const { 밖, as } = 임시작업공간();
  형제세우기(밖);
  const 줄 = '| 2026-08-12 | **트랙 `board.js` 와 `tools/{a,b}.js`** | x | ▶다음=고친다 |';
  const ev = 낡음.증거(줄, as);
  assert.equal(ev.경로.실재.length + ev.경로.없음.length + ev.경로.못잼.length, 0);
});

/* ── ② 커밋 — 「그 커밋이 이미 나갔는가」 ─────────────────────── */

/** git 이 없거나 안 돌면 **skip 이다**(fail 아님) — repo 밖 환경에 기댄 검사의 규칙. */
function 임시git(밖) {
  const dir = path.join(밖, 'gitrepo');
  fs.mkdirSync(dir, { recursive: true });
  const 돌리기 = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  try {
    돌리기(['init', '-q']);
    돌리기(['config', 'user.email', 'test@synk.local']);
    돌리기(['config', 'user.name', 'test']);
    fs.writeFileSync(path.join(dir, 'a.txt'), '1\n');
    돌리기(['add', 'a.txt']);
    돌리기(['commit', '-q', '-m', '첫']);
    const 첫 = 돌리기(['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(path.join(dir, 'a.txt'), '2\n');
    돌리기(['commit', '-q', '-a', '-m', '둘']);
    return { dir, 첫 };
  } catch (_) {
    return null;
  }
}

test('☠️ 🎫 가 말하는 커밋이 **이미 HEAD 조상**이면 거리와 함께 낸다 (실측 c0f148aa·de6b34d5 자리)', (t) => {
  const { 밖, as } = 임시작업공간();
  const g = 임시git(밖);
  if (!g) return t.skip('git 을 못 돌렸다 — 못 잰 것이지 통과가 아니다');
  const 줄 = `| 2026-08-12 | **⓪ 재검수** | 장부 | ✅앞일 · 🎫**다음=\`--commit ${g.첫.slice(0, 8)}\` 재검수**→배포 |`;
  const ev = 낡음.증거(줄, g.dir);
  assert.equal(ev.커밋.length, 1);
  assert.equal(ev.커밋[0].조상, true);
  assert.equal(ev.커밋[0].거리, 1);
  assert.doesNotMatch(낡음.말들(ev).join('\n'), /낡았|끝났다/, '판정어를 쓰면 산 일감을 죽었다고 말하게 된다(F374 함정 ①)');
});

test('☠️ **영수증 해시**는 일감으로 안 센다 — 안 자르면 늘 참인 경고가 된다', (t) => {
  const { 밖 } = 임시작업공간();
  const g = 임시git(밖);
  if (!g) return t.skip('git 을 못 돌렸다');
  const h = g.첫.slice(0, 8);
  /* 「▶작업중 … ✅한 것 `해시` … ▶다음=…」 — 남긴 일감은 **뒤엣** ▶ 다음이다. */
  const 줄 = `| 2026-08-12 | **트랙** | x | ▶작업중 — ✅v1.5 \`${h}\` · ▶다음=훅 정리 제안 판정 대기 |`;
  const ev = 낡음.증거(줄, g.dir);
  assert.equal(ev.커밋.length, 0);
});

test('☠️ **영수증 경로**도 일감으로 안 센다 — 자르기는 해시 축에만 걸린 게 아니다', () => {
  const { 밖, as } = 임시작업공간();
  fs.mkdirSync(path.join(as, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(as, 'tools', '이미한것.js'), '//\n');
  형제세우기(밖);
  /* 변이 검사가 이 구멍을 열어 보였다(2026-08-12): 경로 축이 상태 칸 **전체**를 읽어도
   * 회귀가 전부 초록이었다 — 「만지는 파일 칸 제외」만 재고 「✅ 영수증 제외」는 안 쟀다. */
  const 줄 = '| 2026-08-12 | **트랙** | x | ▶작업중 — ✅`tools/이미한것.js` 신설 종결 · ▶다음=딴 일 |';
  const ev = 낡음.증거(줄, as);
  assert.equal(ev.경로.실재.length, 0, '주인이 «이미 해냈다»고 적은 파일에 「이미 있다」를 붙이면 늘 참인 경고가 된다');
});

test('☠️ 🎫 는 ▶ 보다 세다 — 이어받기 일감이 적혔으면 그 조각을 읽는다', () => {
  const 줄 = '| 2026-08-12 | **트랙** | x | ▶작업중 · 🎫**다음=`tools/새것.js` 신설** · ▶다음=딴것 |';
  const { 밖, as } = 임시작업공간();
  형제세우기(밖);
  const ev = 낡음.증거(줄, as);
  assert.equal(ev.경로.없음.length, 1, '🎫 조각의 경로를 읽어야 한다');
  assert.equal(ev.경로.없음[0].경로, 'tools/새것.js');
});

test('🔑 세션 지문(`local_…`)은 커밋이 아니다 — 세면 지문마다 거짓 신호가 뜬다', () => {
  assert.deepEqual(낡음.해시들('`local_c52dcbed` 인계'), []);
  assert.deepEqual(낡음.해시들('`c52dcbed` 커밋'), ['c52dcbed']);
});

/* ── ③ 검수 장부 ────────────────────────────────────────────── */

test('☠️ 그 커밋이 **검수 장부에 이미 있으면** 그렇게 말한다 (de6b34d5 가 이 모양이었다)', () => {
  const { as } = 임시작업공간();
  fs.writeFileSync(path.join(as, 'docs', '_ops', '검수기록.jsonl'),
    `${JSON.stringify({ 시각: 'x', 대상: { 종류: 'commit', 값: 'deadbee' } })}\n`
    + `${JSON.stringify({ 시각: 'y', 대상: { 종류: 'base', 값: 'f85504bb~1' } })}\n`, 'utf8');
  const 장부 = 낡음.검수된커밋들(as);
  assert.ok(장부.has('deadbee'));
  assert.equal(장부.size, 1, 'base 대상은 커밋 검수가 아니다');
});

test('🔑 장부를 못 읽으면 `null` — 「검수된 적 없다」가 아니다 (F207)', () => {
  const { as } = 임시작업공간();
  assert.equal(낡음.검수된커밋들(as), null);
});

/* ── ④ 발동 조건 — 인계문에서 실제로 뜨는가 ────────────────────
 * 장치와 발동 조건은 같은 커밋에서 정한다(CLAUDE.md 신뢰성). `node tools/board.js` 에만 두면
 * **인계문을 그대로 따르는 세션은 이 증거를 영영 못 본다** — 그 인계문이 「🎫 하나만은
 * 이어받아도 된다」고 말하는 바로 그 자리라, 낡음 대조도 거기 있어야 한다. */

const report = require(path.join(REPO, '.claude', 'hooks', 'lib', 'session-report.js'));

/** 인계문 픽스처 — `티켓증거` 는 **cwd 의** 모듈을 부르므로(훅의 통로 규약) 그 자리를 세워 준다.
 *  여기서 재는 것은 모듈의 판정이 아니라 **배선**이다(판정은 위 픽스처들이 이미 졌다). */
function 인계문픽스처(상태칸, opts = {}) {
  const { as } = 임시작업공간();
  fs.mkdirSync(path.join(as, 'tools', 'lib'), { recursive: true });
  if (opts.모듈 !== false) {
    fs.writeFileSync(path.join(as, 'tools', 'lib', '보드낡음.js'),
      `module.exports = require(${JSON.stringify(path.join(REPO, 'tools', 'lib', '보드낡음.js'))});\n`, 'utf8');
  }
  fs.writeFileSync(path.join(as, 'tools', '있는것.js'), '//\n');
  fs.mkdirSync(path.join(as, 'docs', '_ops', '보드'), { recursive: true });
  fs.writeFileSync(path.join(as, 'docs', '_ops', '보드', '0badc0de.md'),
    '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n'
    + `| 2026-08-12 | **내 트랙** | x.js | ${상태칸} |\n`, 'utf8');
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_0badc0de-1111-2222-3333-444444444444';
  try { return report.buildHandoff(as, null, { dirty: 0 }); } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
}

test('☠️ 인계문이 🎫 를 넘길 때 **낡음 증거를 같이** 싣는다 (안 실으면 이 장치는 안 돈다)', () => {
  const 글 = 인계문픽스처('✅종결 · 🎫**다음=`tools/있는것.js` 신설**');
  assert.match(글, /🎫 대조\(기계 · F374\)/, '인계문만 읽는 세션은 board.js 를 안 부른다');
  assert.match(글, /이미 실재/);
  assert.match(글, /tools\/있는것\.js/);
});

test('☠️ 🎫 가 없으면 그 줄은 **아예 안 뜬다** — 매번 뜨는 줄은 곧 배경이 된다', () => {
  /* ⚠ 증거가 «나올 수 있는» 문구를 일부러 쓴다 — 재료 없는 줄로 재면 게이트를 없애도
   *   똑같이 조용해서 검사가 통과한다(변이 ⑨ 가 그렇게 살아남았다). 게이트를 재려면
   *   게이트만 다른 두 경우가 **갈라져야** 한다. */
  /* ⚠ 문구에 🎫 **글자를 쓰지 않는다** — 「🎫 는 안 붙였다」라고 적으면 그 글자 때문에 게이트가
   *   열리고, 잘린 일감 조각이 비어 양쪽 다 조용해진다(첫 판이 그렇게 헛돌았다). */
  const 글 = 인계문픽스처('▶다음=`tools/있는것.js` 신설 (이어받기 표식은 안 붙였다)');
  assert.doesNotMatch(글, /🎫 대조/, '이어받으라고 내놓지 않은 줄까지 대조하면 마감 훅이 매번 git 을 부른다');
});

test('🔑 모듈이 없어도 인계문은 나간다 — 대조 하나 때문에 인계가 끊기는 쪽이 더 나쁘다', () => {
  const 글 = 인계문픽스처('✅종결 · 🎫**다음=`tools/있는것.js` 신설**', { 모듈: false });
  assert.doesNotMatch(글, /🎫 대조/);
  assert.match(글, /내 트랙/, '인계문 본문 자체가 사라지면 안 된다');
});

/* ── ⑤ 실저장소 — 거짓양성만 (탐지력은 위 픽스처가 진다) ─────────── */

test('🔑 실저장소: 「이미 실재」라고 말한 경로는 **정말로** 있다', () => {
  const rows = 보드.주인없는줄들(REPO);
  if (rows === null) return; // 생사를 못 재는 환경 — 못 잰 것이지 실패가 아니다
  const 저 = 낡음.저장소들(REPO);
  for (const { 증거: ev } of 낡음.줄별증거(rows.map((r) => r.줄), REPO)) {
    for (const r of ev.경로.실재) {
      const 상대 = r.경로.replace(/^SYNK-(talk|appsscript)\//, '');
      const 뿌리 = (저.목록.find((x) => x.이름 === r.저장소) || {}).뿌리;
      assert.ok(뿌리 && fs.existsSync(path.join(뿌리, 상대)), `없는 파일을 「있다」고 했다: ${r.경로}`);
    }
  }
});

test('🔑 실저장소: 판정어를 쓰지 않는다 — 이 장치는 «대조하라»까지만 말한다', () => {
  const rows = 보드.주인없는줄들(REPO);
  if (rows === null) return;
  for (const { 증거: ev } of 낡음.줄별증거(rows.map((r) => r.줄), REPO)) {
    const 말 = 낡음.말들(ev).join('\n');
    assert.doesNotMatch(말, /낡았다|죽은 일감|끝난 일감|치워라/);
  }
});
