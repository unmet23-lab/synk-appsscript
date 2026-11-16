'use strict';
// 「새 PC로 옮겨 오기」의 창 앱 입력 (STAGE1_DESIGN.md 4.6): the folder choices the screen sends, and a PC that already
// writes taking old files out only into new folders (「옛 PC 백업에서 꺼내기」, 검토 M2).
const test = require('node:test');
const assert = require('node:assert/strict');
const { moveInput: { moveChoices, writerChoices } } = require('../worker/handlers.cjs');

test('folder choices: only the known places, at most 30 folders, nothing else carried', () => {
  assert.deepEqual(moveChoices({}), {});
  assert.deepEqual(moveChoices({ choices: { 'C:\\Users\\a\\Documents': { mode: 'original', sameDrive: true, extra: 1 } } }), { 'C:\\Users\\a\\Documents': { mode: 'original', sameDrive: true } });
  for (const bad of [null, [], 'x', { 'C:\\a': { mode: 'everywhere' } }, { 'C:\\a': null }, { 'C:\\a': { mode: 'skip', sameDrive: 'yes' } }, Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`C:\\f${i}`, { mode: 'skip' }])), { ['C:\\' + 'a'.repeat(1030)]: { mode: 'skip' } }])
    assert.throws(() => moveChoices({ choices: bad }), (e) => e.code === 'BAD_INPUT', JSON.stringify(bad)?.slice(0, 40));
});

test('a PC that writes: every folder of the old backup goes into a new folder unless left out', () => {
  const c = writerChoices({ 'C:\\Users\\a\\Documents': { mode: 'original' }, 'D:\\Work': { mode: 'skip' }, 'E:\\Share': { mode: 'oneDriveGaps' } });
  assert.deepEqual(c['C:\\Users\\a\\Documents'], { mode: 'newFolder' });
  assert.deepEqual(c['E:\\Share'], { mode: 'newFolder' });
  assert.deepEqual(c['D:\\Work'], { mode: 'skip' });
  assert.deepEqual(c['C:\\Users\\a\\Pictures'], { mode: 'newFolder' }, 'a folder the screen did not name');
  assert.equal(c.toJSON, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(c)), { 'C:\\Users\\a\\Documents': { mode: 'newFolder' }, 'D:\\Work': { mode: 'skip' }, 'E:\\Share': { mode: 'newFolder' } });
});
