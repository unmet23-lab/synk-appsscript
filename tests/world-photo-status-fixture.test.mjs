import test from 'node:test';
import assert from 'node:assert/strict';
import { closedPhotoStatus } from '../experiences/synk-world-app/qa/photo-status-fixture.mjs';

test('ordinary WORLD screen fixtures answer only the photo pilot status query', () => {
  const endpoint = new URL('https://identity.example.test/functions/v1/me2-photo/api');
  const request = method => ({ method: () => method });
  const user = 'fixture-account';
  assert.deepEqual(closedPhotoStatus(request('POST'), endpoint, { action: 'status' }, user),
    { ok: true, accountId: user, status: 'off' });
  for (const [method, url, body] of [
    ['GET', endpoint, null], ['POST', endpoint, { action: 'upload' }],
    ['POST', endpoint, { action: 'status', photo: 'sample' }],
    ['POST', new URL('?other=1', endpoint), { action: 'status' }],
    ['POST', new URL('/other', endpoint), { action: 'status' }],
  ]) assert.equal(closedPhotoStatus(request(method), url, body, user), null);
});
