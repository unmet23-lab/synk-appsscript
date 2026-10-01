'use strict';
// Core's educational adapter. The host keeps its grader and approved material;
// Strata supplies the curriculum nodes. One answer is evidence about this item
// only: never a misconception, a mastery estimate or a learner trait.
const VERDICTS = ['correct', 'incorrect', 'unassessed', 'skipped'];

// Item-level nodes authored with the material come first (the first one is the
// item's primary concept); exact error-tag links follow. Nothing is guessed.
function conceptsFor(map, task) {
  const ids = [];
  for (const id of task.concepts || []) {
    if (!map.getNode(id)) throw new TypeError(`Core: unknown curriculum node ${id}`);
    ids.push(id);
  }
  for (const tag of task.tags) {
    const link = map.forTag(tag);
    if (link.status === 'exact') ids.push(link.node.id);
  }
  return [...new Set(ids)];
}

function diagnose({ map, task, assessment }) {
  if (!task || !Array.isArray(task.tags) || !assessment || !VERDICTS.includes(assessment.verdict)
    || !Array.isArray(assessment.errorTags)) throw new TypeError('Core: invalid educational evidence');
  const conceptIds = conceptsFor(map, task);
  // Only an error on the axis this item measures counts; another axis is not diagnosed here.
  const observed = assessment.verdict === 'incorrect' ? [...new Set(assessment.errorTags.filter(tag => task.tags.includes(tag)))] : [];
  return {
    version: 'core-education-2', mapVersion: map.map_ver, verdict: assessment.verdict,
    diagnosis: observed.length ? 'observed-error' : assessment.verdict === 'correct' ? 'correct-on-this-item' : 'not-diagnosed',
    errorTags: observed, conceptIds,
    curriculum: conceptIds.map(id => { const node = map.getNode(id); return { id, kind: node.kind, label: node.label_ko }; }),
    missingTags: task.tags.filter(tag => map.forTag(tag).status !== 'exact'),
    scope: 'this-item-only', mastery: null,
  };
}

// A controller writes to the existing guarded Atlas session; it owns no log.
// `firstExposure` comes from the history the game keeps (see Trail.openHistory).
function createPractice({ session, decision, map, task, assess, firstExposure = null }) {
  const conceptIds = conceptsFor(map, task);
  const presentation = session.practice('presented', { decisionId: decision.id, taskId: task.id,
    taskVersion: task.version, itemKey: task.itemKey, conceptIds, firstExposure,
    ...(task.measure ? { measure: task.measure } : {}) });
  let attempts = 0, broken = false, met = null;
  const shown = new Set();
  // Any failure while recording (an attempt, or help that is already on screen) leaves
  // this presentation's record incomplete for good: a later answer is never relabelled
  // as a first, unassisted attempt.
  const guarded = work => { try { return work(); } catch (error) { broken = true; throw error; } };
  return {
    presentation,
    submit(response, { skipped = false, reason = null } = {}) {
      if (broken) throw new Error('Core: practice record incomplete');
      const result = diagnose({ map, task, assessment: skipped ? { verdict: 'skipped', errorTags: [] } : assess(response) });
      const event = guarded(() => session.practice('attempted', { presentationId: presentation.id, attemptNo: attempts + 1,
        verdict: result.verdict, errorTags: result.errorTags, ...(reason ? { reason } : {}) }));
      attempts += 1;
      if (!met) met = { itemKey: task.itemKey, conceptIds, at: event.at, verdict: result.verdict };
      return { ...result, eventId: event.id, attemptNo: attempts };
    },
    // Help counts once it is on screen. Repeated renders of the same help are one exposure.
    delivered(help) {
      return guarded(() => {
        if (!help || typeof help.id !== 'string' || !['cue', 'explanation', 'answer'].includes(help.level)
          || typeof help.contentRef !== 'string') throw new TypeError('Core: invalid delivered help');
        const key = `${help.id}|${help.level}|${help.contentRef}`;
        if (shown.has(key)) return null;
        const event = session.practice('helped', { presentationId: presentation.id, helpId: help.id, level: help.level, contentRef: help.contentRef });
        shown.add(key);
        if (help.level === 'answer' && !met) met = { itemKey: task.itemKey, conceptIds, at: event.at, verdict: null };
        return event;
      });
    },
    // The record to append to the game's pending history once this item was answered
    // or its answer shown (see Trail.openHistory). Null until then.
    met() { return met && { ...met, conceptIds: [...met.conceptIds] }; },
  };
}
module.exports = { conceptsFor, diagnose, createPractice };
