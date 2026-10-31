import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { compareText as baseline } from '../tools/영상사전검사.mjs';
import { compareTextJs, LIMIT_MESSAGE } from '../tools/text-compare-bench/compare.mjs';
import { createRustComparison, wasmUrl } from '../tools/text-compare-bench/rust.mjs';
import { correctnessCases, smallStrings } from '../tools/text-compare-bench/cases.mjs';

function checkCandidate(compare) {
  let count = 0;
  for (const [a, b] of correctnessCases()) {
    assert.deepEqual(compare(a, b), baseline(a, b)); count++;
  }
  const small = smallStrings();
  for (const a of small) for (const b of small) {
    assert.deepEqual(compare(a, b), baseline(a, b)); count++;
  }
  for (const [a, b] of [
    ['가'.repeat(12000), '가'.repeat(12000)],
    ['가'.repeat(11999) + '나', '가'.repeat(11999) + '다'],
    ['가'.repeat(12000), ''], ['𠮷'.repeat(12000), '𠮷'],
    ['가'.repeat(80), '나'.repeat(12000)],
  ]) { assert.deepEqual(compare(a, b), baseline(a, b)); count++; }
  for (const [a, b] of [['가'.repeat(12001), '가'.repeat(12001)], ['', '𠮷'.repeat(12001)]]) {
    assert.throws(() => compare(a, b), { message: LIMIT_MESSAGE });
  }
  assert.equal(compare('가 '.repeat(12000), '가'.repeat(12000)).similarity, 1);
  return count;
}

test('JS candidate exactly matches production on exhaustive, Unicode, fuzz and length-boundary cases', t => {
  t.diagnostic(`compared ${checkCandidate(compareTextJs)} input pairs; normalization and errors preserved`);
});

test('Rust/WASM candidate exactly matches production (requires release WASM build)', {
  skip: !existsSync(wasmUrl) ? 'Experimental WASM not built; run cargo build and rerun this test to verify Rust' : false,
}, async t => {
  const rust = await createRustComparison();
  t.diagnostic(`compared ${checkCandidate(rust.compareText)} input pairs through real WASM`);
  assert.throws(() => rust.distance(new Uint32Array(12001), new Uint32Array()), { message: LIMIT_MESSAGE });
});
