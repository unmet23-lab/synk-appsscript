'use strict';
// 화면 글 주입(tools/lib/화면글주입.js)의 글 덩이 묶기 — 글자마다 inline-block으로 따로 튀는 줄(제작 절차 「말 글씨」의 튀는 글자)은
// data-synk-line을 단 줄만 한 덩이다. 브라우저 없이 작은 가짜 DOM으로 본다(화면에 그리는 일은 화면글검사가 Remotion으로 한다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'tools', 'lib', '화면글주입.js'), 'utf8');

// [꼴, …자식] — 글은 문자열. 꼴의 칸: display · opacity · 줄(data-synk-line) · 앞(그 앞에 둘 화면 틈 px) · 폭(글자 너비 px — 0이면 아직 안 튀어나온 글자)
function 화면(나무) {
  let x = 0;
  const texts = [];
  const 요소 = (꼴, 부모) => ({ nodeType: 1, tagName: 'SPAN', ...꼴, childNodes: [], parentElement: 부모, hasAttribute: (k) => k === 'data-synk-line' && Boolean(꼴.줄) });
  const body = 요소({ display: 'block' }, null);
  const 붙이기 = (부모, 것) => {
    if (typeof 것 === 'string') {
      const 폭 = (부모.폭 ?? 20) * Array.from(것).length;
      x += 부모.앞 ?? 0;
      const n = { nodeType: 3, nodeValue: 것, parentElement: 부모, rect: { left: x, right: x + 폭, top: 100, bottom: 140 } };
      x += 폭;
      부모.childNodes.push(n);
      texts.push(n);
      return;
    }
    const [꼴, ...안] = 것;
    const e = 요소(꼴, 부모);
    부모.childNodes.push(e);
    for (const c of 안) 붙이기(e, c);
  };
  for (const c of 나무) 붙이기(body, c);
  return { body, texts };
}

function 덩이(나무) {
  const { body, texts } = 화면(나무);
  let out = null;
  let i = 0;
  const window = { innerWidth: 1080, innerHeight: 1920 };
  const document = {
    body,
    createTreeWalker: () => ({ nextNode: () => texts[i++] || null }),
    createRange: () => { let n; return { selectNodeContents: (v) => { n = v; }, getBoundingClientRect: () => ({ ...n.rect, width: n.rect.right - n.rect.left, height: n.rect.bottom - n.rect.top }) }; },
  };
  const getComputedStyle = (e) => ({ display: e.display || 'inline', visibility: 'visible', opacity: String(e.opacity ?? 1), fontSize: '40px', color: 'rgb(0,0,0)' });
  const console2 = { log: (s) => { if (s.startsWith('__SYNK_TEXT__')) out = JSON.parse(s.slice('__SYNK_TEXT__'.length)); } };
  vm.runInNewContext(SRC, { window, document, getComputedStyle, NodeFilter: { SHOW_TEXT: 4 }, console: console2 });
  window.remotion_setFrame = () => {};
  window.remotion_setFrame(7);
  window.remotion_renderReady = true;
  return out.items.map((e) => e.t);
}

const 글자 = (ch, 꼴 = {}) => [{ display: 'inline-block', ...꼴 }, ch];
const 줄 = (글, 꼴 = () => ({})) => [{ display: 'block', 줄: true }, ...Array.from(글).map((c, i) => 글자(c, 꼴(i)))];

test('표시를 단 줄은 글자마다 따로 튀어도 한 덩이다', () => {
  assert.deepEqual(덩이([줄('깜짝이야!'), [{ display: 'block' }, '[ккамжжагия!]']]), ['깜짝이야!', '[ккамжжагия!]']);
});

test('띄어쓰기는 원문 빈칸대로다 — 글자 사이 틈이 벌어져도 끼지 않고, 커진 글자가 빈칸을 덮어도 빠지지 않는다(GA2)', () => {
  assert.deepEqual(덩이([줄('눈에 눈!')]), ['눈에 눈!']);
  // 처지며 줄어든 글자(당황) — 글자 사이 틈이 글자 너비의 절반
  assert.deepEqual(덩이([줄('안절부절못하다', () => ({ 앞: 18 }))]), ['안절부절못하다']);
  // 커진 글자(놀람)가 앞 빈칸을 덮어 틈이 없다
  assert.deepEqual(덩이([줄('나 봐', (i) => (i === 2 ? { 앞: -20 } : {}))]), ['나 봐']);
});

test('아직 튀어나오지 않은 글자(너비 0)는 빼고, 그 앞 빈칸은 다음에 보이는 글자에만 붙는다', () => {
  assert.deepEqual(덩이([줄('눈에 눈이네!', (i) => (i >= 3 ? { 폭: 0 } : {}))]), ['눈에']);
  assert.deepEqual(덩이([줄(' 눈')]), ['눈']);
});

test('표시가 없으면 한 글자 카드도 지금처럼 따로 센다(GA1 — 「물」 · 「개」 뒤의 「물개」)', () => {
  assert.deepEqual(덩이([[{ display: 'block' }, 글자('물'), 글자('개', { 앞: 60 })], [{ display: 'block' }, '물개']]), ['물', '개', '물개']);
  assert.deepEqual(덩이([[{ display: 'block' }, ...Array.from('깜짝이야!').map((c) => 글자(c))]]), ['깜', '짝', '이', '야', '!']);
});

test('표시가 없는 글의 띄어쓰기 · 인라인 조각 묶기는 그대로다', () => {
  assert.deepEqual(덩이([[{ display: 'block' }, [{ display: 'inline' }, '모자를'], [{ display: 'inline', 앞: 12 }, '써요']]]), ['모자를 써요']);
  assert.deepEqual(덩이([[{ display: 'block' }, [{ display: 'inline' }, '물'], [{ display: 'inline' }, '개']]]), ['물개']);
});

test('옅은 글자와 짙은 글자는 표시를 단 줄에서도 따로다', () => {
  assert.deepEqual(덩이([줄('눈이네', (i) => (i === 2 ? { opacity: 0.2 } : {}))]), ['눈이', '네']);
  // 옅은 글자가 사이에 끼어도 짙은 글자의 띄어쓰기는 남는다
  assert.deepEqual(덩이([줄('나 봐요', (i) => (i === 2 ? { opacity: 0.2 } : {}))]), ['나 요', '봐']);
});
