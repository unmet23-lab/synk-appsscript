import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { compareText as baseline } from '../tools/text-compare-bench/baseline.mjs';
import { compareText as productionCompare } from '../tools/영상사전검사.mjs';
import { createRustComparison, wasmUrl } from '../tools/text-compare-bench/rust.mjs';
import { correctnessCases, smallStrings } from '../tools/text-compare-bench/cases.mjs';

function errorFromBaseline(expected, observed) {
  try { baseline(expected, observed); }
  catch (error) { return { name: error.name, message: error.message }; }
  assert.fail('The frozen baseline must reject this input');
}

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
  for (const [a, b] of [
    ['가'.repeat(12001), '가'.repeat(12001)], ['', '𠮷'.repeat(12001)],
    ['㍿'.repeat(3001), ''], ['', '㍿'.repeat(3001)],
  ]) {
    assert.throws(() => compare(a, b), errorFromBaseline(a, b));
  }
  assert.equal(compare('가 '.repeat(12000), '가'.repeat(12000)).similarity, 1);
  return count;
}

test('integrated media compareText matches frozen baseline on exhaustive, Unicode, fuzz and length-boundary cases', t => {
  t.diagnostic(`compared ${checkCandidate(productionCompare)} input pairs; normalization and errors preserved`);
});

test('band widening and insertion/deletion shifts preserve the exact distance in both input orders', () => {
  const original = Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0xac00 + i)).join('');
  for (const edits of [4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 127, 128, 129]) {
    for (const changed of [
      '힣'.repeat(edits) + original.slice(edits),
      original.slice(edits) + original.slice(0, edits),
      original.slice(0, 100) + '힣'.repeat(edits) + original.slice(100),
      original.slice(0, 100) + original.slice(100 + edits),
    ]) for (const [a, b] of [[original, changed], [changed, original]]) {
      assert.deepEqual(productionCompare(a, b), baseline(a, b));
    }
  }
});

test('mixed substitutions and insertions/deletions require widening with unequal nonempty strings', t => {
  const original = Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0xac00 + i)).join('');
  const substituted = original.slice(0, 20) + '힣' + original.slice(21);
  let count = 0;
  for (const edits of [4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 127, 128, 129]) {
    // The substitution precedes the insertion/deletion, so trimming equal ends
    // leaves text on both sides. Each fixture needs edits + 1 operations.
    for (const changed of [
      substituted.slice(0, 100) + '힢'.repeat(edits) + substituted.slice(100),
      substituted.slice(0, 100) + substituted.slice(100 + edits),
    ]) for (const [a, b] of [[original, changed], [changed, original]]) {
      const expected = baseline(a, b);
      assert.equal(expected.editDistance, edits + 1);
      assert.deepEqual(productionCompare(a, b), expected);
      count++;
    }
  }
  t.diagnostic(`compared ${count} mixed-edit input pairs across band boundaries`);
});

test('Rust/WASM candidate exactly matches frozen baseline (requires release WASM build)', {
  skip: !existsSync(wasmUrl) ? 'Experimental WASM not built; run cargo build and rerun this test to verify Rust' : false,
}, async t => {
  const rust = await createRustComparison();
  t.diagnostic(`compared ${checkCandidate(rust.compareText)} input pairs through real WASM`);
  assert.throws(() => rust.distance(new Uint32Array(12001), new Uint32Array()), errorFromBaseline('가'.repeat(12001), ''));
});
