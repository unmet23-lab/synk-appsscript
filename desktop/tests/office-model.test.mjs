// 솔리오 「사무실」의 상태 규칙 · 맨 위 문장 · 부서 · 수용 인원(구현설계.md 4~7절, 14.1). 소식은 합성이고 때는 고정값이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { officeState, officeReduce, officeSessions, officePrune, officeDepartmentOf, officeIgnoredCwd, officeActivity, officeHeadline, officeCapacity, officeSeats, countWord, OFFICE_TIMES } from '../renderer/office-model.mjs';

const S = 1e3, M = 60e3, H = 3600e3;
const T0 = new Date(2026, 10, 20, 9, 0).getTime(); // 2026-11-20 09:00
const CWD = 'C:\\work\\shop';
const hook = (event, at, extra = {}) => ({ kind: 'hook', event, sessionId: 'a', cwd: CWD, at, ...extra });
const rec = (changedAt, extra = {}) => ({ kind: 'record', sessionId: 'a', cwd: CWD, tool: 'claude', changedAt, ...extra });
const ask = (at, extra = {}) => hook('Notification', at, { notificationType: 'permission_prompt', ...extra });
const idle = (at, extra = {}) => hook('Notification', at, { notificationType: 'idle_prompt', ...extra });
const fold = (events, ctx, from = officeState()) => events.reduce((st, e) => officeReduce(st, e, ctx), from);
const one = (state, now, ctx) => officeSessions(state, now, ctx)[0] ?? null;
const shape = v => (v ? [v.status, v.say, v.alert] : null);

test('the 4.1 table walked as events: working, asked, no news, done, resting', () => {
  let st = fold([hook('SessionStart', T0, { model: 'claude-opus-5-5' }), hook('PostToolUse', T0 + 10 * S, { toolName: 'Read', toolDetail: 'auth.ts' })]);
  let v = one(st, T0 + 20 * S);
  assert.deepEqual(shape(v), ['working', '일하는 중', false]);
  assert.deepEqual([v.hooked, v.note, v.model, v.activity], [true, '', 'claude-opus-5-5', 'shop · 읽기 · auth.ts']);
  st = officeReduce(st, ask(T0 + 1 * M));
  assert.deepEqual(shape(one(st, T0 + 4 * M)), ['asked', '3분 전에 승인을 물었습니다', true]);
  st = officeReduce(st, hook('PostToolUse', T0 + 5 * M, { toolName: 'Bash', toolDetail: 'npm' }));
  v = one(st, T0 + 5 * M + 30 * S);
  assert.deepEqual(shape(v), ['working', '일하는 중', false]);
  assert.equal(v.activity, 'shop · 명령 · npm');
  assert.deepEqual(shape(one(st, T0 + 17 * M)), ['silent', '12분째 소식이 없습니다', true]);
  st = officeReduce(st, hook('Stop', T0 + 18 * M));
  assert.deepEqual(shape(one(st, T0 + 18 * M + S)), ['done', '끝냄', true]);
  st = officeReduce(st, { kind: 'seen', departmentId: null, at: T0 + 19 * M });
  assert.deepEqual(shape(one(st, T0 + 19 * M + S)), ['resting', '쉬는 중', false]);
});

test('an idle prompt while not done is resting, and a new tool after it is working again', () => {
  const st = fold([hook('PostToolUse', T0), idle(T0 + 2 * M)]);
  assert.deepEqual(shape(one(st, T0 + 3 * M)), ['resting', '쉬는 중', false]);
  assert.deepEqual(shape(one(officeReduce(st, hook('PostToolUse', T0 + 4 * M)), T0 + 4 * M + S)), ['working', '일하는 중', false]);
});

test('the approval mark clears only on a main PostToolUse, Stop or SessionEnd', () => {
  const base = [hook('PostToolUse', T0), ask(T0 + M)];
  const keeps = [
    hook('SubagentStart', T0 + 2 * M, { agentId: 'x1' }),
    hook('SubagentStop', T0 + 2 * M, { agentId: 'x1' }),
    idle(T0 + 2 * M),
    hook('Notification', T0 + 2 * M, { notificationType: 'auth_success' }),
    hook('PostToolUse', T0 + 2 * M, { agentId: 'x1', toolName: 'Read' }),
    hook('SessionStart', T0 + 2 * M),
    rec(T0 + 2 * M),
  ];
  for (const e of keeps) assert.equal(one(fold([...base, e]), T0 + 3 * M).status, 'asked', e.event || e.kind);
  assert.deepEqual(shape(one(fold([...base, hook('PostToolUse', T0 + 2 * M)]), T0 + 3 * M)), ['working', '일하는 중', false]);
  assert.equal(one(fold([...base, hook('Stop', T0 + 2 * M)]), T0 + 3 * M).status, 'done');
  assert.equal(one(fold([...base, hook('SessionEnd', T0 + 2 * M)]), T0 + 3 * M), null);
});

test('out-of-order hooks are compared by time, not by arrival', () => {
  // 묻기 전에 끝난 도구의 PostToolUse가 물음보다 늦게 닿았다. 표시는 남는다
  const late = fold([hook('PostToolUse', T0), ask(T0 + 2 * M), hook('PostToolUse', T0 + M, { toolName: 'Read' })]);
  assert.deepEqual(shape(one(late, T0 + 3 * M)), ['asked', '1분 전에 승인을 물었습니다', true]);
  // 이미 풀린 뒤에 그 물음이 늦게 닿았다. 표시를 다시 세우지 않는다
  const cleared = fold([ask(T0 + M, {}), hook('PostToolUse', T0 + 2 * M)].reverse());
  assert.equal(one(cleared, T0 + 3 * M).status, 'working');
  // 같은 때에 온 물음과 도구는 가를 수 없으므로 표시를 남긴다
  assert.equal(one(fold([ask(T0 + M), hook('PostToolUse', T0 + M)]), T0 + 2 * M).status, 'asked');
  // 다음 차례가 시작된 뒤 늦게 닿은 옛 Stop은 일하는 중을 끝내지 않는다
  assert.equal(one(fold([hook('PostToolUse', T0), hook('PostToolUse', T0 + 5 * M), hook('Stop', T0 + 3 * M)]), T0 + 6 * M).status, 'working');
});

test('the approval sentence says just now under a minute and hours after an hour', () => {
  const st = fold([hook('PostToolUse', T0), ask(T0 + M)]);
  assert.equal(one(st, T0 + M + 59 * S).say, '방금 승인을 물었습니다');
  assert.equal(one(st, T0 + 2 * M).say, '1분 전에 승인을 물었습니다');
  assert.equal(one(st, T0 + M + 59 * M).say, '59분 전에 승인을 물었습니다');
  assert.equal(one(st, T0 + M + 2 * H + 30 * M).say, '2시간 전에 승인을 물었습니다');
});

test('no news starts at 12 minutes and only when both hooks and records are quiet', () => {
  const st = fold([hook('PostToolUse', T0)]);
  assert.equal(one(st, T0 + 12 * M - 1).status, 'working');
  assert.deepEqual(shape(one(st, T0 + 12 * M)), ['silent', '12분째 소식이 없습니다', true]);
  // 긴 명령 하나를 도는 동안 기록(도우미 것까지)이 바뀌면 소식이 있는 것이다
  const moving = officeReduce(st, rec(T0 + 10 * M));
  assert.equal(one(moving, T0 + 21 * M).status, 'working');
  assert.deepEqual(shape(one(moving, T0 + 22 * M)), ['silent', '12분째 소식이 없습니다', true]);
});

test('the done mark gets an alert only when the turn took more than two minutes', () => {
  const turn = len => fold([hook('SessionStart', T0 - 10 * M), hook('PostToolUse', T0), hook('Stop', T0 + len)]);
  assert.deepEqual(shape(one(turn(2 * M), T0 + 3 * M)), ['done', '끝냄', false]);
  assert.deepEqual(shape(one(turn(2 * M + 1), T0 + 3 * M)), ['done', '끝냄', true]);
  // 다음 차례는 앞 Stop 뒤의 첫 소식부터 센다
  const second = fold([hook('PostToolUse', T0), hook('Stop', T0 + 5 * M), hook('PostToolUse', T0 + 20 * M), hook('Stop', T0 + 21 * M)]);
  assert.deepEqual(shape(one(second, T0 + 22 * M)), ['done', '끝냄', false]);
  // 입력을 기다리는 SessionStart와 idle_prompt는 차례의 첫 소식이 아니다
  const waited = fold([hook('SessionStart', T0), idle(T0 + M), hook('PostToolUse', T0 + 10 * M), hook('Stop', T0 + 11 * M)]);
  assert.equal(one(waited, T0 + 12 * M).alert, false);
  // 차례의 첫 소식이 승인 물음이어도 그때부터 센다
  assert.equal(one(fold([ask(T0), hook('PostToolUse', T0 + M), hook('Stop', T0 + 3 * M)]), T0 + 4 * M).alert, true);
});

test('a record change within 10 seconds after Stop is not a new turn', () => {
  const base = [hook('PostToolUse', T0), hook('Stop', T0 + 5 * M)];
  const now = T0 + 5 * M + 20 * S;
  assert.equal(one(fold([...base, rec(T0 + 5 * M + 10 * S)]), now).status, 'done');
  assert.deepEqual(shape(one(fold([...base, rec(T0 + 5 * M + 10 * S + 1)]), now)), ['working', '일하는 중', false]);
  // 마무리 기록은 다음 차례의 시계를 켜지 않는다. 10초 뒤의 기록은 켠다
  const tail = r => fold([...base, rec(r), hook('PostToolUse', T0 + 20 * M), hook('Stop', T0 + 21 * M)]);
  assert.equal(one(tail(T0 + 5 * M + 5 * S), T0 + 22 * M).alert, false);
  assert.equal(one(tail(T0 + 5 * M + 11 * S), T0 + 22 * M).alert, true);
});

test('after Stop a record-only new turn past 90 seconds says only that the record is quiet', () => {
  const st = fold([hook('PostToolUse', T0), hook('Stop', T0 + 5 * M), rec(T0 + 6 * M)]);
  assert.equal(one(st, T0 + 6 * M + 90 * S - 1).status, 'working');
  assert.deepEqual(shape(one(st, T0 + 10 * M)), ['quiet', '4분째 조용합니다', false]);
});

test('done stays ahead of a following idle prompt until the department is seen', () => {
  let st = fold([hook('PostToolUse', T0), hook('Stop', T0 + 3 * M), idle(T0 + 4 * M)]);
  assert.deepEqual(shape(one(st, T0 + 5 * M)), ['done', '끝냄', true]);
  st = officeReduce(st, { kind: 'seen', departmentId: null, at: T0 + 6 * M });
  assert.deepEqual(shape(one(st, T0 + 7 * M)), ['resting', '쉬는 중', false]);
  st = officeReduce(st, idle(T0 + 8 * M));
  assert.equal(one(st, T0 + 9 * M).status, 'resting');
});

test('seen clears done only in that department and only for turns finished by then', () => {
  const departments = [{ id: 'dev', name: '개발부', folder: 'C:\\dev' }];
  const ctx = { departments, assignments: {} };
  let st = fold([
    hook('PostToolUse', T0, { sessionId: 'd1', cwd: 'C:\\dev\\api' }), hook('Stop', T0 + 3 * M, { sessionId: 'd1', cwd: 'C:\\dev\\api' }),
    hook('PostToolUse', T0, { sessionId: 'l1' }), hook('Stop', T0 + 3 * M, { sessionId: 'l1' }),
  ], ctx);
  st = officeReduce(st, { kind: 'seen', departmentId: 'dev', at: T0 + 4 * M }, ctx);
  const byId = Object.fromEntries(officeSessions(st, T0 + 5 * M, ctx).map(v => [v.id, v.status]));
  assert.deepEqual(byId, { d1: 'resting', l1: 'done' });
  st = fold([hook('PostToolUse', T0 + 6 * M, { sessionId: 'd1', cwd: 'C:\\dev\\api' }), hook('Stop', T0 + 9 * M, { sessionId: 'd1', cwd: 'C:\\dev\\api' })], ctx, st);
  assert.deepEqual(shape(officeSessions(st, T0 + 10 * M, ctx).find(v => v.id === 'd1')), ['done', '끝냄', true]);
});

test('SessionEnd drops the session, late news does not revive it, new news does', () => {
  const st = fold([hook('PostToolUse', T0), hook('SubagentStart', T0 + S, { agentId: 'x' }), hook('SessionEnd', T0 + M)]);
  assert.deepEqual(officeSessions(st, T0 + M + S), []);
  assert.deepEqual(officeSessions(officeReduce(st, rec(T0 + M + 10 * S)), T0 + M + 20 * S), []);
  assert.deepEqual(officeSessions(officeReduce(st, hook('PostToolUse', T0 + 30 * S)), T0 + M + 20 * S), []);
  const back = one(officeReduce(st, hook('PostToolUse', T0 + 2 * M)), T0 + 2 * M + S);
  assert.deepEqual([back.status, back.subagents], ['working', 0]);
});

test('a hooked session quiet for 30 minutes is dropped and comes back on news', () => {
  const st = fold([hook('PostToolUse', T0), rec(T0 + M)]);
  assert.equal(one(st, T0 + 31 * M - 1).status, 'silent');
  assert.equal(one(st, T0 + 31 * M), null);
  // 기록이 바뀌는 동안에는 훅이 조용해도 내리지 않는다
  assert.equal(one(officeReduce(st, rec(T0 + 25 * M)), T0 + 40 * M).status, 'silent');
  const back = one(officeReduce(st, hook('PostToolUse', T0 + 41 * M)), T0 + 41 * M + S);
  assert.deepEqual(shape(back), ['working', '일하는 중', false]);
});

test('a session that asked for approval stays up to 12 hours, then comes back fresh', () => {
  const st = fold([hook('PostToolUse', T0), ask(T0 + M)]);
  assert.deepEqual(shape(one(st, T0 + M + 12 * H - 1)), ['asked', '11시간 전에 승인을 물었습니다', true]);
  assert.equal(one(st, T0 + M + 12 * H), null);
  // 12시간 뒤에 기록만 바뀌면 옛 물음을 끌고 오지 않고 훅 소식이 없는 세션으로 선다
  const back = one(officeReduce(st, rec(T0 + 13 * H)), T0 + 13 * H + S);
  assert.deepEqual([back.status, back.hooked, back.alert, back.note], ['working', false, false, '승인 물음은 모릅니다']);
});

test('a session without hook news says working within 90 seconds, quiet up to 30 minutes, then is not shown', () => {
  const st = fold([rec(T0)]);
  const v = one(st, T0 + 90 * S - 1);
  assert.deepEqual([...shape(v), v.hooked, v.note, v.activity], ['working', '일하는 중', false, false, '승인 물음은 모릅니다', 'shop']);
  assert.deepEqual(shape(one(st, T0 + 90 * S)), ['quiet', '1분째 조용합니다', false]);
  assert.deepEqual(shape(one(st, T0 + 30 * M - 1)), ['quiet', '29분째 조용합니다', false]);
  assert.equal(one(st, T0 + 30 * M), null);
  // 도우미 기록까지 본 늦은 때가 이기고, 옛 때가 늦게 닿아도 되돌리지 않는다
  assert.equal(one(fold([rec(T0), rec(T0 + 5 * M), rec(T0 + M)]), T0 + 5 * M + 30 * S).status, 'working');
});

test('a session without hook news never says approval or done and never gets an alert', () => {
  const st = fold([rec(T0, { sessionId: 'cx', tool: 'codex', cwd: 'D:\\apps\\pay' })]);
  for (let t = T0; t < T0 + 30 * M; t += 30 * S) {
    const v = one(st, t);
    assert.ok(['working', 'quiet'].includes(v.status), String(t - T0));
    assert.equal(v.alert, false);
    assert.equal(v.note, '승인 물음은 모릅니다');
  }
  assert.deepEqual([one(st, T0).tool, one(st, T0).activity], ['codex', 'pay']);
});

test('hooks turned on mid-session take over from the first hook and do not count earlier work', () => {
  let st = fold([rec(T0), rec(T0 + 4 * M)]);
  assert.equal(one(st, T0 + 4 * M + 10 * S).hooked, false);
  st = officeReduce(st, hook('PostToolUse', T0 + 5 * M, { toolName: 'Edit', toolDetail: 'cart.ts' }));
  const v = one(st, T0 + 5 * M + S);
  assert.deepEqual([v.hooked, v.note, v.activity], [true, '', 'shop · 쓰기 · cart.ts']);
  // 기록은 9시부터 바뀌었지만 첫 훅부터 Stop까지는 1분이다
  st = officeReduce(st, hook('Stop', T0 + 6 * M));
  assert.deepEqual(shape(one(st, T0 + 7 * M)), ['done', '끝냄', false]);
  // 첫 훅이 Stop이면 그 차례의 길이를 모르므로 느낌표를 붙이지 않는다
  assert.equal(one(fold([rec(T0), rec(T0 + 9 * M), hook('Stop', T0 + 10 * M)]), T0 + 11 * M).alert, false);
});

test('record scan and hooks for the same session are one staff member', () => {
  const st = fold([rec(T0, { sessionId: 'x' }), hook('PostToolUse', T0 + 10 * S, { sessionId: 'x' }), rec(T0 + 20 * S, { sessionId: 'x' }), rec(T0, { sessionId: 'y' })]);
  const list = officeSessions(st, T0 + 30 * S);
  assert.deepEqual(list.map(v => [v.id, v.hooked]), [['x', true], ['y', false]]);
});

test('subagents are counted from start and stop and never go below zero', () => {
  const st = fold([hook('PostToolUse', T0),
    hook('SubagentStart', T0 + S, { agentId: 'a1' }), hook('SubagentStart', T0 + 2 * S, { agentId: 'a2' }),
    hook('SubagentStop', T0 + 3 * S, { agentId: 'a1' }), hook('SubagentStop', T0 + 4 * S, { agentId: 'a1' }), hook('SubagentStop', T0 + 5 * S, { agentId: 'zz' })]);
  assert.equal(one(st, T0 + 10 * S).subagents, 1);
  const anon = fold([hook('PostToolUse', T0), hook('SubagentStop', T0 + S), hook('SubagentStop', T0 + 2 * S), hook('SubagentStart', T0 + 3 * S)]);
  assert.equal(one(anon, T0 + 10 * S).subagents, 1);
  // 끝남이 시작보다 먼저 닿은 도우미는 세지 않는다
  assert.equal(one(fold([hook('PostToolUse', T0), hook('SubagentStop', T0 + S, { agentId: 'b' }), hook('SubagentStart', T0, { agentId: 'b' })]), T0 + 10 * S).subagents, 0);
});

test('the app own runs under AiSubscriptions\\run are ignored for hooks and records', () => {
  const roots = ['C:\\Users\\me\\AppData\\Roaming\\SYNK\\AiSubscriptions\\run', 'C:/Users/me/AppData/Roaming/synk-preview/aisubscriptions/RUN/', 'D:\\dev\\desktop\\.userdata\\AiSubscriptions\\run\\'];
  for (const cwd of roots) {
    assert.equal(officeIgnoredCwd(cwd), true, cwd);
    assert.deepEqual(officeSessions(fold([hook('PostToolUse', T0, { cwd }), rec(T0, { cwd, sessionId: 'r' })]), T0 + S), []);
  }
  for (const cwd of ['C:\\work\\AiSubscriptions\\runner', 'C:\\work\\MyAiSubscriptions\\run', 'C:\\work\\AiSubscriptions\\run\\inner', '', null]) assert.equal(officeIgnoredCwd(cwd), false, String(cwd));
  // 기록에서 작업 폴더를 못 읽은 세션도 훅이 그 폴더를 알려 주면 버리고, 그 뒤의 기록에도 서지 않는다
  let st = fold([rec(T0, { cwd: null })]);
  assert.equal(officeSessions(st, T0 + S).length, 1);
  st = fold([hook('SessionEnd', T0 + 2 * S, { cwd: roots[0] }), rec(T0 + M, { cwd: null })], {}, st);
  assert.deepEqual(officeSessions(st, T0 + M + S), []);
});

test('departments: manual choice first, then the deepest folder on a segment boundary, case and slash free', () => {
  const depts = [{ id: 'dev', name: '개발부', folder: 'C:\\work' }, { id: 'shop', name: '쇼핑', folder: 'C:\\work\\shop' }, { id: 'law', name: '법무부', folder: 'D:/Legal/' }];
  assert.equal(officeDepartmentOf({ cwd: 'C:\\work\\shop\\src' }, depts), 'shop');
  assert.equal(officeDepartmentOf({ cwd: 'C:\\work\\shop' }, depts), 'shop');
  assert.equal(officeDepartmentOf({ cwd: 'C:\\work\\shop2' }, depts), 'dev');
  assert.equal(officeDepartmentOf({ cwd: 'c:/WORK/Shop/' }, depts), 'shop');
  assert.equal(officeDepartmentOf({ cwd: 'd:\\legal\\계약' }, depts), 'law');
  assert.equal(officeDepartmentOf({ cwd: 'D:\\Legalese' }, depts), null);
  assert.equal(officeDepartmentOf({ cwd: 'E:\\x' }, depts), null);
  assert.equal(officeDepartmentOf({ cwd: null }, depts), null);
  assert.equal(officeDepartmentOf({ cwd: 'C:\\work' }, []), null);
  assert.equal(officeDepartmentOf({ sessionId: 's1', cwd: 'C:\\work\\shop' }, depts, { s1: 'law' }), 'law');
  assert.equal(officeDepartmentOf({ sessionId: 's1', cwd: null }, depts, { s1: 'law' }), 'law');
  assert.equal(officeDepartmentOf({ sessionId: 's1', cwd: 'C:\\work\\shop' }, depts, { s1: 'gone' }), 'shop');
  const st = fold([hook('PostToolUse', T0, { sessionId: 's1', cwd: 'C:\\work\\shop\\api' }), hook('PostToolUse', T0, { sessionId: 's2', cwd: 'F:\\misc' })]);
  const list = officeSessions(st, T0 + S, { departments: depts, assignments: {} });
  assert.deepEqual(list.map(v => [v.id, v.departmentId, v.departmentName, v.folder]), [['s1', 'shop', '쇼핑', 'api'], ['s2', null, null, 'misc']]);
});

test('row text is the folder name and the last tool in Korean verbs, without summaries', () => {
  const act = (name, detail) => officeActivity({ cwd: 'C:\\work\\shop\\', lastTool: { name, detail } });
  assert.equal(act('Read', 'auth.ts'), 'shop · 읽기 · auth.ts');
  assert.equal(act('Edit', 'a.ts'), 'shop · 쓰기 · a.ts');
  assert.equal(act('Write', 'b.md'), 'shop · 쓰기 · b.md');
  assert.equal(act('Bash', 'npm'), 'shop · 명령 · npm');
  assert.equal(act('mcp__drive__read', ''), 'shop · mcp__drive__read');
  assert.equal(officeActivity({ cwd: 'C:\\work\\shop' }), 'shop');
  assert.equal(officeActivity({}), '');
});

const ctxD = { departments: [{ id: 'law', name: '법무부', folder: 'C:\\law' }, { id: 'dev', name: '개발부', folder: 'C:\\dev' }, { id: 'acc', name: '회계팀', folder: 'C:\\acc' }], assignments: {} };
const at = (sessionId, cwd) => ({ sessionId, cwd });
const headOf = (events, now, opts) => officeHeadline(officeSessions(fold(events, ctxD), now, ctxD), opts);

test('headline: an approval question comes first with the right particle', () => {
  const h = headOf([ask(T0, at('l', 'C:\\law')), hook('PostToolUse', T0 + 2 * M, at('d1', 'C:\\dev')), hook('PostToolUse', T0 + 2 * M, at('d2', 'C:\\dev'))], T0 + 3 * M);
  assert.deepEqual([h.say, h.then, h.active, h.unknown], ['법무부가 3분 전에 승인을 물었습니다.', '그 밖에 둘이 일하고 있습니다.', 3, 0]);
  assert.equal(headOf([ask(T0, at('c', 'C:\\acc'))], T0 + 10 * S).say, '회계팀이 방금 승인을 물었습니다.');
  assert.deepEqual(Object.values(headOf([ask(T0, at('c', 'C:\\acc'))], T0 + 10 * S)).slice(0, 2), ['회계팀이 방금 승인을 물었습니다.', '다른 일은 없습니다.']);
  // 부서 없는 일은 작업 폴더 이름으로 말한다. 여럿이면 가장 먼저 물은 것을 말하고 나머지 수를 붙인다
  const two = headOf([ask(T0 + 2 * M, at('s', 'C:\\work\\shop')), ask(T0, at('l', 'C:\\law'))], T0 + 4 * M);
  assert.deepEqual([two.say, two.then], ['법무부가 4분 전에 승인을 물었습니다.', '하나가 더 승인을 물었습니다.']);
  assert.equal(headOf([ask(T0, at('s', 'C:\\work\\shop'))], T0 + M).say, 'shop 폴더의 일이 1분 전에 승인을 물었습니다.');
});

test('headline: working counts, no news, and over capacity', () => {
  const work = n => Array.from({ length: n }, (_, i) => hook('PostToolUse', T0, at('w' + i, 'C:\\dev')));
  assert.deepEqual(Object.values(headOf(work(3), T0 + M)).slice(0, 2), ['셋이 일하고 있습니다.', '']);
  assert.deepEqual(Object.values(headOf(work(3), T0 + 13 * M)).slice(0, 2), ['셋이 일하고 있습니다.', '개발부가 13분째 소식이 없습니다.']);
  const over = headOf(work(10), T0 + M, { cap: 8 });
  assert.deepEqual([over.say, over.active], ['여덟까지인데 지금 열이 일하고 있습니다.', 10]);
  assert.equal(headOf(work(8), T0 + M, { cap: 8 }).say, '여덟이 일하고 있습니다.');
  // 승인을 물은 직원도 수용 인원에 센다
  const withAsk = headOf([...work(8), ask(T0, at('l', 'C:\\law'))], T0 + M, { cap: 8 });
  assert.deepEqual([withAsk.say, withAsk.then], ['법무부가 1분 전에 승인을 물었습니다.', '여덟까지인데 지금 아홉이 일하고 있습니다.']);
});

test('headline: all resting only when every shown session is known to rest', () => {
  const rest = [hook('PostToolUse', T0, at('d', 'C:\\dev')), hook('Stop', T0 + M, at('d', 'C:\\dev')), hook('PostToolUse', T0, at('l', 'C:\\law')), idle(T0 + M, at('l', 'C:\\law'))];
  assert.deepEqual(Object.values(headOf(rest, T0 + 5 * M)).slice(0, 2), ['지금은 모두 쉬고 있습니다.', '']);
  const longDone = [hook('PostToolUse', T0, at('d', 'C:\\dev')), hook('Stop', T0 + 5 * M, at('d', 'C:\\dev'))];
  assert.deepEqual(Object.values(headOf(longDone, T0 + 6 * M)).slice(0, 2), ['지금은 모두 쉬고 있습니다.', '개발부가 일을 하나 끝냈습니다.']);
  assert.deepEqual(Object.values(headOf([], T0)).slice(0, 2), ['지금 이 PC에서 도는 일이 없습니다.', 'Claude Code나 Codex에서 일을 시작하면 여기에 섭니다.']);
});

test('headline: sessions without hook news, Codex included, are counted as unknown, never as fine', () => {
  const mixed = [rec(T0, at('u1', 'C:\\dev')), rec(T0, at('u2', 'C:\\dev')), hook('PostToolUse', T0, at('h', 'C:\\law'))];
  const h = headOf(mixed, T0 + 30 * S);
  assert.deepEqual([h.say, h.then, h.unknown], ['셋이 일하고 있습니다.', '둘은 승인 물음을 모릅니다.', 2]);
  // 쉬는 Claude 직원과 조용한 Codex 직원: 「모두 쉬고 있습니다」라고 하지 않는다
  const codex = [hook('PostToolUse', T0, at('h', 'C:\\law')), hook('Stop', T0 + 30 * S, at('h', 'C:\\law')), rec(T0, { ...at('cx', 'C:\\dev'), tool: 'codex' })];
  const c = headOf(codex, T0 + 5 * M);
  assert.deepEqual([c.say, c.then, c.unknown], ['지금 일하는 중으로 보이는 직원은 없습니다.', '하나는 승인 물음을 모릅니다.', 1]);
  // 승인을 물은 직원이 있어도 둘째 줄은 모르는 수를 말한다
  assert.equal(headOf([ask(T0, at('l', 'C:\\law')), rec(T0, { ...at('cx', 'C:\\dev'), tool: 'codex' })], T0 + M).then, '하나는 승인 물음을 모릅니다.');
  assert.equal(headOf([rec(T0, at('u1', 'C:\\dev')), rec(T0, at('u2', 'C:\\dev'))], T0 + 5 * M).then, '모두 승인 물음을 모릅니다.');
  assert.equal(headOf([rec(T0, at('u1', 'C:\\dev'))], T0 + 5 * M).then, '승인 물음은 모릅니다.');
  assert.equal(headOf([], T0, { hooksOn: false }).hint, '승인 물음은 설정에서 켜면 봅니다.');
  assert.equal(headOf([], T0, { hooksOn: true }).hint, '');
});

test('capacity: one per two cores, one per 4 GB, the smaller, at least one', () => {
  const pc = (cores, totalMemGb) => officeCapacity({ cores, totalMemGb }).pcCap;
  assert.deepEqual([pc(4, 8), pc(8, 16), pc(16, 32), pc(24, 64)], [2, 4, 8, 12]);
  // Windows가 알려 주는 값(GiB)은 이름값보다 조금 작다. 반올림해 셈한다
  assert.deepEqual([pc(24, 7.9), pc(24, 15.7), pc(24, 31.8), pc(24, 63.9)], [2, 4, 8, 12]);
  assert.equal(pc(24, 11.4), 2);
  assert.equal(pc(1, 64), 1);
  assert.equal(pc(24, 3), 1);
  assert.equal(pc(0, 0), 1);
  const none = officeCapacity({ cores: 16, totalMemGb: 32 });
  assert.deepEqual(none, { pcCap: 8, toolCaps: { claude: 8, codex: 8 }, cap: 8, source: 'auto', missing: ['claude', 'codex'], note: '구독 방에 계정을 이으면 남은 양도 봅니다.' });
});

test('capacity: subscription left at 50, 49, 20, 19 and 0 percent', () => {
  const cap = (claude, codex, cores = 16, mem = 32) => officeCapacity({ cores, totalMemGb: mem, subscriptions: { claude: { leftPercent: claude }, codex: { leftPercent: codex } } });
  const tc = (l) => cap(l, 100).toolCaps.claude;
  assert.deepEqual([tc(100), tc(50), tc(49), tc(20), tc(19), tc(0.5), tc(0)], [8, 8, 4, 4, 1, 1, 0]);
  assert.equal(cap(49, 49, 6, 16).toolCaps.claude, 2); // PC 한도 셋의 절반을 올린다
  assert.deepEqual([cap(49, 0).cap, cap(19, 0).cap, cap(0, 19).cap, cap(0, 0).cap, cap(49, 49).cap, cap(100, 0).cap], [4, 1, 1, 1, 8, 8]);
  assert.deepEqual([cap(49, 0).missing, cap(49, 0).note], [[], '']);
  // 구독 값이 없는 도구는 PC 한도만 쓴다
  const half = officeCapacity({ cores: 16, totalMemGb: 32, subscriptions: { claude: { leftPercent: 0 } } });
  assert.deepEqual([half.toolCaps, half.cap, half.missing], [{ claude: 0, codex: 8 }, 8, ['codex']]);
  assert.deepEqual(officeCapacity({ cores: 16, totalMemGb: 32, subscriptions: { codex: { leftPercent: null } } }).missing, ['claude', 'codex']);
});

test('capacity: a number the user set wins when it is between one and the core count', () => {
  const run = manual => officeCapacity({ cores: 16, totalMemGb: 32, subscriptions: { claude: { leftPercent: 10 }, codex: { leftPercent: 10 } }, manual });
  assert.deepEqual([run(3).cap, run(3).source], [3, 'manual']);
  assert.deepEqual([run(16).cap, run(1).cap], [16, 1]);
  for (const bad of [0, 17, 2.5, null, '', 'x']) assert.deepEqual([run(bad).cap, run(bad).source], [2, 'auto'], String(bad));
  assert.deepEqual([officeSeats(1), officeSeats(3), officeSeats(4), officeSeats(8), officeSeats(12), officeSeats(0)], [1, 1, 2, 3, 3, 1]);
});

test('number words follow the mock-up', () => {
  assert.deepEqual([1, 2, 3, 8, 10, 11, 12, 20, 24, 99, 100].map(countWord), ['하나', '둘', '셋', '여덟', '열', '열하나', '열둘', '스물', '스물넷', '아흔아홉', '100명']);
});

test('reset drops everything, prune keeps ended sessions long enough, the reducer never mutates its input', () => {
  const st = fold([hook('PostToolUse', T0), rec(T0 + 30 * S), hook('PostToolUse', T0, { sessionId: 'r', cwd: 'C:\\x\\AiSubscriptions\\run' })]);
  const copy = structuredClone(st);
  officeReduce(st, hook('Stop', T0 + M));
  officeReduce(st, { kind: 'seen', departmentId: null, at: T0 + 2 * M });
  assert.deepEqual(st, copy);
  assert.deepEqual(officeReduce(st, { kind: 'reset' }), officeState());
  // 꺼진 세션은 30분 동안 남아, 기록 살피기가 옛 고친 때를 다시 보내도 서지 않는다
  const ended = officeReduce(st, hook('SessionEnd', T0 + M));
  const kept = officePrune(ended, T0 + 20 * M);
  assert.ok(Object.hasOwn(kept.sessions, 'a'));
  assert.deepEqual(officeSessions(officeReduce(kept, rec(T0 + 30 * S)), T0 + 20 * M), []);
  const gone = officePrune(ended, T0 + 31 * M);
  assert.deepEqual(Object.keys(gone.sessions), []);
  assert.ok(Object.hasOwn(gone.ignored, 'r'));
  assert.deepEqual(Object.keys(officePrune(ended, T0 + 12 * H).ignored), []);
  // 모르는 사건, 번호 없는 소식, 때가 없는 소식은 버린다
  for (const e of [hook('PreToolUse', T0), hook('PostToolUse', T0, { sessionId: '' }), hook('PostToolUse', NaN), { kind: 'other' }, null]) assert.equal(officeReduce(st, e), st);
});

test('the time limits are the design values', () => {
  assert.deepEqual({ ...OFFICE_TIMES }, { recordWork: 90 * S, silent: 12 * M, longTurn: 2 * M, stopGrace: 10 * S, drop: 30 * M, askKeep: 12 * H });
});
