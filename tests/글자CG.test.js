'use strict';
// 글자 · CG 사전(11-25 유호님 「각 컨셉마다 자막이나 CG나 모션그래픽을 어떻게 넣을지에대한거는 어떻게 정하고 가면 좋을까? 특히 자막이 가장 문제야」)
//   docs/마케팅/제작양식/영상양식/글자CG.json의 꼴을 본다. 검사 규칙(T32)은 tests/컷연속성검사.test.js, 영상기준 줄은 tests/영상기준.test.js가 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = p => fs.readFileSync(path.join(뿌리, p), 'utf8').replace(/\r\n/g, '\n');
const 사전 = JSON.parse(읽기('docs/마케팅/제작양식/영상양식/글자CG.json'));
const 옛갈래 = ['말자막', '강조', '이름', '끝로고', '장면속', '정보'];

test('사전 — 종류는 열다섯부터, 이름이 겹치지 않고, 옛 여섯 갈래 가운데 하나로 읽히며, 칸이 모두 차 있다', () => {
  const 이름 = 사전.종류.map(x => x.이름);
  assert.ok(이름.length >= 15, `종류 ${이름.length}가지`);
  assert.equal(new Set(이름).size, 이름.length, '이름이 겹친다');
  for (const x of 사전.종류) {
    assert.ok(옛갈래.includes(x.컷표), `${x.이름}: 컷표 갈래 ${x.컷표}`);
    assert.ok(['편집', '그림'].includes(x.만드는곳), `${x.이름}: 만드는곳 ${x.만드는곳}`);
    // 편집에서 치는 종류는 자막 도구가 되는 갈래(말자막 · 정보)로 읽혀야 한다 — 강조 · 이름 · 끝로고 · 장면속은 T9가 글꼴 · 얹기를 막는다(11-25 GPT 검수 GA2 해설 자막)
    assert.equal(x.만드는곳 === '편집', ['말자막', '정보'].includes(x.컷표), `${x.이름}: 만드는곳 ${x.만드는곳}인데 컷표 갈래가 ${x.컷표}다`);
    for (const k of ['무엇', '자리', '움직임', '머묾', '싸보임']) assert.ok(typeof x[k] === 'string' && x[k].trim(), `${x.이름}: ${k}`);
  }
  for (const g of 옛갈래) assert.ok(사전.종류.some(x => x.컷표 === g), `옛 갈래 ${g}로 읽히는 종류가 없다`);
  // 옛 갈래 이름과 같은 사전 이름은 그 갈래로 읽혀야 한다(말자막 → 말자막)
  for (const x of 사전.종류) if (옛갈래.includes(x.이름)) assert.equal(x.컷표, x.이름);
});

test('사전 — 컨셉 아홉이 사전의 이름만 쓰고, 자주와 피함이 겹치지 않으며, 말자막 꼴의 상태가 정해진 말이다', () => {
  const 이름 = new Set(사전.종류.map(x => x.이름));
  const 팩들 = fs.readdirSync(path.join(뿌리, 'docs/마케팅/제작양식/영상양식/컨셉팩')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  assert.deepEqual(Object.keys(사전.컨셉).sort(), 팩들.sort(), '컨셉 팩과 같은 아홉');
  for (const [c, 줄] of Object.entries(사전.컨셉)) {
    for (const k of ['자주', '한방', '피함']) for (const n of 줄[k]) assert.ok(이름.has(n), `${c}.${k}: 「${n}」이 사전에 없다`);
    assert.ok(줄.자주.length >= 2, `${c}: 자주가 둘보다 적다`);
    assert.ok(!줄.자주.some(n => 줄.피함.includes(n)), `${c}: 자주와 피함이 겹친다`);
    assert.ok(typeof 줄.요령 === 'string' && 줄.요령.trim(), `${c}: 요령`);
    const 자막 = 줄.자막 || {};
    assert.ok(['고르심', '견본 고르심 전', '기본값 없음'].includes(자막.상태), `${c}: 자막.상태 ${자막.상태}`);
    if (자막.상태 === '고르심') assert.ok(typeof 자막.꼴 === 'string' && 자막.꼴.trim(), `${c}: 고르신 꼴을 적는다`);
    if (자막.상태 === '견본 고르심 전') assert.ok(typeof 자막.견본 === 'string' && 자막.견본.trim(), `${c}: 견본 묶음 이름을 적는다`);
  }
});

test('사전 — 공통 숫자(자리 · 안전 영역 · 크기 · 줄 · 읽기 · 마침표 · 강조색 · 가림 · AI표시)가 있고, 검사가 같은 사전을 읽는다', () => {
  for (const k of ['말자막자리', '세로안전', '가로안전', '말자막크기', '줄', '읽기', '마침표', '강조색', '가림', 'AI표시']) {
    assert.ok(typeof 사전.숫자[k] === 'string' && 사전.숫자[k].trim(), `숫자.${k}`);
  }
  const 검사 = 읽기('tools/컷연속성검사.py');
  assert.match(검사, /글자사전경로 = Path\(os\.environ\.get\("SYNK_TEXT_CG_FILE"\) or \(빛이름표경로\.parent \/ "글자CG\.json"\)\)/);
  assert.match(검사, /^글자종류 = \("말자막", "강조", "이름", "끝로고", "장면속", "정보"\)$/m, '옛 여섯 갈래가 사전의 「컷표」 칸과 같다');
  assert.match(읽기('tools/영상기준.js'), /const 글자자리 = 양식 \+ '영상양식\/글자CG\.json';/);
});
