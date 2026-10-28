'use strict';
// 싱크타운 손맛 소리(experiences/synk-town/day-sfx.mjs — W8 찻집 주문 §22, W8b 채집 §20-8) — 브랜드 사운드킷 규칙 4를 음표 표로 지킨다:
// ① 한 소리 400ms 이하(누름은 250ms 안) ② 실패음 없음(내리꽂는 음·버저 없음) ③ 사인·트라이앵글만 ④ C 펜타토닉(미끄럼은 양 끝).
// 그리고 소리는 WORLD 효과음·진동 스위치를 따르고 마을 소리 스위치와 따로다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const FILE = path.join(ROOT, 'experiences', 'synk-town', 'day-sfx.mjs');
const sfx = () => import(pathToFileURL(FILE).href);
// C 펜타토닉의 음 이름(도·레·미·솔·라) — 어느 옥타브든.
const PENTATONIC = new Set([0, 2, 4, 7, 9]);
const pitchClass = f => ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12;
const inTune = f => Math.abs(12 * Math.log2(f / 261.6256) - Math.round(12 * Math.log2(f / 261.6256))) < 0.05;
const PRESSES = ['cup', 'spoon', 'empty', 'pick', 'serve', 'leaf', 'basket', 'sway'];
const CASES = [['cup', { vessel: 'warm' }], ['cup', { vessel: 'cold' }], ['pour', { tea: 'barley' }], ['pour', { tea: 'yuzu' }], ['pour', { tea: 'today' }],
  ['spoon', { honey: 0 }], ['spoon', { honey: 1 }], ['spoon', { honey: 2 }], ['spoon', { honey: 1, variant: 1 }], ['spoon', { honey: 2, variant: 1 }],
  ['done', {}], ['empty', {}], ['pick', {}], ['serve', {}], ['match', {}], ['final', {}],
  ['leaf', { step: 0 }], ['leaf', { step: 1 }], ['leaf', { step: 2 }], ['leaf', { step: 3 }], ['leaf', { step: 1, last: true }],
  ['basket', {}], ['basket', { variant: 1 }], ['sway', {}], ['sway', { variant: 1 }], ['give', {}], ['discover', {}]];

test('규칙 4 — 400ms 이하(누름 250ms 안) · 사인·트라이앵글만 · 음은 모두 C 펜타토닉 · 잡음은 넓게', async () => {
  const { score, lengthOf, NAMES } = await sfx();
  assert.deepEqual([...new Set(CASES.map(([name]) => name))].sort(), [...NAMES].sort(), '모든 소리를 본다');
  for (const [name, opts] of CASES) {
    const notes = score(name, opts), end = lengthOf(notes);
    assert.ok(notes.length > 0, `${name}: 소리가 있다`);
    assert.ok(end <= 0.4, `${name}: ${Math.round(end * 1000)}ms — 400ms 이하`);
    if (PRESSES.includes(name)) assert.ok(end <= 0.25, `${name}: 누름 소리 ${Math.round(end * 1000)}ms — 250ms 안`);
    for (const n of notes) {
      if (n.kind === 'tone') {
        assert.ok(['sine', 'triangle'].includes(n.type), `${name}: ${n.type}`);
        for (const f of [n.f0, n.f1]) assert.ok(inTune(f) && PENTATONIC.has(pitchClass(f)), `${name}: ${f}Hz는 C 펜타토닉 밖`);
      } else {
        assert.equal(n.kind, 'noise');
        assert.ok(['lowpass', 'highpass', 'bandpass'].includes(n.filter), `${name}: ${n.filter}`);
        assert.ok(n.dur <= 0.3, `${name}: 잡음은 짧게`);
      }
    }
  }
});

test('따기는 한 칸씩 오르고 마지막 잎은 끝음 — 같은 음이 셋 잇달아 나지 않는다(W8b §2-15 ②)', async () => {
  const { score } = await sfx();
  const top = notes => Math.max(...notes.filter(n => n.kind === 'tone' && n.type === 'triangle').map(n => n.f0));
  const run = [0, 1, 2].map(step => top(score('leaf', { step })));
  assert.ok(run[0] < run[1] && run[1] < run[2], `따기 음이 오른다 ${run}`);
  const end = score('leaf', { step: 2, last: true }).filter(n => n.kind === 'tone' && n.type === 'triangle').map(n => n.f0);
  assert.ok(end.length >= 2, '마지막 잎은 두 음을 함께 울린다');
  const lands = [score('basket'), score('basket', { variant: 1 })].map(notes => notes.find(n => n.kind === 'tone').f0);
  assert.notEqual(lands[0], lands[1], '바구니 소리는 둘째부터 조금 다르다');
});

test('실패음 없음 — 잔 비우기는 음 없는 붓질이고, 꿀을 0으로 돌릴 때도 내리꽂지 않으며, 「조금 달라요」 소리는 없다', async () => {
  const { score, NAMES } = await sfx();
  assert.ok(score('empty').every(n => n.kind === 'noise'), '비우기는 음이 없다');
  assert.ok(score('sway').every(n => n.kind === 'noise') && score('sway', { variant: 1 }).every(n => n.kind === 'noise'), '짙은 잎을 건드린 소리도 음이 없다(W8b — 틀림이 아니다)');
  const back = score('spoon', { honey: 0 }).filter(n => n.kind === 'tone');
  assert.ok(back.every(n => n.f0 === n.f1), '꿀을 빼는 소리는 미끄러져 내려가지 않는다');
  assert.ok(!NAMES.some(name => /miss|wrong|fail|differ/.test(name)), '틀림 소리 이름이 없다');
  // 미끄럼이 내려가는 소리는 짧은 똑·톡(150ms 안)뿐 — 긴 하강 버저가 없다.
  for (const [name, opts] of CASES) for (const n of score(name, opts)) if (n.kind === 'tone' && n.f1 < n.f0) assert.ok(n.glide <= 0.05, `${name}: 긴 하강 ${n.glide}s`);
});

test('스위치 — WORLD 효과음(synk.world.sound)·진동(synk.world.haptic)을 따르고, 마을 소리 스위치는 읽지도 켜지도 않는다', async () => {
  const { PREFS } = await sfx();
  assert.deepEqual(PREFS, { sound: 'synk.world.sound', haptic: 'synk.world.haptic' });
  const code = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/town-sound|town-music|setItem/.test(code), '마을 소리 스위치를 건드리지 않고, 어떤 스위치도 쓰지 않는다');
  assert.match(code, /MIC_KEY/, '녹음 중에는 울리지 않는다');
  assert.match(code, /document\.hidden/, '숨긴 창에서는 울리지 않는다');
});
