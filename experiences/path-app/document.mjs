// Shared PATH account contract. Pure data only; browser and Edge use these bytes.
import { createInitialState, GOAL_IDS, LOCATION_IDS, LANG_IDS } from './state.mjs';

export const PATH_DOCUMENT_SCHEMA = 'synk.path-app';
export const PATH_DOCUMENT_VERSION = 1;
export const PATH_RESOURCE = 'path-app';
export const PATH_SCOPE = 'synk-path';
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const MAX_SAVED_JOBS = 100;
const BOARDS = ['moloco', 'coupang'];
const DEMOS = Object.freeze(Object.fromEntries(GOAL_IDS.flatMap(goal => ['a', 'b'].map(n => [`demo-${goal}-${n}`, goal]))));
const fail = (code = 'INVALID_PATH_DOCUMENT') => { throw Object.assign(new TypeError(code), { code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const wellFormed = value => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return false; }
    else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
};
const text = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0) && wellFormed(value) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const revision = value => Number.isSafeInteger(value) && value >= 0;
const sourceId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
const uniqueList = (value, max, valid) => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(valid);

export function jobSourceId(board, jobId) {
  if (!BOARDS.includes(board) || typeof jobId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(jobId)) fail();
  return `greenhouse-${board}-${jobId}`;
}

export function isSafeJobUrl(value, board, jobId) {
  try {
    jobSourceId(board, jobId);
    if (!text(value, 2048) || /[\s\\\u0000-\u001f]/.test(value)) return false;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) return false;
    if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname))
      return [ `/${board}/jobs/${jobId}`, `/${board}/jobs/${jobId}/` ].includes(url.pathname) && !url.search;
    if (board !== 'coupang' || url.hostname !== 'www.coupang.jobs') return false;
    const jobPath = url.pathname === '/en/jobs/' || new RegExp(`^/en/jobs/${jobId}/[a-zA-Z0-9%_-]+/$`).test(url.pathname);
    return jobPath && url.search === `?gh_jid=${jobId}`;
  } catch { return false; }
}

export function validateSavedJob(raw) {
  if (!exact(raw, ['id', 'provider', 'board', 'jobId', 'snapshot', 'savedAt']) || raw.provider !== 'greenhouse'
    || raw.id !== jobSourceId(raw.board, raw.jobId) || !iso(raw.savedAt)) fail();
  const s = raw.snapshot;
  if (!exact(s, ['company', 'title', 'location', 'employmentType', 'url', 'observedAt'])
    || !text(s.company, 120) || !text(s.title, 300) || !text(s.location, 240)
    || !(s.employmentType === null || text(s.employmentType, 200)) || !iso(s.observedAt)
    || !isSafeJobUrl(s.url, raw.board, raw.jobId)) fail();
  return { id: raw.id, provider: 'greenhouse', board: raw.board, jobId: raw.jobId,
    snapshot: { company: s.company, title: s.title, location: s.location, employmentType: s.employmentType, url: s.url, observedAt: s.observedAt }, savedAt: raw.savedAt };
}

export function validatePathState(raw, savedJobs = []) {
  if (!exact(raw, ['schemaVersion', 'revision', 'savedAt', 'lang', 'onboarded', 'primaryGoal', 'secondaryGoals', 'location', 'interests', 'tasks'])
    || raw.schemaVersion !== 1 || !revision(raw.revision) || !(raw.savedAt === null || iso(raw.savedAt))
    || !LANG_IDS.includes(raw.lang) || typeof raw.onboarded !== 'boolean'
    || !(raw.primaryGoal === null || GOAL_IDS.includes(raw.primaryGoal)) || !LOCATION_IDS.includes(raw.location)
    || !uniqueList(raw.secondaryGoals, 3, goal => GOAL_IDS.includes(goal) && goal !== raw.primaryGoal)
    || !uniqueList(raw.interests, 20, sourceId) || !Array.isArray(raw.tasks) || raw.tasks.length > 50) fail();
  const known = new Set(savedJobs.map(job => job.id)), seen = new Set();
  const tasks = raw.tasks.map(task => {
    if (!exact(task, ['id', 'goal', 'sourceId', 'body', 'confirmedAt', 'updatedAt'])
      || typeof task.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(task.id) || seen.has(task.id)
      || !GOAL_IDS.includes(task.goal) || !sourceId(task.sourceId) || !text(task.body, 6000, true)
      || !iso(task.updatedAt) || !(task.confirmedAt === null || iso(task.confirmedAt) && task.body.trim())) fail();
    if (Object.hasOwn(DEMOS, task.sourceId) ? DEMOS[task.sourceId] !== task.goal : task.goal !== 'job' || !known.has(task.sourceId)) fail();
    seen.add(task.id);
    return { id: task.id, goal: task.goal, sourceId: task.sourceId, body: task.body, confirmedAt: task.confirmedAt, updatedAt: task.updatedAt };
  });
  return { schemaVersion: 1, revision: raw.revision, savedAt: raw.savedAt, lang: raw.lang, onboarded: raw.onboarded,
    primaryGoal: raw.primaryGoal, secondaryGoals: [...raw.secondaryGoals], location: raw.location, interests: [...raw.interests], tasks };
}

export function validatePathDocument(raw) {
  let bytes;
  try { bytes = new TextEncoder().encode(JSON.stringify(raw)).byteLength; } catch { fail(); }
  if (bytes > MAX_DOCUMENT_BYTES) fail('PATH_DOCUMENT_TOO_LARGE');
  if (!exact(raw, ['schema', 'version', 'state', 'savedJobs']) || raw.schema !== PATH_DOCUMENT_SCHEMA
    || raw.version !== PATH_DOCUMENT_VERSION || !Array.isArray(raw.savedJobs) || raw.savedJobs.length > MAX_SAVED_JOBS) fail();
  const savedJobs = raw.savedJobs.map(validateSavedJob);
  if (new Set(savedJobs.map(job => job.id)).size !== savedJobs.length) fail();
  return { schema: PATH_DOCUMENT_SCHEMA, version: PATH_DOCUMENT_VERSION, state: validatePathState(raw.state, savedJobs), savedJobs };
}

export function createPathDocument(lang = 'ko') {
  return { schema: PATH_DOCUMENT_SCHEMA, version: PATH_DOCUMENT_VERSION, state: createInitialState(lang), savedJobs: [] };
}

export function addSavedJob(raw, job, now = new Date().toISOString()) {
  const doc = validatePathDocument(raw);
  const stamp = now instanceof Date ? now.toISOString() : typeof now === 'number' ? new Date(now).toISOString() : now;
  const existing = doc.savedJobs.find(item => item.id === job.id);
  const saved = validateSavedJob({ id: job.id, provider: job.provider, board: job.board, jobId: job.jobId,
    snapshot: { company: job.company, title: job.title, location: job.location, employmentType: job.employmentType, url: job.url, observedAt: job.observedAt }, savedAt: existing?.savedAt || stamp });
  if (existing) doc.savedJobs[doc.savedJobs.indexOf(existing)] = saved;
  else { if (doc.savedJobs.length >= MAX_SAVED_JOBS) fail('PATH_JOB_LIMIT'); doc.savedJobs.push(saved); }
  return validatePathDocument(doc);
}

export function removeSavedJob(raw, id) {
  const doc = validatePathDocument(raw);
  if (doc.state.tasks.some(task => task.sourceId === id)) fail('JOB_IN_USE');
  doc.savedJobs = doc.savedJobs.filter(job => job.id !== id);
  return doc;
}
