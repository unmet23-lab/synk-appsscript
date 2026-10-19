import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { createServer } from '../experiences/path-travel/server.mjs';
import { PHOTO_CREDITS, TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { emptyMemberUnderstanding, validateMemberUnderstanding } from '../experiences/synk-account/src/member-understanding-data.mjs';
import Statement from '../experiences/synk-account/src/member-statement-contract.cjs';

test('로컬 여행 서버는 명시한 정적 자료와 엔진만 제공한다', async t => {
  const server = createServer({ port: 0 });
  await server.start();
  t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(base + '/api/health');
  assert.equal((await health.json()).booking, false);
  for (const route of ['/model.mjs', '/catalog.mjs', '/storage.mjs', '/profile.mjs', '/extractor.mjs', '/conversation.mjs', '/real-places.mjs', '/real-guide.mjs', '/real-ui.mjs', '/real-conditions.mjs', '/real-course.mjs', '/real-course-data.mjs', '/real-course-ui.mjs', '/atlas/engine.js', '/atlas/personalization.js', '/atlas/domain.js', '/atlas/interpretation.js', '/atlas/ask.js', '/atlas/travel.js']) {
    const result = await fetch(base + route);
    assert.equal(result.status, 200, route);
    assert.match(result.headers.get('content-security-policy'), /connect-src 'self'/);
  }
  for (const route of ['/planner.mjs', '/planner-ui.mjs', '/planner.css', '/places-v2.mjs', '/walking-router.mjs', '/planner-storage.mjs', '/planner-feedback.mjs', '/planner-account.mjs', '/legacy.html', '/assets/jongno-walking.json', '/atlas/trail-life.js', '/atlas/temper-outcomes.js', '/tools/lib/loom-motion.js']) assert.equal((await fetch(base + route)).status, 200, route);
  assert.match(await (await fetch(base+'/')).text(), /planner-ui.mjs/);
  for (const route of ['/README.md', '/server.mjs', '/.env', '/docs/비전_정본.md', '/assets/../../server.mjs']) assert.equal((await fetch(base + route)).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/', { headers: { origin: 'https://other.example' } })).status, 403);
  const status = await new Promise(resolve => {
    http.get(base + '/', { headers: { Host: 'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); });
  });
  assert.equal(status, 403);
});

test('여행 계정 서버는 정제한 공개 설정과 필요한 공유 모듈만 연결한다', async t => {
  const accountConfig = { version: 1, supabaseUrl: 'https://auth.example.test', accountApiUrl: 'https://api.example.test',
    supabasePublishableKey: 'sb_publishable_fixture', portalUrl: 'https://portal.example.test/',
    clients: { 'path-travel': { clientId: 'fixture-travel', redirectUri: 'http://127.0.0.1:4303/' } } };
  const server = createServer({ port: 0, accountConfig });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/config.json'), config = await response.json();
  assert.equal(config.clients['path-travel'].clientId, 'fixture-travel');
  assert.equal(Object.hasOwn(config, 'configured'), false);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/auth\.example\.test https:\/\/api\.example\.test;/);
  assert.equal((await (await fetch(base + '/api/health')).json()).accountSync, true);
  for (const route of ['/synk-account/src/account-notebook.mjs', '/synk-account/src/account-notebook.css', '/synk-account/src/product-account.mjs', '/synk-account/src/platform-entry.mjs', '/path-travel/planner.mjs', '/planner-login-draft.mjs']) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  for (const route of ['/synk-account/config.json', '/synk-account/server-shared.mjs', '/path-travel/server.mjs']) assert.equal((await fetch(base + route)).status, 404, route);
  for (const route of ['/config.json', '/?state=fixture&code=fixture']) assert.equal((await fetch(base + route, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403, route);
});

test('Chrome 외부 첫 진입은 403 안내에서 고정된 같은 출처 링크로만 다시 연다', async t => {
  const server = createServer({ port: 0 });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const navigation = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  // Node fetch supplies its own sec-fetch-mode; use HTTP to send Chrome's
  // observed navigation metadata unchanged, including the absent Origin.
  const request = (route, headers = navigation, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request(base, { path: route, method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
      response.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
  const direct = await request('/', { ...navigation, 'sec-fetch-site': 'same-origin' });
  assert.equal(direct.status, 200);
  assert.match(direct.body, /planner-ui\.mjs/);
  let entryHtml;
  for (const route of ['/', '/index.html', '/planner.html']) {
    const response = await request(route, { ...navigation, referer: 'https://external.example/?untrusted-referrer' });
    assert.equal(response.status, 403, route);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8', route);
    assert.equal(response.headers['content-security-policy'], direct.headers['content-security-policy'], route);
    assert.equal(response.headers['cache-control'], 'no-store', route);
    assert.equal(response.headers.location, undefined, route);
    assert.match(response.body, /<a href="\/">여행 계획 열기<\/a>/);
    assert.doesNotMatch(response.body, /<script|http-equiv|untrusted-referrer|external\.example|config\.json|planner-ui\.mjs/i);
    entryHtml ??= response.body;
    assert.equal(response.body, entryHtml, '요청 경로나 헤더를 HTML에 반영하지 않는다');
    const link = /<a href="([^"]+)">/.exec(response.body)[1];
    assert.equal((await request(link, { ...navigation, 'sec-fetch-site': 'same-origin' })).status, 200);
  }
  for (const [route, extra, method] of [
    ['/api/health'], ['/config.json'], ['/planner-ui.mjs'], ['/server.mjs'], ['/synk-account/server-shared.mjs'],
    ['/?state=fixture&code=fixture'], ['/?next=https%3A%2F%2Fexternal.example'], ['/#fragment'],
    ['/', { 'sec-fetch-mode': 'cors' }], ['/', { 'sec-fetch-mode': '' }], ['/', { 'sec-fetch-dest': 'iframe' }],
    ['/', { origin: 'https://other.example' }], ['/', { origin: base }], ['/', { origin: '' }], ['/', {}, 'HEAD'],
  ]) {
    const response = await request(route, { ...navigation, ...extra }, method);
    assert.equal(response.status, 403, route);
    assert.equal(response.headers['content-type'], 'application/json; charset=utf-8', route);
    if (method !== 'HEAD') assert.deepEqual(JSON.parse(response.body), { error: '이 앱에서 직접 열어 주세요.' }, route);
  }
  for (const route of ['/server.mjs', '/synk-account/server-shared.mjs']) {
    assert.equal((await request(route, { ...navigation, 'sec-fetch-site': 'same-origin' })).status, 404, route);
  }
});

test('계획 화면의 상대 import와 로그인 연결은 브라우저에서 전이 의존성까지 제공된다', async t => {
  const server = createServer({ port: 0 });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const pending = [new URL('/planner-ui.mjs', base)], seen = new Set(), failures = [];
  while (pending.length) {
    const url = pending.shift();
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const response = await fetch(url);
    if (response.status !== 200) { failures.push(`${url.pathname}: HTTP ${response.status}`); continue; }
    if (!/^text\/javascript\b/.test(response.headers.get('content-type') ?? '')) {
      failures.push(`${url.pathname}: ${response.headers.get('content-type')}`); continue;
    }
    const source = await response.text();
    // Follow literal imports, including the account notebook loaded at startup,
    // and module workers started from new URL('./x.mjs', import.meta.url).
    // Other computed URLs are not browser module dependencies in this controller.
    const imports = [
      ...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"\n]+)['"]/g),
      ...source.matchAll(/\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g),
      ...source.matchAll(/\bnew URL\(\s*['"](\.[^'"\n]+\.m?js)['"]\s*,\s*import\.meta\.url\s*\)/g),
    ];
    for (const [, specifier] of imports) {
      if (!specifier.startsWith('.')) continue;
      const dependency = new URL(specifier, url);
      assert.equal(dependency.origin, base);
      pending.push(dependency);
    }
  }
  assert.ok(seen.has(base + '/synk-account/src/account-notebook.mjs'), '계정 화면의 동적 import도 검사한다');
  assert.ok(seen.has(base + '/synk-account/src/personal-data.mjs'), '계정 자료 계약까지 검사한다');
  assert.ok(seen.has(base + '/question-worker.mjs'), '확인 질문 워커와 그 의존 모듈도 검사한다');
  assert.deepEqual(failures, [], '여행 화면에서 실제 요청하는 모듈이 모두 JavaScript로 제공되어야 한다');
});

test('확인 질문 워커는 같은 출처 모듈 워커로만 허용되고 원본 바이트와 지도를 그대로 받는다', async t => {
  const server = createServer({ port: 0 });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/question-worker.mjs');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript\b/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL('../experiences/path-travel/question-worker.mjs', import.meta.url)));
  // 워커 안의 import·fetch는 워커 응답의 정책을 따른다. 페이지와 워커 모두 같은 출처만 허용한다.
  for (const route of ['/', '/question-worker.mjs']) {
    const policy = (await fetch(base + route)).headers.get('content-security-policy').split(';').map(part => part.trim());
    for (const directive of ["worker-src 'self'", "script-src 'self'"]) assert.ok(policy.includes(directive), `${route}: ${directive}`);
    assert.ok(policy.some(part => part.startsWith("connect-src 'self'")), route);
  }
  const worker = await (await fetch(base + '/question-worker.mjs')).text();
  assert.match(worker, /new URL\('\.\/assets\/jongno-walking\.json',import\.meta\.url\)/);
  assert.equal((await fetch(base + '/assets/jongno-walking.json')).status, 200);
});

test('계정의 CommonJS 의존 계약은 HTTP ESM으로 실행되며 원본 검증 동작을 보존한다', async t => {
  const server = createServer({ port: 0 });
  await server.start(); t.after(() => server.stop());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/synk-account/src/member-understanding-data.mjs`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript\b/);
  // A standalone ESM URL cannot resolve unbundled relative imports or require().
  const browserModule = await import(`data:text/javascript;base64,${Buffer.from(await response.text()).toString('base64')}`);
  assert.deepEqual(browserModule.emptyMemberUnderstanding(), emptyMemberUnderstanding());
  const now = '2026-10-18T03:00:00.000Z', text = '혼자 하는 게 좋지만 처음에는 예시가 필요해';
  const parsed = Statement.parseMemberStatement(text);
  assert.equal(parsed.question, null);
  const value = {
    version: 10, reviews: [],
    overrides: [{ id: '11111111-1111-4111-8111-111111111111', facetId: 'topics', values: ['ai-tools', 'travel-food'], note: '', at: now }],
    statements: [{ id: '22222222-2222-4222-8222-222222222222', parserVersion: Statement.PARSER_VERSION,
      text, at: now, confirmedAt: now, meanings: parsed.meanings, clarifications: [] }],
  };
  const options = { now, enforceTime: true };
  assert.deepEqual(browserModule.validateMemberUnderstanding(value, options), validateMemberUnderstanding(value, options));
  for (const bad of [
    { ...value, accountId: 'another-owner' },
    { ...value, overrides: [{ ...value.overrides[0], values: ['unknown-topic'] }] },
    { ...value, statements: [{ ...value.statements[0], text: '원래 진술과 다른 내용' }] },
  ]) {
    assert.throws(() => validateMemberUnderstanding(bad, options), { code: 'INVALID_PERSONAL_STATE' });
    assert.throws(() => browserModule.validateMemberUnderstanding(bad, options), { code: 'INVALID_PERSONAL_STATE' });
  }
});

test('남은 계획 자료 8개와 장소 사진 13장은 원본 바이트와 출처 연결 그대로 제공된다', async t => {
  const server = createServer({ port: 0 });
  await server.start(); t.after(() => server.stop());
  const base = `http://127.0.0.1:${server.address().port}`;
  const files = [
    ['planner-account-session.mjs', 'text/javascript'], ['planner-login-draft.mjs', 'text/javascript'],
    ['planner-origin.mjs', 'text/javascript'], ['planner-ui.mjs', 'text/javascript'],
    ['planner.css', 'text/css'], ['planner.html', 'text/html'],
    ['walking-router.mjs', 'text/javascript'], ['assets/jongno-walking.json', 'application/json'],
  ];
  for (const [file, type] of files) {
    const response = await fetch(`${base}/${file}`);
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('content-type').split(';')[0], type, file);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(`../experiences/path-travel/${file}`, import.meta.url)), file);
  }
  for (const entry of ['/', '/planner.html']) {
    const html = await (await fetch(base + entry)).text();
    assert.match(html, /href="\.\/planner\.css"/, entry);
    assert.match(html, /type="module" src="\.\/planner-ui\.mjs"/, entry);
  }
  assert.equal(PHOTO_CREDITS.length, 13);
  assert.equal(TRAVEL_PLACES.filter(place => place.photo).length, 13);
  for (const photo of PHOTO_CREDITS) {
    const place = TRAVEL_PLACES.find(row => row.id === photo.id);
    assert.equal(place?.photo?.src, photo.src, photo.id);
    assert.ok(photo.author && photo.license && photo.sourceUrl && photo.licenseUrl, photo.id);
    const response = await fetch(new URL(photo.src, base + '/'));
    assert.equal(response.status, 200, photo.src);
    assert.equal(response.headers.get('content-type'), 'image/jpeg', photo.src);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, photo.bytes, photo.src);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), photo.sha256, photo.src);
  }
});
