// 생활 한국어 측정 문항마다 AI 2중 검수(1차 Opus · 2차 아르곤) 판정이 있고, 판정한 글이 지금 원고와 같은지 본다(Atlas × WORLD 2단계 D, 2026-11-08).
// 원고를 고친 문항은 지문(hash)이 달라져 여기서 잡힌다 — 다시 검수를 받아야 능력 근거가 된다. 계열은 검수 칸이 아니다(life-items.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lifeUnits } from '../tools/topik-review.mjs';
import { lifeItems, lifeAssessable } from '../experiences/synk-world-app/life-items.mjs';

const rows = JSON.parse(fs.readFileSync(new URL('../experiences/topik-items/review/existing-verdicts.json', import.meta.url), 'utf8')).items;
const life = rows.filter(row => row.source === 'life');

test('생활 측정 문항마다 지금 원고로 2중 검수 판정이 있다 — 능력 · 난도 · 꼴도 지금 대응표와 같다', async () => {
  const verdicts = new Map(life.map(row => [row.itemKey, row]));
  const units = await lifeUnits();
  assert.equal(units.length, 117, '카페 방문 장면 본문항 15개를 뺀 측정 문항');
  const bad = units.filter(u => {
    const row = verdicts.get(u.key);
    return !row || !['pass', 'fix'].includes(row.verdict) || row.hash !== u.hash || row.skillId !== u.meta.skillId || row.difficulty !== u.meta.difficulty || row.responseFormat !== u.meta.responseFormat;
  }).map(u => `${u.key}: ${verdicts.get(u.key)?.verdict ?? '기록 없음'}${verdicts.get(u.key) && verdicts.get(u.key).hash !== u.hash ? ' · 원고가 바뀜' : ''}`);
  assert.deepEqual(bad, []);
});

test('원고에 없는 생활 문항의 판정을 남겨 두지 않고, 통과한 문항만 능력 근거다', async () => {
  const keys = new Set((await lifeUnits()).map(u => u.key));
  assert.deepEqual(life.filter(row => !keys.has(row.itemKey)).map(row => row.itemKey), []);
  assert.equal(new Set(life.map(row => row.itemKey)).size, life.length, '한 문항에 판정 한 줄');
  const assessable = lifeItems().filter(item => lifeAssessable(item)).map(item => item.itemKey).sort();
  assert.deepEqual(assessable, life.filter(row => row.verdict === 'pass').map(row => row.itemKey).sort());
});
