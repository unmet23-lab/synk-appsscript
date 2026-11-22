import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeTaskRoom } from '../renderer/office-task-room.mjs';
import { createOfficeRoom, officeFloorScene } from '../renderer/office-room.mjs';
import { mailCodeText } from '../renderer/office-mail-model.mjs';

const completedId = '10000000-0000-4000-8000-000000000001';
const departments = [{ id: 'design', name: '디자인부', folder: 'C:/qa/design' }];
function completed(overrides = {}) {
  return { id: completedId, provider: 'codex', departmentId: 'design', departmentName: '디자인부',
    prompt: '제목 하나를 써 줘', previousId: null, status: 'completed', answer: '하루의 시작',
    reason: null, createdAt: 100, updatedAt: 200, canOpenTerminal: false, ...overrides };
}
function harness({ api = {}, tasks = [], reread = () => {} } = {}) {
  const submitted = [], actions = [];
  const bridge = {
    async submitTask(request) { submitted.push({ ...request }); return { ok: true, id: request.id }; },
    async taskAction(...args) { actions.push(args); return { ok: true }; }, ...api,
  };
  const room = createOfficeTaskRoom({ api: bridge, changed() {}, reread });
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

const qaMailbox = {providers:[
  {id:'gmail',configured:true,connected:true,address:'studio@example.test'},
  {id:'outlook',configured:true,connected:false},
]};
const qaMailItemId = '20000000-0000-4000-8000-000000000007';
const reviewId = '30000000-0000-4000-8000-000000000009';
const reviewFilter = {terms:['예산 계획'],from:'',after:'2028-02-01',before:'2028-03-01',folder:'inbox_sent',provider:'gmail',attachment:''};
function reviewTask(overrides = {}) {
  return completed({id:qaMailItemId,prompt:'그중 2월 예산 메일을 찾아줘',previousId:completedId,provider:'codex',status:'failed',answer:'',reason:'MAIL_REVIEW',
    mailSearch:true,mailDecision:'review',mailReview:{reviewId,filter:reviewFilter,quotes:['2월 예산'],unmet:[],reason:'period'},...overrides});
}

test('mail review maps inclusive calendar dates both ways without changing sender, folder or phrases',async()=>{
  const {makeMailFilterDraft,readMailFilterDraft}=await import('../renderer/office-mail-review-filter.mjs');
  for(const [before,through] of [['2028-03-01','2028-02-29'],['2027-01-01','2026-12-31'],['2026-11-02','2026-11-01'],['','']]){
    const confirmed={...reviewFilter,after:'',before,from:'문의 팀',terms:['예산 계획','촬영']};
    const draft=makeMailFilterDraft(confirmed);
    assert.equal(draft.through,through);
    assert.equal(draft.terms,'예산 계획\n촬영');
    assert.deepEqual(readMailFilterDraft(draft),{ok:true,filter:confirmed});
  }
  const singleDay={...reviewFilter,after:'2028-02-29',before:'2028-03-01'};
  const dayDraft=makeMailFilterDraft(singleDay);
  assert.equal(dayDraft.after,dayDraft.through);assert.deepEqual(readMailFilterDraft(dayDraft).filter,singleDay);
  const draft=makeMailFilterDraft(reviewFilter);
  for(const patch of [{through:'2027-02-29'},{through:'2028-01-31'},{through:'2200-12-31'},{terms:'a\nb\nc\nd\ne\nf\ng'},
    {terms:'견적/촬영'},{terms:'견적 NEAR 촬영'},{folder:'spam'},{provider:'unknown'},{attachment:'none'}]){
    const result=readMailFilterDraft({...draft,...patch});
    assert.equal(result.ok,false,JSON.stringify(patch)); assert.ok(result.message);
  }
  assert.deepEqual(readMailFilterDraft({...draft,terms:'or\n-기획  팀'}).filter.terms,['or','-기획  팀']);
});

test('mail review confirms once on the original card and preserves the form while IPC is pending',async()=>{
  let settle;
  const calls=[];
  const h=harness({api:{taskAction(...args){calls.push(args);return new Promise(resolve=>{settle=resolve;});}}});
  const task=reviewTask(), board={tasks:[completed(),task],mail:qaMailbox};
  h.setBoard(board);
  await h.edit('다른 직원에게 맡길 초안');
  const payload={arg:task.id,fields:{reviewId,filter:reviewFilter}};
  await h.act('task-mail-confirm',{...payload,fields:{...payload.fields,reviewId:completedId}});
  assert.equal(calls.length,0);
  const pending=h.act('task-mail-confirm',payload);
  await Promise.resolve();
  await h.act('task-mail-confirm',payload);
  assert.deepEqual(calls,[[task.id,'confirmMail',{reviewId,filter:reviewFilter}]]);
  assert.equal(h.scene().mailUI.reviewByTask[task.id].busy,true);
  settle({ok:true,id:task.id}); await pending;
  await h.act('task-mail-confirm',payload);
  assert.equal(calls.length,1);
  assert.equal(h.scene().form.prompt,'다른 직원에게 맡길 초안');
  assert.equal(h.submitted.length,0);
});

test('mail review renewal, original prompt editing and general work preserve the stored parent',async()=>{
  const parent=completed(), task=reviewTask();
  const h=harness();
  h.setBoard({tasks:[parent,{...task,mailReview:undefined}],mail:qaMailbox});
  await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId,filter:reviewFilter}});
  await h.act('task-mail-renew',{arg:task.id});
  assert.deepEqual(h.actions,[[task.id,'reviewMail']]);
  h.setBoard({tasks:[parent,task],mail:qaMailbox});
  await h.act('task-retry',{arg:task.id});
  assert.equal(h.scene().form.prompt,task.prompt);
  assert.equal(h.scene().form.previousId,parent.id);
  assert.equal(h.scene().form.departmentId,task.departmentId);
  assert.equal(h.scene().form.mailSearch,true);
  assert.equal(h.submitted.length,0);
  await h.act('task-mail-general',{arg:task.id});
  assert.equal(h.submitted[0]?.previousId,parent.id);
  assert.equal(h.submitted[0]?.mailSearch,false);
  assert.equal(h.submitted[0]?.prompt,task.prompt);
});

test('an unresolved empty mail period requires a bound or a separate explicit all-dates choice',async()=>{
  const blank={...reviewFilter,after:'',before:''};
  const fromDate={...blank,after:'2028-02-01'};
  const throughDate={...blank,before:'2028-03-01'};
  const withChoice={allowUnboundedPeriod:true};
  const cases=[
    {reason:'period',original:blank,filter:blank,send:false},
    {reason:'period',original:blank,filter:blank,choice:{allowUnboundedPeriod:false},send:false},
    {reason:'period',original:blank,filter:blank,choice:{allowUnboundedPeriod:'true'},send:false},
    {reason:'period',original:blank,filter:blank,choice:withChoice,expected:withChoice},
    {reason:'period',original:blank,filter:blank,unmet:['Outlook'],choice:{...withChoice,omitUnmet:true},expected:{...withChoice,omitUnmet:true}},
    {reason:'period',original:blank,filter:fromDate},
    {reason:'period',original:blank,filter:throughDate,choice:withChoice},
    {reason:'period',original:fromDate,filter:blank,choice:withChoice},
    {reason:'terms',original:blank,filter:blank,choice:{...withChoice,omitUnmet:true}},
    {reason:'unsupported',original:blank,filter:blank,unmet:['안 읽은'],choice:{omitUnmet:true},expected:{omitUnmet:true}},
    {reason:'unsupported',requiresPeriodChoice:true,original:blank,filter:blank,unmet:['안 읽은'],choice:{omitUnmet:true},send:false},
    {reason:'unsupported',requiresPeriodChoice:true,original:blank,filter:blank,unmet:['안 읽은'],choice:withChoice,send:false},
    {reason:'unsupported',requiresPeriodChoice:true,original:blank,filter:throughDate,unmet:['안 읽은'],send:false},
    {reason:'unsupported',requiresPeriodChoice:true,original:blank,filter:blank,unmet:['안 읽은'],choice:{...withChoice,omitUnmet:true},expected:{...withChoice,omitUnmet:true}},
    {reason:'unsupported',requiresPeriodChoice:true,original:blank,filter:throughDate,unmet:['안 읽은'],choice:{omitUnmet:true},expected:{omitUnmet:true}},
  ];
  for(const {reason,requiresPeriodChoice,original,filter,choice,expected,unmet=[],send=true} of cases){
    const h=harness();
    const task=reviewTask({mailReview:{reviewId,filter:original,reason,quotes:[],unmet,...(requiresPeriodChoice?{requiresPeriodChoice}: {})}});
    h.setBoard({tasks:[task],mail:qaMailbox});
    await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId,filter,...choice}});
    assert.deepEqual(h.actions,send?[[task.id,'confirmMail',{reviewId,filter,...expected}]]:[]);
  }
});

test('ambiguous sender and folder choices are required separately and match the submitted filters',async()=>{
  const filter={...reviewFilter,terms:['deposit'],from:'Studio',folder:'received'};
  const from={field:'from',quote:'the messages Alice sent me',value:'Alice'};
  const folder={field:'folder',quote:'in the messages I sent',value:'sent'};
  const apply={from:'apply',folder:'apply'};
  const cases=[
    {choices:[from,folder]},
    {choices:[from,folder],decisions:{from:'apply'},values:{from:'Alice'}},
    {choices:[from,folder],decisions:apply,values:{from:'Alice'}},
    {choices:[from,folder],decisions:{from:'exclude',folder:'exclude'},values:{from:''}},
    {choices:[from,folder],decisions:{from:'edit',folder:'exclude'}},
    {choices:[from,folder],decisions:{from:'edit',folder:'exclude'},values:{from:'   '}},
    {choices:[from,folder],decisions:{from:'edit',folder:'exclude'},values:{from:' aLiCe '}},
    {choices:[from,folder],decisions:{from:'edit',folder:'exclude'},values:{from:'sTuDio'}},
    {choices:[folder],decisions:{folder:'edit'},values:{folder:'sent'}},
    {choices:[from],decisions:{from:'maybe'},values:{from:'Alice'}},
    {choices:[from],decisions:{from:'apply',folder:'apply'},values:{from:'Alice',folder:'sent'}},
    {choices:[],decisions:{folder:'exclude'}},
    {choices:[from,from],decisions:{from:'apply'},values:{from:'Alice'}},
    {choices:[from,folder],decisions:apply,values:{from:'Alice',folder:'sent'},send:true},
    {choices:[from,folder],decisions:{from:'exclude',folder:'exclude'},send:true},
    {choices:[from,folder],decisions:{from:'edit',folder:'exclude'},values:{from:'Bob'},send:true},
    {choices:[from],decisions:{from:'apply'},values:{from:'Alice'},send:true},
    {choices:[folder],decisions:{folder:'edit'},values:{folder:'inbox'},send:true},
    {choices:[],send:true},
  ];
  for(const {choices,decisions,values={},send=false} of cases){
    const h=harness();
    const task=reviewTask({mailReview:{reviewId,filter,reason:'sender',quotes:[],unmet:[],roleChoices:choices}});
    h.setBoard({tasks:[task],mail:qaMailbox});
    const fields={reviewId,filter:{...filter,...values},...(decisions?{roleDecisions:decisions}:{})};
    await h.act('task-mail-confirm',{arg:task.id,fields});
    assert.deepEqual(h.actions,send?[[task.id,'confirmMail',fields]]:[],JSON.stringify({choices,decisions,values}));
  }
});

test('role, undated search, and unsupported condition confirmations are independent',async()=>{
  const filter={...reviewFilter,terms:['deposit'],from:'',after:'',before:''};
  const task=reviewTask({mailReview:{reviewId,filter,reason:'unsupported',requiresPeriodChoice:true,
    quotes:['Alice sent me'],unmet:['unread'],roleChoices:[{field:'from',quote:'Alice sent me',value:'Alice'}]}});
  for(const extra of [
    {allowUnboundedPeriod:true,omitUnmet:true},
    {roleDecisions:{from:'exclude'},omitUnmet:true},
    {roleDecisions:{from:'exclude'},allowUnboundedPeriod:true},
    {roleDecisions:{from:'exclude'},allowUnboundedPeriod:true,omitUnmet:true},
  ]){
    const h=harness();h.setBoard({tasks:[task],mail:qaMailbox});
    const input={reviewId,filter,...extra};
    await h.act('task-mail-confirm',{arg:task.id,fields:input});
    const expected=extra.roleDecisions&&extra.allowUnboundedPeriod&&extra.omitUnmet?[[task.id,'confirmMail',input]]:[];
    assert.deepEqual(h.actions,expected);
  }
});

test('mail review confirms the newly restored review revision once and rejects the former nonce',async()=>{
  const task=reviewTask(),h=harness(),next='31000000-0000-4000-8000-000000000080';
  h.setBoard({tasks:[{...task,mailReview:undefined}],mail:qaMailbox});
  await h.act('task-mail-renew',{arg:task.id});
  h.setBoard({tasks:[{...task,mailReview:{...task.mailReview,reviewId:next,unmet:['별표']}}],mail:qaMailbox});
  await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId,filter:reviewFilter}});
  await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId:next,filter:reviewFilter}});
  await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId:next,filter:reviewFilter}});
  assert.deepEqual(h.actions,[[task.id,'reviewMail'],[task.id,'confirmMail',{reviewId:next,filter:reviewFilter}]]);
});

test('the review card preserves the reason for a changed session while using the current revision for its next action',async()=>{
  const {createMailReviewActions}=await import('../renderer/office-mail-review-actions.mjs');
  const fresh='31000000-0000-4000-8000-000000000082';
  for(const replacement of ['',fresh]){
    for(const readBeforeReply of [false,true]){
      let task=reviewTask(),release;
      const pending=new Promise(resolve=>{release=resolve;});
      const refresh=()=>{
        task={...task,mailReview:replacement?{...task.mailReview,reviewId:replacement}:{}};
        actions.sync([task]);
      };
      const actions=createMailReviewActions({findTask:()=>task,enabled:()=>true,
        api:{taskAction:()=>pending},reread:refresh});
      const confirming=actions.handle('task-mail-confirm',task.id,{reviewId,filter:reviewFilter});
      if(readBeforeReply)refresh();
      release({ok:false,code:'SESSION'});
      assert.deepEqual(await confirming,{ok:false,code:'SESSION'});
      const state=actions.ui()[task.id];
      assert.ok(state.note.includes('세션'));
      assert.equal(state.renewalNeeded,!replacement);
      assert.equal(actions.blocksOther(task.id),false);
      actions.reset();
      assert.equal(actions.ui()[task.id],undefined);
    }
  }
});

test('mail review and ordinary work cannot run concurrently on the same card',async()=>{
  for(const reviewAct of ['task-mail-confirm','task-mail-renew']){
    const task=reviewTask(reviewAct==='task-mail-renew'?{mailReview:{}}:{});
    const other=reviewTask({id:'20000000-0000-4000-8000-000000000008'});
    const fields={reviewId,filter:reviewFilter};
    for(const first of ['review','ordinary']){
      const receipts=[],reviews=[];
      let release;
      const pending=new Promise(done=>{release=done;});
      const h=harness({api:{
        async taskAction(id,action){reviews.push([id,action]);if(id===task.id&&first==='review')await pending;return {ok:true,id};},
        async submitTask(request){receipts.push(request);if(first==='ordinary')await pending;return {ok:true,id:request.id};},
      }});
      h.setBoard({tasks:[completed(),task,other],mail:qaMailbox});
      const callReview=()=>h.act(reviewAct,{arg:task.id,fields});
      const callOrdinary=()=>h.act('task-mail-general',{arg:task.id});
      const active=first==='review'?callReview():callOrdinary();
      await Promise.resolve();
      if(first==='review')await callOrdinary();else await callReview();
      assert.equal(reviews.length,first==='review'?1:0);
      assert.equal(receipts.length,first==='ordinary'?1:0);
      await h.act('task-mail-confirm',{arg:other.id,fields});
      assert.equal(reviews.at(-1)[0],other.id);
      release();await active;
    }
  }
});

test('mail review blocks an uncertain ordinary dispatch until its exact request is acknowledged',async()=>{
  const task=reviewTask(),receipts=[];
  const h=harness({api:{async submitTask(request){receipts.push(request);return {ok:null};}}});
  h.setBoard({tasks:[task],mail:qaMailbox});
  await h.act('task-mail-general',{arg:task.id});
  await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId,filter:reviewFilter}});
  assert.equal(h.actions.length,0);
  await h.act('task-mail-general',{arg:task.id});
  assert.equal(receipts.length,2);assert.equal(receipts[0].id,receipts[1].id);
  h.setBoard({tasks:[task,completed({id:receipts[0].id})],mail:qaMailbox});
  await h.act('task-mail-confirm',{arg:task.id,fields:{reviewId,filter:reviewFilter}});
  assert.equal(h.actions.length,1);
});

test('mail review ignores a late error after member change and does not expose actions outside the feature',async()=>{
  let settle;let requests=0;
  const h=harness({api:{taskAction(){requests++;return new Promise(resolve=>{settle=resolve;});}}});
  const task=reviewTask(),args={arg:task.id,fields:{reviewId,filter:reviewFilter}};
  h.setBoard({tasks:[task]});await h.act('task-mail-confirm',args);
  h.setBoard({tasks:[{...task,provider:'claude'}],mail:qaMailbox});await h.act('task-mail-confirm',args);
  assert.equal(requests,0);
  h.setBoard({tasks:[task],mail:qaMailbox});
  const pending=h.act('task-mail-confirm',args);await Promise.resolve();assert.equal(requests,1);
  h.room.reset();h.setBoard({tasks:[],mail:qaMailbox});
  settle({ok:false,code:'MAIL_CHANGED'});await pending;
  assert.equal(h.scene().error,null);assert.equal(h.scene().mailUI.reviewByTask[task.id],undefined);
});

function storedMail(overrides = {}) {
  return completed({mailSearch:true, answer:'Gmail에서 1건을 찾았습니다.', mailResult:{
    scope:'지난주 · 받은 메일',groups:[
      {provider:'gmail',address:'studio@example.test',items:[{id:qaMailItemId,subject:'공연 견적'}],more:false},
      {provider:'outlook',address:'orders@example.test',items:[],more:false,code:'MAIL_RECONNECT'},
    ],
  }, ...overrides});
}

test('office mail keeps a normal prompt automatic and explicitly requests a search for the selected GPT draft', async () => {
  const h = harness();
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.submit('지난주 견적 메일 찾아줘.');
  assert.equal(Object.hasOwn(h.submitted[0],'mailSearch'),false);
  await h.act('task-mail-mode',{fields:{enabled:true}});
  await h.edit('기획팀에서 보낸 것');
  await h.act('task-provider',{arg:'claude'});
  assert.notEqual(h.scene().form.mailSearch,true);
  await h.act('task-provider',{arg:'codex'});
  assert.equal(h.scene().form.prompt,'기획팀에서 보낸 것');
  assert.equal(h.scene().form.mailSearch,true);
  await h.submit(h.scene().form.prompt);
  assert.equal(h.submitted[1].mailSearch,true);
  assert.ok(!h.submitted[1].previousId);
  assert.notEqual(h.scene().form.mailSearch,true);
});

test('office mail does not attach a mail request or change a mailbox without the private capability', async () => {
  const observed=[];
  const h=harness({api:{connectMail(id){observed.push(id);return {ok:true};}}});
  await h.act('task-provider',{arg:'codex'});
  await h.act('task-mail-mode',{fields:{enabled:true}});
  await h.act('task-mail-connect',{arg:'outlook'});
  await h.submit('일반 업무입니다.');
  assert.equal(Object.hasOwn(h.submitted[0],'mailSearch'),false);
  assert.deepEqual(observed,[]);
});

test('office mail connects and removes only eligible mailbox providers and preserves the draft', async () => {
  const observed=[];
  const h=harness({api:{
    async connectMail(id){observed.push(['connect',id]);return {ok:false,code:'MAIL_CANCELLED'};},
    async disconnectMail(id){observed.push(['disconnect',id]);return {ok:true};},
  }});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.edit('쓰는 중인 글');
  await h.act('task-mail-connect',{arg:'gmail'});
  await h.act('task-mail-connect',{arg:'different'});
  await h.act('task-mail-connect',{arg:'outlook'});
  assert.match(h.scene().mailUI.providerNotes.outlook,/취소/);
  await h.act('task-mail-disconnect',{arg:'outlook'});
  await h.act('task-mail-disconnect',{arg:'gmail'});
  assert.deepEqual(observed,[['connect','outlook'],['disconnect','gmail']]);
  assert.equal(h.scene().form.prompt,'쓰는 중인 글');
  assert.deepEqual(h.submitted,[]);
});

test('office mail maps an original source to the declared item and its own saved task', async () => {
  const observed=[];
  const h=harness({api:{async openMailResult(...args){observed.push(args);return {ok:true};}}});
  const task=storedMail();
  h.setBoard({tasks:[task],mail:qaMailbox});
  await h.act('task-mail-open',{arg:task.id,fields:{itemId:'https://example.test/path'}});
  await h.act('task-mail-open',{arg:'unrelated-task',fields:{itemId:qaMailItemId}});
  await h.act('task-mail-open',{arg:task.id,fields:{itemId:qaMailItemId}});
  assert.deepEqual(observed,[[task.id,qaMailItemId]]);
});

test('a stored ordinary retry clears its draft when the device has no mail feature', async () => {
  const original=completed({status:'failed',reason:'LOGIN',answer:'',mailSearch:false});
  const h=harness({tasks:[original]});
  await h.act('task-retry',{arg:original.id});
  assert.equal(h.scene().form.prompt,original.prompt);
  await h.submit(original.prompt);
  assert.equal(Object.hasOwn(h.submitted[0],'mailSearch'),false);
  assert.equal(h.scene().form.prompt,'');
  await h.submit('새 업무');
  assert.equal(h.scene().form.prompt,'');
});

test('a stored ordinary retry clears the recovered draft after a lost acknowledgement on a device without mail', async () => {
  const original=completed({status:'failed',reason:'LOGIN',answer:'',mailSearch:false});
  let sent;
  const h=harness({tasks:[original],api:{async submitTask(value){sent=value;throw Error('lost');}}});
  await h.act('task-retry',{arg:original.id});
  await h.submit(original.prompt);
  assert.equal(h.scene().form.prompt,original.prompt);
  h.setBoard({tasks:[original,completed({id:sent.id,prompt:original.prompt})]});
  assert.equal(h.scene().form.prompt,'');
});

test('one unresolved choice waits on its card and cannot dispatch the opposite action', async () => {
  const original=completed({status:'failed',reason:'MAIL_CHOOSE',answer:'',mailDecision:'choose'});
  const attempts=[];
  let finish;
  const h=harness({api:{async submitTask(value){
    attempts.push(value);
    if(attempts.length===1)return new Promise(resolve=>{finish=resolve;});
    return {ok:true,id:value.id};
  }}});
  h.setBoard({tasks:[original],mail:qaMailbox});
  const first=h.act('task-mail-general',{arg:original.id});
  await h.act('task-mail-find',{arg:original.id});
  assert.equal(attempts.length,1);
  assert.match(h.scene().mailUI.cardNotes[original.id],/일반 업무/);
  finish({ok:true,id:attempts[0].id});
  await first;
  await h.act('task-mail-find',{arg:original.id});
  assert.equal(attempts.length,2);
  assert.equal(attempts[1].mailSearch,true);
  assert.notEqual(attempts[0].id,attempts[1].id);
});

test('an uncertain choice explains the original button and unlocks after the same request appears', async () => {
  const original=completed({status:'failed',reason:'MAIL_CHOOSE',answer:'',mailDecision:'choose'});
  const attempts=[];
  const h=harness({api:{async submitTask(value){attempts.push(value);throw Error('lost');}}});
  h.setBoard({tasks:[original],mail:qaMailbox});
  await h.act('task-mail-general',{arg:original.id});
  h.setBoard({tasks:[original,completed({id:'10000000-0000-4000-8000-000000000099'})],mail:qaMailbox});
  await h.act('task-mail-find',{arg:original.id});
  assert.equal(attempts.length,1);
  assert.match(h.scene().mailUI.cardNotes[original.id],/일반 업무로 맡기기/);
  assert.match(h.scene().mailUI.cardNotes[original.id],/다시|확인/);
  await h.act('task-mail-general',{arg:original.id});
  assert.deepEqual(attempts[1],attempts[0]);
  h.setBoard({tasks:[original,completed({id:attempts[0].id})],mail:qaMailbox});
  assert.equal(h.scene().mailUI.cardNotes[original.id],undefined);
  await h.act('task-mail-find',{arg:original.id});
  assert.equal(attempts.length,3);
  assert.equal(attempts[2].mailSearch,true);
  assert.notEqual(attempts[2].id,attempts[0].id);
});

test('an in-flight receipt observed in the list allows a new explicit click after any late reply', async () => {
  for(const outcome of ['lost','denied','malformed']){
    const original=completed({status:'failed',reason:'MAIL_CHOOSE',answer:'',mailDecision:'choose'});
    const attempts=[];
    let finish;
    const h=harness({api:{async submitTask(value){
      attempts.push(value);
      if(attempts.length>1)return {ok:true,id:value.id};
      return new Promise((resolve,reject)=>{finish=()=>{
        if(outcome==='lost')reject(Error('lost'));
        else resolve(outcome==='denied'?{ok:false,code:'BUSY'}:null);
      };});
    }}});
    h.setBoard({tasks:[original],mail:qaMailbox});
    const first=h.act('task-mail-find',{arg:original.id});
    h.setBoard({tasks:[original,completed({id:attempts[0].id})],mail:qaMailbox});
    finish();
    await first;
    assert.equal(h.scene().mailUI.cardNotes[original.id],undefined,outcome);
    await h.act('task-mail-find',{arg:original.id});
    assert.equal(attempts.length,2,outcome);
    assert.equal(attempts[1].mailSearch,true,outcome);
    assert.notEqual(attempts[1].id,attempts[0].id,outcome);
  }
});

test('the list acknowledges a pending IPC request without letting its late reply unlock a newer request', async () => {
  const task=completed({status:'failed',reason:'MAIL_CHOOSE',answer:'',mailDecision:'choose'});
  const attempts=[],pending=[];
  const h=harness({api:{submitTask(value){
    attempts.push(value);
    return new Promise((resolve,reject)=>pending.push({resolve,reject}));
  }}});
  h.setBoard({tasks:[task],mail:qaMailbox});
  const first=h.act('task-mail-general',{arg:task.id});
  h.setBoard({tasks:[task,completed({id:attempts[0].id})],mail:qaMailbox});
  const second=h.act('task-mail-find',{arg:task.id});
  assert.equal(attempts.length,2);
  assert.notEqual(attempts[0].id,attempts[1].id);
  pending[0].reject(Error('late acknowledgement failed'));
  await first;
  await h.act('task-mail-general',{arg:task.id});
  assert.equal(attempts.length,2);
  assert.match(h.scene().mailUI.cardNotes[task.id],/메일/);
  pending[1].resolve({ok:true,id:attempts[1].id});
  await second;
  assert.equal(h.scene().mailUI.cardNotes[task.id],undefined);
});

test('office mail explains an expired connection attempt beside the mailbox without losing the draft', async () => {
  const h=harness({api:{async connectMail(){return {ok:false,code:'MAIL_TIMEOUT'};}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.edit('지난주 견적 메일 찾아줘.');
  await h.act('task-mail-connect',{arg:'outlook'});
  const note=h.scene().mailUI.providerNotes.outlook;
  assert.match(note,/시간/);
  assert.match(note,/다시/);
  assert.doesNotMatch(note,/MAIL_|권한.*거부/);
  assert.equal(h.scene().form.prompt,'지난주 견적 메일 찾아줘.');
  assert.deepEqual(h.submitted,[]);
});

test('mail plan guidance says which search conditions work and how to revise an unsupported request', () => {
  const note=mailCodeText('MAIL_PLAN');
  for(const condition of [/보낸 사람|발신자/,/기간/,/검색어/,/첨부/,/안 읽|읽음|읽지 않/,/별표/,/이름|파일명/,/내용/]){
    assert.match(note,condition);
  }
  assert.match(note,/빼|제외|고쳐|수정/);
  assert.doesNotMatch(note,/MAIL_PLAN/);
});

test('office mail reports a missing original on its saved card and clears the notice on a successful open', async () => {
  let missing=true;
  const h=harness({api:{async openMailResult(){return missing?{ok:false,code:'MAIL_NOT_FOUND'}:{ok:true};}}});
  const task=storedMail();
  h.setBoard({tasks:[task],mail:qaMailbox});
  const target={arg:task.id,fields:{itemId:qaMailItemId}};
  await h.act('task-mail-open',target);
  const note=h.scene().mailUI.sourceNotes[task.id];
  assert.match(note,/메일|원문/);
  assert.match(note,/찾|없/);
  assert.doesNotMatch(note,/MAIL_|권한/);
  assert.deepEqual(h.submitted,[]);
  missing=false;
  await h.act('task-mail-open',target);
  assert.equal(h.scene().mailUI.sourceNotes[task.id],undefined);
});

test('office mail retries and follows a search with the source conditions and the original provider', async () => {
  const task=storedMail();
  const h=harness();
  h.setBoard({tasks:[task],mail:qaMailbox});
  await h.act('task-follow',{arg:task.id});
  assert.equal(h.scene().form.mailSearch,null);
  assert.notEqual(h.scene().form.mailLocked,true);
  await h.submit('보낸 메일까지 포함해 줘.');
  assert.equal(h.submitted[0].previousId,task.id);
  assert.equal(Object.hasOwn(h.submitted[0],'mailSearch'),false);
  assert.equal(h.submitted[0].mailRetry,undefined);
  h.setBoard({tasks:[{...task,status:'failed',reason:'MAIL_CONNECT',answer:'',mailResult:null}],mail:qaMailbox});
  await h.act('task-retry',{arg:task.id});
  assert.equal(h.scene().form.prompt,task.prompt);
  assert.equal(h.scene().form.mailSearch,true);
  await h.submit(h.scene().form.prompt);
  assert.notEqual(h.submitted[1].id,task.id);
  assert.ok(!h.submitted[1].previousId);
  assert.equal(h.submitted[1].mailSearch,true);
  assert.equal(h.submitted[1].mailRetry,undefined);
});

test('office mail can search from a regular result and repeat a partial search without replacing the current draft', async () => {
  const h=harness();
  const plain=completed(), partial=storedMail({id:'10000000-0000-4000-8000-000000000003'});
  h.setBoard({tasks:[plain,partial],mail:qaMailbox});
  await h.edit('다른 직원에게 맡길 글');
  await h.act('task-mail-find',{arg:plain.id});
  assert.equal(h.submitted[0].prompt,plain.prompt);
  assert.equal(h.submitted[0].mailSearch,true);
  assert.ok(!h.submitted[0].previousId);
  await h.act('task-mail-repeat',{arg:partial.id});
  assert.equal(h.submitted[1].prompt,partial.prompt);
  assert.equal(h.submitted[1].previousId,partial.id);
  assert.equal(h.submitted[1].mailSearch,true);
  assert.equal(h.submitted[1].mailRetry,true);
  assert.equal(h.submitted[0].mailRetry,undefined);
  assert.notEqual(h.submitted[1].id,partial.id);
  assert.equal(h.scene().form.prompt,'다른 직원에게 맡길 글');
  await h.act('task-mail-repeat',{arg:plain.id});
  assert.equal(h.submitted.length,2);
});

test('office mail ignores an old member connection reply and allows only one pending connection', async () => {
  let finish;
  const calls=[];
  const h=harness({api:{connectMail(id){calls.push(id);return new Promise(r=>{finish=r;});}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  const pending=h.act('task-mail-connect',{arg:'outlook'});
  await h.act('task-mail-connect',{arg:'outlook'});
  assert.deepEqual(calls,['outlook']);
  h.room.reset();
  h.setBoard({tasks:[],mail:{providers:[]}});
  finish({ok:false,code:'MAIL_RECONNECT'});
  await pending;
  assert.ok(!h.scene().mailUI.providerNotes?.outlook);
  assert.deepEqual(h.submitted,[]);
});

test('office mail distinguishes uncertain automatic and explicit submissions of the same draft', async () => {
  const attempts=[];
  const h=harness({api:{async submitTask(value){attempts.push({...value});throw Error('Lost acknowledgement');}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.submit('거래처 문의를 찾아줘.');
  await h.act('task-mail-mode',{fields:{enabled:true}});
  await h.submit('거래처 문의를 찾아줘.');
  await h.act('task-mail-mode',{fields:{enabled:false}});
  await h.submit('거래처 문의를 찾아줘.');
  assert.notEqual(attempts[0].id,attempts[1].id);
  assert.equal(new Set(attempts.map(value=>value.id)).size,3);
  assert.equal(attempts[1].mailSearch,true);
  assert.equal(attempts[2].mailSearch,false);
  await h.act('task-mail-mode',{fields:{enabled:null}});
  await h.submit('거래처 문의를 찾아줘.');
  assert.equal(Object.hasOwn(attempts[3],'mailSearch'),false);
  assert.equal(attempts[0].id,attempts[3].id);
});

test('office mail can assign an ambiguous request as an ordinary GPT task or explicitly search the mailbox', async () => {
  const h=harness();
  const mixed=storedMail({status:'failed',reason:'MAIL_CHOOSE',mailResult:null,answer:'',prompt:'이메일 인증 코드에서 버그 찾아줘.'});
  h.setBoard({tasks:[mixed],mail:qaMailbox});
  await h.act('task-retry',{arg:mixed.id});
  assert.equal(h.scene().form.mailSearch,null);
  assert.equal(h.submitted.length,0);
  await h.act('task-mail-general',{arg:mixed.id});
  await h.act('task-mail-find',{arg:mixed.id});
  assert.equal(h.submitted.length,2);
  for (const [i,req] of h.submitted.entries()) {
    assert.equal(req.mailSearch,i===1);
    assert.equal(req.prompt,mixed.prompt);
    assert.equal(req.provider,'codex');
    assert.ok(!req.previousId);
    assert.equal(Object.hasOwn(req,'mailResult'),false);
    assert.equal(Object.hasOwn(req,'mailRetry'),false);
    assert.notEqual(req.id,mixed.id);
  }
  assert.notEqual(h.submitted[0].id,h.submitted[1].id);
});

test('office mail lets a member choose ordinary work on a follow-up without including saved mail in the request', async () => {
  const h=harness();
  for (const original of [storedMail(),completed({mailSearch:false})]) {
    h.setBoard({tasks:[original],mail:qaMailbox});
    await h.act('task-follow',{arg:original.id});
    assert.notEqual(h.scene().form.mailSearch,true);
    await h.act('task-mail-mode',{fields:{enabled:false}});
    await h.submit('이메일 인증 코드에서 버그 찾아줘.');
    const sent=h.submitted.at(-1);
    assert.equal(sent.mailSearch,false);
    assert.equal(sent.previousId,original.id);
    assert.deepEqual(Object.keys(sent).sort(),['departmentId','id','mailSearch','previousId','prompt','provider']);
  }
});

test('office mail preserves a changed mode and the typed text when the first acknowledgement arrives late', async () => {
  let finish;
  const pending=[];
  const h=harness({api:{submitTask(value){pending.push(value);return new Promise(resolve=>{finish=resolve;});}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  const text='이메일 관련 테스트 코드를 작성해 줘.';
  const first=h.submit(text);
  await h.act('task-mail-mode',{fields:{enabled:false}});
  finish({ok:true,id:pending[0].id});
  await first;
  assert.equal(h.scene().form.prompt,text);
  assert.equal(h.scene().form.mailSearch,false);
});

test('office mail keeps one retry id if a partial search acknowledgement was lost', async () => {
  const attempts=[];
  let rejectFirst;
  const h=harness({api:{submitTask(value){
    attempts.push({...value});
    if(attempts.length===1)return new Promise((_,reject)=>{rejectFirst=reject;});
    return Promise.resolve({ok:true,id:value.id});
  }}});
  const task=storedMail();
  h.setBoard({tasks:[task],mail:qaMailbox});
  const first=h.act('task-mail-repeat',{arg:task.id});
  await h.act('task-mail-repeat',{arg:task.id});
  assert.equal(attempts.length,1);
  rejectFirst(Error('Lost acknowledgement'));
  await first;
  await h.act('task-mail-repeat',{arg:task.id});
  assert.equal(attempts.length,2);
  assert.equal(attempts[1].id,attempts[0].id);
  assert.equal(attempts[1].mailRetry,true);
});

test('office mail identifies a signed-in Microsoft identity that has no Outlook mailbox', async () => {
  const h=harness({api:{async connectMail(){return {ok:false,code:'MAIL_NO_MAILBOX'};}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.act('task-mail-connect',{arg:'outlook'});
  assert.match(h.scene().mailUI.providerNotes.outlook,/Outlook.*메일함/);
  assert.deepEqual(h.submitted,[]);
});

test('office mail can choose either outcome of an ambiguous follow-up while retaining its original parent and department', async () => {
  for (const wasMail of [false,true]) {
    const h=harness();
    const parent=completed({mailSearch:wasMail});
    const source=storedMail({
      id:'10000000-0000-4000-8000-000000000008',status:'failed',reason:'MAIL_CHOOSE',
      previousId:parent.id,departmentId:parent.departmentId,answer:'',mailResult:null,
    });
    h.setBoard({tasks:[source,parent],mail:qaMailbox});
    await h.act('task-mail-general',{arg:source.id});
    await h.act('task-mail-find',{arg:source.id});
    assert.equal(h.submitted.length,2);
    for (const [i,payload] of h.submitted.entries()) {
      assert.equal(payload.previousId,parent.id);
      assert.equal(payload.departmentId,parent.departmentId);
      assert.equal(payload.prompt,source.prompt);
      assert.equal(payload.mailSearch,Boolean(i));
      assert.equal(Object.hasOwn(payload,'mailRetry'),false);
    }
    h.setBoard({tasks:[source,{...parent,departmentId:'other'}],mail:qaMailbox});
    await h.act('task-mail-find',{arg:source.id});
    assert.ok(!h.submitted.at(-1).previousId);
  }
});

test('office mail clears a pending connection and status when mailbox access is removed and restored', async () => {
  let finish;
  const h=harness({api:{connectMail(){return new Promise(resolve=>{finish=resolve;});}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.act('task-mail-mode',{fields:{enabled:false}});
  const pending=h.act('task-mail-connect',{arg:'outlook'});
  h.setBoard({tasks:[]});
  h.setBoard({tasks:[],mail:qaMailbox});
  finish({ok:false,code:'MAIL_CANCELLED'});
  await pending;
  assert.equal(h.scene().mailUI.pendingProvider,null);
  assert.ok(!h.scene().mailUI.providerNotes?.outlook);
  assert.notEqual(h.scene().form.mailSearch,false);
});

test('choosing a quote handoff while following a normal task starts an independent GPT mail request', async () => {
  const parent = completed();
  const h = harness();
  h.setBoard({tasks:[parent],mail:qaMailbox});
  await h.act('task-follow',{arg:parent.id});
  await h.act('task-mail-mode',{fields:{enabled:'quote'}});
  await h.submit('');
  assert.equal(h.submitted.length,1);
  const sent = h.submitted[0];
  assert.equal(sent.provider,'codex');
  assert.equal(sent.mailSearch,true);
  assert.equal(sent.quoteHandoff,true);
  assert.equal(Object.hasOwn(sent,'previousId'),false);
  assert.match(sent.prompt,/견적/);
  assert.equal(h.scene().form.mailSearch,null);
});

test('a lost handoff acknowledgement reuses its id and clears the default empty draft on snapshot recovery', async () => {
  const attempts=[];
  const h=harness({api:{async submitTask(request){attempts.push({...request});throw Error('Lost acknowledgement');}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.act('task-mail-mode',{fields:{enabled:'quote'}});
  await h.submit('');
  await h.submit('');
  assert.equal(attempts.length,2);
  assert.equal(attempts[1].id,attempts[0].id);
  const recovered=h.setBoard({tasks:[completed({...attempts[0],status:'queued',answer:''})],mail:qaMailbox});
  assert.equal(recovered.form.prompt,'');
  assert.equal(recovered.form.mailSearch,null);
});

test('a late handoff acknowledgement preserves the next explicit ordinary search and its Korean draft', async () => {
  let finish;
  const attempts=[];
  const h=harness({api:{submitTask(input){attempts.push({...input});return new Promise(r=>{finish=r;});}}});
  h.setBoard({tasks:[],mail:qaMailbox});
  await h.act('task-provider',{arg:'codex'});
  await h.act('task-mail-mode',{fields:{enabled:'quote'}});
  const outgoing=h.submit('');
  await Promise.resolve();
  assert.equal(attempts.length,1);
  await h.act('task-mail-mode',{fields:{enabled:true}});
  await h.edit('다음 주에 받은 제안서를 찾아줘.');
  finish({ok:true,id:attempts[0].id});
  await outgoing;
  assert.equal(h.scene().form.mailSearch,true);
  assert.equal(h.scene().form.prompt,'다음 주에 받은 제안서를 찾아줘.');
});

test('only a failed GPT quote recipient with retry capability can resume its existing card', async () => {
  const source={parentId:completedId,itemId:'20000000-0000-4000-8000-000000000004'};
  for (const [extra,allowed] of [
    [{quoteSource:source,canRetry:true},true],
    [{quoteSource:source,canRetry:false},false],
    [{canRetry:true},false],
    [{provider:'claude',quoteSource:source,canRetry:true},false],
    [{status:'completed',quoteSource:source,canRetry:true},false],
  ]) {
    const task=completed({status:'failed',answer:'',...extra});
    const h=harness({tasks:[task]});
    h.setBoard({tasks:[task],mail:qaMailbox});
    await h.act('task-resume',{arg:task.id});
    assert.deepEqual(h.actions,allowed?[[task.id,'resume']]:[]);
    assert.equal(h.submitted.length,0);
  }
});

test('continuing a partially searched quote survey starts a fresh handoff at that survey’s mailbox cursor', async () => {
  const source=storedMail({quoteHandoff:true,prompt:'미회신 견적 문의를 조사해서 넘겨줘.'});
  const h=harness();
  h.setBoard({tasks:[source],mail:qaMailbox});
  await h.act('task-follow',{arg:source.id});
  assert.equal(h.scene().form.previousId,null);
  await h.act('task-mail-repeat',{arg:source.id});
  assert.equal(h.submitted.length,1);
  const {id,...fields}=h.submitted[0];
  assert.ok(id && id!==source.id);
  assert.deepEqual(fields,{
    provider:'codex',departmentId:source.departmentId,prompt:source.prompt,mailSearch:true,
    quoteHandoff:true,quoteResumeOf:source.id,previousId:null,
  });
  const complete={...source,mailResult:{groups:[{provider:'gmail',items:[],more:false}]}};
  h.setBoard({tasks:[complete],mail:qaMailbox});
  await h.act('task-mail-repeat',{arg:source.id});
  assert.equal(h.submitted.length,1);
  h.setBoard({tasks:[{...complete,quoteCanResume:true}],mail:qaMailbox});
  await h.act('task-mail-repeat',{arg:source.id});
  assert.equal(h.submitted.length,2);
  assert.equal(h.submitted[1].quoteResumeOf,source.id);
  assert.notEqual(h.submitted[1].id,h.submitted[0].id);
});

test('retrying an unacknowledged quote survey continuation keeps the same request ID and survey cursor', async () => {
  const attempts=[];
  const h=harness({api:{async submitTask(request){
    attempts.push({...request});
    if (attempts.length===1) throw Error('Response lost');
    return {ok:true,id:request.id};
  }}});
  const source=storedMail({quoteHandoff:true});
  h.setBoard({tasks:[source],mail:qaMailbox});
  await h.act('task-mail-repeat',{arg:source.id});
  await h.act('task-mail-repeat',{arg:source.id});
  assert.equal(attempts.length,2);
  assert.deepEqual(attempts[0],attempts[1]);
  assert.notEqual(attempts[0].id,source.id);
  assert.equal(attempts[0].quoteResumeOf,source.id);
  assert.equal(attempts[0].quoteHandoff,true);
});

test('a missing quote original is scoped to its task and item while the ordinary parent retains its last note', async () => {
  const secondId='20000000-0000-4000-8000-000000000008';
  let firstMissing=true;
  const h=harness({api:{async openMailResult(_task,itemId){
    return firstMissing && itemId===qaMailItemId ? {ok:false,code:'MAIL_NOT_FOUND'} : {ok:true};
  }}});
  const scan=storedMail({quoteHandoff:true});
  scan.mailResult.groups[0].items.push({id:secondId,subject:'두 번째 견적 문의'});
  h.setBoard({tasks:[scan],mail:qaMailbox});
  const open=itemId=>h.act('task-mail-open',{arg:scan.id,fields:{itemId}});
  const key=itemId=>JSON.stringify([scan.id,itemId]);
  await open(qaMailItemId);
  assert.match(h.scene().mailUI.sourceNotes[scan.id],/찾|없/);
  assert.match(h.scene().mailUI.sourceItemNotes?.[key(qaMailItemId)]||'',/찾|없/);
  assert.equal(h.scene().mailUI.sourceItemNotes[key(secondId)],undefined);
  await open(secondId);
  assert.equal(h.scene().mailUI.sourceNotes[scan.id],undefined);
  assert.match(h.scene().mailUI.sourceItemNotes[key(qaMailItemId)],/찾|없/);
  firstMissing=false;
  await open(qaMailItemId);
  assert.equal(h.scene().mailUI.sourceItemNotes[key(qaMailItemId)],undefined);
});

// Each saved ordinary mail group owns its own page. An old receipt starts at the
// same public page 0 as a new one, without giving the screen a provider cursor.
const pagedMailboxes = { providers: [
  {id: 'gmail', configured: true, connected: true, address: 'studio@example.test'},
  {id: 'outlook', configured: true, connected: true, address: 'orders@example.test'},
] };

function pagedMail() {
  const task = storedMail();
  task.mailResult.groups = task.mailResult.groups.map(group => ({
    provider: group.provider, address: group.address, items: group.items, more: true, page: 0,
  }));
  return task;
}

function pageClick(h, provider, expectedPage, arg = completedId) {
  return h.act('task-mail-more', {arg, fields: {provider, expectedPage}});
}

test('mail pagination dispatches the saved task, mailbox and revision and suppresses repeat clicks independently', async () => {
  const task = pagedMail();
  const resolve = {};
  const calls = [];
  let reads = 0;
  const h = harness({
    api: {moreMail(...args) {
      calls.push(args);
      return new Promise(done => { resolve[args[1]] = done; });
    }},
    reread() { reads += 1; },
  });
  h.setBoard({tasks: [task], mail: pagedMailboxes});
  await h.act('task-provider', {arg: 'claude'});
  const gmail = pageClick(h, 'gmail', 0), outlook = pageClick(h, 'outlook', 0);
  await pageClick(h, 'gmail', 0);
  await pageClick(h, 'outlook', 0);
  assert.deepEqual(calls, [[task.id, 'gmail', 0], [task.id, 'outlook', 0]]);
  assert.equal(h.scene().mailUI.pageByTask[task.id].gmail.busy, true);
  assert.equal(h.scene().mailUI.pageByTask[task.id].outlook.busy, true);
  resolve.outlook({ok: false, code: 'MAIL_NETWORK'});
  await outlook;
  assert.match(h.scene().mailUI.pageByTask[task.id].outlook.notice, /네트워크|연결/);
  assert.equal(h.scene().mailUI.pageByTask[task.id].gmail.busy, true);
  const retry = pageClick(h, 'outlook', 0);
  assert.deepEqual(calls[2], [task.id, 'outlook', 0]);
  resolve.outlook({ok: true});
  resolve.gmail({ok: true});
  await Promise.all([gmail, retry]);
  assert.equal(reads, 2);
  assert.deepEqual(h.submitted, []);
  assert.deepEqual(h.actions, []);
});

test('mail pagination admits only a saved ordinary page and preserves results following an account change', async () => {
  const task = pagedMail();
  const calls = [];
  const h = harness({api: {async moreMail(...args) { calls.push(args); return {ok: true}; }}});
  const stage = (row = task, mail = pagedMailboxes) => h.setBoard({tasks: [row], mail});
  stage();
  for (const [provider, page, id] of [
    ['outlook', 2, task.id], ['gmail', -1, task.id], ['gmail', '0', task.id],
    ['gmail', 0.5, task.id], ['other', 0, task.id], ['gmail', 0, qaMailItemId],
  ]) await pageClick(h, provider, page, id);
  for (const state of [{provider: 'claude'}, {status: 'running'}, {mailSearch: false}, {viaTerminal: true}, {quoteHandoff: true}]) {
    stage({...task, ...state});
    await pageClick(h, 'gmail', 0);
  }
  for (const change of [{page: undefined}, {more: false}]) {
    const row = pagedMail();
    Object.assign(row.mailResult.groups[0], change);
    stage(row);
    await pageClick(h, 'gmail', 0);
  }
  h.setBoard({tasks: [task]});
  await pageClick(h, 'gmail', 0);
  assert.deepEqual(calls, []);
  const otherAccount = {providers: pagedMailboxes.providers.map(p => p.id === 'gmail' ? {...p, address: 'other@example.test'} : p)};
  stage(task, otherAccount);
  await pageClick(h, 'gmail', 0);
  assert.deepEqual(calls, []);
  assert.deepEqual(task.mailResult.groups[0].items.map(item => item.id), [qaMailItemId]);
  const newTask = {...pagedMail(), id: 'feb34500-0000-4000-8000-000000000001'};
  stage(newTask);
  await pageClick(h, 'gmail', 0, newTask.id);
  assert.deepEqual(calls, [[newTask.id, 'gmail', 0]]);
});

test('mail pagination follows a new revision even without new rows and discards late feedback after a member change', async () => {
  const task = pagedMail(), calls = [];
  let settle, reads = 0;
  const h = harness({
    api: {moreMail(...args) { calls.push(args); return new Promise(resolve => {settle = resolve;}); }},
    reread() { reads += 1; },
  });
  h.setBoard({tasks: [task], mail: pagedMailboxes});
  const first = pageClick(h, 'gmail', 0);
  assert.deepEqual(calls, [[task.id, 'gmail', 0]]);
  task.mailResult.groups[0].page += 1;
  h.setBoard({tasks: [task], mail: pagedMailboxes});
  settle({ok: true});
  await first;
  await pageClick(h, 'gmail', 0);
  const second = pageClick(h, 'gmail', 1);
  assert.deepEqual(calls, [[task.id, 'gmail', 0], [task.id, 'gmail', 1]]);
  h.room.reset();
  h.setBoard({tasks: [], mail: pagedMailboxes});
  settle({ok: false, code: 'MAIL_CHANGED'});
  await second;
  assert.equal(h.scene().mailUI.pageByTask[task.id], undefined);
  assert.equal(reads, 1);
});

test('mail pagination distinguishes an old page that cannot resume from a temporary error', async () => {
  const task = pagedMail();
  const h = harness({api: {async moreMail() {return {ok: false, code: 'MAIL_PAGE_RESTART'};}}});
  h.setBoard({tasks:[task],mail:pagedMailboxes});
  await pageClick(h, 'gmail', 0);
  const note=h.scene().mailUI.pageByTask[task.id].gmail.notice;
  assert.match(note,/다시/);
  assert.match(note,/찾|검색|조회/);
  assert.doesNotMatch(note,/MAIL_PAGE_RESTART|네트워크/);
  assert.deepEqual(task.mailResult.groups[0].items.map(item=>item.id),[qaMailItemId]);
  assert.deepEqual(h.submitted,[]);
});

test('mail pagination stays busy while the accepted page is being read back', async () => {
  let finishRead;
  let enteredRead;
  const reading = new Promise(resolve => { enteredRead = resolve; });
  const calls = [];
  const task = pagedMail();
  const h = harness({
    api: { async moreMail(...args) { calls.push(args); return {ok: true}; } },
    reread() {
      enteredRead();
      return new Promise(resolve => { finishRead = resolve; });
    },
  });
  h.setBoard({tasks: [task], mail: pagedMailboxes});
  const first = pageClick(h, 'gmail', 0);
  await reading;
  let duplicate;
  try {
    assert.equal(h.scene().mailUI.pageByTask[task.id].gmail.busy, true);
    duplicate = pageClick(h, 'gmail', 0);
    assert.deepEqual(calls, [[task.id, 'gmail', 0]]);
  } finally {
    finishRead();
  }
  await Promise.all([first, duplicate]);
});
