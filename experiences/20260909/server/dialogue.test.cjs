'use strict';
// Independent behavior tests with injected providers. No model, downloads, remote API, or 4399 server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createDialogueService, conversationContext } = require('./dialogue.cjs');
const { createExperienceServer } = require('../server.cjs');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  const end = Date.now() + 1500;
  while (!predicate()) { if (Date.now() > end) throw new Error('The expected cancellation/state change did not arrive'); await sleep(5); }
}
const waitForAbort = signal => new Promise((resolve, reject) => {
  const abort = () => reject(Object.assign(new Error('provider aborted'), { name: 'AbortError' }));
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
});
function provider({ available = true, ready = true, stream } = {}) {
  const calls = [], signals = [];
  let closes = 0;
  return {
    calls, signals, get closes() { return closes; },
    status: () => ({ available, ready, mode: 'local-ai', label: '이 기기에서 생성하는 AI 대화', model: 'test-provider' }),
    async *stream(messages, options) {
      calls.push(structuredClone(messages)); signals.push(options.signal);
      if (stream) yield* stream(messages, options, calls.length);
      else for (const piece of ['함께', ' ', '살펴봐요.']) yield piece;
    },
    close() { closes++; },
  };
}
function actorState(id = 'player-a', code = 'ABC234') {
  return { code, me: { id, role: 'signal' }, roles: [{ id: 'signal', title: '전차 정비사' }], phase: 'explore', objective: '전차와 방송국을 살펴보세요.', privateClues: [], sharedClues: [], restoration: { power: { solved: false }, radio: { solved: false } }, ending: null };
}
async function reply(service, state, text = '어디로 갈까요?', options = {}) {
  const events = [];
  await service.reply({ state, text, send: (event, data) => events.push({ event, data }), ...options });
  return events;
}
async function fixture(t, supplied = provider()) {
  const app = createExperienceServer({ dialogueProvider: supplied });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (route, body, token, extra = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra.headers }, body: JSON.stringify(body), signal: extra.signal });
  const create = async () => (await (await post('/api/rooms', { name: '정비사', role: 'signal' })).json());
  const join = async code => (await (await post(`/api/rooms/${code}/join`, { name: '기록원', role: 'archive' })).json());
  const action = async (person, type, payload = {}) => {
    const response = await post(`/api/rooms/${person.code}/actions`, { type, payload }, person.token);
    return { status: response.status, body: await response.json() };
  };
  const chat = (person, text = '지금 무엇을 살펴볼까요?', extra = {}) => post(`/api/rooms/${person.code}/dialogue`, { text }, person.token, extra);
  const status = person => fetch(`${base}/api/rooms/${person.code}/dialogue`, { headers: { Authorization: `Bearer ${person.token}` } });
  const host = await create(), other = await join(host.code);
  return { app, base, supplied, post, create, host, other, action, chat, status };
}
function events(text) {
  return text.split('\n\n').filter(Boolean).map(block => {
    const lines = block.split('\n'), event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.find(line => line.startsWith('data:'))?.slice(5).trim();
    return { event, data: data ? JSON.parse(data) : null };
  });
}
async function finishStory(f) {
  await f.action(f.host, 'inspect', { objectId: 'tram' });
  for (const [index, rotation] of [[0, 3], [1, 1], [2, 2]]) await f.action(f.host, 'restore', { kind: 'power', index, rotation });
  await f.action(f.other, 'inspect', { objectId: 'radio' });
  await f.action(f.other, 'restore', { kind: 'radio', frequency: 96.4 });
  for (const person of [f.host, f.other]) await f.action(person, 'vote', { choiceId: 'homes' });
  assert.equal((await f.action(f.host, 'finalize')).body.state.phase, 'ended');
}

test('streamed Korean preserves standalone spaces and declares a generated answer only on completion', async t => {
  const p = provider({ ready: false, stream: async function* () { for (const piece of ['오늘은', ' ', '함께', '\n', '살펴봐요.']) yield piece; } });
  const service = createDialogueService({ provider: p }); t.after(() => service.close());
  const result = await reply(service, actorState());
  assert.match(result[0].data.message, /첫 대화|준비/);
  assert.equal(result.filter(item => item.event === 'delta').map(item => item.data.text).join(''), '오늘은 함께\n살펴봐요.');
  assert.deepEqual(result.at(-1), { event: 'done', data: { mode: 'local-ai', speaker: '다온', text: '오늘은 함께\n살펴봐요.', generated: true } });
  assert.equal(result.filter(item => item.event === 'done').length, 1);
});

test('context consumes only actor-visible clues, leaving solutions, credentials, and undisclosed branches out', () => {
  const state = actorState();
  state.privateClues = [{ id: 'mine', title: '내 기록', text: 'MINE_VISIBLE_CANARY' }];
  state.sharedClues = [{ id: 'ours', title: '함께 읽은 기록', text: 'SHARED_VISIBLE_CANARY' }];
  state.otherPrivateClues = [{ text: 'OTHER_PRIVATE_CANARY' }];
  state.choiceOptions = [{ description: 'UNSEEN_BRANCH_CANARY' }];
  state.me.token = 'TOKEN_CANARY'; state.solution = 'SOLUTION_CANARY';
  const prompt = conversationContext(state);
  assert.match(prompt, /MINE_VISIBLE_CANARY/); assert.match(prompt, /SHARED_VISIBLE_CANARY/);
  for (const forbidden of ['OTHER_PRIVATE_CANARY','UNSEEN_BRANCH_CANARY','TOKEN_CANARY','SOLUTION_CANARY']) assert.equal(prompt.includes(forbidden), false);
  state.ending = { title: '우리가 마친 밤', body: 'FINISHED_ENDING_CANARY' };
  assert.match(conversationContext(state), /FINISHED_ENDING_CANARY/);
});

test('history belongs to one role in one room and forgetRoom clears it', async t => {
  const p = provider(), service = createDialogueService({ provider: p }); t.after(() => service.close());
  await reply(service, actorState(), '나만 남긴 첫 문장'); await reply(service, actorState(), '내 두 번째 문장');
  assert.equal(p.calls[1].length, 4); assert.match(JSON.stringify(p.calls[1]), /나만 남긴 첫 문장/);
  await reply(service, actorState('player-b'), '다른 역할의 질문');
  assert.equal(p.calls[2].length, 2); assert.equal(JSON.stringify(p.calls[2]).includes('나만 남긴 첫 문장'), false);
  await reply(service, actorState('player-a', 'DEF567'), '다른 방의 질문'); assert.equal(p.calls[3].length, 2);
  service.forgetRoom('ABC234'); await reply(service, actorState(), '처음부터 다시');
  assert.equal(p.calls[4].length, 2); assert.equal(JSON.stringify(p.calls[4]).includes('나만 남긴 첫 문장'), false);
});

test('empty or oversized input and an unavailable model fail before any model call', async t => {
  const p = provider(), service = createDialogueService({ provider: p }); t.after(() => service.close());
  for (const text of ['', '  ', '가'.repeat(501)]) await assert.rejects(reply(service, actorState(), text), error => error.status === 400);
  assert.equal(p.calls.length, 0);
  const unavailable = provider({ available: false, ready: false }), offline = createDialogueService({ provider: unavailable }); t.after(() => offline.close());
  await assert.rejects(reply(offline, actorState()), error => error.status === 503 && /단계 힌트/.test(error.message));
  assert.equal(unavailable.calls.length, 0);
});

test('an in-flight request rejects duplicate callers and releases its slot after cancellation', async t => {
  const p = provider({ stream: async function* (_messages, { signal }, count) { if (count === 1) await waitForAbort(signal); else yield '다시 이어가요.'; } });
  const service = createDialogueService({ provider: p }); t.after(() => service.close());
  const controller = new AbortController(), first = reply(service, actorState(), '기다리는 질문', { signal: controller.signal });
  const canceled = assert.rejects(first, error => error.status === 409 && !/대기 시간/.test(error.message));
  await until(() => p.calls.length === 1);
  await assert.rejects(reply(service, actorState(), '겹친 질문'), error => error.status === 429);
  controller.abort(); await canceled;
  const result = await reply(service, actorState(), '다시 할 질문'); assert.equal(result.at(-1).event, 'done');
  assert.equal(p.calls[1].length, 2, 'canceled partial turns are not saved as completed history');
});

test('a waiting timeout stops the provider without claiming that an answer completed', async t => {
  const p = provider({ stream: async function* (_messages, { signal }) { await waitForAbort(signal); } });
  const service = createDialogueService({ provider: p, timeoutMs: 30 }); t.after(() => service.close());
  const sent = [];
  await assert.rejects(reply(service, actorState(), '조금 기다릴게요.', { send: (event, data) => sent.push({ event, data }) }), error => error.status === 504 && /대기 시간/.test(error.message));
  assert.equal(p.signals[0].aborted, true); assert.equal(sent.some(item => item.event === 'done'), false);
});

test('stale role or room state cannot finish a streamed reply', async t => {
  let valid = true;
  const p = provider({ stream: async function* () { yield '앞부분'; valid = false; yield '이미 바뀐 상태의 뒷부분'; } });
  const service = createDialogueService({ provider: p }); t.after(() => service.close());
  const sent = [];
  await assert.rejects(reply(service, actorState(), '살펴봐 주세요.', { stillValid: () => valid, send: (event, data) => sent.push({ event, data }) }), error => error.status === 409);
  assert.equal(sent.some(item => item.event === 'done'), false);
  assert.equal(sent.some(item => item.data?.text?.includes('이미 바뀐 상태')), false);
});

test('HTTP status and dialogue enforce room authentication and a started story', async t => {
  const f = await fixture(t), unrelated = await f.create();
  for (const token of ['', 'bad-token', unrelated.token]) {
    assert.equal((await f.status({ ...f.host, token })).status, 401);
    assert.equal((await f.chat({ ...f.host, token })).status, 401);
  }
  assert.equal((await f.chat(f.host)).status, 409);
  assert.equal(f.supplied.calls.length, 0);
  const status = await (await f.status(f.host)).json(); assert.equal(status.available, true); assert.equal(status.mode, 'local-ai');
  await f.action(f.host, 'start');
  assert.equal((await f.chat(f.host, '질문', { headers: { Origin: 'https://unrelated.invalid' } })).status, 403);
  assert.equal((await f.post(`/api/rooms/${f.host.code}/dialogue`, { text: '' }, f.host.token)).status, 400);
  assert.equal(f.supplied.calls.length, 0);
});

test('HTTP prompts reveal another role clue only after that role shares it', async t => {
  const f = await fixture(t); await f.action(f.host, 'start');
  const own = (await f.action(f.host, 'inspect', { objectId: 'tram' })).body.state.privateClues;
  const theirs = (await f.action(f.other, 'inspect', { objectId: 'radio' })).body.state.privateClues;
  let response = await f.chat(f.host); assert.equal(response.status, 200); const initial = events(await response.text());
  assert.equal(initial.at(-1).event, 'done'); assert.equal(initial.at(-1).data.generated, true);
  let prompt = f.supplied.calls[0][0].content;
  for (const clue of own) assert.equal(prompt.includes(clue.text), true);
  for (const clue of theirs) assert.equal(prompt.includes(clue.text), false);
  assert.equal(JSON.stringify(f.supplied.calls).includes(f.other.token), false);
  await f.action(f.other, 'share', { clueId: theirs[0].id });
  response = await f.chat(f.host); await response.text(); prompt = f.supplied.calls[1][0].content;
  assert.equal(prompt.includes(theirs[0].text), true); assert.equal(prompt.includes(theirs[1].text), false);
});

test('HTTP client cancellation aborts the provider and allows another turn', async t => {
  const p = provider({ stream: async function* (_messages, { signal }, count) { if (count === 1) await waitForAbort(signal); else yield '새 답변입니다.'; } });
  const f = await fixture(t, p); await f.action(f.host, 'start');
  const controller = new AbortController(), response = await f.chat(f.host, '취소할 질문', { signal: controller.signal });
  assert.equal(response.status, 200); const reader = response.body.getReader(); await reader.read(); controller.abort();
  await until(() => p.signals[0]?.aborted); await sleep(15);
  const retry = await f.chat(f.host, '새 질문'); assert.equal(retry.status, 200); assert.equal(events(await retry.text()).at(-1).event, 'done');
  assert.equal(p.calls[1].length, 2);
});

test('reset aborts a streamed answer and clears the old room conversation before restart', async t => {
  const p = provider({ stream: async function* (_messages, { signal }, count) { if (count === 2) await waitForAbort(signal); else yield count === 1 ? '지난 밤의 답변' : '새로운 밤의 답변'; } });
  const f = await fixture(t, p); await f.action(f.host, 'start');
  await (await f.chat(f.host, '지워져야 할 지난 대화')).text(); await finishStory(f);
  const pending = await f.chat(f.host, '초기화 중인 질문'); const text = pending.text();
  assert.equal((await f.action(f.host, 'reset')).body.state.phase, 'lobby');
  const canceled = events(await text); assert.equal(p.signals[1].aborted, true);
  assert.equal(canceled.some(item => item.event === 'done'), false); assert.equal(canceled.at(-1).event, 'error');
  await f.action(f.host, 'start'); await (await f.chat(f.host, '새롭게 시작한 질문')).text();
  assert.equal(p.calls[2].length, 2); assert.equal(JSON.stringify(p.calls[2]).includes('지워져야 할 지난 대화'), false);
});

test('unavailable and failed providers are reported as unavailable or failed, never as authored AI answers', async t => {
  const unavailable = await fixture(t, provider({ available: false, ready: false })); await unavailable.action(unavailable.host, 'start');
  const status = await (await unavailable.status(unavailable.host)).json(); assert.equal(status.available, false); assert.equal(status.ready, false);
  const offline = await unavailable.chat(unavailable.host); assert.equal(offline.status, 503); assert.match((await offline.json()).error, /단계 힌트/);
  assert.equal(unavailable.supplied.calls.length, 0);
  const failed = await fixture(t, provider({ stream: async function* () { throw new Error('INTERNAL_FAILURE_CANARY'); } })); await failed.action(failed.host, 'start');
  const response = await failed.chat(failed.host), result = events(await response.text());
  assert.equal(result.at(-1).event, 'error'); assert.equal(result.some(item => item.event === 'done'), false);
  assert.equal(JSON.stringify(result).includes('INTERNAL_FAILURE_CANARY'), false);
});

// Exercise the real startup implementation with inert OS/process boundaries.
// This never starts llama.cpp or talks to any local/remote endpoint.
function startupFixture() {
  const fs = require('node:fs'), vm = require('node:vm'), { EventEmitter } = require('node:events'), { Readable } = require('node:stream');
  const children = [], healthRequests = [], module = { exports: {} };
  const fakeNet = { createServer() {
    const socket = new EventEmitter();
    socket.listen = (_port, _host, callback) => { queueMicrotask(callback); return socket; };
    socket.address = () => ({ port: 44880 + children.length });
    socket.close = callback => queueMicrotask(callback);
    return socket;
  } };
  const context = {
    module, exports: module.exports, process: { env: { LOCALAPPDATA: 'C:/synk-in-memory-fixture' } },
    AbortController, AbortSignal, TextDecoder, setTimeout, clearTimeout,
    require(name) {
      if (name === 'node:fs') return { existsSync: () => true };
      if (name === 'node:net') return fakeNet;
      if (name === 'node:child_process') return { spawn() {
        const child = new EventEmitter(); child.exitCode = null; child.kills = 0;
        child.kill = () => { child.kills++; child.exitCode = 1; child.emit('exit', 1); return true; };
        children.push(child); return child;
      } };
      return require(name);
    },
    async fetch(url, options) {
      if (url.endsWith('/health')) return new Promise((resolve, reject) => {
        const abort = () => reject(Object.assign(new Error('mock health aborted'), { name: 'AbortError' }));
        options.signal.addEventListener('abort', abort, { once: true });
        healthRequests.push({ signal: options.signal, ready() { options.signal.removeEventListener('abort', abort); resolve({ ok: true }); } });
        if (options.signal.aborted) abort();
      });
      return { ok: true, body: Readable.from([Buffer.from('data: {"choices":[{"delta":{"content":"동료의 답변입니다."}}]}\n\ndata: [DONE]\n\n')]) };
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./dialogue.cjs'), 'utf8'), context);
  return { provider: module.exports.createLocalProvider(), children, healthRequests };
}
async function consumeLocal(provider, signal) { const pieces = []; for await (const piece of provider.stream([], { signal })) pieces.push(piece); return pieces.join(''); }

test('canceling one shared cold-start wait leaves the companion request and process alive', async t => {
  const f = startupFixture(); t.after(() => f.provider.close());
  const a = new AbortController(), b = new AbortController();
  const first = consumeLocal(f.provider, a.signal), canceled = assert.rejects(first, error => error.status === 499);
  const companion = consumeLocal(f.provider, b.signal);
  await until(() => f.healthRequests.length === 1); a.abort(); await canceled;
  assert.equal(f.children.length, 1); assert.equal(f.children[0].kills, 0);
  assert.equal(f.healthRequests[0].signal.aborted, false); assert.equal(b.signal.aborted, false);
  f.healthRequests[0].ready(); assert.equal(await companion, '동료의 답변입니다.');
  assert.equal(f.provider.status().ready, true);
});

test('the last canceled startup waiter releases loading and a later request starts afresh', async t => {
  const f = startupFixture(); t.after(() => f.provider.close());
  const a = new AbortController(), b = new AbortController();
  const canceled = [assert.rejects(consumeLocal(f.provider, a.signal), error => error.status === 499), assert.rejects(consumeLocal(f.provider, b.signal), error => error.status === 499)];
  await until(() => f.healthRequests.length === 1); a.abort(); b.abort(); await Promise.all(canceled);
  assert.equal(f.children[0].kills, 1); assert.equal(f.provider.status().ready, false);
  const retry = consumeLocal(f.provider, new AbortController().signal);
  await until(() => f.healthRequests.length === 2); f.healthRequests[1].ready();
  assert.equal(await retry, '동료의 답변입니다.'); assert.equal(f.children.length, 2); assert.equal(f.children[1].kills, 0);
});

test('closing the provider before a startup port is ready never spawns a late child', async () => {
  const f = startupFixture();
  const canceled = assert.rejects(consumeLocal(f.provider, new AbortController().signal), error => error.status === 499);
  f.provider.close(); await canceled;
  assert.equal(f.children.length, 0); assert.equal(f.healthRequests.length, 0);
  await assert.rejects(consumeLocal(f.provider, new AbortController().signal), error => error.status === 503);
});
