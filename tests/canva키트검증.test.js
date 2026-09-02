'use strict';
/* Canva 키트 대조기(docs/tools/canva_키트_검증.js)는 브라우저 콘솔에 붙여 넣는 파일이라 JSON 을 못 읽고 값을 손으로 든다.
 * 그래서 낡는다 — 08-20 에 KIT 만 2027 킷으로 올라가고 PALETTES·NAMED 는 구 킷에 남아, 맞게 갱신된 Canva 키트도
 * 빨간불을 받게 돼 있었다(codex P2 407f33f365e9·be3ffc2e47c9 · 09-02 수리).
 * 이 시험이 그 손값을 정본(docs/디자인_토큰.json)과 대조한다 — 「낡았는지 아무도 모르는 검증기」를 다시 만들지 않기 위해.
 * ⚠ 이 시험이 «안» 보는 것: Canva 실물. 정본이 앞서가면 대조기가 빨간불을 내는 것이 맞고, 그건 유호님이 Canva 를 갱신하는 자리다. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'docs', 'tools', 'canva_키트_검증.js'), 'utf8').replace(/\r\n/g, '\n');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));

/** `const 이름 = {…};` / `[…];` 리터럴을 소스에서 잘라 평가한다(주석은 JS 가 삼킨다). */
function 리터럴(이름) {
  const m = src.match(new RegExp(`const ${이름} = (\\{[\\s\\S]*?\\n  \\}|\\[[\\s\\S]*?\\n  \\]);`));
  assert.ok(m, `${이름} 리터럴을 못 찾았다 — 모양이 바뀌었으면 이 시험도 같이 고친다`);
  return new Function(`return ${m[1]};`)();
}

test('KIT = 정본 킷 전량(hex 소문자 → 이름) — 한 색이라도 갈리면 대조기가 딴 킷을 잰다', () => {
  const KIT = 리터럴('KIT');
  const 정본 = Object.fromEntries(토큰.색.킷.map((c) => [String(c.hex).toLowerCase(), c.이름]));
  assert.deepStrictEqual(KIT, 정본);
});

test('PALETTES = 정본 킷의 팔레트 이름 전량(순서 무관) — 구 킷 이름(Cream·Navy·Slate)이 되살아나지 않는다', () => {
  const PALETTES = 리터럴('PALETTES');
  const 정본 = [...new Set(토큰.색.킷.map((c) => c.팔레트))];
  assert.deepStrictEqual([...PALETTES].sort(), [...정본].sort());
});

test('스와치 이름 검사는 KIT 전량을 본다 — 넷만 보던 옛 NAMED 는 이름이 바뀌어도 초록이었다', () => {
  assert.ok(!/const NAMED = /.test(src), '옛 NAMED 목록이 남아 있다');
  assert.ok(/for \(const \[hex, name\] of Object\.entries\(KIT\)\) \{\n    if \(!이름있나\(leaves, name\)\)/.test(src),
    'KIT 이름 전량 대조 루프가 없다');
});
