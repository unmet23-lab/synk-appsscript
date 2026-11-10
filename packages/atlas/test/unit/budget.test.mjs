// 묶음 압축 용량 상한(tools/budget.mjs): 넘으면 걸리고, 상한 · 묶음이 빠진 설정은 그 자리에서 알린다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { checkBudget } from '../../tools/budget.mjs';
import { PACKAGE_ROOT } from '../support/subject.mjs';

// 지도 파일은 상한 그대로 채운다(엔진 · 입구 단정에 끼지 않게) — 지도 줄은 아래 시험이 따로 본다.
const mapAt = (budget, slice = budget.map.slice) => ({
  files: {
    ...Object.fromEntries(
      Object.entries(budget.map.files).map(([file, gzip]) => [file, { gzipBytes: gzip }]),
    ),
    'items/a.json': { gzipBytes: 10 },
    'items/b.json': { gzipBytes: slice },
  },
});
// 시험 대상(src · loader)이 아니라 패키지 설정이다 — 변형 사본이 아니라 패키지의 것을 읽는다.
const budget = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'budget.json'), 'utf8'));
const manifest = (engine, entry, map = mapAt(budget)) => ({
  files: { 'atlas.mjs': { gzipBytes: engine } },
  entry: { 'loader.js': { gzipBytes: entry } },
  map,
});

test('budget.json은 엔진 묶음과 입구 둘에 상한을 둔다', () => {
  assert.equal(budget.engine.file, 'atlas.mjs');
  assert.equal(budget.entry.file, 'loader.js');
  assert.ok(Number.isInteger(budget.engine.gzipBytes) && budget.engine.gzipBytes > 0);
  assert.ok(Number.isInteger(budget.entry.gzipBytes) && budget.entry.gzipBytes > 0);
});

test('상한 안이면 통과, 한 바이트라도 넘으면 걸린다', () => {
  const at = checkBudget(manifest(budget.engine.gzipBytes, budget.entry.gzipBytes), budget);
  assert.equal(at.ok, true);
  assert.deepEqual(
    at.report.slice(0, 2).map(row => row.headroom),
    [0, 0],
  );
  const over = checkBudget(manifest(budget.engine.gzipBytes + 1, 10), budget);
  assert.equal(over.ok, false);
  assert.equal(over.report[0].headroom, -1);
});

test('상한이나 묶음이 없으면 통과로 치지 않고 멈춘다', () => {
  assert.throws(() => checkBudget(manifest(1, 1), { engine: budget.engine }), TypeError);
  assert.throws(() => checkBudget({ files: {}, entry: {} }, budget), TypeError);
});

test('지도 줄 — 파일마다 상한, 은행 조각은 가장 큰 것 하나를 잰다(설계 §9 「지도는 엔진과 따로」)', () => {
  const ok = checkBudget(manifest(1, 1), budget);
  assert.equal(ok.ok, true);
  const mapRows = ok.report.filter(row => row.part === 'map');
  assert.deepEqual(mapRows.map(row => row.file).sort(), [
    'map/index.json',
    'map/items/b.json',
    'map/units.json',
    'map/words.json',
  ]);
  assert.equal(checkBudget(manifest(1, 1, mapAt(budget, budget.map.slice + 1)), budget).ok, false);
  const missing = mapAt(budget);
  delete missing.files['words.json'];
  assert.throws(() => checkBudget(manifest(1, 1, missing), budget), TypeError);
});
