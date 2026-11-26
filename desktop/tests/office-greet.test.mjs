// 솔리오 「사무실」: 눌린 직원의 한마디(office-greet.mjs)와 다가가기 · 일어서기(office-floor.mjs), 「사무실」에서 누른 직원의 부서로 가기(office-room.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { officeGreet, officeGreets } from '../renderer/office-greet.mjs';
import { createOfficeFloor, FLOOR_MOTION } from '../renderer/office-floor.mjs';
import { officeState, officeReduce, officeSessions } from '../renderer/office-model.mjs';
import { createOfficeRoom } from '../renderer/office-room.mjs';

const NOW = Date.UTC(2026, 10, 26, 3, 0, 0), MIN = 60e3;
const worker = (patch = {}) => ({ id: 's1', tool: 'claude', status: 'quiet', say: '8분째 조용합니다', activity: 'shop', folder: 'shop', cwd: 'C:\\work\\shop', subagents: 0, departmentId: 'ddev', lookName: '', ...patch });
const task = (patch = {}) => ({ id: 't1', provider: 'claude', departmentId: 'ddev', status: 'completed', prompt: '합계를 고쳐 주세요', answer: '고쳤습니다.', createdAt: NOW - 30 * MIN, updatedAt: NOW - 20 * MIN, ...patch });

test('a worker says the last tool and the file in plain words, and never promises to call back', () => {
  const line = activity => officeGreet(worker({ status: 'working', say: '일하는 중', activity }), { tasking: true, now: NOW }).lines;
  assert.equal(line('shop · 쓰기 · 블로그_11월.md')[0], '‘블로그 11월’ 문서를 쓰고 있었습니다.');
  assert.equal(line('shop · 읽기 · 회의록.txt')[0], '‘회의록’ 문서를 읽고 있었습니다.');
  assert.equal(line('shop · 쓰기 · src/order-total.js')[0], '‘order total’ 코드를 고치고 있었습니다.');
  assert.equal(line('shop · 쓰기 · 메뉴판.png')[0], '‘메뉴판’ 그림을 만들고 있었습니다.');
  assert.equal(line('shop · 쓰기 · 견적.xlsx')[0], '‘견적’ 표를 쓰고 있었습니다.');
  assert.equal(line('shop · 쓰기 · Makefile')[0], '‘Makefile’ 파일을 쓰고 있었습니다.');
  assert.equal(line('shop · 명령 · npm')[0], '명령을 돌려 확인하고 있었습니다.', 'the command name means nothing to a member');
  assert.equal(line('shop · 웹 찾기')[0], '웹에서 찾아보고 있었습니다.');
  assert.equal(line('shop')[0], '맡은 일을 하고 있었습니다.', 'a folder alone is not something it does');
  assert.equal(line('shop · 처음 보는 도구 · x')[0], '맡은 일을 하고 있었습니다.', 'an unknown tool is not guessed');
  for (const l of line('shop · 쓰기 · 블로그.md')) assert.doesNotMatch(l, /알려 드리|알리겠|말씀드리겠/);
});

test('the work title Claude Code keeps comes first, then what it is doing now; a quiet worker names its last work first, since the header already says how long it has been quiet', () => {
  const working = officeGreet(worker({ status: 'working', say: '일하는 중', activity: 'shop · 쓰기 · 블로그_11월.md', title: '11월 블로그 글 쓰기' }), { tasking: true, now: NOW }).lines;
  assert.deepEqual(working.slice(0, 2), ['「11월 블로그 글 쓰기」 일을 하고 있었습니다.', '지금은 ‘블로그 11월’ 문서를 쓰고 있습니다.']);
  const asked = officeGreet(worker({ status: 'working', say: '일하는 중', title: '11월 블로그 글 쓰기' }), { tasking: true, now: NOW, tasks: [task({ status: 'running', prompt: '11월 블로그 글 하나를 써 주세요.' })] }).lines;
  assert.equal(asked[0], '맡기신 「11월 블로그 글 하나를 써 주…」 일을 하고 있었습니다.', 'the member words come before the title');
  const quiet = officeGreet(worker({ title: '회의록 한 장으로 줄이기' }), { tasking: true, now: NOW }).lines;
  assert.deepEqual(quiet, ['마지막으로 「회의록 한 장으로 줄이기」 일을 했습니다. 일을 주세요.', '8분째 조용히 있었습니다. 일을 주세요.']);
  assert.deepEqual(officeGreet(worker({ title: '회의록 한 장으로 줄이기' }), { tasking: false, now: NOW }).lines, ['마지막으로 「회의록 한 장으로 줄이기」 일을 했습니다.', '8분째 조용히 있었습니다.', 'Claude Code 창에서 말씀해 주세요.']);
  for (const l of quiet) assert.doesNotMatch(l, /끝냈|마쳤/, 'a title does not say the work is done');
});

test('two workers of the same tool in one department do not both claim the department task; each says its own title (Fable 최종 F1)', () => {
  const list = [worker({ id: 'a', status: 'working', say: '일하는 중', title: '내 블로그 직접 고치기' }), worker({ id: 'b', status: 'working', say: '일하는 중' }), worker({ id: 'c', title: '가게 소개 보고서 다듬기' }), worker({ id: 'x', tool: 'codex', departmentId: 'dplan', status: 'working', say: '일하는 중' })];
  const g = officeGreets(list, { tasks: [task({ status: 'running', prompt: '11월 블로그 글 하나를 써 주세요.' }), task({ id: 't2' }), task({ id: 't3', provider: 'codex', departmentId: 'dplan', status: 'running', prompt: '회의록을 줄여 주세요.' })], now: NOW });
  assert.equal(g.by.a.lines[0], '「내 블로그 직접 고치기」 일을 하고 있었습니다.');
  assert.equal(g.by.b.lines[0], '맡은 일을 하고 있었습니다.');
  assert.equal(g.by.c.lines[0], '마지막으로 「가게 소개 보고서 다듬기」 일을 했습니다. 일을 주세요.');
  assert.equal(g.by.x.lines[0], '맡기신 「회의록을 줄여 주세요.」 일을 하고 있었습니다.', 'the only Codex worker of a department still carries its task');
});

test('a long file name is cut, a running task is named when nothing else is known, a helper count is another line', () => {
  const long = officeGreet(worker({ status: 'working', say: '일하는 중', activity: 'shop · 쓰기 · ' + '가'.repeat(60) + '.md' }), { now: NOW }).lines[0];
  assert.ok([...long].length < 40, long);
  assert.equal(officeGreet(worker({ status: 'working', say: '일하는 중' }), { tasking: true, now: NOW, tasks: [task({ status: 'running' })] }).lines[0], '맡기신 「합계를 고쳐 주세요」 일을 하고 있었습니다.');
  assert.ok(officeGreet(worker({ status: 'working', say: '일하는 중', subagents: 2 }), { now: NOW }).lines.includes('도우미 둘 데리고 일하고 있었습니다.'));
});

test('a quiet or resting worker asks for work only where the app can give work', () => {
  assert.deepEqual(officeGreet(worker(), { tasking: true, now: NOW }).lines, ['8분째 조용히 있었습니다. 일을 주세요.']);
  assert.deepEqual(officeGreet(worker(), { tasking: false, now: NOW }).lines, ['8분째 조용히 있었습니다.', 'Claude Code 창에서 말씀해 주세요.']);
  assert.deepEqual(officeGreet(worker({ status: 'resting', say: '쉬는 중' }), { tasking: true, now: NOW }).lines, ['쉬고 있었습니다. 일을 주세요.']);
});

test('a question, a finished task and a task waiting for the member come before asking for work', () => {
  assert.equal(officeGreet(worker({ status: 'asked', say: '3분 전에 승인을 물었습니다' }), { tasking: true, now: NOW }).lines[0], '여쭌 것이 있어서 답을 기다리고 있었습니다.');
  assert.equal(officeGreet(worker({ status: 'done', say: '끝냄' }), { tasking: true, now: NOW }).lines[0], '하던 일을 끝냈습니다. 확인해 주세요.');
  const ended = officeGreet(worker(), { tasking: true, now: NOW, tasks: [task()] }).lines;
  assert.equal(ended[0], '「합계를 고쳐 주세요」 일은 끝내 두었습니다. 다음 일을 주세요.');
  const old = officeGreet(worker(), { tasking: true, now: NOW, tasks: [task({ updatedAt: NOW - 48 * 3600e3 })] }).lines;
  assert.deepEqual(old, ['8분째 조용히 있었습니다. 일을 주세요.'], 'a task from days ago is not brought up');
});

test('the changed name is the speaker, the tasks of another department or tool are not its own, and a desk has one leading speaker', () => {
  const list = [worker({ id: 'a', status: 'quiet' }), worker({ id: 'b', status: 'working', say: '일하는 중', lookName: '콩이' }), worker({ id: 'c', status: 'asked', departmentId: null })];
  const g = officeGreets(list, { tasks: [task({ departmentId: 'other' }), task({ provider: 'codex' })], now: NOW });
  assert.equal(g.by.b.name, '콩이');
  assert.deepEqual(g.by.a.lines, ['8분째 조용히 있었습니다. 일을 주세요.']);
  assert.deepEqual(g.lead, { 'd:ddev': 'b', lobby: 'c' });
  assert.deepEqual(officeGreets(null), { by: {}, lead: {} });
});

function setup({ still = false, width = 900, height = 260 } = {}) {
  let t = 1000, frames = [], told = [];
  const ctx = new Proxy({}, { get(o, n) { if (n in o) return o[n]; if (n === 'createRadialGradient' || n === 'createLinearGradient') return () => ({ addColorStop() {} }); if (n === 'measureText') return s => ({ width: String(s).length * 7 }); return () => {}; }, set(o, n, v) { o[n] = v; return true; } });
  const win = { performance: { now: () => t }, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() { frames = []; }, devicePixelRatio: 1 };
  const listeners = {}, pressed = [];
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener(k, fn) { listeners[k] = fn; }, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }), parentElement: { getBoundingClientRect: () => ({ width, height }) } };
  const floor = createOfficeFloor(canvas, { win, reduced: () => still, onTalk: p => told.push(p), onPress: (z, s) => pressed.push([z, s]) });
  const run = ms => { for (let d = 0; d < ms; d += 17) { t += 17; const now = frames; frames = []; for (const fn of now) fn(t); } };
  return { floor, run, told, pressed, click: (x, y) => listeners.click({ clientX: x, clientY: y }) };
}
const staff = (id, zone, status = 'quiet') => ({ id, status, alert: false, subagents: 0, provider: 'claude', zone, hat: null, picked: false });
const zone = (key, ids) => ({ key: 'd:' + key, kind: 'dept', name: key, urgent: false, desk: {}, held: 0, staff: ids.map(i => staff(i, 'd:' + key)) });
const scene = () => ({ view: 'tilted', viewSeq: 0, skin: 'black', skinSeq: 0, deskSeq: 0, seats: 3, zones: [zone('mkt', ['m1', 'm2']), zone('dev', ['d1']), zone('plan', ['p1'])] });

test('the floor leans in once, at most 1.35 times, and comes back; a hidden room starts from the whole floor', () => {
  const h = setup();
  h.floor.setScene(scene()); h.floor.show(true); h.run(100);
  assert.equal(h.floor.leaning().z, 1);
  h.floor.lean('d:plan'); h.run(FLOOR_MOTION.leanMs / 2);
  const mid = h.floor.leaning().z;
  assert.ok(mid > 1 && mid < FLOOR_MOTION.leanMax, String(mid));
  h.run(FLOOR_MOTION.leanMs);
  const end = h.floor.leaning().z;
  assert.ok(end >= FLOOR_MOTION.leanMin && end <= FLOOR_MOTION.leanMax, String(end));
  h.run(2000);
  assert.ok(Math.abs(h.floor.leaning().z - end) < 1e-9, 'it does not keep moving');
  h.floor.lean(null); h.run(FLOOR_MOTION.leanMs + 60);
  assert.equal(h.floor.leaning().z, 1);
  h.floor.lean('d:mkt'); h.run(900);
  h.floor.show(false); h.floor.show(true);
  assert.deepEqual(h.floor.leaning(), { to: null, z: 1 });
  h.floor.lean('d:gone');
  assert.equal(h.floor.leaning().to, null, 'a zone that is not drawn is the whole floor');
});

test('a worker that speaks tells where its head is, stands up inside the picture and sits down; pressing it again after the lean still hits it', () => {
  const h = setup();
  h.floor.setScene(scene()); h.floor.show(true); h.run(100);
  h.floor.talk('p1'); h.floor.lean('d:plan'); h.run(20);
  const first = h.told.at(-1);
  assert.equal(first.id, 'p1');
  h.run(1000);
  const last = h.told.at(-1);
  assert.ok(h.floor.standing('p1') > 0.99, 'it stood up');
  assert.ok(last.y > 0 && last.y < 260 && last.x > 0 && last.x < 900, JSON.stringify(last));
  assert.ok(Math.abs(last.y - last.endY) < 1, 'the settled height is the told end height');
  assert.ok(Math.abs(first.endY - last.endY) < 14, 'the end height is known from the start, so the bubble does not flip');
  h.click(last.x, last.y + 2);
  assert.deepEqual(h.pressed.at(-1), ['d:plan', 'p1']);
  h.floor.talk(null); const n = h.told.length; h.run(FLOOR_MOTION.talkMs + 60);
  assert.equal(h.floor.talking(), null);
  assert.equal(h.told.length, n, 'nothing is told after it stops');
  h.floor.talk('gone'); h.run(40);
  assert.equal(h.told.at(-1), null, 'a worker that is not drawn has no place');
});

test('with reduced motion nothing leans and nobody slides, but the speaker is still told', () => {
  const h = setup({ still: true });
  h.floor.setScene(scene()); h.floor.show(true);
  h.floor.lean('d:plan');
  assert.equal(h.floor.leaning().z, 1);
  h.floor.talk('m1');
  const sat = h.told.at(-1);
  assert.equal(sat.id, 'm1');
  assert.equal(h.floor.standing('m1'), 0, 'nobody stands up (카본 A3)');
  const n = h.told.length;
  h.floor.talk('m1');
  assert.equal(h.told.length, n + 1, 'pressing the same worker again places the bubble again for the new words (카본 A1)');
});

test('the record title is kept on the session, survives a scan that finds none, and reaches the worker as plain text', () => {
  const r = (at, extra = {}) => ({ kind: 'record', sessionId: 'sess-a-0001', cwd: 'C:\work\shop', tool: 'claude', changedAt: at, ...extra });
  let s = [r(NOW - 20e3, { title: '블로그 글 쓰기' }), r(NOW - 10e3, { title: null })].reduce((st, e) => officeReduce(st, e), officeState());
  const v = officeSessions(s, NOW, { departments: [{ id: 'ddev', name: '개발부', folder: 'C:\work\shop' }] })[0];
  assert.equal(v.title, '블로그 글 쓰기');
  s = officeReduce(s, r(NOW - 5e3, { title: 'x'.repeat(200) }));
  assert.equal(officeSessions(s, NOW, {})[0].title.length, 60);
});

test('pressing a worker from 사무실 moves the chat to its department even though the work panel re-renders on the way', async () => {
  const record = (sessionId, cwd, changedAt) => ({ kind: 'record', sessionId, cwd, tool: 'claude', changedAt });
  const state = [record('sess-dev-0002', 'C:\\work\\shop', NOW - 20e3)].reduce((s, e) => officeReduce(s, e), officeState());
  const snap = { ok: true, available: true, state, departments: [{ id: 'dmkt', name: '마케팅부', folder: 'C:\\work\\mkt' }, { id: 'ddev', name: '개발부', folder: 'C:\\work\\shop' }], assignments: {}, settings: { view: 'tilted', manualCap: null }, roots: { claude: [], codex: [], added: [] }, pc: { cores: 16, totalMemGb: 32, freeMemGb: 19, cpuPercent: 30 }, readAt: NOW, tasking: { tasks: [task(), task({ id: 't2', departmentId: 'dmkt' })], code: null, mail: { providers: [] } } };
  // 제품의 changed는 그 자리에서 장면을 다시 짓는다(orb-face.mjs)
  let room = null;
  room = createOfficeRoom({ api: {}, snapshot: () => snap, changed: () => { room?.scene(snap, NOW, null); } });
  const sel = () => { const s = room.scene(snap, NOW, null); return [s.chat.sel, s.tasking.form.departmentId]; };
  await room.handle({ act: 'chat-pick', arg: 'all' });
  assert.deepEqual(sel(), ['all', null]);
  await room.handle({ act: 'task-open', key: 'd:ddev', arg: 'claude' });
  assert.deepEqual(sel(), ['d:ddev', 'ddev']);
  await room.handle({ act: 'chat-pick', arg: 'all' });
  await room.handle({ act: 'task-follow', arg: 't2' });
  assert.deepEqual(sel(), ['d:dmkt', 'dmkt']);
  const g = room.scene(snap, NOW, null).greets;
  assert.deepEqual(g.lead, { 'd:ddev': 'sess-dev-0002' });
  assert.ok(g.by['sess-dev-0002'].lines.length > 0);
});
