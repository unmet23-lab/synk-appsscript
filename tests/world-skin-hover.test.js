'use strict';
/* WORLD 게임 스킨의 :hover는 마우스가 있는 기기에서만 걸린다 (2026-11-04).
 * 터치 기기는 탭 뒤에 :hover가 남아, 휴대폰에서 흰 알약 단추에 코랄 고리가 붙은 채 있었다. 주문 폭주에서 고친 뒤에도 같은 블록이
 * 다른 게임 스킨에 남아 있었고, 새 게임은 스킨을 옮겨 쓰므로 여기서 막는다. 실제 터치 · 마우스 값은
 * docs/_ops/qa/world-skin-hover-20261104/터치고리재기.cjs가 잰다.
 * 걸리면: 그 줄을 @media (hover:hover){…}로 감싼다(눌림까지 함께 칠하는 :is(:hover,:active)는 :active 줄과 나눈다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 체험 = path.resolve(__dirname, '../experiences');
// 눌림 · hover를 함께 「지우는」 줄 — 남아도 보이는 것이 없다
const 지우는줄 = /\.dialog-toggles \.chip-btn:is\(:hover,\s*:active\)$/;

/** CSS를 훑어 규칙마다 { 선택자, 감싼것: [@규칙…] }. 주석 · 문자열 · url() 안의 중괄호는 세지 않는다. */
function 규칙들(css) {
  const 글 = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const 나온것 = [], 더미 = [];
  let 앞 = '';
  for (let i = 0; i < 글.length; i += 1) {
    const c = 글[i];
    if (c === '"' || c === "'") {
      const 끝 = 글.indexOf(c, i + 1);
      앞 += 글.slice(i, 끝 + 1);
      i = 끝;
    } else if (글.startsWith('url(', i) && 글[i + 4] !== '"' && 글[i + 4] !== "'") {
      const 끝 = 글.indexOf(')', i);
      앞 += 글.slice(i, 끝 + 1);
      i = 끝;
    } else if (c === '{') {
      const 머리 = 앞.trim();
      앞 = '';
      더미.push(머리);
      if (!머리.startsWith('@')) 나온것.push({ 선택자: 머리, 감싼것: 더미.slice(0, -1).filter((x) => x.startsWith('@')) });
    } else if (c === '}') {
      더미.pop();
      앞 = '';
    } else if (c === ';') {
      앞 = '';
    } else {
      앞 += c;
    }
  }
  return 나온것;
}

const 마우스만 = (규칙) => 규칙.감싼것.some((x) => /^@media\b.*\(\s*hover\s*:\s*hover\s*\)/s.test(x));
const 어긋난줄 = (css) => 규칙들(css).filter((r) => r.선택자.includes(':hover') && !마우스만(r) && !지우는줄.test(r.선택자)).map((r) => r.선택자);

test('훑는 함수가 hover 쿼리 안팎 · 중괄호 든 값을 가른다', () => {
  assert.deepEqual(어긋난줄('.a:hover{color:red}'), ['.a:hover']);
  assert.deepEqual(어긋난줄('@media (hover:hover){.a:hover{color:red}}'), []);
  assert.deepEqual(어긋난줄('@media (hover: hover) and (pointer: fine){.a:hover{color:red}}'), []);
  assert.deepEqual(어긋난줄('@media (max-width:600px){.a:hover{color:red}}'), ['.a:hover']);
  assert.deepEqual(어긋난줄('/* .x:hover{} */.b{--u:url("data:image/svg+xml,a{b}");background:url(a{b}.png)}.b:is(:hover,:active){color:red}'), ['.b:is(:hover,:active)']);
  assert.deepEqual(어긋난줄(':root .dialog-toggles .chip-btn:is(:hover,:active){background:none}'), []);
});

test('게임 스킨의 :hover는 모두 @media (hover:hover) 안에 있다', () => {
  const 스킨 = fs.readdirSync(체험, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(체험, d.name, 'world-skin.css'))).map((d) => d.name);
  assert.ok(스킨.length >= 6, `게임 스킨을 못 찾았다: ${스킨}`);
  const 어긋남 = {};
  let 안 = 0;
  for (const 게임 of 스킨) {
    const css = fs.readFileSync(path.join(체험, 게임, 'world-skin.css'), 'utf8');
    const 줄 = 어긋난줄(css);
    if (줄.length) 어긋남[`experiences/${게임}/world-skin.css`] = 줄;
    안 += 규칙들(css).filter((r) => r.선택자.includes(':hover') && 마우스만(r)).length;
  }
  assert.deepEqual(어긋남, {}, '터치 기기에서 탭 뒤에 남는다 — @media (hover:hover){…}로 감싼다');
  assert.ok(안 > 0, '재는 대상이 없다');
});
