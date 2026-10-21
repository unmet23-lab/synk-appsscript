import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from './store.mjs';
import { createComputerInterpretationService } from './computer-interpretation-service.mjs';
import { createCustomerComputerDraft } from './customer-computer-draft.mjs';

const source = '현재 램은 16GB입니다.';
const input = () => ({ id: randomUUID(), requestId: 'customer-request', sourceId: 'customer-source', revision: 1, text: source });
const response = () => new Response(JSON.stringify({ model: 'gpt-6-luna', status: 'completed', usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 },
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ proposals: [
    { field: 'current.ram', value: '16', subject: 'self', stance: 'current', evidence: [{ quote: source, occurrence: 1 }] }], held: [] }) }] }] }));
async function fixture(t, fetchImpl = async () => response()) {
  const directory = await mkdtemp(join(tmpdir(), 'synk-customer-test-'));
  const users = [0, 1].map(() => Object.freeze({ kind: 'customer', id: 'synk:' + randomUUID(), name: 'Test customer' }));
  const authorized = new Set(users), env = { SYNK_COMPUTER_AI_ENABLED: '1', SYNK_COMPUTER_AI_MODEL: 'gpt-6-luna', SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS: '3000',
    SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD: '125000', SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD: '500000',
    SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD: '10000', SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD: '250000', OPENAI_API_KEY: 'mock-key',
    SYNK_COMPUTER_AI_CUSTOMER_ENABLED: '1', SYNK_COMPUTER_AI_CUSTOMER_DAILY_REQUESTS: '2', SYNK_COMPUTER_AI_CUSTOMER_DAILY_MICRO_USD: '20000' };
  const f = { users, authorized, env, calls: 0, now: '2026-10-08T12:00:00Z' };
  const start = () => { f.store = new Store(directory); f.service = createComputerInterpretationService({ store: f.store, clock: () => f.now,
    getEnv: key => env[key], customerAuthorized: user => authorized.has(user), fetchImpl: async (...args) => { f.calls++; return fetchImpl(...args); } });
    f.drafts = createCustomerComputerDraft({ store: f.store, authorized: user => authorized.has(user), clock: () => f.now }); };
  start(); f.restart = async () => { await f.service.stop(); f.store.close(); start(); };
  t.after(async () => { await f.service.stop(); f.store.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(directory.includes('synk-customer-test-')); await rm(directory, { recursive: true, force: true }); });
  return f;
}

test('customer authorization cannot be forged and customer AI must be explicitly configured', async t => {
  const f = await fixture(t), user = f.users[0];
  await assert.rejects(f.service.interpret({ ...user }, input()), { status: 401 });
  for (const value of [undefined, '0', '1.2']) {
    f.env.SYNK_COMPUTER_AI_CUSTOMER_DAILY_REQUESTS = value;
    assert.equal(f.service.state(user).available, false);
    await assert.rejects(f.service.interpret(user, input()), { status: 503 });
  }
  assert.equal(f.calls, 0); assert.equal(f.store.all('computerAIRequests').length, 0);
});

test('daily customer cap persists across restart and response deletion; replay is not charged twice', async t => {
  const f = await fixture(t), user = f.users[0], request = input();
  const result = await f.service.interpret(user, request);
  assert.deepEqual(await f.service.interpret(user, request), result); assert.equal(f.calls, 1);
  await f.service.interpret(user, input());
  await f.restart();
  assert.equal(f.service.state(user).usage.requestsRemaining, 0);
  f.service.removeResponses(user, {});
  await assert.rejects(f.service.interpret(user, input()), { code: 'SYNK_COMPUTER_AI_CUSTOMER_LIMIT' });
  await f.service.interpret(f.users[1], input()); assert.equal(f.calls, 3);
  f.now = '2026-10-09T00:00:00Z';
  assert.equal(f.service.state(user).usage.requestsRemaining, 2);
  await f.service.interpret(user, input()); assert.equal(f.calls, 4);
});

test('parallel customer requests reserve personal budget before provider dispatch', async t => {
  let release, started; const waiting = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
  const f = await fixture(t, async () => { started(); await waiting; return response(); }), user = f.users[0];
  const first = f.service.interpret(user, input()); await ready;
  const reservation = f.store.all('computerAIRequests')[0].accountedMicroUSD;
  f.env.SYNK_COMPUTER_AI_CUSTOMER_DAILY_MICRO_USD = String(reservation);
  await assert.rejects(f.service.interpret(user, input()), { code: 'SYNK_COMPUTER_AI_CUSTOMER_LIMIT' });
  assert.equal(f.calls, 1); release(); await first;
});

test('uncertain dispatch consumes daily allowance after restart and shared global budget still applies', async t => {
  const f = await fixture(t, async () => { throw new Error('simulated network loss'); }), user = f.users[0];
  await assert.rejects(f.service.interpret(user, input()), { code: 'SYNK_COMPUTER_AI_UNCERTAIN' });
  const reserved = f.store.all('computerAIRequests')[0].accountedMicroUSD;
  f.env.SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD = String(reserved);
  await f.restart();
  assert.equal(f.service.state(user).usage.requestsUsed, 1);
  await assert.rejects(f.service.interpret(f.users[1], input()), { code: 'SYNK_COMPUTER_AI_BUDGET' });
  assert.equal(f.calls, 1);
});

test('customer draft is encrypted, isolated, portable across restart and protected against stale devices', async t => {
  const f = await fixture(t), [user, other] = f.users, document = { version: 1, text: source, answers: { 'current.ram': '16' } };
  assert.equal(f.drafts.get(user).status, 'empty');
  assert.equal(f.drafts.save(user, { baseRevision: 0, document }).revision, 1);
  assert.equal(f.drafts.get(other).status, 'empty');
  assert.ok(!JSON.stringify(f.store.all('customerComputerDrafts')).includes(source));
  await f.restart(); assert.deepEqual(f.drafts.get(user).document, document);
  assert.throws(() => f.drafts.save(user, { baseRevision: 0, document }), { status: 409 });
  assert.equal(f.drafts.remove(user, { baseRevision: 1 }).status, 'deleted');
  assert.throws(() => f.drafts.save(user, { baseRevision: 1, document }), { status: 409 });
  assert.equal(f.drafts.get(user).revision, 2); assert.equal(f.store.all('customerComputerDrafts')[0].documentCiphertext, undefined);
  assert.throws(() => f.drafts.get({ ...user }), { status: 401 });
});

test('draft rejects model proposals, invented options and client-selected owners', async t => {
  const f = await fixture(t), user = f.users[0], document = { version: 1, text: source, answers: {} };
  for (const body of [{ baseRevision: 0, document, userId: f.users[1].id },
    { baseRevision: 0, document: { ...document, proposals: [] } },
    { baseRevision: 0, document: { ...document, answers: { 'current.ram': 'invalid' } } },
    { baseRevision: 0, document: { ...document, answers: JSON.parse('{"__proto__":"pollution"}') } }]) {
    assert.throws(() => f.drafts.save(user, body), { status: 400 });
  }
  assert.equal(f.store.all('customerComputerDrafts').length, 0);
});
