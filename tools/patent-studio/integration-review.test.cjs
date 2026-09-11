'use strict';
// Independent storage / HTTP contracts; all audio is generated test silence.
// No production data or transcription provider is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./server.cjs');
const { TARGET } = require('./core.cjs');
const { digest } = require('./store.cjs');

function wav() {
  const b = Buffer.alloc(32044); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(32000, 40);
  return b;
}
async function setup(transcriber = { status: async () => ({ available: false, reason: 'Test: manual review only' }) }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-independent-review-'));
  const app = await createServer({ directory, transcriber });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const headers = { 'content-type': 'application/json', 'x-studio-token': app.token };
  const post = async (route, value) => {
    const response = await fetch(base + route, { method: 'POST', headers, body: JSON.stringify(value) });
    return { status: response.status, body: await response.json() };
  };
  const create = async () => (await post('/api/sessions', { mode: 'recording' })).body;
  const get = async id => (await fetch(base + '/api/sessions/' + id)).json();
  const upload = async (s, role, eventId, bytes = wav()) => {
    const response = await fetch(`${base}/api/sessions/${s.id}/audio?role=${role}`, { method: 'POST',
      headers: { 'content-type': 'audio/wav', 'x-studio-token': app.token, 'x-expected-revision': String(s.revision), 'x-event-id': eventId }, body: bytes });
    return { status: response.status, body: await response.json() };
  };
  const event = (s, value) => post(`/api/sessions/${s.id}/events`, { expectedRevision: s.revision, event: value });
  const exported = async id => (await fetch(`${base}/api/sessions/${id}/export`)).json();
  return { app, base, post, create, get, upload, event, exported };
}

test('HTTP rejects a response audioRef hidden in payload unless a matching response upload exists', async () => {
  const h = await setup();
  try {
    let s = (await h.upload(await h.create(), 'original', 'original-upload')).body;
    s = (await h.event(s, { id: 'conditions', type: 'task-confirmed', roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true })).body;
    s = (await h.event(s, { id: 'help', type: 'help-presented', text: TARGET, exposesAnswer: true })).body;
    const result = await h.event(s, { id: 'forged-response', type: 'response-added', payload: {
      responseId: 'not-uploaded', audioRef: 'sha256:' + 'a'.repeat(64), text: TARGET,
      confirmed: true, scopeConfirmed: true, exposureScopeConfirmed: true,
    } });
    assert.ok(result.status >= 400, `Unstored audio accepted: status=${result.status}, ASR=${result.body.analysis?.cells.find(c => c.id === 'e1:asr')?.status}`);
  } finally { await h.app.close(); }
});

test('HTTP cannot relabel the original audio upload as a new response occurrence', async () => {
  const h = await setup();
  try {
    let s = (await h.upload(await h.create(), 'original', 'original-upload')).body;
    const result = await h.event(s, { id: 'reuse-original', type: 'response-added', audioRef: s.audios[0].audioRef,
      responseId: 'unrecorded-response', text: TARGET, confirmed: true, scopeConfirmed: true, exposureScopeConfirmed: true });
    assert.ok(result.status >= 400, 'A new response must have its own role-bound upload event, even when the bytes already exist.');
  } finally { await h.app.close(); }
});

test('nested machine provenance cannot bypass the server-only transcription event boundary', async () => {
  const h = await setup();
  try {
    const s = (await h.upload(await h.create(), 'original', 'original-upload')).body;
    const result = await h.event(s, { id: 'fake-machine', type: 'transcripts-set', payload: {
      role: 'original', source: 'machine', alternatives: [{ text: TARGET }], scopeConfirmed: false,
    } });
    assert.ok(result.status >= 400, 'Machine provenance must originate in a real transcription attempt, not a nested client payload.');
  } finally { await h.app.close(); }
});

test('replaying a completed upload does not call the transcription provider again', async () => {
  let calls = 0;
  const h = await setup({ status: async () => ({ available: true }), transcribe: async () => {
    calls++; return { text: TARGET, alternatives: [{ text: TARGET }], provider: 'test-double', model: 'fixed' };
  } });
  try {
    const initial = await h.create();
    const first = await h.upload(initial, 'original', 'same-upload');
    const repeated = await h.upload(initial, 'original', 'same-upload');
    assert.equal(first.status, 200); assert.equal(repeated.status, 200);
    assert.equal(calls, 1, 'Idempotent upload retry must not silently trigger another provider execution.');
  } finally { await h.app.close(); }
});

test('identical audio bytes in original and response do not make retranscription attribution ambiguous', async () => {
  let calls = 0;
  const h = await setup({ status: async () => ({ available: true }), transcribe: async () => ({
    text: `실제 전사 호출 ${++calls}`, provider: 'test-double', model: 'call-counter',
  }) });
  try {
    let s = (await h.upload(await h.create(), 'original', 'o')).body;
    const originalRef = s.audios[0].audioRef;
    s = (await h.upload(s, 'response', 'r')).body;
    assert.equal(s.audios[0].sha256, s.audios[1].sha256);
    const retry = await h.post(`/api/sessions/${s.id}/transcribe`, { expectedRevision: s.revision, audioRef: originalRef });
    // A hash identifies bytes, not which observation occurrence they belong to.
    // Either require an occurrence selector, or reject ambiguous hash-only input.
    assert.ok(retry.status >= 400, 'Hash-only retry must not silently choose the last response instead of the requested original occurrence.');
  } finally { await h.app.close(); }
});

test('each actual transcription retry retains an attempt even when its output is identical', async () => {
  let calls = 0;
  const h = await setup({ status: async () => ({ available: true }), transcribe: async () => {
    calls++; return { text: TARGET, provider: 'test-double', model: 'same-result' };
  } });
  try {
    let s = (await h.upload(await h.create(), 'original', 'o')).body;
    s = (await h.post(`/api/sessions/${s.id}/transcribe`, { expectedRevision: s.revision, audioRef: s.audios[0].audioRef })).body;
    assert.equal(calls, 2);
    assert.equal((await h.exported(s.id)).transcriptionAttempts.filter(a => a.status === 'ready').length, 2,
      'Same transcript text does not mean the provider executed only once.');
  } finally { await h.app.close(); }
});

test('late automatic transcription cannot overwrite human hearing confirmed while the request is running', async () => {
  let release, entered;
  const providerEntered = new Promise(r => { entered = r; });
  const providerResult = new Promise(r => { release = r; });
  const h = await setup({ status: async () => ({ available: true }), transcribe: async () => { entered(); return providerResult; } });
  try {
    const initial = await h.create(); const uploading = h.upload(initial, 'original', 'delayed');
    await providerEntered;
    let s = await h.get(initial.id);
    s = (await h.event(s, { id: 'human-first', type: 'review-original', text: TARGET, confirmed: true })).body;
    release({ text: '친구가 만나서 카페에 갔어요', provider: 'test-double', model: 'late' });
    s = (await uploading).body;
    assert.equal(s.original.alternatives[0].text, TARGET);
    assert.equal(s.original.source, 'human'); assert.equal(s.original.humanConfirmed, true);
    assert.equal(s.original.machineAlternatives[0].text, '친구가 만나서 카페에 갔어요');
    const e = await h.exported(s.id);
    assert.equal(e.transcriptionAttempts.length, 1);
    assert.equal(e.transcriptionAttempts[0].text, '친구가 만나서 카페에 갔어요');
  } finally { release({ text: TARGET }); await h.app.close(); }
});

test('six-step HTTP workflow keeps original ambiguity, assisted response and exported audio occurrences distinct', async () => {
  const h = await setup();
  try {
    let s = await h.create();
    s = (await h.upload(s, 'original', 'original')).body;
    s = (await h.event(s, { id: 'conditions', type: 'task-confirmed', roleConfirmed: true, pastIndependent: true, exposureScopeConfirmed: true })).body;
    s = (await h.event(s, { id: 'alternatives', type: 'review-original', confirmed: true, scopeConfirmed: true, performanceTimeConfirmed: true,
      alternatives: [{ text: TARGET }, { text: '친구가 만나서 카페에 갔어요' }] })).body;
    assert.equal(s.analysis.cells.find(c => c.id === 'e0:past').status, 'accepted');
    assert.equal(s.analysis.cells.find(c => c.id === 'e0:object').status, 'held');
    s = (await h.event(s, { id: 'actual-help', type: 'help-presented', text: TARGET, exposesAnswer: true })).body;
    const responseBytes = wav(); responseBytes.writeInt16LE(11, 44);
    s = (await h.upload(s, 'response', 'response', responseBytes)).body;
    s = (await h.event(s, { id: 'heard-response', type: 'review-response', responseId: 'response', text: TARGET,
      confirmed: true, exposureScopeConfirmed: true, performanceTimeConfirmed: true })).body;
    assert.equal(s.analysis.cells.find(c => c.id === 'e0:object').status, 'held');
    assert.equal(s.analysis.cells.find(c => c.id === 'e1:object').status, 'accepted');
    assert.equal(s.analysis.cells.find(c => c.id === 'e1:earlier-proof').status, 'excluded');
    const output = await h.exported(s.id);
    assert.equal(output.integrity.sessionSha256, digest(output.session));
    for (const file of output.files) assert.equal(digest(Buffer.from(file.data, 'base64')), file.sha256);
    assert.equal(output.files.find(f => f.role === 'original').audioRef, s.original.audio.audioRef);
    assert.equal(output.files.find(f => f.role === 'response' && f.responseId === s.responses[0].id).audioRef, s.responses[0].audio.audioRef);
    assert.ok(s.events.some(e => e.id === 'actual-help' && e.revision < s.events.find(x => x.id === 'response').revision));
    assert.equal(s.analysis.comparisons.find(c => c.id === 'no-epoch').cells.find(c => c.id === 'e0:object').status, 'accepted');
  } finally { await h.app.close(); }
});

test('HTTP semantic UNKNOWN keeps arbitrary confirmed ASR transcript while grammar stays held', async () => {
  const h = await setup();
  try {
    let s = (await h.upload(await h.create(), 'original', 'o')).body;
    s = (await h.event(s, { id: 'human', type: 'review-original', text: '오늘은 집에서 쉬었어요', confirmed: true })).body;
    s = (await h.event(s, { id: 'semantic', type: 'unknown-set', enabled: true, kind: 'semantic', scope: ['all'], reason: '의미 해석 미지원' })).body;
    assert.equal(s.analysis.cells.find(c => c.id === 'e0:asr').status, 'accepted');
    assert.equal(s.analysis.cells.find(c => c.id === 'e0:object').status, 'held');
    assert.equal((await h.exported(s.id)).session.unknown.kind, 'semantic');
  } finally { await h.app.close(); }
});
