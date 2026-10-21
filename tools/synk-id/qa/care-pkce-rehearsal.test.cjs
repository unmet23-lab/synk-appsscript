'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { parseArgs, validateInputs, runRehearsal, main } = require('./care-pkce-rehearsal.cjs');
const { CLIENTS } = require('../registry.cjs');
const { digest } = require('../provision-plan.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const modules = Promise.all([import(pathToFileURL(path.join(ROOT, 'experiences/synk-account/src/core.mjs'))), import(pathToFileURL(path.join(ROOT, 'experiences/relationship-care/model.mjs')))]);
const ref = 'syntheticrehearsal', base = `https://${ref}.supabase.co`;
const ids = { 'care-browser': '00111111-1111-4111-8111-111111111111', 'care-native': '00222222-2222-4222-8222-222222222222' };
const credentials = { 리허설REF: ref, 운영REF: 'syntheticproduction', 만료판정: env => ({ 상태: env.SUPABASE_TOKEN_EXPIRES === '2099-01-01' ? 'ok' : '지남' }) };
const env = { SUPABASE_PROJECT_REF: ref, SUPABASE_ACCESS_TOKEN: 'manager-secret-synthetic', SUPABASE_TOKEN_EXPIRES: '2099-01-01' };
const settings = { version: 1, environment: 'rehearsal', supabaseUrl: base, supabasePublishableKey: 'sb_publishable_synthetic', portalUrl: 'https://synk.example/id-rehearsal/', clients: [] };
const journal = { version: 1, environment: 'rehearsal', bindings: ids, mapping: Object.fromEntries(Object.values(ids).map(id => [id, 'platform'])), pendingMapping: null, completedAt: '2026-10-06T00:00:00Z' };

function provider(fault = {}) {
  const users = new Map(), sessions = new Map(), authorizations = new Map(), codes = new Map(), calls = [], files = [], consented = [];
  let verifiedPkce = 0, created = 0;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const jwt = (user, clientId) => {
    const value = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: user.id, iss: base + '/auth/v1', ...(clientId ? { client_id: clientId } : {}) })).toString('base64url') + '.' + crypto.randomBytes(6).toString('hex');
    sessions.set(value, user); return value;
  };
  const fetcher = async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET', headers = new Headers(options.headers), token = (headers.get('authorization') || '').replace(/^Bearer /, '');
    const body = options.body === undefined ? undefined : options.body instanceof URLSearchParams ? Object.fromEntries(options.body) : JSON.parse(options.body);
    calls.push({ path: url.pathname, method, body, redirect: options.redirect });
    assert.ok([base, 'https://api.supabase.com'].includes(url.origin));
    assert.equal(options.credentials, 'omit');
    const user = sessions.get(token);
    if (url.origin === 'https://api.supabase.com') {
      assert.equal(token, env.SUPABASE_ACCESS_TOKEN);
      const prefix = `/v1/projects/${ref}`;
      if (url.pathname === prefix) return json({ id: ref, name: fault.production ? 'Synk Core' : 'synk-core-rehearsal', status: 'ACTIVE_HEALTHY' });
      if (url.pathname === prefix + '/secrets') return json([{ name: 'SYNK_OAUTH_CLIENT_PRODUCTS', value: fault.mappingDrift ? '0'.repeat(64) : digest(journal.mapping) }]);
      if (url.pathname === prefix + '/functions') return json(['synk-account', 'synk-care'].map(slug => ({ slug, status: 'ACTIVE', verify_jwt: !fault.functionOff })));
      if (url.pathname === prefix + '/api-keys') return json([{ type: 'secret', api_key: 'service-secret-synthetic' }]);
      if (url.pathname === prefix + '/database/query') {
        assert.equal(method, 'POST'); assert.ok(!/\b(insert|update|delete|drop|truncate)\b/i.test(body.query));
        if (body.query.includes('care-pkce:discover')) {
          assert.match(body.query, /where email in \(/);
          assert.match(body.query, /raw_app_meta_data->>'synk_care_pkce_probe'=/);
          if (fault.discoveryFailure) return json({ error: 'private-body-should-not-print' }, 503);
          const wanted = [...body.query.matchAll(/'(care-pkce-[^']+@example.invalid)'/g)].map(match => match[1]);
          const marker = body.query.match(/synk_care_pkce_probe'='([^']+)'/)[1];
          return json([...users.values()].filter(row => wanted.includes(row.email) && row.app_metadata.synk_care_pkce_probe === marker).map(row => ({ id: row.id, email: row.email })));
        }
        assert.ok(body.query.includes('care-pkce:owner'));
        assert.match(body.query, /not exists.*other\.auth_user_id<>/);
        return json([{ exclusively_owned: !fault.sharedOwner }]);
      }
      assert.fail('Unexpected management route');
    }
    if (url.pathname.startsWith('/auth/v1/admin/')) {
      assert.equal(token, 'service-secret-synthetic');
      if (url.pathname.startsWith('/auth/v1/admin/oauth/clients/')) {
        const id = url.pathname.split('/').at(-1), name = Object.keys(ids).find(name => ids[name] === id);
        const wanted = CLIENTS.find(row => row.id === name);
        return json({ client_id: id, client_type: 'public', token_endpoint_auth_method: 'none', redirect_uris: fault.clientRedirect ? ['https://wrong.example/callback'] : wanted.redirectUris });
      }
      if (url.pathname === '/auth/v1/admin/users') {
        assert.equal(method, 'POST'); assert.match(body.email, /^care-pkce-[0-9a-f-]+-[01]@example\.invalid$/);
        assert.match(body.app_metadata.synk_care_pkce_probe, /^[0-9a-f-]{36}$/);
        const row = { ...body, id: crypto.randomUUID(), owner: crypto.randomUUID(), status: 'active', state: null, revision: 0 };
        users.set(row.id, row); created++;
        if (fault.lostCreate && created === 1) throw new Error('lost-ACK-token-private');
        return json(row);
      }
      assert.equal(method, 'GET'); // There must never be an admin user DELETE or user listing.
      const row = users.get(url.pathname.split('/').at(-1)); assert.ok(row);
      return json({ ...row, app_metadata: fault.ownerMarker ? { synk_care_pkce_probe: 'not-owned' } : row.app_metadata });
    }
    if (url.pathname === '/auth/v1/token') {
      assert.equal(url.searchParams.get('grant_type'), 'password');
      const row = [...users.values()].find(row => row.email === body.email && row.password === body.password); assert.ok(row);
      return json({ user: { id: row.id }, access_token: jwt(row) });
    }
    if (url.pathname === '/auth/v1/oauth/authorize') {
      assert.equal(options.redirect, 'manual'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      const id = crypto.randomUUID(); authorizations.set(id, Object.fromEntries(url.searchParams));
      return new Response(null, { status: 302, headers: { location: (fault.portalRedirect ? 'https://wrong.example/id-rehearsal/' : settings.portalUrl) + '?authorization_id=' + id } });
    }
    if (url.pathname.startsWith('/auth/v1/oauth/authorizations/')) {
      assert.ok(user); const parts = url.pathname.split('/'), authorization = authorizations.get(parts[5]); assert.ok(authorization);
      if (method === 'GET') return json({ client: { id: authorization.client_id } });
      assert.deepEqual(body, { action: 'approve' });
      const code = crypto.randomUUID(); codes.set(code, { ...authorization, user }); consented.push(authorization.client_id);
      const callback = new URL(authorization.redirect_uri);
      callback.searchParams.set('code', code); callback.searchParams.set('state', fault.callbackState ? 'wrong-state' : authorization.state);
      return json({ redirect_url: callback.href });
    }
    if (url.pathname === '/auth/v1/oauth/token') {
      const code = codes.get(body.code); assert.ok(code);
      assert.equal(body.grant_type, 'authorization_code'); assert.equal(body.client_id, code.client_id); assert.equal(body.redirect_uri, code.redirect_uri);
      assert.equal(crypto.createHash('sha256').update(body.code_verifier).digest('base64url'), code.code_challenge);
      codes.delete(body.code); verifiedPkce++;
      return json({ access_token: jwt(code.user, fault.tokenClient ? 'wrong-client' : code.client_id), refresh_token: 'refresh-secret-synthetic', expires_in: 3600 });
    }
    assert.ok(user); assert.equal(headers.get('x-synk-product'), 'platform'); assert.equal(headers.get('x-synk-contract'), '1');
    if (url.pathname === '/functions/v1/synk-account') {
      if (method === 'POST') {
        assert.equal(body.action, 'delete-request');
        if (fault.deleteFailure) return json({ error: 'private-failure-body' }, 503);
        user.status = 'deletion-requested';
        return json({ ok: true, request: { request_id: body.request_id, kind: 'delete', status: 'pending' } });
      }
      return json({ ok: true, account: { synk_user_id: user.owner, status: user.status } });
    }
    assert.equal(url.pathname, '/functions/v1/synk-care');
    if (fault.careFailure) throw new Error('Bearer access-private-failure');
    if (method === 'POST') {
      if (body.expected_revision !== user.revision) return json({ ok: false, error: { code: 'REVISION_CONFLICT' } }, 409);
      user.revision++; user.state = body.action === 'delete' ? null : structuredClone(body.state);
    }
    return json({ ok: true, scope: 'synk-care', accountId: fault.foreignCareOwner ? crypto.randomUUID() : user.owner, revision: user.revision, state: user.state });
  };
  return { fetcher, users, calls, files, consented, pkceCount: () => verifiedPkce, recordAuthIds: async ids => files.push({ authIds: [...ids] }) };
}
async function run(fault) {
  const p = provider(fault), [core, care] = await modules;
  const report = await runRehearsal({ settings, journal, credentials, env, core, care, ...p });
  return { p, report };
}

test('기본 실행은 자격증명·파일·네트워크 없이 준비 요약만 반환하고 다른 실행 플래그를 거부한다', async () => {
  assert.equal(parseArgs([]), false); assert.equal(parseArgs(['--run']), true);
  for (const args of [['--운영'], ['--apply'], ['--run', '--운영'], ['--run', '--run']]) assert.throws(() => parseArgs(args));
  const before = globalThis.fetch; globalThis.fetch = () => { throw Error('No network allowed'); };
  try { assert.equal((await main([])).remoteRun, false); } finally { globalThis.fetch = before; }
});

test('완료된 실제 binding·공개설정·리허설 과녁·기간을 확인하며 추정 ID를 허용하지 않는다', () => {
  assert.equal(validateInputs(settings, journal, credentials, env).registrations.length, 2);
  for (const input of [
    [settings, { ...journal, completedAt: undefined }, env], [settings, { ...journal, pendingMapping: {} }, env],
    [settings, { ...journal, bindings: {} }, env], [settings, { ...journal, bindings: { ...ids, 'care-native': ids['care-browser'] } }, env],
    [{ ...settings, environment: 'production' }, journal, env], [{ ...settings, supabaseUrl: 'https://syntheticproduction.supabase.co' }, journal, env],
    [{ ...settings, bindings: { 'care-browser': 'invented' } }, journal, env], [settings, journal, { ...env, SUPABASE_TOKEN_EXPIRES: 'expired' }],
  ]) assert.throws(() => validateInputs(input[0], input[1], credentials, input[2]));
});

test('실제 Core PKCE 코드를 합성 공급자에 왕복하고 browser/native 같은 계정 자료·CAS·격리·삭제를 검증한다', async () => {
  const { p, report } = await run();
  assert.equal(report.ok, true); assert.equal(report.passed, 9); assert.equal(p.pkceCount(), 3);
  assert.deepEqual(p.consented, [ids['care-browser'], ids['care-native'], ids['care-browser']]);
  assert.equal(report.cleanup.deleteRequestsAccepted, 2); assert.equal(report.cleanup.verifiedDeletionPending, 2);
  assert.equal(report.cleanup.authUsersMayRemain, true); assert.equal(report.cleanup.purgeVerified, false);
  assert.equal(report.cleanup.careDocumentDeletionVerified, true); assert.equal(report.cleanup.privateCareDataMayRemain, false);
  assert.equal(p.users.size, 2); assert.ok([...p.users.values()].every(row => row.status === 'deletion-requested' && row.state === null));
  assert.ok(p.files.every(file => Object.keys(file).join() === 'authIds' && file.authIds.length <= 2));
  const output = JSON.stringify(report);
  for (const user of p.users.values()) for (const secret of [user.id, user.owner, user.password, user.email, '함께 걸었던 합성 강변']) assert.ok(!output.includes(secret));
  assert.ok(!/secret-synthetic|eyJhbG|sb_publishable/.test(output));
});

test('프로젝트·매핑·함수·클라이언트 불일치는 합성 계정 생성 전 중단한다', async () => {
  const [core, care] = await modules;
  for (const fault of [{ production: true }, { mappingDrift: true }, { functionOff: true }, { clientRedirect: true }]) {
    const p = provider(fault);
    await assert.rejects(() => runRehearsal({ settings, journal, credentials, env, core, care, ...p }));
    assert.equal(p.users.size, 0);
  }
});

test('포털·callback state·토큰 client 위조는 실제 Core 검사를 통과하지 못하고 두 합성 계정 정리는 계속한다', async () => {
  for (const fault of [{ portalRedirect: true }, { callbackState: true }, { tokenClient: true }, { foreignCareOwner: true }]) {
    const { report, p } = await run(fault);
    assert.equal(report.ok, false); assert.equal(report.cleanup.deleteRequestsAccepted, 2);
    assert.ok(!JSON.stringify(report).includes('wrong-client'));
    assert.ok(!p.calls.some(row => row.method === 'DELETE'));
  }
});

test('생성 ACK가 유실되어도 정확한 합성 email+관리자 표식으로만 찾아 일반 삭제 요청을 남긴다', async () => {
  const { p, report } = await run({ lostCreate: true });
  assert.equal(report.ok, false); assert.equal(p.users.size, 1);
  assert.equal(report.cleanup.knownSyntheticAccounts, 1); assert.equal(report.cleanup.deleteRequestsAccepted, 1);
  assert.equal(report.cleanup.requestsComplete, true);
  assert.ok(p.calls.some(row => row.body?.query?.includes('care-pkce:discover')));
  assert.ok(!JSON.stringify(report).includes('lost-ACK-token-private'));
});

test('표식 불일치나 다른 Auth와 공유한 소유자는 삭제하지 않고 미완료로 보고한다', async () => {
  for (const fault of [{ ownerMarker: true }, { sharedOwner: true }]) {
    const { p, report } = await run(fault);
    assert.equal(report.ok, false); assert.equal(report.cleanup.deleteRequestsAccepted, 0);
    assert.equal(report.cleanup.requestsComplete, false);
    assert.equal(p.calls.filter(row => row.body?.action === 'delete-request').length, 0);
  }
});

test('본문에 비밀을 실은 실패와 정리 실패도 원문을 출력하지 않고 모든 합성 계정을 시도한다', async () => {
  const { p, report } = await run({ careFailure: true, deleteFailure: true });
  assert.equal(report.ok, false); assert.equal(report.error, 'PROBE_FAILED');
  assert.equal(report.cleanup.requestsComplete, false);
  assert.equal(report.cleanup.privateCareDataMayRemain, true);
  assert.equal(p.calls.filter(row => row.body?.action === 'delete-request').length, 2);
  assert.ok(!/access-private|private-failure|Bearer|password/.test(JSON.stringify(report)));
});

test('생성 응답과 정확한 ID 복구가 모두 실패하면 다른 계정을 찾거나 삭제하지 않는다', async () => {
  const { p, report } = await run({ lostCreate: true, discoveryFailure: true });
  assert.equal(p.users.size, 1);
  assert.equal(report.cleanup.knownSyntheticAccounts, 0);
  assert.equal(report.cleanup.requestsComplete, false);
  assert.ok(report.cleanup.issues.includes('UNCONFIRMED_CREATE_OUTCOME'));
  assert.equal(p.calls.filter(row => row.body?.action === 'delete-request').length, 0);
  assert.equal(p.calls.filter(row => row.path === '/auth/v1/admin/users' && row.method === 'GET').length, 0);
});

test('로컬 ID 기록 실패도 알려진 생성 ID 정리를 건너뛰지 않고 파일 내용을 오류로 노출하지 않는다', async () => {
  const p = provider(), [core, care] = await modules;
  const report = await runRehearsal({ settings, journal, credentials, env, core, care, ...p, recordAuthIds: async () => { throw new Error('private-file-path-and-id'); } });
  assert.equal(report.ok, false); assert.equal(p.users.size, 1);
  assert.equal(report.cleanup.deleteRequestsAccepted, 1);
  assert.equal(report.cleanup.requestsComplete, false);
  assert.ok(!JSON.stringify(report).includes('private-file-path-and-id'));
});
