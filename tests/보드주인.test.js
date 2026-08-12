/* 주인 없는 보드 줄 회귀 — 「마감을 선언한 세션의 줄이 산 줄과 똑같이 보인다」.
 *
 * 사고의 모양 (2026-08-12 `local_38c31cad` 실측 — 한 세션이 트랙 **하나** 고르는 동안 셋):
 *   ① 🎫「다음=clasp push(215~217)」 두 줄 — 이미 `a668c152` 가 v9.215~220 을 완주한 뒤였다
 *   ② ▶「미착수 · `lib/멘탈게이지.js`·`lib/게임스냅샷.js` 신설」 — 둘 다 이미 형제에 있다
 *   ③ 대기열 S1-8 — 본문이 「✅2단계 종결」인데 체크박스는 열려 있다
 * 셋 다 주인이 마감을 선언한 뒤 굳은 줄이다. 산 세션의 줄은 그 세션이 갱신하니 이 병이 안 생기는데,
 * **표에서 그 둘은 글자 하나 다르지 않다.** 보드가 답해야 할 질문(「지금 누가 뭘 잡았나」)에서
 * 「그 누가 아직 있나」가 통째로 빠져 있었다.
 *
 * 여기서 못박는 것 넷:
 *   ① **새는 방향은 「주인 있음」이다** — 그쪽으로 틀리면 다음 세션이 낡은 🎫 를 집고(지금의 사고),
 *      반대로 틀리면 사람이 실물을 한 번 더 여는 비용뿐이다. 그래서 **모르면 「주인 없음」**.
 *      `유물-*.md` 처럼 파일지문이 `''` 인 것을 「내 것」으로 세면 그 순간 통째로 샌다(board-id 머리 ⚠).
 *   ② **탐지력은 픽스처가 진다** — 실저장소엔 「거짓양성 0」만 건다(맹점 ②: 버그가 아직 있을 것을
 *      요구하는 회귀는 고치는 순간 빨개진다).
 *   ③ **못 잼과 0건을 가른다**(F207) — 「주인 없는 줄이 없다」와 「생사를 못 쟀다」는 다른 상태다.
 *   ④ **stdout 은 한 글자도 안 바뀐다** — 이 표를 파싱하는 곳이 넷이라(session-report·
 *      track-collision·board-move·board-guard) 경고는 stderr 로만 간다. 유령 경고가 지킨 계약과 같다.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 보드 = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));
const 보드id = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'board-id.js'));
const BOARDJS = path.join(__dirname, '..', 'tools', 'board.js');
const REPO = path.resolve(__dirname, '..');

/** 사람이 실제로 쓰는 모양 그대로다(맹점 ①) — 아래 둘은 이 저장소에서 실제로 난 줄을 줄인 것이다. */
const 티켓줄 = '| 2026-08-12 | **배포 완주** | Code.js | ✅종결 · 🎫다음=`--commit de6b34d5` 재검수→배포 |';
const 보통줄 = '| 2026-08-12 | **설계 v3** | docs/설계.md | ▶작업중 (`local_deadbeef`) |';

function 저장소(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-owner-'));
  const 폴더 = path.join(dir, 'docs', '_ops', '보드');
  fs.mkdirSync(폴더, { recursive: true });
  for (const [이름, 내용] of Object.entries(파일들 || {})) {
    fs.writeFileSync(path.join(폴더, `${이름}.md`), 내용, 'utf8');
  }
  return dir;
}

const 머리 = '# 보드\n\n| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |\n|---|---|---|---|\n';

test('☠️ 마감한 주인의 줄을 잡아낸다 — 픽스처에 산 세션은 하나도 없다(탐지력)', () => {
  const root = 저장소({ '0badc0de': 머리 + 보통줄 + '\n' });
  const r = 보드.주인없는줄들(root);
  assert.notStrictEqual(r, null, '생사를 쟀어야 한다');
  assert.strictEqual(r.length, 1, '픽스처의 유일한 줄이 주인 없음으로 잡혀야 한다');
  assert.strictEqual(r[0].지문, '0badc0de');
});

test('🔑 🎫 를 남긴 줄만 이어받기로 센다 — 그게 다음 세션이 집는 유일한 예외다', () => {
  const root = 저장소({ '0badc0de': 머리 + 티켓줄 + '\n' + 보통줄 + '\n' });
  const r = 보드.주인없는줄들(root);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r.filter((x) => x.이어받기).length, 1, '🎫 있는 줄만 이어받기여야 한다');
  assert.ok(r.find((x) => x.이어받기).줄.includes('🎫'));
});

test('☠️ `유물-` 파일은 「주인 없음」이다 — 빈 지문을 「내 것」으로 세면 통째로 샌다', () => {
  /* board-id 머리의 ⚠ 가 못박은 자리: 파일지문이 `''` 인 것끼리 `===` 로 비교하면
   * 주인 없는 파일 전부가 한 사람 것이 된다. 새는 방향은 여기서도 「통과」다. */
  const root = 저장소({ '유물-4e47bfb': 머리 + 티켓줄 + '\n' });
  const r = 보드.주인없는줄들(root);
  assert.strictEqual(r.length, 1, '유물 파일의 줄도 주인 없음으로 서야 한다');
  assert.strictEqual(r[0].지문, '', '지문은 빈 문자열이고, 그것이 「내 것」을 뜻하지 않는다');
});

test('🔑 못 잼과 0건을 가른다 — 폴더가 없으면 `null` 이지 빈 배열이 아니다 (F207)', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'board-owner-none-'));
  assert.strictEqual(보드.주인없는줄들(빈곳), null, '폴더를 못 읽으면 null');
});

test('🔑 파티션 — 주인 없는 줄은 언제나 표 줄의 부분집합이다(표에 없는 줄을 지어내지 않는다)', () => {
  const root = 저장소({ '0badc0de': 머리 + 티켓줄 + '\n' + 보통줄 + '\n' });
  const 전부 = 보드.줄들(root).map((r) => r.줄);
  for (const r of 보드.주인없는줄들(root)) assert.ok(전부.includes(r.줄), `표에 없는 줄: ${r.줄}`);
});

test('☠️ 실저장소 거짓양성 — **내 줄**은 주인 없음에 안 잡힌다 (탐지력은 위 픽스처가 진다)', () => {
  const 나 = 보드id.지문(process.env.CLAUDE_CODE_HOST_SESSION_ID || '');
  const r = 보드.주인없는줄들(REPO);
  if (!나 || r === null) return;                         // 지문·생사를 못 재는 판이면 이 검사는 성립 안 한다
  if (!fs.existsSync(path.join(보드.폴더(REPO), `${나}.md`))) return;   // 내 줄이 없는 세션도 있다
  assert.ok(!r.some((x) => x.지문 === 나), `내 줄이 주인 없음으로 잡혔다: ${나}`);
});

test('☠️ stdout 은 표뿐이다 — 경고 한 글자도 안 섞인다(파싱하는 곳이 넷)', () => {
  const out = execFileSync('node', [BOARDJS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], cwd: REPO });
  assert.ok(!out.includes('마감을 선언한'), 'stdout 에 주인 경고가 새면 표 파서 넷이 새 줄을 만난다');
  assert.ok(!out.includes('🎫 그중'), 'stdout 에 이어받기 안내가 새면 안 된다');
  const 표 = 보드.텍스트(REPO);
  if (표 !== null) assert.strictEqual(out, 표, 'board.js 의 stdout 은 `텍스트()` 와 바이트로 같아야 한다');
});
