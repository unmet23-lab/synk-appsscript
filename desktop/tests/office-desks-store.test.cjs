'use strict';
// 부서의 책상 저장(desktop/src/office-store.cjs, docs/디자인/솔리오_사무실책상_20261125/README.md 5절).
// 화면에 넘길 때만 거르고 파일에는 읽은 그대로 남긴다. 부서 하나의 칸 하나만 고친다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOfficeStore, DESK_SIZES, DESK_COUNT_MAX, DESK_FINISHES } = require('../src/office-store.cjs');

const A = 'owner-1234567890';
async function setup() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'office-desks-'));
  const userData = path.join(top, 'userData'), work = path.join(top, 'work');
  for (const d of ['mkt', 'dev', 'law']) fs.mkdirSync(path.join(work, d), { recursive: true });
  let n = 0;
  const make = () => createOfficeStore({ userData, cores: () => 8, randomId: () => `dept${++n}` });
  const file = () => path.join(userData, 'Office', A, 'office.json');
  const store = make(), w = d => path.join(work, d);
  for (const [name, dir] of [['마케팅부', 'mkt'], ['개발부', 'dev']]) await store.saveDepartment(A, { name, folder: w(dir) });
  const [mkt, dev] = (await store.read(A)).data.departments.map(d => d.id);
  return { store, make, file, w, mkt, dev, raw: () => JSON.parse(fs.readFileSync(file(), 'utf8')) };
}
const desk = (department, v) => ({ desk: { department, ...v } });
const deskOf = (data, id) => data.departments.find(d => d.id === id).desk;

test('the values a desk can take', () => {
  assert.deepEqual([...DESK_SIZES], [1, 2, 3, 4]);
  assert.equal(DESK_COUNT_MAX, 6);
  assert.deepEqual([...DESK_FINISHES], ['black', 'walnut']);
});

test('a department starts without a desk setting, and saving other things does not write one', async () => {
  const { store, mkt, raw, w } = await setup();
  assert.equal(deskOf((await store.read(A)).data, mkt), undefined);
  await store.saveDepartment(A, { id: mkt, name: '마케팅팀' });
  await store.saveDepartment(A, { name: '법무부', folder: w('law') });
  assert.equal(raw().departments.some(d => 'desk' in d), false);
});

test('size, count and finish are saved one at a time on one department, and come back from a fresh store', async () => {
  const { store, make, mkt, dev, file } = await setup();
  assert.deepEqual(deskOf((await store.saveSettings(A, desk(mkt, { size: 2 }))).data, mkt), { size: 2 });
  assert.deepEqual(deskOf((await store.saveSettings(A, desk(mkt, { count: 4 }))).data, mkt), { size: 2, count: 4 });
  assert.deepEqual(deskOf((await store.saveSettings(A, desk(mkt, { finish: 'walnut' }))).data, mkt), { size: 2, count: 4, finish: 'walnut' });
  const back = (await make().read(A)).data;
  assert.deepEqual(deskOf(back, mkt), { size: 2, count: 4, finish: 'walnut' });
  assert.equal(deskOf(back, dev), undefined, 'another department keeps its own');
  // 같은 값은 쓰지 않는다
  const text = fs.readFileSync(file(), 'utf8'), at = fs.statSync(file()).mtimeMs;
  for (const same of [desk(mkt, { size: 2 }), desk(mkt, { count: 4 }), desk(mkt, { finish: 'walnut' }), desk(dev, { finish: null })]) assert.equal((await store.saveSettings(A, same)).unchanged, true, JSON.stringify(same));
  assert.equal(fs.readFileSync(file(), 'utf8'), text);
  assert.equal(fs.statSync(file()).mtimeMs, at);
});

test('finish null follows the office again, and an empty desk leaves no key behind', async () => {
  const { store, mkt, raw } = await setup();
  await store.saveSettings(A, desk(mkt, { finish: 'black' }));
  const r = await store.saveSettings(A, desk(mkt, { finish: null }));
  assert.equal(deskOf(r.data, mkt), undefined);
  assert.equal('desk' in raw().departments[0], false);
});

test('bad values, mixed values and unknown departments are refused', async () => {
  const { store, mkt, file } = await setup();
  const text = fs.readFileSync(file(), 'utf8');
  for (const v of [{ size: 0 }, { size: 5 }, { size: '2' }, { size: 2.5 }, { count: 0 }, { count: 7 }, { count: 1.5 }, { count: '3' }, { finish: 'glass' }, { finish: '' }, { size: null }, { count: null }, {}, { size: 2, count: 2 }, { wheels: 4 }]) assert.equal((await store.saveSettings(A, desk(mkt, v))).code, 'VALUE', JSON.stringify(v));
  for (const bad of [{ desk: null }, { desk: [] }, { desk: { size: 2 } }, { desk: { department: 7, size: 2 } }, { desk: { department: 'a b', size: 2 } }, { ...desk(mkt, { size: 2 }), skin: 'walnut' }, { ...desk(mkt, { size: 2 }), view: 'top' }, { ...desk(mkt, { size: 2 }), look: { seat: 'lobby:0', hat: null } }]) assert.equal((await store.saveSettings(A, bad)).code, 'VALUE', JSON.stringify(bad));
  assert.equal((await store.saveSettings(A, desk('nosuch', { size: 2 }))).code, 'NOT_FOUND');
  assert.equal((await store.saveSettings('bad account', desk(mkt, { size: 2 }))).code, 'ACCOUNT');
  assert.equal(fs.readFileSync(file(), 'utf8'), text, 'nothing was written');
});

test('what this version does not know stays in the file, and only known values reach the screen', async () => {
  const { make, mkt, dev, file, raw } = await setup();
  const j = raw();
  j.departments[0].desk = { size: 9, count: 2, finish: 'marble', plant: 'fern' };
  j.departments[1].desk = 'broken';
  fs.writeFileSync(file(), JSON.stringify(j));
  const fresh = make(), seen = (await fresh.read(A)).data;
  assert.deepEqual(deskOf(seen, mkt), { count: 2 }, 'an unknown size and finish are not shown');
  assert.equal(deskOf(seen, dev), undefined);
  await fresh.saveSettings(A, desk(mkt, { count: 3 }));
  assert.deepEqual(raw().departments[0].desk, { size: 9, count: 3, finish: 'marble', plant: 'fern' }, 'only the changed field is written');
  await fresh.saveSettings(A, { view: 'top' });
  assert.equal(raw().departments[1].desk, 'broken');
  await fresh.saveSettings(A, desk(dev, { size: 1 }));
  assert.deepEqual(raw().departments[1].desk, { size: 1 }, 'a desk of the wrong shape starts over');
});

test('renaming or moving a department keeps its desk; removing it takes the desk away', async () => {
  const { store, mkt, dev, w, raw } = await setup();
  await store.saveSettings(A, desk(mkt, { size: 4 }));
  await store.saveDepartment(A, { id: mkt, name: '마케팅팀' });
  const moved = await store.saveDepartment(A, { id: mkt, folder: w('law') });
  assert.deepEqual(deskOf(moved.data, mkt), { size: 4 });
  const gone = await store.removeDepartment(A, mkt);
  assert.deepEqual(gone.data.departments.map(d => d.id), [dev]);
  assert.equal(JSON.stringify(raw()).includes('"size"'), false);
});

test('saves in a row all stay, and a changed sign-in stops the write', async () => {
  const { store, mkt, dev, file } = await setup();
  await Promise.all([store.saveSettings(A, desk(mkt, { size: 1 })), store.saveSettings(A, desk(dev, { size: 2 })), store.saveSettings(A, desk(mkt, { count: 5 }))]);
  const data = (await store.read(A)).data;
  assert.deepEqual([deskOf(data, mkt), deskOf(data, dev)], [{ size: 1, count: 5 }, { size: 2 }]);
  const text = fs.readFileSync(file(), 'utf8');
  assert.equal((await store.saveSettings(A, desk(mkt, { size: 3 }), { guard: () => false })).code, 'AUTH_CHANGED');
  assert.equal(fs.readFileSync(file(), 'utf8'), text);
});
