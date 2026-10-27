'use strict';
// 싱크타운 마을 소리와 SYNK 음악(세로 조각 W7b, 마을 설계 §4-4·인수 기준 11) — 소리 층은 빛·비(lightAt)·한국 날짜의 달·
// 듣는 자리·주민이 깨어 있는지만의 함수이고, 두 갈래는 저마다 자기 스위치만 따르며 마이크가 열려 있거나 창이 숨거나 다른 창이
// 마을을 쥐면 0이다. 켜기는 사람이 직접 누른 것만. 표는 town/data/stay.json 한 장이고 코드는 그 값을 숫자로 쓰지 않는다.
// 씨앗 synk-town: 2026-10-25 맑은 날, 10-29 비 오는 날(W7 시험과 같은 날).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TOWN, townModule, toolModule } = require('./lib/town.js');

const kst = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
const SEED = 'synk-town', KST = [{ fromMs: 0, offsetMin: 540 }];
const BENCH = { x: -5, z: 3.06, sheltered: false }, PORCH = { x: -5.18, z: -0.7, sheltered: true };
const at = async (date, time, listener = BENCH, awake = { 'cafe-owner': true }) => {
  const { lightAt } = await townModule('light'), { soundscapeAt } = await townModule('soundscape');
  const ms = kst(date, time);
  return soundscapeAt({ light: lightAt({ villageSeed: SEED, tz: KST, ms }), ms, listener, awake }).layers;
};
const codeOf = file => fs.readFileSync(path.join(TOWN, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const numbersIn = code => new Set((code.match(/(?<![\w.$])\d+(?:\.\d+)?(?![\w.])/g) || []).map(Number));
const leaves = value => (Array.isArray(value) ? value.flatMap(leaves) : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : [value]);

test('같은 시각·같은 자리면 같은 소리다 — 층은 0~1이고 표의 층이 모두 있다', async () => {
  const { LAYERS } = await townModule('soundscape');
  const { SOUND_LAYERS } = await toolModule('town-data-build');
  assert.deepEqual([...LAYERS].sort(), [...SOUND_LAYERS].sort());
  for (const time of ['00:10', '05:40', '08:30', '12:30', '17:50', '19:45', '22:30']) {
    const a = await at('2026-10-29', time), b = await at('2026-10-29', time);
    assert.deepEqual(a, b);
    for (const name of LAYERS) assert.ok(a[name] >= 0 && a[name] <= 1, `${time} ${name}=${a[name]}`);
  }
});

test('가을 밤은 귀뚜라미, 아침은 새 — 새는 밤에 울지 않고 귀뚜라미는 한낮에 울지 않는다', async () => {
  const night = await at('2026-10-25', '23:45'), morning = await at('2026-10-25', '08:30'), noon = await at('2026-10-25', '12:30');
  assert.ok(night.crickets > .3, `밤 귀뚜라미 ${night.crickets}`); assert.equal(night.birds, 0);
  assert.ok(morning.birds > .3, `아침 새 ${morning.birds}`); assert.equal(noon.crickets, 0);
  // 겨울 밤에는 귀뚜라미가 없고, 개구리는 늦봄·여름 밤에만 연못 쪽에서 난다.
  const winter = await at('2026-01-15', '23:45'), june = await at('2026-06-20', '22:00', { x: 5, z: -3, sheltered: false });
  assert.equal(winter.crickets, 0); assert.equal(night.frogs, 0); assert.ok(june.frogs > .2, `6월 밤 연못 곁 개구리 ${june.frogs}`);
});

test('비가 오면 빗소리가 나고 새·귀뚜라미는 줄어든다 — 처마 밑은 지붕 빗소리, 트인 곳은 바닥 빗소리', async () => {
  const rain = await at('2026-10-29', '14:00'), porch = await at('2026-10-29', '14:00', PORCH), clear = await at('2026-10-25', '14:00');
  assert.ok(rain.rainOpen > .9 && rain.rainRoof === 0, `트인 곳 ${rain.rainOpen}/${rain.rainRoof}`);
  assert.ok(porch.rainRoof > .9 && porch.rainOpen < rain.rainOpen, `처마 밑 ${porch.rainRoof}/${porch.rainOpen}`);
  assert.equal(clear.rainOpen, 0); assert.equal(clear.rainRoof, 0);
  assert.ok(rain.birds < clear.birds / 4, `비 오는 날 새 ${rain.birds} < 맑은 날 ${clear.birds}`);
  const rainNight = await at('2026-10-29', '23:00'), clearNight = await at('2026-10-25', '23:00');
  assert.ok(rainNight.crickets < clearNight.crickets / 2, `비 오는 밤 귀뚜라미 ${rainNight.crickets}`);
});

test('찻집 소리는 주인이 깨어 있을 때만, 찻집에 가까울수록 크다', async () => {
  const near = await at('2026-10-25', '12:30', { x: 0, z: 1.5, sheltered: false }), far = await at('2026-10-25', '12:30', { x: -9, z: 5, sheltered: false });
  const asleep = await at('2026-10-25', '12:30', { x: 0, z: 1.5, sheltered: false }, { 'cafe-owner': false });
  assert.ok(near.cafe > far.cafe && near.cafe > .5, `가까이 ${near.cafe} > 멀리 ${far.cafe}`);
  assert.equal(asleep.cafe, 0);
  assert.ok(near.chime > far.chime, '풍경도 찻집 처마 쪽이 크다');
});

test('걸을 때 모르는 자리는 지붕 표로 처마 밑인지 정한다', async () => {
  const { shelteredAt } = await townModule('soundscape');
  assert.equal(shelteredAt(-6, -1), true, '집 안'); assert.equal(shelteredAt(0, -6.5), true, '온실 안');
  assert.equal(shelteredAt(-5, 3.06), false, '길가 벤치'); assert.equal(shelteredAt(0, 3), false, '골목');
});

test('두 갈래는 자기 스위치만 따른다 — 음악은 앉아 있고 곡이 있을 때만, 걸을 때 마을 소리는 작다', async () => {
  const { busLevels } = await townModule('soundscape');
  const on = { village: true, music: true, owner: true };
  assert.equal(busLevels({ ...on, staying: true, tracks: 0 }).music, 0, '곡이 없으면 음악 없음');
  const seated = busLevels({ ...on, staying: true, tracks: 3 }), walking = busLevels({ ...on, staying: false, tracks: 3 });
  assert.ok(seated.music > 0 && walking.music === 0, '음악은 머무는 동안만');
  assert.ok(walking.village > 0 && walking.village < busLevels({ village: true, staying: true, owner: true, tracks: 0 }).village, '걸을 때 마을 소리는 머물 때보다 작다');
  assert.ok(seated.village < busLevels({ village: true, staying: true, owner: true, tracks: 3 }).village, '음악 밑의 마을 소리는 조금 낮다');
  assert.equal(busLevels({ ...on, village: false, staying: true, tracks: 3 }).village, 0, '마을 소리만 꺼도 음악은 그대로');
  assert.ok(busLevels({ ...on, village: false, staying: true, tracks: 3 }).music > 0);
  assert.equal(busLevels({ ...on, music: false, staying: true, tracks: 3 }).music, 0, '음악만 꺼도 마을 소리는 그대로');
  assert.ok(busLevels({ ...on, music: false, staying: true, tracks: 3 }).village > 0);
  assert.ok(busLevels({ ...on, staying: false, dialog: true }).village < walking.village, '대화 창 밑은 더 작다');
});

test('녹음 중·숨김·다른 창이 마을을 쥐면 둘 다 0이다', async () => {
  const { busLevels, micOpen } = await townModule('soundscape');
  const on = { village: true, music: true, owner: true, staying: true, tracks: 3 };
  for (const off of [{ recording: true }, { hidden: true }, { owner: false }]) assert.deepEqual(busLevels({ ...on, ...off }), { village: 0, music: 0 }, JSON.stringify(off));
  const { STAY } = await import(require('node:url').pathToFileURL(path.join(TOWN, 'data.gen.mjs')).href);
  const stale = STAY.sound.record.staleMs, beat = STAY.sound.record.heartbeatMs;
  assert.equal(micOpen({ heardAt: 1000, now: 1000 + beat }), true, '열렸다는 말 뒤 맥박 사이는 열림');
  assert.equal(micOpen({ heardAt: 1000, closedAt: 2000, now: 2500 }), false, '닫혔다는 말 뒤는 닫힘');
  assert.equal(micOpen({ heardAt: 3000, closedAt: 2000, now: 3500 }), true, '다시 열리면 열림');
  assert.equal(micOpen({ heardAt: 1000, now: 1000 + stale }), false, '말이 끊긴 지 오래면(창이 죽음) 닫힘으로 본다');
  assert.equal(micOpen({ now: 5 }), false);
});

test('끈 소리는 사람이 직접 켜야만 켜진다 — 다른 무엇도 되살리지 않는다', async () => {
  const { prefAfter } = await townModule('soundscape');
  assert.equal(prefAfter({ current: false, wanted: true }), false, '신뢰된 입력 없이 켜기 거절');
  assert.equal(prefAfter({ current: false, wanted: true, trusted: 'yes' }), false, '참 값이 아니면 거절');
  assert.equal(prefAfter({ current: false, wanted: true, trusted: true }), true, '직접 누르면 켜짐');
  assert.equal(prefAfter({ current: true, wanted: false }), false, '끄기는 언제나');
  assert.equal(prefAfter({ current: true, wanted: true }), true, '켜진 것은 그대로');
});

test('소리 표의 값은 코드에 숫자로 없다 — soundscape·stay는 표에서만 읽는다', async () => {
  const { STAY } = await import(require('node:url').pathToFileURL(path.join(TOWN, 'data.gen.mjs')).href);
  for (const [file, section] of [['soundscape.mjs', STAY.sound], ['stay.mjs', { quiet: STAY.quiet, seats: STAY.seats }]]) {
    const numbers = numbersIn(codeOf(file));
    for (const value of leaves(section).filter(v => typeof v === 'number' && v > 31)) assert.ok(!numbers.has(value), `${file}에 표의 값 ${value}을 숫자로 썼다`);
  }
});

test('곡 목록 검사 — 빈 목록은 음악 없는 공개, 곡은 Suno 유료 계정의 공식 내려받기본만', async () => {
  const { validateMusic } = await toolModule('town-data-build');
  assert.doesNotThrow(() => validateMusic({ musicVer: 'town-music-1', tracks: [] }));
  const sha = 'a'.repeat(64), track = { id: 'quiet-morning', title: '아침 햇살', file: 'assets/music/quiet-morning-aaaaaaaa.mp3', durationMs: 158000, bytes: 2500000, fileSha256: sha,
    lufsTenths: -160, peakTenths: -15, rights: 'suno-paid-official-download', source: { ledger: 4, original: 'Quiet Morning Light.wav', sha256: sha, suno: { id: '676b506d-b475-43e0-9d6f-d519f11623bd', created: '2026-09-07T21:58:56Z' } } };
  assert.doesNotThrow(() => validateMusic({ musicVer: 'town-music-1', tracks: [track] }));
  assert.throws(() => validateMusic({ musicVer: 'town-music-1', tracks: [{ ...track, rights: 'unknown' }] }), /권리/);
  assert.throws(() => validateMusic({ musicVer: 'town-music-1', tracks: [{ ...track, source: { ...track.source, suno: null } }] }), /권리/);
  assert.throws(() => validateMusic({ musicVer: 'town-music-1', tracks: [{ ...track, file: 'assets/music/other.mp3' }] }), /파일/);
  assert.throws(() => validateMusic({ musicVer: 'town-music-1', tracks: [track, track] }), /곡/);
});

test('소리 표 검사 — 층·빛 기준점·열두 달·처마·소리 나는 곳', async () => {
  const { validateStay } = await toolModule('town-data-build');
  const { STAY } = await import(require('node:url').pathToFileURL(path.join(TOWN, 'data.gen.mjs')).href);
  const good = () => structuredClone({ ...STAY });
  assert.doesNotThrow(() => validateStay(good()));
  const broken = edit => { const d = good(); edit(d); return () => validateStay(d); };
  assert.throws(broken(d => { delete d.sound.layers.crickets; }), /layers/);
  assert.throws(broken(d => { d.sound.layers.birds.month.pop(); }), /열두 달/);
  assert.throws(broken(d => { delete d.sound.layers.birds.time.noon; }), /기준점/);
  assert.throws(broken(d => { d.sound.layers.frogs.source.far = d.sound.layers.frogs.source.near; }), /source/);
  assert.throws(broken(d => { d.sound.record.staleMs = d.sound.record.heartbeatMs; }), /record/);
  assert.throws(broken(d => { d.quiet.wakeLock = 2; }), /quiet/);
  assert.throws(broken(d => { d.seats.push({ ...d.seats[0] }); }), /자리/);
});

test('화면에 가는 곡 목록은 재생에 쓰는 칸만 — 곡의 출처·권리 기록과 제작 도구 이름은 저장소의 music.json에만 남는다', async () => {
  const { TRACKS } = await townModule('soundscape');
  const listed = JSON.parse(fs.readFileSync(path.join(TOWN, 'data/music.json'), 'utf8')).tracks;
  assert.equal(TRACKS.length, listed.length, '실은 곡이 모두 화면에 간다');
  for (const track of TRACKS) assert.deepEqual(Object.keys(track).sort(), ['durationMs', 'file', 'id', 'title'], track.id);
  assert.doesNotMatch(fs.readFileSync(path.join(TOWN, 'data.gen.mjs'), 'utf8'), /suno/i, '공개되는 생성물에 제작 도구 이름이 없다');
});
