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

test('4.5 · the last record line: a finished turn is quiet at once, counted from that line, and a later non-turn touch does not make it look busy', () => {
  // 차례가 끝난 기록은 고친 지 10초여도 조용하다(90초 늦음을 없앰). 분은 끝 줄의 때부터 센다
  const ended = fold([rec(T0 + 10 * M, { turn: 'ended', turnAt: T0 + 2 * M })]);
  assert.deepEqual(shape(one(ended, T0 + 10 * M + 10 * S)), ['quiet', '8분째 조용합니다', false]);
  assert.equal(one(ended, T0 + 40 * M), null, 'dropping still follows the last change of the file');
  // 끝 줄의 때가 고친 때보다 늦게 적혀 있으면(시계가 어긋남) 고친 때부터 센다
  assert.deepEqual(shape(one(fold([rec(T0, { turn: 'ended', turnAt: T0 + 5 * M })]), T0 + 3 * M)), ['quiet', '3분째 조용합니다', false]);
  // 손님의 답을 기다리는 세션도 일하는 중이라고 하지 않는다
  assert.deepEqual(shape(one(fold([rec(T0, { turn: 'waiting', turnAt: T0 })]), T0 + 20 * S)), ['quiet', '1분째 조용합니다', false]);
});

test('4.5 · a turn still running is working while a long command runs, up to 12 minutes of an unchanged record', () => {
  const st = fold([rec(T0, { turn: 'working', turnAt: T0 })]);
  assert.deepEqual(shape(one(st, T0 + 5 * M)), ['working', '일하는 중', false]);
  assert.deepEqual(shape(one(st, T0 + OFFICE_TIMES.recordBusy - 1)), ['working', '일하는 중', false]);
  assert.deepEqual(shape(one(st, T0 + OFFICE_TIMES.recordBusy)), ['quiet', '12분째 조용합니다', false]);
  assert.equal(one(st, T0 + 30 * M), null);
  assert.equal(OFFICE_TIMES.recordBusy, 12 * M);
});

test('4.5 · a finished turn whose helper record changed within 90 seconds is working; an unknown line keeps the 90-second rule', () => {
  const helper = fold([rec(T0 + M, { turn: 'ended', turnAt: T0, helperAt: T0 + M })]);
  assert.deepEqual(shape(one(helper, T0 + M + 89 * S)), ['working', '일하는 중', false]);
  assert.deepEqual(shape(one(helper, T0 + M + 90 * S)), ['quiet', '2분째 조용합니다', false]);
  for (const turn of [null, undefined, 'busy', 7]) {
    const st = fold([rec(T0, { turn })]);
    assert.deepEqual(shape(one(st, T0 + 89 * S)), ['working', '일하는 중', false], String(turn));
    assert.deepEqual(shape(one(st, T0 + 90 * S)), ['quiet', '1분째 조용합니다', false], String(turn));
  }
});

test('4.5 · the scan that arrives last decides the line kind: scans come one at a time and in order (office.cjs)', () => {
  let st = fold([rec(T0 + 5 * M, { turn: 'working', turnAt: T0 + 5 * M }), rec(T0 + 5 * M, { turn: 'ended', turnAt: T0 + 5 * M })]);
  assert.deepEqual(shape(one(st, T0 + 5 * M + 10 * S)), ['quiet', '1분째 조용합니다', false]);
  st = officeReduce(st, rec(T0 + 5 * M, { turn: 'working', turnAt: T0 + 5 * M }));
  assert.deepEqual(shape(one(st, T0 + 7 * M)), ['working', '일하는 중', false]);
  // 받은 갈래는 상태에만 남고, 화면의 줄에는 실리지 않는다
  assert.deepEqual(Object.keys(one(st, T0 + 7 * M)).filter(k => /turn|helper/i.test(k)), []);
});

test('설계 검토 solio-office-turn 고칠 것 1: a known line kind is timed from that line, so a non-turn line touching an old record neither wakes a cut turn nor shows a turn ended days ago', () => {
  const D = 24 * H, now = T0 + 3 * D;
  // 3일 전에 끊긴 차례(끝 줄이 도구 호출)에 지금 차례 밖의 줄이 붙었다
  assert.equal(one(fold([rec(now - 5 * S, { turn: 'working', turnAt: T0 })]), now), null);
  // 3일 전에 끝난 차례도 「4320분째 조용합니다」로 서지 않는다
  assert.equal(one(fold([rec(now - 5 * S, { turn: 'ended', turnAt: T0 })]), now), null);
  assert.equal(one(fold([rec(now - 5 * S, { turn: 'waiting', turnAt: T0 })]), now), null);
  // 차례 중: 끝 줄로부터 12분 안은 일하는 중, 30분까지는 조용, 그 뒤는 세우지 않는다(고친 때가 그 뒤여도)
  const cut = fold([rec(T0 + 20 * M, { turn: 'working', turnAt: T0 })]);
  assert.deepEqual(shape(one(cut, T0 + 20 * M + S)), ['quiet', '20분째 조용합니다', false]);
  assert.equal(one(cut, T0 + 30 * M), null);
  // 도우미가 더 늦게 적었으면 그때부터 잰다
  const helped = fold([rec(T0 + 15 * M, { turn: 'working', turnAt: T0, helperAt: T0 + 15 * M })]);
  assert.deepEqual(shape(one(helped, T0 + 26 * M)), ['working', '일하는 중', false]);
  assert.deepEqual(shape(one(helped, T0 + 28 * M)), ['quiet', '13분째 조용합니다', false]);
  // 끝 줄의 때가 없으면 고친 때로 잰다
  assert.deepEqual(shape(one(fold([rec(T0, { turn: 'working', turnAt: null })]), T0 + 11 * M)), ['working', '일하는 중', false]);
});

test('GPT 검수 solio-office-turn GA2 · GA3 · -r2 GA2: a helper counts only when it wrote after the turn ended, and the scan that arrives last wins', () => {
  // 도우미가 9초 전에 적고 본 차례가 5초 전에 끝났다: 도우미의 결과를 본 차례가 끝냈으니 조용하다
  const before = fold([rec(T0 + 55 * S, { turn: 'ended', turnAt: T0 + 55 * S, helperAt: T0 + 51 * S })]);
  assert.deepEqual(shape(one(before, T0 + M)), ['quiet', '1분째 조용합니다', false]);
  // 본 차례가 끝난 뒤에 도우미가 적었으면(뒤에서 도는 도우미) 일하는 중이다
  const after = fold([rec(T0 + 55 * S, { turn: 'ended', turnAt: T0 + 50 * S, helperAt: T0 + 55 * S })]);
  assert.deepEqual(shape(one(after, T0 + M)), ['working', '일하는 중', false]);
  // 도우미 파일이 지워져 고친 때가 앞으로 돌아간 새 살피기도 살핀 때가 늦으면 이긴다
  let st = fold([rec(T0 + 2 * M, { turn: 'ended', turnAt: T0, helperAt: T0 + 2 * M, seenAt: T0 + 2 * M })]);
  assert.deepEqual(shape(one(st, T0 + 2 * M + 10 * S)), ['working', '일하는 중', false]);
  st = officeReduce(st, rec(T0, { turn: 'ended', turnAt: T0, helperAt: null, seenAt: T0 + 2 * M + 15 * S }));
  assert.deepEqual(shape(one(st, T0 + 2 * M + 20 * S)), ['quiet', '2분째 조용합니다', false]);
  // 시계를 뒤로 돌려 살핀 때가 앞선 살피기보다 일러도, 마지막으로 닿은 살피기가 이긴다(-r2 GA2)
  st = officeReduce(st, rec(T0 + 2 * M + 20 * S, { turn: 'working', turnAt: T0 + 2 * M + 20 * S, seenAt: T0 + M }));
  assert.deepEqual(shape(one(st, T0 + 2 * M + 25 * S)), ['working', '일하는 중', false]);
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
  assert.deepEqual(none, { pcCap: 8, toolCaps: { claude: 8, codex: 8 }, cap: 8, source: 'auto', memKnown: true, missing: ['claude', 'codex'], note: '구독 방에 계정을 이으면 남은 양도 봅니다.' });
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
  // 메모리를 못 읽으면 PC 한도는 하나다. 직접 정한 수가 있으면 도구별 수도 그 수에서 센다(P2 묶음 GA1, 검수 solio-office-ga1-20261122 F2)
  for (const totalMemGb of [null, '', undefined]) {
    const mine = officeCapacity({ cores: 8, totalMemGb, manual: 4 }), auto = officeCapacity({ cores: 8, totalMemGb });
    assert.deepEqual([mine.memKnown, mine.pcCap, mine.cap, mine.toolCaps.claude, mine.toolCaps.codex], [false, 1, 4, 4, 4], String(totalMemGb));
    assert.deepEqual([auto.pcCap, auto.cap, auto.source], [1, 1, 'auto'], String(totalMemGb));
  }
  assert.equal(officeCapacity({ cores: 8, totalMemGb: 0 }).memKnown, true, '0 GB that was read is a reading, not unknown');
  // 메모리를 읽은 PC에서도 직접 정한 수가 PC 한도를 대신한다: 8코어 4GB(PC 한도 하나)에서 넷으로 정하면 도구별 수도 넷이다(설계 검토 solio-office-model-20261122 고칠 것 1)
  const small = officeCapacity({ cores: 8, totalMemGb: 4, manual: 4 });
  assert.deepEqual([small.pcCap, small.cap, small.toolCaps.claude, small.toolCaps.codex], [1, 4, 4, 4]);
  const halfLeft = officeCapacity({ cores: 8, totalMemGb: 4, manual: 4, subscriptions: { claude: { leftPercent: 30 }, codex: { leftPercent: 10 } } });
  assert.deepEqual([halfLeft.toolCaps.claude, halfLeft.toolCaps.codex], [2, 1], 'the subscription rule still applies on top of the hand-set number');
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
  assert.deepEqual({ ...OFFICE_TIMES }, { recordWork: 90 * S, recordBusy: 12 * M, silent: 12 * M, longTurn: 2 * M, stopGrace: 10 * S, drop: 30 * M, askKeep: 12 * H });
});

/* ── GPT 검수(solio-office-be-20261120) ── */
test('GA10: a SessionEnd folded after newer news of the same session does not hide it; folded in time order it shows the same', () => {
  const late = fold([hook('PostToolUse', T0 + 11 * S), hook('SessionEnd', T0 + 10 * S)]);
  const inOrder = fold([hook('SessionEnd', T0 + 10 * S), hook('PostToolUse', T0 + 11 * S)]);
  assert.deepEqual(shape(one(inOrder, T0 + 12 * S)), ['working', '일하는 중', false]);
  assert.deepEqual(shape(one(late, T0 + 12 * S)), ['working', '일하는 중', false], 'the late end does not take the working staff away');
  // 끝 뒤 10초 안의 기록은 그 끝의 마무리라 새 소식으로 세지 않는다. 그런 기록 뒤에 늦게 닿은 끝은 세션을 내린다
  const tail = fold([hook('PostToolUse', T0), rec(T0 + 15 * S), hook('SessionEnd', T0 + 10 * S)]);
  assert.deepEqual(officeSessions(tail, T0 + 20 * S), []);
  // 늦게 닿은 끝도 그 앞의 승인 물음은 푼다
  const asked = fold([ask(T0), hook('SubagentStart', T0 + 20 * S, { agentId: 'x' }), hook('SessionEnd', T0 + 10 * S)]);
  assert.notEqual(one(asked, T0 + 30 * S)?.status, 'asked');
});

test('GA11: news before an idle prompt belongs to the earlier wait, so a quick new turn after it gets no done alert', () => {
  const st = fold([hook('PostToolUse', T0), hook('Stop', T0 + 20 * S), rec(T0 + 32 * S), idle(T0 + 80 * S), hook('PostToolUse', T0 + 200 * S), hook('Stop', T0 + 201 * S)]);
  assert.deepEqual(shape(one(st, T0 + 202 * S)), ['done', '끝냄', false], 'the turn took one second');
  // 그 차례가 정말 길었으면 느낌표가 붙는다
  const long = fold([hook('PostToolUse', T0), hook('Stop', T0 + 20 * S), rec(T0 + 32 * S), idle(T0 + 80 * S), hook('PostToolUse', T0 + 200 * S), hook('Stop', T0 + 200 * S + 2 * M + S)]);
  assert.equal(one(long, T0 + 6 * M).alert, true);
  // 대기 알림이 늦게 닿아도 앞 대기의 소식으로 새 차례를 길게 세지 않는다
  const lateIdle = fold([hook('PostToolUse', T0), hook('Stop', T0 + 20 * S), rec(T0 + 32 * S), hook('PostToolUse', T0 + 200 * S), idle(T0 + 80 * S), hook('Stop', T0 + 201 * S)]);
  assert.equal(one(lateIdle, T0 + 202 * S).alert, false);
});

/* ── 설계 검토 2026-11-21 (마): 끝의 때보다 이른 칸을 지우는 함수 하나(dropUpTo)와 접는 순서 섞기 ── */
// 정해진 씨앗의 의사 난수(mulberry32). 걸리면 메시지의 순서로 그대로 다시 본다
const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (list, rand) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const timeOf = e => (e.kind === 'record' ? e.changedAt : e.at);
const inTime = list => list.slice().sort((a, b) => timeOf(a) - timeOf(b));
const orderText = list => list.map(e => (e.event || e.kind) + (e.agentId ? ':' + e.agentId : '') + '@' + (timeOf(e) - T0) / S + 's').join(' ');
// 세션의 핵심 칸. 번호 있는 도우미는 지금 도는 것만 본다. 끝난 도우미(false)는 늦게 닿은 시작을 다시 세지 않으려고 남기 때문이다
const coreOf = s => s && {
  endedAt: s.endedAt, lastEndAt: s.lastEndAt, hooked: s.hooked, tool: s.tool, cwd: s.cwd, model: s.model,
  lastHookAt: s.lastHookAt, lastRecordAt: s.lastRecordAt,
  postAt: s.postAt, askAt: s.askAt, clearAt: s.clearAt, idleAt: s.idleAt, stopAt: s.stopAt, doneLong: s.doneLong, seenAt: s.seenAt,
  lastTool: s.lastTool, lastToolAt: s.lastToolAt,
  running: Object.entries(s.agents).filter(([, v]) => typeof v === 'number').sort(), anonAgents: s.anonAgents,
};
// 「처음」 칸은 끝이 늦게 닿으면 남은 칸 가운데 가장 이른 때로 다시 잡는다. 시각 순서의 값보다 이르지 않아야 한다(차례 시작은 모름도 된다)
const FIRSTS = ['firstAt', 'hookedAt', 'turnStartAt'];
const notEarlier = (got, want, k) => got[k] === want[k] || (got[k] == null ? k === 'turnStartAt' : want[k] != null && got[k] > want[k]);

const END = T0 + 4 * M;
const beforeEnd = [ // 4분의 끝과 그 앞의 소식. 언제 닿든 끝이 모두 지운다
  hook('SessionStart', T0, { model: 'claude-fable-5-2' }),
  hook('PostToolUse', T0 + 10 * S, { toolName: 'Read', toolDetail: 'auth.ts' }),
  hook('SubagentStart', T0 + 20 * S, { agentId: 'x' }),
  hook('SubagentStart', T0 + 25 * S), // 번호 없는 도우미
  ask(T0 + 30 * S),
  rec(T0 + 40 * S),
  hook('PostToolUse', T0 + 50 * S, { agentId: 'x', toolName: 'Grep', toolDetail: 'cart' }),
  hook('Stop', T0 + 3 * M), // 2분 넘은 차례. 시각 순서로는 느낌표가 붙었다가 끝에 지워진다
  idle(T0 + 3 * M + 20 * S),
  hook('SessionEnd', END),
  rec(END + 5 * S), // 끝의 마무리 기록
];
const after5 = sec => T0 + 5 * M + sec * S;
const BUNDLES = {
  'ended for good': { events: beforeEnd, now: END + M, want: null },
  'resumed and working': {
    events: [...beforeEnd, hook('SessionStart', after5(0), { model: 'claude-opus-5-5' }), hook('PostToolUse', after5(10), { toolName: 'Bash', toolDetail: 'npm' }), hook('SubagentStart', after5(20), { agentId: 'y' }), rec(after5(30))],
    now: after5(40), want: ['working', false, 1, 'shop · 명령 · npm', 'claude-opus-5-5'],
  },
  'resumed and asked': {
    events: [...beforeEnd, hook('PostToolUse', after5(10), { toolName: 'Edit', toolDetail: 'cart.ts' }), ask(after5(20))],
    now: T0 + 6 * M, want: ['asked', true, 0, 'shop · 쓰기 · cart.ts', null],
  },
  'resumed and done again (a short turn)': {
    events: [...beforeEnd, hook('PostToolUse', after5(10), { toolName: 'Edit', toolDetail: 'cart.ts' }), hook('Stop', T0 + 6 * M)],
    now: T0 + 6 * M + 30 * S, want: ['done', false, 0, 'shop · 쓰기 · cart.ts', null],
  },
  'resumed by a record only': { events: [...beforeEnd, rec(after5(0))], now: after5(30), want: ['working', false, 0, 'shop', null] },
  'ended twice': {
    events: [...beforeEnd, hook('PostToolUse', after5(0), { toolName: 'Read' }), hook('SubagentStart', after5(10), { agentId: 'y' }), ask(after5(20)), hook('SessionEnd', T0 + 6 * M), hook('PostToolUse', T0 + 7 * M, { toolName: 'Grep', toolDetail: 'auth' })],
    now: T0 + 7 * M + 10 * S, want: ['working', false, 0, 'shop · 찾기 · auth', null],
  },
  // 아래 셋은 끝 뒤의 첫 소식이 같은 칸의 늦은 소식에 덮일 수 있어 「처음」 칸이 늦게 잡히는 묶음이다
  'resumed with two tools': {
    events: [...beforeEnd, hook('PostToolUse', after5(10), { toolName: 'Bash', toolDetail: 'npm' }), hook('PostToolUse', after5(15), { toolName: 'Edit', toolDetail: 'cart.ts' }), rec(after5(30))],
    now: after5(40), want: ['working', false, 0, 'shop · 쓰기 · cart.ts', null],
  },
  'a tool within 10 seconds after the end': {
    events: [...beforeEnd, hook('PostToolUse', END + 3 * S, { toolName: 'Read', toolDetail: 'a.ts' }), hook('PostToolUse', after5(0), { toolName: 'Bash', toolDetail: 'npm' })],
    now: after5(10), want: ['working', false, 0, 'shop · 명령 · npm', null],
  },
  'resumed, done, waiting, then a new turn': {
    events: [...beforeEnd, hook('PostToolUse', after5(0)), hook('Stop', after5(30)), idle(after5(40)), hook('PostToolUse', T0 + 7 * M)],
    now: T0 + 7 * M + 10 * S, want: ['working', false, 0, 'shop', null],
  },
};

test('설계 검토 (마): the same news folded in any order gives the staff line and core fields of the time-order fold', () => {
  Object.entries(BUNDLES).forEach(([name, { events, now, want }], k) => {
    const timed = fold(inTime(events));
    const view = officeSessions(timed, now);
    const v = view[0] ?? null;
    assert.deepEqual(v && [v.status, v.alert, v.subagents, v.activity, v.model], want, name + ': the time-order fold');
    const core = coreOf(timed.sessions.a);
    const ends = events.filter(e => e.event === 'SessionEnd');
    const orders = [[...inTime(events).filter(e => !ends.includes(e)), ...ends], inTime(events).reverse()]; // 끝만 맨 뒤, 거꾸로
    const rand = seeded(20261121 + k);
    for (let i = 0; i < 40; i++) orders.push(shuffle(events, rand));
    for (const order of orders) {
      const got = fold(order), at = name + ' / ' + orderText(order);
      assert.deepEqual(officeSessions(got, now), view, at);
      assert.deepEqual(coreOf(got.sessions.a), core, at);
      for (const f of FIRSTS) assert.ok(notEarlier(got.sessions.a, timed.sessions.a, f), f + ' ' + at);
    }
  });
});

test('be3 GA11: a helper started before the end, a tool after the resume, then the late end leaves no helper, approval or done mark', () => {
  const early = [hook('SessionStart', T0), hook('PostToolUse', T0 + 10 * S, { toolName: 'Read', toolDetail: 'a.ts' }), hook('SubagentStart', T0 + 20 * S, { agentId: 'x' }), hook('SubagentStart', T0 + 25 * S), ask(T0 + 30 * S), hook('Stop', T0 + 3 * M)];
  const end = hook('SessionEnd', END), resumed = hook('PostToolUse', T0 + 5 * M, { toolName: 'Bash', toolDetail: 'npm' });
  const late = fold([...early, resumed, end]);
  const inOrder = fold([...early, end, resumed]);
  const v = one(late, T0 + 5 * M + S);
  assert.deepEqual([v.status, v.alert, v.subagents, v.activity], ['working', false, 0, 'shop · 명령 · npm']);
  assert.deepEqual(v, one(inOrder, T0 + 5 * M + S));
  assert.deepEqual(coreOf(late.sessions.a), coreOf(inOrder.sessions.a));
  for (const f of FIRSTS) assert.equal(late.sessions.a[f], inOrder.sessions.a[f], f); // 끝 뒤의 소식이 하나뿐이면 「처음」 칸도 같다
  // 세션은 선 채로 남고 끝의 때만 늘어난다. 본체는 이 늘어남으로 「보낼 부서」 기억을 지운다
  const s = late.sessions.a;
  assert.deepEqual([s.endedAt, s.lastEndAt, s.stopAt, s.doneLong, s.askAt, s.anonAgents, s.agents], [null, END, null, false, null, 0, {}]);
  // 다시 선 뒤에 늦게 닿은 끝 앞의 소식(도우미 시작, 승인 물음, 마무리 기록)은 받지 않는다
  assert.equal(fold([hook('SubagentStart', T0 + 30 * S, { agentId: 'z' }), ask(T0 + M), rec(END + 5 * S), hook('SessionEnd', T0 + 2 * M)], {}, late), late);
  // 끝보다 늦은 소식은 남는다: 끝 뒤에 시작한 도우미는 늦은 끝이 지우지 않는다
  const kept = fold([...early, hook('SubagentStart', T0 + 4 * M + S, { agentId: 'y' }), resumed, end]);
  assert.equal(one(kept, T0 + 5 * M + S).subagents, 1);
});

test('a session quiet for 30 minutes comes back through the same drop as an end: no old helper, model or last tool', () => {
  const st = fold([hook('SessionStart', T0, { model: 'claude-opus-5-5' }), hook('PostToolUse', T0 + S, { toolName: 'Read', toolDetail: 'a.ts' }), hook('SubagentStart', T0 + 2 * S, { agentId: 'x' }), hook('SubagentStart', T0 + 3 * S), hook('PostToolUse', T0 + 40 * M)]);
  const v = one(st, T0 + 40 * M + S);
  assert.deepEqual([v.status, v.subagents, v.model, v.activity], ['working', 0, null, 'shop']);
});
