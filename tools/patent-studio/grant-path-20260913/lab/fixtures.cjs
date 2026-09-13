'use strict';
// Controlled synthetic fixtures. Candidate texts, word timings, and task/help
// conditions are authored assumptions, not ASR alignment or student observations.
const core = require('../../core.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const TARGET = core.TARGET;
const ALT = '친구가 만나서 카페에 갔어요';
const PRESENT = '친구를 만나서 카페에 가요';
const AUDIO = 'd9e45d3fb33a6060c3d9cde162a2ac1c395ee84c6cca0c14bc2d8e235328955b';
const AT = '2026-09-13T09:00:00.000Z';
const AFTER = '2026-09-13T09:00:10.000Z';
function fixture({ texts = [TARGET, ALT], durationMs = 3000, id = 'controlled-contract-example' } = {}) {
  let state = core.createSession({ id, mode: 'example', exampleId: 'particle-ambiguity', createdAt: AT });
  state = core.applyEvent(state, { id: 'fixture-audio', type: 'audio-attached', at: AT, payload: {
    audioRef: AUDIO, mimeType: 'audio/wav', durationMs, acquisition: 'file', fileName: 'original.wav',
  } });
  state = core.applyEvent(state, { id: 'fixture-transcripts', type: 'transcripts-set', at: AFTER, payload: {
    alternatives: texts, source: 'human', confirmed: true, scopeConfirmed: true, exposureScopeConfirmed: true,
  } });
  // Restore explicit test assumptions after file attachment clears timing.
  Object.assign(state.original, { performanceTimeConfirmed: true, performanceTimeSource: 'fixture-assumption',
    performanceInterval: { startedAt: AT, endedAt: AT }, performanceTimeConfirmedAt: AT, syntheticEvidence: true });
  const source = { audioRef: AUDIO, utteranceId: 'original', epoch: 'e0' };
  const alignments = texts.map((text, candidateIndex) => ({ ...source, text,
    sourceRef: `synthetic-manual-alignment:${candidateIndex}`,
    words: text.split(' ').map((word, index) => ({ text: word, startMs: index * 600, endMs: index * 600 + 550 })),
  }));
  return { state, alignments, source };
}
function receipt(contract, overrides = {}) {
  return { contractId: contract.id, kind: 'source-audio-review', source: { ...contract.source },
    range: { startMs: contract.range.startMs, endMs: contract.range.endMs }, remainingCandidateTexts: [TARGET],
    confirmed: true, eventId: 'actual-review-1', at: '2026-09-13T09:01:00.000Z', ...overrides };
}
const cells = state => core.evaluate(state).cells.map(cell => ({ id: cell.id, status: cell.status, value: cell.value, reason: cell.reasonCode }));
function approvedSyntheticAudio() {
  const filename = path.join(process.env.LOCALAPPDATA, 'SYNK/patent-studio/samples/original.wav');
  const bytes = fs.readFileSync(filename);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== AUDIO || bytes.length !== 131196) throw Error('Approved synthetic WAV differs from its known fingerprint');
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw Error('Not WAV');
  let byteRate, dataSize;
  for (let pos = 12; pos + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', pos, pos + 4), size = bytes.readUInt32LE(pos + 4);
    if (id === 'fmt ') byteRate = bytes.readUInt32LE(pos + 8 + 8);
    if (id === 'data') dataSize = size;
    pos += 8 + size + size % 2;
  }
  if (!byteRate || !dataSize) throw Error('Missing WAV duration');
  return { filename, bytes: bytes.length, sha256, durationMs: dataSize / byteRate * 1000,
    kind: 'previously-generated-Windows-SAPI-synthetic-speech',
    alignmentScope: 'hand-authored test timings; not measured speech alignment or listening validation' };
}
module.exports = { fixture, receipt, cells, approvedSyntheticAudio, TARGET, ALT, PRESENT, AUDIO, AT, AFTER };
