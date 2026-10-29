#!/usr/bin/env node
/** 싱크타운 데이터 생성물 — 찻집 골목의 하루 세로 조각 설계 §2-5.
 *
 *   node tools/town-data-build.mjs           experiences/synk-town/town/data/*.json을 검사해 town/data.gen.mjs를 다시 쓴다
 *   node tools/town-data-build.mjs --check   생성물이 원천과 같은지 본다(다르면 「Stale town data」, 종료 1)
 *
 * 브라우저·talk 묶음은 JSON 대신 이 생성물을 읽는다(브라우저 모듈은 JSON을 바로 못 부르고, talk는 esbuild로 묶는다).
 * 원천을 고치면 생성물을 같은 커밋에 올린다 — 바로올리기의 짝검사와 tests/town-places.test.js가 낡은 생성물을 막는다.
 * 원고(data/lines)는 마음 한 줄(kind mood, W4)과 W5의 카드·전해 듣기·쌍·소식 줄을 싣는다 — 화면이 그 판을 그리고 서버가 「본 것」 키로 받는다. 금지 말·판 길이는
 * 원고 검사기(tools/town-lines-check.mjs)가 보고, 허용 목록(lines-allow.json)도 검사기만 읽는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { teaAssessmentMetadata, TEA_REVIEW_EVIDENCE } from './lib/town-tea-review-unit.mjs';
import { LIGHT_KEYS } from '../experiences/synk-town/town/clock.mjs';
import { FAMILIES as LIFE_FAMILIES } from '../experiences/synk-town/town/events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'experiences/synk-town/town/data');
export const TARGET = path.join(ROOT, 'experiences/synk-town/town/data.gen.mjs');

const OWNERS = ['player', 'public', 'cafe-owner', 'workshop-owner', 'researcher'];
const SPOT_KINDS = ['sit', 'work', 'entrance', 'sign', 'walk', 'display', 'stand', 'gather'];
const fail = message => { throw new Error(`town data: ${message}`); };
const point = (value, where) => {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z) || Object.keys(value).some(k => !['x', 'z'].includes(k))) fail(`${where}는 { x, z } 좌표여야 해요.`);
};

export function validatePlaces(data) {
  if (!data || !Array.isArray(data.places) || !Array.isArray(data.spots)) fail('places.json에는 places·spots가 있어요.');
  const places = new Set();
  for (const place of data.places) {
    if (!/^[a-z][a-z0-9-]*$/.test(place.id ?? '') || places.has(place.id)) fail(`장소 ID ${place.id}`);
    places.add(place.id);
    // A region is loaded on its own, one at a time (§20-9); code never assumes every place is in one scene.
    if (!/^[a-z][a-z0-9-]*$/.test(place.area ?? '')) fail(`${place.id}.area`);
    if (typeof place.player !== 'boolean') fail(`${place.id}.player`);
    if (!['text', 'scene', 'map'].every(k => typeof place.labels?.[k] === 'string' && place.labels[k])) fail(`${place.id}.labels`);
    point(place.center, `${place.id}.center`);
    if (place.player) point(place.spawn, `${place.id}.spawn`); else if (place.spawn !== null) fail(`${place.id}.spawn은 플레이어 장소에만 있어요.`);
  }
  const spots = new Set();
  for (const spot of data.spots) {
    const id = spot.id ?? '';
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id) || spots.has(id)) fail(`자리 ID ${id}`);
    spots.add(id);
    if (!places.has(spot.place) || id.split('.')[0] !== spot.place) fail(`${id}의 장소`);
    if (!SPOT_KINDS.includes(spot.kind)) fail(`${id}.kind`);
    if (!Number.isSafeInteger(spot.capacity) || spot.capacity < 1) fail(`${id}.capacity`);
    if (typeof spot.sheltered !== 'boolean' || typeof spot.measured !== 'boolean') fail(`${id}.sheltered·measured`);
    if (!OWNERS.includes(spot.owner)) fail(`${id}.owner`);
    point(spot.at, `${id}.at`);
    if (spot.legacy2d && (!Number.isFinite(spot.legacy2d.x) || !Number.isFinite(spot.legacy2d.y))) fail(`${id}.legacy2d`);
    if (spot.ftSeat !== undefined && (!['inside', 'outside'].includes(spot.branch) || !spot.legacy2d || spot.branch !== (spot.sheltered ? 'inside' : 'outside'))) fail(`${id}: FT 자리는 branch(비를 피하면 inside)와 legacy2d가 있어요.`);
    if (spot.signSlot !== undefined && !spot.legacy2d) fail(`${id}: 안내판 자리는 legacy2d가 있어요.`);
    // Gather spots are the player's own anchors (§20-8); residents' picking keeps its own spot.
    if (spot.kind === 'gather' && (spot.owner !== 'player' || spot.ftSeat !== undefined || spot.signSlot !== undefined)) fail(`${id}: 채집 자리는 플레이어 자리예요.`);
  }
  for (const spot of data.spots) for (const other of spot.rainAltFor || []) {
    if (!spots.has(other)) fail(`${spot.id}.rainAltFor ${other}`);
    if (!spot.sheltered) fail(`${spot.id}: 비 올 때 대안 자리는 비를 피해야 해요.`);
  }
  for (const [name, members] of Object.entries(data.groups || {})) {
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(name) || spots.has(name)) fail(`묶음 이름 ${name}`);
    if (!Array.isArray(members) || !members.length || members.some(id => !spots.has(id))) fail(`묶음 ${name}`);
  }
  return data;
}

const BANDS = ['morning', 'day', 'evening', 'night'];
const DAY_KINDS = ['weekday', 'weekend', 'off'];
const KINDS = ['work', 'rest', 'walk', 'show', 'carry', 'talk'];
const POSES = ['working', 'walking', 'talking', 'resting', 'showing', 'holding', 'standing'];
const OBJECTS = ['cafe-tray', 'leaf-jar', 'tools', 'workshop-support', 'observation-board'];
const integer = (value, min = -Infinity, max = Infinity) => Number.isSafeInteger(value) && value >= min && value <= max;

export function validateArchetypes(data, places) {
  const spots = new Set(places.spots.map(s => s.id)), seen = new Set();
  if (!Array.isArray(data?.archetypes)) fail('archetypes.json에는 archetypes가 있어요.');
  for (const a of data.archetypes) {
    if (!/^[a-z][a-z0-9-]*$/.test(a.id ?? '') || seen.has(a.id)) fail(`원형 ID ${a.id}`);
    seen.add(a.id);
    if (!KINDS.includes(a.kind) || !POSES.includes(a.pose) || typeof a.label !== 'string') fail(`${a.id}.kind·pose·label`);
    if (!Array.isArray(a.length) || a.length.length !== 2 || !integer(a.length[0], 1) || !integer(a.length[1], a.length[0])) fail(`${a.id}.length`);
    if (!['energy', 'chores', 'social'].every(k => integer(a[k], -100, 100))) fail(`${a.id}의 상태 변화`);
    if (a.choresEvery !== undefined && !integer(a.choresEvery, 2)) fail(`${a.id}.choresEvery`);
    if (a.wear !== undefined && !OBJECTS.includes(a.wear)) fail(`${a.id}.wear`);
    if (a.moves !== undefined && (!OBJECTS.includes(a.moves.object) || !(a.moves.to === 'spot' || spots.has(a.moves.to)))) fail(`${a.id}.moves`);
    // W4 (§7-1): needs — the chores it works off must be there (a waiting guest, an order); visit — a neighbour visit lonely raises.
    if (a.needs !== undefined && !['guests', 'orders'].includes(a.needs)) fail(`${a.id}.needs`);
    if (a.needs !== undefined && !(a.chores < 0)) fail(`${a.id}.needs는 할 일을 줄이는 원형에만 있어요.`);
    if (a.visit !== undefined && a.visit !== true) fail(`${a.id}.visit`);
  }
  return data;
}

/** The planner's factors a resident's mood table may name (§7-3): weather, state and neighbours, and (W5) a card ID
 * — the card made its owner do its solving — or what a card brings: a neighbour's doing, a forerunner, the day after R4. */
export const MOOD_FACTORS = Object.freeze(['rain', 'cold-hands', 'tomorrow-clear', 'first-aroma', 'tomorrow-rain', 'tired', 'doze', 'busy', 'lonely',
  'pair-glad', 'tea-received', 'wobble-spotted', 'with-player-glad', 'sleepy-night', 'excited-find']);
const CARD_ID = /^[CWR][1-6]$/;
const REASON = /^[a-z][a-z0-9-]*$/;

export function validateResidents(data, places, archetypes = { archetypes: [] }) {
  const spots = new Set(places.spots.map(s => s.id)), seen = new Set(), archetypeIds = new Set(archetypes.archetypes.map(a => a.id));
  if (!Array.isArray(data?.residents)) fail('residents.json에는 residents가 있어요.');
  for (const r of data.residents) {
    if (!['cafe-owner', 'workshop-owner', 'researcher'].includes(r.id) || seen.has(r.id)) fail(`주민 ID ${r.id}`);
    seen.add(r.id);
    if (typeof r.label !== 'string' || !spots.has(r.home)) fail(`${r.id}.label·home`);
    if (!integer(r.wake?.default, 0, 1439) || (r.wake.off !== undefined && !integer(r.wake.off, 0, 1439))) fail(`${r.id}.wake`);
    if (!integer(r.sleep, r.wake.default + 60, 1439)) fail(`${r.id}.sleep`);
    for (const [band, minute] of Object.entries({ ...(r.habitSleep || {}), ...(r.habitWake || {}) })) if (!BANDS.includes(band) || !integer(minute, 0, 1439)) fail(`${r.id}의 습관 시각`);
    if (!(r.offWeekday === null || integer(r.offWeekday, 0, 6))) fail(`${r.id}.offWeekday`);
    if (!integer(r.restThreshold, 0, 100)) fail(`${r.id}.restThreshold`);
    if (!r.multipliers || Object.values(r.multipliers).some(v => !integer(v, 0, 10000))) fail(`${r.id}.multipliers`);
    if (r.crowdedRest !== undefined && !integer(r.crowdedRest, 0, 10000)) fail(`${r.id}.crowdedRest`);
    // W4 (§7-1·§7-3): what the resident's chores are, where it dozes when tired, and which factor shows which mood line.
    if (!['guests', 'orders', 'observations'].includes(r.chores)) fail(`${r.id}.chores`);
    if (r.dozeSpot !== undefined && !spots.has(r.dozeSpot) && !Object.hasOwn(places.groups || {}, r.dozeSpot)) fail(`${r.id}.dozeSpot`);
    if (!Array.isArray(r.moods)) fail(`${r.id}.moods`);
    const known = { chosenKinds: KINDS, chosenArchetypes: archetypeIds, baseArchetypes: archetypeIds, bands: BANDS };
    for (const m of r.moods) {
      if (!(MOOD_FACTORS.includes(m.factor) || CARD_ID.test(m.factor)) || !REASON.test(m.tag ?? '') || Object.keys(m).some(k => !['factor', 'tag', ...Object.keys(known)].includes(k))) fail(`${r.id}의 마음 ${m.factor}·${m.tag}`);
      for (const [k, allowed] of Object.entries(known)) {
        const has = value => (allowed instanceof Set ? allowed.has(value) : allowed.includes(value));
        if (m[k] !== undefined && !(Array.isArray(m[k]) && m[k].length && m[k].every(has))) fail(`${r.id}의 마음 ${m.tag}.${k}`);
      }
    }
    if (new Set(r.moods.map(m => m.factor)).size !== r.moods.length) fail(`${r.id}의 마음 표에 같은 요인이 둘이에요.`);
  }
  if (seen.size !== 3) fail('주민은 셋이에요.');
  return data;
}

/** Validates the routine tables and resolves sameAs, so callers read every cell directly. */
export function validateRoutines(data, places, archetypes, residents) {
  const spots = new Set(places.spots.map(s => s.id)), groups = places.groups || {}, kinds = new Set(archetypes.archetypes.map(a => a.id));
  const spotOrGroup = name => spots.has(name) || Object.hasOwn(groups, name);
  const sheltered = name => (groups[name] || [name]).every(id => places.spots.find(s => s.id === id)?.sheltered === true);
  for (const [from, to] of Object.entries(data?.rainAlt || {})) if (!spotOrGroup(from) || !spotOrGroup(to) || !sheltered(to)) fail(`비 대안 ${from} → ${to}`);
  const cells = new Map();
  const pool = (list, where) => {
    if (!Array.isArray(list) || !list.length) fail(`${where}의 활동`);
    for (const item of list) if (!kinds.has(item.archetype) || !spotOrGroup(item.spot) || !integer(item.weight, 1, 10000)) fail(`${where}: ${item.archetype}@${item.spot}`);
    return list;
  };
  for (const cell of data.routines || []) {
    const key = `${cell.npc}|${cell.dayKind}|${cell.band}`, where = `일과표 ${key}`;
    if (!residents.residents.some(r => r.id === cell.npc) || !DAY_KINDS.includes(cell.dayKind) || !BANDS.includes(cell.band) || cells.has(key)) fail(where);
    if (cell.sameAs === undefined) pool(cell.pool, where);
    else if (!DAY_KINDS.includes(cell.sameAs) || cell.pool !== undefined) fail(`${where}.sameAs`);
    for (const [band, list] of Object.entries(cell.habitPool || {})) { if (!BANDS.includes(band)) fail(`${where}.habitPool`); pool(list, `${where} 습관`); }
    cells.set(key, cell);
  }
  const resolved = [];
  for (const r of residents.residents) for (const dayKind of DAY_KINDS) for (const band of BANDS) {
    if (dayKind === 'off' && r.offWeekday === null) continue;
    let cell = cells.get(`${r.id}|${dayKind}|${band}`);
    if (!cell) fail(`일과표 ${r.id}|${dayKind}|${band}이 없어요.`);
    if (cell.sameAs) cell = cells.get(`${r.id}|${cell.sameAs}|${band}`);
    if (!cell || cell.sameAs) fail(`일과표 ${r.id}|${dayKind}|${band}의 sameAs`);
    resolved.push({ npc: r.id, dayKind, band, pool: cell.pool, ...(cell.habitPool ? { habitPool: cell.habitPool } : {}) });
  }
  return { rainAlt: data.rainAlt || {}, routines: resolved };
}

/** Parameter versions (§20-6): every version carries the same names, so code reads any of them by name. */
export function validateParams(data) {
  if (!Array.isArray(data?.versions) || !data.versions.length) fail('params.json에는 versions가 있어요.');
  // The names (keys and array lengths) a version must have, without the values.
  const names = value => (Array.isArray(value) ? value.map(names) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, names(value[k])])) : typeof value);
  const leaves = (value, where) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) { for (const [k, x] of Object.entries(value)) leaves(x, `${where}.${k}`); return; }
    // Values are non-negative integers (per-mille for multipliers, §2-4); only a speed in m/s may be a fraction.
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!Number.isSafeInteger(value) && !where.endsWith('Speed'))) fail(`${where}`);
  };
  const seen = new Set(), first = JSON.stringify(names({ ...data.versions[0], paramsVer: null }));
  for (const version of data.versions) {
    const { paramsVer, ...values } = version;
    if (!/^town-params-[1-9][0-9]*$/.test(paramsVer ?? '') || seen.has(paramsVer)) fail(`판 이름 ${paramsVer}`);
    seen.add(paramsVer);
    leaves(values, paramsVer);
    if (JSON.stringify(names({ ...version, paramsVer: null })) !== first) fail(`${paramsVer}의 이름이 첫 판과 달라요.`);
  }
  return data;
}

/** Time-of-day light (W7, §2-2): one table, not a parameter version. Every key has the noon key's names; values are
 * non-negative integers (per-mille, degrees, minutes); a ramp or a time the code divides by is at least 1. */
export function validateLight(data) {
  if (!/^town-light-[1-9][0-9]*$/.test(data?.lightVer ?? '')) fail('light.json의 lightVer');
  const ids = LIGHT_KEYS.map(key => key.id), keys = data.keys || {};
  if (JSON.stringify(Object.keys(keys).sort()) !== JSON.stringify([...ids].sort())) fail(`light.json의 keys는 ${ids.join('·')}예요.`);
  const names = value => (Array.isArray(value) ? value.map(names) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, names(value[k])])) : typeof value);
  const leaves = (value, where) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) { for (const [k, x] of Object.entries(value)) leaves(x, `${where}.${k}`); return; }
    if (!Number.isSafeInteger(value) || value < 0) fail(`light.json ${where}`);
  };
  const noon = JSON.stringify(names(keys.noon));
  for (const id of ids) {
    const key = keys[id];
    if (JSON.stringify(names(key)) !== noon) fail(`light.json ${id}의 이름이 noon과 달라요.`);
    leaves(key, id);
    if (key.rampMinutes < 1 || key.sunElevation < 1 || key.sunElevation > 89 || key.sunAzimuth > 359) fail(`light.json ${id}의 ramp·고도·방위`);
    for (const name of ['sunColor', 'hemiSky', 'hemiGround', 'overlayTop', 'overlayHorizon', 'fog']) if (key[name].length !== 3 || key[name].some(v => v > 1000)) fail(`light.json ${id}.${name}는 sRGB 천분율 셋이에요.`);
    for (const name of ['bakedSky', 'bakedSun']) if (key[name].length !== 3) fail(`light.json ${id}.${name}는 선형 배수 셋이에요.`);
  }
  leaves(data.rain, 'rain');
  for (const name of ['rampSeconds', 'overcastLeadMinutes', 'wetInMinutes', 'dryMinutes', 'radius', 'height']) if (!(data.rain?.[name] >= 1)) fail(`light.json rain.${name}`);
  if (data.rain.bakedSky?.length !== 3) fail('light.json rain.bakedSky');
  return data;
}

/** The sound layers the screen knows how to make (W7b, day-sound.mjs): the table names each of them, no other. */
export const SOUND_LAYERS = Object.freeze(['wind', 'rainOpen', 'rainRoof', 'drip', 'chime', 'birds', 'crickets', 'frogs', 'cafe']);
/** Staying (W7b, village design §4-4): the seats, the quiet drawing while seated and the village's sound mix. Lengths
 * are millimetres (coordinates may be negative), shares per-mille, times milliseconds, angles degrees. A seat names a
 * walking solid for its place (walk.mjs — tests/town-stay.test.js checks it exists). */
export function validateStay(data) {
  if (!/^town-stay-[1-9][0-9]*$/.test(data?.stayVer ?? '')) fail('stay.json의 stayVer');
  if (!Array.isArray(data.seats) || !data.seats.length) fail('stay.json에는 seats가 있어요.');
  const ids = new Set(), ints = (list, n, min, max) => Array.isArray(list) && list.length === n && list.every(v => integer(v, min, max));
  for (const seat of data.seats) {
    if (!/^[a-z][a-z0-9-]*$/.test(seat.id ?? '') || ids.has(seat.id)) fail(`자리 ${seat.id}`);
    ids.add(seat.id);
    if (typeof seat.label !== 'string' || !seat.label || !/^[a-z][a-z0-9-]*$/.test(seat.solid ?? '')) fail(`${seat.id}.label·solid`);
    if (!integer(seat.seatTop, 0, 3000) || !ints(seat.sit, 2, -2000, 2000) || !integer(seat.heading, 0, 359) || !integer(seat.reach, 1, 5000) || typeof seat.sheltered !== 'boolean') fail(`${seat.id}의 높이·앉는 곳·방향·범위·처마`);
    const c = seat.camera || {};
    if (!ints(c.look, 3, -20000, 20000) || !ints(c.dir, 3, -20000, 20000) || c.dir.every(v => v === 0)
      || !integer(c.width, 1, 60000) || !integer(c.portraitWidth, 1, c.width) || !integer(c.height, 1, 60000) || !integer(c.fov, 10, 90)) fail(`${seat.id}.camera`);
  }
  const q = data.quiet || {};
  // The pulse stays under the presence lease (3 s, presence.mjs): a seated window keeps its walk clock and play time.
  if (!integer(q.fps, 1, 60) || !integer(q.appHz, 1, 60) || !integer(q.idleHz, 1, q.appHz) || !integer(q.pixelRatio, 250, 3000) || !integer(q.pulseMs, 1000, 2999) || !integer(q.lightMs, 1000, 60000)
    || !integer(q.dimDay, 0, 1000) || !integer(q.dimNight, 0, 1000) || !integer(q.dimInMs, 0, 60000) || !integer(q.cardMs, 1000, 60000) || ![0, 1].includes(q.wakeLock)) fail('stay.json quiet');
  const s = data.sound || {};
  if (!['walk', 'stay', 'dialog', 'underMusic', 'music'].every(k => integer(s.bus?.[k], 0, 1000))) fail('stay.json sound.bus');
  if (!['layerMs', 'hideMs', 'muteMs', 'resumeMs', 'musicMs'].every(k => integer(s.fade?.[k], 1, 60000))) fail('stay.json sound.fade');
  if (!integer(s.record?.heartbeatMs, 1000, 60000) || !integer(s.record?.staleMs, s.record.heartbeatMs + 1, 600000)) fail('stay.json sound.record');
  if (!Array.isArray(s.shelters) || s.shelters.some(r => !ints(r, 4, -30000, 30000) || r[0] >= r[2] || r[1] >= r[3])) fail('stay.json sound.shelters');
  const keys = LIGHT_KEYS.map(key => key.id), layers = s.layers || {};
  if (JSON.stringify(Object.keys(layers).sort()) !== JSON.stringify([...SOUND_LAYERS].sort())) fail(`stay.json sound.layers는 ${SOUND_LAYERS.join('·')}예요.`);
  for (const [name, layer] of Object.entries(layers)) {
    const where = `stay.json sound.layers.${name}`;
    if (!['always', 'drops', 'wet'].includes(layer.driver) || !integer(layer.gain, 0, 1000)) fail(`${where}.driver·gain`);
    if (JSON.stringify(Object.keys(layer.time || {}).sort()) !== JSON.stringify([...keys].sort()) || keys.some(k => !integer(layer.time[k], 0, 1000))) fail(`${where}.time은 빛 기준점 일곱이에요.`);
    if (!ints(layer.month, 12, 0, 1000)) fail(`${where}.month는 열두 달이에요.`);
    if (!['drops', 'overcast', 'wet'].every(k => integer(layer.weather?.[k], 0, 5000))) fail(`${where}.weather`);
    if (!ints(layer.shelter, 2, 0, 1000)) fail(`${where}.shelter`);
    if (layer.source !== undefined && (!ints(layer.source.at, 2, -30000, 30000) || !integer(layer.source.near, 0, 60000) || !integer(layer.source.far, layer.source.near + 1, 60000))) fail(`${where}.source`);
    if (layer.awake !== undefined && !['cafe-owner', 'workshop-owner', 'researcher'].includes(layer.awake)) fail(`${where}.awake`);
  }
  return data;
}

/** SYNK music for staying (W7b): the songs Yuho chose, each made from its original by tools/town-music-build.mjs.
 * An empty list is a release without music (the screen shows no music switch). */
export function validateMusic(data) {
  if (!/^town-music-[1-9][0-9]*$/.test(data?.musicVer ?? '')) fail('music.json의 musicVer');
  if (!Array.isArray(data.tracks)) fail('music.json에는 tracks가 있어요.');
  const ids = new Set(), sha = value => /^[0-9a-f]{64}$/.test(value ?? '');
  for (const t of data.tracks) {
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(t.id ?? '') || ids.has(t.id)) fail(`곡 ${t.id}`);
    ids.add(t.id);
    // The file name carries its hash: a song never changes under the same name, so it can be cached for good.
    if (typeof t.title !== 'string' || !t.title || !sha(t.fileSha256) || t.file !== `assets/music/${t.id}-${t.fileSha256.slice(0, 8)}.mp3`) fail(`곡 ${t.id}의 제목·파일`);
    if (!integer(t.durationMs, 1000, 3600000) || !integer(t.bytes, 1, 50000000) || !sha(t.fileSha256)) fail(`곡 ${t.id}의 길이·크기·해시`);
    if (!integer(t.lufsTenths, -400, 0) || !integer(t.peakTenths, -200, 0)) fail(`곡 ${t.id}의 음량`);
    if (!integer(t.source?.ledger, 1, 999) || typeof t.source.original !== 'string' || !sha(t.source.sha256)) fail(`곡 ${t.id}의 원본`);
    if (t.rights !== 'suno-paid-official-download' || !/^[0-9a-f-]{36}$/.test(t.source.suno?.id ?? '')) fail(`곡 ${t.id}의 권리(Suno 유료 계정의 공식 내려받기본만)`);
  }
  return data;
}

/** The mood lines the screen shows (§7-3, W4): one record per line with its four levels and picture; every
 * tag a resident's mood table names has its first variant. The checker (town-lines-check) owns the wording rules. */
/** The life activities a card's 「나와 함께」 may open (town/activities). */
export const ACTIVITY_IDS = Object.freeze(['tea-order']);
/** The tea order's word table (town/data/tea.json, W8): the three axes and their forms, the guests and where they stand. */
export const TEA_AXES = Object.freeze({ tea: ['name'], temp: ['adn', 'adv', 'cup'], sweet: ['adn', 'adv', 'honey', 'spoons'] });
export const TEA_SLOTS = Object.freeze(['tea', 'temp.adn', 'temp.adv', 'sweet.adn', 'sweet.adv', 'sweet.honey']);
export function validateTea(data) {
  const text = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 20;
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= 14 && Math.abs(p.z) <= 13;
  for (const [axis, forms] of Object.entries(TEA_AXES)) {
    const values = data?.axes?.[axis];
    if (!values || !Object.keys(values).length || !Object.values(values).every(v => forms.every(form => text(v[form])))) fail(`tea.json axes.${axis}`);
  }
  const keys = axis => Object.keys(data.axes[axis]).sort().join();
  if (keys('tea') !== 'barley,today,yuzu' || keys('temp') !== 'cold,warm' || keys('sweet') !== '0,1,2') fail('tea.json의 축 값(차 셋 · 온도 둘 · 단맛 셋)');
  if (!Object.values(data.axes.tea).every(v => /^#[0-9a-f]{6}$/.test(v.color ?? ''))) fail('tea.json 차 색');
  // 축 문구 수준별(W10): L3 · L4만, 온도 · 단맛의 있는 값에 그 축의 말 꼴만. L1 · L2는 검수한 요청 틀 단위가 axes를 품어 두지 않는다.
  for (const [level, byAxis] of Object.entries(data.phrases || {})) {
    if (level === '$comment') continue;
    if (!['L3', 'L4'].includes(level) || !byAxis || typeof byAxis !== 'object') fail(`tea.json phrases.${level}(L3 · L4만)`);
    for (const [axis, values] of Object.entries(byAxis)) {
      const forms = { temp: ['adn', 'adv'], sweet: ['adn', 'adv', 'honey'] }[axis];
      if (!forms || !values || typeof values !== 'object') fail(`tea.json phrases.${level}.${axis}(온도 · 단맛만)`);
      for (const [value, words] of Object.entries(values)) {
        if (!Object.hasOwn(data.axes[axis], value) || !words || !Object.entries(words).length || !Object.entries(words).every(([form, w]) => forms.includes(form) && text(w))) fail(`tea.json phrases.${level}.${axis}.${value}`);
      }
    }
  }
  const g = data.guests || {}, looks = [g.regular, ...(g.walkers || [])];
  if (!word(g.regular) || !Array.isArray(g.walkers) || g.walkers.length !== 2 || new Set(looks).size !== 3 || !looks.every(id => word(id) && text(g.labels?.[id]))) fail('tea.json guests');
  if (!['a', 'b', 'out'].every(k => point(data.stand?.[k]))) fail('tea.json stand');
  return data;
}
/** The tea order's lines (kind tea, W8): request frames (part request — the axes they settle, the values they fix, the
 * level they are written for, the axis 「같은 걸로」 borrows), the guests' answers, the regular's, the cafe owner's.
 * Every blank is a form of the table, and all four levels name the same axes. The checker owns lengths and words. */
export function validateTeaLines(docs, tea) {
  const lines = docs.flat().filter(entry => entry?.kind === 'tea'), ids = new Set(), axes = Object.keys(TEA_AXES), LV = ['L1', 'L2', 'L3', 'L4'];
  const valueOk = (axis, value) => Object.hasOwn(tea.axes[axis], String(value)) && (axis !== 'sweet' || Number.isSafeInteger(value));
  const slotAxes = text => [...String(text).matchAll(/\{([a-z]+(?:\.[a-z]+)?)\}/g)].map(m => { if (!TEA_SLOTS.includes(m[1])) fail(`찻집 줄의 빈칸 {${m[1]}}`); return m[1].split('.')[0]; });
  for (const e of lines) {
    const [npc, kind, key, n] = String(e.id).split('.'), w = e.when || {};
    if (kind !== 'tea' || !/^\d+$/.test(n ?? '') || !/^[a-z][a-z0-9-]*$/.test(key ?? '') || ids.has(e.id) || e.npc !== npc || !LV.every(l => typeof e.levels?.[l] === 'string')) fail(`찻집 줄 ${e.id}`);
    ids.add(e.id);
    const blanks = LV.map(l => [...new Set(slotAxes(e.levels[l]))].sort().join());
    // 「같은 걸로」의 L1은 빌린 차를 풀어 말하고(「무슨 뜻이에요?」), 위 판은 「같은 차로」라 그 축만 빈칸에서 빠진다.
    const borrowed = w.part === 'request' ? w.same : undefined, drop = list => list.split(',').filter(a => a && a !== borrowed).join();
    if (new Set(blanks.map(drop)).size !== 1 || borrowed && !blanks[0].split(',').includes(borrowed)) fail(`찻집 줄 ${e.id}의 네 판 빈칸이 달라요.`);
    const named = blanks[0].split(',').filter(Boolean);
    if (w.part === 'request') {
      if (npc !== 'guest' || !LV.includes(w.home) || !Array.isArray(w.axes) || !w.axes.length || !w.axes.every(a => axes.includes(a)) || new Set(w.axes).size !== w.axes.length
        || (w.fixed !== undefined && !Object.entries(w.fixed).every(([a, v]) => w.axes.includes(a) && valueOk(a, v)))
        || (w.same !== undefined && !(w.same === 'tea' && w.axes.includes('tea') && w.axes.length > 1 && !Object.hasOwn(w.fixed || {}, 'tea')))) fail(`요청 틀 ${e.id}`);
      // The blanks name exactly the axes the frame settles that it does not fix (the borrowed tea is named too).
      const open = w.axes.filter(a => !Object.hasOwn(w.fixed || {}, a)).sort().join();
      if (named.join() !== open) fail(`요청 틀 ${e.id}의 빈칸(${named.join()})이 정할 축(${open})과 달라요.`);
    } else if (w.part === 'react') {
      // W10: a cup made again after a miss is thanked as such (again — no free axis).
      const ok = npc === 'guest' && (w.is === 'match' && (w.free === undefined && (w.again === undefined || w.again === true) || w.again === undefined && (w.free === 'sweet' && valueOk('sweet', w.value) || w.free === 'temp' && valueOk('temp', w.value)))
        || w.is === 'differ' && (w.axis === 'tea' || w.axis === 'temp' && valueOk('temp', w.want) || w.axis === 'sweet' && ['less', 'more'].includes(w.dir)) || w.is === 'takeaway'
        // W8b: a guest pleased with the tea of the day the player's gift made — one line per tea a gift makes.
        || w.is === 'today' && ['green', 'mint', 'chrysanthemum'].includes(w.tea));
      if (!ok || (named.length && !(w.is === 'differ' && w.axis === 'tea' && named.join() === 'tea'))) fail(`찻집 반응 ${e.id}`);
    } else if (w.part === 'regular') { if (npc !== 'guest' || !['usual', 'match'].includes(w.is) || named.length) fail(`단골 줄 ${e.id}`); }
    else if (w.part === 'owner') { if (npc !== 'cafe-owner' || !['offer', 'took', 'finish', 'done'].includes(w.is) || named.length) fail(`주인 줄 ${e.id}`); }
    else fail(`찻집 줄 ${e.id}의 part`);
  }
  if (lines.length) {
    const has = test => lines.some(e => test(e.when || {}));
    const need = [['L1 · L2 · L3 · L4 요청 틀', LV.every(l => has(w => w.part === 'request' && w.home === l))],
      ['맞음 반응(꿀 셋 · 온도 둘 · 그 밖)', [0, 1, 2].every(v => has(w => w.is === 'match' && w.free === 'sweet' && w.value === v)) && ['warm', 'cold'].every(v => has(w => w.is === 'match' && w.free === 'temp' && w.value === v)) && has(w => w.part === 'react' && w.is === 'match' && !w.free)],
      ['다름 반응(차 · 온도 둘 · 단맛 둘)', has(w => w.is === 'differ' && w.axis === 'tea') && ['warm', 'cold'].every(v => has(w => w.axis === 'temp' && w.want === v)) && ['less', 'more'].every(d => has(w => w.axis === 'sweet' && w.dir === d))],
      ['들고 감 · 단골 둘 · 주인 넷', has(w => w.is === 'takeaway') && ['usual', 'match'].every(i => has(w => w.part === 'regular' && w.is === i)) && ['offer', 'took', 'finish', 'done'].every(i => has(w => w.part === 'owner' && w.is === i))]];
    for (const [what, ok] of need) if (!ok) fail(`찻집 줄이 모자라요: ${what}`);
  }
  return lines.map(e => ({ id: e.id, npc: e.npc, kind: e.kind, when: e.when, levels: e.levels }));
}
export function validateMoodLines(docs, residents) {
  const lines = docs.flat().filter(entry => entry?.kind === 'mood'), ids = new Set();
  for (const entry of lines) {
    const [npc, kind, reason, n] = String(entry.id).split('.');
    if (kind !== 'mood' || entry.npc !== npc || entry.when?.reason !== reason || !/^\d+$/.test(n ?? '') || ids.has(entry.id)) fail(`마음 줄 ${entry.id}`);
    if (!['L1', 'L2', 'L3', 'L4'].every(level => typeof entry.levels?.[level] === 'string') || typeof entry.icon !== 'string') fail(`마음 줄 ${entry.id}의 판·그림`);
    ids.add(entry.id);
  }
  for (const r of residents.residents) for (const m of r.moods) if (!ids.has(`${r.id}.mood.${m.tag}.1`)) fail(`${r.id}의 마음 ${m.tag}에 줄(${r.id}.mood.${m.tag}.1)이 없어요.`);
  return lines.map(entry => ({ id: entry.id, npc: entry.npc, reason: entry.when.reason, icon: entry.icon, levels: entry.levels }));
}

/** The ledger's items (§20-7 ①): one definition each; a gathered material names a gather spot. */
export function validateItems(data, places) {
  const ids = new Set(), kinds = ['material', 'product', 'tool', 'decor', 'currency'];
  const gather = new Set(places.spots.filter(spot => spot.kind === 'gather').map(spot => spot.id));
  for (const item of data?.items || []) {
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(item.id ?? '') || ids.has(item.id)) fail(`물건 ${item.id}`);
    ids.add(item.id);
    if (!kinds.includes(item.kind) || typeof item.storage !== 'string' || !Number.isSafeInteger(item.stackMax) || item.stackMax < 1
      || !Array.isArray(item.sources) || !item.sources.length || !Array.isArray(item.uses)) fail(`물건 ${item.id}의 칸`);
    if (item.sources.includes('gather') && !gather.has(item.spot)) fail(`물건 ${item.id}의 채집 자리 ${item.spot}`);
  }
  if (!ids.size) fail('items.json에는 items가 있어요.');
  return data;
}

/** The gathering loop's table (town/data/gather.json, W8b §20-8): each gather spot's name and plant, each gathered item's
 * name, empty-cell line, when it grows (clock rules only — no chance) and look, the teas a gift makes and where gifts go.
 * Every gathered item of items.json has a row and every row is a gathered item; a tea an item makes is named here. */
export const GATHER_GROWS = Object.freeze(['bands', 'seasons', 'weatherNow', 'weatherDay', 'afterRain']);
export const GATHER_SHAPES = Object.freeze(['leaf', 'dew', 'mint', 'flower', 'petal']);
export function validateGather(data, items, places, cards, archetypes) {
  const text = (v, max = 40) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[0-9]/.test(v);
  const color = v => /^#[0-9a-f]{6}$/.test(v ?? '');
  const gathered = items.items.filter(item => item.sources.includes('gather'));
  const spots = places.spots.filter(spot => spot.kind === 'gather').map(spot => spot.id);
  if (!data || Object.keys(data.spots || {}).sort().join() !== [...spots].sort().join()
    || !Object.values(data.spots).every(s => text(s.label, 20) && ['tea', 'pot', 'wall'].includes(s.plant))) fail('gather.json spots(채집 자리 셋)');
  if (Object.keys(data.items || {}).sort().join() !== gathered.map(item => item.id).sort().join()) fail('gather.json items(채집 재료 모두)');
  const BANDS = ['morning', 'day', 'evening', 'night'], SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  for (const [id, row] of Object.entries(data.items)) {
    const g = row.grows || {};
    if (!text(row.name, 12) || !text(row.hint, 40) || !Object.keys(g).length || !Object.keys(g).every(k => GATHER_GROWS.includes(k))
      || (g.bands !== undefined && !(Array.isArray(g.bands) && g.bands.length && g.bands.every(b => BANDS.includes(b))))
      || (g.seasons !== undefined && !(Array.isArray(g.seasons) && g.seasons.length && g.seasons.every(s => SEASONS.includes(s))))
      || (g.weatherNow !== undefined && !['clear', 'rain'].includes(g.weatherNow))
      || (g.weatherDay !== undefined && !['clear-day', 'rain-day', 'pm-rain', 'am-rain-clearing', 'evening-shower'].includes(g.weatherDay))
      || (g.afterRain !== undefined && g.afterRain !== true)
      || !GATHER_SHAPES.includes(row.look?.shape) || !color(row.look?.color)) fail(`gather.json items.${id}`);
  }
  const teas = new Set(gathered.map(item => item.tea).filter(tea => tea !== 'petal'));
  if (Object.keys(data.teas || {}).sort().join() !== [...teas].sort().join() || !Object.values(data.teas).every(t => text(t.name, 8) && color(t.color))) fail('gather.json teas(재료가 내는 차)');
  if (!text(data.petal?.label, 12)) fail('gather.json petal');
  const card = cards.cards.find(c => c.id === data.tinCard);
  if (!card || card.trigger.kind !== 'wear' || card.trigger.object !== data.tin || card.owner !== data.owner) fail('gather.json tin · tinCard(잎 통 마모 카드)');
  if (!archetypes.some(a => a.id === data.picking?.archetype) || !places.places.some(p => p.id === data.picking?.place)) fail('gather.json picking');
  return data;
}
/** The gathering loop's lines (kind gather, W8b): the cafe owner's four (a gift, a gift that settles C3, a guest who asked for
 * the tea of the day, picking beside her) and the field book's description of each gathered item. */
export function validateGatherLines(docs, gather) {
  const lines = docs.flat().filter(entry => entry?.kind === 'gather'), ids = new Set(), LV = ['L1', 'L2', 'L3', 'L4'];
  for (const e of lines) {
    const [npc, kind, key, n] = String(e.id).split('.'), w = e.when || {};
    if (kind !== 'gather' || n !== '1' || ids.has(e.id) || e.npc !== npc || !LV.every(l => typeof e.levels?.[l] === 'string')) fail(`채집 줄 ${e.id}`);
    ids.add(e.id);
    const ok = w.part === 'owner' ? npc === 'cafe-owner' && ['gift', 'c3', 'found', 'with'].includes(w.is) && key === w.is
      : w.part === 'book' && npc === 'village' && Object.hasOwn(gather.items, w.item) && key === `desc-${w.item}`;
    if (!ok) fail(`채집 줄 ${e.id}의 when`);
  }
  if (lines.length) {
    const missing = [...['gift', 'c3', 'found', 'with'].filter(is => !lines.some(e => e.when?.part === 'owner' && e.when.is === is)),
      ...Object.keys(gather.items).filter(item => !lines.some(e => e.when?.part === 'book' && e.when.item === item))];
    if (missing.length) fail(`채집 줄이 모자라요: ${missing.join(', ')}`);
  }
  return lines.map(e => ({ id: e.id, npc: e.npc, kind: e.kind, when: e.when, levels: e.levels }));
}

const RESIDENT_IDS = ['cafe-owner', 'workshop-owner', 'researcher'];
const TRIGGERS =['wear', 'rain-start', 'rain-stop', 'after-rain', 'state', 'count', 'night-clear', 'season-leaf', 'after', 'rush', 'first-visit'];
const ROLES = ['choose', 'make', 'deliver', 'delegate', 'watch'];
const FAMILIES = ['cafe-life', 'workshop-life', 'greenhouse-life'];
const word = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(value);

/** The small need cards (§8, W5): every card of the slice once, its trigger, its three paths and what it leaves. A pair
 * path's neighbour works in the owner's place (partnerSpot), a scene is the pair's own (pairs.json), and a player path
 * that is ready has its choices. Locked cards (C4 until its scene, W9) keep their row and never rise. */
export function validateCards(data, places, archetypes, pairs) {
  const spots = new Map(places.spots.map(s => [s.id, s])), groups = places.groups || {}, kinds = new Set(archetypes.archetypes.map(a => a.id));
  const placeOf = name => (groups[name] ? spots.get(groups[name][0]) : spots.get(name))?.place;
  const spotOrGroup = name => spots.has(name) || Object.hasOwn(groups, name);
  const pairOf = (a, b) => pairs.pairs.find(p => p.members.includes(a) && p.members.includes(b));
  if (!Array.isArray(data?.cards)) fail('cards.json에는 cards가 있어요.');
  const ids = new Set();
  for (const c of data.cards) {
    const where = `카드 ${c.id}`;
    if (!CARD_ID.test(c.id ?? '') || ids.has(c.id)) fail(`${where} ID`);
    ids.add(c.id);
    if (!RESIDENT_IDS.includes(c.owner) || typeof c.title !== 'string' || !c.title || !FAMILIES.includes(c.family)) fail(`${where}의 주인·제목·생활 계열`);
    const t = c.trigger || {};
    if (!TRIGGERS.includes(t.kind)) fail(`${where}의 계기`);
    if (['wear', 'after'].includes(t.kind) && (!OBJECTS.includes(t.object) || !integer(t.threshold, 1, 999))) fail(`${where}의 마모 문턱`);
    if (['rain-start', 'after-rain'].includes(t.kind) && !OBJECTS.includes(t.object)) fail(`${where}의 비품`);
    if (t.kind === 'state' && !(['energy', 'chores', 'social'].includes(t.stat) && (integer(t.below, 1, 100) || integer(t.atLeast, 1, 100)))) fail(`${where}의 상태 조건`);
    if (t.kind === 'count' && !(kinds.has(t.archetype) && integer(t.min, 1, 99))) fail(`${where}의 차례`);
    if (!Array.isArray(c.bands) || !c.bands.length || c.bands.some(b => !BANDS.includes(b)) || !integer(c.cooldownLifeDays, 1, 30)) fail(`${where}의 구간·쉼`);
    if (!kinds.has(c.archetype) || !spotOrGroup(c.spot)) fail(`${where}의 원형·자리`);
    if (c.moves !== undefined && (!OBJECTS.includes(c.moves.object) || !(c.moves.to === 'spot' || spots.has(c.moves.to)))) fail(`${where}.moves`);
    if (c.until !== undefined && !integer(c.until, 0, 1439)) fail(`${where}.until`);
    if (c.excites !== undefined && c.excites !== true) fail(`${where}.excites`);
    const { self, pair, player } = c.paths || {};
    if (!word(self?.result)) fail(`${where}의 혼자 길`);
    const at = pair?.spot ?? c.spot;
    if (!pair || !RESIDENT_IDS.includes(pair.partner) || pair.partner === c.owner || !kinds.has(pair.partnerArchetype) || !spotOrGroup(pair.partnerSpot)
      || !spotOrGroup(at) || placeOf(pair.partnerSpot) !== placeOf(at) || !word(pair.result)) fail(`${where}의 둘이 길(짝은 주인과 같은 장소에서 일해요)`);
    if (!(pair.scene === null || pair.scene === pairOf(c.owner, pair.partner)?.scene)) fail(`${where}의 쌍 장면은 그 쌍의 것이에요.`);
    if (pair.glad !== undefined && !kinds.has(pair.glad)) fail(`${where}.paths.pair.glad`);
    if (player?.spot !== undefined && !spotOrGroup(player.spot)) fail(`${where}의 나와 함께 자리`);
    if (player?.activity !== undefined && !(ACTIVITY_IDS.includes(player.activity) && ['order', 'one'].includes(player.cup) && !player.choices?.length)) fail(`${where}의 나와 함께 생활(activity · cup)`);
    if (!player || !Array.isArray(player.choices) || player.choices.some(x => !word(x)) || new Set(player.choices).size !== player.choices.length
      || !ROLES.includes(player.role) || !word(player.result) || typeof player.ready !== 'boolean' || player.ready && !player.choices.length && !player.activity
      || (player.with !== undefined && !(Array.isArray(player.with) && player.with.every(npc => RESIDENT_IDS.includes(npc) && npc !== c.owner)))) fail(`${where}의 나와 함께 길`);
    if (!(c.trace === null || OBJECTS.includes(c.trace?.object) && /^[a-z][A-Za-z]{1,20}$/.test(c.trace.field ?? ""))) fail(`${where}의 흔적`);
    if (!(c.news === null || integer(c.news, 1, 3)) || (c.newsPaths !== undefined && !(Array.isArray(c.newsPaths) && c.newsPaths.every(p => ['self', 'pair'].includes(p))))) fail(`${where}의 소식`);
    if (c.locked !== undefined && !/^W\d+b?$/.test(c.locked)) fail(`${where}.locked`);
  }
  if (ids.size !== 18) fail('카드는 열여덟 장이에요(C1~C6·W1~W6·R1~R6).');
  return data;
}

/** The three resident pairs (§3-5·§9-1, W5) and where two residents talk in each place. */
export function validatePairs(data, places) {
  const spots = new Map(places.spots.map(s => [s.id, s]));
  if (!Array.isArray(data?.pairs) || data.pairs.length !== 3) fail('pairs.json에는 쌍 셋이 있어요.');
  const keys = new Set(), scenes = new Set();
  for (const p of data.pairs) {
    const members = Array.isArray(p.members) ? [...p.members].sort((a, b) => RESIDENT_IDS.indexOf(a) - RESIDENT_IDS.indexOf(b)) : [];
    if (members.length !== 2 || members[0] === members[1] || !members.every(m => RESIDENT_IDS.includes(m)) || p.key !== members.join('|') || keys.has(p.key)) fail(`쌍 ${p.key}`);
    if (!word(p.topic) || !/^PAIR0[1-9]$/.test(p.scene ?? '') || scenes.has(p.scene) || !Array.isArray(p.frictionCards) || p.frictionCards.some(c => !CARD_ID.test(c))) fail(`쌍 ${p.key}의 주제·장면·카드`);
    keys.add(p.key); scenes.add(p.scene);
  }
  for (const [place, spot] of Object.entries(data.chatSpots || {})) {
    if (spots.get(spot)?.place !== place || spots.get(spot).capacity < 2 || spots.get(spot).kind === 'gather') fail(`이야기 자리 ${place} → ${spot}(둘이 설 수 있는 그 장소의 자리)`);
  }
  return data;
}

/** The W5 lines the screen shows (§16-1): card lines (rising, solving alone, the pair's two, the player's offer and
 * result), hearsay frames (seen·heard·news × the three speakers, with {news} and, for heard, {from}), the pairs' small
 * differences by step and the village news. Every card that can rise has its six, every pair step its two, every news
 * card its news line. The checker (town-lines-check) owns lengths and words. */
export const CARD_PARTS = Object.freeze(['trigger', 'self', 'pair', 'offer', 'result']);
export const HEARSAY = Object.freeze(['seen', 'heard', 'news']);
/** 「그동안 달라진 것」 틀(§10-2·§16-1, W6): 흔적 넷(쟁반 받침·관찰판·오늘의 차·새 차)·습관·쌍 — town/meanwhile.mjs FRAMES와 같다(시험이 견줌). */
export const CHANGE_FRAMES = Object.freeze(['tray', 'board', 'today-tea', 'new-tea', 'habit', 'pair']);
export function validateTownLines(docs, cards, pairs) {
  const lines = docs.flat().filter(entry => ['card', 'hearsay', 'pair', 'news', 'changes'].includes(entry?.kind)), ids = new Set();
  const cardById = new Map(cards.cards.map(c => [c.id, c])), sceneOf = new Map(pairs.pairs.map(p => [p.scene, p]));
  for (const e of lines) {
    const [npc, kind, key, n] = String(e.id).split('.');
    if (kind !== e.kind || !/^\d+$/.test(n ?? '') || ids.has(e.id) || !['L1', 'L2', 'L3', 'L4'].every(l => typeof e.levels?.[l] === 'string')) fail(`원고 ${e.id}`);
    ids.add(e.id);
    const w = e.when || {};
    if (e.kind === 'card') {
      const card = cardById.get(w.card);
      const speaker = w.part === 'pair' ? [card?.owner, card?.paths.pair.partner] : [card?.owner];
      if (!card || !CARD_PARTS.includes(w.part) || key !== `${w.card}-${w.part}` || !speaker.includes(npc) || e.npc !== npc) fail(`카드 줄 ${e.id}`);
    } else if (e.kind === 'hearsay') {
      if (!HEARSAY.includes(w.how) || key !== w.how || !RESIDENT_IDS.includes(npc) || e.npc !== npc) fail(`전해 듣기 줄 ${e.id}`);
    } else if (e.kind === 'pair') {
      const pair = sceneOf.get(w.pair);
      if (!pair || !integer(w.step, 0, 2) || key !== `${w.pair}-${w.step}` || !pair.members.includes(npc) || e.npc !== npc) fail(`쌍 줄 ${e.id}`);
    } else if (e.kind === 'changes') {
      if (!CHANGE_FRAMES.includes(w.frame) || key !== w.frame || npc !== 'village' || e.npc !== 'village') fail(`그동안 달라진 것 줄 ${e.id}`);
    } else if (!cardById.get(w.card)?.news || key !== w.card || npc !== 'village' || e.npc !== 'village') fail(`소식 줄 ${e.id}`);
  }
  // Every line a card, a pair step or the news can ask for is there (once the W5 lines exist).
  if (lines.length) {
    const need = [];
    for (const c of cards.cards.filter(card => !card.locked)) {
      for (const part of CARD_PARTS) for (const npc of part === 'pair' ? [c.owner, c.paths.pair.partner] : [c.owner]) need.push(`${npc}.card.${c.id}-${part}.1`);
      if (c.news) need.push(`village.news.${c.id}.1`);
    }
    for (const p of pairs.pairs) for (let step = 0; step <= 2; step++) for (const npc of p.members) need.push(`${npc}.pair.${p.scene}-${step}.1`);
    for (const how of HEARSAY) for (const npc of RESIDENT_IDS) need.push(`${npc}.hearsay.${how}.1`);
    // W6: every frame of 「그동안 달라진 것」, once its lines exist.
    if (lines.some(e => e.kind === 'changes')) for (const frame of CHANGE_FRAMES) need.push(`village.changes.${frame}.1`);
    const missing = need.filter(id => !ids.has(id));
    if (missing.length) fail(`없는 줄 ${missing.length}개: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
  }
  return lines.map(e => ({ id: e.id, npc: e.npc, kind: e.kind, when: e.when, ...(e.icon ? { icon: e.icon } : {}), levels: e.levels }));
}

/** The mascot's taste question (§20-3, W6b): one line per life family, asked once when the player keeps opening that family.
 * Screen-only words (ASK_LINES) — the host never reads them, so they stay out of TOWN_LINES and its seen ledger. */
export function validateAskLines(docs) {
  const lines = docs.flat().filter(entry => entry?.kind === 'asks'), ids = new Set();
  for (const e of lines) {
    const [npc, kind, key, n] = String(e.id).split('.');
    if (npc !== 'mascot' || e.npc !== 'mascot' || kind !== 'asks' || n !== '1' || ids.has(e.id) || !LIFE_FAMILIES.includes(e.when?.family) || key !== e.when.family
      || !['L1', 'L2', 'L3', 'L4'].every(l => typeof e.levels?.[l] === 'string')) fail(`마스코트 묻기 줄 ${e.id}`);
    ids.add(e.id);
  }
  const missing = lines.length ? LIFE_FAMILIES.filter(family => !ids.has(`mascot.asks.${family}.1`)) : [];
  if (missing.length) fail(`마스코트 묻기 줄이 없는 생활: ${missing.join(', ')}`);
  return lines.map(e => ({ id: e.id, family: e.when.family, levels: e.levels }));
}

/** The evaluation-only signals' consent (§20-4, W6): the contract file the talk copy holds byte for byte (tools/계약동기화.js).
 * The screen asks with its easy version and shows the details whole; the visit line's fields pair with its items (town/eval.mjs). */
export const EVAL_CONSENT_FILE = path.join(ROOT, '계약/마을평가신호_선택응답_계약.json');
const EASY_KEYS = Object.freeze({ ask: '물음', uses: '쓰는것', where: '쓰는곳', keep: '보관', choose: '고르기' });
const DETAIL_KEYS = Object.freeze({ title: '제목', purpose: '무엇을위해', uses: '쓰는것', notUsed: '쓰지않는것', keep: '보관', choose: '고르기',
  notAsked: '묻지않는경우', contact: '문의' });
export function validateEvalConsent(doc) {
  const c = doc?.선택응답, text = value => typeof value === 'string' && value.trim().length > 0;
  if (!c || !/^town-eval-signals-\d+$/.test(c.동의판)) fail('평가 신호 계약의 동의판');
  const pick = (from, keys) => Object.fromEntries(Object.entries(keys).map(([key, name]) => [key, from?.[name]]));
  const easy = pick(c.쉬운판, EASY_KEYS), detail = pick(c.자세히, DETAIL_KEYS);
  const buttons = pick(c.쉬운판?.단추, { no: '아니요', yes: '좋아요', more: '자세히' });
  if (![...Object.values(easy), ...Object.values(detail), ...Object.values(buttons)].every(text)) fail('평가 신호 계약의 문구');
  const items = c.칸;
  if (!items || typeof items !== 'object' || Array.isArray(items) || !Object.keys(items).length
    || !Object.entries(items).every(([name, fields]) => text(name) && Array.isArray(fields) && fields.length && fields.every(field => typeof field === 'string' && /^[a-z][A-Za-z]{0,30}$/.test(field))))
    fail('평가 신호 계약의 칸');
  const fields = Object.values(items).flat();
  if (new Set(fields).size !== fields.length) fail('평가 신호 계약의 칸이 두 항목에 겹쳐요.');
  return { ver: c.동의판, easy: { ...easy, buttons }, detail, items };
}

const read = name => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

export function build() {
  const placesData = validatePlaces(read('places.json'));
  const { places, spots, groups } = placesData;
  const { archetypes } = validateArchetypes(read('archetypes.json'), placesData);
  const residentsData = validateResidents(read('residents.json'), placesData, { archetypes });
  const { rainAlt, routines } = validateRoutines(read('routines.json'), placesData, { archetypes }, residentsData);
  const { versions: params } = validateParams(read('params.json'));
  const { items } = validateItems(read('items.json'), placesData);
  const { $comment, ...light } = validateLight(read('light.json'));
  const { $comment: stayNote, ...stay } = validateStay(read('stay.json'));
  const { $comment: musicNote, ...music } = validateMusic(read('music.json'));
  // The browser gets what it plays — each song's id, title, file and length. Where a song came from and its rights stay in
  // music.json (this repo): the public files carry no maker's name (the public build's tool-name check).
  const musicShown = { musicVer: music.musicVer, tracks: music.tracks.map(({ id, title, file, durationMs }) => ({ id, title, file, durationMs })) };
  const linesDir = path.join(DATA, 'lines');
  const lineDocs = fs.existsSync(linesDir) ? fs.readdirSync(linesDir).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(fs.readFileSync(path.join(linesDir, name), 'utf8'))).filter(Array.isArray) : [];
  const moodLines = validateMoodLines(lineDocs, residentsData);
  const pairsData = validatePairs(read('pairs.json'), placesData);
  const cardsData = validateCards(read('cards.json'), placesData, { archetypes }, pairsData);
  for (const r of residentsData.residents) for (const m of r.moods) if (CARD_ID.test(m.factor) && !cardsData.cards.some(c => c.id === m.factor)) fail(`${r.id}의 마음 ${m.factor}는 카드가 아니에요.`);
  const townLines = validateTownLines(lineDocs, cardsData, pairsData);
  const tea = validateTea(read('tea.json')), { $comment: teaNote, ...teaTable } = tea, teaLines = validateTeaLines(lineDocs, tea);
  const reviewFile = path.join(ROOT, 'experiences/topik-items/review/atlas-world-learning-20261028-tea.json');
  const teaReview = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, 'utf8')) : null;
  if (teaReview) for (const [name, digest] of Object.entries(TEA_REVIEW_EVIDENCE)) {
    const rel = `experiences/topik-items/review/reports/atlas-world-learning-20261028-tea-${name}`;
    const entry = teaReview.evidence?.find(row => row.path === rel);
    if (entry?.sha256 !== digest || createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex') !== digest) fail('찻집 독립 검수 근거가 바뀌었어요.');
  }
  // W10: the frames reviewed by the general rule (Opus → Argon, rubric-compose-r1 — tools/topik-review.mjs 반영).
  const w10File = path.join(ROOT, 'experiences/topik-items/review/town-tea-w10.json');
  const teaAssessment = teaAssessmentMetadata(teaLines, tea.axes, teaReview, fs.existsSync(w10File) ? JSON.parse(fs.readFileSync(w10File, 'utf8')) : null);
  const evalConsent = validateEvalConsent(JSON.parse(fs.readFileSync(EVAL_CONSENT_FILE, 'utf8')));
  const askLines = validateAskLines(lineDocs);
  const { $comment: gatherNote, ...gather } = validateGather(read('gather.json'), { items }, placesData, cardsData, archetypes);
  const gatherLines = validateGatherLines(lineDocs, gather);
  // One record per line keeps the generated diff as readable as the source.
  const rows = list => (list.length ? `[\n${list.map(item => `    ${JSON.stringify(item)}`).join(',\n')},\n  ]` : '[]');
  const body = `{\n  places: ${rows(places)},\n  spots: ${rows(spots)},\n  groups: ${JSON.stringify(groups)},\n`
    + `  archetypes: ${rows(archetypes)},\n  residents: ${rows(residentsData.residents)},\n  routines: ${rows(routines)},\n  rainAlt: ${JSON.stringify(rainAlt)},\n`
    + `  params: ${rows(params)},\n  items: ${rows(items)},\n  light: ${JSON.stringify(light)},\n  stay: ${JSON.stringify(stay)},\n  music: ${JSON.stringify(musicShown)},\n  moodLines: ${rows(moodLines)},\n`
    + `  cards: ${rows(cardsData.cards)},\n  pairs: ${rows(pairsData.pairs)},\n  chatSpots: ${JSON.stringify(pairsData.chatSpots)},\n  townLines: ${rows(townLines)},\n`
    + `  tea: ${JSON.stringify(teaTable)},\n  teaLines: ${rows(teaLines)},\n  teaAssessment: ${JSON.stringify(teaAssessment)},\n  evalConsent: ${JSON.stringify(evalConsent)},\n  askLines: ${rows(askLines)},\n`
    + `  gather: ${JSON.stringify(gather)},\n  gatherLines: ${rows(gatherLines)},\n}`;
  return [
    '// Generated by tools/town-data-build.mjs from experiences/synk-town/town/data. Do not edit; run the tool.',
    'const freeze = value => { if (value && typeof value === \'object\') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };',
    `const data = freeze(${body});`,
    'export const PLACES = data.places;',
    'export const SPOTS = data.spots;',
    'export const SPOT_GROUPS = data.groups;',
    'export const ARCHETYPES = data.archetypes;',
    'export const RESIDENTS = data.residents;',
    'export const ROUTINES = data.routines;',
    'export const RAIN_ALT = data.rainAlt;',
    'export const PARAMS = data.params;',
    'export const ITEMS = data.items;',
    'export const LIGHT = data.light;',
    'export const STAY = data.stay;',
    'export const MUSIC = data.music;',
    'export const MOOD_LINES = data.moodLines;',
    'export const CARDS = data.cards;',
    'export const PAIRS = data.pairs;',
    'export const CHAT_SPOTS = data.chatSpots;',
    'export const TOWN_LINES = data.townLines;',
    'export const TEA = data.tea;',
    'export const TEA_LINES = data.teaLines;',
    'export const TEA_ASSESSMENT = data.teaAssessment;',
    'export const EVAL_CONSENT = data.evalConsent;',
    'export const ASK_LINES = data.askLines;',
    'export const GATHER = data.gather;',
    'export const GATHER_LINES = data.gatherLines;',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current !== result) { console.error('Stale town data: node tools/town-data-build.mjs'); process.exitCode = 1; }
    else console.log('town data: 생성물이 원천과 같아요.');
  } else {
    fs.writeFileSync(TARGET, result);
    console.log(`town data: ${path.relative(ROOT, TARGET)}`);
  }
}
