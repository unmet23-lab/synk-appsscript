// decision-queue 회귀 — 「기호를 쓰는 것」과 「기호를 말하는 것」을 가른다.
//
// 실사고(2026-08-04): 메모리에 이 도구의 결함을 회고한 문장이 있었다 —
//   "⚠첫 판은 23건이 가짜였다: `⏳`가 이 메모리에서 두 용법으로 쓰이는데…"
// stripMd가 백틱을 벗기자 ⏳ 앞 글자가 ':'(구분자)가 되어 항목으로 승격됐고,
// **자기 결함을 설명하는 문단이 결정으로 폰에 배달됐다.**
//
// 지키는 것: ①코드 스팬 안의 ⏳는 항목이 아니다 ②진짜 항목 뒤에 붙은 코드 스팬 인용은
// 텍스트에서 사라지지 않는다(마스킹은 판별용이지 삭제가 아니다) ③기존 두 용법 판별은 그대로.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Q = require('../tools/decision-queue.js');
const { memoryDir } = require('../tools/memory-graph.js');

/* [2026-08-04 · 내가 CI를 깨뜨린 자리] 메모리 정본은 **repo 밖**(`~/.claude/projects/…/memory`)에 산다.
 * 그래서 「실저장소 검사」는 이 머신에서만 성립하고 CI 러너에는 그 폴더가 아예 없다 —
 * 로컬 638 pass가 CI 초록의 증명이 못 됐다(08-04 CI 트랙의 「로컬에만 있는 환경에 기대면 CI가 검출한다」와 같은 계열).
 * 🔑그래서 **탐지 능력은 픽스처가 전부 지고**, 실저장소 검사는 **폴더가 있을 때만** 도는 보너스로 낮춘다.
 * 조용히 통과시키지 않고 skip으로 드러낸다 — 통과와 미실행은 같은 모양이면 안 된다. */
const MEM = memoryDir();
const HAS_MEMORY = fs.existsSync(MEM);

/* extract()는 디렉터리를 받으므로 픽스처 볼트를 만든다 —
 * 실저장소로 검사하면 「버그가 아직 있을 것」을 요구하는 회귀가 된다(guard-must-check-result). */
function withVault(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dq-codespan-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), body, 'utf8');
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('코드 스팬 안의 ⏳는 항목이 아니다 — 기호를 설명하는 문장이 결정으로 배달되면 안 된다', () => {
  const items = withVault({
    'a.md': '- 🔑교훈: `⏳`가 두 용법으로 쓰이는데 안 갈라서 조각이 배달됐다.\n',
  }, (d) => Q.extract(d));
  assert.deepStrictEqual(items, [], `코드 스팬 인용을 항목으로 셌다: ${JSON.stringify(items)}`);
});

test('진짜 항목은 코드 스팬이 같은 줄에 있어도 살아남고, 인용 기호도 지워지지 않는다', () => {
  const items = withVault({
    'b.md': '- ⏳유호=폰으로 답한 뒤 `⏳` 표시를 지울지 결정\n',
  }, (d) => Q.extract(d));
  assert.strictEqual(items.length, 1, '진짜 항목이 마스킹에 쓸려나갔다');
  assert.ok(items[0].text.startsWith('⏳유호=폰으로'), items[0].text);
  assert.ok(items[0].text.includes('⏳ 표시를'), `마스킹이 되돌려지지 않았다: ${items[0].text}`);
});

test('기존 두 용법 판별은 그대로 — 본문 속 지시어는 여전히 항목이 아니다', () => {
  const items = withVault({
    'c.md': '위 ⏳3건 미결 상태에서 착수하면 안 된다.\n',
  }, (d) => Q.extract(d));
  assert.deepStrictEqual(items, []);
});

test('기존 두 용법 판별은 그대로 — 줄머리 표시는 여전히 항목이다', () => {
  const items = withVault({
    'd.md': '- ⏳ 유호님 몫: 개원일 확정\n',
  }, (d) => Q.extract(d));
  assert.strictEqual(items.length, 1);
  assert.ok(items[0].text.includes('개원일 확정'));
});

/* [충돌 병합 08-04] 옆 세션과 이 자리를 동시에 고쳤다. 두 안의 차이는 **무엇으로 「없음」을 아는가**였다:
 *   ⓐ(옆 세션) build()를 돌려보고 `e.code === 'ENOENT'`면 skip — 던져진 오류의 모양으로 판별
 *   ⓑ(이쪽)   돌리기 전에 폴더 존재를 확인해 skip — 상태를 먼저 판별
 * ⓑ를 택한다. 같은 커밋에서 `extract()`가 **안내 문구가 붙은 일반 Error**를 던지도록 바꿨으므로
 * ⓐ의 `code` 검사는 더 이상 안 걸리고 그대로 빨간불이 된다 — 「특정 형태에 앵커를 걸면 그 형태가
 * 바뀌는 순간 가드가 죽는다」([[worktree-version-collision]])의 교과서적 실례다.
 * ⓐ의 좋은 점(**다른 오류는 숨기지 않는다**)은 ⓑ가 애초에 아무것도 삼키지 않으므로 그대로 지켜진다. */
test('실저장소: 이 도구의 회고 문단이 큐에 없다(거짓양성만 검사)', {
  skip: HAS_MEMORY ? false : `메모리 정본이 이 머신에 없다(${MEM}) — repo 밖이라 CI에는 존재하지 않는다`,
}, () => {
  const q = Q.build({ count: 3 });
  const ghost = q.ranked.filter((it) => /두 용법으로 쓰이는데/.test(it.text));
  assert.deepStrictEqual(ghost, [], '자기 결함 회고가 다시 결정으로 올라왔다');
});

/* 위 검사를 skip으로 낮춘 대신, **그 상황 자체**를 픽스처로 못박는다 —
 * 「폴더가 없으면 조용히 0건」이 되면 클라우드 cron이 영영 침묵해도 아무도 모른다. */
test('메모리 폴더가 없으면 크게 실패한다 — 빈 큐로 위장하지 않는다', () => {
  const gone = path.join(os.tmpdir(), `dq-없는폴더-${process.pid}`);
  assert.ok(!fs.existsSync(gone));
  assert.throws(() => Q.extract(gone), /메모리 디렉터리를 못 찾음/,
    '경로를 못 찾은 것은 「미결 0건」과 같은 모양이면 안 된다');
});
