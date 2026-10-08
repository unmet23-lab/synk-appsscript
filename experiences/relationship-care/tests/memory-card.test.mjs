import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryCardContent } from '../memory-card.mjs';
import themeBuild from '../../../tools/care-memory-theme.cjs';
import { readFileSync } from 'node:fs';

const person = { id: 'p', name: '지민', notes: 'PRIVATE', recipientPreference: { note: 'PRIVATE' } };
const memory = { id: 'm', personId: 'p', text: '함께 바다를 걸었던 날', sourceId: 's', sourceQuote: 'PRIVATE SOURCE', createdAt: '2026-10-06T00:00:00Z' };
test('card contains only deliberate selected text, never private source or person fields', () => {
  const result = memoryCardContent({ person, memories: [memory], title: '<script>우리의 기억</script>', message: '고마워' });
  assert.equal(result.items[0].text, memory.text);
  assert.equal(result.title, '<script>우리의 기억</script>'); // canvas text, no HTML interpolation
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|sourceId|createdAt/);
});
test('card rejects foreign, empty, duplicated or overflowing selected records', () => {
  assert.throws(() => memoryCardContent({ person }), /1~3개/);
  assert.throws(() => memoryCardContent({ person, memories: [{ ...memory, personId: 'other' }] }), /다른 사람/);
  assert.throws(() => memoryCardContent({ person, memories: [memory, memory] }), /한 번/);
  assert.throws(() => memoryCardContent({ person, memories: [{ ...memory, text: 'x'.repeat(241) }] }), /발췌/);
  assert.throws(() => memoryCardContent({ person, memories: [memory], message: 'x'.repeat(301) }), /300자/);
});
test('activity export uses actual selected date and note, omits financial details', () => {
  const result = memoryCardContent({ person, activities: [{ id: 'a', personId: 'p', occurredOn: '2026-10-05', kind: 'gift', note: '커피와 꽃', amountWon: 99999 }] });
  assert.match(result.items[0].label, /2026-10-05/);
  assert.doesNotMatch(JSON.stringify(result), /99999/);
});
test('card theme is derived from current Loom canonical colors and spacing', () => {
  assert.equal(readFileSync(themeBuild.target, 'utf8').replace(/\r\n/g, '\n'), themeBuild.build());
});
