#!/usr/bin/env node
/** 싱크타운 데이터 생성물 — 찻집 골목의 하루 세로 조각 설계 §2-5.
 *
 *   node tools/town-data-build.mjs           experiences/synk-town/town/data/*.json을 검사해 town/data.gen.mjs를 다시 쓴다
 *   node tools/town-data-build.mjs --check   생성물이 원천과 같은지 본다(다르면 「Stale town data」, 종료 1)
 *
 * 브라우저·talk 묶음은 JSON 대신 이 생성물을 읽는다(브라우저 모듈은 JSON을 바로 못 부르고, talk는 esbuild로 묶는다).
 * 원천을 고치면 생성물을 같은 커밋에 올린다 — 바로올리기의 짝검사와 tests/town-places.test.js가 낡은 생성물을 막는다.
 * 원고(data/lines)와 허용 목록(lines-allow.json)은 검사기만 읽으므로 여기 담지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  }
  return data;
}

export function validateResidents(data, places) {
  const spots = new Set(places.spots.map(s => s.id)), seen = new Set();
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

const read = name => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

export function build() {
  const placesData = validatePlaces(read('places.json'));
  const { places, spots, groups } = placesData;
  const { archetypes } = validateArchetypes(read('archetypes.json'), placesData);
  const residentsData = validateResidents(read('residents.json'), placesData);
  const { rainAlt, routines } = validateRoutines(read('routines.json'), placesData, { archetypes }, residentsData);
  const { versions: params } = validateParams(read('params.json'));
  // One record per line keeps the generated diff as readable as the source.
  const rows = list => `[\n${list.map(item => `    ${JSON.stringify(item)}`).join(',\n')},\n  ]`;
  const body = `{\n  places: ${rows(places)},\n  spots: ${rows(spots)},\n  groups: ${JSON.stringify(groups)},\n`
    + `  archetypes: ${rows(archetypes)},\n  residents: ${rows(residentsData.residents)},\n  routines: ${rows(routines)},\n  rainAlt: ${JSON.stringify(rainAlt)},\n`
    + `  params: ${rows(params)},\n}`;
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
