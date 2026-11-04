'use strict';

const { summarizeAccount, SCOPE } = require('../../atlas/account-summary');
const { createMap } = require('../../strata');
const map = createMap(require('../../strata/maps/topik-i.json'));
const formats = ['binary-choice', 'single-choice', 'cup-compose', 'action', 'spoken'];

function accountFor(formatsPlayed, asOf, enabled) {
  const events = formatsPlayed.flatMap((responseFormat, index) => {
    const at = new Date(Date.parse(asOf) - (5 - index) * 86400000).toISOString();
    const base = { schema: 1, scope: SCOPE, at, recordedAt: at };
    return [
      { ...base, type: 'decision.made', id: 'decision-' + index },
      { ...base, type: 'practice.presented', id: 'offer-' + index, decisionId: 'decision-' + index,
        taskId: 'format-test', taskVersion: '1', itemKey: 'item-' + index, firstExposure: true,
        conceptIds: ['ko.listening.detail', 'sit-travel-order'],
        measure: { skillId: 'ko.listening.detail', modality: 'listening', difficulty: 1,
          responseFormat, familyKey: 'family-' + index, audioRequired: false, confounded: false } },
      { ...base, type: 'practice.attempted', id: 'answer-' + index, presentationId: 'offer-' + index,
        attemptNo: 1, verdict: 'correct', errorTags: [] },
    ];
  });
  const presentation = { support: 'step', explanation: 'brief', textSize: 'large', motion: 'reduced', audio: 'available' };
  const summary = summarizeAccount({ events, map, asOf, presentation });
  return { ok: true, scope: 'synk-atlas-summary', learning: { enabled, revision: enabled ? 7 : 8 },
    shared: enabled ? 'practice-and-settings' : 'declared-only', summary };
}

function declarationsFor(asOf) {
  return { version: 1, reviews: [], overrides: [
    { id: '00000000-0000-4000-8000-000000000001', facetId: 'topics', values: ['ai-tools'], at: asOf, note: '' },
    { id: '00000000-0000-4000-8000-000000000002', facetId: 'support', values: ['step'], at: asOf, note: '' },
  ] };
}

module.exports = { accountFor, declarationsFor, formats };
