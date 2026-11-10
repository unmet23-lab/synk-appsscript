// PATH app state model. Pure functions only: no window, DOM or storage access.
export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'synk-path-app-v1';
export const SESSION_KEY = 'synk-path-app-session-v1';

export const GOAL_IDS = Object.freeze(['study', 'student', 'job']);
export const LOCATION_IDS = Object.freeze(['unknown', 'korea', 'abroad']);
export const LANG_IDS = Object.freeze(['ko', 'en']);
export const MAX_TASKS = 50;
export const MAX_BODY = 6000;
export const MAX_INTERESTS = 20;

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isGoal = (v) => GOAL_IDS.includes(v);
const isIsoString = (v) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const toIso = (now) => {
  const d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
const capBody = (s) => (typeof s === 'string' ? s.slice(0, MAX_BODY) : '');

export function isValidGoal(v) { return isGoal(v); }
export function isValidSourceId(v) { return typeof v === 'string' && SOURCE_RE.test(v); }
export function createTaskId(goal, sourceId) {
  if (!isGoal(goal) || !isValidSourceId(sourceId)) throw new Error('Invalid goal or source');
  return goal + '-' + sourceId;
}

export function createInitialState(lang = 'ko') {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    savedAt: null,
    lang: lang === 'en' ? 'en' : 'ko',
    onboarded: false,
    primaryGoal: null,
    secondaryGoals: [],
    location: 'unknown',
    interests: [],
    tasks: []
  };
}

function cleanGoals(list, primary) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const g of list) if (isGoal(g) && g !== primary && !out.includes(g)) out.push(g);
  return out;
}

function cleanInterests(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const i of list) {
    if (typeof i === 'string' && SOURCE_RE.test(i) && !out.includes(i)) out.push(i);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

function cleanTask(t) {
  if (!isObj(t)) return null;
  if (typeof t.id !== 'string' || !ID_RE.test(t.id)) return null;
  if (!isGoal(t.goal) || !isValidSourceId(t.sourceId) || typeof t.body !== 'string') return null;
  if (t.body.length > MAX_BODY) return null;
  const body = t.body;
  if (!isIsoString(t.updatedAt)) return null;
  const updatedAt = t.updatedAt;
  let confirmedAt = null;
  if (t.confirmedAt !== null && t.confirmedAt !== undefined) {
    if (!isIsoString(t.confirmedAt) || !body.trim()) return null;
    confirmedAt = t.confirmedAt;
  }
  return { id: t.id, goal: t.goal, sourceId: t.sourceId, body, confirmedAt, updatedAt };
}

// Returns a sanitized state, or null for corrupt / unsupported / future data.
// Never throws; callers must leave the original stored bytes untouched on null.
export function normalizeState(raw) {
  try {
    if (!isObj(raw)) return null;
    if (raw.schemaVersion !== SCHEMA_VERSION) return null;
    if (raw.tasks !== undefined && !Array.isArray(raw.tasks)) return null;
    const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    if (rawTasks.length > MAX_TASKS) return null;
    const primaryGoal = isGoal(raw.primaryGoal) ? raw.primaryGoal : null;
    const tasks = [];
    const seen = new Set();
    for (const t of rawTasks) {
      const c = cleanTask(t);
      if (!c || seen.has(c.id)) return null;
      seen.add(c.id);
      tasks.push(c);
    }
    if (!Number.isSafeInteger(raw.revision) || raw.revision < 0) return null;
    const rev = raw.revision;
    return {
      schemaVersion: SCHEMA_VERSION,
      revision: rev,
      savedAt: isIsoString(raw.savedAt) ? raw.savedAt : null,
      lang: raw.lang === 'en' ? 'en' : 'ko',
      onboarded: raw.onboarded === true,
      primaryGoal,
      secondaryGoals: cleanGoals(raw.secondaryGoals, primaryGoal),
      location: LOCATION_IDS.includes(raw.location) ? raw.location : 'unknown',
      interests: cleanInterests(raw.interests),
      tasks
    };
  } catch {
    return null;
  }
}

function requireState(state) {
  const s = normalizeState(state);
  if (!s) throw new Error('Invalid state');
  return s;
}

function bump(s, now) {
  s.revision += 1;
  s.savedAt = toIso(now);
  return s;
}

const PROFILE_FIELDS = ['lang', 'onboarded', 'primaryGoal', 'secondaryGoals', 'location', 'interests'];

// Whitelisted profile update. Invalid values throw; tasks are always preserved.
export function updateProfile(state, patch, now) {
  const s = requireState(state);
  if (!isObj(patch)) throw new Error('Invalid profile patch');
  for (const key of PROFILE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const v = patch[key];
    if (key === 'lang') {
      if (!LANG_IDS.includes(v)) throw new Error('Invalid language');
      s.lang = v;
    } else if (key === 'onboarded') {
      if (typeof v !== 'boolean') throw new Error('Invalid onboarded flag');
      s.onboarded = v;
    } else if (key === 'primaryGoal') {
      if (v !== null && !isGoal(v)) throw new Error('Invalid goal');
      s.primaryGoal = v;
    } else if (key === 'secondaryGoals') {
      if (!Array.isArray(v)) throw new Error('Invalid secondary goals');
      s.secondaryGoals = cleanGoals(v, null);
    } else if (key === 'location') {
      if (!LOCATION_IDS.includes(v)) throw new Error('Invalid location');
      s.location = v;
    } else if (key === 'interests') {
      if (!Array.isArray(v)) throw new Error('Invalid interests');
      s.interests = cleanInterests(v);
    }
  }
  s.secondaryGoals = s.secondaryGoals.filter((g) => g !== s.primaryGoal);
  return bump(s, now);
}

// Insert or update a task. Changed body clears confirmation; same body keeps it.
// Throws instead of silently dropping when the task limit is reached.
export function upsertTask(state, input, now) {
  const s = requireState(state);
  if (!isObj(input)) throw new Error('Invalid task');
  const { goal, sourceId } = input;
  if (!isGoal(goal) || !isValidSourceId(sourceId)) throw new Error('Invalid task goal or source');
  const id = input.id === undefined ? createTaskId(goal, sourceId) : input.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('Invalid task id');
  if (input.body !== undefined && typeof input.body !== 'string') throw new Error('Invalid task body');
  if (typeof input.body === 'string' && input.body.length > MAX_BODY) throw new Error('Task body too long');
  const iso = toIso(now);
  const idx = s.tasks.findIndex((t) => t.id === id);
  if (idx >= 0) {
    const prev = s.tasks[idx];
    const body = input.body === undefined ? prev.body : input.body;
    const same = body === prev.body && goal === prev.goal && sourceId === prev.sourceId;
    s.tasks[idx] = {
      id, goal, sourceId, body,
      confirmedAt: same ? prev.confirmedAt : null,
      updatedAt: same ? prev.updatedAt : iso
    };
  } else {
    if (s.tasks.length >= MAX_TASKS) throw new Error('Task limit reached');
    s.tasks.push({ id, goal, sourceId, body: capBody(input.body || ''), confirmedAt: null, updatedAt: iso });
  }
  return bump(s, now);
}

// Marks a task as self-confirmed (prepared, not submitted). Empty bodies cannot be confirmed.
export function confirmTask(state, id, now) {
  const s = requireState(state);
  const task = s.tasks.find((t) => t.id === id);
  if (!task) throw new Error('Task not found');
  if (!task.body.trim()) throw new Error('Task body is empty');
  task.confirmedAt = toIso(now);
  return bump(s, now);
}

// Returns 'draft' | 'confirmed' for UI labels; derived, never stored.
export function taskStatus(task) {
  return task && task.confirmedAt && typeof task.body === 'string' && task.body.trim() ? 'confirmed' : 'draft';
}

export function getNextTask(state) {
  const s = normalizeState(state);
  if (!s || !s.primaryGoal) return null;
  const t = s.tasks.find((x) => x.goal === s.primaryGoal && !x.confirmedAt);
  return t ? { ...t } : null;
}
