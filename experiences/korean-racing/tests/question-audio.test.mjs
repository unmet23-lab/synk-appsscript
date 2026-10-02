import test from 'node:test';
import assert from 'node:assert/strict';
import { questionNarration } from '../question-audio.js';
import { CAMPAIGN, CHOICE_BY_ID } from '../campaign.js';
import { existsSync } from 'node:fs';

test('spoken lane directions match the shuffled screen order, including repeat', () => {
  const q = CAMPAIGN[0].items[1];
  const worldOrder = [q.options[1], q.options[0], q.options[2]];
  const result = questionNarration(q, worldOrder, CHOICE_BY_ID);
  assert.deepEqual(result.ids, [...q.audio, 'lane-left', q.options[2], 'lane-center', q.options[0], 'lane-right', q.options[1]]);
  assert.equal(result.text, `${q.spoken} 왼쪽 길은 병원. 가운데 길은 학교. 오른쪽 길은 시장.`);
  assert.deepEqual(questionNarration(q, worldOrder, CHOICE_BY_ID), result);
  assert.deepEqual(worldOrder, [q.options[1], q.options[0], q.options[2]]);
});

test('every campaign question and shuffled option has a recorded voice asset', () => {
  for (const stage of CAMPAIGN) for (const q of stage.items) {
    for (const id of questionNarration(q, q.options, CHOICE_BY_ID).ids) {
      assert(existsSync(new URL(`../assets/narration/${id}.mp3`, import.meta.url)), `Missing narration: ${id}`);
    }
  }
});
