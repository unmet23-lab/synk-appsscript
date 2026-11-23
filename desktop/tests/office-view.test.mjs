// 솔리오 「사무실」 방의 줄 자료와 방의 동작 시험(desktop/renderer/office-room.mjs, 사무실 구현설계 5~7절 · 11절 · 14.1).
// 세션 상태는 실제 상태 규칙(office-model.mjs)에 훅 소식과 기록을 넣어 만든다. 화면(DOM)은 흐름 시험(orb-face-browser-qa.cjs 22번)이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { officeState, officeReduce, officeCapacity } from '../renderer/office-model.mjs';
import { officeRoom, officeSubscriptions, officeCapacityRow, officeGroupStatus, officeFloorScene, createOfficeRoom, OFFICE_REST_SAY, OFFICE_FLOOR_DEPTS, modelWord,
  officeSettingsRow, officeRo } from '../renderer/office-room.mjs';
import { floorLayout, floorZoneLabel, floorShortForm, FLOOR_MOTION } from '../renderer/office-floor.mjs';
import { createOrbRooms } from '../renderer/orb-rooms.mjs';

const NOW = Date.UTC(2026, 10, 20, 3, 0, 0);
const S = 1e3, MIN = 60e3, DAY = 864e5;
const hook = (event, sessionId, cwd, at, extra = {}) => ({ kind: 'hook', event, sessionId, cwd, at, ...extra });
const record = (sessionId, cwd, tool, changedAt) => ({ kind: 'record', sessionId, cwd, tool, changedAt });
const stateOf = events => events.reduce((s, e) => officeReduce(s, e), officeState());
const MKT = 'C:\\work\\마케팅', SHOP = 'C:\\work\\shop';
const DEPTS = [{ id: 'dmkt', name: '마케팅부', folder: MKT }, { id: 'ddev', name: '개발부', folder: SHOP }];
/* 일하는 직원(마케팅), 승인을 물은 직원(개발), 훅 소식이 없는 Codex(개발 아래), 도우미 둘과 일하는 부서 없는 일, 4분 걸려 끝낸 직원(마케팅 아래) */
const EVENTS = [
  hook('PostToolUse', 'sess-mkt-0001', MKT, NOW - 20 * S, { toolName: 'Write', toolDetail: '블로그.md' }),
  hook('Notification', 'sess-dev-0002', SHOP, NOW - 3 * MIN, { notificationType: 'permission_prompt' }),
  record('sess-cdx-0003', SHOP + '\\api', 'codex', NOW - 30 * S),
  hook('PostToolUse', 'sess-lob-0004', 'C:\\work\\회의록', NOW - 40 * S, { toolName: 'Read', toolDetail: '회의록.txt' }),
  hook('SubagentStart', 'sess-lob-0004', 'C:\\work\\회의록', NOW - 39 * S, { agentId: 'a1' }),
  hook('SubagentStart', 'sess-lob-0004', 'C:\\work\\회의록', NOW - 38 * S, { agentId: 'a2' }),
  hook('PostToolUse', 'sess-don-0005', MKT + '\\보고서', NOW - 5 * MIN, { toolName: 'Edit', toolDetail: '보고.md' }),
  hook('Stop', 'sess-don-0005', MKT + '\\보고서', NOW - 60 * S),
];
const PC = { cores: 16, totalMemGb: 31.7, freeMemGb: 19, cpuPercent: 38 };
const snapOf = (patch = {}) => ({
  ok: true, available: true, state: stateOf(EVENTS), departments: DEPTS, assignments: {}, settings: { view: 'tilted', manualCap: null },
  roots: { claude: ['C:\\Users\\a\\.claude'], codex: ['C:\\Users\\a\\.codex\\sessions'], added: [] }, pc: PC, readAt: NOW - 30 * S, ...patch,
});
const weekly = (service, used, extra = {}) => ({ id: 'r-' + service, service, source: 'auto', kind: 'weekly', folder: false, live: { weekly: { usedPercent: used, resetsAt: NOW + 3 * DAY } }, ...extra });
const SUBS = { ok: true, rows: [weekly('claude', 36), weekly('gpt', 88)] };
const rowOf = (room, key) => room.rows.find(r => r.key === key);

test('a viewer that is not shown the office gets nothing: unavailable, refused or missing answers', () => {
  assert.deepEqual(officeRoom({ ok: true, available: false }, {}, NOW), { visible: false });
  assert.deepEqual(officeRoom({ ok: false, code: 'NOT_ALLOWED' }, {}, NOW), { visible: false });
  assert.deepEqual(officeRoom(null, {}, NOW), { visible: false });
});

test('rows: one per department, 「부서 없는 일」 only while it has sessions, then 수용 인원, 설정, 꾸미기 and 부서 더하기', () => {
  const room = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  assert.equal(room.visible, true);
  assert.deepEqual(room.rows.map(r => r.key), ['d:dmkt', 'd:ddev', 'lobby', 'cap', 'cfg', 'look', 'add']);
  assert.equal(rowOf(room, 'cap').gap, true, 'a row of another kind keeps a gap');
  const noLobby = officeRoom(snapOf({ state: stateOf(EVENTS.filter(e => e.sessionId !== 'sess-lob-0004')) }), {}, NOW, { subs: SUBS });
  assert.deepEqual(noLobby.rows.map(r => r.key), ['d:dmkt', 'd:ddev', 'cap', 'cfg', 'look', 'add']);
  // 부서 줄과 「부서 없는 일」은 열고 닫는 것을 알린다(끝냄을 본 것으로 치는 seen). 꾸미기 줄은 고른 직원을 그림에서 밝히려고 알린다
  assert.deepEqual(room.rows.filter(r => r.watch).map(r => r.key), ['d:dmkt', 'd:ddev', 'lobby', 'look']);
});

test('the headline comes from the model: the question first, then how many sessions cannot tell about questions', () => {
  const room = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  assert.equal(room.say, '개발부가 3분 전에 승인을 물었습니다.');
  assert.equal(room.then, '하나는 승인 요청이 여기에 뜨지 않습니다.');
  assert.equal(room.hint, '', 'no hooks setting in the first piece, so no line that points to one');
  assert.equal(room.alert, true);
  assert.equal(room.foot, '방금 읽었습니다. 이 방이 열려 있는 동안 15초마다 기록을 살핍니다.');
  const empty = officeRoom(snapOf({ state: officeState(), departments: [] }), {}, NOW, { subs: SUBS });
  assert.equal(empty.say, '지금 이 PC에서 도는 일이 없습니다.');
  assert.equal(empty.then, 'Claude Code나 Codex에서 일을 시작하면 여기에 섭니다.');
  assert.deepEqual(empty.rows.map(r => r.key), ['cap', 'cfg', 'look', 'add']);
  assert.equal(empty.rows[0].gap, false, 'no gap above the first row');
  assert.deepEqual(empty.floor.zones, [], 'no departments and no sessions: nothing to draw');
  assert.equal(empty.alert, false);
});

test('department rows: the lead session\'s activity, a short status, the mark and its spoken word', () => {
  const room = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  const mkt = rowOf(room, 'd:dmkt'), dev = rowOf(room, 'd:ddev');
  assert.equal(mkt.nm, '마케팅부');
  assert.equal(mkt.mid, '쓰기 · 블로그.md', 'the department folder name is not repeated on its own row');
  assert.equal(mkt.val, '하나 일하는 중');
  assert.equal(mkt.flag, true, 'the turn that took four minutes and was not seen yet');
  assert.equal(dev.mid, 'Claude Code', 'the session that asked comes first; its only activity is the department folder, so the row names the AI instead of repeating the state (Fable F3)');
  assert.equal(dev.val, '승인을 물었습니다');
  assert.equal(dev.now, true);
  assert.equal(dev.flag, true);
  assert.equal(dev.label, '개발부, 새 소식, Claude Code, 승인을 물었습니다');
  assert.equal(officeGroupStatus([]), '빈 자리');
  assert.equal(officeGroupStatus([{ status: 'asked' }, { status: 'asked' }, { status: 'working' }]), '둘이 승인을 물었습니다');
  assert.equal(officeGroupStatus([{ status: 'done' }, { status: 'resting' }]), '끝냄');
  assert.equal(officeGroupStatus([{ status: 'quiet' }]), '조용합니다');
  const empty = officeRoom(snapOf({ departments: [...DEPTS, { id: 'dlaw', name: '법무부', folder: 'C:\\work\\문서\\계약' }] }), {}, NOW, { subs: SUBS });
  assert.deepEqual([rowOf(empty, 'd:dlaw').mid, rowOf(empty, 'd:dlaw').val, rowOf(empty, 'd:dlaw').flag], ['이 부서 폴더에서 일을 시작하면 직원이 섭니다', '빈 자리', false], 'no path on the closed row (11-23 blind review)');
});

test('closed rows show no path: a folder other than the department\'s reads 「… 폴더」, an empty department says how staff arrive (11-23 blind review)', () => {
  const room = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  assert.equal(rowOf(room, 'lobby').mid, '회의록 폴더 · 읽기 · 회의록.txt');
  // 부서 폴더 아래의 다른 폴더에서 일하면 그 폴더 이름은 남긴다
  const sub = officeRoom(snapOf({ state: stateOf([hook('PostToolUse', 'sess-sub-0001', MKT + '\\보고서', NOW - 20 * S, { toolName: 'Edit', toolDetail: '보고.md' })]) }), {}, NOW, { subs: SUBS });
  assert.equal(rowOf(sub, 'd:dmkt').mid, '보고서 폴더 · 쓰기 · 보고.md');
  // 부서 폴더 안의 Claude Code 작업 사본은 이름이 부서 폴더로 읽히므로 그 이름을 다시 쓰지 않는다(카본 solio-room-content A1)
  const wt = officeRoom(snapOf({ state: stateOf([hook('PostToolUse', 'sess-wtr-0001', SHOP + '\\.claude\\worktrees\\vigilant-jackson-a5f00e', NOW - 20 * S, { toolName: 'Read', toolDetail: 'a.md' })]) }), {}, NOW, { subs: SUBS });
  assert.equal(rowOf(wt, 'd:ddev').mid, '읽기 · a.md');
  // 「이 폴더로 부서 만들기」의 첫 제안: 작업 사본은 저장소 이름, 그 이름의 부서가 이미 있으면 끝 폴더 이름(Fable F2)
  const WT = 'D:\\worktrees\\shop\\vigilant-jackson-a5f00e';
  const wtLobby = departments => rowOf(officeRoom(snapOf({ state: stateOf([hook('PostToolUse', 'sess-wtl-0001', WT, NOW - 20 * S, { toolName: 'Read', toolDetail: 'a.md' })]), departments }), {}, NOW, { subs: SUBS }), 'lobby');
  const suggest = row => row.more.find(m => m[0] === 'grp' && m[1] === 'mk-sess-wtl-0001')[2][0][2];
  assert.equal(suggest(wtLobby([])), 'shop', 'a worktree session suggests its repository name');
  assert.equal(suggest(wtLobby([{ id: 'dshop', name: 'Shop', folder: 'D:\\other' }])), 'vigilant-jackson-a5f', 'a taken name falls back to the last folder name, cut to 20 characters');
  // 긴 폴더 이름은 20자로 자른 이름으로 견준다(Fable -b FA1)
  const LONG = 'D:\\worktrees\\a-very-long-repository-name\\vigilant-jackson-a5f00e';
  const longLobby = departments => rowOf(officeRoom(snapOf({ state: stateOf([hook('PostToolUse', 'sess-wtl-0001', LONG, NOW - 20 * S, { toolName: 'Read', toolDetail: 'a.md' })]), departments }), {}, NOW, { subs: SUBS }), 'lobby');
  assert.equal(suggest(longLobby([])), 'a-very-long-reposito');
  assert.equal(suggest(longLobby([{ id: 'dlong', name: 'a-very-long-reposito', folder: 'D:\\other' }])), 'vigilant-jackson-a5f', 'the cut name is already taken');
  // 하는 일을 모르는 일하는 직원은 오른쪽 칸을 되풀이하지 않고 어느 AI인지 쓴다
  const bare = officeRoom(snapOf({ state: stateOf([record('sess-bar-0001', MKT, 'codex', NOW - 20 * S)]) }), {}, NOW, { subs: SUBS });
  assert.deepEqual([rowOf(bare, 'd:dmkt').mid, rowOf(bare, 'd:dmkt').val], ['Codex', '하나 일하는 중']);
  const empty = officeRoom(snapOf({ state: officeState(), tasking: { tasks: [] } }), {}, NOW, { subs: SUBS });
  assert.equal(rowOf(empty, 'd:dmkt').mid, '일을 맡기면 직원이 자리에 앉습니다', 'with tasking the empty department points at 「맡기기」');
  for (const r of empty.rows.concat(room.rows)) assert.ok(!/[A-Za-z]:\\|\\/.test(String(r.mid)), 'no path on any closed row: ' + r.key + ' ' + r.mid);
  // 온전한 경로는 부서 설정 안의 「폴더」 줄에 있다
  const set = rowOf(room, 'd:dmkt').more.find(m => m[0] === 'grp' && m[1] === 'set')[2];
  assert.deepEqual(set.find(m => m[0] === 'row'), ['row', '폴더', MKT, '', '']);
});

test('staff lines: tool and model, the state in bold, the activity small, helpers and the note for sessions without hooks', () => {
  const room = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  const dev = rowOf(room, 'd:ddev').more, lobby = rowOf(room, 'lobby').more;
  assert.deepEqual(dev.find(m => m[0] === 'staff'), ['staff', 'sess-dev-0002', 'Claude Code', '', '3분 전에 승인을 물었습니다', 'shop', 'alert now']);
  const codex = dev.find(m => m[0] === 'staff' && m[1] === 'sess-cdx-0003');
  assert.deepEqual(codex.slice(2), ['Codex', '', '일하는 중', 'api · 승인 요청은 여기에 뜨지 않습니다', ''], 'a Codex session under the department folder belongs to it and says it cannot tell about questions');
  const helped = lobby.find(m => m[0] === 'staff' && m[1] === 'sess-lob-0004');
  assert.equal(helped[5], '회의록 · 읽기 · 회의록.txt · 도우미 둘과 함께');
  assert.equal(modelWord('claude-opus-4-5-20251101'), 'Opus');
  assert.equal(modelWord('gpt-5.2-codex'), 'gpt-5.2-codex');
});

test('the lobby offers 「보낼 부서」 and 「이 폴더로 부서 만들기」 for each session; departments carry only 「부서 설정」 as their feature', () => {
  const room = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  const lobby = rowOf(room, 'lobby').more;
  const send = lobby.find(m => m[0] === 'acts' && m[2] === '보낼 부서');
  assert.deepEqual(send[1].map(b => [b[0], b[1], b[2]]), [['마케팅부', 'assign', 'sess-lob-0004|dmkt'], ['개발부', 'assign', 'sess-lob-0004|ddev']]);
  const make = lobby.filter(m => m[0] === 'grp' && String(m[1]).startsWith('mk-'));
  assert.equal(make.length, 1, 'one per lobby session');
  assert.equal(make[0][3], true, 'the name field stays folded until pressed');
  assert.deepEqual(make.find(m => m[1] === 'mk-sess-lob-0004')[2][0], ['fld', '부서 이름', '회의록', '20자까지', 'nm-sess-lob-0004', 'text'], 'the folder name is the first suggestion');
  const mkt = rowOf(room, 'd:dmkt').more;
  assert.deepEqual(mkt.filter(m => m[0] === 'item').map(m => [m[1], m[2], m[3], m[4]]), [['부서 설정', '이름 · 폴더 · 빼기', false, 'set']]);
  const set = mkt.find(m => m[0] === 'grp' && m[1] === 'set');
  assert.equal(set[3], true, 'folded until pressed');
  assert.deepEqual(set[2].find(m => m[0] === 'acts')[1].map(b => b[1]), ['dept-rename', 'dept-folder', 'dept-remove-ask']);
  assert.ok(!set[2].some(m => m[0] === 'confirm'), 'no confirm before 「부서 빼기」 is pressed');
  const opened = officeRoom(snapOf(), { grps: new Set(['d:dmkt:set']), asking: 'dmkt' }, NOW, { subs: SUBS });
  const inner = rowOf(opened, 'd:dmkt').more.find(m => m[0] === 'grp' && m[1] === 'set');
  assert.equal(inner[3], false);
  const confirm = inner[2].find(m => m[0] === 'confirm');
  assert.equal(confirm[1], '마케팅부를 빼시겠습니까?');
  assert.deepEqual(confirm[3].map(b => b[1]), ['dept-remove', 'dept-remove-keep']);
});

test('the capacity row: PC numbers, each tool\'s subscription, the combined number, and 자동 or 직접 정하기 (1 to the cores)', () => {
  const subscriptions = officeSubscriptions(SUBS, NOW);
  assert.deepEqual(subscriptions, { claude: { leftPercent: 64, resetsAt: NOW + 3 * DAY }, codex: { leftPercent: 12, resetsAt: NOW + 3 * DAY } });
  const row = officeCapacityRow({ pc: PC, subscriptions, active: 4, now: NOW });
  assert.equal(row.mid, '16코어 · 32GB · Codex 12%', 'memory is rounded to whole GB (15.7 → 16, 31.7 → 32)');
  assert.equal(row.val, '여덟까지');
  const rows = Object.fromEntries(row.more.filter(m => m[0] === 'row').map(m => [m[1], m.slice(2, 4)]));
  assert.deepEqual(rows['프로세서'], ['논리 코어 16개 · 지금 38% 쓰는 중', '둘마다 하나 · 여덟']);
  assert.deepEqual(rows['메모리'], ['32GB · 지금 19GB 비어 있음', '4GB마다 하나 · 여덟']);
  assert.match(rows['Claude Code'][0], /^64% 남음 · .+에 다시 찹니다$/);
  assert.equal(rows['Claude Code'][1], '여덟까지');
  assert.equal(rows['Codex'][1], '하나까지', 'under 20% one at a time');
  assert.deepEqual(rows['합쳐서'], ['PC와 구독 가운데 적은 쪽입니다. 지금 넷이 일하고 있습니다.', '동시에 여덟까지']);
  const pick = row.more.find(m => m[0] === 'pick');
  assert.deepEqual([pick[1], pick[2].map(p => p[0]), pick[3], pick[5]], ['정하는 방법', ['자동', '직접 정하기'], 'auto', 'cap-mode']);
  const manual = row.more.find(m => m[0] === 'grp' && m[1] === 'manual');
  assert.equal(manual[3], true, 'the number field shows only for 직접 정하기');
  assert.deepEqual(manual[2][0], ['fld', '함께 일할 수', '8', '1에서 16까지', 'cap', 'number']);
  const mine = officeCapacityRow({ pc: PC, subscriptions, manualCap: 3, now: NOW });
  assert.equal(mine.val, '셋까지');
  assert.equal(mine.more.find(m => m[0] === 'pick')[3], 'manual');
  assert.equal(mine.more.find(m => m[0] === 'grp')[3], false);
  // 구독 값을 모르면 PC 한도만 쓰고 그렇다고 말한다(6절)
  const unknown = officeCapacityRow({ pc: PC, subscriptions: {}, now: NOW });
  assert.equal(unknown.val, '여덟까지');
  assert.ok(unknown.more.some(m => m[0] === 'note' && m[1] === '구독 방에 계정을 이으면 남은 양도 봅니다.'));
  assert.deepEqual(unknown.more.find(m => m[1] === 'Codex').slice(2, 4), ['남은 양을 모릅니다', '여덟까지']);
  const none = officeCapacityRow({ pc: null, now: NOW });
  assert.equal(none.val, '');
  assert.equal(none.mid, '이 PC의 프로세서와 메모리를 아직 읽지 못했습니다');
});

test('with both subscriptions used up the row says it rests until they fill again, instead of a number (6절 11-20)', () => {
  const used = officeSubscriptions({ rows: [weekly('claude', 100), weekly('gpt', 100)] }, NOW);
  assert.deepEqual([used.claude.leftPercent, used.codex.leftPercent], [0, 0]);
  const row = officeCapacityRow({ pc: PC, subscriptions: used, now: NOW });
  assert.equal(row.mid, OFFICE_REST_SAY);
  assert.equal(OFFICE_REST_SAY, '구독을 다 써서 다시 찰 때까지 쉽니다');
  assert.equal(row.val, '', 'no number while resting (the model still says one for the combined value)');
  assert.deepEqual(row.more.find(m => m[1] === '합쳐서').slice(2, 4), [OFFICE_REST_SAY + '.', '']);
  assert.deepEqual(row.more.filter(m => m[1] === 'Claude Code' || m[1] === 'Codex').map(m => m[3]), ['쉬는 중', '쉬는 중']);
  // 하나만 다 썼거나 하나를 모르면 쉬지 않는다
  assert.notEqual(officeCapacityRow({ pc: PC, subscriptions: { claude: used.claude }, now: NOW }).mid, OFFICE_REST_SAY);
  assert.notEqual(officeCapacityRow({ pc: PC, subscriptions: { claude: used.claude, codex: { leftPercent: 30 } }, now: NOW }).mid, OFFICE_REST_SAY);
});

test('P2 묶음 카본 A1: memory the main process could not read (null) is unknown, not 0 GB — no capacity is counted from it', () => {
  for (const pc of [{ cores: 8, totalMemGb: null, freeMemGb: null, cpuPercent: null }, { cores: null, totalMemGb: 16 }, { cores: 8, totalMemGb: '' }]) {
    const row = officeCapacityRow({ pc, now: NOW });
    assert.equal(row.mid, pc.cores ? '8코어 · 메모리를 읽지 못했습니다' : '이 PC의 프로세서와 메모리를 아직 읽지 못했습니다', JSON.stringify(pc));
    assert.equal(row.val, '', 'no automatic number from an unknown memory');
    if (pc.cores) {
      assert.equal(row.more.find(m => m[1] === '합쳐서')[2].split(' 지금')[0], '메모리를 읽지 못해 자동으로는 세지 않습니다. 직접 정할 수 있습니다.');
      assert.equal(row.more.find(m => m[1] === '합쳐서')[3], '', 'the right column does not show an automatic number either (검수 -r2 FA1)');
      // 일 맡기기가 켜진 판에서는 실행이 한 번에 하나씩 맡긴다고 말한다(설계 검토 solio-office-model-20261122 고칠 것 4)
      const taskRow = officeCapacityRow({ pc, now: NOW, tasking: true });
      assert.equal(taskRow.more.find(m => m[1] === '합쳐서')[2].split(' 지금')[0], '메모리를 읽지 못해 한 번에 하나씩 맡깁니다. 직접 정할 수 있습니다.');
      // 일 맡기기가 켜진 판의 설명 글은 「보이기만 합니다」를 쓰지 않는다(검수 solio-office-ga1b F1)
      assert.ok(!taskRow.more.some(m => m[0] === 'note' && /보이기만/.test(m[1])));
      assert.ok(row.more.some(m => m[0] === 'note' && /보이기만/.test(m[1])), 'the first-piece build still says it only shows');
      assert.ok(row.more.some(m => m[0] === 'pick' && m[5] === 'cap-mode'), 'the user can still set the number by hand (검수 solio-office-ga1 F3)');
      assert.deepEqual(row.more.filter(m => m[1] === 'Claude Code' || m[1] === 'Codex').map(m => m[3]), ['', '']);
    }
  }
  const busy = [record('sess-mem-0001', MKT, 'claude', NOW - 20 * S), record('sess-mem-0002', SHOP, 'claude', NOW - 30 * S)];
  const room = officeRoom(snapOf({ state: stateOf(busy), pc: { cores: 8, totalMemGb: null, freeMemGb: null, cpuPercent: null } }), {}, NOW, {});
  assert.ok(!/까지인데/.test(room.say), 'the headline does not count 「up to one」 from an unknown memory');
  const known = officeCapacityRow({ pc: { cores: 8, totalMemGb: 15.7, freeMemGb: null, cpuPercent: null }, now: NOW });
  assert.ok(!/비어 있음|쓰는 중/.test(known.more.map(m => m[2]).join(' ')), 'unknown free memory and CPU say nothing');
});

test('P2 묶음 GA1: with unreadable memory a number set by hand still shows; the automatic count stays unread (카본 A1)', () => {
  const used = officeSubscriptions({ rows: [weekly('claude', 100), weekly('gpt', 100)] }, NOW);
  const pc = { cores: 8, totalMemGb: null, freeMemGb: null, cpuPercent: null };
  const mine = officeCapacityRow({ pc, subscriptions: used, manualCap: 4, now: NOW });
  assert.equal(mine.val, '넷까지', 'the hand-set number is not hidden by the unreadable memory');
  assert.equal(mine.mid, '8코어 · 메모리를 읽지 못했습니다 · Claude 0% · Codex 0%');
  assert.deepEqual(mine.more.find(m => m[1] === '메모리').slice(2, 4), ['읽지 못했습니다', '']);
  assert.deepEqual(mine.more.filter(m => m[1] === 'Claude Code' || m[1] === 'Codex').map(m => m[3]), ['쉬는 중', '쉬는 중'], 'used-up subscriptions still rest per tool');
  assert.ok(/^직접 정한 수입니다\./.test(mine.more.find(m => m[1] === '합쳐서')[2]));
  assert.ok(mine.more.some(m => m[0] === 'note' && m[1].startsWith('구독이 절반 넘게 남으면 정한 수까지')), 'with a hand-set number the rule speaks of that number, not the PC limit');
  // 메모리를 몰라도 직접 정한 수가 PC 한도를 대신해 도구별 수도 그 수로 센다. 메모리와 직접 정한 수에 대해서는 일 맡기기 실행(office-task-runtime.cjs)도 같은 officeCapacity로 같은 수를 쓴다(검수 solio-office-ga1 F2, 설계 검토 solio-office-model 고칠 것 3)
  const plenty = officeSubscriptions({ rows: [weekly('claude', 20), weekly('gpt', 20)] }, NOW);
  assert.deepEqual(officeCapacityRow({ pc, subscriptions: plenty, manualCap: 4, now: NOW }).more.filter(m => m[1] === 'Claude Code' || m[1] === 'Codex').map(m => m[3]), ['넷까지', '넷까지']);
  const runtime = officeCapacity({ ...pc, manual: 4 });
  assert.deepEqual([runtime.cap, runtime.toolCaps.claude, runtime.toolCaps.codex], [4, 4, 4], 'the task runtime gets the same four, not one per tool');
  // 직접 정한 수가 코어 수를 넘거나 없으면 자동 수를 말하지 않는다
  for (const manualCap of [null, 9]) assert.equal(officeCapacityRow({ pc, subscriptions: {}, manualCap, now: NOW }).val, '');
  const busy = Array.from({ length: 6 }, (_, i) => record('sess-ga1-000' + i, MKT, 'claude', NOW - 20 * S));
  const room = officeRoom(snapOf({ state: stateOf(busy), pc, settings: { manualCap: 4 } }), {}, NOW, {});
  assert.ok(/넷까지인데/.test(room.say), 'the headline counts over the hand-set number: ' + room.say);
});

test('0.5.2 공개 검수 A4: a number set by hand wins over resting, and while resting the headline does not count 「up to」', () => {
  const used = officeSubscriptions({ rows: [weekly('claude', 100), weekly('gpt', 100)] }, NOW);
  const mine = officeCapacityRow({ pc: PC, subscriptions: used, manualCap: 2, now: NOW });
  assert.notEqual(mine.mid, OFFICE_REST_SAY);
  assert.equal(mine.val, '둘까지');
  assert.equal(mine.more.find(m => m[1] === '합쳐서')[3], '직접 정함 · 동시에 둘까지');
  const busy = [record('sess-rest-0001', MKT, 'claude', NOW - 20 * S), record('sess-rest-0002', SHOP, 'claude', NOW - 30 * S)];
  const subs = { rows: [weekly('claude', 100), weekly('gpt', 100)] };
  const resting = officeRoom(snapOf({ state: stateOf(busy), pc: PC }), {}, NOW, { subs });
  assert.ok(!/까지인데/.test(resting.say), 'no 「one at most, but two are working」 while the capacity row says it rests');
  const handSet = officeRoom(snapOf({ state: stateOf(busy), pc: PC, settings: { view: 'tilted', manualCap: 1 } }), {}, NOW, { subs });
  assert.match(handSet.say, /하나까지인데 지금 직원 둘이 일하고 있습니다/, 'a number set by hand is still counted');
});

test('subscription remaining comes from the default login rows only; account folders and unknown values are left out', () => {
  const subs = { rows: [weekly('claude', 10, { folder: true }), weekly('claude', 50), weekly('gemini', 0), { service: 'gpt', source: 'auto', kind: 'weekly', folder: false, live: {} }] };
  assert.deepEqual(officeSubscriptions(subs, NOW), { claude: { leftPercent: 50, resetsAt: NOW + 3 * DAY } });
  assert.deepEqual(officeSubscriptions(null, NOW), {});
  // 다시 찰 때가 지났으면 다시 찬 것으로 본다(구독 방의 셈 그대로)
  assert.equal(officeSubscriptions({ rows: [weekly('gpt', 90, { live: { weekly: { usedPercent: 90, resetsAt: NOW - 1 } } })] }, NOW).codex.leftPercent, 100);
});

test('the settings row offers the two views and the watched folders, and no hooks switch in this build', () => {
  const room = officeRoom(snapOf({ roots: { claude: ['C:\\Users\\a\\.claude', 'D:\\other\\.claude'], codex: ['C:\\Users\\a\\.codex\\sessions'], added: ['d:\\other\\.claude'] } }), {}, NOW, { subs: SUBS });
  const cfg = rowOf(room, 'cfg');
  assert.equal(cfg.mid, '비스듬히 보기 · 기록을 읽는 폴더 셋');
  const pick = cfg.more.find(m => m[0] === 'pick');
  assert.deepEqual([pick[2], pick[3], pick[5]], [[['비스듬히', 'tilted'], ['위에서', 'top']], 'tilted', 'view']);
  const folders = cfg.more.filter(m => m[0] === 'row');
  assert.deepEqual(folders.map(m => [m[1], m[2], Array.isArray(m[3]) ? m[3][1] : '']), [['Claude Code', 'C:\\Users\\a\\.claude', ''], ['Claude Code', 'D:\\other\\.claude', 'root-remove'], ['Codex', 'C:\\Users\\a\\.codex\\sessions', '']], 'only an added folder can be taken out');
  assert.ok(cfg.more.some(m => m[0] === 'acts' && m[1][0][1] === 'root-add'));
  assert.ok(!JSON.stringify(cfg.more).includes('승인 물음'), 'no hooks switch in the first piece');
  assert.equal(rowOf(officeRoom(snapOf(), { view: 'top' }, NOW), 'cfg').mid, '위에서 보기 · 기록을 읽는 폴더 둘', 'the chosen view shows before the save comes back');
});

test('the floor draws up to six departments and bundles the rest into one 「그 밖」 zone, with the lobby in the bottom strip', () => {
  const many = n => Array.from({ length: n }, (_, i) => ({ id: 'dep' + i, name: '부서' + i, folder: 'C:\\d' + i }));
  const list = [{ id: 's1', status: 'working', alert: false, subagents: 0, departmentId: 'dep6' }, { id: 's2', status: 'asked', alert: true, subagents: 0, departmentId: null }];
  const six = officeFloorScene({ departments: many(6), list: [], cap: 8 });
  assert.deepEqual(six.zones.map(z => z.kind), Array(6).fill('dept'));
  const seven = officeFloorScene({ departments: many(7), list, cap: 8 });
  assert.deepEqual(seven.zones.map(z => z.key), ['d:dep0', 'd:dep1', 'd:dep2', 'd:dep3', 'd:dep4', 'd:dep5', 'lobby', 'other']);
  assert.equal(seven.zones.at(-1).name, '그 밖 하나');
  assert.deepEqual(seven.zones.at(-1).staff.map(s => [s.id, s.zone]), [['s1', 'd:dep6']], 'staff of a bundled department still point at their own row');
  assert.equal(OFFICE_FLOOR_DEPTS, 6);
  assert.equal(seven.seats, 3);
  const layout = floorLayout(seven);
  const strip = layout.filter(z => z.kind !== 'dept');
  assert.equal(strip.length, 2);
  assert.ok(strip[0].rect.x1 < strip[1].rect.x0, 'lobby and 「그 밖」 sit side by side');
  assert.ok(Math.min(...strip.map(z => z.rect.z0)) > Math.max(...layout.filter(z => z.kind === 'dept').map(z => z.rect.z1)), 'below the two rows of departments');
  // 빈 자리는 가는 선으로 그린다: 자리 수만큼 자리가 있고, 직원이 더 많으면 자리가 는다(여섯까지)
  assert.equal(layout[0].spots.length, 3);
  // 0.5.2 공개 검수 A5: 아래 띠의 두 구역은 직원 수에 맞춘 폭이다. 구슬이 제 좌대 안에 있고 두 좌대가 겹치지 않는다
  const loneBand = { key: 'lobby', kind: 'lobby', name: '부서 없는 일', staff: [{ id: 'l1', status: 'working' }] };
  const manyBand = { key: 'other', kind: 'other', name: '그 밖', staff: Array.from({ length: 8 }, (_, i) => ({ id: 'o' + i, status: 'working' })) };
  for (const order of [[loneBand, manyBand], [manyBand, loneBand]]) {
    const bands = floorLayout({ seats: 1, zones: order }).filter(z => z.kind !== 'dept');
    for (const z of bands) for (const p of z.spots) assert.ok(p.x >= z.rect.x0 && p.x <= z.rect.x1, z.key + ' keeps its staff on its own stand');
    assert.ok(bands[0].rect.x1 < bands[1].rect.x0, 'the two stands do not overlap');
  }
  const crowded = floorLayout({ seats: 1, zones: [{ key: 'd:x', kind: 'dept', name: 'x', staff: Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, status: 'working' })) }] });
  assert.equal(crowded[0].spots.length, 5);
  // 자리보다 직원이 많으면 승인 물음 · 일하는 직원부터 앉고, 앉은 직원끼리는 처음 본 차례다(유호님 PC 실제 확인 11-22: 스물셋 가운데 처음 본 여덟만 그려 일하는 열둘 가운데 하나만 그림에 있었다)
  const lobbyStaff = [...Array.from({ length: 8 }, (_, i) => ({ id: 'q' + i, status: 'quiet' })), { id: 'w1', status: 'working' }, { id: 'q8', status: 'quiet' }, { id: 'w2', status: 'working' }];
  const [lobby] = floorLayout({ seats: 1, zones: [{ key: 'lobby', kind: 'lobby', name: '부서 없는 일', staff: lobbyStaff }] });
  assert.equal(lobby.spots.length, 8);
  assert.deepEqual(lobby.staff.map(s => s.id), ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'w1', 'w2'], 'the two working staff take seats from the quiet ones and keep their first-seen order');
  const deptStaff = [...Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, status: 'resting' })), { id: 'a1', status: 'asked' }];
  const [dept] = floorLayout({ seats: 1, zones: [{ key: 'd:y', kind: 'dept', name: 'y', staff: deptStaff }] });
  assert.ok(dept.staff.some(s => s.id === 'a1'), 'a staff member asking for approval is always drawn in a full department');
  assert.equal(dept.staff.length, 6);
  const few = [{ id: 'f1', status: 'quiet' }, { id: 'f2', status: 'working' }];
  assert.deepEqual(floorLayout({ seats: 1, zones: [{ key: 'lobby', kind: 'lobby', name: '부서 없는 일', staff: few }] })[0].staff.map(s => s.id), ['f1', 'f2'], 'under the seat count nobody moves');
  // 한 명이 조용해지면 그 자리의 주인만 바뀐다. 남은 직원은 지난 그림의 자리를 그대로 쓴다(검수 solio-office-seats-20261122 F1)
  const crowd = st => [{ key: 'lobby', kind: 'lobby', name: '부서 없는 일', staff: st }];
  const busy = Array.from({ length: 23 }, (_, i) => ({ id: 's' + i, status: i >= 11 ? 'working' : 'quiet' }));
  const first = floorLayout({ seats: 1, zones: crowd(busy) });
  const firstIds = first[0].staff.map(s => s.id);
  assert.deepEqual(firstIds, ['s11', 's12', 's13', 's14', 's15', 's16', 's17', 's18']);
  const calmer = busy.map(s => (s.id === 's11' ? { ...s, status: 'quiet' } : s));
  const nextIds = floorLayout({ seats: 1, zones: crowd(calmer) }, first)[0].staff.map(s => s.id);
  assert.deepEqual(nextIds.map((id, i) => id === firstIds[i]), [false, true, true, true, true, true, true, true], 'only the seat of the staff member who went quiet changes hands');
  assert.equal(nextIds[0], 's19', 'the next working staff member takes the freed seat');
  // 넘쳤던 부서에서 그림에 없던 직원이 빠져 자리 수와 같아져도 남은 여섯은 자리를 그대로 쓴다(검수 -r2 F1)
  const dz = st => [{ key: 'd:z', kind: 'dept', name: 'z', staff: st }];
  const sevenDept = [...['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, status: 'working' })), { id: 'g', status: 'quiet' }];
  const start7 = floorLayout({ seats: 1, zones: dz(sevenDept) });
  // a가 조용해지고 g가 일을 시작하면 g가 a의 자리에 앉는다([g, b, c, d, e, f])
  const swapped = sevenDept.map(s => (s.id === 'a' ? { ...s, status: 'quiet' } : s.id === 'g' ? { ...s, status: 'working' } : s));
  const before7 = floorLayout({ seats: 1, zones: dz(swapped) }, start7);
  assert.deepEqual(before7[0].staff.map(s => s.id), ['g', 'b', 'c', 'd', 'e', 'f']);
  // 그림에 없던 a의 세션이 끝나 여섯이 된다
  const after6 = floorLayout({ seats: 1, zones: dz(swapped.slice(1)) }, before7);
  const spotOf = (layout, id) => layout[0].spots[layout[0].staff.findIndex(s => s.id === id)];
  for (const id of ['b', 'c', 'd', 'e', 'f', 'g']) assert.deepEqual(spotOf(after6, id), spotOf(before7, id), id + ' keeps its spot when the hidden staff member leaves');
  // 자리를 넘어 그림에 없는 직원 수를 구역 이름 뒤에 적는다(검수 F2)
  const full = floorLayout({ seats: 1, zones: crowd(busy) })[0];
  assert.equal(full.hidden, 15);
  const wide = () => true, upTo = n => t => t.length <= n;
  assert.deepEqual(floorZoneLabel(full, wide), { text: '부서 없는 일 · 직원 열다섯 더', clip: false, form: 'long' });
  // 이름이 먼저다: 짧은 표시(+15)로 바꾸고, 그래도 안 들어가면 이름만 둔다(검수 solio-office-ga1 F1)
  assert.deepEqual(floorZoneLabel(full, upTo(11)), { text: '부서 없는 일 +15', clip: false, form: 'short' });
  assert.deepEqual(floorZoneLabel(full, upTo(6)), { text: '부서 없는 일', clip: true, form: 'none' });
  assert.deepEqual(floorZoneLabel(floorLayout({ seats: 1, zones: crowd(few) })[0], wide), { text: '부서 없는 일', clip: true, form: 'none' }, 'nothing is added when everyone has a seat');
  // 한 장면이 짧은 꼴이면 넓은 구역도 짧은 꼴로 쓴다(검수 solio-office-ga1b F2)
  assert.deepEqual(floorZoneLabel(full, wide, true), { text: '부서 없는 일 +15', clip: false, form: 'short' });
  // 「그 밖 셋」의 셋은 부서 수라 빠진 것이 직원임을 적는다(F4)
  assert.equal(floorZoneLabel({ name: '그 밖 셋', kind: 'other', hidden: 6 }, wide).text, '그 밖 셋 · 직원 여섯 더');
  assert.equal(floorZoneLabel({ name: '그 밖 셋', kind: 'other', hidden: 6 }, wide, true).text, '그 밖 셋 · 직원 +6', 'the short form keeps 「직원」 too (검수 -r2 FA1)');
  // 장면의 꼴: 긴 꼴이 안 들어가고 짧은 꼴은 들어가는 구역이 있으면 짧은 꼴. 어느 꼴도 안 들어가는 구역은 판단에서 뺀다
  const longName = { name: '아주아주긴부서이름', kind: 'dept', hidden: 2 }, roomy = { name: '개발', kind: 'dept', hidden: 1 };
  assert.equal(floorShortForm([longName, roomy], z => (z === longName ? upTo(3) : wide)), false, 'a zone that cannot show any count does not switch the scene');
  assert.equal(floorShortForm([longName, roomy], z => (z === longName ? upTo(12) : wide)), true, 'a zone that fits only the short form switches the scene');
  assert.equal(floorShortForm([{ name: 'x', kind: 'dept', hidden: 0 }], () => () => false), false);
  // 느낌표가 붙은 직원(오래 걸린 일을 끝냄)은 일하는 직원보다 먼저 앉는다(F3)
  const doneLong = [...Array.from({ length: 8 }, (_, i) => ({ id: 'k' + i, status: 'working' })), { id: 'd1', status: 'done', alert: true }];
  assert.ok(floorLayout({ seats: 1, zones: crowd(doneLong) })[0].staff.some(s => s.id === 'd1'), 'a finished staff member with an alert stays in the picture');
  assert.ok(FLOOR_MOTION.rimPeriod >= 2400, 'the working rim changes over at least 2.4 s');
  assert.equal(FLOOR_MOTION.fadeMs, 300, 'a new staff member fades in for 0.3 s at the seat');
});

/* ── 방의 동작(createOfficeRoom) ── */
function officeApi() {
  const calls = [];
  const res = { ok: true };
  const api = {};
  for (const name of ['watch', 'saveDepartment', 'removeDepartment', 'assign', 'saveSettings', 'addRoot', 'removeRoot', 'seen']) api[name] = (...args) => { calls.push([name, ...args]); return Promise.resolve(typeof res[name] === 'function' ? res[name](...args) : res[name] || { ok: true }); };
  return { api, calls, res };
}
function roomHarness() {
  const { api, calls, res } = officeApi();
  let snap = snapOf(), reads = 0, changes = 0;
  const room = createOfficeRoom({ api, snapshot: () => snap, reread: () => { reads += 1; }, changed: () => { changes += 1; } });
  return { room, api, calls, res, reads: () => reads, changes: () => changes, setSnap: s => { snap = s; }, scene: () => room.scene(snap, NOW, SUBS) };
}
const settle = () => new Promise(r => setTimeout(r, 0));

test('opening then closing a department row calls seen for that department, and 「부서 없는 일」 calls it with null', async () => {
  const h = roomHarness();
  await h.room.handle({ room: 'solio-office', key: 'd:dmkt', act: 'row-open' });
  assert.deepEqual(h.calls, [], 'opening alone does not mark anything seen');
  await h.room.handle({ room: 'solio-office', key: 'd:dmkt', act: 'row-fold' });
  await settle();
  assert.deepEqual(h.calls, [['seen', 'dmkt']]);
  assert.ok(h.reads() >= 1, 'the board is read again so the mark goes');
  await h.room.handle({ room: 'solio-office', key: 'lobby', act: 'row-fold' });
  await settle();
  assert.deepEqual(h.calls.at(-1), ['seen', null]);
  await h.room.handle({ room: 'solio-office', key: 'cap', act: 'row-fold' });
  await h.room.handle({ room: 'solio-office', key: 'cfg', act: 'row-fold' });
  assert.equal(h.calls.filter(c => c[0] === 'seen').length, 2, 'other rows do not call seen');
});

test('a folded department closes its 부서 설정 and drops a pending removal question', async () => {
  const h = roomHarness();
  await h.room.handle({ key: 'd:dmkt', act: 'grp', arg: 'set' });
  await h.room.handle({ key: 'd:dmkt', act: 'dept-remove-ask', arg: 'dmkt' });
  let mkt = h.scene().rows.find(r => r.key === 'd:dmkt').more.find(m => m[0] === 'grp');
  assert.equal(mkt[3], false);
  assert.ok(mkt[2].some(m => m[0] === 'confirm'));
  assert.deepEqual(h.scene().focus.ask, true, 'the question gets the focus');
  await h.room.handle({ key: 'd:dmkt', act: 'row-fold' });
  mkt = h.scene().rows.find(r => r.key === 'd:dmkt').more.find(m => m[0] === 'grp');
  assert.equal(mkt[3], true, 'opened again later, the feature list starts folded');
  assert.ok(!mkt[2].some(m => m[0] === 'confirm'));
});

test('removing a department takes two presses in place; without the question the second button does nothing', async () => {
  const h = roomHarness();
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove', arg: 'ddev' });
  assert.deepEqual(h.calls, [], 'no removal without the question');
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove-ask', arg: 'ddev' });
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove-keep', arg: 'ddev' });
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove', arg: 'ddev' });
  assert.deepEqual(h.calls, [], '그만두기 takes the question back');
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove-ask', arg: 'ddev' });
  await h.room.handle({ key: 'd:ddev', act: 'dept-remove', arg: 'ddev' });
  assert.deepEqual(h.calls, [['removeDepartment', 'ddev']]);
  const scene = h.scene();
  assert.equal(scene.foot.endsWith('「개발부」 부서를 뺐습니다.'), true);
  assert.equal(scene.focus.say, true, 'the row is gone, so the focus goes to the sentence');
});

test('부서 더하기 checks the name here, then asks the main process to open the folder dialog (no path from the screen)', async () => {
  const h = roomHarness();
  await h.room.handle({ key: 'add', act: 'dept-add', fields: { name: '  ' } });
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.scene().rows.find(r => r.key === 'add').more.find(m => m[0] === 'live'), ['live', '부서 이름을 1자에서 20자로 적어 주세요.']);
  await h.room.handle({ key: 'add', act: 'dept-add', fields: { name: '개발부' } });
  assert.deepEqual(h.calls, [], 'a taken name is caught before the dialog');
  assert.match(h.scene().rows.find(r => r.key === 'add').more.find(m => m[0] === 'live')[1], /같은 이름의 부서/);
  await h.room.handle({ key: 'add', act: 'dept-name', arg: '법무부' });
  assert.equal(h.scene().rows.find(r => r.key === 'add').more[0][2], '법무부', 'an example fills the name field');
  await h.room.handle({ key: 'add', act: 'dept-add', fields: { name: ' 법무부 ' } });
  assert.deepEqual(h.calls, [['saveDepartment', { name: '법무부', folder: 'choose' }]]);
  assert.equal(h.scene().rows.find(r => r.key === 'add').more[0][2], '', 'the name field is empty again after adding');
  assert.equal(h.scene().rows.find(r => r.key === 'add').more[0][4], 'name-1', 'a new field name, so the screen does not carry the typed name over');
  assert.deepEqual(h.scene().focus, { key: 'add', field: 'name-1', seq: h.scene().focus.seq }, 'the focus goes back to the empty name field');
  // 고르기 창을 닫으면 아무 말도 남기지 않는다. 다른 거절은 까닭을 쓴다
  h.res.saveDepartment = { ok: false, code: 'CANCELLED' };
  await h.room.handle({ key: 'add', act: 'dept-add', fields: { name: '회계부' } });
  assert.deepEqual(h.scene().rows.find(r => r.key === 'add').more.find(m => m[0] === 'live'), ['live', '']);
  h.res.saveDepartment = { ok: false, code: 'LIMIT' };
  await h.room.handle({ key: 'add', act: 'dept-add', fields: { name: '회계부' } });
  assert.match(h.scene().rows.find(r => r.key === 'add').more.find(m => m[0] === 'live')[1], /24개/);
});

test('renaming keeps the folder (no folder sent), changing the folder sends choose, and making one from a session sends fromSession', async () => {
  const h = roomHarness();
  await h.room.handle({ key: 'd:dmkt', act: 'dept-rename', arg: 'dmkt', fields: { name: '홍보부' } });
  await h.room.handle({ key: 'd:dmkt', act: 'dept-folder', arg: 'dmkt' });
  await h.room.handle({ key: 'lobby', act: 'dept-from', arg: 'sess-lob-0004', fields: { 'nm-sess-lob-0004': '회의록' } });
  await h.room.handle({ key: 'lobby', act: 'assign', arg: 'sess-lob-0004|ddev' });
  assert.deepEqual(h.calls, [
    ['saveDepartment', { id: 'dmkt', name: '홍보부' }],
    ['saveDepartment', { id: 'dmkt', folder: 'choose' }], // 폴더만 바꿀 때는 이름을 싣지 않는다(GA3)
    ['saveDepartment', { name: '회의록', folder: { fromSession: 'sess-lob-0004' } }],
    ['assign', 'sess-lob-0004', 'ddev'],
  ]);
  assert.deepEqual(h.scene().opening.key, 'd:ddev', 'the department the session went to opens');
  assert.match(h.scene().rows.find(r => r.key === 'd:ddev').more.find(m => m[0] === 'live')[1], /^이 세션을 개발부로 보냈습니다/);
});

test('settings: the view changes at once and is saved, the manual number is checked against the cores, folders go through the main process', async () => {
  const h = roomHarness();
  await h.room.handle({ key: 'cfg', act: 'view', arg: 'top' });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { view: 'top' }]);
  assert.equal(h.scene().floor.view, 'top');
  assert.equal(h.scene().floor.viewSeq, 1, 'the floor moves the camera only for a change the user made');
  await h.room.handle({ key: 'cap', act: 'cap-mode', arg: 'manual' });
  assert.equal(h.scene().rows.find(r => r.key === 'cap').more.find(m => m[0] === 'grp')[3], false);
  await h.room.handle({ key: 'cap', act: 'cap-save', fields: { cap: '17' } });
  assert.deepEqual(h.scene().rows.find(r => r.key === 'cap').more.find(m => m[0] === 'live'), ['live', '1에서 16까지의 수를 적어 주세요.']);
  await h.room.handle({ key: 'cap', act: 'cap-save', fields: { cap: '4' } });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { manualCap: 4 }]);
  h.setSnap(snapOf({ settings: { view: 'top', manualCap: 4 } }));
  await h.room.handle({ key: 'cap', act: 'cap-mode', arg: 'auto' });
  assert.deepEqual(h.calls.at(-1), ['saveSettings', { manualCap: null }]);
  await h.room.handle({ key: 'cfg', act: 'root-add' });
  await h.room.handle({ key: 'cfg', act: 'root-remove', arg: 'D:\\other\\.claude' });
  assert.deepEqual(h.calls.slice(-2), [['addRoot'], ['removeRoot', 'D:\\other\\.claude']]);
  // 저장이 거절되면 보기를 되돌린다
  h.res.saveSettings = { ok: false, code: 'NOT_ALLOWED' };
  await h.room.handle({ key: 'cfg', act: 'view', arg: 'tilted' });
  assert.equal(h.scene().floor.view, 'top');
});

test('one thing at a time: a press while another save is running is refused with a line, and a reset drops a late answer', async () => {
  const h = roomHarness();
  let release;
  h.res.saveDepartment = () => new Promise(r => { release = () => r({ ok: true }); });
  const first = h.room.handle({ key: 'add', act: 'dept-add', fields: { name: '법무부' } });
  await settle();
  await h.room.handle({ key: 'd:dmkt', act: 'dept-folder', arg: 'dmkt' });
  assert.equal(h.calls.length, 1);
  assert.match(h.scene().rows.find(r => r.key === 'd:dmkt').more.find(m => m[0] === 'live')[1], /다른 일을 마치는 중/);
  h.room.reset();
  release();
  await first;
  assert.equal(h.scene().rows.find(r => r.key === 'add').more.find(m => m[0] === 'live')[1], '', 'the answer that came after the reset leaves no line');
});

/* ── 첫 조각은 기록 파일만 읽는다(11-21 유호님 「훅 빼고 내기」) ── */
test('설계 검토 be7 고칠 것 1: an added folder that is not watched still has its line, a remove button and 「지금은 보지 않음」', () => {
  const share = '\\\\slow-server\\share\\.claude';
  const row = officeSettingsRow({ roots: { claude: ['C:\\Users\\a\\.claude'], codex: [], added: [share] } });
  const line = row.more.find(m => m[0] === 'row' && m[2] === share + ' · 지금은 보지 않음');
  assert.ok(line, 'the folder has its line');
  assert.deepEqual(line[3], ['빼기', 'root-remove', share, '']);
  assert.ok(row.more.some(m => m[0] === 'note' && m[1].includes('지금은 보지 않음')), 'one line says why');
  assert.equal(row.mid, '비스듬히 보기 · 기록을 읽는 폴더 하나', 'the count is the folders watched now');
  const watched = officeSettingsRow({ roots: { claude: ['C:\\Users\\a\\.claude', share], codex: [], added: [share] } });
  assert.equal(watched.more.filter(m => m[0] === 'row' && m[2] === share).length, 1, 'a watched folder is not listed twice');
  assert.ok(!watched.more.some(m => m[0] === 'note' && m[1].includes('지금은 보지 않음')));
  // 화면 r5 FA1: 기본 폴더가 다른 꼴(빗금 방향 · 끝 빗금)로 적혀도 더한 폴더와 같은 폴더면 한 줄이고, 빼기는 더한 글자로 부른다
  const other = officeSettingsRow({ roots: { claude: ['D:/claude-work/'], codex: [], added: ['D:\\claude-work'], resting: [] } });
  const rows = other.more.filter(m => m[0] === 'row' && m[1] === 'Claude Code');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0][3], ['빼기', 'root-remove', 'D:\\claude-work', '']);
  assert.ok(!other.more.some(m => m[0] === 'note' && m[1].includes('지금은 보지 않음')));
  // 본체가 보낸 목록이 있으면 그것을 쓴다
  const told = officeSettingsRow({ roots: { claude: ['C:\\Users\\a\\.claude'], codex: [], added: ['C:\\x'], resting: [] } });
  assert.ok(!told.more.some(m => m[0] === 'row' && String(m[2]).includes('지금은 보지 않음')));
});

test('records only: no staff line repeats 「승인 요청은 여기에 뜨지 않습니다」; the headline says it once, and the settings rooms have no hooks switch', () => {
  const only = [
    record('sess-rec-0001', MKT, 'claude', NOW - 20 * S),
    record('sess-rec-0002', SHOP, 'claude', NOW - 4 * MIN),
    record('sess-cdx-0003', SHOP + '\\api', 'codex', NOW - 30 * S),
  ];
  const room = officeRoom(snapOf({ state: stateOf(only) }), {}, NOW, { subs: SUBS });
  assert.equal(room.say, '직원 둘이 일하고 있습니다.');
  assert.equal(room.then, '승인 요청은 Claude Code와 Codex 창에서 확인해 주세요.');
  assert.equal(room.hint, '');
  assert.equal(room.alert, false, 'no alert without hook news');
  const staff = room.rows.flatMap(r => (r.more || []).filter(m => m[0] === 'staff'));
  assert.equal(staff.length, 3);
  assert.ok(staff.every(m => !m[5].includes('승인 요청')), 'the note is not repeated on every line');
  const one = officeRoom(snapOf({ state: stateOf(only.slice(0, 1)) }), {}, NOW, { subs: SUBS });
  assert.equal(one.then, '승인 요청은 Claude Code 창에서 확인해 주세요.');
  // 훅 소식을 받은 세션이 하나라도 있으면(둘째 조각) 모르는 세션의 줄에 그 말이 다시 붙는다
  const mixed = officeRoom(snapOf(), {}, NOW, { subs: SUBS });
  assert.ok(mixed.rows.flatMap(r => (r.more || []).filter(m => m[0] === 'staff')).some(m => m[5].endsWith('승인 요청은 여기에 뜨지 않습니다')));
  const cfg = rowOf(room, 'cfg');
  assert.equal(cfg.mid, '비스듬히 보기 · 기록을 읽는 폴더 둘');
  assert.ok(!JSON.stringify(cfg.more).includes('승인 요청'));
});

/* ── 카본 화면 검수(solio-office-screen-20261120) ── */
test('carbon A7: 「로 · 으로」 reads digits, Latin endings and trailing brackets', () => {
  const cases = { '개발부': '개발부로', '법무실': '법무실로', '회계팀': '회계팀으로', '개발 3': '개발 3으로', '개발 2': '개발 2로', '개발 7': '개발 7로', 'Design': 'Design으로', 'Codex': 'Codex로', '법무(계약)': '법무(계약)으로', '마케팅(SNS)': '마케팅(SNS)로' };
  for (const [w, want] of Object.entries(cases)) assert.equal(officeRo(w), want, w);
});
