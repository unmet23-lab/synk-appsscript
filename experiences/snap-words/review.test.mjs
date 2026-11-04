// 낱말마다 학습 문항 2중 검수를 통과했고, 통과한 글이 지금 원고와 같은지 본다(설계 5-3). 고친 낱말은 지문이 달라져 여기서 잡힌다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { snapWordsUnits } from '../../tools/topik-review.mjs';

const rows = JSON.parse(fs.readFileSync(new URL('../topik-items/review/existing-verdicts.json', import.meta.url), 'utf8')).items;

test('낱말마다 지금 원고로 2중 검수를 통과했다', async () => {
  const verdicts = new Map(rows.filter((row) => row.source === 'snap-words').map((row) => [row.itemKey, row]));
  const units = await snapWordsUnits();
  assert.ok(units.length >= 30, `낱말 수 ${units.length}`);
  const bad = units.filter((u) => { const row = verdicts.get(u.key); return !row || row.verdict !== 'pass' || row.hash !== u.hash; })
    .map((u) => `${u.key}: ${verdicts.get(u.key)?.verdict ?? '기록 없음'}${verdicts.get(u.key) && verdicts.get(u.key).hash !== u.hash ? ' · 원고가 바뀜' : ''}`);
  assert.deepEqual(bad, []);
});

test('원고에서 뺀 낱말의 통과 기록을 남겨 두지 않는다', async () => {
  const keys = new Set((await snapWordsUnits()).map((u) => u.key));
  assert.deepEqual(rows.filter((row) => row.source === 'snap-words' && !keys.has(row.itemKey)).map((row) => row.itemKey), []);
});
