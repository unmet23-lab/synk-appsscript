// 묶음 압축 용량 상한(tools/budget.mjs): 넘으면 걸리고, 상한 · 묶음이 빠진 설정은 그 자리에서 알린다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { checkBudget } from '../../tools/budget.mjs';
import { PACKAGE_ROOT } from '../support/subject.mjs';

const manifest = (engine, entry) => ({
  files: { 'atlas.mjs': { gzipBytes: engine } },
  entry: { 'loader.js': { gzipBytes: entry } },
});
// 시험 대상(src · loader)이 아니라 패키지 설정이다 — 변형 사본이 아니라 패키지의 것을 읽는다.
const budget = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'budget.json'), 'utf8'));

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
    at.report.map(row => row.headroom),
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
