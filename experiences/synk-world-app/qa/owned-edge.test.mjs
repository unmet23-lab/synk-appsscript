import test from 'node:test';
import assert from 'node:assert/strict';
import {afterTutorCleanup, closeOwnedEdge, navigationBefore} from './owned-edge.mjs';

test('navigation waits for page assets and uses the remaining test time', () => {
  assert.deepEqual(navigationBefore(performance.now() - 1), {waitUntil: 'load', timeout: 1});
  const options = navigationBefore(performance.now() + 60_000);
  assert.equal(options.waitUntil, 'load');
  assert.ok(options.timeout > 15_000 && options.timeout <= 60_000);
});

test('tutor teardown outlives a completed work deadline and reports an owned cleanup failure', async t => {
  let reported;
  await t.test('finished work', {timeout: 100}, child => {
    afterTutorCleanup(child, () => new Promise(resolve => setTimeout(resolve, 200)),
      (ms, error) => { reported = {ms, error}; });
  });
  assert.ok(reported.ms >= 100);
  assert.equal(reported.error, null);

  let finish;
  const context = {signal: t.signal, after(fn) { finish = fn; }};
  const error = Error('owned fixture still running');
  afterTutorCleanup(context, async () => { throw error; }, (_, reason) => { reported = reason; });
  await assert.rejects(finish(context), error);
  assert.equal(reported, error);
});

test('owned Edge teardown waits for graceful close and reaps a stalled browser', async t => {
  const calls = [];
  const options = {signal: t.signal, graceMs: 5, diagnostic: message => t.diagnostic(message)};
  const server = {
    close: async () => { calls.push('close'); },
    kill: async () => { await new Promise(resolve => setImmediate(resolve)); calls.push('kill'); },
  };
  await closeOwnedEdge(server, options);
  assert.deepEqual(calls, ['close']);

  server.close = () => { calls.push('stuck'); return new Promise(() => {}); };
  await closeOwnedEdge(server, options);
  assert.deepEqual(calls, ['close', 'stuck', 'kill']);

  const abort = new AbortController();
  const closing = closeOwnedEdge(server, {...options, signal: abort.signal, graceMs: 10_000});
  abort.abort();
  await closing;
  assert.deepEqual(calls, ['close', 'stuck', 'kill', 'stuck', 'kill']);
  server.kill = async () => { throw Error('owned kill failed'); };
  await assert.rejects(closeOwnedEdge(server, {...options, signal: abort.signal}), /owned kill failed/);
});

