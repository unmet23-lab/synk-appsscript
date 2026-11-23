// 사무실 꾸미기의 줄과 동작(desktop/renderer/office-room.mjs, docs/디자인/솔리오_사무실스킨_20261123/PC앱_설계.md 2~3절 · 6절).
// 모습은 세션이 아니라 자리(부서마다 시작 시각 차례)에 붙는다. 그림(office-floor.mjs)이 받는 장면의 skin · hat · picked도 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { officeState, officeReduce } from '../renderer/office-model.mjs';
import { officeRoom, officeSeated, officeLooksRow, officeLookField, createOfficeRoom, OFFICE_HATS } from '../renderer/office-room.mjs';

const NOW = Date.UTC(2026, 10, 23, 3, 0, 0), S = 1e3;
const hook = (event, sessionId, cwd, at, extra = {}) => ({ kind: 'hook', event, sessionId, cwd, at, ...extra });
const MKT = 'C:\\work\\마케팅', DEV = 'C:\\work\\shop';
const DEPTS = [{ id: 'dmkt', name: '마케팅부', folder: MKT }, { id: 'ddev', name: '개발부', folder: DEV }];
const work = (id, cwd, ago) => hook('PostToolUse', id, cwd, NOW - ago * S, { toolName: 'Write', toolDetail: 'a.md' });
const EVENTS = [work('sess-mkt-0001', MKT, 50), work('sess-mkt-0002', MKT, 40), work('sess-dev-0003', DEV, 30), work('sess-lob-0004', 'C:\\work\\회의록', 20)];
const stateOf = events => events.reduce((s, e) => officeReduce(s, e), officeState());
const snapOf = (patch = {}) => ({
  ok: true, available: true, state: stateOf(EVENTS), departments: DEPTS, assignments: {}, settings: { view: 'tilted', manualCap: null, skin: 'black', looks: {} },
  roots: { claude: [], codex: [], added: [] }, pc: { cores: 8, totalMemGb: 16 }, readAt: NOW, ...patch,
});
const rowOf = (room, key) => room.rows.find(r => r.key === key);
const picks = row => row.more.filter(m => m[0] === 'pick');
const live = row => row.more.find(m => m[0] === 'live')[1];
const staffOf = room => room.floor.zones.flatMap(z => z.staff);

function harness(snap = snapOf()) {
  const calls = [], res = {};
  const api = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); const r = res[name]; return typeof r === 'function' ? r(...args) : r ?? { ok: true }; } });
  const room = createOfficeRoom({ api, snapshot: () => snap, reread: () => {}, changed: () => {} });
  const scene = () => room.scene(snap, NOW, null);
  scene();
  return { room, calls, res, scene, setSnap: s => { snap = s; } };
}

test('seats are counted per department in start order; the lobby has its own; the first name is the department and the number', () => {
  const list = officeSeated([
    { id: 'a', departmentId: 'dmkt' }, { id: 'b', departmentId: 'ddev' }, { id: 'c', departmentId: 'dmkt' }, { id: 'd', departmentId: null },
  ], DEPTS, { 'd:dmkt:1': { hat: 'gat', name: '서진' }, 'd:ddev:0': { hat: 'crown' } });
  assert.deepEqual(list.map(v => [v.seat, v.seatName, v.lookName, v.hat]), [
    ['d:dmkt:0', '마케팅부 1', '', null], ['d:ddev:0', '개발부 1', '', null], ['d:dmkt:1', '마케팅부 2', '서진', 'gat'], ['lobby:0', '부서 없는 일 1', '', null],
  ], 'an unknown hat is not drawn');
  const many = officeSeated(Array.from({ length: 101 }, (_, i) => ({ id: 's' + i, departmentId: 'dmkt' })), DEPTS);
  assert.equal(many[99].seat, 'd:dmkt:99');
  assert.equal(many[100].seat, null, 'the hundred-and-first has no seat key');
});

test('the 꾸미기 row sits between 설정 and 부서 더하기, says the skin and how many wear a hat, and is a watch row', () => {
  const room = officeRoom(snapOf({ settings: { skin: 'walnut', looks: { 'd:dmkt:0': { hat: 'beanie' }, 'lobby:0': { hat: 'gat' }, 'd:ddev:5': { hat: 'gat' } } } }), {}, NOW);
  const keys = room.rows.map(r => r.key);
  assert.deepEqual(keys.slice(-3), ['cfg', 'look', 'add']);
  const row = rowOf(room, 'look');
  assert.equal(row.mid, '호두나무 서재 · 모자 쓴 직원 둘', 'counted from the staff on the floor, not from saved seats');
  assert.equal(row.watch, true);
  assert.deepEqual(picks(row)[0], ['pick', '스킨', [['검정', 'black'], ['호두나무 서재', 'walnut']], 'walnut', '', 'skin']);
  assert.ok(row.more.some(m => m[0] === 'note' && m[1] === '일하는 부서 위에만 탁상 등이 켜집니다.'));
  assert.equal(rowOf(officeRoom(snapOf(), {}, NOW), 'look').mid, '검정');
});

test('the staff to dress are grouped by department; hats and the name are for the picked one, whose name field starts empty', () => {
  const room = officeRoom(snapOf({ settings: { looks: { 'd:dmkt:1': { name: '민지', hat: 'beret' } } } }), { pick: 'd:dmkt:1' }, NOW);
  const row = rowOf(room, 'look'), p = picks(row);
  assert.deepEqual(p.slice(1, 4).map(x => [x[1], x[2], x[3]]), [
    ['마케팅부', [['1번', 'd:dmkt:0'], ['민지', 'd:dmkt:1']], 'd:dmkt:1'],
    ['개발부', [['1번', 'd:ddev:0']], ''],
    ['부서 없는 일', [['1번', 'lobby:0']], ''],
  ]);
  const hats = p.find(x => x[1] === '모자');
  assert.deepEqual(hats[2], OFFICE_HATS.map(([k, w]) => [w, 'd:dmkt:1|' + k]));
  assert.equal(hats[3], 'd:dmkt:1|beret');
  const fld = row.more.find(m => m[0] === 'fld');
  assert.deepEqual(fld, ['fld', '이름', '민지', '비우면 「마케팅부 2」 · 12자까지', 'lname-0-d:dmkt:1', 'text']);
  const plain = rowOf(officeRoom(snapOf(), {}, NOW), 'look').more.find(m => m[0] === 'fld');
  assert.equal(plain[2], '', 'a seat without a name starts empty; the first name is only the hint (설계 검토 5)');
  assert.equal(plain[3], '비우면 「마케팅부 1」 · 12자까지', 'the first staff is picked when none is');
  const one = officeLooksRow({ staff: officeSeated([{ id: 'a', departmentId: 'dmkt' }], DEPTS), pick: 'd:dmkt:0' });
  assert.equal(picks(one)[1][1], '꾸밀 직원', 'one department gets a plain label');
  const none = officeLooksRow({ staff: [] });
  assert.ok(none.more.some(m => m[1] === '직원이 서면 한 명씩 모자를 씌우고 이름을 바꿀 수 있습니다.'));
  assert.equal(picks(none).length, 1, 'only the skin without staff');
});

test('the staff to dress follow the department rows, not who started first; the first of them is picked', () => {
  const events = [work('sess-dev-0003', DEV, 90), work('sess-lob-0004', 'C:\work\회의록', 80), work('sess-mkt-0001', MKT, 50)];
  const row = rowOf(officeRoom(snapOf({ state: stateOf(events) }), {}, NOW), 'look');
  assert.deepEqual(picks(row).slice(1, 4).map(x => x[1]), ['마케팅부', '개발부', '부서 없는 일']);
  assert.equal(picks(row).find(x => x[1] === '모자')[3], 'd:dmkt:0|none');
});

test('a renamed staff line shows the name, with the tool and model small; others keep the tool', () => {
  const room = officeRoom(snapOf({ settings: { looks: { 'd:dmkt:0': { name: '서진' } } } }), {}, NOW);
  const items = rowOf(room, 'd:dmkt').more.filter(m => m[0] === 'staff');
  assert.equal(items[0][2], '서진');
  assert.equal(items[0][3], 'Claude Code');
  assert.equal(items[1][2], 'Claude Code');
});

test('the floor gets the skin, each staff hat, and the picked one only while the 꾸미기 row is open', () => {
  const settings = { skin: 'walnut', looks: { 'd:dmkt:1': { hat: 'sprout' } } };
  const closed = officeRoom(snapOf({ settings }), { pick: 'd:dmkt:1' }, NOW);
  assert.equal(closed.floor.skin, 'walnut');
  assert.equal(closed.floor.skinSeq, 0);
  assert.deepEqual(staffOf(closed).map(s => [s.id, s.hat, s.picked]), [['sess-mkt-0001', null, false], ['sess-mkt-0002', 'sprout', false], ['sess-dev-0003', null, false], ['sess-lob-0004', null, false]]);
  const open = officeRoom(snapOf({ settings }), { pick: 'd:dmkt:1', lookOpen: true }, NOW);
  assert.deepEqual(staffOf(open).filter(s => s.picked).map(s => s.id), ['sess-mkt-0002']);
});

test('when the first seat\'s session ends, the next session sits there and takes over its look (설계 3절)', () => {
  const settings = { looks: { 'd:dmkt:0': { hat: 'gat', name: '서진' } } };
  const before = officeRoom(snapOf({ settings }), {}, NOW);
  assert.equal(staffOf(before).find(s => s.id === 'sess-mkt-0001').hat, 'gat');
  const after = officeRoom(snapOf({ settings, state: stateOf(EVENTS.filter(e => e.sessionId !== 'sess-mkt-0001')) }), {}, NOW);
  assert.equal(staffOf(after).find(s => s.id === 'sess-mkt-0002').hat, 'gat');
  assert.equal(rowOf(after, 'd:dmkt').more.find(m => m[0] === 'staff')[2], '서진');
});

test('picking a skin changes the floor at once with a new skinSeq, saves it, and goes back if the save fails or another save runs', async () => {
  const h = harness();
  await h.room.handle({ key: 'look', act: 'skin', arg: 'walnut' });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { skin: 'walnut' }]);
  assert.equal(h.scene().floor.skin, 'walnut');
  assert.equal(h.scene().floor.skinSeq, 1, 'the floor cross-fades only for a pick the user made');
  assert.equal(live(rowOf(h.scene(), 'look')), '호두나무 서재 스킨을 입혔습니다.');
  h.setSnap(snapOf({ settings: { skin: 'walnut', looks: {} } }));
  assert.equal(h.scene().floor.skin, 'walnut', 'the board caught up');
  h.res.saveSettings = { ok: false, code: 'NOT_ALLOWED' };
  await h.room.handle({ key: 'look', act: 'skin', arg: 'black' });
  assert.equal(h.scene().floor.skin, 'walnut', 'a refused save goes back');
  assert.equal(live(rowOf(h.scene(), 'look')), '이 계정에서는 사무실을 고칠 수 없습니다.');
  const n = h.calls.length;
  await h.room.handle({ key: 'look', act: 'skin', arg: 'walnut' });
  assert.equal(h.calls.length, n, 'the skin it already wears is not saved again');
  await h.room.handle({ key: 'look', act: 'skin', arg: 'hanok' });
  assert.equal(h.calls.length, n, 'an unknown skin is ignored');
});

test('a hat goes to the seat in the button, is drawn at once, and stays only until the board has it', async () => {
  const h = harness();
  await h.room.handle({ key: 'look', act: 'look-hat', arg: 'd:ddev:0|beanie' });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { look: { seat: 'd:ddev:0', hat: 'beanie' } }]);
  assert.equal(staffOf(h.scene()).find(s => s.id === 'sess-dev-0003').hat, 'beanie');
  assert.equal(live(rowOf(h.scene(), 'look')), '개발부 1에게 니트 비니를 씌웠습니다.');
  assert.equal(picks(rowOf(h.scene(), 'look')).find(x => x[1] === '모자')[3], 'd:ddev:0|beanie', 'the hat buttons follow the seat just dressed');
  // 판이 다른 값으로 오면(다른 곳에서 바꿈) 그 값을 따른다: 누른 값은 판과 같아질 때 한 번 지워졌다
  h.setSnap(snapOf({ settings: { looks: { 'd:ddev:0': { hat: 'beanie' } } } }));
  h.scene();
  h.setSnap(snapOf({ settings: { looks: {} } }));
  assert.equal(staffOf(h.scene()).find(s => s.id === 'sess-dev-0003').hat, null, 'after it settled, the board wins (설계 검토 9)');
  await h.room.handle({ key: 'look', act: 'look-hat', arg: 'd:ddev:0|none' });
  assert.equal(h.calls.filter(c => c[0] === 'saveSettings').length, 1, 'taking off a hat it does not wear saves nothing');
  h.res.saveSettings = { ok: false, code: 'WRITE' };
  await h.room.handle({ key: 'look', act: 'look-hat', arg: 'lobby:0|gat' });
  assert.equal(staffOf(h.scene()).find(s => s.id === 'sess-lob-0004').hat, null, 'a failed save goes back');
  await h.room.handle({ key: 'look', act: 'look-hat', arg: 'd:dmkt:7|gat' });
  assert.equal(live(rowOf(h.scene(), 'look')), '그 부서나 세션을 찾지 못했습니다. 화면을 다시 읽었습니다.', 'a seat nobody sits in');
});

test('a busy room refuses the hat and draws the look it had', async () => {
  const h = harness();
  let release;
  h.res.saveDepartment = () => new Promise(r => { release = () => r({ ok: true }); });
  const first = h.room.handle({ key: 'add', act: 'dept-add', fields: { name: '법무부' } });
  await new Promise(r => setTimeout(r, 0));
  await h.room.handle({ key: 'look', act: 'look-hat', arg: 'd:dmkt:0|gat' });
  assert.equal(staffOf(h.scene()).find(s => s.id === 'sess-mkt-0001').hat, null);
  assert.match(live(rowOf(h.scene(), 'look')), /다른 일을 마치는 중/);
  release(); await first;
});

test('renaming: checked here, saved, then a fresh field; clearing or typing the first name goes back to it; picking another staff changes the field name', async () => {
  const h = harness();
  const field = () => rowOf(h.scene(), 'look').more.find(m => m[0] === 'fld');
  const typed = text => ({ [field()[4]]: text });
  assert.equal(field()[4], 'lname-0-d:dmkt:0');
  await h.room.handle({ key: 'look', act: 'look-rename', arg: 'd:dmkt:0', fields: typed('열세글자이름입니다아아아아') });
  assert.equal(live(rowOf(h.scene(), 'look')), '이름은 12자까지 적어 주세요.');
  await h.room.handle({ key: 'look', act: 'look-rename', arg: 'd:dmkt:0', fields: typed('서​진') });
  assert.equal(live(rowOf(h.scene(), 'look')), '이름에 쓸 수 없는 글자가 있습니다.');
  assert.equal(h.calls.length, 0);
  await h.room.handle({ key: 'look', act: 'look-rename', arg: 'd:dmkt:0', fields: typed('  서진 ') });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { look: { seat: 'd:dmkt:0', name: '서진' } }]);
  assert.equal(live(rowOf(h.scene(), 'look')), '이름을 「서진」으로 바꿨습니다.');
  assert.equal(field()[4], 'lname-1-d:dmkt:0', 'a saved name gets a fresh field');
  assert.equal(field()[2], '서진');
  assert.equal(rowOf(h.scene(), 'd:dmkt').more.find(m => m[0] === 'staff')[2], '서진', 'the staff line uses it at once');
  h.setSnap(snapOf({ settings: { looks: { 'd:dmkt:0': { name: '서진' } } } }));
  await h.room.handle({ key: 'look', act: 'look-rename', arg: 'd:dmkt:0', fields: typed('서진') });
  assert.equal(live(rowOf(h.scene(), 'look')), '이름이 그대로입니다.');
  await h.room.handle({ key: 'look', act: 'look-rename', arg: 'd:dmkt:0', fields: typed('마케팅부 1') });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { look: { seat: 'd:dmkt:0', name: '' } }], 'typing the first name is the same as clearing');
  assert.equal(live(rowOf(h.scene(), 'look')), '처음 이름 「마케팅부 1」로 되돌렸습니다.');
  await h.room.handle({ key: 'look', act: 'look-pick', arg: 'lobby:0' });
  assert.equal(field()[4], 'lname-3-lobby:0', 'another staff gets its own field, so typed text does not carry over (설계 검토 4)');
  assert.equal(field()[3], '비우면 「부서 없는 일 1」 · 12자까지');
});

test('검수 A1: a first name longer than twelve characters can still be typed back to clear the name', async () => {
  const long = [{ id: 'dmkt', name: '온라인마케팅콘텐츠부', folder: MKT }, DEPTS[1]];
  const h = harness(snapOf({ departments: long, settings: { looks: { 'd:dmkt:0': { name: '서진' } } } }));
  const fld = rowOf(h.scene(), 'look').more.find(m => m[0] === 'fld');
  assert.equal(fld[3], '비우면 「온라인마케팅콘텐츠부 1」 · 12자까지');
  await h.room.handle({ key: 'look', act: 'look-rename', arg: 'd:dmkt:0', fields: { [fld[4]]: '온라인마케팅콘텐츠부 1' } });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { look: { seat: 'd:dmkt:0', name: '' } }]);
});

test('검수 A2: when the picked seat goes away and the pick moves on by itself, the name field gets a new name too', () => {
  let snap = snapOf();
  const room = createOfficeRoom({ api: {}, snapshot: () => snap, reread() {}, changed() {} });
  const fieldOf = () => room.scene(snap, NOW, null).rows.find(r => r.key === 'look').more.find(m => m[0] === 'fld')[4];
  const before = fieldOf();
  snap = snapOf({ state: stateOf(EVENTS.filter(e => e.sessionId !== 'sess-mkt-0001' && e.sessionId !== 'sess-mkt-0002')) });
  assert.notEqual(fieldOf(), before, 'the first staff of 마케팅부 is gone, so 개발부 1 is picked with its own field');
  assert.equal(fieldOf(), 'lname-0-d:ddev:0');
});

test('최종 검수 F1: once the picked seat empties and the pick moves on, a new session in that seat does not take the pick back', () => {
  let snap = snapOf();
  const room = createOfficeRoom({ api: {}, snapshot: () => snap, reread() {}, changed() {} });
  const field = () => room.scene(snap, NOW, null).rows.find(r => r.key === 'look').more.find(m => m[0] === 'fld')[3];
  field(); // 그린 때로 자리를 센다
  return room.handle({ key: 'look', act: 'look-pick', arg: 'd:dmkt:1' }).then(() => {
    assert.equal(field(), '비우면 「마케팅부 2」 · 12자까지');
    snap = snapOf({ state: stateOf(EVENTS.filter(e => e.sessionId !== 'sess-mkt-0002')) });
    assert.equal(field(), '비우면 「마케팅부 1」 · 12자까지');
    snap = snapOf({ state: stateOf([...EVENTS.filter(e => e.sessionId !== 'sess-mkt-0002'), work('sess-mkt-0009', MKT, 5)]) });
    assert.equal(field(), '비우면 「마케팅부 1」 · 12자까지', 'the pick stays where it moved to');
  });
});

test('the picked staff is lit only while the row is open; leaving the room or a reset forgets it', async () => {
  const h = harness();
  await h.room.handle({ key: 'look', act: 'look-pick', arg: 'd:ddev:0' });
  assert.deepEqual(staffOf(h.scene()).filter(s => s.picked), []);
  await h.room.handle({ key: 'look', act: 'row-open' });
  assert.deepEqual(staffOf(h.scene()).filter(s => s.picked).map(s => s.id), ['sess-dev-0003']);
  await h.room.handle({ key: 'look', act: 'row-fold' });
  assert.deepEqual(staffOf(h.scene()).filter(s => s.picked), []);
  await h.room.handle({ key: 'look', act: 'row-open' });
  h.room.close();
  assert.deepEqual(staffOf(h.scene()).filter(s => s.picked), []);
  await h.room.handle({ key: 'look', act: 'skin', arg: 'walnut' });
  h.room.reset();
  assert.equal(h.scene().floor.skin, 'black', 'a reset drops what was pressed');
  // 고른 직원의 부서가 빠지면 첫 직원으로 옮긴다
  await h.room.handle({ key: 'look', act: 'look-pick', arg: 'd:ddev:0' });
  h.setSnap(snapOf({ departments: [DEPTS[0]] }));
  assert.equal(rowOf(h.scene(), 'look').more.find(m => m[0] === 'fld')[3], '비우면 「마케팅부 1」 · 12자까지');
  assert.equal(officeLookField({ lookSeq: 4 }), 'lname-4');
  assert.equal(officeLookField({ lookSeq: 4 }, 'lobby:0'), 'lname-4-lobby:0');
});
