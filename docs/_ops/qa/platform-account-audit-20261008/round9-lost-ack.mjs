// Run from any directory: node <path>/round9-lost-ack.mjs
// Real document-sync module; synthetic in-memory accounts/storage/server only.
// This QA scenario is recorded separately from the unit-test count.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createDocumentSync } from '../../../../experiences/synk-account/src/document-sync.mjs';

const accountId = 'synthetic-round9-owner', scope = 'synk-personal', resource = 'family-album';
const prefix = 'synthetic-round9-lost-ack:';
const state = text => ({ version: 1, text });
const validate = value => {
  assert.equal(value?.version, 1);assert.equal(typeof value.text, 'string');
  return state(value.text);
};
const data = new Map();
const storage = {
  get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
  getItem: key => data.get(key) ?? null, setItem: (key, raw) => data.set(key, String(raw)), removeItem: key => data.delete(key),
};
let revision = 0, remote = state('initial'), loseAcknowledgement = true, saveAttempts = 0;
const transport = async (action, body) => {
  if (action === 'personalSave') {
    saveAttempts++;
    if (body.expected_revision !== revision) return { ok: false, revision, error: { code: 'REVISION_CONFLICT' } };
    remote = validate(body.state);revision++;
    if (loseAcknowledgement) {
      loseAcknowledgement = false;
      throw Object.assign(new Error('Synthetic response disconnected after commit'), { code: 'NETWORK' });
    }
  } else assert.equal(action, 'personalLoad');
  return { ok: true, scope, resource, accountId, revision, state: structuredClone(remote) };
};
function writer() {
  let status, displayed;
  const sync = createDocumentSync({ transport, storage, scope, resource, cachePrefix: prefix,
    operations: { load: 'personalLoad', save: 'personalSave', delete: 'personalDelete' },
    validateState: validate, emptyState: () => state(''), onState: value => { displayed = value; }, onStatus: value => { status = value; } });
  return { sync, status: () => status, displayed: () => displayed };
}
const a = writer(), b = writer(), checks = {};
try {
  await a.sync.open(accountId);await b.sync.open(accountId);
  a.sync.change(state('A committed with lost response'));
  assert.equal(await a.sync.flush(), false);assert.equal(a.status().pending, true);assert.equal(a.status().pendingStored, true);
  assert.equal(remote.text, 'A committed with lost response');
  const [draftKey, originalRaw] = [...data].find(([, raw]) => JSON.parse(raw).state.text === 'A committed with lost response');
  checks.lostAcknowledgement = { returnedSuccess: false, serverRevision: revision, localPending: true, localPendingStored: true };

  b.sync.change(state('B explicit replacement'));
  assert.equal(await b.sync.flush(), false);assert.equal(b.status().status, 'conflict');
  assert.equal(await b.sync.resolveLocal(), true);assert.equal(remote.text, 'B explicit replacement');
  checks.otherWriter = { firstAttempt: 'conflict', explicitLocalChoiceSaved: true, serverRevision: revision };

  assert.equal(await a.sync.flush(), false);assert.equal(a.status().status, 'conflict');
  assert.equal(storage.getItem(draftKey), originalRaw);
  checks.originalWriterRetry = { returnedSuccess: false, status: 'conflict', originalBytesPreserved: true };

  assert.equal(await a.sync.resolveRemote(), true);assert.equal(a.displayed().text, 'B explicit replacement');
  assert.equal(a.status().pending, false);assert.equal(storage.getItem(draftKey), originalRaw);
  const recovery = a.sync.exportLocalRecords();
  assert.equal(recovery.entries.find(entry => entry.key === draftKey).raw, originalRaw);
  checks.explicitRemoteChoice = { displayedServerVersion: true, pending: false, originalBytesPreserved: true, exportedOriginalBytesPreserved: true };

  const proof = { scenario: 'round9-lost-ack', result: 'passed', verifiedAt: new Date().toISOString(),
    module: 'experiences/synk-account/src/document-sync.mjs', fixture: 'synthetic in-memory server, storage and account',
    externalRequests: 0, unitTestsCounted: 0, finalServerRevision: revision, saveAttempts,
    retainedDraftSha256: createHash('sha256').update(originalRaw).digest('hex'), checks };
  await writeFile(new URL('./round9-lost-ack-proof.json', import.meta.url), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ result: proof.result, scenario: proof.scenario, finalServerRevision: revision, saveAttempts, originalPreservedInRecovery: true }));
} finally { a.sync.close();b.sync.close(); }
