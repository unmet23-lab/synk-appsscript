'use strict';
/* 라디오 오버레이 세 층이 «같은 낱말»을 쓰나 — 어긋나면 방송에서만 드러나는 자리다 (2026-09-06).
 *
 * ■ 무엇을 지키나
 *   무대 층(`무대.html`)과 마스코트 층(`마스코트.html`)은 서로를 모른다. 봇이 결(곡 장르)을
 *   한 번 던지면 각자 제 몫을 집는다. 그래서 «결 이름»이 두 파일에서 갈리면, 그 결에서만
 *   DJ 는 갈아입는데 무대는 그대로 서 있거나 그 반대가 된다 — 방송 중에만 보이는 무늬다.
 *   한 판정에 자 하나(one-ruler-per-judgment): 결 이름의 정본은 «무대 그림 파일 이름»이다.
 *
 * ■ 왜 파일 글자를 읽나
 *   두 층은 브라우저 문서라 Node 모듈을 못 부른다(README 「보는 법」이 `file://` 통로를 쓴다).
 *   그래서 상수를 공유할 데가 없고, 대신 여기서 «세 곳이 같은가»를 잰다.
 *
 * 돈 0원 · 네트워크 0.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.join(__dirname, '..');
const 무대글 = fs.readFileSync(path.join(루트, 'bots/오버레이/무대.html'), 'utf8');
const 마스코트글 = fs.readFileSync(path.join(루트, 'bots/오버레이/마스코트.html'), 'utf8');
const 무대방 = path.join(루트, 'docs/Loom_자산/무대');

/** `const 결들 = ['가', '나', ...];` 에서 낱말만 뽑는다. */
function 무대가아는결() {
  const m = 무대글.match(/const\s+결들\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, '무대.html 에 `결들` 목록이 없다 — 결 이름의 정본 자리다');
  return m[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
}

/** `const 장르차림 = { 가: {...}, 나: {...} };` 에서 열쇠만 뽑는다. */
function 마스코트가아는결() {
  const m = 마스코트글.match(/const\s+장르차림\s*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(m, '마스코트.html 에 `장르차림` 표가 없다');
  return [...m[1].matchAll(/^\s{2}([^\s:]+)\s*:/gm)].map((x) => x[1]);
}

test('결 이름이 무대 층과 마스코트 층에서 같다', () => {
  const 무대 = 무대가아는결().slice().sort();
  const 마스코트 = 마스코트가아는결().slice().sort();
  assert.deepStrictEqual(마스코트, 무대,
    '결 이름이 두 층에서 갈렸다 — 그 결에서 한쪽만 바뀐다(방송 중에만 보인다)');
});

test('결마다 무대 그림이 실제로 있다', () => {
  for (const 결 of 무대가아는결()) {
    const p = path.join(무대방, 결 + '.webp');
    assert.ok(fs.existsSync(p), `무대 그림이 없다: ${p} — python tools/무대작게.py 가 낸다`);
  }
});

test('차림에 적힌 옷 조각이 실제로 있다', () => {
  const 옷방 = path.join(루트, 'docs/Loom_자산/옷층');
  const 표 = 마스코트글.match(/const\s+장르차림\s*=\s*\{([\s\S]*?)\n\};/)[1];
  const 줄들 = [...표.matchAll(/^\s{2}([^\s:]+)\s*:\s*\{\s*DJ:\s*'([^']+)'\s*,\s*옷:\s*\[([^\]]*)\]/gm)];
  assert.ok(줄들.length > 0, '차림 줄을 하나도 못 읽었다 — 이 자가 헛돌고 있다');
  for (const [, 결, DJ, 옷글] of 줄들) {
    const 옷들 = 옷글.match(/'([^']+)'/g).map((s) => s.slice(1, -1));
    assert.ok(옷들.length <= 3, `${결}: 층은 셋뿐이다(의상 1 + 악세 2 · 유호 확정 09-06)`);
    for (const 옷 of 옷들) {
      const p = path.join(옷방, `옷_${DJ}_${옷}.webp`);
      assert.ok(fs.existsSync(p), `${결} 의 옷 조각이 없다: ${p}`);
    }
  }
});

/** 주석을 걷는다 — 함정을 «설명한 문장»이 함정으로 잡히면 안 된다(이 자가 첫 판에 그랬다). */
function 주석걷기(글) {
  return 글.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((줄) => 줄.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
}

test('사건 문은 «변수에 잡아 둔다» — 안 잡으면 브라우저가 치운다', () => {
  for (const [이름, 날글] of [['무대.html', 무대글], ['마스코트.html', 마스코트글],
    ['전광판.html', fs.readFileSync(path.join(루트, 'bots/오버레이/전광판.html'), 'utf8')]]) {
    const 글 = 주석걷기(날글);
    /* 🔴 09-06 실측 — `new BroadcastChannel(...).onmessage = ...` 만 쓰면 그 문을 가리키는 것이
       아무 데도 없어 청소 대상이 된다. 그러면 봇이 보내도 조용히 아무 일도 안 난다. */
    assert.ok(!/new BroadcastChannel\([^)]*\)\s*\.\s*onmessage/.test(글),
      `${이름}: 문을 만들자마자 버렸다 — 변수에 담아 두어야 한다`);
    assert.ok(/^\s*(let|var)\s+\S+\s*=\s*null;[\s\S]{0,400}new BroadcastChannel/m.test(글),
      `${이름}: 문 손잡이를 바깥 변수에 잡아 두지 않았다`);
  }
});
