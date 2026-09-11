'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const core = require('./core.cjs');
const { verifyLedger, digest } = require('./projection.cjs');
const engineKey = digest(['core.cjs', 'projection.cjs'].map(name => ({ name,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, name))).digest('hex') })));

function verifyExport(bundle) {
  if (!bundle?.replay || !bundle.session?.effectLedger) return { valid: false, failures: ['replay-contract-missing'] };
  const result = verifyLedger({ entries: bundle.session.effectLedger.entries, events: bundle.replay.events,
    finalState: bundle.replay.finalState, finalCells: bundle.session.analysis.cells, engineKey }, core);
  const failures = [...result.failures];
  if (digest(bundle.session.effectLedger) !== bundle.integrity.effectLedgerSha256) failures.push('ledger-export-digest');
  if (digest(bundle.session) !== bundle.integrity.sessionSha256) failures.push('session-export-digest');
  if (digest(bundle.transcriptionAttempts) !== bundle.integrity.attemptsSha256) failures.push('attempts-export-digest');
  const files = new Map((bundle.files || []).map(f => [f.audioEventId, f]));
  for (const audio of bundle.session.audios) {
    const file = files.get(audio.audioEventId);
    if (!file || file.encoding !== 'base64') { failures.push(`audio-missing:${audio.audioEventId}`); continue; }
    const bytes = Buffer.from(file.data, 'base64'), sha = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha !== audio.sha256 || file.sha256 !== sha || bytes.length !== audio.bytes) failures.push(`audio-content:${audio.audioEventId}`);
  }
  return { ...result, valid: failures.length === 0, failures, checkedAudioOccurrences: bundle.session.audios.length,
    engineVersion: core.VERSION };
}
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('내려받은 근거 JSON의 경로가 필요합니다.');
    const result = verifyExport(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
module.exports = { verifyExport };
