// 솔리오 「사무실」 대화 짜임(docs/디자인/솔리오_사무실대화_20261124/PC앱_옮기기.md)의 자료와 고르기 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { officeState, officeReduce } from '../renderer/office-model.mjs';
import { createOfficeRoom } from '../renderer/office-room.mjs';
import { officeChatContacts, officeChatFirst, officeChatPanes, officeTaskTurn, officeTaskChatKey, OFFICE_CHAT_OFF_SAY } from '../renderer/office-chat-model.mjs';

const NOW = Date.UTC(2026, 10, 25, 3, 0, 0);
const S = 1e3, MIN = 60e3;
const hook = (event, sessionId, cwd, at, extra = {}) => ({ kind: 'hook', event, sessionId, cwd, at, ...extra });
const record = (sessionId, cwd, tool, changedAt) => ({ kind: 'record', sessionId, cwd, tool, changedAt });
const stateOf = events => events.reduce((s, e) => officeReduce(s, e), officeState());
const MKT = 'C:\\work\\마케팅', SHOP = 'C:\\work\\shop';
const DEPTS = [{ id: 'dmkt', name: '마케팅부', folder: MKT }, { id: 'ddev', name: '개발부', folder: SHOP }];
const EVENTS = [
  record('sess-mkt-0001', MKT, 'claude', NOW - 20 * S),
  record('sess-dev-0002', SHOP, 'claude', NOW - 3 * MIN),
  record('sess-lob-0004', 'C:\\work\\회의록', 'claude', NOW - 40 * S),
];
const PC = { cores: 16, totalMemGb: 32, freeMemGb: 19, cpuPercent: 30 };
const task = (id, patch = {}) => ({ id, provider: 'claude', status: 'completed', departmentId: 'dmkt', departmentName: '마케팅부', prompt: id + ' 해 줘', answer: id + ' 했습니다.', createdAt: NOW - 30 * MIN, updatedAt: NOW - 20 * MIN, ...patch });
const snapOf = (patch = {}) => ({
  ok: true, available: true, state: stateOf(EVENTS), departments: DEPTS, assignments: {}, settings: { view: 'tilted', manualCap: null },
  roots: { claude: [], codex: [], added: [] }, pc: PC, readAt: NOW - 30 * S, ...patch,
});
const TASKS = [
  task('t1'),
  task('t2', { departmentId: 'ddev', departmentName: '개발부', createdAt: NOW - 10 * MIN, updatedAt: NOW - 5 * MIN }),
  task('t3', { departmentId: null, departmentName: '' }),
];
function harness(snapPatch = { tasking: { tasks: TASKS } }) {
  const calls = [];
  const api = {};
  for (const name of ['watch', 'saveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'addRoot', 'removeRoot', 'seen']) api[name] = (...args) => { calls.push([name, ...args]); return Promise.resolve({ ok: true }); };
  let snap = snapOf(snapPatch), now = NOW;
  const room = createOfficeRoom({ api, snapshot: () => snap, reread: () => {}, changed: () => {} });
  return { room, calls, setSnap: s => { snap = s; }, setNow: t => { now = t; }, scene: () => room.scene(snap, now, null) };
}
const settle = () => new Promise(r => setTimeout(r, 0));

test('contacts: 사무실 first, then each department, then 부서 없는 일 while it has sessions', () => {
  const h = harness();
  const c = h.scene().chat;
  assert.deepEqual(c.contacts.map(x => x.key), ['all', 'd:dmkt', 'd:ddev', 'lobby']);
  assert.equal(c.contacts[0].nm, '사무실');
  assert.equal(c.sel, 'all', 'nothing waits on me, so the first pick is 사무실');
});

test('the department owner is one: picking a chat sets the department the composer sends to', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'd:dmkt' });
  assert.equal(h.scene().chat.sel, 'd:dmkt');
  assert.equal(h.scene().tasking.form.departmentId, 'dmkt');
  assert.equal(h.scene().chat.composer.deptPick, false, 'the department field hides while a department is picked');
  await h.room.handle({ act: 'chat-pick', arg: 'all' });
  assert.equal(h.scene().tasking.form.departmentId, null);
  assert.equal(h.scene().chat.composer.deptPick, true);
  await h.room.handle({ act: 'chat-pick', arg: 'd:nope' });
  assert.equal(h.scene().chat.sel, 'all', 'an unknown chat is ignored');
});

test('「이어서 맡기기」 moves the chat to that task\'s department and survives re-renders; picking another chat drops it', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'd:dmkt' });
  h.scene();
  await h.room.handle({ act: 'task-follow', arg: 't2' });
  let s = h.scene();
  assert.equal(s.chat.sel, 'd:ddev');
  assert.equal(s.tasking.form.departmentId, 'ddev');
  assert.equal(s.tasking.form.previousId, 't2');
  s = h.scene();
  assert.equal(s.tasking.form.previousId, 't2', 'a re-render keeps the follow');
  await h.room.handle({ act: 'chat-pick', arg: 'd:ddev' });
  assert.equal(h.scene().tasking.form.previousId, 't2', 'picking the same chat again keeps the follow');
  await h.room.handle({ act: 'chat-pick', arg: 'd:dmkt' });
  assert.equal(h.scene().tasking.form.previousId, null, 'another chat drops the follow, so the next message goes to the department on screen');
  assert.equal(h.scene().tasking.form.departmentId, 'dmkt');
});

test('a staff member pressed in 부서 없는 일 opens the composer in 사무실 (no department), not a chat without a composer', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'lobby' });
  assert.equal(h.scene().chat.composer.on, false);
  await h.room.handle({ act: 'task-open', key: 'lobby', arg: 'claude' });
  const s = h.scene();
  assert.equal(s.chat.sel, 'all');
  assert.equal(s.tasking.form.departmentId, null);
  assert.equal(s.chat.composer.on, true);
});

test('leaving a department chat marks it seen; picking does not', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'd:ddev' });
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'seen'), [], 'picking alone is not seeing');
  await h.room.handle({ act: 'chat-pick', arg: 'd:dmkt' });
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'seen'), [['seen', 'ddev']]);
  h.room.close();
  await settle();
  assert.deepEqual(h.calls.filter(c => c[0] === 'seen').at(-1), ['seen', 'dmkt'], 'leaving the room is leaving the chat');
  assert.equal(h.scene().chat.sel, 'd:dmkt', 'closing the room keeps the picked chat');
});

test('「한 번에 처리」 lands on the task\'s department chat and asks for that message; a task of a removed department lands on 사무실', async () => {
  const h = harness({ tasking: { tasks: [...TASKS, task('t9', { departmentId: 'dgone', departmentName: '없는부' })] } });
  h.scene();
  await h.room.handle({ act: 'chat-task', arg: 't2' });
  let s = h.scene();
  assert.equal(s.chat.sel, 'd:ddev');
  assert.equal(s.focus.task, 't2');
  await h.room.handle({ act: 'chat-task', arg: 't9' });
  s = h.scene();
  assert.equal(s.chat.sel, 'all');
  assert.equal(officeTaskChatKey({ departmentId: 'dgone' }, DEPTS), 'all');
});

test('following a task of a removed department is refused with a line, not sent to a missing department', async () => {
  const h = harness({ tasking: { tasks: [task('t9', { departmentId: 'dgone', departmentName: '없는부' })] } });
  h.scene();
  await h.room.handle({ act: 'task-follow', arg: 't9' });
  const s = h.scene();
  assert.equal(s.tasking.form.previousId, null);
  assert.equal(s.tasking.error, '이 일의 부서를 뺐습니다. 새 일로 맡겨 주세요.');
});

test('removing the picked department goes to 사무실; an emptied 부서 없는 일 goes to the department the session went to', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'lobby' });
  await h.room.handle({ key: 'lobby', act: 'assign', arg: 'sess-lob-0004|ddev' });
  assert.equal(h.scene().chat.sel, 'lobby', 'after sending, the chat stays where the user was');
  h.setSnap(snapOf({ tasking: { tasks: TASKS }, assignments: { 'sess-lob-0004': 'ddev' } }));
  assert.equal(h.scene().chat.sel, 'd:ddev', 'once 부서 없는 일 is empty, the chat goes to the department it went to');
  await h.room.handle({ act: 'dept-remove-ask', key: 'd:ddev', arg: 'ddev' });
  await h.room.handle({ act: 'dept-remove', key: 'd:ddev', arg: 'ddev' });
  assert.equal(h.scene().chat.sel, 'all');
});

test('a new department is picked once it arrives on the board', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-add' });
  assert.equal(h.scene().chat.addOpen, true);
  await h.room.handle({ key: 'add', act: 'dept-add', fields: { 'name': '법무부' } });
  assert.equal(h.scene().chat.addOpen, false);
  h.setSnap(snapOf({ tasking: { tasks: TASKS }, departments: [...DEPTS, { id: 'dlaw', name: '법무부', folder: 'C:\\work\\법무' }] }));
  assert.equal(h.scene().chat.sel, 'd:dlaw');
});

test('flags come from tasks too: a task waiting on me flags its department and the first pick goes there', () => {
  const waiting = task('tw', { departmentId: 'ddev', departmentName: '개발부', status: 'terminal', reason: 'PERMISSION', canOpenTerminal: true });
  const h = harness({ tasking: { tasks: [...TASKS, waiting] } });
  const c = h.scene().chat;
  const dev = c.contacts.find(x => x.key === 'd:ddev');
  assert.equal(dev.flag, true);
  assert.equal(dev.word, '확인 기다림');
  assert.equal(c.sel, 'd:ddev');
  assert.equal(officeTaskTurn(waiting, NOW), 'wait');
  assert.equal(officeTaskTurn(task('tr', { status: 'running' }), NOW), 'ai');
  assert.equal(officeChatFirst(c.contacts), 'd:ddev');
});

test('새 결과: a task finished after the app opened flags a chat that is not on screen, until it is opened', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'd:ddev' });
  h.setNow(NOW + 5 * MIN);
  h.setSnap(snapOf({ tasking: { tasks: [...TASKS, task('t4', { createdAt: NOW + MIN, updatedAt: NOW + 4 * MIN })] } }));
  let mkt = h.scene().chat.contacts.find(x => x.key === 'd:dmkt');
  assert.equal(mkt.word, '새 결과');
  assert.equal(mkt.flag, true);
  await h.room.handle({ act: 'chat-pick', arg: 'd:dmkt' });
  mkt = h.scene().chat.contacts.find(x => x.key === 'd:dmkt');
  assert.equal(mkt.flag, false);
  const old = h.scene().chat.contacts.find(x => x.key === 'd:ddev');
  assert.notEqual(old.word, '새 결과', 'a task that finished before the app opened is not new');
});

test('the release build (no tasks): a department puts its staff in the middle and keeps the settings on the side', () => {
  const h = harness({});
  const room = h.scene();
  const panes = officeChatPanes(room, 'd:dmkt', { tasking: false, contacts: room.chat.contacts });
  assert.equal(panes.composer.on, false);
  assert.equal(panes.composer.off, OFFICE_CHAT_OFF_SAY.dept);
  assert.equal(panes.center[0].key, 'now:d:dmkt');
  assert.equal(panes.center[0].pin, true);
  assert.ok(panes.center[0].more.some(m => m[0] === 'staff'), 'the staff stand in the middle');
  assert.ok(!panes.side[0].more.some(m => m[0] === 'staff'), 'and not again on the side');
  assert.ok(panes.side[0].more.some(m => m[0] === 'item' && m[1] === '부서 설정'), 'the department settings stay reachable');
  const all = officeChatPanes(room, 'all', { tasking: false, contacts: room.chat.contacts });
  assert.deepEqual(all.side.map(r => r.key), ['cap', 'cfg', 'look']);
  assert.deepEqual(all.center.map(r => r.key), ['now:d:dmkt', 'now:d:ddev']);
  const lobby = officeChatPanes(room, 'lobby', { tasking: false, contacts: room.chat.contacts });
  assert.equal(lobby.center[0].key, 'lobby');
  assert.equal(lobby.center[0].pin, true);
  assert.deepEqual(lobby.side, []);
});

test('no departments: the room says so and the list still has 사무실', () => {
  const h = harness({ departments: [] });
  const c = h.scene().chat;
  assert.equal(c.empty, true);
  assert.equal(c.contacts[0].key, 'all');
});

test('24 departments all get a contact, even past the six the floor draws', () => {
  const many = Array.from({ length: 24 }, (_, i) => ({ id: 'd' + i, name: '부서' + i, folder: 'C:\\w\\' + i }));
  const h = harness({ departments: many, state: officeState() });
  const c = h.scene().chat;
  assert.equal(c.contacts.length, 25);
  assert.equal(officeChatContacts({ rows: [], departments: [], seated: [] }, {}).length, 1);
});

test('an answer already seen does not hide what staff are doing now; unseen, failed and running tasks still speak first (카본 A5)', () => {
  const room = {
    rows: [{ key: 'd:ddev', nm: '개발부', mid: '명령 · npm', val: '승인을 물었습니다', now: true }, { key: 'd:dmkt', nm: '마케팅부', mid: '쓰기 · 블로그.md', val: '하나 일하는 중' }],
    departments: [{ id: 'ddev', name: '개발부' }, { id: 'dmkt', name: '마케팅부' }],
    seated: [{ id: 's1', departmentId: 'ddev', status: 'asked', tool: 'claude', say: '3분 전에 승인을 물었습니다' }, { id: 's2', departmentId: 'dmkt', status: 'working', tool: 'codex', say: '일하는 중' }],
  };
  const old = [task('a1', { departmentId: 'ddev', updatedAt: NOW - 50 * MIN }), task('a2', { departmentId: 'dmkt', updatedAt: NOW - 50 * MIN })];
  const seen = new Map([['d:ddev', NOW - 10 * MIN], ['d:dmkt', NOW - 10 * MIN]]);
  const cs = officeChatContacts(room, { tasks: old, seen, now: NOW });
  const dev = cs.find(c => c.key === 'd:ddev'), mkt = cs.find(c => c.key === 'd:dmkt');
  assert.equal(dev.preview, '명령 · npm');
  assert.equal(dev.fromTask, false);
  assert.equal(mkt.preview, '쓰기 · 블로그.md');
  assert.equal(officeChatPanes(room, 'd:ddev', { tasking: true, contacts: cs }).head.say, 'Claude Code가 3분 전에 승인을 물었습니다.');
  // 아직 안 본 새 결과는 미리보기에 오른다. 승인을 묻는 부서는 그 물음이 먼저다
  const fresh = [task('b1', { departmentId: 'dmkt', answer: '블로그 글을 다 썼습니다.', updatedAt: NOW - 2 * MIN }), task('b2', { departmentId: 'ddev', updatedAt: NOW - 2 * MIN })];
  const cs2 = officeChatContacts(room, { tasks: fresh, seen, now: NOW });
  assert.equal(cs2.find(c => c.key === 'd:dmkt').preview, '블로그 글을 다 썼습니다.');
  assert.equal(cs2.find(c => c.key === 'd:dmkt').fromTask, true);
  assert.equal(cs2.find(c => c.key === 'd:ddev').preview, '명령 · npm');
  // 하는 중인 일은 승인 물음이 없는 부서에서 미리보기가 된다
  const run = [task('c1', { departmentId: 'dmkt', status: 'running', prompt: '보도자료 초안', answer: '' })];
  assert.match(officeChatContacts(room, { tasks: run, seen, now: NOW }).find(c => c.key === 'd:dmkt').preview, /보도자료 초안/);
});

test('the department field in 사무실 moves the chat to that department and keeps what was typed (Fable F1)', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'all' });
  assert.equal(h.scene().chat.composer.deptPick, true);
  await h.room.handle({ act: 'task-edit', fields: { prompt: '견적서 양식 찾아 줘' } });
  await h.room.handle({ act: 'task-department', arg: 'ddev' });
  const s = h.scene();
  assert.equal(s.chat.sel, 'd:ddev');
  assert.equal(s.tasking.form.departmentId, 'ddev');
  assert.equal(s.tasking.form.prompt, '견적서 양식 찾아 줘');
  assert.equal(s.chat.composer.deptPick, false);
  assert.equal(h.scene().tasking.form.departmentId, 'ddev', 'a re-render does not pull it back to 사무실');
});

test('leaving a department chat drops its pending removal question (Fable F6)', async () => {
  const h = harness();
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'd:ddev' });
  await h.room.handle({ key: 'd:ddev', act: 'grp', arg: 'set' });
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove-ask', arg: 'ddev' });
  const ask = () => h.scene().rows.find(r => r.key === 'd:ddev').more.find(m => m[0] === 'grp' && m[1] === 'set')[2].some(m => m[0] === 'confirm');
  assert.equal(ask(), true);
  await h.room.handle({ act: 'chat-pick', arg: 'd:dmkt' });
  await h.room.handle({ act: 'chat-pick', arg: 'd:ddev' });
  assert.equal(ask(), false);
});

test('a reply draft marked 「보냈어요」 in 한 번에 처리 no longer waits in the list (Fable F4)', () => {
  const room = { rows: [{ key: 'd:dmkt', nm: '마케팅부', mid: '쓰기', val: '쉬는 중' }], departments: [{ id: 'dmkt', name: '마케팅부' }], seated: [] };
  const draft = [task('q1', { quoteSource: { from: '지수 <a@example.test>', subject: '견적 문의', date: '2026-11-24T01:00:00Z' }, quoteOutcome: 'draft', answer: '안녕하세요. 견적은…' })];
  const before = officeChatContacts(room, { tasks: draft, now: NOW }).find(c => c.key === 'd:dmkt');
  assert.equal(before.word, '확인 기다림');
  assert.equal(before.urgent, true);
  const after = officeChatContacts(room, { tasks: draft, now: NOW, done: { 'quote:q1': NOW - MIN } }).find(c => c.key === 'd:dmkt');
  assert.notEqual(after.word, '확인 기다림');
  assert.equal(after.urgent, false);
  assert.equal(after.flag, false);
});

test('picking a department in 사무실 also carries the mail mode chosen there (Fable 다시 검수 FA2)', async () => {
  const mail = { providers: [{ id: 'gmail', configured: true, connected: true, address: 'a@example.test' }] };
  const h = harness({ tasking: { tasks: TASKS, mail } });
  h.scene();
  await h.room.handle({ act: 'chat-pick', arg: 'all' });
  await h.room.handle({ act: 'task-provider', arg: 'codex' });
  await h.room.handle({ act: 'task-mail-mode', fields: { enabled: true } });
  const before = h.scene().tasking.form.mailSearch;
  assert.equal(before, true, 'mail search is on in 사무실 before picking');
  await h.room.handle({ act: 'task-department', arg: 'ddev' });
  const s = h.scene();
  assert.equal(s.chat.sel, 'd:ddev');
  assert.equal(s.tasking.form.mailSearch, before);
});
