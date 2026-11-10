// 세계 지도 첫 화면 자료 시험 — node --test docs/마케팅/온라인마케팅지도/world/world.test.mjs
// 원장(data.json)의 LAB · PULSE 계정 수와 지도에 칠하는 나라가 서로 맞는지, 지도 모양이 모든 나라를 갖는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorld, headline, SECURED, regionOf, formatKst } from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const data = read(join(root, 'dashboard', 'src', 'data.json'));
const targets = read(join(root, 'inputs', 'pulse-targets.json'));
const geo = read(join(here, 'geo.json'));
const world = buildWorld({ data, targets, geo });

test('지도 모양은 남극을 뺀 나라 경계를 한 장으로 갖는다', () => {
  assert.equal(geo.w, 1000);
  assert.ok(geo.h > 400 && geo.h < 520, 'Equal Earth 비율');
  assert.ok(geo.countries.length > 200);
  const codes = geo.countries.map(c => c.a2).filter(Boolean);
  assert.equal(new Set(codes).size, codes.length, '나라 코드는 한 번씩');
  assert.ok(!codes.includes('AQ'), '남극 없음');
  for (const c of geo.countries) {
    assert.match(c.d, /^M/);
    assert.equal(c.c.length, 2);
  }
});

test('LAB 나라는 원장의 나라 행과 같고, 확보 수는 원장의 계정 상태 그대로다', () => {
  const rows = data.queries.countries.rows.filter(r => r.brand === 'LAB');
  assert.equal(world.lab.countries.length, rows.length);
  const channels = data.queries.channels.rows.filter(r => r.brand === 'LAB');
  for (const c of world.lab.countries) {
    assert.ok(c.onMap, c.code + ' 지도에 있음');
    const mine = channels.filter(r => r.country === c.name);
    assert.equal(c.planned, mine.length, c.code + ' 계정 자리 수');
    assert.equal(c.secured, mine.filter(r => SECURED.has(r.accountStatus)).length, c.code + ' 확보 수');
    assert.equal(c.status, c.secured > 0 ? 'active' : 'target');
    for (const a of c.accounts) if (!a.secured) assert.equal(a.url, null, '미확보 계정에 주소를 지어내지 않는다');
  }
  const s = world.lab.summary;
  assert.equal(s.active + s.target, rows.length);
  assert.equal(s.secured, world.lab.countries.reduce((n, c) => n + c.secured, 0));
});

test('LAB 목록은 지역 순서로 묶이고 모든 나라가 지역을 갖는다', () => {
  const orders = world.lab.countries.map(c => regionOf(c.code).order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  for (const c of world.lab.countries) assert.notEqual(regionOf(c.code).name, '그 밖', c.code + ' 지역 표에 없음');
});

test('PULSE는 타깃 파일의 나라를 그대로 칠하고 한국에 공통 계정이 붙는다', () => {
  assert.equal(world.pulse.countries.length, targets.countries.length);
  for (const entry of targets.countries) {
    assert.ok(['active', 'target'].includes(entry.status), entry.code + ' 상태 값');
    assert.ok(entry.language && Array.isArray(entry.plan) && entry.why, entry.code + ' 언어 · 계정 계획 · 근거');
    assert.ok(['유지', '조건부', '빼기 권함'].includes(entry.verdict), entry.code + ' 검토 판정 값');
    if (!entry.plan.length) assert.match(entry.verdict, /빼기/, entry.code + ' 계정 계획이 비면 빼기 권함일 때뿐');
    const c = world.pulse.countries.find(x => x.code === entry.code);
    assert.ok(c?.onMap, entry.code + ' 지도에 있음');
    assert.equal(c.status, entry.status);
  }
  const kr = world.pulse.countries.find(c => c.code === 'KR');
  assert.equal(kr.status, 'active');
  assert.equal(kr.name, '한국');
  const pulseRows = data.queries.channels.rows.filter(r => r.brand === 'PULSE');
  assert.equal(world.pulse.shared.length + kr.accounts.filter(a => a.secured).length, pulseRows.filter(r => SECURED.has(r.accountStatus)).length);
  for (const c of world.pulse.countries.filter(x => x.status === 'target')) {
    assert.equal(c.secured, 0, c.code + ' 준비 중 나라는 확보 계정이 없다');
    assert.ok(c.accounts.every(a => a.state === '계정 계획' && !a.url));
  }
});

test('머리 문장은 받침에 맞는 조사와 원장 숫자를 쓴다', () => {
  const lab = headline(world.lab);
  assert.match(lab.first, /^LAB은 \d+개국에서$/);
  const pulse = headline(world.pulse);
  assert.match(pulse.first, /^PULSE는 /);
  assert.match(pulse.second, new RegExp(world.pulse.summary.target + '개국'));
  assert.equal(formatKst('2026-11-10T15:01:03.796Z'), '11월 11일 00:01');
});

test('화면 자료에는 로그인 정보가 들어가지 않는다', () => {
  const text = JSON.stringify(world);
  assert.doesNotMatch(text, /loginAlias|loginIdentity|@gmail\.com|unmet\d+|비밀번호/);
});
