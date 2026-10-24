import test from 'node:test';
import assert from 'node:assert/strict';
import { chooserWindow, chooserPickOptions, chooserPickFits, chooserPairFits, planChooser, chooserTripInput, chooserTimeFromSaved, dayIntentRules } from '../experiences/path-travel/planner-chooser.mjs';
import { normalizePlannerInput, planTravel } from '../experiences/path-travel/planner.mjs';

// Synthetic official hours and walking legs. These exercise the production chooser
// and planner together; no DOM, current wall clock, real accounts or network calls.
const sourceUrl = 'https://example.org/official';
const calendar = { verifiedAt: '2026-10-09', sourceUrl, from: '2026-01-01', through: '2026-12-31', holidays: ['2026-10-09'] };
const hours = (open, close, extra = {}) => ({ verifiedAt: '2026-10-09', sourceUrl, scope: 'full', holidayPolicy: 'same', weekly: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, [{ open, close }]])), ...extra });
const venue = (id, category, features, stay, open, close, extra = {}) => ({ id, name: `합성 장소 ${id}`, category, address: '서울 종로', dayPlannerEligible: true,
  coordinates: { lat: 37.5765, lon: 126.9855 }, features, planningStayMinutes: stay, checkedAt: '2026-10-09', verifiedAt: '2026-10-09',
  conditions: { hours: hours(open, close, extra), price: { kind: 'free', amount: 0, label: '일반 관람', scope: 'adult-one', taxStatus: 'included', sourceUrl, verifiedAt: '2026-10-09' } } });
const places = [venue('gallery', 'culture', { indoor: true, art: true }, 60, '10:00', '17:00'),
  venue('late-gallery', 'culture', { indoor: true, art: true }, 60, '15:30', '20:00'),
  venue('tea-house', 'tea', { indoor: true }, 40, '09:00', '20:00'),
  venue('far-tea', 'tea', { indoor: true }, 40, '09:00', '20:00'),
  venue('palace', 'culture', { outdoor: true, palace: true, history: true }, 90, '09:00', '18:00', { holidayPolicy: 'closed' })];
const origin = { id: 'origin', name: '출발', lat: 37.5765, lon: 126.9855 };
const routeLeg = (from, to) => {
  const other = from.id === 'origin' ? to.id : to.id === 'origin' ? from.id : '';
  const minutes = other === 'far-tea' ? 25 : other === 'palace' ? 10 : 5;
  return { distanceMeters: minutes * 60, minMinutes: minutes, maxMinutes: minutes, coordinates: [[from.lon, from.lat], [to.lon, to.lat]], source: 'synthetic-route' };
};
const request = (span = 3, time = '14:00', picks = ['art', 'tea']) => ({ now: '2026-10-10T00:00:00.000Z', hours: span, picks, places, routeLeg, calendar, query: { origin, date: '2026-10-10', startTime: time } });
const rawInput = () => ({ destination: null, appointments: [], meal: { mode: 'any', startTime: '12:00', endTime: '13:00' }, companions: [], planningMode: 'day', date: '2026-10-10', startTime: '10:00', endTime: '18:00', origin, party: { adults: 1, children: 0 }, budget: 50000, maxWalkMinutes: 100, maxLegWalkMinutes: null, restEveryMinutes: null, restDurationMinutes: 10, stopCount: 3, preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] });

test('explicit local time survives, while a late implicit start moves the complete window to tomorrow', () => {
  const explicit = chooserWindow(request());
  assert.deepEqual({ date: explicit.date, start: explicit.start, end: explicit.end, shift: explicit.shift }, { date: '2026-10-10', start: 840, end: 1020, shift: null });
  const late = chooserWindow({ ...request(), now: '2026-10-10T12:00:00.000Z', query: { origin, date: null, startTime: null } });
  assert.deepEqual({ date: late.date, start: late.start, end: late.end, moved: late.moved }, { date: '2026-10-11', start: 600, end: 780, moved: true });
});

test('candidate feasibility includes walking, full stay, closing time and holiday policy', () => {
  assert.deepEqual(chooserPickOptions('tea', request(1)).map(row => row.place.id), ['tea-house']);
  assert.equal(chooserPickFits('art', request(1)), false, 'one-hour gallery stay also needs the walking leg');
  assert.deepEqual(chooserPickOptions('art', request(2, '16:30')).map(row => row.place.id), ['late-gallery']);
  const holiday = { ...request(), now: '2026-10-09T00:00:00.000Z', query: { origin, date: '2026-10-09', startTime: '14:00' } };
  assert.equal(chooserPickFits('palace', holiday), false);
  assert.equal(chooserPickFits('palace', request()), true);
});

test('a long visit is a single stop at two hours, and the pair becomes possible with three hours', () => {
  const short = request(2, '14:00', ['palace', 'tea']);
  assert.equal(chooserPairFits('palace', 'tea', short), false);
  const plan = planChooser(short);
  assert.deepEqual({ long: plan.long, left: plan.left, count: plan.count, used: plan.used, together: plan.together }, { long: 'palace', left: ['tea'], count: 1, used: ['palace'], together: 3 });
  assert.equal(chooserPairFits('palace', 'tea', { ...short, hours: 3 }), true);
  assert.equal(chooserPairFits('tea', 'palace', { ...short, hours: 3 }), true);
});

test('chooser overlays preserve manual preferences and requirements, report removed appointments, and leave source inputs intact', () => {
  const raw = { ...rawInput(), preferences: { tea: true, art: true, quiet: false }, requiredFeatures: { indoor: true }, requiredCategories: ['food'],
    meal: { mode: 'window', startTime: '12:00', endTime: '13:00' }, appointments: [{ time: '13:59', label: 'before' }, { time: '14:00', label: 'inside' }, { time: '17:00', label: 'after' }] };
  const at = request(3, '14:00', ['tea']); const before = JSON.stringify({ raw, at });
  const { input, changes } = chooserTripInput(raw, at, { handPreferences: ['art'], foodByHand: true });
  assert.deepEqual(input.preferences, raw.preferences); assert.deepEqual(input.requiredFeatures, raw.requiredFeatures); assert.deepEqual(input.requiredCategories, ['food']);
  assert.equal(input.budget, 50000); assert.deepEqual(input.appointments.map(item => item.label), ['inside']);
  assert.deepEqual(changes.appointments.map(item => item.label), ['before', 'after']); assert.deepEqual(changes.meal, raw.meal); assert.equal(input.meal.mode, 'any');
  assert.equal(JSON.stringify({ raw, at }), before);
  assert.equal(chooserTripInput(raw, at).input.preferences.art, undefined, 'only a manually retained prior pick survives');
});

test('production planner accepts the chooser contract and schedules the selected late gallery within the actual window', () => {
  const at = request(2, '16:30', ['art']), { input } = chooserTripInput(rawInput(), at);
  const normalized = normalizePlannerInput(input, { places });
  const result = planTravel(normalized, { places, now: at.now, routeLeg, calendar, ask: false, intents: dayIntentRules(normalized) });
  assert.ok(result.primary); assert.ok(result.primary.stops.some(stop => stop.placeId === 'late-gallery')); assert.ok(result.primary.stops.every(stop => stop.placeId !== 'gallery'));
  assert.ok(result.primary.stops.every(stop => stop.arrivalTime >= '16:30' && stop.departureTime <= '18:30'));
});

test('memoized candidates cannot be modified through their returned list and separate route identities do not contaminate each other', () => {
  const at = request(1); const candidates = chooserPickOptions('tea', at);
  assert.throws(() => candidates.pop(), TypeError);
  const distantRoute = (from, to) => ({ ...routeLeg(from, to), distanceMeters: 3600, minMinutes: 60, maxMinutes: 60 });
  assert.equal(chooserPickFits('tea', { ...at, routeLeg: distantRoute }), false);
  assert.equal(chooserPickFits('tea', at), true);
});

test('saved future journeys retain their explicit start; today and older journeys return to live chooser time', () => {
  assert.deepEqual(chooserTimeFromSaved({ date: '2026-10-11', startTime: '14:00' }, '2026-10-10T00:00:00Z'), { date: '2026-10-11', startTime: '14:00' });
  assert.equal(chooserTimeFromSaved({ date: '2026-10-10', startTime: '14:00' }, '2026-10-10T00:00:00Z'), null);
  assert.equal(chooserTimeFromSaved({ date: '2026-10-09', startTime: '14:00' }, '2026-10-10T00:00:00Z'), null);
});
