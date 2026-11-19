import test from 'node:test';
import assert from 'node:assert/strict';
import {createDramaInvite} from '../drama-invite-route.mjs';

function tab() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

const en = '?drama=1&invite=1&lang=en';
const mn = '?drama=1&invite=1&lang=mn';
const startAt = 1_000_000;

test('opening an explicit invitation remembers its language during account sign-in', () => {
  const storage = tab();
  const open = (search, at = startAt) => createDramaInvite(search, () => storage, () => at);
  assert.equal(open(mn).language, 'mn');
  assert.equal(open('?code=fixture&state=return', startAt + 1000).language, 'mn');
  assert.equal(open('').language, 'mn');
  const next = open(en);
  assert.equal(next.language, 'en');
  next.clear();
  assert.equal(next.language, null);
  assert.equal(open('').language, null);
});

test('stale invitations and competing destinations leave no invitation on a later return', () => {
  for (const route of ['?wardrobe=1','?cafe=1','?me2=1','?exam=1','?reminder=1','?drama=1','?invite=1&drama=1&lang=ko']) {
    const storage = tab();
    createDramaInvite(en, () => storage, () => startAt);
    assert.equal(createDramaInvite(route, () => storage, () => startAt).language, null, route);
    assert.equal(createDramaInvite('', () => storage, () => startAt).language, null, route);
  }
  const storage = tab();
  createDramaInvite(en, () => storage, () => startAt);
  assert.equal(createDramaInvite('', () => storage, () => startAt + 30*60_000+1).language, null);
});

test('an explicit invitation works even if the browser has disabled storage', () => {
  const blocked = () => { throw Error('Storage disabled'); };
  assert.equal(createDramaInvite(mn, blocked).language, 'mn');
  assert.equal(createDramaInvite('?lang=mn', blocked).language, null);
  const invite = createDramaInvite(en, blocked);
  invite.clear();
  assert.equal(invite.language, null);
});
