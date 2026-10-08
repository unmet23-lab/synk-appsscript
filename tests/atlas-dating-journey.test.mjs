import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { getJourneyFocus, getSchedulePreparation, getRescheduleDraft } from '../experiences/atlas-lab/dating-journey.mjs';
import { createAppointmentsAdapter } from '../experiences/atlas-lab/appointments.mjs';

const copy = value => structuredClone(value);
const at = '2026-10-09T05:00:00.000Z'; // Friday, 14:00 in Seoul.
function pair(id, { intro = {}, appointments = [], canPropose = false, paused = false } = {}) {
  return { pairId: id, status: 'active', paused, introduction: intro, view: { pairId: id,
    people: [{ id: 'me', label: '나' }, { id: `other-${id}`, label: `상대 ${id}` }], appointments, canPropose } };
}
const view = (pairs = [], extra = {}) => ({ accountId: 'me', status: 'active', paused: false, pairs, ...extra });
const intro = (status, extra = {}) => ({ accepted: status === 'accepted', current: { status, from: 'me', to: 'other', expiresAt: '2026-10-10T05:00:00.000Z', ...extra } });
const appointment = (status, extra = {}) => ({ id: `appointment-${status}`, status,
  proposal: { expiresAt: '2026-10-10T05:00:00.000Z', schedule: { startsAt: '2026-10-11T05:00:00.000Z', endsAt: '2026-10-11T06:00:00.000Z' } }, ...extra });
const schedule = extra => getSchedulePreparation({ source: 'public-profile', myAvailability: 'weekend', partnerAvailability: 'weekend', nowISO: at, timeZone: 'Asia/Seoul', ...extra });

function busyFixture() {
  const adapter = createAppointmentsAdapter({ clock: () => at });
  let state = adapter.create({ pairId: 'pair', people: [{ id: 'me', label: '나' }, { id: 'other', label: '상대' }], at });
  const act = (kind, actor, extra = {}) => { state = adapter.record(state, { kind, actor, requestId: `request-${state.revision + 1}`, expectedRevision: state.revision, at, ...extra }); };
  const propose = () => act('propose', 'other', { schedule: { startsAt: '2026-10-10T05:00:00.000Z', endsAt: '2026-10-10T06:30:00.000Z', timeZone: 'Asia/Seoul', place: '함께 확인한 카페', note: '복사하지 않을 메모' } });
  const projected = (viewer = 'me') => ({ pairId: 'pair', status: 'active', paused: false, introduction: intro('accepted'), view: adapter.inspect(state, { viewer, at }) });
  propose(); const id = projected().view.appointments.at(-1).id;
  act('respond', 'me', { appointmentId: id, proposalVersion: 1, value: 'busy' });
  return { id, act, propose, projected };
}

test('only my latest busy appointment offers its shared place and whole-minute duration for explicit reuse', () => {
  const fixture = busyFixture(), projected = fixture.projected(), before = copy(projected);
  const result = getRescheduleDraft(projected, fixture.id);
  assert.deepEqual(result, { pairId: 'pair', appointmentId: fixture.id, proposalVersion: 1, place: '함께 확인한 카페', durationMinutes: 90 });
  assert.deepEqual(projected, before); assert.equal(getRescheduleDraft(fixture.projected('other'), fixture.id), null, 'the counterpart did not personally answer busy');
  result.place = 'changed'; assert.equal(getRescheduleDraft(projected, fixture.id).place, '함께 확인한 카페');
  for (const key of ['reflections', 'suggestions', 'nextForm']) Object.defineProperty(projected.view.me, key, { get() { throw new Error(`private ${key}`); } });
  Object.defineProperty(projected.view.appointments[0], 'history', { get() { throw new Error('old versions are not the current response'); } });
  assert.equal(getRescheduleDraft(projected, fixture.id).durationMinutes, 90);
});

test('cancelled, declined, paused, closed, superseded or no-longer-authorized appointments offer no reuse', () => {
  const fixture = busyFixture();
  for (const change of [p => { p.status = 'closed'; }, p => { p.paused = true; }, p => { p.view.canPropose = false; },
    p => { p.introduction = intro('declined'); }, p => { p.view.appointments[0].status = 'cancelled'; },
    p => { p.view.appointments[0].status = 'declined'; }, p => { p.view.appointments[0].status = 'expired'; },
    p => { p.view.appointments[0].proposal.version = 0; }, p => { p.view.appointments[0].proposal.version = 2; p.view.appointments[0].status = 'pending'; },
    p => { p.view.me.id = 'foreign'; }, p => { p.view.pairId = 'foreign'; },
    p => { p.view.appointments[0].people[0].respondedAt = '2026-10-08T00:00:00.000Z'; }]) {
    const p = fixture.projected(); change(p); assert.equal(getRescheduleDraft(p, fixture.id), null);
  }
  fixture.propose(); const newer = fixture.projected().view.appointments.at(-1);
  fixture.act('respond', 'me', { appointmentId: newer.id, proposalVersion: newer.proposal.version, value: 'busy' });
  assert.equal(fixture.projected().view.canPropose, true); assert.equal(getRescheduleDraft(fixture.projected(), fixture.id), null, 'old busy history cannot win over a newer appointment');
  assert.equal(getRescheduleDraft(fixture.projected(), newer.id).appointmentId, newer.id);
});

test('reuse never rounds unsupported durations or copies malformed place, date, note or arbitrary fields', () => {
  const fixture = busyFixture();
  for (const change of [s => { s.place = ' '; }, s => { s.place = 'x'.repeat(181); }, s => { s.startsAt = 'not a date'; },
    s => { s.endsAt = s.startsAt; }, s => { s.endsAt = '2026-10-10T06:30:30.000Z'; }]) {
    const p = fixture.projected(); change(p.view.appointments[0].proposal.schedule); assert.equal(getRescheduleDraft(p, fixture.id), null);
  }
  const result = getRescheduleDraft(fixture.projected(), fixture.id);
  for (const key of ['note', 'startsAt', 'endsAt', 'timeZone', 'responses']) assert.equal(Object.hasOwn(result, key), false);
});

test('received introduction response precedes schedule response, preparation, confirmation and waiting', () => {
  const received = pair('received', { intro: { ...intro('pending', { from: 'other-received', to: 'me' }), canRespond: true } });
  const scheduleReply = pair('schedule', { intro: intro('accepted'), appointments: [appointment('pending', { canRespond: true })] });
  const prepare = pair('prepare', { intro: intro('accepted'), canPropose: true });
  const confirmed = pair('confirmed', { appointments: [appointment('confirmed')] });
  const waiting = pair('waiting', { intro: intro('pending') });
  let result = getJourneyFocus(view([waiting, confirmed, prepare, scheduleReply, received]));
  assert.equal(result.kind, 'introduction-response'); assert.equal(result.pairId, 'received'); assert.equal(result.target, 'inbox');
  result = getJourneyFocus(view([waiting, confirmed, prepare, scheduleReply])); assert.equal(result.kind, 'schedule-response');
  assert.equal(result.appointmentId, 'appointment-pending');
  assert.equal(getJourneyFocus(view([waiting, confirmed, prepare])).kind, 'prepare-schedule');
  assert.equal(getJourneyFocus(view([waiting, confirmed])).kind, 'confirmed-schedule');
  assert.equal(getJourneyFocus(view([waiting])).kind, 'introduction-waiting');
  assert.equal(getJourneyFocus(view()).kind, 'recommendation');
});

test('preparation never replaces an existing unfinished appointment even if a malformed flag allows another proposal', () => {
  for (const status of ['pending', 'confirmed', 'awaiting-completion', 'partially-completed']) {
    const p = pair('p', { intro: intro('accepted'), canPropose: true, appointments: [appointment(status)] });
    assert.notEqual(getJourneyFocus(view([p])).kind, 'prepare-schedule');
  }
  const completed = pair('p', { intro: intro('accepted'), canPropose: true, appointments: [appointment('completed')] });
  assert.equal(getJourneyFocus(view([completed])).kind, 'prepare-schedule');
});

test('my unanswered concrete proposal has a waiting state without inferring rejection or sending a new request', () => {
  const state = view([pair('p', { intro: intro('accepted'), appointments: [appointment('pending', { canRespond: false })] })]);
  const before = copy(state), result = getJourneyFocus(state);
  assert.equal(result.kind, 'schedule-waiting'); assert.equal(result.target, 'inbox'); assert.equal(result.pairId, 'p');
  assert.deepEqual(state, before); assert.equal('action' in result, false);
});

test('completion is an explicit navigation target and pausing still permits checking an existing confirmed meeting', () => {
  const p = pair('p', { paused: true, intro: { ...intro('pending', { from: 'other-p', to: 'me' }), canRespond: true }, canPropose: true,
    appointments: [appointment('awaiting-completion', { canComplete: true })] });
  const result = getJourneyFocus(view([p], { paused: true }));
  assert.equal(result.kind, 'appointment-completion'); assert.equal(result.label, '만남 완료 확인하기');
  assert.equal(result.appointmentId, 'appointment-awaiting-completion'); assert.equal(result.target, 'inbox');
  p.view.appointments = []; assert.equal(getJourneyFocus(view([p], { paused: true })).kind, 'unavailable');
});

test('closed, foreign, duplicate-person, wrong-pair and inaccessible projections never expose partner labels', () => {
  const secret = pair('secret', { intro: intro('accepted'), canPropose: true });
  const variants = [
    { ...copy(secret), status: 'closed' }, { ...copy(secret), view: null },
    { ...copy(secret), view: { ...copy(secret.view), pairId: 'other-pair' } },
    { ...copy(secret), view: { ...copy(secret.view), people: [{ id: 'foreign', label: 'private 1' }, { id: 'foreign-2', label: 'private 2' }] } },
    { ...copy(secret), view: { ...copy(secret.view), people: [{ id: 'me', label: 'private 1' }, { id: 'me', label: 'private 2' }] } },
  ];
  for (const p of variants) {
    const out = getJourneyFocus(view([p])); assert.equal(out.kind, 'recommendation'); assert.equal(out.pairId, null);
    assert.equal(JSON.stringify(out).includes('private'), false); assert.equal(JSON.stringify(out).includes('secret'), false);
  }
  for (const status of ['deleted', 'suspended']) assert.equal(getJourneyFocus(view([secret], { status })).kind, 'unavailable');
  assert.equal(getJourneyFocus(null).kind, 'unavailable');
});

test('urgent responses use stable deadline and pair ordering, independent of list ordering', () => {
  const a = pair('a', { intro: { ...intro('pending', { to: 'me', expiresAt: '2026-10-10T04:00:00.000Z' }), canRespond: true } });
  const b = pair('b', { intro: { ...intro('pending', { to: 'me', expiresAt: '2026-10-10T05:00:00.000Z' }), canRespond: true } });
  assert.equal(getJourneyFocus(view([b, a])).pairId, 'a'); assert.deepEqual(getJourneyFocus(view([b, a])), getJourneyFocus(view([a, b])));
  b.introduction.current.expiresAt = a.introduction.current.expiresAt;
  assert.equal(getJourneyFocus(view([b, a])).pairId, 'a');
});

test('journey focus never reads private reflections or preference hints', () => {
  const p = pair('p', { intro: intro('accepted'), canPropose: true });
  Object.defineProperty(p.view, 'me', { get() { throw new Error('private information must not be read'); } });
  assert.equal(getJourneyFocus(view([p])).kind, 'prepare-schedule');
});

test('weekend declarations yield only three explicit future calendar dates, with no time, duration or place', () => {
  const result = schedule();
  assert.equal(result.status, 'ready'); assert.deepEqual(result.dates.map(item => item.date), ['2026-10-10', '2026-10-11', '2026-10-17']);
  assert.deepEqual(result.dates.map(item => item.weekday), [6, 0, 6]); assert.equal(result.timeZone, 'Asia/Seoul');
  assert.ok(result.dates.every(item => Object.keys(item).sort().join(',') === 'date,label,weekday'));
  for (const key of ['startsAt', 'endsAt', 'durationMinutes', 'place', 'selectedDate']) assert.equal(key in result, false);
});

test('weekday means weekday evening while any intersects only the explicitly known counterpart choice', () => {
  const result = schedule({ myAvailability: 'any', partnerAvailability: 'weekday' });
  assert.deepEqual(result.dates.map(item => item.date), ['2026-10-12', '2026-10-13', '2026-10-14']); assert.match(result.timeHint, /평일 저녁/);
  assert.deepEqual(schedule({ myAvailability: 'weekday', partnerAvailability: 'any' }), result);
  const either = schedule({ myAvailability: 'any', partnerAvailability: 'any' });
  assert.deepEqual(either.dates.map(item => item.date), ['2026-10-10', '2026-10-11', '2026-10-12']);
});

test('one-sided unknown, both unknown and explicit nonoverlap never manufacture a shared date', () => {
  for (const values of [{ myAvailability: null }, { partnerAvailability: null }, { myAvailability: null, partnerAvailability: null }, { partnerAvailability: undefined }]) {
    const result = schedule(values); assert.equal(result.status, 'unknown'); assert.deepEqual(result.dates, []);
  }
  const conflict = schedule({ partnerAvailability: 'weekday' }); assert.equal(conflict.status, 'no-overlap'); assert.deepEqual(conflict.dates, []);
});

test('the calendar day is taken from the chosen timezone and never assumes the UTC date', () => {
  const seoul = schedule({ nowISO: '2026-10-09T16:00:00.000Z' }); // Saturday locally.
  assert.deepEqual(seoul.dates.map(item => item.date), ['2026-10-11', '2026-10-17', '2026-10-18']);
  const losAngeles = schedule({ nowISO: '2026-10-10T01:00:00.000Z', timeZone: 'America/Los_Angeles' }); // Friday locally.
  assert.deepEqual(losAngeles.dates.map(item => item.date), ['2026-10-10', '2026-10-11', '2026-10-17']);
});

test('spring and autumn DST transitions preserve the chosen civil days without promising a real local clock time', () => {
  const spring = schedule({ nowISO: '2026-03-07T17:00:00.000Z', timeZone: 'America/New_York' });
  assert.deepEqual(spring.dates.map(item => item.date), ['2026-03-08', '2026-03-14', '2026-03-15']);
  const fall = schedule({ nowISO: '2026-10-31T17:00:00.000Z', timeZone: 'America/New_York' });
  assert.deepEqual(fall.dates.map(item => item.date), ['2026-11-01', '2026-11-07', '2026-11-08']);
  assert.match(spring.limitations.join(' '), /중복되거나 사라지는/);
});

test('leap dates and a skipped date-line day are treated as calendar facts', () => {
  const leap = schedule({ myAvailability: 'any', partnerAvailability: 'any', nowISO: '2028-02-27T15:00:00.000Z' });
  assert.deepEqual(leap.dates.map(item => item.date), ['2028-02-29', '2028-03-01', '2028-03-02']);
  const apia = schedule({ myAvailability: 'any', partnerAvailability: 'any', nowISO: '2011-12-29T12:00:00.000Z', timeZone: 'Pacific/Apia' });
  assert.deepEqual(apia.dates.map(item => item.date), ['2011-12-31', '2012-01-01', '2012-01-02']);
});

test('invalid timezone, time, publication source or enum returns a safe empty result rather than a thrown error', () => {
  for (const input of [{ timeZone: 'Not/AZone' }, { timeZone: 1 }, { nowISO: 'tomorrow' }, { nowISO: '2026-10-09T05:00:00+00:00' },
    { source: 'private-discovery' }, { myAvailability: 'usually-weekends' }]) {
    const result = schedule(input); assert.equal(result.status, 'unavailable'); assert.deepEqual(result.dates, []);
  }
  assert.equal(getSchedulePreparation(null).status, 'unavailable');
});

test('calendar projection does not read private information or mutate the public context', () => {
  const input = { source: 'public-profile', myAvailability: 'weekend', partnerAvailability: 'any', nowISO: at, timeZone: 'Asia/Seoul' };
  for (const key of ['wants', 'reflections', 'preferences']) Object.defineProperty(input, key, { get() { throw new Error(`private ${key}`); } });
  const result = getSchedulePreparation(input); result.dates[0].date = 'changed'; result.limitations.length = 0;
  assert.equal(input.myAvailability, 'weekend'); assert.equal(getSchedulePreparation(input).dates[0].date, '2026-10-10');
});

test('actual authorized service pairs feed public-only calendar context and current journey focus, then redact after withdrawal', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-journey-projection-'));
  const store = createDatingStore({ path: path.join(directory, 'account.sqlite'), mode: 'account' });
  const service = createDatingService({ store, mode: 'account', verify: async accountId => ({ accountId }), clock: () => Date.parse(at) });
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) res.writeHead(404).end(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function request(actor, route, body) {
    const response = await fetch(`${origin}/api/atlas-dating${route}`, { method: body ? 'POST' : 'GET',
      headers: { Origin: origin, Authorization: `Bearer ${actor}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
  }
  const current = async actor => (await request(actor, '/state')).view;
  async function act(actor, action) {
    const previous = await current(actor);
    return request(actor, '/action', { requestId: randomUUID(), expectedRevision: previous.revision, action });
  }
  for (const actor of ['alice', 'bob']) {
    await act(actor, { kind: 'profile', profile: { nickname: actor, intro: '합성 소개', region: '합성 지역', values: { availability: 'weekend' }, required: [] } });
    await act(actor, { kind: 'adult', declared: true });
    await act(actor, { kind: 'consents', consents: { profilePublic: true, receiveInvitations: true, storePreferences: true } });
    await act(actor, { kind: 'discovery', action: { kind: 'set', field: 'consent', value: true } });
    await act(actor, { kind: 'discovery', action: { kind: 'set', field: 'availability', value: actor === 'bob' ? 'weekday' : 'weekend' } });
  }
  const connected = await act('alice', { kind: 'connect', targetAccountId: 'bob' }), pairId = connected.result.pairId;
  let alice = await current('alice'), bob = await current('bob');
  assert.equal(getJourneyFocus(alice).kind, 'introduction-waiting'); assert.equal(getJourneyFocus(bob).kind, 'introduction-response');
  const active = alice.pairs.find(pair => pair.pairId === pairId);
  assert.deepEqual(active.scheduleContext, { source: 'public-profile', myAvailability: 'weekend', partnerAvailability: 'weekend', asOf: alice.asOf });
  assert.equal(getSchedulePreparation({ ...active.scheduleContext, nowISO: alice.asOf, timeZone: 'Asia/Seoul' }).status, 'ready');
  const intro = bob.pairs.find(pair => pair.pairId === pairId).introduction;
  await act('bob', { kind: 'introduction', pairId, expectedIntroductionRevision: intro.revision, action: { kind: 'respond', introductionId: intro.current.id, value: 'accept' } });
  assert.equal(getJourneyFocus(await current('alice')).kind, 'prepare-schedule');
  bob = await current('bob'); await act('bob', { kind: 'profile', profile: { ...bob.profile, values: {} } });
  alice = await current('alice');
  const context = alice.pairs.find(pair => pair.pairId === pairId).scheduleContext;
  assert.equal(context.partnerAvailability, null, 'private weekday preference must not fill absent public availability');
  assert.equal(getSchedulePreparation({ ...context, nowISO: alice.asOf }).status, 'unknown');
  await act('bob', { kind: 'consents', consents: { profilePublic: false, receiveInvitations: true, storePreferences: true } });
  alice = await current('alice');
  assert.equal(alice.pairs.find(pair => pair.pairId === pairId).scheduleContext, undefined);
  assert.equal(getJourneyFocus(alice).pairId, null);
});
