'use strict';
// 솔리오 「사무실」의 계정마다의 파일(office-store.cjs, 구현설계.md 5절 · 6절 · 12.1 · 14.1). userData와 부서 폴더는 모두 임시 폴더다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOfficeStore, MAX_DEPARTMENTS, MAX_ASSIGNMENTS } = require('../src/office-store.cjs');
const { loadOfficeModel } = require('../src/office.cjs');

const A = 'owner-1234567890', B = 'tester-1234567890';
const sid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
function setup() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'office-store-'));
  const userData = path.join(top, 'userData');
  const work = path.join(top, 'work');
  for (const d of ['shop', 'shop\\api', 'law', 'blog']) fs.mkdirSync(path.join(work, d), { recursive: true });
  fs.writeFileSync(path.join(work, 'file.txt'), 'x');
  let n = 0;
  const store = createOfficeStore({ userData, cores: () => 8, randomId: () => `dept${++n}` });
  const file = id => path.join(userData, 'Office', id, 'office.json');
  return { top, userData, work, store, file, w: d => path.join(work, d) };
}

test('a missing file reads as defaults and each account has its own file', async () => {
  const { store, file, w } = setup();
  assert.deepEqual(await store.read(A), { ok: true, data: { view: 'tilted', manualCap: null, departments: [], assignments: {}, roots: { claude: [] } } });
  assert.equal(fs.existsSync(file(A)), false, 'reading writes nothing');
  const r = await store.saveDepartment(A, { name: '  쇼핑몰  ', folder: w('shop') + '\\' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.departments, [{ id: 'dept1', name: '쇼핑몰', folder: w('shop') }], 'name trimmed, trailing separator removed, id made here');
  assert.deepEqual((await store.read(B)).data.departments, [], 'another account does not see it');
  assert.ok(fs.existsSync(file(A)) && !fs.existsSync(file(B)));
  assert.equal(store.fileOf('../escape'), null);
});

test('every validation code', async () => {
  const { store, w, work } = setup();
  for (const bad of ['../x1234567', 'a/b/c/d/e/f', 'short', '', null, 42]) assert.deepEqual(await store.read(bad), { ok: false, code: 'ACCOUNT' }, String(bad));
  assert.equal((await store.saveDepartment('..\\..\\evil', { name: 'x', folder: w('shop') })).code, 'ACCOUNT');
  const save = input => store.saveDepartment(A, input);
  assert.equal((await save(null)).code, 'VALUE');
  assert.equal((await save({ name: '', folder: w('shop') })).code, 'NAME');
  assert.equal((await save({ name: '   ', folder: w('shop') })).code, 'NAME');
  assert.equal((await save({ name: '가'.repeat(21), folder: w('shop') })).code, 'NAME');
  assert.equal((await save({ name: '줄\n바꿈', folder: w('shop') })).code, 'NAME');
  assert.equal((await save({ name: '가'.repeat(20), folder: w('shop') })).ok, true, 'twenty characters are fine');
  assert.equal((await save({ name: 'Shop', folder: w('shop') })).ok, true);
  assert.equal((await save({ name: ' shop ', folder: w('law') })).code, 'NAME_TAKEN', 'names are unique ignoring case and spaces');
  assert.equal((await save({ name: '법무', folder: 'relative\\law' })).code, 'FOLDER');
  assert.equal((await save({ name: '법무', folder: w('missing') })).code, 'FOLDER');
  assert.equal((await save({ name: '법무', folder: path.join(work, 'file.txt') })).code, 'FOLDER', 'a file is not a folder');
  assert.equal((await save({ name: '법무', folder: w('law'), tool: 'gemini' })).code, 'VALUE');
  assert.equal((await save({ name: '법무', folder: w('law'), role: 'x'.repeat(1001) })).code, 'VALUE');
  assert.equal((await save({ id: 'nope1234', name: '법무', folder: w('law') })).code, 'NOT_FOUND');
  assert.equal((await save({ id: 7, name: '법무', folder: w('law') })).code, 'VALUE');
  assert.equal((await store.removeDepartment(A, 'nope1234')).code, 'NOT_FOUND');
  assert.equal((await store.removeDepartment(A, 5)).code, 'VALUE');
  assert.equal((await store.assign(A, sid(1), 'nope1234')).code, 'NOT_FOUND');
  assert.equal((await store.assign(A, '../../x', 'dept1')).code, 'VALUE');
  assert.equal((await store.assign(A, '12345678', 'dept1')).code, 'VALUE', 'digit-only ids would reorder in an object');
  assert.equal((await store.saveSettings(A, {})).code, 'VALUE');
  assert.equal((await store.saveSettings(A, { view: 'side' })).code, 'VALUE');
  for (const cap of [0, 9, 1.5, '3', -1]) assert.equal((await store.saveSettings(A, { manualCap: cap })).code, 'VALUE', String(cap));
  assert.equal((await store.saveRoots(A, 'C:\\x')).code, 'VALUE');
  assert.equal((await store.saveRoots(A, ['relative'])).code, 'FOLDER');
  assert.equal((await store.saveRoots(A, [w('missing')])).code, 'FOLDER');
  const accounts = path.join(work, 'userData', 'AiSubscriptions', 'accounts', 'claude-1');
  fs.mkdirSync(accounts, { recursive: true });
  assert.equal((await store.saveRoots(A, [accounts])).code, 'FOLDER', 'the subscription room account folders are not watched');
  const nine = Array.from({ length: 9 }, (_, i) => { const d = path.join(work, 'roots', 'r' + i); fs.mkdirSync(d, { recursive: true }); return d; });
  assert.equal((await store.saveRoots(A, nine)).code, 'LIMIT');
  // 부서는 스물넷까지
  for (let i = (await store.read(A)).data.departments.length; i < MAX_DEPARTMENTS; i++) assert.equal((await save({ name: '부서' + i, folder: w('blog') })).ok, true);
  assert.equal((await save({ name: '하나 더', folder: w('blog') })).code, 'LIMIT');
});

test('settings, roots and department updates keep what they did not touch', async () => {
  const { store, w, work } = setup();
  assert.deepEqual((await store.saveSettings(A, { view: 'top' })).data.view, 'top');
  const capped = await store.saveSettings(A, { manualCap: 8 });
  assert.deepEqual([capped.data.view, capped.data.manualCap], ['top', 8]);
  assert.equal((await store.saveSettings(A, { manualCap: null })).data.manualCap, null);
  const r = await store.saveRoots(A, { claude: [w('law'), w('law').toUpperCase() + '\\', w('blog')] });
  assert.deepEqual(r.data.roots.claude, [w('law'), w('blog')], 'duplicates by case and trailing separator are one');
  const d = await store.saveDepartment(A, { name: '법무', folder: w('law'), role: '계약서를 봅니다', tool: 'claude' });
  const id = d.data.departments[0].id;
  const renamed = await store.saveDepartment(A, { id, name: '법무팀', folder: w('law') });
  assert.deepEqual(renamed.data.departments, [{ id, name: '법무팀', folder: w('law'), role: '계약서를 봅니다', tool: 'claude' }], 'role and tool stay when not given');
  const cleared = await store.saveDepartment(A, { id, name: '법무팀', folder: w('law'), role: null });
  assert.equal('role' in cleared.data.departments[0], false);
  assert.ok(work);
});

test('removing a department drops the assignments that point at it; assignments are capped, oldest first', async () => {
  const { store, w, file } = setup();
  const shop = (await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') })).data.departments[0].id;
  const law = (await store.saveDepartment(A, { name: '법무', folder: w('law') })).data.departments[1].id;
  await store.assign(A, sid(1), shop);
  await store.assign(A, sid(2), law);
  await store.assign(A, sid(3), shop);
  const unchanged = await store.assign(A, sid(3), shop);
  assert.equal(unchanged.unchanged, true, 'the same assignment again writes nothing');
  const removed = await store.removeDepartment(A, shop);
  assert.deepEqual(removed.data.assignments, { [sid(2)]: law });
  assert.deepEqual(removed.data.departments.map(d => d.id), [law]);
  assert.deepEqual((await store.assign(A, sid(2), null)).data.assignments, {}, 'null forgets');
  // 꽉 찬 기억을 파일에 바로 적고 셋을 더한다(500번 쓰는 대신)
  const raw = JSON.parse(fs.readFileSync(file(A), 'utf8'));
  raw.assignments = Object.fromEntries(Array.from({ length: MAX_ASSIGNMENTS }, (_, i) => [sid(101 + i), law]));
  fs.writeFileSync(file(A), JSON.stringify(raw));
  for (let i = MAX_ASSIGNMENTS + 1; i <= MAX_ASSIGNMENTS + 3; i++) await store.assign(A, sid(100 + i), law);
  const all = (await store.read(A)).data.assignments;
  assert.equal(Object.keys(all).length, MAX_ASSIGNMENTS);
  assert.equal(Object.keys(all)[0], sid(104), 'the three oldest fell off');
  assert.equal(Object.keys(all).at(-1), sid(100 + MAX_ASSIGNMENTS + 3));
  const forgot = await store.forgetSessions(A, [sid(104), sid(105)]);
  assert.equal(Object.keys(forgot.data.assignments).length, MAX_ASSIGNMENTS - 2);
  assert.equal((await store.forgetSessions(A, ['gone-000000'])).unchanged, true);
});

test('unknown keys in the file and in a department are kept on write', async () => {
  const { store, file, w } = setup();
  fs.mkdirSync(path.dirname(file(A)), { recursive: true });
  fs.writeFileSync(file(A), JSON.stringify({
    future: { a: 1 }, view: 'top', manualCap: 4,
    departments: [{ id: 'keep1234', name: '쇼핑몰', folder: w('shop'), color: '#123456' }, { id: 'bad' }],
    assignments: { [sid(1)]: 'keep1234', [sid(2)]: 'gone1234' },
    roots: { claude: [w('law')], gemini: ['G:\\x'] },
    later: [1, 2],
  }));
  const read = (await store.read(A)).data;
  assert.deepEqual(read.departments, [{ id: 'keep1234', name: '쇼핑몰', folder: w('shop') }], 'the screen gets known keys only; broken entries are skipped');
  assert.deepEqual(read.assignments, { [sid(1)]: 'keep1234' });
  await store.saveDepartment(A, { id: 'keep1234', name: '온라인몰', folder: w('shop') });
  await store.saveSettings(A, { view: 'tilted' });
  const raw = JSON.parse(fs.readFileSync(file(A), 'utf8'));
  assert.deepEqual(raw.future, { a: 1 });
  assert.deepEqual(raw.later, [1, 2]);
  assert.deepEqual(raw.roots.gemini, ['G:\\x']);
  assert.equal(raw.departments[0].color, '#123456', 'a key a later version added to a department survives an edit');
  assert.equal(raw.departments[0].name, '온라인몰');
  assert.equal(raw.view, 'tilted');
  assert.equal(raw.manualCap, 4);
  assert.deepEqual(Object.keys(raw).slice(0, 2), ['future', 'view'], 'key order is kept');
});

test('a corrupt file reads as defaults, is not overwritten until the first save, and then a .bad copy is kept', async () => {
  const { store, file, w } = setup();
  fs.mkdirSync(path.dirname(file(A)), { recursive: true });
  fs.writeFileSync(file(A), '{ broken');
  assert.deepEqual((await store.read(A)).data.departments, []);
  await store.read(A);
  assert.equal(fs.readFileSync(file(A), 'utf8'), '{ broken', 'reads never write');
  assert.equal(fs.existsSync(file(A) + '.bad'), false);
  assert.equal((await store.saveSettings(A, { view: 'top' })).ok, true);
  assert.equal(fs.readFileSync(file(A) + '.bad', 'utf8'), '{ broken');
  assert.equal(JSON.parse(fs.readFileSync(file(A), 'utf8')).view, 'top');
  await store.saveDepartment(A, { name: '블로그', folder: w('blog') });
  assert.equal(fs.readFileSync(file(A) + '.bad', 'utf8'), '{ broken', 'one copy; later saves of a good file do not touch it');
  fs.writeFileSync(file(A), '[1,2]');
  assert.deepEqual((await store.read(A)).data.departments, [], 'an array is not the file shape');
});

test('writes go to a temp file in the same folder and are renamed in; a failed rename leaves the old file', async () => {
  const { userData, file, w } = setup();
  const ops = [];
  const real = fs.promises;
  let failRename = false;
  const fsImpl = { promises: {
    ...real,
    readFile: (...a) => real.readFile(...a),
    writeFile: (p, ...a) => { ops.push(['writeFile', p]); return real.writeFile(p, ...a); },
    rename: (from, to) => { ops.push(['rename', from, to]); return failRename ? Promise.reject(Object.assign(new Error('busy'), { code: 'EBUSY' })) : real.rename(from, to); },
    unlink: p => { ops.push(['unlink', p]); return real.unlink(p); },
  } };
  const store = createOfficeStore({ userData, fsImpl, cores: () => 8 });
  await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') });
  const [write, rename] = ops;
  assert.equal(write[0], 'writeFile');
  assert.equal(path.dirname(write[1]), path.dirname(file(A)));
  assert.match(path.basename(write[1]), /^office\.json\.\d+\.[0-9a-f]{8}\.tmp$/);
  assert.deepEqual(rename, ['rename', write[1], file(A)]);
  const before = fs.readFileSync(file(A), 'utf8');
  failRename = true; ops.length = 0;
  assert.deepEqual(await store.saveSettings(A, { view: 'top' }), { ok: false, code: 'WRITE' });
  assert.equal(fs.readFileSync(file(A), 'utf8'), before);
  assert.deepEqual(ops.map(o => o[0]), ['writeFile', 'rename', 'unlink']);
  assert.deepEqual(fs.readdirSync(path.dirname(file(A))), ['office.json'], 'no temp file is left');
});

test('two saves at once for one account are applied in order, none lost', async () => {
  const { store, w } = setup();
  const results = await Promise.all([
    store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') }),
    store.saveDepartment(A, { name: '법무', folder: w('law') }),
    store.saveSettings(A, { view: 'top' }),
  ]);
  assert.ok(results.every(r => r.ok));
  const data = (await store.read(A)).data;
  assert.deepEqual(data.departments.map(d => d.name), ['쇼핑몰', '법무']);
  assert.equal(data.view, 'top');
});

test('the store never touches a path outside userData/Office/ (nothing goes into desktop-preferences.json)', async () => {
  const { userData, top, w } = setup();
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'desktop-preferences.json'), '{"keep":true}');
  const seen = [];
  const real = fs.promises;
  const wrap = name => (...a) => { seen.push([name, String(a[0]), a[1] && typeof a[1] === 'string' ? String(a[1]) : null]); return real[name](...a); };
  const fsImpl = { promises: Object.fromEntries(['readFile', 'writeFile', 'rename', 'mkdir', 'copyFile', 'unlink', 'stat', 'open', 'readdir', 'rm', 'appendFile'].map(n => [n, wrap(n)])) };
  const store = createOfficeStore({ userData, fsImpl, cores: () => 8 });
  const office = path.join(userData, 'Office') + path.sep;
  fs.mkdirSync(path.join(userData, 'Office', A), { recursive: true });
  fs.writeFileSync(path.join(userData, 'Office', A, 'office.json'), '{ broken');
  await store.read(A);
  const d = await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') });
  await store.saveDepartment(A, { id: d.data.departments[0].id, name: '쇼핑', folder: w('shop') });
  await store.assign(A, sid(1), d.data.departments[0].id);
  await store.saveSettings(A, { view: 'top', manualCap: 2 });
  await store.saveRoots(A, [w('law')]);
  await store.removeDepartment(A, d.data.departments[0].id);
  await store.read(B);
  const outside = seen.filter(([, p]) => !p.startsWith(office));
  assert.deepEqual(outside.map(([op]) => op), ['stat', 'stat'], 'outside userData/Office only newly chosen folders are checked with stat (the same stored folder is not checked again, GA4)');
  assert.deepEqual(outside.map(([, p]) => p).sort(), [w('law'), w('shop')].sort());
  for (const [, p, q] of seen) for (const x of [p, q]) if (x) assert.ok(!/desktop-preferences/i.test(x));
  assert.equal(fs.readFileSync(path.join(userData, 'desktop-preferences.json'), 'utf8'), '{"keep":true}');
  assert.ok(top);
});

test('overlapping department folders: the deepest department wins (with office-model)', async () => {
  const { store, w } = setup();
  const model = await loadOfficeModel();
  await store.saveDepartment(A, { name: '쇼핑몰', folder: w('shop') });
  await store.saveDepartment(A, { name: 'API', folder: w('shop\\api') });
  const { departments, assignments } = (await store.read(A)).data;
  const api = departments.find(d => d.name === 'API').id, shop = departments.find(d => d.name === '쇼핑몰').id;
  assert.equal(model.officeDepartmentOf({ cwd: path.join(w('shop\\api'), 'src') }, departments, assignments), api);
  assert.equal(model.officeDepartmentOf({ cwd: w('shop') }, departments, assignments), shop);
  assert.equal(model.officeDepartmentOf({ cwd: w('shop') + '2' }, departments, assignments), null);
});

/* ── GPT 검수 GA3 · GA4(11-20): 보는 폴더 더하기 · 빼기는 차례 안에서 읽고 고치고, 있는지는 더하는 폴더만 본다 ── */
test('GA3: overlapping root removals and an add+remove each read the latest list inside the queue, so none comes back', async () => {
  const { store, w } = setup();
  for (const d of ['r1', 'r2', 'r3']) fs.mkdirSync(w(d));
  assert.equal((await store.saveRoots(A, [w('r1'), w('r2')])).ok, true);
  const both = await Promise.all([store.removeRoot(A, w('r1')), store.removeRoot(A, w('r2'))]);
  assert.ok(both.every(r => r.ok), 'both report success');
  assert.deepEqual((await store.read(A)).data.roots.claude, [], 'and both are really gone');
  const mixed = await Promise.all([store.addRoot(A, w('r3')), store.addRoot(A, w('r1')), store.removeRoot(A, w('r3'))]);
  assert.ok(mixed.every(r => r.ok));
  assert.deepEqual((await store.read(A)).data.roots.claude, [w('r1')], 'applied in call order: add r3, add r1, remove r3');
  assert.deepEqual(await store.removeRoot(A, w('r3')), { ok: false, code: 'NOT_FOUND' });
  assert.equal((await store.removeRoot(A, w('r1').toUpperCase() + '\\')).ok, true, 'case and a trailing separator do not matter');
  assert.equal((await store.addRoot(A, 'relative')).code, 'FOLDER');
  assert.equal((await store.removeRoot(A, '')).code, 'VALUE');
  // 부서 고치기도 같은 차례다: 폴더 바꾸기와 이름 고치기가 겹쳐도 서로 덮지 않는다
  const id = (await store.saveDepartment(A, { name: '법무', folder: w('law') })).data.departments[0].id;
  await Promise.all([store.saveDepartment(A, { id, name: '법무', folder: w('blog') }), store.saveDepartment(A, { id, name: '법무팀' })]);
  assert.deepEqual((await store.read(A)).data.departments.map(d => [d.name, d.folder]), [['법무팀', w('blog')]], 'the rename keeps the folder that was stored when its turn came');
});

test('GA4: folders that went missing can still be removed one by one; only an added folder must exist', async () => {
  const { store, w } = setup();
  for (const d of ['gone1', 'gone2', 'here']) fs.mkdirSync(w(d));
  assert.equal((await store.saveRoots(A, [w('gone1'), w('gone2'), w('here')])).ok, true);
  fs.rmSync(w('gone1'), { recursive: true });
  fs.rmSync(w('gone2'), { recursive: true });
  assert.deepEqual(await store.removeRoot(A, w('gone1')).then(r => [r.ok, r.data.roots.claude]), [true, [w('gone2'), w('here')]]);
  assert.deepEqual(await store.removeRoot(A, w('gone2')).then(r => [r.ok, r.data.roots.claude]), [true, [w('here')]]);
  // 통째 저장도 이미 있던 폴더는 다시 보지 않는다. 새 폴더는 있어야 한다
  fs.mkdirSync(w('gone1'));
  assert.equal((await store.saveRoots(A, [w('here'), w('gone1')])).ok, true);
  fs.rmSync(w('gone1'), { recursive: true });
  assert.equal((await store.saveRoots(A, [w('gone1')])).ok, true, 'a stored folder that went missing is kept without a check');
  assert.equal((await store.saveRoots(A, [w('gone1'), w('gone2')])).code, 'FOLDER', 'a new folder that does not exist is refused');
  assert.equal((await store.addRoot(A, w('gone2'))).code, 'FOLDER');
  assert.equal((await store.addRoot(A, w('here'))).ok, true);
  // 부서도 같다: 저장된 폴더가 없어져도 이름은 고칠 수 있고, 새로 고른 폴더만 본다
  const id = (await store.saveDepartment(A, { name: '외장', folder: w('blog') })).data.departments[0].id;
  fs.rmSync(w('blog'), { recursive: true });
  assert.equal((await store.saveDepartment(A, { id, name: '외장 드라이브' })).ok, true);
  assert.equal((await store.saveDepartment(A, { id, name: '외장 드라이브 2', folder: w('blog') })).ok, true, 'the same stored folder is not checked again');
  assert.equal((await store.saveDepartment(A, { id, name: '외장', folder: w('gone2') })).code, 'FOLDER');
});
