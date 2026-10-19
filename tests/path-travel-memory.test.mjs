import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { planTravel, replanRemainingTravel, assessPlannerRequirements, plannerInputFingerprint, SEMANTIC_KEYS } from '../experiences/path-travel/planner.mjs';
import { createWalkingRouter } from '../experiences/path-travel/walking-router.mjs';
import { TRAVEL_STORAGE_KEY, createTravelMemory, validateTravelMemory, setTravelConsent, saveTravelMemory,
  loadTravelMemory, clearTravelMemory, exportTravelMemory, importTravelMemory, migrateLegacyTravel } from '../experiences/path-travel/planner-storage.mjs';
import { recordPlanDecision, recordPlanExposure, recordVisit, recordTripOutcome, proposeVisitPreference,
  confirmTravelPreference, removeTravelPreference, removeTravelVisit, editTravelVisit, clearTravelHistory,
  summarizeTravelMemory, TRAVEL_PREFERENCE_KEYS } from '../experiences/path-travel/planner-feedback.mjs';
import { TRAVEL_ACCOUNT_CONTRACT, travelAccountDocument, travelDeviceState } from '../experiences/path-travel/planner-account.mjs';

const T0 = '2026-10-09T02:00:00.000Z';
const T1 = '2026-10-09T03:00:00.000Z';
const LATER = '2026-11-10T02:00:00.000Z';
const placeId = TRAVEL_PLACES[0].id;
function storage() { const records = new Map(); return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key), records }; }
function memory() { return createTravelMemory({}, { now: T0 }); }
function observed() {
  const decided = recordPlanDecision(memory(), { planId: 'route-test', candidateIds: ['route-test', 'route-other'], now: T0 });
  const decisionId = decided.journal.decisions[0].id;
  return { decisionId, value: recordPlanExposure(decided, { decisionId, now: T0 }) };
}
async function actualWalkingPlan(settings = {}) {
  const map = JSON.parse(await readFile(new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url), 'utf8'));
  const input = { ...memory().query, ...settings }, result = planTravel(input, { now: T0, routeLeg: createWalkingRouter(map) });
  assert.ok(result.primary, 'actual local OSM graph and current catalog yield an itinerary');
  return createTravelMemory({ query: result.input, plan: result.primary }, { now: T0 });
}
async function remainingMemory() {
  const initial = await actualWalkingPlan({ requiredCategories: ['food'] });
  const completed = initial.plan.stops.find(stop => stop.place.category === 'food');
  assert.ok(completed);
  const skipped = initial.plan.stops.find(stop => stop.placeId !== completed.placeId);
  const map = JSON.parse(await readFile(new URL('../experiences/path-travel/assets/jongno-walking.json', import.meta.url), 'utf8'));
  const result = replanRemainingTravel(initial.query, { completedIds: [completed.placeId], skippedIds: [skipped.placeId],
    currentTime: '14:00', origin: { id: completed.placeId, name: completed.place.name, ...completed.place.coordinates },
    remainingBudget: 40000, maxWalkMinutes: 45, stopCount: 1, now: T1, routeLeg: createWalkingRouter(map), ask: false });
  assert.ok(result.primary, 'one remaining stop is possible from the actual completed place');
  return createTravelMemory({ query: result.input, plan: result.primary, progress: {
    date: initial.query.date, currentTime: '14:00', completed: [{ placeId: completed.placeId, completedTime: '13:40' }],
    skippedIds: [skipped.placeId], requiredCategories: initial.query.requiredCategories, finished: false, updatedAt: T1,
  } }, { now: T1 });
}

test('account, device and file round trips tolerate independent clocks while preserving document event order', () => {
  for (const offset of [-300000, -5000, 5000, 300000]) {
    const deviceTime = new Date(Date.parse(T0) + offset).toISOString();
    const base = createTravelMemory({}, { now: deviceTime });
    const reported = recordVisit(base, { placeId, rating: 4, now: deviceTime });
    const account = travelAccountDocument(reported, { now: T0 });
    const slowReaderTime = new Date(Date.parse(deviceTime) - 300000).toISOString();
    const restored = travelDeviceState(account, { now: slowReaderTime });
    assert.deepEqual(restored, reported, 'server and another device do not reject valid data by their own clock');
    const file = exportTravelMemory(restored, { now: slowReaderTime });
    assert.deepEqual(importTravelMemory(file, { now: T0 }), restored);
    const device = storage(), consented = setTravelConsent(restored, true, { now: slowReaderTime });
    assert.equal(consented.updatedAt, deviceTime, 'consent cannot move document time behind existing facts');
    saveTravelMemory(consented, device, { now: slowReaderTime });
    assert.deepEqual(loadTravelMemory(device, { now: T0 }), consented);
    const broken = structuredClone(restored); broken.updatedAt = slowReaderTime;
    assert.throws(() => travelAccountDocument(broken, { now: T0 }), TypeError, 'internal event order remains enforced');
  }
});

test('saved plan date and all normalized input choices remain bound without recalculating an archived route', async () => {
  const value = await actualWalkingPlan(), original = JSON.parse(exportTravelMemory(value, { now: T0 }));
  const device = storage(); saveTravelMemory(setTravelConsent(value, true, { now: T0 }), device, { now: T0 });
  const before = device.getItem(TRAVEL_STORAGE_KEY);
  for (const change of [
    m => m.query.date = '2026-10-10',
    m => m.query.preferences = { tea: true },
    m => m.query.budget += 1000,
    m => m.plan.inputFingerprint = 'unrelated-input',
  ]) {
    const changed = structuredClone(original); change(changed.memory);
    assert.throws(() => importTravelMemory(JSON.stringify(changed), { now: LATER }), /날짜·여행 조건/);
    assert.throws(() => travelAccountDocument({ ...changed.memory, consent: false }, { now: T0 }), /날짜·여행 조건/);
    assert.throws(() => saveTravelMemory({ ...changed.memory, consent: true }, device, { now: T0 }), /날짜·여행 조건/);
    assert.equal(device.getItem(TRAVEL_STORAGE_KEY), before);
  }
  assert.deepEqual(importTravelMemory(JSON.stringify(original), { now: LATER }).plan, value.plan);
});

test('plan constraints and party quantities are enforced even when a file recomputes its non-secret input fingerprint', async () => {
  const value = await actualWalkingPlan({ party: { adults: 2, children: 1 }, budget: 180000, stopCount: 2,
    lockedIds: ['seoul-museum-craft-art', 'gaeseong-mandu-koong'] });
  assert.ok(value.plan.cost.knownAmount > 0);
  assert.ok(!value.plan.stops.some(stop => stop.place.category === 'tea'));
  const changes = [
    ['exclude selected stop', m => { m.query.lockedIds = []; m.plan.lockedIds = []; m.query.excludedIds = [m.plan.stops[0].placeId]; }],
    ['lock omitted stop', m => { m.query.lockedIds = ['jogyesa']; m.plan.lockedIds = []; }],
    ['plan lock differs from query', m => m.plan.lockedIds = []],
    ['missing required category', m => m.query.requiredCategories = ['tea']],
    ['known total exceeds budget', m => m.query.budget = m.plan.cost.knownAmount - 1],
    ['zero budget with paid venues', m => m.query.budget = 0],
    ['adult quantities differ', m => m.query.party.adults = 3],
    ['child quantities differ', m => m.query.party.children = 2],
  ];
  assert.ok(value.plan.stops.some(stop => stop.cost.items.some(item => item.basis === 'child-admission')));
  for (const [label, change] of changes) {
    const broken = structuredClone(value); change(broken);
    broken.plan.inputFingerprint = plannerInputFingerprint(broken.query);
    assert.throws(() => validateTravelMemory(broken, { now: LATER }), TypeError, label);
    assert.throws(() => travelAccountDocument(broken, { now: T0 }), TypeError, label);
  }
  const free = await actualWalkingPlan({ budget: 0, stopCount: 2, lockedIds: ['jogyesa', 'unhyeongung'], maxWalkMinutes: 120 });
  const first = free.plan.stops[0]; first.cost.status = 'unknown'; first.cost.unknowns = ['합성 시험: 확인되지 않은 추가 비용'];
  free.plan.cost.status = 'unknown'; free.plan.cost.unknownPlaceIds = [first.placeId]; free.plan.status = 'partial';
  assert.throws(() => validateTravelMemory(free, { now: LATER }), /0원 예산/, 'unconfirmed free visits cannot satisfy a zero budget');
});

test('the actual pre-companion browser export retains its date, route and prices through account and file restoration', async () => {
  const raw = await readFile(new URL('../experiences/path-travel/qa/schedule-20261009/browser-export.json', import.meta.url), 'utf8');
  const original = JSON.parse(raw), restored = importTravelMemory(raw, { now: LATER });
  assert.equal(Object.hasOwn(original.memory.query, 'companions'), false);
  assert.equal(restored.plan.inputFingerprint, 'zq0bpr-1ev1mg1', 'recorded legacy fingerprint is retained');
  assert.deepEqual(restored.plan, original.memory.plan);
  assert.deepEqual(restored.query.companions, []);
  assert.deepEqual(travelDeviceState(travelAccountDocument(restored, { now: LATER }), { now: T0 }), restored);
  const changed = structuredClone(restored); changed.query.companions = [{ id: 'new', label: '새 동행', preferences: { art: true }, requiredFeatures: {} }];
  assert.throws(() => validateTravelMemory(changed, { now: LATER }), /날짜·여행 조건/, 'legacy input cannot conceal new companion settings');
  const nextDay = structuredClone(original); nextDay.memory.query.date = '2026-10-11';
  assert.throws(() => importTravelMemory(JSON.stringify(nextDay), { now: LATER }), /날짜·여행 조건/);
});

test('remaining itinerary progress moves between devices and account documents without creating reviews or inferred preferences', async () => {
  const value = await remainingMemory();
  assert.equal(value.plan.stops.length, 1);
  assert.equal(value.query.planningMode, 'remaining');
  assert.deepEqual(value.progress.requiredCategories, ['food']);
  assert.deepEqual(value.query.requiredCategories, [], 'a completed meal satisfies the original requested category');
  const copy = importTravelMemory(exportTravelMemory(value, { now: T1 }), { now: LATER });
  assert.deepEqual(copy, value, 'a past one-stop remaining plan is an archive, not a fresh recommendation');
  assert.deepEqual(copy.visits, []);
  assert.deepEqual(copy.confirmedPreferences, []);
  assert.deepEqual(copy.journal, { trail: [], decisions: [], exposures: [], outcomes: [] });
  const device = storage();
  saveTravelMemory(setTravelConsent(copy, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }).progress, value.progress);
  const account = travelAccountDocument(value, { now: T1 });
  assert.equal(Object.hasOwn(account, 'consent'), false);
  assert.deepEqual(travelDeviceState(account, { now: LATER }).progress, value.progress);
  const delayed = structuredClone(value); delayed.progress.currentTime = '13:50';
  assert.equal(importTravelMemory(exportTravelMemory(delayed, { now: T1 }), { now: LATER }).query.startTime, '14:00',
    'the next departure may be later than the reported progress time');
  for (const mode of ['day', undefined]) {
    const invalid = structuredClone(value); delete invalid.progress;
    if (mode === undefined) delete invalid.query.planningMode; else invalid.query.planningMode = mode;
    invalid.query.stopCount = 3;
    assert.throws(() => validateTravelMemory(invalid, { now: T1 }), TypeError, 'one stop does not weaken normal-day plan validation');
  }
});

test('finishing and correcting progress preserve explicit self-reports and leave review history separate', async () => {
  const value = await remainingMemory(), finished = structuredClone(value);
  finished.plan = null; finished.progress.finished = true; finished.progress.currentTime = '20:00';
  finished.progress.completed[0].completedTime = '19:55';
  const end = importTravelMemory(exportTravelMemory(finished, { now: T1 }), { now: LATER });
  assert.equal(end.plan, null);
  assert.equal(end.progress.currentTime, '20:00', 'finishing may be reported after the planned end');
  assert.deepEqual(end.visits, []);
  const corrected = structuredClone(value), removed = corrected.progress.completed[0].placeId;
  corrected.progress.completed = [];
  corrected.query.excludedIds = corrected.query.excludedIds.filter(id => id !== removed);
  corrected.plan.inputFingerprint = plannerInputFingerprint(corrected.query);
  assert.deepEqual(importTravelMemory(exportTravelMemory(corrected, { now: T1 }), { now: LATER }).progress.requiredCategories, ['food']);
  const emptyEnd = createTravelMemory({ query: { ...value.query, excludedIds: [] }, progress: {
    date: value.query.date, currentTime: '23:59', completed: [], skippedIds: [], requiredCategories: [], finished: true, updatedAt: T1,
  } }, { now: T1 });
  assert.equal(importTravelMemory(exportTravelMemory(emptyEnd, { now: T1 }), { now: LATER }).progress.finished, true);
  const allIds = TRAVEL_PLACES.filter(place => place.dayPlannerEligible !== false && ['food', 'tea', 'culture'].includes(place.category)).map(place => place.id);
  assert.equal(allIds.length, 23, 'current supported day-trip catalog');
  const full = structuredClone(emptyEnd); full.query.excludedIds = allIds; full.progress.skippedIds = allIds;
  assert.equal(importTravelMemory(exportTravelMemory(full, { now: T1 }), { now: LATER }).progress.skippedIds.length, allIds.length);
});

test('malformed progress cannot restore unknown places, duplicate actions, inconsistent plans or fabricated ratings', async () => {
  const value = await remainingMemory(), original = JSON.parse(exportTravelMemory(value, { now: T1 }));
  const changes = [
    ['null progress', m => m.progress = null],
    ['extra inferred rating', m => m.progress.rating = 5],
    ['day-mode progress', m => { m.query.planningMode = 'day'; m.query.stopCount = 3; m.plan = null; }],
    ['wrong date', m => m.progress.date = '2026-10-10'],
    ['future timestamp', m => m.progress.updatedAt = LATER],
    ['missing original categories', m => delete m.progress.requiredCategories],
    ['unknown original category', m => m.progress.requiredCategories = ['stay']],
    ['duplicate original categories', m => m.progress.requiredCategories = ['food', 'food']],
    ['invalid current time', m => m.progress.currentTime = '24:00'],
    ['unfinished report after restart', m => m.progress.currentTime = '14:01'],
    ['completed collection type', m => m.progress.completed = {}],
    ['null completion', m => m.progress.completed[0] = null],
    ['completion after report', m => m.progress.completed[0].completedTime = '14:01'],
    ['invalid completion time', m => m.progress.completed[0].completedTime = '13:99'],
    ['unknown completed place', m => m.progress.completed[0].placeId = 'invented-place'],
    ['non-day completed place', m => m.progress.completed[0].placeId = TRAVEL_PLACES.find(place => place.dayPlannerEligible === false).id],
    ['duplicate completion', m => m.progress.completed.push(structuredClone(m.progress.completed[0]))],
    ['completion rating inference', m => m.progress.completed[0].rating = 5],
    ['same place completed and skipped', m => m.progress.skippedIds.push(m.progress.completed[0].placeId)],
    ['duplicate skipped place', m => m.progress.skippedIds.push(m.progress.skippedIds[0])],
    ['unknown skipped place', m => m.progress.skippedIds = ['invented-place']],
    ['non-array skipped ids', m => m.progress.skippedIds = {}],
    ['too many progress entries', m => m.progress.skippedIds = Array(19).fill(m.progress.skippedIds[0])],
    ['missing completed exclusion', m => m.query.excludedIds = m.query.excludedIds.filter(id => id !== m.progress.completed[0].placeId)],
    ['missing skipped exclusion', m => m.query.excludedIds = m.query.excludedIds.filter(id => id !== m.progress.skippedIds[0])],
    ['completed place still in route', m => { m.progress.completed[0].placeId = m.plan.stops[0].placeId; m.query.excludedIds.push(m.plan.stops[0].placeId); }],
    ['skipped place still in route', m => { m.progress.skippedIds = [m.plan.stops[0].placeId]; m.query.excludedIds.push(m.plan.stops[0].placeId); }],
    ['non-boolean finished', m => m.progress.finished = 'true'],
    ['finished with remaining plan', m => m.progress.finished = true],
    ['plan starts before query', m => m.query.startTime = '14:01'],
  ];
  for (const [description, mutate] of changes) {
    const broken = structuredClone(original); mutate(broken.memory);
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: T1 }), TypeError, description);
  }
  assert.deepEqual(importTravelMemory(JSON.stringify(original), { now: T1 }), value);
});

test('nothing is persisted before explicit consent; revoke removes only the travel resource', () => {
  const store = storage();
  store.setItem('synk-path-real-places-v1', 'legacy');
  assert.throws(() => saveTravelMemory(memory(), store, { now: T0 }), /보관하기/);
  assert.equal(loadTravelMemory(store, { now: T0 }), null);
  const enabled = setTravelConsent(memory(), true, { now: T0 });
  saveTravelMemory(enabled, store, { now: T0 });
  assert.deepEqual(loadTravelMemory(store, { now: T0 }), enabled);
  clearTravelMemory(store);
  assert.equal(store.getItem(TRAVEL_STORAGE_KEY), null);
  assert.equal(store.getItem('synk-path-real-places-v1'), 'legacy');
});

test('portable file moves trip conditions, confirmed preferences and visits to a second device without transferring consent', () => {
  const a = storage(), b = storage();
  let value = recordVisit(memory(), { placeId, rating: 2, reasons: ['walking'], now: T0 });
  value = confirmTravelPreference(value, { key: 'walk', value: false, feedbackId: value.visits[0].id, now: T0 });
  value = setTravelConsent(value, true, { now: T0 });
  saveTravelMemory(value, a, { now: T0 });
  const file = exportTravelMemory(loadTravelMemory(a, { now: T0 }), { now: T0 });
  const imported = importTravelMemory(file, { now: T1 });
  assert.equal(imported.consent, false);
  assert.deepEqual(imported.confirmedPreferences, value.confirmedPreferences);
  assert.deepEqual(imported.visits, value.visits);
  assert.deepEqual(imported.query, value.query);
  assert.equal(loadTravelMemory(b, { now: T1 }), null);
  saveTravelMemory(setTravelConsent(imported, true, { now: T1 }), b, { now: T1 });
  assert.equal(loadTravelMemory(b, { now: T1 }).confirmedPreferences[0].value, false);
});

test('trip-only companion profiles survive actual OSM plan transfer without creating personal preferences or visits', async () => {
  const companions = [
    { id: 'companion-b', label: '동행 둘', preferences: { history: true, noodles: false }, requiredFeatures: { indoor: true } },
    { id: 'companion-a', label: '동행 하나', preferences: { noodles: true, coffee: false }, requiredFeatures: {} },
  ];
  const value = await actualWalkingPlan({ party: { adults: 2, children: 1 }, budget: 120000, companions });
  assert.deepEqual(value.query.companions, [...companions].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual(value.query.preferences, {}, 'companion soft choices do not become the primary traveler input');
  assert.deepEqual(value.query.requiredFeatures, {}, 'personal hard conditions remain separate in the saved query');
  assert.ok(value.plan.stops.every(stop => stop.place.features.indoor === true), 'the applied plan meets the explicit companion requirement');
  assert.deepEqual(value.confirmedPreferences, []);
  assert.deepEqual(value.visits, []);
  assert.deepEqual(value.journal, { trail: [], decisions: [], exposures: [], outcomes: [] });
  assert.equal(Object.hasOwn(value.plan, 'companionAssessment'), false, 'a derived fit explanation is not a new saved satisfaction result');
  const copy = importTravelMemory(exportTravelMemory(value, { now: T1 }), { now: LATER });
  assert.deepEqual(copy, value, 'past plans retain the explicit companion profiles without recalculation');
  const device = storage();
  assert.throws(() => saveTravelMemory(copy, device, { now: LATER }), /보관하기/);
  saveTravelMemory(setTravelConsent(copy, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }).query.companions, value.query.companions);
  assert.deepEqual(travelDeviceState(travelAccountDocument(value, { now: T1 }), { now: LATER }), value);

  let reported = recordVisit(value, { placeId: value.plan.stops[0].placeId, rating: 4, reasons: ['experience'], now: T1 });
  reported = confirmTravelPreference(reported, { key: 'noodles', value: false, now: T1 });
  assert.deepEqual(reported.query.companions, value.query.companions, 'a personal review does not rewrite any companion preference');
  assert.equal(reported.confirmedPreferences.length, 1);
  assert.equal(reported.confirmedPreferences[0].value, false);
  const edited = structuredClone(reported); edited.plan = null;
  edited.query.companions = [{ ...edited.query.companions[0], label: '동행 별칭 수정', preferences: { coffee: true } }];
  const restored = importTravelMemory(exportTravelMemory(edited, { now: T1 }), { now: LATER });
  assert.deepEqual(restored.query.companions, edited.query.companions);
  assert.deepEqual(restored.confirmedPreferences, reported.confirmedPreferences);
  assert.deepEqual(restored.visits, reported.visits);
  assert.deepEqual(restored.journal, reported.journal, 'profile editing or removal never fabricates feedback or a long-term confirmation');
  restored.query.companions = [];
  assert.deepEqual(importTravelMemory(exportTravelMemory(restored, { now: LATER }), { now: LATER }).query.companions, []);
});

test('companion schemas enforce nickname-only profiles, group quotas and explicit boolean preferences before replacing saved records', () => {
  const profile = { id: 'companion-a', label: '동행 하나', preferences: { coffee: true }, requiredFeatures: {} };
  const value = createTravelMemory({ query: { ...memory().query, party: { adults: 2, children: 0 }, companions: [profile] } }, { now: T0 });
  const original = JSON.parse(exportTravelMemory(value, { now: T0 })), device = storage();
  saveTravelMemory(setTravelConsent(value, true, { now: T0 }), device, { now: T0 });
  const previous = device.getItem(TRAVEL_STORAGE_KEY);
  const changes = [
    ['null companion collection', m => m.query.companions = null],
    ['non-array companion collection', m => m.query.companions = {}],
    ['null profile', m => m.query.companions[0] = null],
    ['array profile', m => m.query.companions[0] = []],
    ['missing id', m => delete m.query.companions[0].id],
    ['invalid id', m => m.query.companions[0].id = 'name with spaces'],
    ['duplicate id', m => m.query.companions.push(structuredClone(profile))],
    ['missing nickname', m => delete m.query.companions[0].label],
    ['nickname wrong type', m => m.query.companions[0].label = 7],
    ['empty nickname', m => m.query.companions[0].label = '   '],
    ['long nickname', m => m.query.companions[0].label = '가'.repeat(25)],
    ['unrequested age field', m => m.query.companions[0].age = 30],
    ['unrequested contact field', m => m.query.companions[0].email = 'fictional@example.test'],
    ['missing preferences', m => delete m.query.companions[0].preferences],
    ['null preferences', m => m.query.companions[0].preferences = null],
    ['array preferences', m => m.query.companions[0].preferences = []],
    ['unknown preference key', m => m.query.companions[0].preferences = { inventedCuisine: true }],
    ['string preference', m => m.query.companions[0].preferences = { coffee: 'true' }],
    ['numeric preference', m => m.query.companions[0].preferences = { coffee: 1 }],
    ['missing required conditions', m => delete m.query.companions[0].requiredFeatures],
    ['null required conditions', m => m.query.companions[0].requiredFeatures = null],
    ['unknown required condition', m => m.query.companions[0].requiredFeatures = { inventedFeature: true }],
    ['string required condition', m => m.query.companions[0].requiredFeatures = { indoor: 'true' }],
    ['entirely empty profile', m => m.query.companions[0].preferences = {}],
    ['more profiles than party', m => m.query.companions = [profile, { ...profile, id: 'b' }, { ...profile, id: 'c' }]],
    ['more than six profiles', m => { m.query.party = { adults: 7, children: 0 }; m.query.companions = Array.from({ length: 7 }, (_, index) => ({ ...profile, id: `person-${index}` })); }],
    ['opposed hard conditions with group', m => { m.query.requiredFeatures = { indoor: false }; m.query.companions[0].requiredFeatures = { indoor: true }; }],
    ['opposed hard conditions between companions', m => { m.query.companions[0].requiredFeatures = { indoor: true }; m.query.companions.push({ ...profile, id: 'b', requiredFeatures: { indoor: false } }); }],
  ];
  for (const [description, mutate] of changes) {
    const broken = structuredClone(original); mutate(broken.memory);
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: T1 }), TypeError, description);
    assert.throws(() => saveTravelMemory({ ...broken.memory, consent: true }, device, { now: T1 }), TypeError, description);
    assert.equal(device.getItem(TRAVEL_STORAGE_KEY), previous);
  }
  const six = createTravelMemory({ query: { ...value.query, party: { adults: 4, children: 2 }, companions:
    Array.from({ length: 6 }, (_, index) => ({ id: `person-${index}`, label: '가'.repeat(24), preferences: {}, requiredFeatures: { indoor: true } })) } }, { now: T0 });
  assert.equal(importTravelMemory(exportTravelMemory(six, { now: T0 }), { now: LATER }).query.companions.length, 6);
  const mixed = createTravelMemory({ query: { ...value.query, companions: [{ ...profile, preferences: { indoor: false }, requiredFeatures: { indoor: true } }] } }, { now: T0 });
  assert.deepEqual(importTravelMemory(exportTravelMemory(mixed, { now: T0 }), { now: LATER }).query.companions[0].preferences, { indoor: false },
    'the stronger required condition does not silently rewrite a soft preference');
});

test('valid-shaped hard-condition edits cannot make an archived route satisfy missing or conflicting venue evidence', async () => {
  const value = await actualWalkingPlan({ party: { adults: 2, children: 0 }, budget: 150000, stopCount: 2,
    lockedIds: ['seoul-museum-craft-art', 'balwoo-gongyang'],
    companions: [{ id: 'companion-a', label: '동행', preferences: { art: true }, requiredFeatures: {} }] });
  assert.deepEqual(new Set(value.plan.stops.map(stop => stop.placeId)), new Set(['seoul-museum-craft-art', 'balwoo-gongyang']));
  const original = JSON.parse(exportTravelMemory(value, { now: T0 })), device = storage();
  saveTravelMemory(setTravelConsent(value, true, { now: T0 }), device, { now: T0 });
  const before = device.getItem(TRAVEL_STORAGE_KEY);
  for (const owner of ['companion', 'group']) for (const requiredFeatures of [
    { indoor: false }, { quiet: true }, { quiet: false }, { vegetarian: true }, { culture: true }, { noodles: false },
  ]) {
    const broken = structuredClone(original);
    if (owner === 'companion') broken.memory.query.companions[0].requiredFeatures = requiredFeatures;
    else broken.memory.query.requiredFeatures = requiredFeatures;
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: LATER }), /필수 조건/, `${owner}: ${JSON.stringify(requiredFeatures)}`);
    assert.throws(() => saveTravelMemory({ ...broken.memory, consent: true }, device, { now: LATER }), /필수 조건/);
    assert.equal(device.getItem(TRAVEL_STORAGE_KEY), before);
  }
  const forgedFacts = structuredClone(original);
  forgedFacts.memory.query.companions[0].requiredFeatures = { quiet: true };
  for (const stop of forgedFacts.memory.plan.stops) stop.place.features.quiet = true;
  forgedFacts.memory.plan.checks.push(...forgedFacts.memory.plan.stops.map(stop => ({ kind: 'required.quiet', status: 'matched', reason: '가져온 파일의 주장', placeId: stop.placeId })));
  assert.throws(() => importTravelMemory(JSON.stringify(forgedFacts), { now: LATER }), /필수 조건/,
    'imported venue facts and check labels cannot replace the canonical venue evidence');

  const supported = structuredClone(original);
  supported.memory.query.companions[0].requiredFeatures = { indoor: true, templeFood: true };
  supported.memory.plan.inputFingerprint = plannerInputFingerprint(supported.memory.query);
  const restored = importTravelMemory(JSON.stringify(supported), { now: LATER });
  assert.deepEqual(restored.query.companions[0].requiredFeatures, { indoor: true, templeFood: true });
  assert.deepEqual(restored.plan, { ...value.plan, inputFingerprint: supported.memory.plan.inputFingerprint }, 'food-only requirements do not require a museum to offer food or recalculate old opening hours');
});

test('saved step-free requirements inspect every visiting leg and the return leg without trusting fabricated venue facts', async () => {
  const value = await actualWalkingPlan({ destination: memory().query.origin, party: { adults: 2, children: 0 }, budget: 150000,
    companions: [{ id: 'companion-a', label: '동행', preferences: { art: true }, requiredFeatures: {} }] });
  const query = { ...value.query, companions: [{ ...value.query.companions[0], requiredFeatures: { stepFree: true } }] };
  const checks = assessPlannerRequirements(value.plan.stops, query, { legs: value.plan.legs, returnLeg: value.plan.returnLeg });
  const visitChecks = checks.filter(row => row.kind === 'required.stepFree.route');
  assert.equal(visitChecks.length, value.plan.stops.length);
  assert.ok(visitChecks.every(row => row.status !== 'matched'), 'the real OSM graph has not verified step-free access');
  assert.equal(checks.find(row => row.kind === 'required.stepFree.return')?.status, 'unknown');

  // Synthetic flags isolate traversal of every leg; they do not assert that
  // current venue or map evidence actually certifies a step-free itinerary.
  const markedLegs = value.plan.legs.map(leg => ({ ...leg, stepFreeVerified: true }));
  const markedReturn = { ...value.plan.returnLeg, stepFreeVerified: true };
  for (let missing = 0; missing <= markedLegs.length; missing++) {
    const legs = structuredClone(markedLegs), returnLeg = structuredClone(markedReturn);
    if (missing < legs.length) delete legs[missing].stepFreeVerified; else delete returnLeg.stepFreeVerified;
    const routeChecks = assessPlannerRequirements(value.plan.stops, query, { legs, returnLeg })
      .filter(row => ['required.stepFree.route', 'required.stepFree.return'].includes(row.kind));
    assert.equal(routeChecks.filter(row => row.status !== 'matched').length, 1, `unchecked leg ${missing} is not hidden by the other flags`);
  }
  const original = JSON.parse(exportTravelMemory(value, { now: T0 }));
  original.memory.query = query;
  assert.throws(() => importTravelMemory(JSON.stringify(original), { now: LATER }), /필수 조건/);
  original.memory.plan.legs = markedLegs;
  original.memory.plan.returnLeg = markedReturn;
  for (const stop of original.memory.plan.stops) stop.place.features.stepFree = true;
  assert.throws(() => importTravelMemory(JSON.stringify(original), { now: LATER }), /필수 조건/,
    'fabricating both route flags and imported venue features cannot replace canonical venue evidence');
});

test('specific food and cafe preferences require confirmation and survive transfer with current-trip choices taking precedence', () => {
  const detailed = ['noodles', 'dumplings', 'soup', 'templeFood', 'marketFood', 'coffee', 'bakery', 'traditionalTea'];
  assert.deepEqual(TRAVEL_PREFERENCE_KEYS, SEMANTIC_KEYS, 'memory and recommendation use the same supported preference vocabulary');
  let value = recordVisit(memory(), { placeId, rating: 5, reasons: ['experience'], now: T0 });
  assert.deepEqual(proposeVisitPreference(value.visits[0]), [], 'liking a place is not proof of a cuisine preference');
  assert.deepEqual(value.confirmedPreferences, []);
  for (const [index, key] of TRAVEL_PREFERENCE_KEYS.entries()) {
    value = confirmTravelPreference(value, { key, value: index % 2 === 0, feedbackId: value.visits[0].id, now: T0 });
  }
  value.query.preferences = Object.fromEntries(detailed.map(key => [key, true]));
  const restored = importTravelMemory(exportTravelMemory(value, { now: T0 }), { now: T1 });
  assert.equal(restored.consent, false);
  assert.equal(restored.confirmedPreferences.length, SEMANTIC_KEYS.length);
  assert.deepEqual(restored.confirmedPreferences, value.confirmedPreferences);
  assert.deepEqual(restored.query.preferences, value.query.preferences);
  const result = planTravel(restored.query, { now: T1, feedback: restored.confirmedPreferences, ask: false });
  for (const key of detailed) {
    const effective = result.engineAudit.semanticPreferences.find(row => row.field === key);
    assert.equal(effective.value, true);
    assert.equal(effective.origin, 'this-trip');
  }
  const cleared = removeTravelVisit(restored, restored.visits[0].id, { now: T1 });
  assert.deepEqual(cleared.confirmedPreferences, [], 'withdrawing the visit removes every preference whose confirmation cited that visit');
  assert.deepEqual(cleared.query.preferences, restored.query.preferences, 'separately chosen current-trip settings remain');
  assert.deepEqual(importTravelMemory(exportTravelMemory(cleared, { now: T1 }), { now: T1 }).confirmedPreferences, []);
});

test('specific preference import rejects unknown categories, non-booleans and an invented confirmation', () => {
  let value = confirmTravelPreference(memory(), { key: 'coffee', value: true, now: T0 });
  assert.throws(() => confirmTravelPreference(value, { key: 'inventedCuisine', value: true, now: T0 }), TypeError);
  assert.throws(() => confirmTravelPreference(value, { key: 'noodles', value: 1, now: T0 }), TypeError);
  const original = JSON.parse(exportTravelMemory(value, { now: T0 }));
  for (const mutate of [
    file => file.memory.confirmedPreferences[0].key = 'inventedCuisine',
    file => file.memory.confirmedPreferences[0].value = 'true',
    file => file.memory.confirmedPreferences[0].source.kind = 'venue-inference',
    file => file.memory.confirmedPreferences[0].source.feedbackId = 0,
    file => file.memory.confirmedPreferences[0].source.feedbackId = 'missing-visit',
    file => file.memory.query.preferences = { coffee: 'true' },
    file => file.memory.query.preferences = { inventedCuisine: true },
  ]) {
    const invalid = structuredClone(original); mutate(invalid);
    assert.throws(() => importTravelMemory(JSON.stringify(invalid), { now: T1 }), TypeError);
  }
  value = removeTravelPreference(value, 'coffee', { now: T1 });
  assert.deepEqual(importTravelMemory(exportTravelMemory(value, { now: T1 }), { now: T1 }).confirmedPreferences, []);
});

test('an actual planner result survives save and transfer and restores public venue facts from the current catalog', () => {
  const initial = memory();
  const planned = planTravel(initial.query, { now: T0 });
  assert.ok(planned.primary, 'the actual catalog must yield a route for the default query');
  const value = createTravelMemory({ query: planned.input, plan: planned.primary }, { now: T0 });
  const raw = exportTravelMemory(value, { now: T0 });
  const imported = importTravelMemory(raw, { now: T1 });
  assert.deepEqual(imported.plan, value.plan);
  assert.deepEqual(imported.query, value.query);
  const forged = JSON.parse(raw);
  forged.memory.plan.stops[0].place.sourceUrl = 'javascript:alert(1)';
  forged.memory.plan.stops[0].place.name = '수입 파일의 가짜 장소 설명';
  const checked = importTravelMemory(JSON.stringify(forged), { now: T1 });
  const official = TRAVEL_PLACES.find(place => place.id === checked.plan.stops[0].placeId);
  assert.equal(checked.plan.stops[0].place.name, official.name);
  assert.equal(checked.plan.stops[0].place.sourceUrl, official.sourceUrl);
});

test('the actual OSM itinerary restores every polyline, source field, time and money item without persisting the imported device consent', async () => {
  const value = await actualWalkingPlan();
  assert.ok(value.plan.legs.every(leg => leg.source === 'osm-walking-network' && leg.coordinates.length > 2));
  assert.ok(value.plan.legs.every(leg => typeof leg.unknownAccess === 'boolean' && typeof leg.steps === 'boolean' && typeof leg.sourceAt === 'string'));
  const imported = importTravelMemory(exportTravelMemory(value, { now: T0 }), { now: T1 });
  assert.deepEqual(imported.plan, value.plan);
  assert.equal(imported.consent, false);
  const device = storage();
  saveTravelMemory(setTravelConsent(imported, true, { now: T1 }), device, { now: T1 });
  assert.deepEqual(loadTravelMemory(device, { now: T1 }).plan, value.plan);
});

test('past-date itinerary archives remain importable and restorable while a new recommendation for that date is refused', async () => {
  const value = await actualWalkingPlan(), raw = exportTravelMemory(value, { now: T1 });
  assert.throws(() => planTravel(value.query, { now: LATER }), /지난 날짜/);
  const imported = importTravelMemory(raw, { now: LATER });
  assert.deepEqual(imported.plan, value.plan);
  assert.equal(imported.query.date, '2026-10-09');
  const device = storage();
  saveTravelMemory(setTravelConsent(imported, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }).plan, value.plan);
});

test('earlier v4 files without pace, schedule, destination or pause fields restore their archived itinerary with neutral defaults', async () => {
  const value = await actualWalkingPlan(), earlier = JSON.parse(exportTravelMemory(value, { now: T1 }));
  for (const key of ['maxLegWalkMinutes', 'restEveryMinutes', 'restDurationMinutes', 'planningMode', 'destination', 'appointments', 'meal', 'companions']) delete earlier.memory.query[key];
  // Fixed vector for the original normalized v4 query shape, before optional
  // pace/schedule/companion inputs were introduced. This is not the current hash.
  earlier.memory.plan.inputFingerprint = '173dp9a-1ovotrw';
  delete earlier.memory.plan.destination; delete earlier.memory.plan.returnLeg;
  for (const stop of earlier.memory.plan.stops) delete stop.pauses;
  const snapshot = structuredClone(earlier.memory.plan);
  const imported = importTravelMemory(JSON.stringify(earlier), { now: LATER });
  assert.equal(imported.query.maxLegWalkMinutes, null);
  assert.equal(imported.query.restEveryMinutes, null);
  assert.equal(imported.query.restDurationMinutes, 10);
  assert.equal(imported.query.planningMode, 'day');
  assert.equal(imported.query.destination, null);
  assert.deepEqual(imported.query.appointments, []);
  assert.deepEqual(imported.query.meal, { mode: 'any', startTime: '12:00', endTime: '13:00' });
  assert.deepEqual(imported.query.companions, [], 'older trip files do not invent companion profiles');
  assert.equal(Object.hasOwn(imported, 'progress'), false, 'opening an older file does not fabricate a travel-progress report');
  assert.deepEqual(imported.query.preferences, earlier.memory.query.preferences);
  assert.deepEqual(imported.plan, snapshot, 'old itinerary times and costs are not silently recalculated');
  assert.equal(imported.consent, false);
  const device = storage();
  saveTravelMemory(setTravelConsent(imported, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }).plan, snapshot);
  const activeNewOption = structuredClone(imported); activeNewOption.query.restEveryMinutes = 30;
  assert.throws(() => validateTravelMemory(activeNewOption, { now: LATER }), /날짜·여행 조건/, 'an early fingerprint cannot omit a non-default added input');
});

test('an actual OSM reservation, meal window and final destination survive past-date file, device and account restoration', async () => {
  const destination = memory().query.origin;
  const settings = { destination, appointments: [{ placeId: 'jogyesa', time: '11:30' }],
    meal: { mode: 'window', startTime: '12:00', endTime: '13:00' }, maxWalkMinutes: 80 };
  const value = await actualWalkingPlan(settings), { plan } = value;
  assert.equal(plan.legs.length, plan.stops.length, 'the return route is separate from visit-bound legs');
  assert.equal(plan.stops.find(stop => stop.placeId === 'jogyesa').arrivalTime, '11:30');
  assert.ok(plan.stops.find(stop => stop.placeId === 'jogyesa').waitMinutes > 0, 'early arrival retains an explicit wait');
  assert.ok(plan.stops.some(stop => stop.place.category === 'food' && stop.arrivalTime >= '12:00' && stop.arrivalTime <= '13:00'));
  assert.deepEqual(plan.destination, destination);
  assert.equal(plan.returnLeg.source, 'osm-walking-network');
  assert.ok(plan.returnLeg.coordinates.length > 2);
  assert.equal(plan.returnLeg.departureTime, plan.stops.at(-1).departureTime);
  assert.equal(plan.returnLeg.arrivalTime, plan.endTime);
  assert.deepEqual(plan.returnLeg.coordinates.at(-1), [destination.lon, destination.lat]);
  assert.equal(plan.walking.maxMinutes, plan.legs.reduce((sum, leg) => sum + leg.maxMinutes, plan.returnLeg.maxMinutes));
  const copy = importTravelMemory(exportTravelMemory(value, { now: T1 }), { now: LATER });
  assert.deepEqual(copy, value, 'old-date snapshots keep their actual reserved time and return route');
  const device = storage();
  saveTravelMemory(setTravelConsent(copy, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }).plan, plan);
  assert.deepEqual(travelDeviceState(travelAccountDocument(value, { now: T1 }), { now: LATER }), value);
  assert.deepEqual(copy.visits, [], 'a reserved visit and a route remain plans, not reported visits');
});

test('meal omission and inclusive exact meal-start windows remain distinct in stored plans', async () => {
  const noMeal = await actualWalkingPlan({ meal: { mode: 'none', startTime: '12:00', endTime: '13:00' } });
  assert.ok(noMeal.plan.stops.every(stop => stop.place.category !== 'food'));
  assert.equal(importTravelMemory(exportTravelMemory(noMeal, { now: T1 }), { now: LATER }).query.meal.mode, 'none');
  const exactMeal = await actualWalkingPlan({ appointments: [{ placeId: 'balwoo-gongyang', time: '12:00' }],
    meal: { mode: 'window', startTime: '12:00', endTime: '12:00' } });
  assert.equal(exactMeal.plan.stops.find(stop => stop.placeId === 'balwoo-gongyang').arrivalTime, '12:00');
  assert.deepEqual(importTravelMemory(exportTravelMemory(exactMeal, { now: T1 }), { now: LATER }).plan, exactMeal.plan);
  const forgedWindow = structuredClone(noMeal);
  forgedWindow.query.meal.mode = 'window';
  assert.throws(() => validateTravelMemory(forgedWindow, { now: T1 }), TypeError, 'a meal window cannot be satisfied by a route with no meal');
});

async function actualPreStartRestPlan() {
  const from = TRAVEL_PLACES.find(place => place.id === 'gyeongbokgung');
  return actualWalkingPlan({ planningMode: 'remaining', stopCount: 1, origin: { id: from.id, name: from.name, lat: from.coordinates.lat, lon: from.coordinates.lon },
    destination: memory().query.origin, maxWalkMinutes: 120, appointments: [{ placeId: 'gaeseong-mandu-koong', time: '12:00' }],
    meal: { mode: 'window', startTime: '12:00', endTime: '12:00' }, restEveryMinutes: 30, restDurationMinutes: 10 });
}

test('actual OSM arrival rest stays inside reservation waiting and survives past-date file, device and account restoration', async () => {
  const value = await actualPreStartRestPlan(), { plan } = value, stop = plan.stops[0];
  assert.equal(plan.legs[0].source, 'osm-walking-network');
  assert.ok(plan.legs[0].maxMinutes >= 30);
  assert.equal(stop.preStartPause.startTime, plan.legs[0].arrivalTime);
  assert.ok(stop.preStartPause.endTime <= stop.arrivalTime);
  assert.equal(stop.arrivalTime, '12:00');
  assert.ok(stop.waitMinutes >= stop.preStartPause.durationMinutes);
  assert.equal(stop.preStartPause.locationStatus, 'unverified');
  assert.equal(plan.status, 'partial');
  assert.ok(plan.checks.some(row => row.kind === 'rest-place' && row.placeId === stop.placeId && row.status === 'unknown'));
  const copy = importTravelMemory(exportTravelMemory(value, { now: T1 }), { now: LATER });
  assert.deepEqual(copy, value);
  const device = storage();
  saveTravelMemory(setTravelConsent(copy, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }).plan, plan);
  assert.deepEqual(travelDeviceState(travelAccountDocument(value, { now: T1 }), { now: LATER }), value);
});

test('pre-start rest rejects malformed shape, timing, duplicated stay time and invented facility certainty', async () => {
  const value = await actualPreStartRestPlan(), original = JSON.parse(exportTravelMemory(value, { now: T0 }));
  const changes = [
    ['null pause', m => m.plan.stops[0].preStartPause = null],
    ['array pause', m => m.plan.stops[0].preStartPause = []],
    ['missing duration', m => delete m.plan.stops[0].preStartPause.durationMinutes],
    ['extra facility claim', m => m.plan.stops[0].preStartPause.seatReserved = true],
    ['non-numeric duration', m => m.plan.stops[0].preStartPause.durationMinutes = '10'],
    ['duration below quota', m => m.plan.stops[0].preStartPause.durationMinutes = 4],
    ['duration above quota', m => m.plan.stops[0].preStartPause.durationMinutes = 31],
    ['duration arithmetic', m => m.plan.stops[0].preStartPause.durationMinutes = 11],
    ['wrong kind', m => m.plan.stops[0].preStartPause.kind = 'reserved-seat'],
    ['claimed verified facility', m => m.plan.stops[0].preStartPause.locationStatus = 'verified'],
    ['invalid time', m => m.plan.stops[0].preStartPause.startTime = '24:00'],
    ['rest before arrival', m => Object.assign(m.plan.stops[0].preStartPause, { startTime: '11:00', endTime: '11:10' })],
    ['rest not at arrival', m => Object.assign(m.plan.stops[0].preStartPause, { startTime: '11:45', endTime: '11:55' })],
    ['rest overlaps reservation', m => Object.assign(m.plan.stops[0].preStartPause, { startTime: '11:55', endTime: '12:05' })],
    ['rest omitted from wait', m => m.plan.stops[0].waitMinutes = 0],
    ['rest counted twice in stay', m => m.plan.stops[0].stayMinutes += 10],
    ['rest without selected interval', m => m.query.restEveryMinutes = null],
    ['rest differs from selected duration', m => m.query.restDurationMinutes = 15],
    ['pre-start rest without timed visit', m => { m.query.appointments = []; m.query.meal.mode = 'any'; }],
    ['missing uncertainty despite pre-start rest alone', m => { delete m.plan.stops[0].pauses; m.plan.checks = m.plan.checks.filter(row => row.kind !== 'rest-place'); }],
    ['claimed complete verification', m => m.plan.status = 'ready'],
  ];
  const device = storage();
  saveTravelMemory(setTravelConsent(value, true, { now: T0 }), device, { now: T0 });
  const previous = device.getItem(TRAVEL_STORAGE_KEY);
  for (const [description, mutate] of changes) {
    const broken = structuredClone(original); mutate(broken.memory);
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: T1 }), TypeError, description);
    assert.throws(() => saveTravelMemory({ ...broken.memory, consent: true }, device, { now: T1 }), TypeError, description);
    assert.equal(device.getItem(TRAVEL_STORAGE_KEY), previous);
  }
  assert.deepEqual(importTravelMemory(JSON.stringify(original), { now: T1 }), value);
});

test('malformed destination routes and unsatisfied schedule conditions are rejected without replacing saved state', async () => {
  const value = await actualWalkingPlan({ destination: memory().query.origin, appointments: [{ placeId: 'jogyesa', time: '11:30' }],
    meal: { mode: 'window', startTime: '12:00', endTime: '13:00' }, maxWalkMinutes: 80 });
  const original = JSON.parse(exportTravelMemory(value, { now: T0 })), device = storage();
  saveTravelMemory(setTravelConsent(value, true, { now: T0 }), device, { now: T0 });
  const before = device.getItem(TRAVEL_STORAGE_KEY);
  const changes = [
    ['destination missing from snapshot', m => delete m.plan.destination],
    ['destination null in snapshot', m => m.plan.destination = null],
    ['destination array', m => m.plan.destination = []],
    ['destination extra unverified field', m => m.plan.destination.booked = true],
    ['destination name mismatch', m => m.plan.destination.name = '다른 도착점'],
    ['destination id mismatch', m => m.plan.destination.id = 'other-destination'],
    ['destination coordinates mismatch', m => m.plan.destination.lat += 0.01],
    ['destination coordinate wrong type', m => m.query.destination.lat = '37.5'],
    ['destination coordinates out of range', m => m.query.destination.lon = 181],
    ['destination omitted from query', m => delete m.query.destination],
    ['return route missing', m => delete m.plan.returnLeg],
    ['return route null', m => m.plan.returnLeg = null],
    ['return route array', m => m.plan.returnLeg = []],
    ['return route extra field', m => m.plan.returnLeg.guaranteedAccessible = true],
    ['return source missing', m => delete m.plan.returnLeg.source],
    ['return wrong origin id', m => m.plan.returnLeg.fromId = 'anguk'],
    ['return wrong destination id', m => m.plan.returnLeg.toId = 'other-destination'],
    ['return wrong first coordinate', m => m.plan.returnLeg.coordinates[0][0] += 0.001],
    ['return wrong final coordinate', m => m.plan.returnLeg.coordinates.at(-1)[0] += 0.001],
    ['return reversed lon lat', m => m.plan.returnLeg.coordinates.at(-1).reverse()],
    ['return too many coordinates', m => m.plan.returnLeg.coordinates = Array.from({ length: 8193 }, () => [126, 37])],
    ['return coordinate null', m => m.plan.returnLeg.coordinates[1] = null],
    ['return negative duration', m => m.plan.returnLeg.maxMinutes = -1],
    ['return duration wrong type', m => m.plan.returnLeg.minMinutes = '4'],
    ['return duration arithmetic', m => m.plan.returnLeg.maxMinutes += 1],
    ['return leaves before last visit ends', m => m.plan.returnLeg.departureTime = '14:00'],
    ['return arrives at invalid time', m => m.plan.returnLeg.arrivalTime = '24:00'],
    ['return source time invalid', m => m.plan.returnLeg.sourceAt = 'unknown'],
    ['return confidence wrong type', m => m.plan.returnLeg.unknownAccess = 'false'],
    ['return excluded from walking total', m => { m.plan.walking.minMinutes -= m.plan.returnLeg.minMinutes; m.plan.walking.maxMinutes -= m.plan.returnLeg.maxMinutes; }],
    ['return excluded from final arrival', m => m.plan.endTime = m.plan.stops.at(-1).departureTime],
    ['query deadline before final arrival', m => m.query.endTime = m.plan.stops.at(-1).departureTime],
    ['departure does not match conditions', m => m.query.startTime = '11:01'],
    ['walking limit excludes return', m => m.query.maxWalkMinutes = m.plan.walking.maxMinutes - 1],
    ['walking segment exceeds limit', m => m.query.maxLegWalkMinutes = 0],
    ['visit count exceeds request', m => m.query.stopCount = 2],
    ['reservation at wrong visit time', m => m.query.appointments[0].time = '11:31'],
    ['reserved place missing from route', m => m.query.appointments = [{ placeId: 'unhyeongung', time: '11:30' }]],
    ['too many reservations', m => m.query.appointments = Array.from({ length: 4 }, () => ({ placeId: 'jogyesa', time: '11:30' }))],
    ['duplicate reservation', m => m.query.appointments.push({ placeId: 'jogyesa', time: '12:00' })],
    ['duplicate reservation time', m => m.query.appointments.push({ placeId: 'unhyeongung', time: '11:30' })],
    ['null reservation', m => m.query.appointments = [null]],
    ['reservation malformed time', m => m.query.appointments[0].time = '11:99'],
    ['reservation before departure', m => m.query.appointments[0].time = '10:59'],
    ['reservation after deadline', m => m.query.appointments[0].time = m.query.endTime],
    ['unknown reserved place', m => m.query.appointments[0].placeId = 'unknown-place'],
    ['excluded reserved place', m => m.query.excludedIds = ['jogyesa']],
    ['meal omitted while route includes food', m => m.query.meal.mode = 'none'],
    ['meal window excludes actual meal', m => m.query.meal = { mode: 'window', startTime: '13:00', endTime: '13:00' }],
    ['meal malformed mode', m => m.query.meal.mode = 'guaranteed-reservation'],
    ['meal malformed time', m => m.query.meal.startTime = '12:99'],
    ['meal reversed window', m => m.query.meal = { mode: 'window', startTime: '13:00', endTime: '12:00' }],
  ];
  for (const [description, mutate] of changes) {
    const broken = structuredClone(original); mutate(broken.memory);
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: T1 }), TypeError, description);
    assert.throws(() => saveTravelMemory({ ...broken.memory, consent: true }, device, { now: T1 }), TypeError, description);
    assert.equal(device.getItem(TRAVEL_STORAGE_KEY), before, `${description}: valid device state is unchanged`);
  }
  assert.deepEqual(importTravelMemory(JSON.stringify(original), { now: T1 }), value);
});

test('an actual OSM plan preserves walking limits and planned rest periods across file and device storage', async () => {
  const pace = { maxLegWalkMinutes: 20, restEveryMinutes: 30, restDurationMinutes: 10 };
  const value = await actualWalkingPlan(pace);
  assert.ok(value.plan.stops.some(stop => stop.pauses?.length), 'the real catalog creates explicitly scheduled rest periods');
  assert.equal(value.plan.status, 'partial', 'a scheduled break is not a verified seat or resting facility');
  for (const stop of value.plan.stops.filter(stop => stop.pauses?.length)) {
    assert.ok(value.plan.checks.some(check => check.kind === 'rest-place' && check.status === 'unknown' && check.placeId === stop.placeId));
    assert.ok(stop.pauses.every(pause => pause.kind === 'planned-rest' && pause.locationStatus === 'unverified'));
  }
  assert.ok(value.plan.legs.every(leg => leg.maxMinutes <= pace.maxLegWalkMinutes));
  const restored = importTravelMemory(exportTravelMemory(value, { now: T1 }), { now: LATER });
  assert.deepEqual(restored.plan, value.plan, 'past dates preserve the recorded rest schedule without recalculation');
  for (const [key, expected] of Object.entries(pace)) assert.equal(restored.query[key], expected);
  const device = storage();
  saveTravelMemory(setTravelConsent(restored, true, { now: LATER }), device, { now: LATER });
  assert.deepEqual(loadTravelMemory(device, { now: LATER }), { ...restored, consent: true, updatedAt: LATER });
});

test('malformed pace and rest records are rejected without inventing a verified resting place', async () => {
  const value = await actualWalkingPlan({ maxLegWalkMinutes: 20, restEveryMinutes: 30, restDurationMinutes: 10 });
  const original = JSON.parse(exportTravelMemory(value, { now: T0 }));
  const corruptions = [
    ['non-array pauses', ({ stop }) => stop.pauses = {}],
    ['null pause', ({ stop }) => stop.pauses[0] = null],
    ['missing pause field', ({ stop }) => delete stop.pauses[0].durationMinutes],
    ['extra facility claim', ({ stop }) => stop.pauses[0].verifiedSeat = true],
    ['invalid clock', ({ stop }) => stop.pauses[0].startTime = '24:00'],
    ['duration mismatch', ({ stop }) => stop.pauses[0].durationMinutes += 1],
    ['duration outside range', ({ stop }) => stop.pauses[0].durationMinutes = 31],
    ['non-numeric duration', ({ stop }) => stop.pauses[0].durationMinutes = '10'],
    ['overlapping breaks', ({ stop }) => stop.pauses.push(structuredClone(stop.pauses[0]))],
    ['break before visit', ({ stop }) => Object.assign(stop.pauses[0], { startTime: '00:00', endTime: '00:10' })],
    ['break after visit', ({ stop }) => Object.assign(stop.pauses[0], { startTime: '23:40', endTime: '23:50' })],
    ['invented rest kind', ({ stop }) => stop.pauses[0].kind = 'guaranteed-seat'],
    ['invented facility verification', ({ stop }) => stop.pauses[0].locationStatus = 'verified'],
    ['missing uncertainty check', ({ plan, stop }) => plan.checks = plan.checks.filter(check => check.kind !== 'rest-place' || check.placeId !== stop.placeId)],
    ['changed uncertainty check', ({ plan, stop }) => plan.checks.find(check => check.kind === 'rest-place' && check.placeId === stop.placeId).status = 'matched'],
    ['invalid segment limit', ({ query }) => query.maxLegWalkMinutes = -1],
    ['non-numeric segment limit', ({ query }) => query.maxLegWalkMinutes = '20'],
    ['invalid break interval', ({ query }) => query.restEveryMinutes = 29],
    ['non-numeric break interval', ({ query }) => query.restEveryMinutes = true],
    ['invalid break duration', ({ query }) => query.restDurationMinutes = 4],
    ['null break duration', ({ query }) => query.restDurationMinutes = null],
    ['non-numeric break duration', ({ query }) => query.restDurationMinutes = '10'],
  ];
  for (const [description, mutate] of corruptions) {
    const broken = structuredClone(original), { plan, query } = broken.memory;
    mutate({ plan, query, stop: plan.stops.find(stop => stop.pauses?.length) });
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: T1 }), TypeError, description);
  }
  assert.deepEqual(importTravelMemory(JSON.stringify(original), { now: T1 }).plan, value.plan);
});

test('malformed nested itinerary files are rejected before they can reach timeline, money, map or source rendering', async () => {
  const value = await actualWalkingPlan(), original = JSON.parse(exportTravelMemory(value, { now: T0 }));
  const corruptions = [
    ['missing corresponding legs', p => p.legs = []],
    ['null stop', p => p.stops[0] = null],
    ['schedule field deleted', p => delete p.stops[0].schedule],
    ['schedule object missing', p => p.stops[0].schedule = null],
    ['non-string schedule reason', p => p.stops[0].schedule.reason = {}],
    ['unsafe schedule URL', p => p.stops[0].schedule.sourceUrl = 'javascript:alert(1)'],
    ['invalid time', p => p.stops[0].arrivalTime = '25:90'],
    ['inconsistent duration', p => p.stops[0].stayMinutes += 1],
    ['negative wait', p => p.stops[0].waitMinutes = -1],
    ['non-array reasons', p => p.stops[0].reasons = 'unexpected'],
    ['non-string reason', p => p.reasons = [{}]],
    ['null cost', p => p.stops[0].cost = null],
    ['non-array unknown costs', p => p.stops[0].cost.unknowns = {}],
    ['bad item quantity', p => p.stops[0].cost.items[0].quantity = '1'],
    ['inconsistent item sum', p => p.stops[0].cost.items[0].amount += 100],
    ['unsafe item URL', p => p.stops[0].cost.items[0].sourceUrl = 'data:text/html,x'],
    ['null totals', p => p.cost = null],
    ['total cost field deleted', p => delete p.cost],
    ['negative total', p => p.cost.knownAmount = -1],
    ['non-array unknown places', p => p.cost.unknownPlaceIds = 'bad'],
    ['unknown place outside route', p => p.cost.unknownPlaceIds = ['foreign']],
    ['null walk total', p => p.walking = null],
    ['walking field deleted', p => delete p.walking],
    ['non-numeric walk total', p => p.walking.maxMinutes = '30'],
    ['inconsistent walk total', p => p.walking.minMinutes += 1],
    ['non-array coordinates', p => p.legs[0].coordinates = {}],
    ['null coordinate', p => p.legs[0].coordinates[0] = null],
    ['coordinate out of range', p => p.legs[0].coordinates[0] = [181, 37]],
    ['too-short polyline', p => p.legs[0].coordinates = [[126, 37]]],
    ['non-numeric minutes', p => p.legs[0].minMinutes = '1'],
    ['negative distance', p => p.legs[0].distanceMeters = -1],
    ['broken route order', p => p.legs[1].fromId = 'wrong-place'],
    ['broken chronology', p => p.legs[0].arrivalTime = '11:00'],
    ['non-boolean route confidence', p => p.legs[0].unknownAccess = 'false'],
    ['invalid source timestamp', p => p.legs[0].sourceAt = 'unknown'],
    ['null check', p => p.checks = [null]],
    ['non-string check', p => p.checks[0].reason = 5],
    ['foreign keep id', p => p.lockedIds = ['missing']],
    ['non-string label', p => p.label = {}],
  ];
  for (const [description, mutate] of corruptions) {
    const broken = structuredClone(original); mutate(broken.memory.plan);
    assert.throws(() => importTravelMemory(JSON.stringify(broken), { now: T1 }), TypeError, description);
  }
  assert.deepEqual(importTravelMemory(JSON.stringify(original), { now: T1 }).plan, value.plan, 'validation does not mutate the source file');
});

test('visit reasons produce only a question; explicit confirmation supplies an editable and retractable preference', () => {
  const value = recordVisit(memory(), { placeId, rating: 1, reasons: ['crowds'], now: T0 });
  const suggestions = proposeVisitPreference(value.visits[0]);
  assert.equal(value.confirmedPreferences.length, 0);
  assert.equal(suggestions[0].status, 'suggested');
  const confirmed = confirmTravelPreference(value, { ...suggestions[0], now: T0 });
  assert.equal(confirmed.confirmedPreferences[0].key, 'quiet');
  assert.equal(confirmed.confirmedPreferences[0].source.kind, 'user-confirmation');
  const changed = confirmTravelPreference(confirmed, { key: 'quiet', value: false, now: T1 });
  assert.equal(changed.confirmedPreferences.length, 1);
  assert.equal(changed.confirmedPreferences[0].value, false);
  const removed = removeTravelPreference(changed, 'quiet', { now: T1 });
  assert.equal(removed.confirmedPreferences.length, 0);
  assert.equal(summarizeTravelMemory(removed, { now: T1 }).trail.invalidated.length, 2);
  validateTravelMemory(removed, { now: T1 });
});

test('decision does not fabricate exposure; repeated renderer acknowledgement is idempotent', () => {
  const value = recordPlanDecision(memory(), { planId: 'route-test', now: T0 });
  assert.equal(value.journal.exposures.length, 0);
  const decisionId = value.journal.decisions[0].id;
  const shown = recordPlanExposure(value, { decisionId, now: T0 });
  assert.deepEqual(recordPlanExposure(shown, { decisionId, now: T1 }), shown);
  assert.throws(() => recordPlanExposure(value, { decisionId: 'foreign', now: T0 }));
});

test('Trail and Temper preserve decision to display to visited result; absent baseline and unanswered ratings stay unknown', () => {
  let { decisionId, value } = observed();
  assert.throws(() => recordTripOutcome(value, { decisionId, rating: 4, now: T1 }), /장소/);
  value = recordVisit(value, { placeId, planId: 'route-test', decisionId, rating: 5, reasons: ['experience'], now: T1 });
  assert.equal(value.journal.outcomes.length, 0, 'one venue rating is not trip satisfaction');
  const unanswered = summarizeTravelMemory(value, { now: LATER });
  assert.equal(unanswered.temper.byPolicy[1].counts.missing, 1);
  assert.equal(unanswered.temper.byPolicy[1].mean, null);
  value = recordTripOutcome(value, { decisionId, rating: 4, now: T1 });
  const result = summarizeTravelMemory(value, { now: LATER });
  assert.equal(result.temper.provenance.chains[0].status, 'observed');
  assert.equal(result.temper.byPolicy[0].counts.decisions, 0);
  assert.equal(result.temper.byPolicy[1].mean, 4);
  assert.equal(result.temper.comparison.status, 'insufficient_evidence');
  assert.equal(result.effectEstablished, false);
  assert.equal(result.temper.causalClaim, false);
  assert.equal(result.trail.learningEffectClaim, false);
  validateTravelMemory(value, { now: T1 });
});

test('invalid files cannot overwrite device state or import permission, unknown places, out-of-order reports or prototype fields', () => {
  const store = storage(), enabled = setTravelConsent(memory(), true, { now: T0 });
  saveTravelMemory(enabled, store, { now: T0 });
  const existing = store.getItem(TRAVEL_STORAGE_KEY), file = JSON.parse(exportTravelMemory(enabled, { now: T0 }));
  assert.throws(() => importTravelMemory('{oops', { now: T1 }));
  assert.throws(() => importTravelMemory(JSON.stringify({ ...file, memory: { ...file.memory, consent: true } }), { now: T1 }));
  assert.throws(() => importTravelMemory(JSON.stringify({ ...file, exportedAt: 'not-a-time' }), { now: T1 }));
  assert.throws(() => importTravelMemory(JSON.stringify(file).replace('"query":{', '"query":{"__proto__":{},'), { now: T1 }));
  const visited = recordVisit(memory(), { placeId: 'invented-place', rating: 5, now: T0 });
  assert.throws(() => validateTravelMemory(visited, { now: T0 }));
  const future = recordVisit(memory(), { placeId, rating: 5, now: LATER });
  future.updatedAt = T0;
  assert.throws(() => validateTravelMemory(future, { now: T1 }));
  assert.equal(store.getItem(TRAVEL_STORAGE_KEY), existing);
});

test('source tampering and cross-product Trail records are rejected before restoring', () => {
  let { value, decisionId } = observed();
  const foreign = structuredClone(value);
  foreign.journal.trail[0].scope.workspace = 'path-vr';
  assert.throws(() => validateTravelMemory(foreign, { now: T0 }));
  value = recordVisit(value, { placeId, planId: 'route-test', decisionId, rating: 3, now: T0 });
  const broken = structuredClone(value);
  broken.journal.trail.find(row => row.factType === 'travel.visit').causes = [];
  assert.throws(() => validateTravelMemory(broken, { now: T0 }));
});

test('correcting and deleting a visit removes its derived preference and trip rating without restoring withdrawn data', () => {
  let { value, decisionId } = observed();
  value = recordVisit(value, { placeId, planId: 'route-test', decisionId, rating: 1, reasons: ['crowds'], now: T0 });
  const visitId = value.visits[0].id;
  value = confirmTravelPreference(value, { key: 'quiet', value: true, feedbackId: visitId, now: T0 });
  value = recordTripOutcome(value, { decisionId, rating: 2, now: T0 });
  const edited = editTravelVisit(value, visitId, { rating: 4, reasons: ['experience'], now: T1 });
  assert.equal(edited.visits.length, 1);
  assert.equal(edited.visits[0].rating, 4);
  assert.equal(edited.confirmedPreferences.length, 0);
  assert.equal(edited.journal.outcomes.length, 0);
  validateTravelMemory(edited, { now: T1 });
  const deleted = removeTravelVisit(edited, edited.visits[0].id, { now: T1 });
  const moved = importTravelMemory(exportTravelMemory(deleted, { now: T1 }), { now: T1 });
  assert.equal(moved.visits.length, 0);
  assert.equal(moved.confirmedPreferences.length, 0);
  assert.equal(moved.journal.outcomes.length, 0);
  assert.equal(summarizeTravelMemory(moved, { now: LATER }).temper.byPolicy[1].mean, null);
  const cleared = clearTravelHistory(edited, { now: T1 });
  assert.equal(cleared.journal.trail.length, 0);
  assert.deepEqual(cleared.query, edited.query);
});

test('legacy migration is explicit and cannot silently add records when consent is missing', () => {
  const raw = JSON.stringify({ version: 2, interests: ['food'], selected: [], reactions: {}, visits: {}, categoryPreferences: {}, feedbackConsent: false, consent: true });
  assert.throws(() => migrateLegacyTravel(raw, { now: T0 }), /선택/);
  assert.equal(migrateLegacyTravel(raw, { confirmed: true, now: T0 }).consent, false);
  assert.throws(() => migrateLegacyTravel(raw.replace('"consent":true', '"consent":false'), { confirmed: true, now: T0 }));
});

test('registered travel account remains distinct from PATH VR and keeps device consent separate', () => {
  assert.equal(TRAVEL_ACCOUNT_CONTRACT.resource, 'path-travel');
  assert.equal(TRAVEL_ACCOUNT_CONTRACT.available, true);
  const account = travelAccountDocument(memory(), { now: T0 });
  assert.equal(Object.hasOwn(account, 'consent'), false);
  assert.deepEqual(travelDeviceState(account, { now: T0 }), memory());
  assert.throws(() => travelDeviceState({ ...account, consent: true }, { now: T0 }));
});
