'use strict';

// These are declared evidence bounds, not measurements made by this module.
// Their source and clock assumptions remain the responsibility of the producer.
const TIME_BASES = Object.freeze(['declared-bound', 'clock-calibration', 'transport-bound', 'human-review']);
const HELP_SKILLS = Object.freeze(['object', 'past', 'all']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isoTime(value, label) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be an ISO timestamp.`);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new TypeError(`${label} must include an explicit ISO timezone and at most millisecond precision.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59 ||
      (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) {
    throw new TypeError(`${label} contains an invalid calendar time.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be a finite timestamp.`);
  return { iso: new Date(milliseconds).toISOString(), milliseconds };
}

function normalizeHelpScope(skills) {
  if (skills === undefined) return { status: 'known', skills: ['object', 'past'], rawSkills: null,
    reasonCode: 'default-supported-scope', basis: 'default' };
  const rawSkills = structuredClone(skills);
  if (!Array.isArray(skills) || skills.length === 0 || skills.some(skill => !HELP_SKILLS.includes(skill))) {
    return { status: 'unknown', skills: ['all'], rawSkills, reasonCode: 'help-scope-unrecognized', basis: 'invalid' };
  }
  const canonical = skills.includes('all') ? ['all'] : ['object', 'past'].filter(skill => skills.includes(skill));
  return { status: 'known', skills: canonical, rawSkills, reasonCode: 'declared-supported-scope', basis: 'declared' };
}

function normalizeTimeBounds(bounds) {
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) throw new TypeError('timeBounds must be an object.');
  const earliest = isoTime(bounds.earliestAt, 'timeBounds.earliestAt');
  const latest = isoTime(bounds.latestAt, 'timeBounds.latestAt');
  if (latest.milliseconds < earliest.milliseconds) throw new RangeError('timeBounds must be ordered earliest to latest.');
  if (!TIME_BASES.includes(bounds.basis)) throw new TypeError('timeBounds.basis must identify a supported source of the declared bounds.');
  if (typeof bounds.sourceRef !== 'string' || !bounds.sourceRef.trim()) throw new TypeError('timeBounds.sourceRef is required.');
  return { earliestAt: earliest.iso, latestAt: latest.iso, basis: bounds.basis, sourceRef: bounds.sourceRef.trim() };
}

function refineTimeBounds(previous, next) {
  const before = normalizeTimeBounds(previous);
  const after = normalizeTimeBounds(next);
  if (Date.parse(after.earliestAt) < Date.parse(before.earliestAt) || Date.parse(after.latestAt) > Date.parse(before.latestAt)) {
    throw new RangeError('A refinement must stay inside the previous time bounds. Record contradictory evidence separately.');
  }
  // A later source may justify tighter bounds. The caller records both sources
  // in its event history; this function neither erases nor invents that history.
  return after;
}

function classifyHelpTime(help, utterance) {
  const result = { relation: 'unknown', reasonCode: 'performance-interval-unavailable', helpBounds: null,
    performanceBounds: null, comparisons: null };
  try {
    if (help && own(help, 'timeBounds')) {
      result.helpBounds = normalizeTimeBounds(help.timeBounds);
    } else {
      const at = isoTime(help?.at, 'help.at').iso;
      result.helpBounds = { earliestAt: at, latestAt: at, basis: 'event-timestamp', sourceRef: help?.id || null };
    }
  } catch (error) {
    return { ...result, reasonCode: 'help-time-invalid', invalidReason: error.message };
  }
  let start, end;
  try {
    if (!utterance?.performanceInterval) return result;
    start = isoTime(utterance.performanceInterval.startedAt, 'performanceInterval.startedAt');
    end = isoTime(utterance.performanceInterval.endedAt, 'performanceInterval.endedAt');
    if (end.milliseconds < start.milliseconds) throw new RangeError('performanceInterval must be ordered start to end.');
    result.performanceBounds = { startedAt: start.iso, endedAt: end.iso,
      basis: utterance.performanceTimeSource || 'declared-capture-interval', sourceRef: utterance.id || null };
  } catch (error) {
    return { ...result, reasonCode: 'performance-interval-invalid', invalidReason: error.message };
  }
  const earliest = Date.parse(result.helpBounds.earliestAt), latest = Date.parse(result.helpBounds.latestAt);
  result.comparisons = {
    latestHelpBeforeStart: latest < start.milliseconds,
    earliestHelpAfterEnd: earliest > end.milliseconds,
    allHelpInsideCapture: earliest >= start.milliseconds && latest <= end.milliseconds,
    latestHelpMinusStartMs: latest - start.milliseconds,
    earliestHelpMinusEndMs: earliest - end.milliseconds,
  };
  if (result.comparisons.latestHelpBeforeStart) return { ...result, relation: 'before', reasonCode: 'help-certainly-before' };
  if (result.comparisons.earliestHelpAfterEnd) return { ...result, relation: 'after', reasonCode: 'help-certainly-after' };
  if (result.comparisons.allHelpInsideCapture) return { ...result, relation: 'overlap', reasonCode: 'help-certainly-during' };
  return { ...result, reasonCode: 'help-time-bounds-straddle-boundary' };
}

module.exports = { TIME_BASES, normalizeHelpScope, normalizeTimeBounds, refineTimeBounds, classifyHelpTime };
