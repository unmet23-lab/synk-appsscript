import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { emptyMemberActivity, validateMemberActivity, pruneMemberActivity, updateMemberActivity, MEMBER_ACTIVITY_LIMITS } from '../src/member-activity-data.mjs';
import { PERSONAL_LIMITS, validatePersonalState, serializePersonalState, parsePersonalState, validatePersonalResponse } from '../src/personal-data.mjs';
const now = '2026-10-14T12:00:00.000Z', ago = days => new Date(Date.parse(now) - days * 86400000).toISOString();
const state = () => ({ version: 1, consent: true, enabledAt: ago(100), events: [{ id: randomUUID(), appId: 'pulse', at: ago(1) }], favorites: ['path'] });

test('off by default; consent controls app metadata without sharing other platform consent', () => {
  const empty = emptyMemberActivity();
  assert.deepEqual(empty, { version: 1, consent: false, enabledAt: null, events: [], favorites: [] });
  assert.throws(() => updateMemberActivity(empty, { type: 'launch', id: randomUUID(), appId: 'world' }, now), { code: 'INSIGHT_CONSENT_REQUIRED' });
  const enabled = updateMemberActivity(empty, { type: 'consent', value: true }, now);
  assert.equal(enabled.enabledAt, now);
  assert.equal(updateMemberActivity(enabled, { type: 'consent', value: true }, ago(-1)).enabledAt, now);
  assert.deepEqual(updateMemberActivity(state(), { type: 'consent', value: false }, now), empty);
  assert.deepEqual(validatePersonalState('member-insight', { ...state(), consent: false }), empty);
  assert.deepEqual(empty, emptyMemberActivity());
});

test('only the four app identifiers, explicit favorites and bounded canonical launch metadata are accepted', () => {
  const source = state();
  for (const bad of [
    { ...source, notes: [] }, { ...source, accountId: randomUUID() }, { ...source, content: 'private customer text' },
    { ...source, favorites: ['teacher'] }, { ...source, favorites: ['path', 'path'] }, { ...source, consent: 'yes' },
    { ...source, enabledAt: null }, { ...source, enabledAt: '2026-10-01' },
    { ...source, events: [{ ...source.events[0], title: 'private note' }] },
    { ...source, events: [{ ...source.events[0], appId: 'fortune' }] },
    { ...source, events: [{ ...source.events[0], id: 'not-uuid' }] },
    { ...source, events: [{ ...source.events[0], at: '2026-10-14T12:00:00Z' }] },
    { ...source, events: [{ ...source.events[0], at: ago(101) }] },
    { ...source, events: [source.events[0], { ...source.events[0], id: source.events[0].id.toUpperCase() }] },
    { ...source, events: Array.from({ length: 2001 }, () => ({ id: randomUUID(), appId: 'world', at: now })) },
  ]) assert.throws(() => validateMemberActivity(bad), { code: 'INVALID_PERSONAL_STATE' });
  assert.throws(() => validateMemberActivity({ ...source, consent: false, notes: ['private'] }), { code: 'INVALID_PERSONAL_STATE' });
  assert.deepEqual(validateMemberActivity(source), source);
});

test('writes reject future/expired events; client pruning keeps the inclusive 90-day boundary and loading remains possible', () => {
  const value = state();value.events = [91, 90, 1, -1].map(days => ({ id: randomUUID(), appId: 'messenger', at: ago(days) }));
  assert.deepEqual(validateMemberActivity(value), value);
  assert.throws(() => validateMemberActivity(value, { now, enforceRetention: true }), { code: 'INVALID_PERSONAL_STATE' });
  const pruned = pruneMemberActivity(value, now);
  assert.deepEqual(pruned.events.map(event => event.at), [ago(90), ago(1)]);
  assert.deepEqual(validateMemberActivity(pruned, { now, enforceRetention: true }), pruned);
  assert.equal(value.events.length, 4);
  assert.throws(() => validateMemberActivity({ ...state(), enabledAt: ago(-1), events: [] }, { now, enforceRetention: true }), { code: 'INVALID_PERSONAL_STATE' });
  assert.deepEqual(updateMemberActivity({ ...state(), enabledAt: ago(-1), events: [] }, { type: 'consent', value: false }, now), emptyMemberActivity());
});

test('launch retry is idempotent, caps newest 2000, and separate favorite actions preserve metadata-only state', () => {
  const value = state();value.events = Array.from({ length: MEMBER_ACTIVITY_LIMITS.events }, (_, index) => ({ id: randomUUID(), appId: 'world', at: new Date(Date.parse(now) - 2000000 + index).toISOString() }));
  const action = { type: 'launch', id: randomUUID(), appId: 'pulse' };
  const next = updateMemberActivity(value, action, now);
  assert.equal(next.events.length, 2000);assert.equal(next.events.at(-1).id, action.id);
  assert.equal(next.events.some(event => event.id === value.events[0].id), false);
  assert.deepEqual(updateMemberActivity(next, action, now), next);
  assert.throws(() => updateMemberActivity(next, { ...action, appId: 'path' }, now), { code: 'INVALID_PERSONAL_STATE' });
  const favorites = updateMemberActivity(next, { type: 'favorites', value: ['world', 'pulse'] }, now);
  assert.deepEqual(favorites.favorites, ['world', 'pulse']);
  assert.deepEqual(updateMemberActivity(favorites, { type: 'favorite', appId: 'pulse' }, now).favorites, ['world']);
  assert.deepEqual(next.favorites, ['path']);
});

test('generic export/import and response owner/resource validation include member-insight within 256 KiB', () => {
  const source = state();assert.equal(PERSONAL_LIMITS['member-insight'], 256 * 1024);
  assert.deepEqual(parsePersonalState('member-insight', serializePersonalState('member-insight', source)), source);
  const response = { ok: true, scope: 'synk-personal', resource: 'member-insight', accountId: 'synthetic-owner', revision: 1, updatedAt: now, state: source };
  assert.deepEqual(validatePersonalResponse(response, { resource: 'member-insight', accountId: 'synthetic-owner' }), response);
  assert.throws(() => validatePersonalResponse(response, { resource: 'member-insight', accountId: 'other-owner' }), { code: 'ACCOUNT_CHANGED' });
  assert.throws(() => validatePersonalState('member-insight', { ...source, extra: 'x'.repeat(256 * 1024) }), { code: 'PERSONAL_DATA_TOO_LARGE' });
});
