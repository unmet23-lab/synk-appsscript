'use strict';

// Local experiment adapter. Hashes bind serialized data; they do not authenticate
// a reviewer, certify a supplied alignment, or prove that a person listened.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const corePath = require.resolve('../../core.cjs');
const { VERSION: CORE_VERSION, evaluate, applyEvent } = require(corePath);
const clone = value => structuredClone(value);
const normalizedText = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : null;
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameSource = (a, b) => Boolean(a && b && a.audioRef === b.audioRef && a.utteranceId === b.utteranceId && a.epoch === b.epoch);
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const LIMITS = Object.freeze({ candidates: 40, words: 512, alignments: 200 });

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stable(item) ?? 'null').join(',')}]`;
  return `{${Object.keys(value).sort(order).filter(key => value[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
const fingerprint = value => createHash('sha256').update(stable(value)).digest('hex');

// Pin the code artifact identity once for this adapter process. This assumes a
// trusted, fixed-code process: an already cached module and its startup files
// must match. It is not an attestation service or a hot-reload mechanism.
function captureEngineIdentity() {
  const loadedCore = require.cache[corePath];
  const modules = [loadedCore, ...loadedCore.children].map(module => ({
    path: path.relative(path.dirname(corePath), module.filename).replace(/\\/gu, '/'),
    sha256: createHash('sha256').update(readFileSync(module.filename)).digest('hex'),
  })).sort((left, right) => order(left.path, right.path));
  const body = { coreVersion: CORE_VERSION, modules, scope: 'core-and-direct-dependencies-at-process-initialization' };
  return Object.freeze({ ...body, fingerprint: fingerprint(body) });
}
const ENGINE_IDENTITY = captureEngineIdentity();

function sourceOf(utterance) { return { audioRef: utterance.audio?.audioRef || null, utteranceId: utterance.id, epoch: utterance.epoch }; }
function seal(body) {
  const id = `observation:${fingerprint(body).slice(0, 32)}`;
  const data = { ...body, id };
  return { ...data, integrity: { algorithm: 'sha256', digest: fingerprint(data) } };
}
function integrityValid(contract) {
  if (!object(contract) || contract.integrity?.algorithm !== 'sha256') return false;
  const { integrity, ...data } = contract;
  const { id, ...body } = data;
  return id === `observation:${fingerprint(body).slice(0, 32)}` && integrity.digest === fingerprint(data);
}

// Mark an insertion/deletion if any minimum token-edit path can contain one.
// Ambiguous alignment paths therefore fall back rather than claiming precision.
function mayContainIndel(left, right) {
  if (left.length !== right.length) return true;
  let previous = Array.from({ length: right.length + 1 }, (_, j) => ({ cost: j, indel: j > 0 }));
  for (let i = 1; i <= left.length; i++) {
    const current = [{ cost: i, indel: true }];
    for (let j = 1; j <= right.length; j++) {
      const diagonal = { cost: previous[j - 1].cost + (left[i - 1] === right[j - 1] ? 0 : 1), indel: previous[j - 1].indel };
      const deletion = { cost: previous[j].cost + 1, indel: true };
      const insertion = { cost: current[j - 1].cost + 1, indel: true };
      const minimum = Math.min(diagonal.cost, deletion.cost, insertion.cost);
      current.push({ cost: minimum, indel: [diagonal, deletion, insertion].some(item => item.cost === minimum && item.indel) });
    }
    previous = current;
  }
  return previous[right.length].indel;
}

function matchingAlignment(alignments, source, candidateText, durationMs) {
  const matches = alignments.filter(row => object(row) && sameSource(row, source) && normalizedText(row.text) === candidateText);
  if (matches.length !== 1) return { reason: matches.length ? 'ambiguous-alignment' : 'missing-alignment' };
  const row = matches[0], tokens = candidateText.split(' ');
  if (!nonempty(row.sourceRef)) return { reason: 'missing-alignment-source' };
  if (!Array.isArray(row.words) || row.words.length !== tokens.length || row.words.length > LIMITS.words) return { reason: 'word-alignment-mismatch' };
  let previousEnd = 0;
  for (let i = 0; i < row.words.length; i++) {
    const word = row.words[i];
    if (!object(word) || normalizedText(word.text) !== tokens[i] || !Number.isFinite(word.startMs) || !Number.isFinite(word.endMs) ||
        word.startMs < previousEnd || word.endMs <= word.startMs || word.endMs > durationMs) return { reason: 'word-alignment-mismatch' };
    previousEnd = word.endMs;
  }
  return { row: clone(row), tokens };
}

function rangeFor(candidateTexts, source, alignments, durationMs) {
  const fallback = reason => ({ range: { startMs: 0, endMs: durationMs, basis: 'whole-source-audio-fallback' },
    rangeEvidence: { fallbackReason: reason, comparisonPairs: [], alignmentSourceRefs: [], suppliedAlignmentIsNotCertified: true } });
  if (alignments.length > LIMITS.alignments) return fallback('alignment-input-limit');
  const mapped = new Map();
  for (const candidate of candidateTexts) {
    if (candidate.split(' ').length > LIMITS.words) return fallback('word-count-limit');
    const result = matchingAlignment(alignments, source, candidate, durationMs);
    if (result.reason) return fallback(result.reason);
    mapped.set(candidate, result);
  }
  const comparisonPairs = [];
  let startMs = Infinity, endMs = -Infinity;
  // Core's witness is one differing pair, not a certificate covering every
  // supplied alternative. Include all current text pairs before narrowing.
  for (let i = 0; i < candidateTexts.length; i++) for (let j = i + 1; j < candidateTexts.length; j++) {
    const left = mapped.get(candidateTexts[i]), right = mapped.get(candidateTexts[j]);
    if (mayContainIndel(left.tokens, right.tokens)) return fallback('insertion-deletion-or-ambiguous-edit');
    let first = 0, last = left.tokens.length - 1;
    while (first < left.tokens.length && left.tokens[first] === right.tokens[first]) first++;
    while (last >= first && left.tokens[last] === right.tokens[last]) last--;
    if (first > last) continue;
    const pairStart = Math.min(left.row.words[first].startMs, right.row.words[first].startMs);
    const pairEnd = Math.max(left.row.words[last].endMs, right.row.words[last].endMs);
    startMs = Math.min(startMs, pairStart); endMs = Math.max(endMs, pairEnd);
    comparisonPairs.push({ texts: [candidateTexts[i], candidateTexts[j]], tokenRange: { first, last },
      range: { startMs: pairStart, endMs: pairEnd }, alignmentSourceRefs: [left.row.sourceRef, right.row.sourceRef] });
  }
  if (!Number.isFinite(startMs) || !(endMs > startMs)) return fallback('no-aligned-difference');
  return { range: { startMs, endMs, basis: 'supplied-candidate-difference-enclosing-range' }, rangeEvidence: {
    fallbackReason: null, comparisonPairs,
    alignmentSourceRefs: [...new Set([...mapped.values()].map(item => item.row.sourceRef))].sort(order),
    suppliedAlignmentIsNotCertified: true, fullPossibleInterpretationCoverage: false,
  } };
}

/** Build proposals only: input session is never mutated and no event is applied. */
function compileObservationContracts(session, { alignments = [] } = {}) {
  if (!Array.isArray(alignments)) throw new TypeError('alignments must be an array');
  const before = evaluate(session).cells;
  const contracts = [], unresolved = [];
  const evidenceFingerprint = fingerprint(session);
  for (const utterance of [session.original, ...session.responses]) {
    const targets = before.filter(cell => cell.status === 'held' && cell.utteranceId === utterance.id && cell.epoch === utterance.epoch &&
      Array.isArray(cell.witness) && cell.witness.length >= 2);
    if (!targets.length) continue;
    const source = sourceOf(utterance), durationMs = utterance.audio?.durationMs;
    const reject = reason => unresolved.push({ source, targetIds: targets.map(cell => cell.id), reason });
    if (!nonempty(source.audioRef)) { reject('source-audio-missing'); continue; }
    if (!Number.isFinite(durationMs) || durationMs <= 0) { reject('source-duration-invalid'); continue; }
    const candidateTexts = [...new Set(utterance.alternatives.map(item => normalizedText(item.text)))].sort(order);
    if (candidateTexts.length < 2 || candidateTexts.length > LIMITS.candidates || candidateTexts.some(value => !value)) {
      reject('candidate-set-invalid'); continue;
    }
    const witnesses = targets.map(cell => ({ targetId: cell.id, purpose: cell.purpose, skill: cell.skill,
      alternatives: clone(cell.witness) }));
    const { range, rangeEvidence } = rangeFor(candidateTexts, source, alignments, durationMs);
    contracts.push(seal({ schemaVersion: 1, baseRevision: session.revision, evidenceFingerprint, engineIdentity: clone(ENGINE_IDENTITY),
      source, durationMs, range, targetIds: targets.map(cell => cell.id).sort(order), witnesses,
      candidateTexts, allowedResultKind: 'source-audio-review', rangeEvidence,
      scope: 'supplied-current-candidates-only', verifies: 'serialized-source-attempt-purpose-contract-not-human-truth' }));
  }
  return { contracts, unresolved };
}

function normalizedReceipt(receipt) {
  if (!object(receipt) || !object(receipt.source) || !object(receipt.range) || !Array.isArray(receipt.remainingCandidateTexts)) return null;
  if (receipt.remainingCandidateTexts.length < 1 || receipt.remainingCandidateTexts.length > LIMITS.candidates ||
      receipt.remainingCandidateTexts.some(value => !nonempty(value))) return null;
  const candidates = receipt.remainingCandidateTexts.map(normalizedText);
  if (new Set(candidates).size !== candidates.length) return null;
  return { contractId: receipt.contractId, kind: receipt.kind,
    source: { audioRef: receipt.source.audioRef, utteranceId: receipt.source.utteranceId, epoch: receipt.source.epoch },
    range: { startMs: receipt.range.startMs, endMs: receipt.range.endMs },
    remainingCandidateTexts: candidates.sort(order), confirmed: receipt.confirmed, eventId: receipt.eventId, at: receipt.at };
}

/** Validate an actual receipt, apply a real Core review event, and reevaluate. */
function applyObservationReceipt(session, contract, receipt) {
  const beforeCells = evaluate(session).cells;
  const fail = reason => ({ ok: false, reason, state: session, record: null, beforeCells, afterCells: beforeCells });
  try {
    if (!integrityValid(contract)) return fail('contract-integrity-mismatch');
    if (stable(contract.engineIdentity) !== stable(ENGINE_IDENTITY)) return fail('engine-identity-mismatch');
    const actual = normalizedReceipt(receipt);
    if (!actual) return fail('receipt-invalid');
    if (actual.contractId !== contract.id) return fail('contract-id-mismatch');
    if (actual.kind !== 'source-audio-review' || actual.kind !== contract.allowedResultKind) return fail('result-kind-ineligible');
    if (!sameSource(actual.source, contract.source)) return fail('source-or-attempt-mismatch');
    if (actual.confirmed !== true) return fail('actual-confirmation-required');
    if (!nonempty(actual.eventId) || actual.eventId.length > 200 || !nonempty(actual.at) || !Number.isFinite(Date.parse(actual.at))) return fail('event-identity-invalid');
    if (!Number.isFinite(actual.range.startMs) || !Number.isFinite(actual.range.endMs) || actual.range.startMs < 0 ||
        actual.range.endMs <= actual.range.startMs || actual.range.endMs > contract.durationMs ||
        actual.range.startMs > contract.range.startMs || actual.range.endMs < contract.range.endMs) return fail('review-range-insufficient');
    if (actual.remainingCandidateTexts.some(value => !contract.candidateTexts.includes(value))) return fail('candidate-outside-contract');
    const receiptFingerprint = fingerprint(actual);
    const existing = session.eventLog.find(event => event.id === actual.eventId);
    if (existing) {
      const prior = existing.payload?.observationContract;
      if (prior?.contractId === contract.id && prior?.contractIntegrity === contract.integrity.digest && prior?.receiptFingerprint === receiptFingerprint) {
        return { ok: true, reason: 'idempotent-replay', state: session,
          record: { event: clone(existing), contractId: contract.id, receiptFingerprint, alreadyApplied: true }, beforeCells, afterCells: beforeCells };
      }
      return fail('event-id-conflict');
    }
    if (session.revision !== contract.baseRevision) return fail('stale-revision');
    if (fingerprint(session) !== contract.evidenceFingerprint) return fail('evidence-fingerprint-mismatch');
    const utterance = [session.original, ...session.responses].find(item => item.id === contract.source.utteranceId && item.epoch === contract.source.epoch);
    if (!utterance || !sameSource(sourceOf(utterance), contract.source)) return fail('source-or-attempt-mismatch');
    if (utterance.audio?.durationMs !== contract.durationMs) return fail('source-duration-mismatch');
    const currentTexts = [...new Set(utterance.alternatives.map(item => normalizedText(item.text)))].sort(order);
    if (stable(currentTexts) !== stable(contract.candidateTexts)) return fail('candidate-set-changed');
    const currentTargets = beforeCells.filter(cell => cell.status === 'held' && cell.utteranceId === utterance.id && cell.epoch === utterance.epoch &&
      Array.isArray(cell.witness) && cell.witness.length >= 2).map(cell => cell.id).sort(order);
    if (stable(currentTargets) !== stable(contract.targetIds)) return fail('target-set-changed');

    const payload = { alternatives: actual.remainingCandidateTexts, confirmed: true,
      // Preserve scope and all other task/time/help conditions. An audio review
      // does not certify the completeness of the candidate set or help scope.
      scopeConfirmed: utterance.scopeConfirmed === true,
      ...(utterance.id === 'original' ? {} : { responseId: utterance.id }),
      observationContract: { schemaVersion: 1, contractId: contract.id, contractIntegrity: contract.integrity.digest,
        evidenceFingerprint: contract.evidenceFingerprint, baseRevision: contract.baseRevision, engineIdentity: clone(ENGINE_IDENTITY),
        source: clone(contract.source), targetIds: clone(contract.targetIds), range: clone(contract.range),
        receiptFingerprint, receipt: clone(actual), certificateScope: 'data-binding-only' },
    };
    const event = { id: actual.eventId, type: utterance.id === 'original' ? 'review-original' : 'review-response', at: actual.at, payload };
    const state = applyEvent(session, event);
    // Core's pure event log retains headers only. Store this adapter's complete
    // review payload in the newly returned state, leaving the input untouched.
    const logged = state.eventLog.find(item => item.id === event.id);
    logged.payload = clone(payload);
    const afterCells = evaluate(state).cells;
    return { ok: true, reason: 'applied-source-review', state, beforeCells, afterCells,
      record: { event: clone(logged), contractId: contract.id, receiptFingerprint, alreadyApplied: false,
        changedTargetIds: afterCells.filter(cell => {
          const before = beforeCells.find(item => item.id === cell.id);
          return !before || before.status !== cell.status || before.value !== cell.value;
        }).map(cell => cell.id), scope: 'record-processing-not-patentability-or-learning-outcome' } };
  } catch (error) {
    return { ...fail('invalid-contract-or-receipt'), detail: error instanceof Error ? error.message : String(error) };
  }
}

module.exports = { compileObservationContracts, applyObservationReceipt, LIMITS };
