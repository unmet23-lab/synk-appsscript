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

/* 🔴 F630 — 이 검사가 **전 스위트와 함께 돌 때만** 한 번 빨개졌다(2026-08-18 · `local_ad0673f3`).
 *   같은 트리에서 바로 다시 돌리니 초록이었고, 그 뒤 세 갈래로 재현을 시도했지만 **못 재현했다**:
 *   ①이 파일 단독(변수 있음·없음 둘 다) ②`ci모사환경` 을 씌운 단독 실행 ③같은 env 로 이 파일만.
 *   기전은 **아직 미특정**이다 — 처음엔 「박동이 식었다」고 적었는데, 소스를 끝까지 읽으니 그 설명은
 *   서지 않는다: `살았나` 에는 **자기면제**(`s.sid === 나지금`)가 있고 문턱은 **30분**(`SYNK_OWNER_ALIVE_MIN`)
 *   인데 그 런은 3분 반짜리였다. 남은 후보는 「읽는 순간 상태 파일이 쓰이는 중이라 `JSON.parse` 가
 *   던지고 `세션들()` 이 그 레코드를 **조용히 건너뛴다**」쪽이다(그 자리는 실제로 try/catch 로 삼킨다).
 *
 * 🔑 그래서 **행동을 안 바꿨다.** 기전을 모르는 채 판정을 느슨하게 하면 그건 고친 게 아니라 가린 것이다.
 *   대신 **다음 적색이 스스로 진단을 들고 오게** 실패문에 관측을 실었다 — 간헐 적색의 표준 처방이다.
 *   (분모 없이 「잡혔다」만 있으면 다음 사람도 나처럼 재현부터 세 번 헛돈다.) */
test('☠️ 실저장소 거짓양성 — **내 줄**은 주인 없음에 안 잡힌다 (탐지력은 위 픽스처가 진다)', () => {
  const 나 = 보드id.지문(process.env.CLAUDE_CODE_HOST_SESSION_ID || '');
  const r = 보드.주인없는줄들(REPO);
  if (!나 || r === null) return;                         // 지문·생사를 못 재는 판이면 이 검사는 성립 안 한다
  if (!fs.existsSync(path.join(보드.폴더(REPO), `${나}.md`))) return;   // 내 줄이 없는 세션도 있다

  /** 적색일 때만 조립한다 — 초록 런에 스폰·읽기를 붙이지 않는다. */
  const 관측 = () => {
    const 줄 = [`내 줄이 주인 없음으로 잡혔다: ${나}`];
    try {
      const store = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));
      const 소유자 = require(path.join(__dirname, '..', 'tools', '작업본소유자.js'));
      const ss = 소유자.세션들(REPO);
      줄.push(`  · 상태 폴더: ${store.stateDir()}`);
      줄.push(`  · 내 env id: ${JSON.stringify(process.env.CLAUDE_CODE_HOST_SESSION_ID || '')}`);
      줄.push(`  · 세션 레코드 ${ss.length}건 — 이 수가 0이면 그 폴더를 못 읽은 것이지 「아무도 없다」가 아니다(F207)`);
      for (const s of ss) {
        줄.push(`      ${s.sid} · 박동 ${s.분}분 전 · 끝남=${!!s.끝남} · 선언살았나=${소유자.선언살았나(s)}`);
      }
      줄.push(`  · 주인 없다고 잡힌 줄 ${r.length}건 (지문: ${r.map((x) => x.지문 || '∅').join(', ')})`);
      줄.push('  → 내 레코드가 위 목록에 **없으면** 읽는 순간 건너뛰어진 것이고(F630 남은 후보),');
      줄.push('    있는데 `선언살았나=false` 면 박동·죽음 도장 쪽이다. 둘은 처방이 다르다.');
    } catch (e) {
      줄.push(`  · (관측 조립 실패: ${e.message} — 그 자체가 재료다)`);
    }
    return 줄.join('\n');
  };

  /* `assert.ok(cond, 관측)` 로 넘기면 안 된다 — 함수는 **소스 코드로 문자열화**돼서
   * 실패문이 관측이 아니라 함수 본문이 된다(그러면 조립한 값이 화면에 한 글자도 안 나온다). */
  if (r.some((x) => x.지문 === 나)) assert.fail(관측());
});

test('☠️ stdout 은 표뿐이다 — 경고 한 글자도 안 섞인다(파싱하는 곳이 넷)', () => {
  const out = execFileSync('node', [BOARDJS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], cwd: REPO });
  assert.ok(!out.includes('마감을 선언한'), 'stdout 에 주인 경고가 새면 표 파서 넷이 새 줄을 만난다');
  assert.ok(!out.includes('🎫 그중'), 'stdout 에 이어받기 안내가 새면 안 된다');
  const 표 = 보드.텍스트(REPO);
  if (표 !== null) assert.strictEqual(out, 표, 'board.js 의 stdout 은 `텍스트()` 와 바이트로 같아야 한다');
});
