import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, MAX_TASKS, MAX_BODY, GOAL_IDS,
  createInitialState, createTaskId, normalizeState, updateProfile,
  upsertTask, confirmTask, taskStatus, getNextTask,
} from './state.mjs';
import { GOALS, OPPORTUNITIES, OFFICIAL_LINKS, EXISTING_TOOLS } from './content.mjs';

const FIRST = '2026-11-09T10:00:00.000Z';
const NEXT = '2026-11-09T10:01:00.000Z';
const LAST = '2026-11-09T10:02:00.000Z';
const copy = value => structuredClone(value);

function withTask(body = '고객 응대 활동에서 질문을 정리했습니다.', goal = 'job', sourceId = 'demo-job-a') {
  const state = updateProfile(createInitialState(), { onboarded: true, primaryGoal: goal }, FIRST);
  return upsertTask(state, { goal, sourceId, body }, NEXT);
}

function fullState() {
  let state = createInitialState();
  for (let i = 0; i < MAX_TASKS; i += 1) {
    state = upsertTask(state, { goal: 'job', sourceId: `sample-${i}`, body: `작성물 ${i}` }, FIRST);
  }
  return state;
}

test('changing the main goal, language and residence preserves every draft and confirmation', () => {
  let state = withTask();
  state = confirmTask(state, state.tasks[0].id, LAST);
  state = upsertTask(state, { goal: 'study', sourceId: 'demo-study-a', body: '전공 선택 이유' }, LAST);
  const before = copy(state);
  const changed = updateProfile(state, {
    primaryGoal: 'student', secondaryGoals: ['job', 'study'], lang: 'en', location: 'abroad',
  }, LAST);
  assert.deepEqual(changed.tasks, before.tasks);
  assert.deepEqual(state, before, 'updating profile must not mutate the caller’s copy');
  assert.equal(changed.primaryGoal, 'student');
  assert.equal(changed.lang, 'en');
  assert.equal(changed.location, 'abroad');
  assert.equal(taskStatus(changed.tasks[0]), 'confirmed');
});

test('editing a confirmed statement clears confirmation; an unchanged save preserves it', () => {
  const original = withTask();
  const id = original.tasks[0].id;
  const confirmed = confirmTask(original, id, LAST);
  const unchanged = upsertTask(confirmed, { ...confirmed.tasks[0] }, LAST);
  assert.equal(taskStatus(unchanged.tasks[0]), 'confirmed');
  assert.equal(unchanged.tasks[0].confirmedAt, LAST);
  const edited = upsertTask(confirmed, { ...confirmed.tasks[0], body: '경험의 날짜를 바로잡았습니다.' }, LAST);
  assert.equal(taskStatus(edited.tasks[0]), 'draft');
  assert.equal(edited.tasks[0].confirmedAt, null);
  assert.equal(taskStatus(confirmed.tasks[0]), 'confirmed', 'the previous version stays intact');
});

test('self-confirmation is tied to its opportunity and cannot be carried to another one by reusing an id', () => {
  const draft = withTask();
  const confirmed = confirmTask(draft, draft.tasks[0].id, LAST);
  const oldTask = confirmed.tasks[0];
  let changed;
  try {
    changed = upsertTask(confirmed, { ...oldTask, goal: 'study', sourceId: 'demo-study-a' }, LAST);
  } catch {
    assert.equal(confirmed.tasks[0].confirmedAt, LAST);
    return; // Rejecting the attempted rebind is also safe.
  }
  assert.equal(changed.tasks[0].confirmedAt, null, 'a new opportunity requires a new self-confirmation');
  assert.equal(taskStatus(changed.tasks[0]), 'draft');
});

test('empty and whitespace-only text cannot be marked prepared', () => {
  for (const body of ['', ' \n\t\r ', '\u3000\u00a0']) {
    const state = withTask(body);
    assert.throws(() => confirmTask(state, state.tasks[0].id, LAST));
    assert.equal(taskStatus(state.tasks[0]), 'draft');
    assert.equal(state.tasks[0].confirmedAt, null);
  }
});

test('self-confirmation means prepared, not externally submitted or institution-confirmed', () => {
  const state = withTask();
  const confirmed = confirmTask(state, state.tasks[0].id, LAST);
  assert.equal(taskStatus(confirmed.tasks[0]), 'confirmed');
  for (const key of ['submittedAt', 'receivedAt', 'eligible', 'visaApproved']) {
    assert.equal(Object.hasOwn(confirmed.tasks[0], key), false);
  }
});

test('neutral onboarding keeps drafts without inventing a main-goal recommendation', () => {
  const state = withTask();
  const neutral = updateProfile(state, { primaryGoal: null, secondaryGoals: [], onboarded: true }, LAST);
  assert.equal(getNextTask(neutral), null);
  assert.deepEqual(neutral.tasks, state.tasks, 'no recommendation does not mean no saved work');
  const selected = updateProfile(neutral, { primaryGoal: 'job' }, LAST);
  assert.equal(getNextTask(selected)?.id, state.tasks[0].id);
});

test('next task uses the selected goal, skips prepared work and returns an independent copy', () => {
  let state = withTask();
  state = confirmTask(state, state.tasks[0].id, LAST);
  state = upsertTask(state, { goal: 'study', sourceId: 'demo-study-a', body: '유학 준비' }, LAST);
  state = upsertTask(state, { goal: 'job', sourceId: 'demo-job-b', body: '두 번째 직무 준비' }, LAST);
  const next = getNextTask(state);
  assert.equal(next?.sourceId, 'demo-job-b');
  next.body = 'outside edit';
  assert.equal(state.tasks[2].body, '두 번째 직무 준비');
  const study = updateProfile(state, { primaryGoal: 'study' }, LAST);
  assert.equal(getNextTask(study)?.sourceId, 'demo-study-a');
});

test('malformed containers and future versions are rejected rather than treated as a fresh account', () => {
  const baseline = withTask();
  const invalid = [null, [], 'text', 1,
    { ...baseline, schemaVersion: SCHEMA_VERSION + 1 },
    { ...baseline, schemaVersion: String(SCHEMA_VERSION) },
    { ...baseline, tasks: {} },
    { ...baseline, tasks: null },
  ];
  for (const raw of invalid) assert.equal(normalizeState(raw), null);
});

test('restoring a partially malformed collection must reject it without losing the valid original draft', async t => {
  const baseline = withTask('반드시 보존할 원문');
  const invalidTasks = {
    nullTask: null,
    nonTextBody: { ...baseline.tasks[0], id: 'second', body: { text: '작성물' } },
    unknownGoal: { ...baseline.tasks[0], id: 'second', goal: 'unknown' },
    injectedId: { ...baseline.tasks[0], id: '<img src=x onerror=alert(1)>' },
    injectedSource: { ...baseline.tasks[0], id: 'second', sourceId: '../private' },
  };
  for (const [name, task] of Object.entries(invalidTasks)) {
    await t.test(name, () => {
      const raw = { ...baseline, tasks: [...baseline.tasks, task] };
      const before = JSON.stringify(raw);
      assert.ok(normalizeState(raw) === null, 'returning a partial success allows the caller to overwrite the original collection');
      assert.equal(JSON.stringify(raw), before);
    });
  }
});

test('duplicate task ids with different user text are rejected, never silently deduplicated', () => {
  const raw = withTask('첫 번째 보존할 원문');
  raw.tasks.push({ ...raw.tasks[0], body: '두 번째 보존할 원문', updatedAt: LAST });
  assert.ok(normalizeState(raw) === null, 'duplicate ids must not discard either original statement');
  assert.equal(raw.tasks.length, 2);
  assert.equal(raw.tasks[1].body, '두 번째 보존할 원문');
});

test('restoring an overlong statement must reject rather than shorten a user’s original', () => {
  const raw = withTask();
  const body = '가'.repeat(MAX_BODY) + '끝까지 남길 문장';
  raw.tasks[0].body = body;
  raw.tasks[0].confirmedAt = LAST;
  assert.ok(normalizeState(raw) === null, 'truncated text must not inherit confirmation or be autosaved over its original');
  assert.equal(raw.tasks[0].body, body);
});

test('an overlong new edit is rejected without changing the previous statement', () => {
  const state = withTask('기존 원문');
  const before = copy(state);
  assert.throws(() => upsertTask(state, { ...state.tasks[0], body: '가'.repeat(MAX_BODY + 1) }, LAST));
  assert.deepEqual(state, before);
});

test('valid text survives normalization exactly, including spaces, multiline Korean and literal HTML', () => {
  const body = '  첫 줄\r\n둘째 줄 👩‍🎓\n<script>doNotExecute()</script>\n 마지막 공백  ';
  const raw = withTask(body);
  const before = copy(raw);
  const normalized = normalizeState(raw);
  assert.notEqual(normalized, null);
  assert.equal(normalized.tasks[0].body, body, 'the model stores user text verbatim; the renderer must use text-safe output');
  assert.deepEqual(raw, before);
  normalized.tasks[0].body = 'separate copy';
  assert.equal(raw.tasks[0].body, body);
});

test('a malformed revision cannot silently reset the conflict-detection token', async t => {
  for (const revision of [-1, '3', 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    await t.test(String(revision), () => {
      assert.ok(normalizeState({ ...withTask(), revision }) === null, 'an invalid revision must not become revision zero');
    });
  }
});

test('50 saved tasks remain editable but a 51st insert or over-limit restore is rejected', () => {
  const state = fullState();
  assert.equal(state.tasks.length, 50);
  assert.equal(normalizeState(state)?.tasks.length, 50);
  const edited = upsertTask(state, { ...state.tasks[0], body: '기존 작성물 수정' }, LAST);
  assert.equal(edited.tasks.length, 50);
  assert.equal(edited.tasks[0].body, '기존 작성물 수정');
  assert.throws(() => upsertTask(state, { goal: 'job', sourceId: 'sample-new', body: '새 작성물' }, LAST));
  assert.equal(normalizeState({ ...state, tasks: [...state.tasks, { ...state.tasks[0], id: 'additional' }] }), null);
  assert.equal(state.tasks.length, 50);
});

test('invalid task identifiers are rejected and profile input cannot replace task records', () => {
  const state = withTask();
  for (const sourceId of ['../secret', 'javascript:alert(1)', '<img>', '__proto__']) {
    assert.throws(() => createTaskId('job', sourceId));
    assert.throws(() => upsertTask(state, { goal: 'job', sourceId, body: 'text' }, LAST));
  }
  const patch = JSON.parse('{"lang":"en","tasks":[],"__proto__":{"pathPolluted":true}}');
  const changed = updateProfile(state, patch, LAST);
  assert.deepEqual(changed.tasks, state.tasks);
  assert.equal({}.pathPolluted, undefined);
  assert.equal(Object.hasOwn(changed, '__proto__'), false);
});

test('all three entry goals have bilingual first actions and distinct usable examples', () => {
  assert.deepEqual([...GOALS.map(g => g.id)].sort(), [...GOAL_IDS].sort());
  for (const goal of GOALS) {
    for (const field of ['label', 'description', 'homeTitle', 'homeAction']) {
      for (const lang of ['ko', 'en']) assert.ok(goal[field]?.[lang]?.trim(), `${goal.id}.${field}.${lang}`);
    }
    const examples = OPPORTUNITIES.filter(o => o.goal === goal.id);
    assert.ok(examples.length >= 2, `${goal.id} needs more than one example to support comparison`);
  }
  const ids = [...OPPORTUNITIES, ...OFFICIAL_LINKS].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'official resources and examples must never share an identity');
});

test('demo opportunities never masquerade as live institution or hiring records', () => {
  for (const item of OPPORTUNITIES) {
    assert.equal(item.source, 'demo');
    assert.equal(item.url, undefined, 'a demo opportunity must not offer a real application endpoint');
    for (const lang of ['ko', 'en']) {
      assert.ok(item.title[lang]?.trim());
      assert.ok(item.prompt[lang]?.trim());
      assert.ok(item.requirements.every(r => r[lang]?.trim()));
    }
    assert.match(item.title.ko, /예시/);
    assert.match(item.title.en, /Example/);
    assert.match(item.summary.ko, /데모/);
    assert.match(item.summary.en, /demo/i);
    for (const key of ['deadline', 'salary', 'visaConditions', 'eligibilityConfirmed']) {
      assert.equal(Object.hasOwn(item, key), false, `${item.id} must not invent ${key}`);
    }
  }
});

test('official resources are original-site references, with no invented preparation or submission claim', () => {
  for (const item of OFFICIAL_LINKS) {
    assert.equal(item.source, 'official');
    assert.equal(item.summaryOnly, true);
    assert.equal(new URL(item.url).protocol, 'https:');
    assert.match(item.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.prompt, undefined);
    assert.equal(item.requirements, undefined);
    for (const lang of ['ko', 'en']) assert.ok(item.title[lang]?.trim() && item.summary[lang]?.trim());
  }
  for (const item of EXISTING_TOOLS) assert.equal(new URL(item.url).protocol, 'https:');
});
