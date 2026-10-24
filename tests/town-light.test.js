'use strict';
// 싱크타운 시간대 빛·비(세로 조각 설계 §2-2·§4-2·§4-4, W7) — 빛은 마을 씨앗·시간대 이력·서버 시각만의 함수이고,
// 정오·맑음이면 승인된 모습 그대로다. 빛 표는 town/data/light.json 한 장(매개변수 판이 아니다)이고 코드는 그 값을 숫자로 쓰지 않는다.
// 씨앗 synk-town: 2026-10-25 맑은 날, 10-29 비 오는 날, 10-30 저녁 소나기(한국 17~19시).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, TOWN, townModule, toolModule } = require('./lib/town.js');

const MIN = 60_000;
const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const SEED = 'synk-town', KST = [{ fromMs: 0, offsetMin: 540 }];
const CLEAR = '2026-10-25', RAIN = '2026-10-29', SHOWER = '2026-10-30';
const dayLight = () => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town/day-light.mjs')).href);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} ≠ ${b} (±${eps})`);
const luminance = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// three.js ACESFilmicToneMapping (노출 1.02)와 sRGB 전달 — 선형 radiance가 화면에서 얼마나 밝은지.
const IN = [[0.59719, 0.07600, 0.02840], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]];
const OUT = [[1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]];
const columns = (M, v) => [0, 1, 2].map(r => M[0][r] * v[0] + M[1][r] * v[1] + M[2][r] * v[2]);
const fit = v => v.map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.4329510) + 0.238081));
const toSrgb = x => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const screen = linear => columns(OUT, fit(columns(IN, linear.map(x => x * 1.02 / 0.6)))).map(x => toSrgb(Math.min(1, Math.max(0, x))));
// 구운 그늘 텍셀 sRGB .6(굽기 배율 2 — 동네 판 GLB의 synk_bake_scale)이 하늘 몫만으로 받는 화면 밝기.
const shadeOn = light => luminance(screen(light.baked.sky.map(s => s * ((0.6 + 0.055) / 1.055) ** 2.4 * 2)));

test('같은 마을·같은 서버 시각·같은 시간대면 같은 빛이다', async () => {
  const { lightAt } = await townModule('light');
  for (let i = 0; i < 120; i++) {
    const ms = kst(RAIN, '00:00') + i * 37 * MIN + 1234;
    assert.deepEqual(lightAt({ villageSeed: SEED, tz: KST, ms }), lightAt({ villageSeed: SEED, tz: KST, ms }));
  }
  const a = lightAt({ villageSeed: SEED, tz: KST, ms: kst(RAIN, '12:30') }), b = lightAt({ villageSeed: 'other-village', tz: KST, ms: kst(RAIN, '12:30') });
  assert.equal(a.rain.raining, true); assert.notDeepEqual(a.rain, b.rain, '다른 마을은 다른 날씨일 수 있다(씨앗)');
});

test('정오·맑음은 승인된 모습 그대로다 — 구운 두 몫 1, v20 상수, 하늘 덮개 꺼짐, 비 없음', async () => {
  const { lightAt } = await townModule('light');
  for (const time of ['12:00', '12:30', '15:59']) {
    const L = lightAt({ villageSeed: SEED, tz: KST, ms: kst(CLEAR, time) });
    assert.equal(L.band, 'day'); assert.deepEqual(L.baked, { sky: [1, 1, 1], sun: [1, 1, 1] });
    near(L.sun.intensity, 3.15, 1e-9, '해 세기'); near(L.hemi.intensity, .58, 1e-9, '반구'); near(L.fill, .18, 1e-9, '채움');
    near(L.env, .45, 1e-9, '환경'); near(L.skyMap, .95, 1e-9, '하늘 그림'); near(L.sun.shadow, 1, 1e-9, '그림자');
    [255, 243, 222].forEach((v, i) => near(L.sun.color[i] * 255, v, .6, '해 색 #fff3de'));
    [198, 218, 221].forEach((v, i) => near(L.fog.color[i] * 255, v, .6, '안개 #c6dadd'));
    assert.deepEqual([L.overlay.alpha, L.fog.near, L.fog.far, L.glass, L.lantern, L.stars], [0, 1, 1, 0, 0, 0]);
    assert.deepEqual([L.rain.drops, L.rain.overcast, L.rain.wet], [0, 0, 0]);
    const approved = [-9, 11, 7].map(v => v / Math.sqrt(251));
    L.sun.direction.forEach((v, i) => near(v, approved[i], .003, '해 방향 (−9, 11, 7)'));
  }
});

test('하루 내내 끊김이 없다 — 1분마다의 변화가 작고 자정·구간 경계도 같다', async () => {
  const { lightAt } = await townModule('light');
  const numbers = L => [...L.baked.sky, ...L.baked.sun, ...L.sun.color, L.sun.intensity, L.sun.shadow, ...L.hemi.sky, ...L.hemi.ground, L.hemi.intensity, L.fill, L.env, L.skyMap,
    ...L.overlay.top, ...L.overlay.horizon, L.overlay.alpha, ...L.fog.color, L.fog.near, L.fog.far, L.glass, L.lantern, L.stars];
  let prev = null, worst = 0, worstDir = 0;
  for (let m = 0; m <= 26 * 60; m++) {
    const L = lightAt({ villageSeed: SEED, tz: KST, ms: kst(CLEAR, '00:00') + m * MIN });
    if (prev) {
      numbers(L).forEach((v, i) => { worst = Math.max(worst, Math.abs(v - numbers(prev)[i])); });
      worstDir = Math.max(worstDir, Math.hypot(...L.sun.direction.map((v, i) => v - prev.sun.direction[i])));
    }
    prev = L;
  }
  assert.ok(worst < .06, `분당 가장 큰 변화 ${worst}`);
  assert.ok(worstDir < .06, `해 방향의 분당 가장 큰 변화 ${worstDir}`);
});

test('내 시각을 따른다 — 오프셋이 다르면 같은 순간에도 다른 빛, 같은 내 시각이면 같은 빛', async () => {
  const { lightAt, localMinuteAt } = await townModule('light');
  const ms = kst(CLEAR, '12:30');
  const seoul = lightAt({ tz: KST, ms }), newYork = lightAt({ tz: [{ fromMs: 0, offsetMin: -240 }], ms });
  assert.equal(seoul.band, 'day'); assert.equal(newYork.band, 'night');
  near(localMinuteAt(-240, ms), 23 * 60 + 30, 1e-9, '뉴욕 23:30');
  // 씨앗 없이(비 없음) 같은 내 시각 — 같은 빛.
  const noonNY = lightAt({ tz: -240, ms: ms + 13 * 60 * MIN });
  assert.deepEqual({ ...noonNY, atMs: 0 }, { ...lightAt({ tz: 540, ms }), atMs: 0 });
  // 시간대가 이력으로 바뀌면 바뀐 뒤의 오프셋을 따른다.
  const moved = [{ fromMs: 0, offsetMin: 540 }, { fromMs: ms - 60 * MIN, offsetMin: 60 }];
  near(lightAt({ tz: moved, ms }).localMinute, 4 * 60 + 30, 1e-9, '이력의 새 오프셋');
});

test('구간과 빛이 같은 시계다 — 밤은 어둡고 낮은 밝으며, 깊은 밤에도 그늘이 읽힌다', async () => {
  const { lightAt } = await townModule('light');
  const at = time => lightAt({ villageSeed: SEED, tz: KST, ms: kst(CLEAR, time) });
  for (let m = 0; m < 24 * 60; m += 10) {
    const L = lightAt({ villageSeed: SEED, tz: KST, ms: kst(CLEAR, '00:00') + m * MIN }), y = luminance(L.baked.sky);
    if (L.band === 'night') assert.ok(y <= .56, `밤 ${m}분 하늘 몫 ${y}`);
    if (L.band === 'day') assert.ok(y >= .7, `낮 ${m}분 하늘 몫 ${y}`);
    assert.ok(y >= .18, `${m}분 하늘 몫 하한 ${y}`);
  }
  // 화면 끝 밝기(ACES 뒤 sRGB): 깊은 밤 ≥ .3, 등불 밤 ≥ .4, 그리고 한낮 > 아침 > 저녁 > 등불 밤 > 깊은 밤.
  const order = ['12:30', '08:30', '18:30', '21:30', '02:30'].map(time => shadeOn(at(time)));
  assert.ok(order[4] >= .3, `깊은 밤 그늘 ${order[4]}`); assert.ok(order[3] >= .4, `등불 밤 그늘 ${order[3]}`);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] < order[i - 1], `밝기 차례 ${order.map(v => v.toFixed(3)).join(' > ')}`);
  // 아침은 한낮과 색이 갈린다: 그늘은 푸르고(하늘 몫 파랑 > 빨강) 해 받는 곳은 금빛(해 몫 빨강 > 파랑).
  const morning = at('08:30');
  assert.ok(morning.baked.sky[2] - morning.baked.sky[0] > .1 && morning.baked.sun[0] - morning.baked.sun[2] > .25, '아침 색');
  // 마을이 잠든 깊은 밤에는 창이 거의 꺼지고 길 등만 남는다(밤 첫 방문 A).
  assert.ok(at('02:30').glass <= .3 && at('02:30').lantern >= .5, '깊은 밤 창·등');
  assert.equal(at('21:00').glass, 1);
});

test('비 창 경계 — 빗줄기는 비 안에서만 2분에 걸쳐, 구름은 12분 먼저, 젖음은 비 뒤 45분에 마른다', async () => {
  const { rainAt } = await townModule('light');
  const r = time => rainAt(SEED, kst(SHOWER, time));
  assert.deepEqual(rainAt(SEED, kst(CLEAR, '12:00')), { raining: false, drops: 0, overcast: 0, wet: 0 });
  assert.equal(r('16:47').drops, 0); assert.ok(r('16:54').overcast > 0 && r('16:54').overcast < 1, '구름이 먼저 온다');
  assert.equal(r('17:00').raining, true); assert.equal(r('17:00').drops, 0); assert.equal(r('17:00').overcast, 1);
  near(r('17:01').drops, .5, 1e-9, '17:01 빗줄기 반'); assert.equal(r('17:02').drops, 1);
  near(r('18:59').drops, .5, 1e-9, '18:59 빗줄기 반'); assert.equal(r('18:59').wet, 1);
  assert.equal(r('19:00').raining, false); assert.equal(r('19:00').drops, 0);
  near(r('19:06').overcast, .5, 1e-9, '구름은 12분에 걸쳐 걷힌다');
  assert.ok(r('19:20').wet > 0 && r('19:20').wet < 1, '마르는 중'); assert.equal(r('19:45').wet, 0);
  assert.deepEqual(rainAt(SEED, kst(RAIN, '12:30')), { raining: true, drops: 1, overcast: 1, wet: 1 });
  assert.deepEqual(rainAt(null, kst(RAIN, '12:30')), { raining: false, drops: 0, overcast: 0, wet: 0 }, '씨앗이 없으면 비도 없다');
});

test('빛 표는 한 장이고 코드에 그 값을 숫자로 쓰지 않는다 — 검사기는 틀린 표를 막는다', async () => {
  const { LIGHT } = await townModule('data.gen');
  const { validateLight } = await toolModule('town-data-build');
  assert.equal(LIGHT.lightVer, 'town-light-1'); assert.ok(Object.isFrozen(LIGHT.keys.noon));
  const source = JSON.parse(fs.readFileSync(path.join(TOWN, 'data/light.json'), 'utf8'));
  assert.doesNotThrow(() => validateLight(source));
  const broken = edit => { const copy = structuredClone(source); edit(copy); return () => validateLight(copy); };
  assert.throws(broken(d => { delete d.keys.sunset; }), /keys/);
  assert.throws(broken(d => { d.keys.dawn = d.keys.noon; }), /keys/);
  assert.throws(broken(d => { d.keys.noon.glass = .5; }), /noon/);
  assert.throws(broken(d => { d.keys.morning.rampMinutes = 0; }), /ramp/);
  assert.throws(broken(d => { d.keys.morning.fog = [1200, 0, 0]; }), /sRGB/);
  assert.throws(broken(d => { delete d.keys.morning.stars; }), /이름/);
  assert.throws(broken(d => { d.rain.dryMinutes = 0; }), /dryMinutes/);
  // 판 시험(town-params)과 같은 규칙: light.mjs에 표의 값(1보다 큰 정수)을 숫자로 쓴 곳이 없다.
  const code = fs.readFileSync(path.join(TOWN, 'light.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const numbers = new Set((code.match(/(?<![\w.$])\d+(?:\.\d+)?(?![\w.])/g) || []).map(Number));
  const leaves = v => (Array.isArray(v) ? v.flatMap(leaves) : v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : [v]);
  for (const value of leaves({ keys: LIGHT.keys, rain: LIGHT.rain }).filter(v => v > 1)) assert.ok(!numbers.has(value), `light.mjs에 빛 표의 값 ${value}을 숫자로 썼다`);
});

test('그림자 초점 — 해 방향이 승인된 (−9, 11, 7)이면 옛 식과 같고, 낮은 해는 11m 위·긴 그림자까지 닿는다', async () => {
  const { shadowFocus, sunReach } = await dayLight();
  const length = Math.sqrt(251), horizontal = Math.sqrt(130), rx = 7 / horizontal, rz = 9 / horizontal, ux = 99 / (horizontal * length), uz = -77 / (horizontal * length);
  const old = (x, z, extent, mapSize) => {
    const step = 2 * extent / mapSize, r = Math.round((x * rx + z * rz) / step) * step, u = Math.round((x * ux + z * uz) / step) * step, det = rx * uz - rz * ux;
    return { x: (r * uz - rz * u) / det, z: (rx * u - r * ux) / det, step };
  };
  const d = { x: -9 / length, y: 11 / length, z: 7 / length };
  for (const [x, z, extent, size] of [[0, -2, 14, 2048], [-6.3, 1.1, 5.2, 1024], [3.7, -4.2, 5.2, 2048], [0, -1.75, 23.4, 2048]]) {
    const a = shadowFocus(x, z, extent, size, d), b = old(x, z, extent, size);
    near(a.x, b.x, 1e-9, '초점 x'); near(a.z, b.z, 1e-9, '초점 z'); near(a.step, b.step, 1e-12, '텍셀');
  }
  assert.deepEqual(sunReach(d, 1, 14, 45), { reach: length, far: 45 }, '정오는 그대로');
  assert.deepEqual(sunReach(d, 3, 23.4, 95), { reach: length * 3, far: 95 }, '둘러보기도 그대로');
  const low = { x: -Math.cos(.28) * .97, y: Math.sin(.28), z: Math.cos(.28) * .243 }, n = Math.hypot(low.x, low.y, low.z);
  const unit = { x: low.x / n, y: low.y / n, z: low.z / n }, box = sunReach(unit, 1, 14, 45);
  assert.ok(box.reach * unit.y >= 11 - 1e-9, '해는 초점 위 11m 밑으로 안 내려간다');
  assert.ok(box.far >= box.reach + 14 * Math.hypot(unit.x, unit.z) / unit.y, '긴 그림자까지 상자가 닿는다');
});

test('첫 방문처럼 마을 시간대가 비면 화면이 기기 오프셋을 넘긴다 — 함수는 빈 이력을 받지 않는다', async () => {
  const { lightAt } = await townModule('light');
  assert.throws(() => lightAt({ villageSeed: SEED, tz: [], ms: kst(CLEAR, '12:00') }), RangeError);
  assert.equal(lightAt({ villageSeed: null, tz: 540, ms: kst(CLEAR, '23:45') }).band, 'night');
  // 화면(day-app.mjs)은 빈 이력 대신 검증한 기기 오프셋을 넘기고, 씨앗이 없으면 비만 끈다.
  const app = fs.readFileSync(path.join(ROOT, 'experiences/synk-town/day-app.mjs'), 'utf8');
  assert.match(app, /validOffset\(device\) \? device : null/); assert.match(app, /villageSeed: typeof v\?\.seed === 'string' \? v\.seed : null/);
});

test('공개 직후 캐시에 옛 생성물이 남아도 마을은 뜬다 — 빛 표는 이름 공간으로 읽고, 표가 없으면 lightAt만 거절한다', async () => {
  const { lightAt } = await townModule('light');
  // 이름 있는 가져오기(import { LIGHT })였다면 옛 data.gen.mjs에서 모듈 연결이 실패해 화면 전체가 멈춘다.
  const code = fs.readFileSync(path.join(TOWN, 'light.mjs'), 'utf8');
  assert.match(code, /import \* as generated from '\.\/data\.gen\.mjs'/); assert.doesNotMatch(code, /import \{[^}]*\bLIGHT\b[^}]*\} from/);
  assert.throws(() => lightAt({ tz: 540, ms: kst(CLEAR, '12:00'), light: null }), /no light table/);
  // 화면은 그 거절을 받아 승인된 정오로 둔다(day-app.mjs lightNow의 try/catch).
  assert.match(fs.readFileSync(path.join(ROOT, 'experiences/synk-town/day-app.mjs'), 'utf8'), /try \{ return lightAt\(/);
});
