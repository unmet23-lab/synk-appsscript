'use strict';
// 사무실 꾸미기의 저장(desktop/src/office-store.cjs, docs/디자인/솔리오_사무실스킨_20261123/PC앱_설계.md 4절).
// 스킨과 자리마다의 모자 · 이름은 화면에 넘길 때만 거르고, 파일에는 읽은 그대로 남는다(설계 검토 1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOfficeStore, MAX_LOOKS } = require('../src/office-store.cjs');

const A = 'owner-1234567890';
function setup() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'office-looks-'));
  const userData = path.join(top, 'userData'), work = path.join(top, 'work');
  for (const d of ['shop', 'law']) fs.mkdirSync(path.join(work, d), { recursive: true });
  let n = 0;
  const make = () => createOfficeStore({ userData, cores: () => 8, randomId: () => `dept${++n}` });
  const file = () => path.join(userData, 'Office', A, 'office.json');
  return { store: make(), make, file, w: d => path.join(work, d), raw: () => JSON.parse(fs.readFileSync(file(), 'utf8')) };
}
const look = (seat, v) => ({ look: { seat, ...v } });

test('a fresh account wears the black skin with no looks; an old file without the two keys reads the same', async () => {
  const { store, file, w } = setup();
  const first = (await store.read(A)).data;
  assert.equal(first.skin, 'black');
  assert.deepEqual(first.looks, {});
  await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') });
  const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
  assert.equal('skin' in raw || 'looks' in raw, false, 'a save that does not touch the looks writes neither key');
  assert.equal((await store.read(A)).data.skin, 'black');
});

test('the skin and one seat at a time are saved, come back from a fresh store, and the same value again writes nothing', async () => {
  const { store, make, file, w, raw } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id;
  const skin = await store.saveSettings(A, { skin: 'walnut' });
  assert.equal(skin.ok, true);
  assert.equal(skin.data.skin, 'walnut');
  assert.equal((await store.saveSettings(A, look(`d:${shop}:0`, { hat: 'beanie' }))).data.looks[`d:${shop}:0`].hat, 'beanie');
  const named = await store.saveSettings(A, look(`d:${shop}:0`, { name: '  서진  ' }));
  assert.deepEqual(named.data.looks[`d:${shop}:0`], { hat: 'beanie', name: '서진' }, 'the name is trimmed and the hat stays');
  await store.saveSettings(A, look('lobby:1', { hat: 'gat' }));
  const again = make();
  const back = (await again.read(A)).data;
  assert.equal(back.skin, 'walnut');
  assert.deepEqual(back.looks, { [`d:${shop}:0`]: { hat: 'beanie', name: '서진' }, 'lobby:1': { hat: 'gat' } });
  const before = fs.statSync(file()).mtimeMs, text = fs.readFileSync(file(), 'utf8');
  for (const same of [{ skin: 'walnut' }, look(`d:${shop}:0`, { hat: 'beanie' }), look(`d:${shop}:0`, { name: '서진' }), look('lobby:2', { hat: null }), look('lobby:2', { name: '' })]) {
    const r = await again.saveSettings(A, same);
    assert.equal(r.ok, true);
    assert.equal(r.unchanged, true, JSON.stringify(same));
  }
  assert.equal(fs.readFileSync(file(), 'utf8'), text);
  assert.equal(fs.statSync(file()).mtimeMs, before);
  assert.equal(raw().view, 'tilted', 'the other settings stay');
});

test('taking off the hat and clearing the name drops the seat; a name equal to nothing returns to the first name', async () => {
  const { store, w, raw } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id, seat = `d:${shop}:2`;
  await store.saveSettings(A, look(seat, { hat: 'sprout' }));
  await store.saveSettings(A, look(seat, { name: '민지' }));
  assert.deepEqual((await store.saveSettings(A, look(seat, { hat: null }))).data.looks, { [seat]: { name: '민지' } });
  const cleared = await store.saveSettings(A, look(seat, { name: '   ' }));
  assert.deepEqual(cleared.data.looks, {});
  assert.deepEqual(raw().looks, {}, 'the emptied seat is gone from the file');
});

test('values are refused here too: unknown skin and hat, a seat with a leading zero or an unknown zone, a long or hidden-character name, mixed settings', async () => {
  const { store, w } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id, seat = `d:${shop}:0`;
  const refused = [
    { skin: 'hanok' }, { skin: 'walnut', view: 'top' }, { skin: 'walnut', look: { seat, hat: 'gat' } }, { look: { seat, hat: 'gat' }, manualCap: 2 },
    look(seat, { hat: 'crown' }), look(seat, { hat: 'gat', name: '서진' }), look(seat, {}), look(seat, { name: 3 }),
    look(`d:${shop}:01`, { hat: 'gat' }), look(`d:${shop}:100`, { hat: 'gat' }), look('other:0', { hat: 'gat' }), look('lobby', { hat: 'gat' }),
    look(seat, { name: '열세글자이름입니다아아아아' }), look(seat, { name: '서​진' }), look(seat, { name: '서‮진' }), look(seat, { name: '서\n진' }),
    { look: 'd:x:0' },
  ];
  for (const input of refused) assert.equal((await store.saveSettings(A, input)).code, 'VALUE', JSON.stringify(input));
  assert.equal((await store.saveSettings(A, look(seat, { name: '열두글자이름입니다아아아' }))).ok, true, 'twelve characters are fine');
  assert.equal((await store.saveSettings(A, look('d:nodept:0', { hat: 'gat' }))).code, 'NOT_FOUND', 'a seat of a department that is not there');
});

test('a department taken out takes its seats with it; other departments and the lobby keep theirs', async () => {
  const { store, w, raw } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id;
  const law = (await store.saveDepartment(A, { name: '법무', folder: w('law') })).data.departments[1].id;
  for (const seat of [`d:${shop}:0`, `d:${shop}:1`, `d:${law}:0`, 'lobby:0']) await store.saveSettings(A, look(seat, { hat: 'beret' }));
  const r = await store.removeDepartment(A, shop);
  assert.deepEqual(Object.keys(r.data.looks).sort(), [`d:${law}:0`, 'lobby:0']);
  assert.deepEqual(Object.keys(raw().looks).sort(), [`d:${law}:0`, 'lobby:0']);
});

test('설계 검토 1: a later build\'s hat, skin and extra fields survive a write by this build, but are not shown', async () => {
  const { store, file, w, raw } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id;
  const text = JSON.parse(fs.readFileSync(file(), 'utf8'));
  text.skin = 'hanok';
  text.looks = { [`d:${shop}:0`]: { hat: 'crown', name: '서진', glow: 'gold' }, [`d:${shop}:1`]: { hat: 'gat' }, 'd:gone:0': { hat: 'gat' }, 'x:1': 3, 'lobby:01': { hat: 'gat' } };
  fs.writeFileSync(file(), JSON.stringify(text));
  const shown = (await store.read(A)).data;
  assert.equal(shown.skin, 'black', 'an unknown skin shows as black');
  assert.deepEqual(shown.looks, { [`d:${shop}:0`]: { name: '서진' }, [`d:${shop}:1`]: { hat: 'gat' } }, 'only known hats, real departments and well-formed seats are shown');
  await store.saveSettings(A, { view: 'top' });
  await store.assign(A, '00000001-0000-4000-8000-000000000001', shop);
  assert.equal(raw().skin, 'hanok', 'the later skin is still in the file');
  assert.deepEqual(raw().looks, text.looks, 'every seat, known or not, is still in the file');
  await store.saveSettings(A, look(`d:${shop}:0`, { name: '도윤' }));
  assert.deepEqual(raw().looks[`d:${shop}:0`], { hat: 'crown', name: '도윤', glow: 'gold' }, 'changing the name keeps the later hat and field');
  await store.saveSettings(A, look(`d:${shop}:0`, { hat: null }));
  assert.deepEqual(raw().looks[`d:${shop}:0`], { name: '도윤', glow: 'gold' });
  await store.saveSettings(A, { skin: 'walnut' });
  assert.equal(raw().skin, 'walnut', 'the skin is replaced only when the customer picks one');
});

test('looks that are not an object in the file are left alone until a seat is saved', async () => {
  const { store, file, w, raw } = setup();
  await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') });
  const text = JSON.parse(fs.readFileSync(file(), 'utf8'));
  text.looks = ['x'];
  fs.writeFileSync(file(), JSON.stringify(text));
  assert.deepEqual((await store.read(A)).data.looks, {});
  await store.saveSettings(A, { view: 'top' });
  assert.deepEqual(raw().looks, ['x']);
  await store.saveSettings(A, look('lobby:0', { hat: 'gat' }));
  assert.deepEqual(raw().looks, { 'lobby:0': { hat: 'gat' } });
});

test('two saves at once both stay, and the seats are capped', async () => {
  const { store, file, w, raw } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id;
  await Promise.all([store.saveSettings(A, look(`d:${shop}:0`, { hat: 'gat' })), store.saveSettings(A, look(`d:${shop}:0`, { name: '서진' })), store.saveSettings(A, { skin: 'walnut' })]);
  assert.deepEqual(raw().looks[`d:${shop}:0`], { hat: 'gat', name: '서진' });
  assert.equal(raw().skin, 'walnut');
  const text = JSON.parse(fs.readFileSync(file(), 'utf8'));
  text.looks = Object.fromEntries(Array.from({ length: MAX_LOOKS }, (_, i) => [`x:${i}`, { hat: 'gat' }]));
  fs.writeFileSync(file(), JSON.stringify(text));
  assert.equal((await store.saveSettings(A, look('lobby:0', { hat: 'gat' }))).code, 'LOOK_LIMIT');
});
