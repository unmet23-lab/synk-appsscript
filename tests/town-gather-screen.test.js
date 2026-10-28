'use strict';
// 싱크타운 잎 따기 판의 화면 쪽 순수 함수(세로 조각 W8b, 설계 §20-8 · W8b 노트 §2-8): 가까운 자리 고르기, 판의 한 줄(다 땄으면 지금 딸 것이 있는
// 다른 자리 — 막다른 길 없음, 나는 때가 아니면 언제 나는지), 바구니는 그림만(숫자 없음, G2), 도감 다섯 칸(찾은 것은 그림·이름·설명, 아닌 것은
// 실루엣·한 줄), C3 판에 드릴 수 있는 것(통을 채우는 것만), 셋째 통 이름표(그날 드린 차), 명령 거절 코드는 엔진과 같은 목록, 서빙·공개 목록 셋.
// DOM은 qa-gather-ui.cjs가 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const TOWN = path.join(ROOT, 'experiences', 'synk-town');
const load = file => import(pathToFileURL(path.join(TOWN, file)).href);
const NUMBERS = /[0-9０-９]|번째|일째|연속|시간|분 |개 /;
const spot = (id, items, at = { x: 0, z: 0 }) => ({ id, at, branch: 4, board: 7, items });

test('가까운 자리 — 닿는 거리 안의 가장 가까운 자리, 없으면 null · 지금 딸 것이 있는지', async () => {
  const { nearestSpot, pickableNow } = await load('day-gather.mjs');
  const spots = [spot('cafe.pots', [{ item: 'mint', grows: true, left: 2 }], { x: -1.5, z: 2.2 }), spot('lane.wall', [{ item: 'petal-rain', grows: false, left: 2 }], { x: 3.6, z: 3.1 })];
  assert.equal(nearestSpot(spots, { x: -1, z: 2.5 }, 1.2)?.id, 'cafe.pots');
  assert.equal(nearestSpot(spots, { x: 0.5, z: 2.5 }, 1.2), null, '닿지 않으면 없다');
  assert.equal(nearestSpot(spots, null, 1.2), null);
  assert.equal(pickableNow(spots[0]), true);
  assert.equal(pickableNow(spots[1]), false, '나지 않으면 딸 것이 없다');
  assert.equal(pickableNow(spot('cafe.pots', [{ item: 'mint', grows: true, left: 0 }])), false, '몫을 다 쓰면 없다');
});

test('판의 한 줄 — 딸 것이 있으면 비우고, 다 땄으면 지금 딸 것이 있는 다른 자리, 나는 때가 아니면 언제 나는지(숫자 없음)', async () => {
  const { boardLine } = await load('day-gather.mjs');
  const pots = spot('cafe.pots', [{ item: 'mint', grows: true, left: 0 }, { item: 'chrysanthemum', grows: false, left: 2 }]);
  const bed = spot('greenhouse.bed-edge', [{ item: 'leaf-young', grows: true, left: 2 }, { item: 'leaf-dew', grows: false, left: 1 }]);
  const wall = spot('lane.wall', [{ item: 'petal-rain', grows: false, left: 2 }]);
  assert.equal(boardLine(bed, [bed, pots, wall]), '', '딸 것이 있으면 한 줄이 없다');
  const done = boardLine(pots, [bed, pots, wall]);
  assert.match(done, /다 땄어요/); assert.match(done, /온실 화단 가장자리에서 딸 수 있어요/, '막다른 길 없이 다른 자리를 알려 준다');
  assert.doesNotMatch(boardLine(pots, [pots, wall]), /에서 딸 수 있어요/, '딸 곳이 없으면 다른 자리를 지어내지 않는다');
  const none = boardLine(wall, [wall]);
  assert.match(none, /주울 것이 없어요/); assert.match(none, /비가 그친 뒤에/, '언제 나는지');
  for (const words of [done, none, boardLine(wall, [bed, wall])]) assert.doesNotMatch(words, NUMBERS, words);
});

test('바구니는 그림만 — 하나에 그림 하나, 많으면 셋까지 겹치고 숫자는 없다 · 도감 다섯 칸', async () => {
  const { basketPictures, bookCells } = await load('day-gather.mjs');
  const pics = basketPictures([{ item: 'mint', qty: 7 }, { item: 'leaf-young', qty: 1 }, { item: 'nope', qty: 2 }, { item: 'petal-rain', qty: 0 }]);
  assert.deepEqual(pics.map(p => p.item), ['mint', 'mint', 'mint', 'leaf-young'], '셋까지 겹치고 모르는 것·빈 것은 빠진다');
  const cells = bookCells(['mint']);
  assert.deepEqual(cells.map(c => c.item), ['leaf-young', 'leaf-dew', 'mint', 'chrysanthemum', 'petal-rain'], '재료 다섯 차례');
  const mint = cells.find(c => c.item === 'mint'), dew = cells.find(c => c.item === 'leaf-dew');
  assert.ok(mint.found && mint.name === '박하 잎' && mint.text.length > 6, '찾은 것은 이름과 설명(L2)');
  assert.ok(!dew.found && /비가 그친|아침 비/.test(dew.text) && dew.name !== '이슬 맺힌 잎', '아직 아닌 것은 이름을 감추고 언제 볼 수 있는지');
  assert.doesNotMatch(JSON.stringify(cells.map(c => [c.name, c.text])), NUMBERS, '도감에 숫자·몇 개 모음이 없다(G2)');
});

test('C3 판에 드릴 것 — 잎 통을 채우는 것만(꽃잎은 차에 띄울 뿐) · 셋째 통 이름표는 그날 드린 차', async () => {
  const { jarFillers, todayTeaWords, todayTeaColor } = await load('day-gather.mjs'), { paramsFor } = await load('town/params.mjs');
  const relief = paramsFor().gather.tinRelief;
  assert.deepEqual(jarFillers([{ item: 'petal-rain', qty: 3 }, { item: 'mint', qty: 1 }, { item: 'leaf-young', qty: 0 }], relief), ['mint']);
  assert.deepEqual(jarFillers([{ item: 'petal-rain', qty: 3 }], relief), [], '꽃잎만 있으면 드리기 단추가 없다');
  assert.equal(todayTeaWords(null), null);
  assert.equal(todayTeaWords({ tea: 'green', petal: false }), '녹차');
  assert.equal(todayTeaWords({ tea: 'chrysanthemum', petal: true }), '꽃잎을 띄운 국화차');
  assert.equal(todayTeaWords({ tea: null, petal: true }), '꽃잎을 띄운 오늘의 차', '꽃잎만 드린 날은 차를 바꾸지 않는다');
  assert.match(todayTeaColor({ tea: 'mint' }), /^#[0-9a-f]{6}$/i);
});

test('그림과 자리 — 모양마다 SVG, 실루엣은 색 없이, 잎 자리는 판 안 · 을/를', async () => {
  const { itemPicture, leafSpots, object, itemName } = await load('day-gather.mjs');
  for (const item of ['leaf-young', 'leaf-dew', 'mint', 'chrysanthemum', 'petal-rain']) {
    const svg = itemPicture(item), shadow = itemPicture(item, { silhouette: true });
    assert.match(svg, /^<svg viewBox="0 0 48 48" aria-hidden="true"/, item);
    assert.doesNotMatch(shadow, /#[0-9a-f]{3,6}/i, `${item} 실루엣은 색이 없다(currentColor)`);
  }
  assert.notEqual(itemPicture('leaf-young'), itemPicture(null, { dark: true }), '짙은 잎은 다르게 그린다');
  for (const n of [3, 4]) for (const p of leafSpots(n)) assert.ok(p.x > 5 && p.x < 95 && p.y > 5 && p.y < 95, JSON.stringify(p));
  assert.deepEqual(['어린 찻잎', '노란 국화', '비 온 뒤 꽃잎'].map(w => object(w)), ['을', '를', '을']);
  assert.equal(itemName('mint'), '박하 잎');
});

test('거절 코드는 엔진과 같은 목록 — 판은 잎을 되돌리고 연결 오류로 띄우지 않는다(검토 F3)', async () => {
  const { REFUSALS } = await load('day-gather.mjs');
  const engine = fs.readFileSync(path.join(TOWN, 'town', 'activities', 'gather.mjs'), 'utf8');
  const codes = [...new Set([...engine.matchAll(/fail\('(gather-[a-z-]+)'/g)].map(m => m[1]))].sort();
  assert.deepEqual([...REFUSALS].sort(), [...new Set([...codes, 'gather-full'])].sort(), '엔진이 내는 거절(그리고 런타임의 gather-full)을 모두 안다');
  const app = fs.readFileSync(path.join(TOWN, 'day-app.mjs'), 'utf8');
  assert.match(app, /\(DAY_\|LIFE_\|BAZAAR_\|SUPPORT_\|CARD_\|TEA_\|LANGUAGE_\|GATHER_\|GREET\$\)/, '채집·언어 명령은 창의 울타리(surfaceId · fence)를 싣는다');
  assert.match(app, /function gatherCommand/, '채집 명령은 자기 줄로 간다(바쁘면 버리지 않음)');
});

test('거절 글 — WORLD 계정 경로는 코드만 남아도(마을 답이 글을 error 안에 둔다) 판은 엔진과 같은 마을 말로 까닭을 말한다', async () => {
  const { REFUSALS, refusalWords } = await load('day-gather.mjs');
  const engine = fs.readFileSync(path.join(TOWN, 'town', 'activities', 'gather.mjs'), 'utf8');
  // What the engine says, command by command (its GATHER_PICK case, then its GATHER_GIVE case).
  const give = engine.indexOf("case 'GATHER_GIVE'");
  const said = [...engine.matchAll(/fail\('(gather-[a-z-]+)', '([^']+)'/g)].map(m => ({ type: m.index > give ? 'GATHER_GIVE' : 'GATHER_PICK', code: m[1], words: m[2] }));
  assert.ok(give > 0 && said.length >= REFUSALS.length, '엔진의 거절 글을 다 읽었다');
  for (const { type, code, words } of said) assert.equal(refusalWords(type, code, code), words, `${type} ${code}: 엔진이 말하는 글과 같다`);
  for (const code of REFUSALS) assert.ok(!/[a-z]/.test(refusalWords('GATHER_PICK', code, code) || 'x'), `${code}: 코드가 아니라 마을 말`);
  assert.equal(refusalWords('GATHER_PICK', 'gather-too-far', '서버가 준 글'), '서버가 준 글', '마을이 준 글이 있으면 그 글');
  const app = fs.readFileSync(path.join(TOWN, 'day-app.mjs'), 'utf8');
  assert.match(app, /gatherRefusalWords\(type, code, error\.message\)/, '채집 명령의 거절은 이 글로');
});

test('간단히 만들기 — 찻집 판과 같은 스위치 · 보이는 글에 숫자 없음 · 단추는 WORLD 누름 소리를 내지 않음', async () => {
  const gather = await load('day-gather.mjs'), tea = await load('day-tea.mjs'), { GATHER } = await load('town/activities/gather.mjs');
  assert.equal(gather.SIMPLE_KEY, tea.SIMPLE_KEY);
  const words = JSON.stringify([Object.values(GATHER.spots).map(s => s.label), Object.values(GATHER.items).map(i => [i.name, i.hint]), Object.values(GATHER.teas).map(t => t.name), GATHER.petal.label]);
  assert.doesNotMatch(words, NUMBERS, words);
  const code = fs.readFileSync(path.join(TOWN, 'day-gather.mjs'), 'utf8');
  assert.match(code, /dataset\.sound = 'none'/, '판 단추는 data-sound="none"');
  assert.match(code, /role', 'group'/, '판은 group');
  assert.doesNotMatch(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /GPT|Claude|Gemini|Fable|Codex|ChatGPT/, '공개 파일에 도구 이름이 없다');
});

test('서빙·공개 목록 셋 — 화면 파일 둘이 미리 보기 서버·WORLD 앱 서버·공개 빌드에 있다', () => {
  const files = ['experiences/synk-town/server.mjs', 'experiences/synk-world-app/server.mjs', 'tools/build-world-app-public.mjs'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
  for (const text of files) for (const name of ['day-gather.mjs', 'day-gather.css']) assert.ok(text.includes(name) || text.includes(name.replace('.', '\\.')), name);
  assert.ok(fs.existsSync(path.join(TOWN, 'day-gather.css')));
});
