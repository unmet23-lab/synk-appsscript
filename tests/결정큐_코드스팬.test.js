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

test('실저장소: 이 도구의 회고 문단이 큐에 없다(거짓양성만 검사)', () => {
  const q = Q.build({ count: 3 });
  const ghost = q.ranked.filter((it) => /두 용법으로 쓰이는데/.test(it.text));
  assert.deepStrictEqual(ghost, [], '자기 결함 회고가 다시 결정으로 올라왔다');
});
