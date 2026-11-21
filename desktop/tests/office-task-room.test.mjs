import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeTaskRoom } from '../renderer/office-task-room.mjs';
import { createOfficeRoom, officeFloorScene } from '../renderer/office-room.mjs';

const completedId = '10000000-0000-4000-8000-000000000001';
const departments = [{ id: 'design', name: '디자인부', folder: 'C:/qa/design' }];
function completed(overrides = {}) {
  return { id: completedId, provider: 'codex', departmentId: 'design', departmentName: '디자인부',
    prompt: '제목 하나를 써 줘', previousId: null, status: 'completed', answer: '하루의 시작',
    reason: null, createdAt: 100, updatedAt: 200, canOpenTerminal: false, ...overrides };
}
function harness({ api = {}, tasks = [] } = {}) {
  const submitted = [], actions = [];
  const bridge = {
    async submitTask(request) { submitted.push({ ...request }); return { ok: true, id: request.id }; },
    async taskAction(...args) { actions.push(args); return { ok: true }; }, ...api,
  };
  const room = createOfficeTaskRoom({ api: bridge, changed() {}, reread() {} });
  let board = { tasks };
  const scene = () => room.scene(board, departments);
  const act = (act, extra = {}) => room.handle({ act, ...extra });
  const edit = prompt => act('task-edit', { fields: { prompt } });
  const submit = prompt => act('task-submit', { fields: { prompt } });
  scene();
  return { room, scene, act, edit, submit, submitted, actions, setBoard(value) { board = value; return scene(); } };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('a viewer without the task capability cannot create a task, even through an office row action', async () => {
  const h = harness();
  assert.equal(h.setBoard(undefined), null);
  await h.edit('보내지 않을 메모');
  await h.submit('보내지 않을 메모');
  assert.equal(h.submitted.length, 0);
});

test('the root composer can submit without a department and the selected provider is retained', async () => {
  const h = harness();
  const prompt = '첫째 줄\n<b>문자 그대로</b> & 한글';
  await h.act('task-provider', { arg: 'codex' });
  await h.edit(prompt);
  await h.submit(prompt);
  assert.equal(h.submitted.length, 1);
  assert.match(h.submitted[0].id, uuid);
  assert.equal(h.submitted[0].provider, 'codex');
  assert.equal(h.submitted[0].departmentId, null);
  assert.equal(h.submitted[0].prompt, prompt);
  assert.ok(!h.submitted[0].previousId);
});

test('department and staff entry scopes a fresh request without borrowing an observed tool session', async () => {
  const h = harness();
  await h.act('task-open', { key: 'd:design', arg: 'claude' });
  const model = h.scene();
  assert.equal(model.form.provider, 'claude');
  assert.equal(model.form.departmentId, 'design');
  assert.ok(!model.form.previousId);
  await h.edit('초안 먼저');
  await h.submit('초안 먼저');
  assert.equal(h.submitted[0].departmentId, 'design');
  assert.equal(h.submitted[0].provider, 'claude');
  assert.equal('sessionId' in h.submitted[0], false);
});

test('following a completed answer keeps the original provider and department and sends no prompt until submit', async () => {
  const h = harness({ tasks: [completed()] });
  await h.act('task-follow', { arg: completedId });
  assert.equal(h.scene().form.previousId, completedId);
  assert.equal(h.scene().form.provider, 'codex');
  assert.equal(h.scene().form.departmentId, 'design');
  assert.equal(h.submitted.length, 0);
  await h.edit('제목을 다듬어 줘');
  await h.submit('제목을 다듬어 줘');
  assert.equal(h.submitted[0].previousId, completedId);
  assert.notEqual(h.submitted[0].id, completedId);
});

test('an interrupted execution requires an explicit new request to try again', async () => {
  const h = harness({ tasks: [completed({ status: 'interrupted', reason: 'TERMINAL_CLOSED', answer: '' })] });
  await h.act('task-retry', { arg: completedId });
  assert.equal(h.submitted.length, 0);
  assert.ok(!h.scene().form.previousId);
  await h.submit(h.scene().form.prompt);
  assert.equal(h.submitted.length, 1);
  assert.notEqual(h.submitted[0].id, completedId);
});

test('duplicate clicks share a single dispatch and a later draft survives an outstanding submit', async () => {
  let resolve;
  const requests = [];
  const h = harness({ api: { submitTask(request) { requests.push(request); return new Promise(r => { resolve = r; }); } } });
  await h.edit('첫 업무');
  const pending = h.submit('첫 업무');
  await Promise.resolve();
  const duplicate = h.submit('첫 업무');
  await h.edit('다음 업무 초안');
  resolve({ ok: true, id: requests[0].id });
  await Promise.all([pending, duplicate]);
  assert.equal(requests.length, 1);
  assert.equal(h.scene().form.prompt, '다음 업무 초안');
});

test('an ambiguous response retries the same request id, while a different prompt gets a new one', async () => {
  const requests = [];
  const h = harness({ api: { async submitTask(request) {
    requests.push({ ...request });
    if (requests.length < 3) throw Error('lost transport');
    return { ok: true, id: request.id };
  } } });
  await h.edit('원래 일');
  await h.submit('원래 일');
  await h.submit('원래 일');
  assert.equal(requests[0].id, requests[1].id);
  await h.edit('다른 일');
  await h.submit('다른 일');
  assert.notEqual(requests[1].id, requests[2].id);
});

test('a storage error preserves the draft without indicating a saved or running job', async () => {
  const h = harness();
  await h.edit('보존할 초안');
  const model = h.setBoard({ tasks: [], code: 'STORAGE' });
  assert.ok(model.storageError);
  await h.submit('보존할 초안');
  assert.equal(h.submitted.length, 0);
  assert.equal(h.scene().form.prompt, '보존할 초안');
  assert.equal(h.scene().tasks.length, 0);
});

test('the changed member cannot read the old draft, a pending reply, or the previous result', async () => {
  let done;
  const h = harness({ tasks: [completed()], api: { submitTask() { return new Promise(r => { done = r; }); } } });
  const oldEpoch = h.scene().epoch;
  await h.edit('이전 회원의 초안');
  const first = h.submit('이전 회원의 초안');
  await Promise.resolve();
  h.room.reset();
  h.setBoard({ tasks: [] });
  await h.edit('새 회원의 글');
  done({ ok: false, code: 'LOGIN' });
  await first;
  const now = h.scene();
  assert.notEqual(now.epoch, oldEpoch);
  assert.equal(now.form.prompt, '새 회원의 글');
  assert.equal(now.tasks.length, 0);
  assert.ok(!now.error);
});

test('stored history is shown newest first and waiting tasks are resumed only after a button press', async () => {
  const second = '10000000-0000-4000-8000-000000000002';
  const h = harness({ tasks: [completed(), completed({ id: second, status: 'paused', createdAt: 300, updatedAt: 400 })] });
  assert.deepEqual(h.scene().tasks.map(t => t.id), [second, completedId]);
  assert.deepEqual(h.actions, []);
  await h.act('task-resume', { arg: second });
  assert.deepEqual(h.actions, [[second, 'resume']]);
});

test('office history and explicit department entry are omitted without the restricted capability', () => {
  const api = { submitTask() {}, taskAction() {} };
  const room = createOfficeRoom({ api, changed() {}, reread() {} });
  const base = { ok: true, available: true, departments, state: { sessions: {}, ignored: {} }, settings: {}, roots: {}, pc: null };
  const ordinary = room.scene(base, Date.now());
  assert.ok(!ordinary.tasking);
  assert.doesNotMatch(JSON.stringify(ordinary.rows), /task-open/);
  const allowed = room.scene({ ...base, tasking: { tasks: [] } }, Date.now());
  assert.ok(allowed.tasking);
  assert.match(JSON.stringify(allowed.rows.find(r => r.key === 'd:design')), /task-open/);
});

test('an in-memory answer with a write failure stays visible and saving again does not rerun an employee', async () => {
  let reads = 0;
  const submitted = [];
  const room = createOfficeTaskRoom({
    api: { async submitTask(spec) { submitted.push(spec); return { ok: true, id: spec.id }; } },
    changed() {}, reread() { reads += 1; },
  });
  const answer = '보존된 최종 글\n둘째 줄 & <b>문자 그대로</b>';
  const model = room.scene({ tasks: [completed({ status: 'failed', reason: 'WRITE', answer })], code: 'WRITE' }, departments);
  assert.equal(model.storageCode, 'WRITE');
  assert.equal(model.tasks[0].answer, answer);
  assert.equal(model.tasks[0].status, 'failed');
  await room.handle({ act: 'task-refresh' });
  assert.equal(reads, 1);
  assert.deepEqual(submitted, []);
});

test('an unexpected IPC acknowledgement keeps the same draft and identity for explicit resend', async () => {
  const requests = [];
  const h = harness({ api: { async submitTask(request) {
    requests.push(request);
    return requests.length === 1 ? { ok: true, id: 'wrong-request' } : { ok: true, id: request.id };
  } } });
  await h.edit('전달 확인이 필요한 일');
  await h.submit('전달 확인이 필요한 일');
  assert.equal(h.scene().form.prompt, '전달 확인이 필요한 일');
  assert.ok(h.scene().error);
  await h.submit(h.scene().form.prompt);
  assert.equal(requests[1].id, requests[0].id);
});

test('a request recorded after its submission reply was lost is recognized without launching it a second time', async () => {
  let sent;
  const h = harness({ api: { async submitTask(request) { sent = request; throw Error('lost reply'); } } });
  await h.edit('이미 전송한 원문');
  await h.submit('이미 전송한 원문');
  const row = completed({ ...sent, status: 'queued', answer: '' });
  h.setBoard({ tasks: [row] });
  assert.equal(h.scene().form.prompt, '');
  assert.equal(h.scene().tasks[0].id, sent.id);
  assert.ok(!h.scene().error);
});

test('immediate login refusal retains the selected Claude worker and the unsent original text', async () => {
  const h = harness({ api: { async submitTask() { return { ok: false, code: 'LOGIN' }; } } });
  await h.edit('로그인 뒤 다시 확인할 일');
  await h.submit('로그인 뒤 다시 확인할 일');
  assert.equal(h.scene().form.provider, 'claude');
  assert.equal(h.scene().form.prompt, '로그인 뒤 다시 확인할 일');
  assert.match(h.scene().error, /로그인/);
  assert.deepEqual(h.scene().tasks, []);
});

test('a lost reply retains its identity when another employee finishes a different request first', async () => {
  const sent = [];
  const h = harness({ api: { async submitTask(request) {
    sent.push(request);
    if (sent.length === 1) throw Error('lost reply');
    return { ok: true, id: request.id };
  } } });
  await h.edit('첫 번째 Claude 요청');
  await h.submit('첫 번째 Claude 요청');
  await h.act('task-provider', { arg: 'codex' });
  await h.edit('다른 GPT 요청');
  await h.submit('다른 GPT 요청');
  await h.act('task-provider', { arg: 'claude' });
  await h.submit(h.scene().form.prompt);
  assert.equal(sent.length, 3);
  assert.equal(sent[0].id, sent[2].id);
  assert.notEqual(sent[1].id, sent[0].id);
});

test('the first office describes locally assigned work before an observed CLI record appears', () => {
  const office = createOfficeRoom({ api: {}, changed() {}, reread() {} });
  const base = { ok: true, available: true, departments: [], state: { sessions: {}, ignored: {} }, settings: {}, roots: {} };
  const ordinary = office.scene(base, Date.now());
  const working = office.scene({ ...base, tasking: { tasks: [completed({ status: 'running', answer: '' })] } }, Date.now());
  assert.doesNotMatch(working.say + working.then, /도는 일이 없습니다/);
  assert.match(working.say + working.then, /GPT|Codex/);
  assert.notEqual(working.say + working.then, ordinary.say + ordinary.then);
  assert.equal(working.sessions, 0);
  const waiting = office.scene({ ...base, tasking: { code: 'WRITE', tasks: [] } }, Date.now());
  assert.doesNotMatch(waiting.say + waiting.then, /새 일을 맡기|맡겨 보|맡겨보/);
});

test('a drawn employee retains their real department and supported tool in the grouped floor and lobby', () => {
  const departments = Array.from({ length: 7 }, (_, i) => ({ id: 'dept' + i, name: '부서' + i }));
  const members = [
    { id: 'worker-1', tool: 'claude', departmentId: 'dept6' },
    { id: 'worker-2', tool: 'codex', departmentId: null },
    { id: 'observer', tool: 'unknown', departmentId: null },
  ];
  const floor = officeFloorScene({ departments, list: members, cap: 3 });
  const grouped = floor.zones.find(zone => zone.key === 'other').staff[0];
  assert.deepEqual([grouped.provider, grouped.zone], ['claude', 'd:dept6']);
  const lobby = floor.zones.find(zone => zone.key === 'lobby').staff;
  assert.deepEqual(lobby.map(person => [person.provider, person.zone]), [['codex', 'lobby'], [null, 'lobby']]);
});

test('a Claude answer pending final confirmation remains interrupted and can only start a fresh explicit retry', async () => {
  const task = completed({provider: 'claude', status: 'interrupted', reason: 'UNCONFIRMED', answer: '확인을 기다리던 답\n둘째 줄'});
  const h = harness({tasks: [task]});
  assert.equal(h.scene().tasks[0].answer, task.answer);
  await h.act('task-follow', {arg: task.id});
  assert.equal(h.scene().form.previousId, null);
  assert.equal(h.scene().form.prompt, '');
  await h.act('task-retry', {arg: task.id});
  assert.equal(h.scene().form.prompt, task.prompt);
  assert.equal(h.submitted.length, 0);
  await h.submit(task.prompt);
  assert.equal(h.submitted[0].provider, 'claude');
  assert.notEqual(h.submitted[0].id, task.id);
  assert.equal(h.submitted[0].previousId, undefined);
});

test('a live Claude draft can be opened or cancelled but cannot start a retry or a follow-up', async () => {
  const task = completed({ provider: 'claude', status: 'terminal', reason: 'UNCONFIRMED',
    answer: '아직 작업 중인 원문\n두 번째 줄', canOpenTerminal: true });
  const h = harness({ tasks: [task] });
  assert.equal(h.scene().tasks[0].answer, task.answer);
  await h.act('task-follow', { arg: task.id });
  await h.act('task-retry', { arg: task.id });
  assert.equal(h.scene().form.previousId, null);
  assert.equal(h.scene().form.prompt, '');
  await h.act('task-terminal', { arg: task.id });
  await h.act('task-cancel', { arg: task.id });
  assert.deepEqual(h.actions, [[task.id, 'terminal'], [task.id, 'cancel']]);
  assert.deepEqual(h.submitted, []);
});

test('a legacy GPT terminal record cannot carry the session into a follow-up', async () => {
  const task = completed({ status: 'interrupted', reason: 'UNCONFIRMED', viaTerminal: true,
    answer: '터미널에서 받은 답\n<b>원문</b>' });
  const h = harness({ tasks: [task] });
  await h.act('task-follow', { arg: task.id });
  assert.equal(h.scene().form.previousId, null);
  assert.equal(h.scene().form.prompt, '');
  assert.deepEqual(h.submitted, []);
});

for (const status of ['terminal', 'interrupted']) {
  test('the member can keep their own verbatim GPT answer on the specific ' + status + ' card', async () => {
    const task = completed({status, reason: 'MANUAL_RESULT', viaTerminal: true, answer: ''});
    const h = harness({tasks: [task]});
    const answer = ' 행사 소개 <b>내용</b>\n마지막 줄  ';
    await h.act('task-save-answer', {arg: task.id, fields: {answer}});
    assert.deepEqual(h.actions, [[task.id, 'saveAnswer', answer]]);
    assert.deepEqual(h.submitted, []);
  });
}

test('manual answers reject blank, oversized, non-string, unrelated, or closed records at the controller', async () => {
  const task = completed({status: 'interrupted', reason: 'MANUAL_RESULT', answer: ''});
  const h = harness({tasks: [task]});
  const save = (id, answer) => h.act('task-save-answer', {arg: id, fields: {answer}});
  for (const text of ['', ' \t\n', '가'.repeat(524289), 17]) await save(task.id, text);
  await save('another-id', '내가 옮긴 문장');
  for (const overrides of [{provider: 'claude'}, {status: 'completed'}, {reason: 'MEMBER_RESULT'}, {reason: 'LOGIN'}]) {
    h.setBoard({tasks: [{...task, ...overrides}]});
    await save(task.id, '다른 곳에 들어가면 안 되는 원문');
  }
  assert.deepEqual(h.actions, []);
  h.setBoard({tasks: [task]});
  const boundary = '가'.repeat(524288);
  await save(task.id, boundary);
  assert.equal(h.actions.length, 1);
  assert.equal(h.actions[0][2], boundary);
});

test('a manually transferred answer and an old external GPT answer cannot reopen a conversation', async () => {
  for (const overrides of [
    {status:'interrupted', reason:'MEMBER_RESULT'}, {status:'interrupted', reason:'MANUAL_RESULT'},
    {status:'interrupted', reason:'UNCONFIRMED'}, {status:'completed', reason:null},
  ]) {
    const task = completed({...overrides, viaTerminal:true});
    const h = harness({tasks:[task]});
    await h.act('task-follow', {arg:task.id});
    await h.act('task-retry', {arg:task.id});
    assert.equal(h.scene().form.previousId, null);
    assert.equal(h.scene().form.prompt, '');
    assert.deepEqual(h.submitted, []);
  }
});

test('an in-flight manual save is submitted once and its later reply cannot alter another member', async () => {
  const task = completed({status:'interrupted',reason:'MANUAL_RESULT',answer:''});
  let resolve;
  const captured=[];
  const h=harness({tasks:[task],api:{taskAction(...args){captured.push(args);return new Promise(r=>{resolve=r;});}}});
  const action={arg:task.id,fields:{answer:'회원이 골라 옮긴 문장'}};
  const first=h.act('task-save-answer',action);
  await h.act('task-save-answer',action);
  assert.deepEqual(captured,[[task.id,'saveAnswer',action.fields.answer]]);
  h.room.reset();h.setBoard({tasks:[]});
  resolve({ok:false,code:'WRITE'});
  await first;
  assert.equal(h.scene().error,null);
  assert.deepEqual(h.actions,[]);
});
